import { describe, expect, it } from "vitest";
import source from "./index.ts?raw";

describe("component startup", () => {
  it("mounts persistent panel markup before layer controls initialize", () => {
    const layersRuntime = source.indexOf("initializeLayerControlsRuntime()");

    expect(source.indexOf("mountStylePanel()")).toBeLessThan(layersRuntime);
    expect(source.indexOf("mountOptionsPanel()")).toBeLessThan(layersRuntime);
  });
});
