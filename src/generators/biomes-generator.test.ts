import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";

describe("Biomes", () => {
  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as Window & typeof globalThis);
    globalThis.grid = {
      cells: {
        prec: Uint8Array.from([0, 100, 5]),
        temp: Int8Array.from([20, 20, 20])
      }
    } as Grid;
    globalThis.pack = {
      cells: {
        c: [[1, 2], [0], [0]],
        fl: Uint16Array.from([0, 0, 0]),
        g: Uint16Array.from([0, 1, 2]),
        h: Uint8Array.from([20, 19, 20]),
        i: Uint16Array.from([0, 1, 2]),
        r: Uint16Array.from([0, 0, 0])
      }
    } as unknown as PackedGraph;
    await import("./biomes-generator");
  });

  it("averages only the current cell and adjacent land moisture", () => {
    window.Biomes.define();

    // Cell 0 has 0 precipitation, one water neighbor at 100, and one land neighbor at 5. Including the water
    // neighbor would produce a tropical biome; the land-only average produces the expected savanna biome instead.
    expect(pack.cells.biome[0]).toBe(3);
  });
});
