import { describe, expect, it } from "vitest";
import rendererSource from "./pixi-map-renderer.ts?raw";
import controllerSource from "./pixi-renderer-controller.ts?raw";

describe("Pixi assignment update fast path", () => {
  it("keeps WebGL as the compatibility default and WebGPU opt-in", () => {
    expect(controllerSource.includes('get("renderer") === "webgpu" ? "webgpu" : "webgl"')).toBe(true);
  });

  it("reuses committed world and style snapshots for retained cell assignment updates", () => {
    expect(controllerSource.includes("const CELL_ASSIGNMENT_LAYERS")).toBe(true);
    expect(controllerSource.includes("isAssignment ? (lastWorld ?? getWorld()) : getWorld()")).toBe(true);
    expect(controllerSource.includes("isAssignment ? (lastRendererStyle ?? getMapRendererStyle(style))")).toBe(true);
  });

  it("does not clone the semantic style for an assignment-only scheduled render", () => {
    expect(rendererSource.includes('if (invalidation.kind !== "assignment") this.queuedStyle = style;')).toBe(true);
  });
});
