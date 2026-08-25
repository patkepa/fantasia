import { beforeEach, describe, expect, test, vi } from "vitest";

const overlays = vi.hoisted(() => ({
  assignment: vi.fn(),
  country: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/renderers/interaction/map-domain-overlay", () => ({
  getAssignmentOverlay: overlays.assignment,
  getCountrySelectionOverlay: overlays.country
}));

vi.mock("@/renderers/pixi/pixi-renderer-controller", () => ({
  updateMapInteractionOverlay: overlays.update
}));

import { clearSelectedCountry, getSelectedProvinceId, selectCountry } from "./country-selection";

describe("country selection", () => {
  beforeEach(() => {
    overlays.assignment.mockReset();
    overlays.country.mockReset();
    overlays.update.mockReset();
    globalThis.pack = {
      cells: { province: Uint16Array.from([0, 1]) },
      provinces: [0, { i: 1, state: 1 }],
      states: [0, { i: 1 }]
    } as any;
    window.LayerControls = { getSnapshot: () => ({ selectedPreset: "political" }) } as any;
    window.dispatchEvent = vi.fn();
    overlays.country.mockReturnValue(["country outline"]);
    overlays.assignment.mockReturnValue(["province outline"]);
  });

  test("outlines the province clicked within the selected country", () => {
    expect(selectCountry(1, 1)).toBe(true);
    expect(getSelectedProvinceId()).toBe(1);
    expect(overlays.assignment).toHaveBeenCalledWith(
      pack.cells.province,
      1,
      expect.objectContaining({ fill: "none", stroke: "#ffffff" })
    );
    expect(overlays.update).toHaveBeenCalledWith({ selection: ["country outline", "province outline"] });
  });

  test("does not select a province from another country", () => {
    pack.provinces[1].state = 2;

    expect(selectCountry(1, 1)).toBe(true);
    expect(getSelectedProvinceId()).toBeNull();
    expect(overlays.update).toHaveBeenCalledWith({ selection: ["country outline"] });
  });

  test("clears the province with the country selection", () => {
    selectCountry(1, 1);
    clearSelectedCountry();

    expect(getSelectedProvinceId()).toBeNull();
    expect(overlays.update).toHaveBeenLastCalledWith({ selection: null });
  });
});
