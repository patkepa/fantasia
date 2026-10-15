import type { ApplicationState } from "@/application/application-state";
import type { getUsedFonts } from "@/services/fonts";
import type { Grid } from "@/types/grid";
import type { MapDataSection } from "./map-data-serializer";

/** Explicit document and compatibility inputs; no browser or application-global reads. */
export interface MapSaveSource extends Pick<ApplicationState, "pack" | "notes"> {
  mapCoordinates: Partial<ApplicationState["mapCoordinates"]>;
  grid: Pick<Grid, "spacing" | "cellsX" | "cellsY" | "boundary" | "points" | "features" | "cellsDesired"> & {
    cells: Pick<Grid["cells"], "h" | "prec" | "f" | "t" | "temp">;
  };
  params: string;
  settings: string;
  serializedSVG: string;
  serializedStyle: ApplicationState["style"];
  customGoodIcons: string;
  namesData: string;
  fonts: ReturnType<typeof getUsedFonts>;
}

/**
 * Capture the persisted document synchronously before handing it to asynchronous IO.
 * Typed arrays retain their types and values; only the legacy encoder rounds population.
 * This is a .map snapshot, not a campaign definition: topology is reconstructed by the loader.
 */
export function captureMapSaveSections(source: MapSaveSource): MapDataSection[] {
  return structuredClone(createMapSaveSections(source));
}

/** Encode an already detached document without cloning its buffers a second time. */
export function createMapSaveSections(source: MapSaveSource): MapDataSection[] {
  const {
    pack,
    grid,
    mapCoordinates,
    notes,
    params,
    settings,
    serializedSVG,
    serializedStyle,
    customGoodIcons,
    namesData,
    fonts
  } = source;
  const { spacing, cellsX, cellsY, boundary, points, features, cellsDesired } = grid;
  const gridGeneral = { spacing, cellsX, cellsY, boundary, points, features, cellsDesired };
  const text = (value = ""): MapDataSection => ({ kind: "text", value });
  const json = (value: unknown): MapDataSection => ({ kind: "json", value });
  const csv = (value: ArrayLike<number>): MapDataSection => ({ kind: "csv", value });
  return [
    text(params),
    text(settings),
    json(mapCoordinates),
    json(pack.biomes),
    json(notes),
    text(serializedSVG),
    json(gridGeneral),
    csv(grid.cells.h),
    csv(grid.cells.prec),
    csv(grid.cells.f),
    csv(grid.cells.t),
    csv(grid.cells.temp),
    json(pack.features),
    json(pack.cultures),
    json(pack.states),
    json(pack.burgs),
    csv(pack.cells.biome),
    csv(pack.cells.burg),
    csv(pack.cells.conf),
    csv(pack.cells.culture),
    csv(pack.cells.fl),
    { kind: "rounded-csv", value: pack.cells.pop },
    csv(pack.cells.r),
    text(),
    csv(pack.cells.s),
    csv(pack.cells.state),
    csv(pack.cells.religion),
    csv(pack.cells.province),
    text(),
    json(pack.religions),
    json(pack.provinces),
    text(namesData),
    json(pack.rivers),
    text(),
    json(fonts),
    json(pack.markers),
    json(pack.cells.routes),
    json(pack.routes),
    json(pack.zones),
    json(pack.ice),
    csv(pack.cells.good),
    json(pack.goods),
    json(pack.markets || []),
    json(pack.deals || []),
    csv(pack.cells.market),
    text(customGoodIcons),
    json(pack.measurers ?? []),
    json(pack.addedLabels || []),
    json(serializedStyle),
    json(pack.relief || [])
  ];
}
