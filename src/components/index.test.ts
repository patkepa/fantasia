import { describe, expect, it } from "vitest";
import mainRuntimeSource from "../application/main-runtime.ts?raw";
import source from "./index.ts?raw";

describe("component startup", () => {
  it("mounts persistent panel markup before layer controls initialize", () => {
    const layersRuntime = source.indexOf("initializeLayerControlsRuntime()");

    expect(source.indexOf("mountStylePanel()")).toBeLessThan(layersRuntime);
    expect(source.indexOf("mountOptionsPanel()")).toBeLessThan(layersRuntime);
  });

  it("initializes style presets before map generation can apply them", () => {
    expect(source.indexOf("void initializeStylePresetsRuntime()")).toBeGreaterThan(source.indexOf("mountStylePanel()"));
    expect(mainRuntimeSource.indexOf("await initializeStylePresetsRuntime()")).toBeLessThan(
      mainRuntimeSource.indexOf("await StylePresets.applyOnLoad()")
    );
  });
});
