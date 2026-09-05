import { describe, expect, it } from "vitest";
import {
  buildCellFillAttributes,
  createCellFillColorResolver,
  parseColor,
  updateCellFillAttributes
} from "./cell-fill-attributes";
import { buildRetainedCellTopology, getRetainedCellTopologyTiles } from "./retained-cell-topology";

const topology = buildRetainedCellTopology({
  cellIds: [0, 1],
  cellVertices: [
    [0, 1, 2],
    [1, 3, 2]
  ],
  revision: 1,
  vertexPoints: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ]
});

describe("cell fill attributes", () => {
  it("ignores cells from other tiles that share the same local range index", () => {
    const tiledTopology = buildRetainedCellTopology({
      cellIds: [0, 7],
      cellVertices: [[0, 1, 2], undefined, undefined, undefined, undefined, undefined, undefined, [3, 4, 5]],
      revision: 1,
      vertexPoints: [
        [0, 0],
        [10, 0],
        [0, 10],
        [1024, 0],
        [1034, 0],
        [1024, 10]
      ]
    });
    const [first, second] = getRetainedCellTopologyTiles(tiledTopology);
    const source = {
      assignments: new Uint8Array(8).fill(1),
      colors: [{}, { color: "#ff0000" }],
      fallbackColor: "#888888",
      heights: new Uint8Array(8).fill(20)
    };
    const firstColors = buildCellFillAttributes(first, source);
    const secondColors = buildCellFillAttributes(second, source);
    source.assignments[7] = 0;
    expect(updateCellFillAttributes(firstColors, first, source, [7])).toBeNull();
    expect([...firstColors]).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
    expect(updateCellFillAttributes(secondColors, second, source, [7])).toEqual({ vertexCount: 3, vertexOffset: 0 });
    expect([...secondColors]).toEqual(new Array(12).fill(0));
    expect(updateCellFillAttributes(secondColors, second, source, [3, 99])).toBeNull();
  });

  it("duplicates semantic group colors over each retained cell vertex", () => {
    const attributes = buildCellFillAttributes(topology, {
      assignments: Uint8Array.from([1, 2]),
      colors: [{}, { color: "#ff0000" }, { color: "#00ff00" }],
      fallbackColor: "#888888",
      heights: Uint8Array.from([20, 20])
    });

    expect([...attributes.slice(0, 12)]).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
    expect([...attributes.slice(12)]).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it("updates only requested cells and makes water or neutral cells transparent", () => {
    const attributes = new Float32Array(topology.vertexCount * 4).fill(1);
    const update = updateCellFillAttributes(
      attributes,
      topology,
      {
        assignments: Uint8Array.from([1, 0]),
        colors: [{}, { color: "#123456" }],
        fallbackColor: "#888888",
        heights: Uint8Array.from([20, 20])
      },
      [1]
    );

    expect(update).toEqual({ vertexCount: 3, vertexOffset: 3 });
    expect([...attributes.slice(0, 12)]).toEqual(new Array(12).fill(1));
    expect([...attributes.slice(12)]).toEqual(new Array(12).fill(0));
  });

  it("uses the fallback for SVG paint servers and parses legacy computed rgb colors", () => {
    const attributes = buildCellFillAttributes(topology, {
      assignments: Uint8Array.from([1, 1]),
      colors: [{}, { color: "url(#hatch1)" }],
      fallbackColor: "rgb(128, 64, 0)",
      heights: Uint8Array.from([20, 19])
    });

    expect(attributes[0]).toBeCloseTo(128 / 255);
    expect(attributes[1]).toBeCloseTo(64 / 255);
    expect([...attributes.slice(2, 4)]).toEqual([0, 1]);
    expect([...attributes.slice(12, 16)]).toEqual([0, 0, 0, 0]);
    expect(parseColor("#abc")).toEqual([170 / 255, 187 / 255, 204 / 255]);
  });

  it("reuses resolved domain colors across cells", () => {
    const resolver = createCellFillColorResolver({
      assignments: Uint8Array.from([1, 1]),
      colors: [{}, { color: "#123456" }],
      fallbackColor: "#888888",
      heights: Uint8Array.from([20, 20])
    });

    expect(resolver(0)).toBe(resolver(1));
  });
});
