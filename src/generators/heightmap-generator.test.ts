import Alea from "alea";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGrid } from "./grid-builder";
import "./heightmap-generator";

describe("heightmap loading failures", () => {
  class TestImage {
    static current: TestImage;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    remove = vi.fn();
    src = "";
    constructor() {
      TestImage.current = this;
    }
  }

  afterEach(() => vi.unstubAllGlobals());

  it("rejects an empty template selection before requesting an image", async () => {
    vi.stubGlobal("TIME", false);
    vi.stubGlobal("seed", "startup");
    vi.stubGlobal("document", { getElementById: () => ({ value: "" }) });
    await expect(window.HeightmapGenerator.generate({})).rejects.toThrow("No heightmap template is selected");
  });

  it("rejects a failed image request instead of leaving generation pending", async () => {
    const canvas = { getContext: () => ({}), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("Image", TestImage);

    let status = "pending";
    const result = window.HeightmapGenerator.fromPrecreated({ cellsX: 1, cellsY: 1 }, "missing").then(
      () => {
        status = "resolved";
      },
      error => {
        status = error.message;
      }
    );
    TestImage.current.onerror?.();
    await Promise.resolve();

    expect(status).toBe("Cannot load heightmap: missing");
    await result;
    expect(canvas.remove).toHaveBeenCalledOnce();
    expect(TestImage.current.remove).toHaveBeenCalledOnce();
  });

  it("rejects image processing errors and releases the temporary elements", async () => {
    const canvas = { getContext: () => null, remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("Image", TestImage);

    const result = window.HeightmapGenerator.fromPrecreated({ cellsX: 1, cellsY: 1 }, "world");
    const rejection = expect(result).rejects.toThrow("Could not get canvas context");
    TestImage.current.onload?.();
    await rejection;
    expect(canvas.remove).toHaveBeenCalledOnce();
    expect(TestImage.current.remove).toHaveBeenCalledOnce();
  });

  it("still resolves a successfully loaded heightmap", async () => {
    const canvas = {
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) })
      }),
      remove: vi.fn()
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("Image", TestImage);

    const graph = { cells: {}, cellsDesired: 1, cellsX: 1, cellsY: 1, points: [[0, 0]] };
    const result = window.HeightmapGenerator.fromPrecreated(graph, "world");
    TestImage.current.onload?.();
    await expect(result).resolves.toEqual(new Uint8Array([100]));
    expect(canvas.remove).toHaveBeenCalledOnce();
    expect(TestImage.current.remove).toHaveBeenCalledOnce();
  });
});

describe("lone island heightmap", () => {
  it.each([
    "lone-island-a",
    "lone-island-b",
    "lone-island-c"
  ])("creates one small connected landmass for seed %s", seed => {
    globalThis.graphWidth = 960;
    globalThis.graphHeight = 540;
    Math.random = Alea(seed);

    const graph = buildGrid({ cellsDesired: 4000, graphHeight, graphWidth, seed });
    const heights = window.HeightmapGenerator.fromTemplate(graph, "loneIsland");
    expect(heights).not.toBeNull();

    const land = new Set(graph.cells.i.filter(cell => (heights?.[cell] ?? 0) >= 20));
    const landShare = land.size / graph.cells.i.length;
    expect(landShare).toBeGreaterThan(0.01);
    expect(landShare).toBeLessThan(0.2);

    const start = land.values().next().value as number;
    const connected = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of graph.cells.c[queue[head]]) {
        if (!land.has(neighbor) || connected.has(neighbor)) continue;
        connected.add(neighbor);
        queue.push(neighbor);
      }
    }

    expect(connected.size).toBe(land.size);
  });
});
