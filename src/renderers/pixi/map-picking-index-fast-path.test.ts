import { describe, expect, it } from "vitest";
import type { MapRenderWorld } from "../scene/render-world";
import { MapPickingIndex } from "./map-picking-index";

describe("Pixi cell-assignment picking fast path", () => {
  it("keeps the index geometry while switching to the latest cell-assignment world", () => {
    const index = new MapPickingIndex();
    index.replaceEntries([], createWorld(1));
    expect(index.pick({ x: 5, y: 5 }, query())).toMatchObject({ domainId: 1, layer: "states" });

    index.updateWorldReference(createWorld(2));
    expect(index.pick({ x: 5, y: 5 }, query())).toMatchObject({ domainId: 2, layer: "states" });
  });
});

function createWorld(stateId: number): MapRenderWorld {
  return {
    cells: {
      biome: Uint8Array.from([0]),
      culture: Uint16Array.from([0]),
      f: Uint16Array.from([1]),
      h: Uint8Array.from([30]),
      i: Uint16Array.from([0]),
      p: [[5, 5]],
      province: Uint16Array.from([0]),
      religion: Uint16Array.from([0]),
      state: Uint16Array.from([stateId])
    },
    vertices: {
      p: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ]
    }
  } as unknown as MapRenderWorld;
}

function query() {
  return { cameraScale: 1, isLayerVisible: () => true, tolerance: 8 };
}
