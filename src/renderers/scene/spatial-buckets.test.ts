import { describe, expect, it } from "vitest";
import { bucketSpatialItems } from "./spatial-buckets";

describe("bucketSpatialItems", () => {
  it("groups nearby instances and preserves their combined bounds", () => {
    const buckets = bucketSpatialItems(
      [
        { height: 10, width: 10, x: 2, y: 3 },
        { height: 15, width: 20, x: 70, y: 30 },
        { height: 4, width: 5, x: 101, y: 0 }
      ],
      100
    );

    expect(buckets).toEqual([
      {
        bounds: { maxX: 90, maxY: 45, minX: 2, minY: 3 },
        items: [
          { height: 10, width: 10, x: 2, y: 3 },
          { height: 15, width: 20, x: 70, y: 30 }
        ],
        key: "0:0"
      },
      {
        bounds: { maxX: 106, maxY: 4, minX: 101, minY: 0 },
        items: [{ height: 4, width: 5, x: 101, y: 0 }],
        key: "1:0"
      }
    ]);
  });
});
