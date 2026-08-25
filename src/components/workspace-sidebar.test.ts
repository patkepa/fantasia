import { describe, expect, it } from "vitest";
import workspaceSidebarSource from "./workspace-sidebar.tsx?raw";

describe("workspace sidebar startup", () => {
  it("loads the world preset gallery when World Setup is opened", () => {
    expect(workspaceSidebarSource.includes('import("./world-preset-gallery")')).toBe(true);
    expect(workspaceSidebarSource.includes('from "./world-preset-gallery"')).toBe(false);
  });
});
