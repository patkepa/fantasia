import { mergeSceneBounds, type SceneBounds } from "../primitives";

export type { SceneBounds } from "../primitives";

export type CellTopologyRevision = number | string;

export interface CellGeometryRange {
  bounds: SceneBounds;
  cellId: number;
  indexCount: number;
  indexOffset: number;
  triangleCount: number;
  triangleOffset: number;
  vertexCount: number;
  vertexOffset: number;
}

export interface RetainedCellTopology {
  bounds: SceneBounds | null;
  cellRangeIndices: Int32Array;
  cellRanges: readonly CellGeometryRange[];
  indices: Uint16Array | Uint32Array;
  positions: Float32Array;
  revision: CellTopologyRevision;
  triangleCount: number;
  vertexCount: number;
}

export interface CellTopologySource {
  cellIds: Iterable<number>;
  cellVertices: readonly (readonly number[] | undefined)[];
  revision: CellTopologyRevision;
  vertexPoints: readonly (readonly [number, number] | undefined)[];
}

export const RETAINED_CELL_TILE_SIZE = 512;

const tileCache = new WeakMap<RetainedCellTopology, readonly RetainedCellTopology[]>();

interface ValidCell {
  bounds: SceneBounds;
  cellId: number;
  vertexIds: readonly number[];
}

/**
 * Build immutable GPU-ready geometry for convex Voronoi cells.
 *
 * Vertices are intentionally duplicated between cells so later layers can update per-cell attributes without
 * splitting shared vertices or rebuilding topology.
 */
export function buildRetainedCellTopology(source: CellTopologySource): RetainedCellTopology {
  const cells: ValidCell[] = [];
  let maxCellId = -1;
  let vertexCount = 0;
  let triangleCount = 0;
  let bounds: SceneBounds | null = null;

  for (const cellId of source.cellIds) {
    maxCellId = Math.max(maxCellId, cellId);
    const vertexIds = getValidVertexIds(source.cellVertices[cellId], source.vertexPoints);
    if (!vertexIds) continue;

    const cellBounds = getBounds(vertexIds, source.vertexPoints);
    cells.push({ bounds: cellBounds, cellId, vertexIds });
    vertexCount += vertexIds.length;
    triangleCount += vertexIds.length - 2;
    bounds = mergeSceneBounds(bounds, cellBounds);
  }

  const positions = new Float32Array(vertexCount * 2);
  const indices = vertexCount > 65_535 ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
  const cellRangeIndices = new Int32Array(maxCellId + 1);
  cellRangeIndices.fill(-1);
  const cellRanges: CellGeometryRange[] = [];
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const { bounds: cellBounds, cellId, vertexIds } of cells) {
    const triangleOffset = indexOffset / 3;
    const cellTriangleCount = vertexIds.length - 2;
    const cellIndexCount = cellTriangleCount * 3;

    for (let vertexIndex = 0; vertexIndex < vertexIds.length; vertexIndex++) {
      const point = source.vertexPoints[vertexIds[vertexIndex]]!;
      const positionOffset = (vertexOffset + vertexIndex) * 2;
      positions[positionOffset] = point[0];
      positions[positionOffset + 1] = point[1];
    }

    for (let triangleIndex = 0; triangleIndex < cellTriangleCount; triangleIndex++) {
      const target = indexOffset + triangleIndex * 3;
      indices[target] = vertexOffset;
      indices[target + 1] = vertexOffset + triangleIndex + 1;
      indices[target + 2] = vertexOffset + triangleIndex + 2;
    }

    cellRangeIndices[cellId] = cellRanges.length;
    cellRanges.push({
      bounds: cellBounds,
      cellId,
      indexCount: cellIndexCount,
      indexOffset,
      triangleCount: cellTriangleCount,
      triangleOffset,
      vertexCount: vertexIds.length,
      vertexOffset
    });
    vertexOffset += vertexIds.length;
    indexOffset += cellIndexCount;
  }

  return {
    bounds,
    cellRangeIndices,
    cellRanges,
    indices,
    positions,
    revision: source.revision,
    triangleCount,
    vertexCount
  };
}

export function getCellGeometryRange(topology: RetainedCellTopology, cellId: number): CellGeometryRange | undefined {
  const rangeIndex = topology.cellRangeIndices[cellId] ?? -1;
  return rangeIndex < 0 ? undefined : topology.cellRanges[rangeIndex];
}

/**
 * Splits immutable cell geometry into coarse spatial tiles. Tiles keep cell-local vertices, so thematic fill layers
 * can cull off-screen mesh work and update only the color buffers touched by a brush.
 */
export function getRetainedCellTopologyTiles(
  topology: RetainedCellTopology,
  tileSize = RETAINED_CELL_TILE_SIZE
): readonly RetainedCellTopology[] {
  if (tileSize === RETAINED_CELL_TILE_SIZE) {
    const cached = tileCache.get(topology);
    if (cached) return cached;
  }

  const rangesByTile = new Map<string, CellGeometryRange[]>();
  for (const range of topology.cellRanges) {
    const centerX = (range.bounds.minX + range.bounds.maxX) / 2;
    const centerY = (range.bounds.minY + range.bounds.maxY) / 2;
    const key = `${Math.floor(centerX / tileSize)}:${Math.floor(centerY / tileSize)}`;
    const ranges = rangesByTile.get(key);
    if (ranges) ranges.push(range);
    else rangesByTile.set(key, [range]);
  }

  const tiles = [...rangesByTile.values()].map(ranges => buildTileTopology(topology, ranges));
  if (tileSize === RETAINED_CELL_TILE_SIZE) tileCache.set(topology, tiles);
  return tiles;
}

export class RetainedCellTopologyCache {
  private topology: RetainedCellTopology | null = null;

  get(source: CellTopologySource): RetainedCellTopology {
    if (this.topology?.revision === source.revision) return this.topology;
    this.topology = buildRetainedCellTopology(source);
    return this.topology;
  }

  clear(): void {
    this.topology = null;
  }
}

function getValidVertexIds(
  sourceIds: readonly number[] | undefined,
  points: CellTopologySource["vertexPoints"]
): readonly number[] | null {
  if (!sourceIds || sourceIds.length < 3) return null;
  const hasClosingVertex = sourceIds.length > 3 && sourceIds[0] === sourceIds.at(-1);
  const vertexIds = hasClosingVertex ? sourceIds.slice(0, -1) : sourceIds;
  if (vertexIds.length < 3 || vertexIds.some(vertexId => !points[vertexId])) return null;
  return vertexIds;
}

function getBounds(vertexIds: readonly number[], points: CellTopologySource["vertexPoints"]): SceneBounds {
  const first = points[vertexIds[0]]!;
  const bounds = { maxX: first[0], maxY: first[1], minX: first[0], minY: first[1] };
  for (let index = 1; index < vertexIds.length; index++) {
    const [x, y] = points[vertexIds[index]]!;
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
  }
  return bounds;
}

function buildTileTopology(
  topology: RetainedCellTopology,
  sourceRanges: readonly CellGeometryRange[]
): RetainedCellTopology {
  const vertexCount = sourceRanges.reduce((count, range) => count + range.vertexCount, 0);
  const triangleCount = sourceRanges.reduce((count, range) => count + range.triangleCount, 0);
  const positions = new Float32Array(vertexCount * 2);
  const indices = vertexCount > 65_535 ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
  const cellRangeIndices = new Int32Array(topology.cellRangeIndices.length);
  cellRangeIndices.fill(-1);
  const cellRanges: CellGeometryRange[] = [];
  let bounds: SceneBounds | null = null;
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const sourceRange of sourceRanges) {
    positions.set(
      topology.positions.subarray(
        sourceRange.vertexOffset * 2,
        (sourceRange.vertexOffset + sourceRange.vertexCount) * 2
      ),
      vertexOffset * 2
    );
    for (let triangleIndex = 0; triangleIndex < sourceRange.triangleCount; triangleIndex++) {
      const target = indexOffset + triangleIndex * 3;
      indices[target] = vertexOffset;
      indices[target + 1] = vertexOffset + triangleIndex + 1;
      indices[target + 2] = vertexOffset + triangleIndex + 2;
    }
    cellRangeIndices[sourceRange.cellId] = cellRanges.length;
    cellRanges.push({
      ...sourceRange,
      indexOffset,
      triangleOffset: indexOffset / 3,
      vertexOffset
    });
    bounds = mergeSceneBounds(bounds, sourceRange.bounds);
    vertexOffset += sourceRange.vertexCount;
    indexOffset += sourceRange.indexCount;
  }

  return {
    bounds,
    cellRangeIndices,
    cellRanges,
    indices,
    positions,
    revision: topology.revision,
    triangleCount,
    vertexCount
  };
}
