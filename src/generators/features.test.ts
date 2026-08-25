import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "@/types/grid";
import type { GridFeature } from "./features";

describe("Features", () => {
  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.seed = "feature-test";
    globalThis.window = globalThis.window || ({} as Window & typeof globalThis);
    globalThis.grid = {
      cells: {
        b: Uint8Array.from([1, 1, 1, 1]),
        c: [
          [1, 2],
          [0, 3],
          [0, 3],
          [1, 2]
        ],
        h: Uint8Array.from([20, 20, 0, 0]),
        i: Uint16Array.from([0, 1, 2, 3])
      }
    } as unknown as Grid;
    await import("./features");
  });

  it("classifies connected land and water features while marking their coastlines", () => {
    window.Features.markupGrid();

    expect(Array.from(grid.cells.f)).toEqual([1, 1, 2, 2]);
    expect(Array.from(grid.cells.t)).toEqual([1, 1, -1, -1]);
    expect((grid.features.slice(1) as GridFeature[]).map(feature => feature.type)).toEqual(["island", "ocean"]);
  });
});
