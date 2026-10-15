import { expect, it } from "vitest";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import { createLegacyMapSaveSource } from "./legacy-map-save-source";
import { serializeMapSections } from "./map-data-serializer";
import { captureMapDocument, type MapDocumentSnapshot } from "./map-document";
import { createMapSaveSections } from "./map-save-snapshot";

function source(): MapDocumentSnapshot {
  return {
    seed: "42",
    mapId: 7,
    graphWidth: 100,
    graphHeight: 60,
    pack: structuredClone(STATIC_VIEWER_WORLD),
    grid: {
      seed: "42",
      spacing: 1,
      cellsX: 2,
      cellsY: 1,
      cellsDesired: 2,
      boundary: [],
      points: [
        [0, 0],
        [1, 0]
      ],
      features: [],
      vertices: { p: [[0, 0]], v: [[]], c: [[]] },
      cells: {
        i: new Uint16Array([0, 1]),
        c: [[1], [0]],
        v: [[0], [0]],
        b: [1, 1],
        h: new Uint8Array([30, 40]),
        prec: new Uint8Array([1, 2]),
        f: new Uint16Array([1, 1]),
        t: new Int8Array([-1, 1]),
        temp: new Int8Array([-5, 20])
      }
    },
    mapCoordinates: {},
    notes: [{ id: "1", name: "A", legend: "B" }],
    options: {
      year: 100,
      era: "Test",
      eraShort: "T",
      pinNotes: false,
      winds: [0],
      temperatureEquator: 25,
      temperatureNorthPole: -20,
      temperatureSouthPole: -20,
      mapSize: 100,
      latitude: 50,
      longitude: 50,
      prec: 100,
      showBurgPreview: false,
      burgs: { groups: [] },
      labels: { resizeOnZoom: true, showAll: false, groups: [] },
      military: [],
      trade: {
        animation: {
          displayType: "both",
          concurrent: 30,
          duration: 250,
          landDurationModifier: 5,
          segmentChangePause: 1000,
          markerSize: 4
        }
      }
    },
    style: { labels: { groups: {} }, relief: { set: "simple", size: 1, density: 1 } },
    settings: {
      distanceUnit: "km",
      distanceScale: 3,
      areaUnit: "square",
      heightUnit: "m",
      heightExponent: "1.8",
      temperatureScale: "°C",
      populationRate: 1000,
      urbanization: 2,
      urbanDensity: 10,
      growthRate: "1.1",
      mapName: "Test world",
      stylePreset: "default"
    },
    nameBases: [{ i: 0, name: "Test", min: 3, max: 8, d: "", m: 0, b: "A,B" }]
  };
}

it("captures full topology and named settings without retaining source references or extra session fields", () => {
  const input = { ...source(), camera: { resource: () => {} } };
  input.pack.cells.pop = new Float32Array([1.234567, 2]);
  const snapshot = captureMapDocument(input);
  input.pack.cells.state[0] = 90;
  input.pack.cells.c[0].push(99);
  input.grid.cells.temp[0] = 90;
  input.grid.vertices.p[0][0] = 90;
  input.settings.populationRate = 90;
  input.options.winds[0] = 90;
  input.nameBases[0].b = "Changed";
  input.notes[0].legend = "Changed";
  expect(snapshot.pack.cells.state[0]).toBe(1);
  expect(snapshot.pack.cells.c[0]).toEqual([1]);
  expect(snapshot.pack.cells.pop).toBeInstanceOf(Float32Array);
  expect(snapshot.pack.cells.pop[0]).toBe(new Float32Array([1.234567])[0]);
  expect(snapshot.grid.cells.temp[0]).toBe(-5);
  expect(snapshot.grid.vertices.p[0]).toEqual([0, 0]);
  expect(snapshot.settings.populationRate).toBe(1000);
  expect(snapshot.options.winds).toEqual([0]);
  expect(snapshot.nameBases[0].b).toBe("A,B");
  expect(snapshot.notes[0].legend).toBe("B");
  expect(snapshot).not.toHaveProperty("camera");
});

it("encodes named settings and default name bases in the unchanged legacy slots", () => {
  const snapshot = captureMapDocument(source());
  const metadata = {
    version: "1.143.6",
    license: "license",
    date: "2026-10-15",
    defaultNameBases: snapshot.nameBases,
    serializedSVG: '<svg id="map"></svg>',
    customGoodIcons: "",
    fonts: []
  };
  const data = createLegacyMapSaveSource(snapshot, metadata);
  expect(data.params).toBe("1.143.6|license|2026-10-15|42|100|60|7");
  expect(data.settings.split("|")).toEqual([
    "km",
    "3",
    "square",
    "m",
    "1.8",
    "°C",
    "",
    "",
    "",
    "",
    "",
    "",
    "1000",
    "2",
    "",
    "",
    "",
    "",
    "",
    JSON.stringify(snapshot.options),
    "Test world",
    "",
    "default",
    "",
    "10",
    "",
    "1.1"
  ]);
  expect(data.namesData).toBe("Test|3|8||0|");
  expect(createLegacyMapSaveSource(snapshot, { ...metadata, defaultNameBases: [] }).namesData).toBe("Test|3|8||0|A,B");
  const encoded = serializeMapSections(createMapSaveSections(data)).split("\r\n");
  expect(encoded).toHaveLength(50);
  expect(encoded[0]).toBe(data.params);
  expect(encoded[1]).toBe(data.settings);
  expect(encoded[31]).toBe(data.namesData);
});
