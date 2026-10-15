import { describe, expect, it } from "vitest";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import { serializeMapSections } from "./map-data-serializer";
import { decodeMapFile } from "./map-file-decoder";
import { captureMapSaveSections, type MapSaveSource } from "./map-save-snapshot";

function createSource(): MapSaveSource {
  const pack = structuredClone(STATIC_VIEWER_WORLD);
  pack.cells.pop = new Float32Array([1.234567, 2]);
  return {
    pack,
    grid: {
      spacing: 1,
      cellsX: 2,
      cellsY: 1,
      boundary: [],
      points: [
        [0, 0],
        [1, 0]
      ],
      features: [],
      cellsDesired: 2,
      cells: {
        h: new Uint8Array([30, 40]),
        prec: new Uint8Array([50, 60]),
        f: new Uint16Array([1, 1]),
        t: new Int8Array([-1, 1]),
        temp: new Int8Array([-5, 20])
      }
    },
    mapCoordinates: { latT: 90, latN: 45, latS: -45, lonT: 180, lonW: -90, lonE: 90 },
    notes: [{ id: "note1", name: "Original", legend: "Text" }],
    params: "1.143.6|license|2026-10-15|42|100|60|1",
    settings: "km|1",
    serializedSVG: '<svg id="map"></svg>',
    serializedStyle: { labels: { groups: {} }, relief: { set: "simple", size: 1, density: 1 } },
    customGoodIcons: "<symbol id='good-custom-1'/>",
    namesData: "Names|3|8||0|Town",
    fonts: [{ family: "Arial" }]
  };
}

describe("map save capture", () => {
  it("detaches numeric buffers and nested document data before asynchronous IO", () => {
    const source = createSource();
    const sections = captureMapSaveSections(source);
    const before = serializeMapSections(sections);
    source.pack.cells.state[0] = 99;
    source.pack.cells.pop[0] = 99;
    source.grid.cells.temp[0] = 99;
    source.notes[0].name = "Changed";
    source.serializedStyle.relief.size = 99;
    source.fonts[0].family = "Changed";
    expect(serializeMapSections(sections)).toBe(before);
    expect(sections[21].value).toBeInstanceOf(Float32Array);
    expect((sections[21].value as Float32Array)[0]).toBe(new Float32Array([1.234567])[0]);
  });

  it("preserves legacy slots, signed values and population rounding through file decoding", async () => {
    const source = createSource();
    const original = structuredClone(source);
    const encoded = serializeMapSections(captureMapSaveSections(source));
    const slots = await decodeMapFile(new TextEncoder().encode(encoded));
    expect(slots).toHaveLength(50);
    expect(slots[0]).toBe(source.params);
    expect(slots[1]).toBe(source.settings);
    expect(JSON.parse(slots[2])).toEqual(source.mapCoordinates);
    expect(JSON.parse(slots[4])).toEqual(source.notes);
    expect(slots[5]).toBe(source.serializedSVG);
    expect(slots.slice(7, 12)).toEqual(["30,40", "50,60", "1,1", "-1,1", "-5,20"]);
    expect(slots[21]).toBe("1.2346,2");
    expect([slots[23], slots[28], slots[33]]).toEqual(["", "", ""]);
    expect(slots[25]).toBe("1,2");
    expect(slots[31]).toBe(source.namesData);
    expect(JSON.parse(slots[34])).toEqual(source.fonts);
    expect(slots[45]).toBe(source.customGoodIcons);
    expect(JSON.parse(slots[48])).toEqual(source.serializedStyle);
    expect(JSON.parse(slots[49])).toEqual(source.pack.relief);
    expect(source).toEqual(original);
  });
});
