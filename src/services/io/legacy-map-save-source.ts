import type { NameBase } from "@/data/name-bases";
import type { MapDocumentSnapshot } from "./map-document";
import type { MapSaveSource } from "./map-save-snapshot";

export interface LegacyMapSaveMetadata {
  version: string;
  date: string;
  license: string;
  defaultNameBases: readonly NameBase[];
  serializedSVG: string;
  customGoodIcons: string;
  fonts: MapSaveSource["fonts"];
}

/** Legacy layout stays here; the document itself has named, typed settings. */
export function createLegacyMapSaveSource(
  document: MapDocumentSnapshot,
  metadata: LegacyMapSaveMetadata
): MapSaveSource {
  const { grid, pack, mapCoordinates, notes, options, settings, nameBases, style } = document;
  return {
    grid,
    pack,
    mapCoordinates,
    notes,
    serializedStyle: style,
    serializedSVG: metadata.serializedSVG,
    customGoodIcons: metadata.customGoodIcons,
    fonts: metadata.fonts,
    params: [
      metadata.version,
      metadata.license,
      metadata.date,
      document.seed,
      document.graphWidth,
      document.graphHeight,
      document.mapId
    ].join("|"),
    settings: [
      settings.distanceUnit,
      settings.distanceScale,
      settings.areaUnit,
      settings.heightUnit,
      settings.heightExponent,
      settings.temperatureScale,
      "",
      "",
      "",
      "",
      "",
      "", // historical scale bar settings
      settings.populationRate,
      settings.urbanization,
      "",
      "",
      "",
      "",
      "", // settings now owned by options
      JSON.stringify(options),
      settings.mapName,
      "",
      settings.stylePreset,
      "",
      settings.urbanDensity,
      "",
      settings.growthRate
    ].join("|"),
    namesData: nameBases
      .map((base, index) => {
        const names = metadata.defaultNameBases[index]?.b === base.b ? "" : base.b;
        return `${base.name}|${base.min}|${base.max}|${base.d}|${base.m}|${names}`;
      })
      .join("/")
  };
}
