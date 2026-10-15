import { afterEach, describe, expect, it, vi } from "vitest";
import { HeightmapHistory } from "./heightmap-history";

vi.mock("@/components/ui/dom-dialog", () => ({ showDomDialog: vi.fn() }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), showMainTip: vi.fn() }));

import { tip } from "@/components/tooltips";

const toolbar = new Map<string, () => void>();

(globalThis as Record<string, unknown>).ERROR = false;
const originalGetElementById = document.getElementById;
document.getElementById = ((id: string) =>
  ({
    on: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (_event: string, callback: () => void) => toolbar.set(id, callback),
    removeEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {}
  }) as unknown as HTMLElement) as typeof document.getElementById;
const { claimExpandedTerrainForState, createAvailableLandCellFinder } = await import("./heightmap-editor");
document.getElementById = originalGetElementById;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("heightmap editor controls", () => {
  it.each(["undo", "redo"])("restores %s availability when brushes are reopened", button => {
    vi.spyOn(HeightmapHistory.prototype, "canUndo", "get").mockReturnValue(button === "undo");
    vi.spyOn(HeightmapHistory.prototype, "canRedo", "get").mockReturnValue(button === "redo");
    const controls = new Map<string, { disabled: boolean; addEventListener: () => void }>();
    const dialogs = {
      insertAdjacentHTML: (_position: string, html: string) => {
        for (const match of html.matchAll(/id="([^"]+)"/g)) {
          controls.set(match[1], { disabled: true, addEventListener: () => {} });
        }
      }
    };
    vi.spyOn(document, "getElementById").mockImplementation(
      id => (id === "dialogs" ? dialogs : (controls.get(id) ?? null)) as HTMLElement | null
    );
    toolbar.get("paintBrushes")!();
    expect(controls.get(button)?.disabled).toBe(false);
    controls.clear(); // Closing destroys the panel, but retains terrain history.
    toolbar.get("paintBrushes")!();
    expect(controls.get(button)?.disabled).toBe(false);
  });

  it("rejects fewer than 200 land cells regardless of ocean display", () => {
    vi.stubGlobal("grid", { cells: { h: new Uint8Array(1000).fill(19).fill(20, 0, 199) } });
    vi.mocked(tip).mockClear();
    toolbar.get("finalizeHeightmap")!();
    expect(tip).toHaveBeenCalledWith(
      "Insufficient land area. There should be at least 200 land cells!",
      false,
      "error"
    );
  });

  it("accepts exactly 200 land cells and proceeds to the next validation", () => {
    vi.stubGlobal("grid", { cells: { h: new Uint8Array(1000).fill(19).fill(20, 0, 200) } });
    vi.spyOn(document, "getElementById").mockImplementation(id =>
      id === "imageConverter" ? ({} as HTMLElement) : null
    );
    vi.mocked(tip).mockClear();
    toolbar.get("finalizeHeightmap")!();
    expect(tip).toHaveBeenCalledWith("Please exit the Image Conversion mode first", false, "error");
  });
});

describe("createAvailableLandCellFinder", () => {
  const cells: Parameters<typeof createAvailableLandCellFinder>[0] = {
    h: [25, 30, 18, 40],
    p: [
      [0, 0],
      [10, 0],
      [5, 0],
      [100, 0]
    ]
  };

  it("returns the nearest land cell and removes it from later assignments", () => {
    const findCell = createAvailableLandCellFinder(cells);

    expect(findCell(1, 0)).toBe(0);
    expect(findCell(1, 0)).toBe(1);
    expect(findCell(1, 0)).toBe(3);
  });

  it("never returns water cells", () => {
    const findCell = createAvailableLandCellFinder(cells);

    expect(findCell(5, 0)).not.toBe(2);
  });

  it("returns undefined when no land cell remains", () => {
    const findCell = createAvailableLandCellFinder({ h: [10], p: [[0, 0]] });

    expect(findCell(0, 0)).toBeUndefined();
  });
});

describe("claimExpandedTerrainForState", () => {
  it("assigns only cells that cross sea level to the state at the drag origin", () => {
    const claims = new Uint16Array(3);

    claimExpandedTerrainForState(claims, [19, 20, 18], [20, 24, 19], [0, 1, 2], 4);

    expect(claims).toEqual(Uint16Array.from([4, 0, 0]));
  });

  it("does not claim terrain when the drag starts in neutral territory", () => {
    const claims = new Uint16Array(1);

    claimExpandedTerrainForState(claims, [19], [20], [0], 0);

    expect(claims).toEqual(Uint16Array.from([0]));
  });
});
