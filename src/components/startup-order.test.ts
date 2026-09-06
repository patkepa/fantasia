import { describe, expect, it } from "vitest";
import componentsIndexSource from "./index.ts?raw";
import optionsRuntimeSource from "./options/options-runtime.ts?raw";
import stylePresetsControllerSource from "./style/style-presets-controller.ts?raw";

describe("component startup order", () => {
  it("does not call globals installed by the component entry point during dependency evaluation", () => {
    expect(optionsRuntimeSource.includes("window.enableElementDragging(")).toBe(false);
    expect(optionsRuntimeSource.includes('from "@/components/element-dragging"')).toBe(true);
  });

  it("starts loading the workspace when the DOM is ready without waiting for every asset", () => {
    expect(componentsIndexSource.includes('document.readyState === "loading"')).toBe(true);
    expect(componentsIndexSource.includes('document.addEventListener("DOMContentLoaded", loadWorkspace')).toBe(true);
    expect(componentsIndexSource.includes("else loadWorkspace()")).toBe(true);
    expect(componentsIndexSource.includes('window.addEventListener("load", loadWorkspace')).toBe(false);
  });

  it("loads generation options eagerly so startup can select a heightmap before generating", () => {
    expect(componentsIndexSource.includes('import "./options/options-runtime";')).toBe(true);
    expect(componentsIndexSource.includes('import("./options/options-runtime")')).toBe(false);
  });

  it("keeps the supporter catalog with the options runtime", () => {
    expect(optionsRuntimeSource.includes('from "@/data/supporters"')).toBe(true);
  });

  it("loads map style controls only with the style preset runtime", () => {
    expect(componentsIndexSource.includes('from "./style/map-style-controls"')).toBe(false);
    expect(stylePresetsControllerSource.includes('import("./map-style-controls")')).toBe(true);
  });
});
