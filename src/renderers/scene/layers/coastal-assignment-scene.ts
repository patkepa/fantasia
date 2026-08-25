import type { PackedGraph } from "@/types/PackedGraph";
import type { MapLayerId } from "../../core/layer-registry";
import {
  type LineBatchPrimitive,
  type LinePathPrimitive,
  mergeSceneBounds,
  type SceneBounds,
  type SceneRevision
} from "../primitives";

export interface CoastalAssignmentSource {
  cells: Pick<PackedGraph["cells"], "h" | "i" | "v">;
  vertices: Pick<PackedGraph["vertices"], "c" | "p">;
}

export interface CoastalAssignmentEdge {
  cellId: number;
  edgeKey: string;
  points: readonly [[number, number], [number, number]];
}

/** Builds the original land-cell edges that need to bleed beneath the detailed coastline. */
export function buildCoastalAssignmentScene(
  source: CoastalAssignmentSource,
  assignments: ArrayLike<number>,
  layer: Extract<MapLayerId, "biomes" | "cultures" | "provinces" | "religions" | "states">,
  revision: SceneRevision = 0
): LineBatchPrimitive {
  return buildCoastalAssignmentSceneFromEdges(buildCoastalAssignmentEdges(source), assignments, layer, revision);
}

export function buildCoastalAssignmentEdges(source: CoastalAssignmentSource): CoastalAssignmentEdge[] {
  const edges: CoastalAssignmentEdge[] = [];

  for (const cellId of source.cells.i) {
    const vertexIds = source.cells.v[cellId];
    if (source.cells.h[cellId] < 20 || !vertexIds?.length) continue;

    for (let index = 0; index < vertexIds.length; index++) {
      const startId = vertexIds[index];
      const endId = vertexIds[(index + 1) % vertexIds.length];
      const adjacentCells = source.vertices.c[startId]?.filter(
        adjacent => adjacent >= 0 && adjacent < source.cells.i.length && source.vertices.c[endId]?.includes(adjacent)
      );
      const hasLandNeighbor = adjacentCells?.some(adjacent => adjacent !== cellId && source.cells.h[adjacent] >= 20);
      if (hasLandNeighbor) continue;

      const start = source.vertices.p[startId];
      const end = source.vertices.p[endId];
      if (!isFinitePoint(start) || !isFinitePoint(end)) continue;
      const edgeKey = startId < endId ? `${startId}:${endId}` : `${endId}:${startId}`;
      edges.push({ cellId, edgeKey, points: [start, end] });
    }
  }

  return edges;
}

export function buildCoastalAssignmentSceneFromEdges(
  edges: readonly CoastalAssignmentEdge[],
  assignments: ArrayLike<number>,
  layer: Extract<MapLayerId, "biomes" | "cultures" | "provinces" | "religions" | "states">,
  revision: SceneRevision = 0
): LineBatchPrimitive {
  const paths: LinePathPrimitive[] = [];
  let bounds: SceneBounds | null = null;

  for (const edge of edges) {
    const assignment = assignments[edge.cellId];
    if (!assignment) continue;
    const [start, end] = edge.points;
    paths.push({ domainId: `${layer}:${assignment}:${edge.edgeKey}`, points: edge.points, role: String(assignment) });
    bounds = mergeSceneBounds(bounds, {
      maxX: Math.max(start[0], end[0]),
      maxY: Math.max(start[1], end[1]),
      minX: Math.min(start[0], end[0]),
      minY: Math.min(start[1], end[1])
    });
  }

  return {
    bounds,
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer,
    paths,
    revision
  };
}

function isFinitePoint(point: [number, number] | undefined): point is [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}
