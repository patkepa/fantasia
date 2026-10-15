import { expect, it } from "vitest";
import { getProvincePopulation, getProvinceStatistics, type ProvinceStatisticsSource } from "./province-statistics";

it("aggregates valid provinces without mutating data or relying on editor caches", () => {
  const source: ProvinceStatisticsSource = {
    cells: {
      i: [0, 1, 2, 3, 4, 5],
      province: new Uint16Array([1, 1, 2, 0, 99, 3]),
      area: new Uint16Array([10, 20, 30, 40, 50, 60]),
      pop: new Float32Array([1, 2, 3, 4, 5, 6]),
      burg: new Uint16Array([1, 2, 99, 0, 0, 0])
    },
    provinces: [{ i: 0 }, { i: 1 }, { i: 2 }, { i: 3, removed: true }, { i: 4 }],
    burgs: [{}, { population: 5 }, { population: 10, removed: true }]
  };
  const before = structuredClone(source);
  const result = getProvinceStatistics(source);
  expect(result.get(1)).toEqual({ area: 30, rural: 3, urban: 5, burgs: [1] });
  expect(result.get(2)).toEqual({ area: 30, rural: 3, urban: 0, burgs: [] });
  expect(result.get(4)).toEqual({ area: 0, rural: 0, urban: 0, burgs: [] });
  expect([...result.keys()]).toEqual([1, 2, 4]);
  expect(source).toEqual(before);
});

it("normalizes population from explicit settings without rounding", () => {
  expect(getProvincePopulation({ rural: 1.25, urban: 2.5 }, { populationRate: 10, urbanization: 2 })).toEqual({
    rural: 12.5,
    urban: 50,
    total: 62.5
  });
  expect(getProvincePopulation({}, { populationRate: 1000, urbanization: 1 })).toEqual({
    rural: 0,
    urban: 0,
    total: 0
  });
});
