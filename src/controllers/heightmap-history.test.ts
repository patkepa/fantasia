import { describe, expect, it } from "vitest";
import { HeightmapHistory } from "./heightmap-history";

describe("HeightmapHistory", () => {
  it("restores snapshots and discards redo history after a new edit", () => {
    const history = new HeightmapHistory();
    history.reset(Uint8Array.from([1, 2]));
    history.commit(Uint8Array.from([3, 4]));

    expect(history.restore(history.previousPosition)).toEqual(Uint8Array.from([1, 2]));
    expect(history.canRedo).toBe(true);

    history.commit(Uint8Array.from([5, 6]));
    expect(history.canRedo).toBe(false);
    expect(history.restore(history.nextPosition)).toBeUndefined();
    expect(history.current).toEqual(Uint8Array.from([5, 6]));
  });

  it("keeps snapshots isolated from later caller mutations", () => {
    const history = new HeightmapHistory();
    const heights = Uint8Array.from([1, 2]);
    history.reset(heights);
    heights[0] = 9;

    const restored = history.restore(1)!;
    restored[1] = 8;
    expect(history.current).toEqual(Uint8Array.from([1, 2]));
  });

  it("restores terrain state claims with the corresponding height snapshot", () => {
    const history = new HeightmapHistory();
    history.reset(Uint8Array.from([19]), Uint16Array.from([0]));
    history.commit(Uint8Array.from([20]), Uint16Array.from([7]));

    history.restore(history.previousPosition);
    expect(history.currentStateClaims).toEqual(Uint16Array.from([0]));
  });
});
