import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";

describe("Lakes", () => {
  const getElementById = document.getElementById;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as Window & typeof globalThis);
    document.getElementById = id =>
      id === "lakeElevationLimitOutput" ? ({ value: "10" } as unknown as HTMLElement) : null;
    globalThis.pack = {
      cells: {
        c: [[1], [0, 2], [1]],
        f: Uint16Array.from([1, 0, 2]),
        i: Uint16Array.from([0, 1, 2])
      },
      features: [0, { height: 20, i: 1, shoreline: [0], type: "lake" }, { height: 0, i: 2, type: "ocean" }]
    } as unknown as PackedGraph;
    await import("./lakes");
  });

  afterEach(() => {
    document.getElementById = getElementById;
  });

  it("opens a lake when a below-threshold path reaches the ocean", () => {
    window.Lakes.detectCloseLakes(Uint8Array.from([20, 10, 0]));

    expect(pack.features[1].closed).toBe(false);
  });
});
