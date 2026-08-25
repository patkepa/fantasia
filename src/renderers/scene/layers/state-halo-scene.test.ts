import { describe, expect, it } from "vitest";
import { buildStateHaloScene } from "./state-halo-scene";

describe("state halo scene", () => {
  it("clips each side of a state border to that state's land cells", () => {
    const scene = buildStateHaloScene(
      {
        cells: {
          c: [[1], [0]],
          h: Uint8Array.from([30, 30]),
          i: [0, 1],
          province: Uint8Array.from([0, 0]),
          state: Uint8Array.from([1, 2]),
          v: [
            [0, 1, 2, 3],
            [1, 4, 5, 2]
          ]
        },
        vertices: {
          c: [
            [0, -1, -1],
            [0, 1, -1],
            [0, 1, -1],
            [0, -1, -1],
            [1, -1, -1],
            [1, -1, -1]
          ],
          p: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [2, 0],
            [2, 1]
          ],
          v: [
            [1, 3, -1],
            [0, 4, 2],
            [1, 5, 3],
            [0, 2, -1],
            [1, 5, -1],
            [4, 2, -1]
          ]
        }
      } as never,
      "states:4"
    );

    expect(scene.revision).toBe("states:4");
    expect(scene.groups.map(group => group.stateId)).toEqual([1, 2]);
    for (const group of scene.groups) {
      expect(group.polygons).toHaveLength(1);
      expect(group.paths).toHaveLength(1);
    }
    expect(scene.groups.map(group => group.paths[0].role)).toEqual(["1", "2"]);
  });
});
