import { type BoundingBox, clipPolyline } from "lineclip";
import type { TypedArray } from "@/types/PackedGraph";
import { getIsolines, parsePathPoints } from "@/utils/pathUtils";
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import type { MapInteractionGeometry, MapInteractionGeometryStyle } from "./map-interaction-overlay";

export function getAssignmentPath(assignments: TypedArray, domainId: number): string {
  return (
    getIsolines(pack, cellId => (assignments[cellId] === domainId ? domainId : null), { fill: true })[domainId]?.fill ??
    ""
  );
}

export function getAssignmentOverlay(
  assignments: TypedArray,
  domainId: number,
  style?: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const path = getAssignmentPath(assignments, domainId);
  return path ? [{ kind: "path", path, style }] : [];
}

/** Uses the same smoothed coastline as the map while retaining exact political borders inland. */
export function getCountrySelectionOverlay(
  countryId: number,
  style: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const selectionPath = getAssignmentPath(pack.cells.state, countryId);
  if (!selectionPath) return [];

  const fillStyle = { ...style, stroke: "none", strokeScaling: undefined, strokeWidth: undefined };
  const outlineStyle = { ...style, fill: "none" };
  const geometries: MapInteractionGeometry[] = [{ kind: "path", path: selectionPath, style: fillStyle }];
  const borderPath = getCountryLandBorderPath(countryId);
  if (borderPath) geometries.push({ kind: "path", path: borderPath, style: outlineStyle });

  const maskStrokeWidth = 12;
  const coastlinePath = getCountryCoastlinePath(countryId, selectionPath, maskStrokeWidth);
  if (coastlinePath) {
    geometries.push({
      kind: "masked-path",
      maskPath: selectionPath,
      maskStrokeWidth,
      path: coastlinePath,
      style: outlineStyle
    });
  }
  return geometries;
}

export function getCellsOverlay(
  cellIds: readonly number[],
  style?: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const path = getCellsPath(cellIds);
  return path ? [{ kind: "path", path, style }] : [];
}

export function getCellsPath(cellIds: readonly number[]): string {
  const cellSet = new Set(cellIds);
  return getIsolines(pack, cellId => (cellSet.has(cellId) ? 1 : null), { fill: true })[1]?.fill ?? "";
}

function getCountryLandBorderPath(countryId: number): string {
  const { cells, vertices } = pack;
  const seenEdges = new Set<string>();
  const segments: string[] = [];
  for (const cellId of cells.i) {
    if (cells.h[cellId] < 20 || cells.state[cellId] !== countryId) continue;
    const cellVertices = cells.v[cellId];
    for (let index = 0; index < cellVertices.length; index++) {
      const startId = cellVertices[index];
      const endId = cellVertices[(index + 1) % cellVertices.length];
      const edgeId = startId < endId ? `${startId}:${endId}` : `${endId}:${startId}`;
      if (seenEdges.has(edgeId)) continue;
      seenEdges.add(edgeId);
      const adjacent = vertices.c[startId]?.filter(
        neighbor => neighbor < cells.i.length && vertices.c[endId]?.includes(neighbor)
      );
      if (!adjacent?.some(neighbor => cells.h[neighbor] >= 20 && cells.state[neighbor] !== countryId)) continue;
      const start = vertices.p[startId];
      const end = vertices.p[endId];
      if (start && end) segments.push(`M${start} L${end}`);
    }
  }
  return segments.join("");
}

function getCountryCoastlinePath(countryId: number, selectionPath: string, maskStrokeWidth: number): string {
  const featureIds = new Set<number>();
  for (const cellId of pack.cells.i) {
    if (pack.cells.state[cellId] === countryId) featureIds.add(pack.cells.f[cellId]);
  }
  // The mask only reveals coastline near the country. Do not send a whole continent's
  // detailed path to SVG or rebuild unrelated islands and lakes for each selection.
  const bounds: BoundingBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of parsePathPoints(selectionPath)) {
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }
  // Include the default SVG miter limit (4) around the mask's stroked boundary.
  const padding = maskStrokeWidth * 2;
  bounds[0] -= padding;
  bounds[1] -= padding;
  bounds[2] += padding;
  bounds[3] += padding;
  const geography = buildBaseGeographyScene(
    { ...pack, features: pack.features.filter(feature => feature && featureIds.has(feature.i)) },
    { height: graphHeight, width: graphWidth }
  );
  return geography.coastline.paths
    .flatMap(path => {
      const points: [number, number][] = path.points.map(([x, y]) => [x, y]);
      if (path.closed && points.length) points.push(points[0]);
      return clipPolyline(points, bounds);
    })
    .map(points => `M${points.join(" L")}`)
    .join("");
}
