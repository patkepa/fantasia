import { afterEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "@/generators/features";
import type { PackedGraph } from "@/types/PackedGraph";
import { getIsolines, parsePathPoints } from "@/utils/pathUtils";
import { getCountrySelectionOverlay } from "./map-domain-overlay";

vi.mock("@/utils/pathUtils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils/pathUtils")>()),
  getIsolines: vi.fn()
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("country selection coastline", () => {
  it("retains the visible coastline while trimming distant parts and skipping unrelated geography", () => {
    const unrelated = {
      i: 2,
      type: "island",
      get vertices(): number[] {
        throw new Error("Unrelated coastline must not be generated");
      }
    } as Feature;
    const unrelatedShape = vi.spyOn(unrelated, "vertices", "get");
    const source = {
      cells: {
        i: [0, 1],
        state: Uint16Array.from([1, 2]),
        f: Uint16Array.from([1, 2]),
        h: Uint8Array.from([30, 30]),
        v: [[], []]
      },
      features: [{ i: 1, type: "island", vertices: [0, 1, 2, 3] }, unrelated],
      vertices: {
        p: [
          [0, 0],
          [10000, 0],
          [10000, 10000],
          [0, 10000]
        ]
      }
    } as unknown as PackedGraph;
    vi.stubGlobal("pack", source);
    vi.stubGlobal("graphWidth", 10000);
    vi.stubGlobal("graphHeight", 10000);
    vi.mocked(getIsolines).mockReturnValue({ 1: { fill: "M0,0 L100,0 L100,100 L0,100 Z" } });

    const overlay = getCountrySelectionOverlay(1, { stroke: "white", strokeWidth: 2 });
    const coastline = overlay.find(geometry => geometry.kind === "masked-path");
    expect(coastline?.kind).toBe("masked-path");
    if (coastline?.kind !== "masked-path") throw new Error("Missing coastline");
    expect(unrelatedShape).not.toHaveBeenCalled();
    expect(coastline.maskStrokeWidth).toBe(12);
    expect(coastline.path.includes("Z")).toBe(false); // clipped fragments must not be joined across the country
    expect(parsePathPoints(coastline.path).every(([x, y]) => x >= -24 && y >= -24 && x <= 124 && y <= 124)).toBe(true);
    expect(coastline.path.includes("0,0")).toBe(true);
    expect(coastline.path.includes("124,0")).toBe(true);
    expect(coastline.path.includes("0,124")).toBe(true);
    vi.mocked(getIsolines).mockReturnValue({ 1: { fill: "M100,100 L200,100 L200,200 L100,200 Z" } });
    expect(getCountrySelectionOverlay(1, {}).some(geometry => geometry.kind === "masked-path")).toBe(false);
  });
});
