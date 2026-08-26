import { describe, expect, it } from "vitest";
import { getRendererFrameIssues, type RendererFrameCandidate } from "./renderer-frame-health";

const healthyFrame: RendererFrameCandidate = {
  batches: 12,
  canvasHeight: 720,
  canvasWidth: 1280,
  cells: 10_000,
  commitSequence: 2,
  contextLost: false,
  enabled: true,
  viewportHeight: 720,
  viewportWidth: 1280
};

describe("renderer frame health", () => {
  it("accepts a non-empty committed frame for the expected world", () => {
    expect(getRendererFrameIssues(healthyFrame, 10_000, 1)).toEqual([]);
  });

  it("reports every invariant that can otherwise present a black canvas", () => {
    expect(
      getRendererFrameIssues(
        {
          ...healthyFrame,
          batches: 0,
          canvasHeight: 0,
          cells: 8,
          commitSequence: 1,
          contextLost: true,
          enabled: false,
          viewportWidth: 0
        },
        10_000,
        1
      )
    ).toEqual([
      "Pixi did not enable its rendering surface",
      "The WebGL context was lost before the map frame committed",
      "Pixi completed without committing a new map frame",
      "Pixi committed 8 cells for a 10000-cell world",
      "Pixi committed an empty map scene",
      "Pixi committed a zero-sized viewport",
      "Pixi committed without a drawable canvas"
    ]);
  });
});
