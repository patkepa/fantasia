import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapHit } from "@/renderers/core/map-renderer";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: MouseEvent) => void>(),
  burg: vi.fn(),
  label: vi.fn(),
  pick: vi.fn(),
  mode: vi.fn(() => "edit")
}));

vi.mock("d3", () => {
  const selection = {
    style: () => selection,
    attr: () => selection,
    on: (name: string, handler: (event: MouseEvent) => void) => {
      mocks.handlers.set(name, handler);
      return selection;
    },
    call: () => selection
  };
  return { select: () => selection, drag: () => ({ on: vi.fn() }) };
});
vi.mock("@/application/view-session-state", () => ({ setViewSessionSelection: vi.fn() }));
vi.mock("@/application/workspace-mode", () => ({ getWorkspaceMode: mocks.mode }));
vi.mock("@/controllers", () => ({
  Controllers: { BurgEditor: { open: mocks.burg }, LabelsEditor: { open: mocks.label } }
}));
vi.mock("@/renderers/draw-legend", () => ({ dragLegendBox: vi.fn() }));
vi.mock("@/renderers/interaction/map-interaction-overlay", () => ({ ensureMapInteractionSurface: vi.fn() }));
vi.mock("@/renderers/pixi/pixi-renderer-controller", () => ({
  pickPixiRenderer: mocks.pick,
  getPixiMapPointAtClient: () => null
}));
vi.mock("@/utils", () => ({ debounce: (fn: unknown) => fn, findClosestCell: vi.fn() }));
vi.mock("./country-selection", () => ({ clearSelectedCountry: vi.fn(), selectCountry: vi.fn() }));
vi.mock("./map-context", () => ({ buildMapContext: vi.fn() }));
vi.mock("./map-tooltip", () => ({ handleMouseMove: vi.fn() }));
vi.mock("./zoom", () => ({ applyZoomBehavior: vi.fn() }));

import { applyDefaultViewboxEvents } from "./viewbox-events";

describe("Pixi burg label interaction", () => {
  let openBurgId: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mode.mockReturnValue("edit");
    openBurgId = undefined;
    vi.stubGlobal("document", {
      querySelector: () => null,
      getElementById: (id: string) =>
        id === "burgEditor" && openBurgId !== undefined ? { dataset: { burgId: String(openBurgId) } } : null
    });
    mocks.burg.mockImplementation((id: number) => {
      openBurgId = id;
    });
    applyDefaultViewboxEvents();
  });

  afterEach(() => vi.unstubAllGlobals());

  function clickLabel(id: number): void {
    const hit: MapHit = {
      distance: 0,
      domainId: `burg-label:${id}`,
      domainKind: "label",
      kind: "label",
      layer: "labels",
      mapPoint: { x: 10, y: 20 },
      screenPoint: { x: 10, y: 20 },
      subPart: { entityId: id, type: "burg" }
    };
    mocks.pick.mockReturnValue(hit);
    mocks.handlers.get("click")!({ clientX: 10, clientY: 20 } as MouseEvent);
  }

  it("opens each burg, then opens its label editor on a repeated click", () => {
    clickLabel(1);
    expect(mocks.burg).toHaveBeenLastCalledWith(1);
    expect(mocks.label).not.toHaveBeenCalled();
    clickLabel(2);
    expect(mocks.burg).toHaveBeenLastCalledWith(2);
    expect(mocks.label).not.toHaveBeenCalled();
    clickLabel(2);
    expect(mocks.burg).toHaveBeenCalledTimes(2);
    expect(mocks.label).toHaveBeenCalledExactlyOnceWith("burg", 2);
    expect(mocks.pick).toHaveBeenLastCalledWith(10, 20);
  });

  it("does not open mutation editors in view mode", () => {
    mocks.mode.mockReturnValue("view");
    clickLabel(1);
    expect(mocks.burg).not.toHaveBeenCalled();
    expect(mocks.label).not.toHaveBeenCalled();
  });
});
