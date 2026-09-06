import { beforeEach, describe, expect, it } from "vitest";
import { getLabelsData } from "./label-data";

function stubPack(rivers: unknown[], routes: unknown[] = []): void {
  globalThis.pack = {
    states: [],
    provinces: [],
    addedLabels: [],
    burgs: [],
    routes,
    rivers,
    cells: { p: [] }
  } as any;
  globalThis.options = { labels: { groups: [] } } as any;
}

describe("river and route labels", () => {
  beforeEach(() => {
    stubPack([]);
  });

  it("does not render river or route names as labels", () => {
    stubPack(
      [{ i: 1, name: "Kobat", type: "River", cells: [2, -1], points: [] }],
      [
        {
          i: 1,
          name: "King's Road",
          points: [
            [0, 0],
            [10, 10]
          ]
        }
      ]
    );

    const labels = getLabelsData();

    expect(labels).not.toContainEqual(expect.objectContaining({ type: "river" }));
    expect(labels).not.toContainEqual(expect.objectContaining({ type: "route" }));
  });
});

describe("labels before map generation", () => {
  it("returns no labels while the pack is still empty", () => {
    globalThis.pack = {} as any;

    expect(getLabelsData()).toEqual([]);
  });
});
