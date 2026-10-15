import type { ApplicationOptions, MapCoordinates, Note } from "@/application/application-state";
import type { NameBase } from "@/data/name-bases";
import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";
import type { Style } from "@/types/style";

export interface MapDocumentSettings {
  distanceUnit: string;
  distanceScale: number;
  areaUnit: string;
  heightUnit: string;
  heightExponent: string;
  temperatureScale: string;
  populationRate: number;
  urbanization: number;
  urbanDensity: number;
  growthRate: string;
  mapName: string;
  stylePreset: string;
}

/** Detached data, with full topology and exact typed-array values. No session or renderer resources. */
export interface MapDocumentSnapshot {
  seed: string;
  mapId: number;
  graphWidth: number;
  graphHeight: number;
  grid: Grid;
  pack: PackedGraph;
  mapCoordinates: Partial<MapCoordinates>;
  notes: Note[];
  options: ApplicationOptions;
  style: Style;
  settings: MapDocumentSettings;
  nameBases: NameBase[];
}

/** Capture synchronously at an application boundary; callers own the resulting detached data. */
export function captureMapDocument(source: MapDocumentSnapshot): MapDocumentSnapshot {
  const {
    seed,
    mapId,
    graphWidth,
    graphHeight,
    grid,
    pack,
    mapCoordinates,
    notes,
    options,
    style,
    settings,
    nameBases
  } = source;
  return structuredClone({
    seed,
    mapId,
    graphWidth,
    graphHeight,
    grid,
    pack,
    mapCoordinates,
    notes,
    options,
    style,
    settings,
    nameBases
  });
}
