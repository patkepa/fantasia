import type { SceneBounds } from "./primitives";

export interface SpatialItem {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface SpatialBucket<T> {
  bounds: SceneBounds;
  items: readonly T[];
  key: string;
}

/** Groups static world-space instances into coarse tiles so a parent container can be culled at once. */
export function bucketSpatialItems<T extends SpatialItem>(items: readonly T[], tileSize: number): SpatialBucket<T>[] {
  const size = Math.max(1, tileSize);
  const buckets = new Map<string, { bounds: SceneBounds; items: T[] }>();
  for (const item of items) {
    const tileX = Math.floor(item.x / size);
    const tileY = Math.floor(item.y / size);
    const key = `${tileX}:${tileY}`;
    const bounds = { maxX: item.x + item.width, maxY: item.y + item.height, minX: item.x, minY: item.y };
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(item);
      bucket.bounds.minX = Math.min(bucket.bounds.minX, bounds.minX);
      bucket.bounds.minY = Math.min(bucket.bounds.minY, bounds.minY);
      bucket.bounds.maxX = Math.max(bucket.bounds.maxX, bounds.maxX);
      bucket.bounds.maxY = Math.max(bucket.bounds.maxY, bounds.maxY);
    } else buckets.set(key, { bounds, items: [item] });
  }
  return [...buckets].map(([key, bucket]) => ({ ...bucket, key }));
}
