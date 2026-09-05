import { getCellGeometryRange, type RetainedCellTopology } from "./retained-cell-topology";

export interface CellFillAttributeSource {
  assignments: ArrayLike<number>;
  colors: readonly { color?: string }[];
  fallbackColor: string;
  heights: ArrayLike<number>;
}

export interface CellFillAttributeUpdate {
  vertexCount: number;
  vertexOffset: number;
}

export type CellFillColorResolver = (cellId: number) => CellColor | null;

export function buildCellFillAttributes(
  topology: RetainedCellTopology,
  source: CellFillAttributeSource,
  colorResolver = createCellFillColorResolver(source)
): Float32Array {
  const attributes = new Float32Array(topology.vertexCount * 4);
  for (const range of topology.cellRanges)
    writeCellColor(attributes, range.vertexOffset, range.vertexCount, range.cellId, colorResolver);
  return attributes;
}

export function updateCellFillAttributes(
  attributes: Float32Array,
  topology: RetainedCellTopology,
  source: CellFillAttributeSource,
  cellIds: Iterable<number>,
  colorResolver = createCellFillColorResolver(source)
): CellFillAttributeUpdate | null {
  let firstVertex = Number.POSITIVE_INFINITY;
  let lastVertex = -1;

  for (const cellId of cellIds) {
    const range = getCellGeometryRange(topology, cellId);
    if (!range) continue;
    writeCellColor(attributes, range.vertexOffset, range.vertexCount, cellId, colorResolver);
    firstVertex = Math.min(firstVertex, range.vertexOffset);
    lastVertex = Math.max(lastVertex, range.vertexOffset + range.vertexCount);
  }

  return lastVertex < 0 ? null : { vertexCount: lastVertex - firstVertex, vertexOffset: firstVertex };
}

type CellColor = readonly [number, number, number];

export function createCellFillColorResolver(source: CellFillAttributeSource): CellFillColorResolver {
  const fallback = parseColor(source.fallbackColor) ?? [0.533, 0.533, 0.533];
  const colors = new Map<number, CellColor>();
  return cellId => {
    const groupId = source.assignments[cellId];
    if (source.heights[cellId] < 20 || !groupId) return null;
    const cached = colors.get(groupId);
    if (cached) return cached;
    const color = parseColor(source.colors[groupId]?.color) ?? fallback;
    colors.set(groupId, color);
    return color;
  };
}

function writeCellColor(
  attributes: Float32Array,
  vertexOffset: number,
  vertexCount: number,
  cellId: number,
  colorResolver: CellFillColorResolver
): void {
  const color = colorResolver(cellId);
  for (let vertex = vertexOffset; vertex < vertexOffset + vertexCount; vertex++) {
    const offset = vertex * 4;
    attributes[offset] = color?.[0] ?? 0;
    attributes[offset + 1] = color?.[1] ?? 0;
    attributes[offset + 2] = color?.[2] ?? 0;
    attributes[offset + 3] = color ? 1 : 0;
  }
}

export function parseColor(color: string | undefined): readonly [number, number, number] | null {
  if (!color || color.startsWith("url(")) return null;
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map(character => character.repeat(2)).join("") : hex;
    return [0, 2, 4].map(
      offset => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255
    ) as unknown as readonly [number, number, number];
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (!rgb) return null;
  return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
}
