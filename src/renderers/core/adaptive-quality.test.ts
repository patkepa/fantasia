import { describe, expect, it } from "vitest";
import { selectAdaptiveResolution } from "./adaptive-quality";

describe("selectAdaptiveResolution", () => {
  it("reduces high-density canvases only while interacting", () => {
    expect(selectAdaptiveResolution(2.5, "interactive")).toBe(1.25);
    expect(selectAdaptiveResolution(2.5, "settled")).toBe(2.5);
  });

  it("does not upscale a constrained device", () => {
    expect(selectAdaptiveResolution(1, "interactive")).toBe(1);
  });

  it("honors a renderer-specific interaction cap", () => {
    expect(selectAdaptiveResolution(2, "interactive", { interactionResolutionCap: 0.75, settleDelayMs: 100 })).toBe(
      0.75
    );
  });
});
