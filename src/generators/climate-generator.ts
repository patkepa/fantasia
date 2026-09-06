// Azgaar and contributors, 2017-2026. MIT License
// Climate calculations extracted from the Fantasia application runtime.
import { mean, range } from "d3";
import type { Grid } from "@/types/grid";
import { minmax, rn } from "@/utils/numberUtils";

interface ClimateCoordinates {
  latN: number;
  latS: number;
  latT: number;
}

export interface TemperatureSettings {
  coordinates: ClimateCoordinates;
  graphHeight: number;
  heightExponent: number;
  temperatureEquator: number;
  temperatureNorthPole: number;
  temperatureSouthPole: number;
  onRowTemperature?: (latitude: number, temperature: number) => void;
}

export interface PrecipitationSettings {
  cellsDesired: number;
  coordinates: ClimateCoordinates;
  prec: number;
  winds: readonly number[];
  randomInteger: (min: number, max: number) => number;
}

// Temperature model, based on http://www-das.uwyo.edu/~geerts/cwx/app.notes/chap16/Image64.gif
export function calculateTemperatures(grid: Grid, settings: TemperatureSettings): Int8Array {
  const cells = grid.cells;
  const temperatures = new Int8Array(cells.i.length);

  const { temperatureEquator, temperatureNorthPole, temperatureSouthPole } = settings;
  const tropics = [16, -20]; // tropics zone
  const tropicalGradient = 0.15;

  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = settings.heightExponent;

  for (let rowCellId = 0; rowCellId < cells.i.length; rowCellId += grid.cellsX) {
    const [, y] = grid.points[rowCellId];
    const rowLatitude = settings.coordinates.latN - (y / settings.graphHeight) * settings.coordinates.latT; // [90; -90]
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);
    settings.onRowTemperature?.(rowLatitude, tempSeaLevel);

    for (let cellId = rowCellId; cellId < rowCellId + grid.cellsX; cellId++) {
      const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h[cellId]);
      temperatures[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  function calculateSeaLevelTemp(latitude: number): number {
    const isTropical = latitude <= 16 && latitude >= -20;
    if (isTropical) return temperatureEquator - Math.abs(latitude) * tropicalGradient;

    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  // temperature drops by 6.5°C per 1km of altitude
  function getAltitudeTemperatureDrop(h: number): number {
    if (h < 20) return 0;
    const height = (h - 18) ** exponent;
    return rn((height / 1000) * 6.5);
  }

  return temperatures;
}

// Simplest precipitation model.
export function generatePrecipitation(grid: Grid, settings: PrecipitationSettings): Uint8Array {
  const { cells, cellsX, cellsY } = grid;
  const precipitation = new Uint8Array(cells.i.length);

  const cellsNumberModifier = (settings.cellsDesired / 10000) ** 0.25;
  const precInputModifier = settings.prec / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  type WindBand = [firstCell: number, precipitationModifier: number, tier: number];
  const westerly: WindBand[] = [];
  const easterly: WindBand[] = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  // x4 = 0-5 latitude: wet through the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-85 latitude: dry all year (sinking zone)
  // x0.5 = 85-90 latitude: dry all year (sinking zone)
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  range(0, cells.i.length, cellsX).forEach((c, i) => {
    const lat = settings.coordinates.latN - (i / cellsY) * settings.coordinates.latT;
    const latBand = ((Math.abs(lat) - 1) / 5) | 0;
    const latMod = latitudeModifier[latBand] ?? 1;
    const windTier = (Math.abs(lat - 89) / 30) | 0; // 30d tiers from 0 to 5 from N to S
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = ((Math.abs(settings.coordinates.latN) - 1) / 5) | 0;
    const latModN = (settings.coordinates.latT > 60 ? mean(latitudeModifier) : latitudeModifier[bandN]) ?? 1;
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    passWind(range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = ((Math.abs(settings.coordinates.latS) - 1) / 5) | 0;
    const latModS = (settings.coordinates.latT > 60 ? mean(latitudeModifier) : latitudeModifier[bandS]) ?? 1;
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    passWind(range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier: number) {
    const angle = settings.winds[tier] ?? 0;

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return { isWest, isEast, isNorth, isSouth };
  }

  function passWind(source: readonly (number | WindBand)[], maxPrec: number, next: number, steps: number): void {
    const maxPrecInit = maxPrec;

    for (const sourceEntry of source) {
      const first = typeof sourceEntry === "number" ? sourceEntry : sourceEntry[0];
      if (typeof sourceEntry !== "number") maxPrec = Math.min(maxPrecInit * sourceEntry[1], 255);

      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (cells.temp[current] < -5) continue; // no flux in permafrost

        if (cells.h[current] < 20) {
          // water cell
          if (cells.h[current + next] >= 20) {
            precipitation[current + next] += Math.max(humidity / settings.randomInteger(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            precipitation[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const isPassable = cells.h[current + next] <= MAX_PASSABLE_ELEVATION;
        const amount = isPassable ? getPrecipitation(humidity, current, next) : humidity;
        precipitation[current] += amount;
        const evaporation = amount > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable ? minmax(humidity - amount + evaporation, 0, maxPrec) : 0;
      }
    }
  }

  function getPrecipitation(humidity: number, i: number, n: number): number {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i + n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  return precipitation;
}
