import type { PackedGraph } from "@/types/PackedGraph";
import type { LabelRenderState } from "./layers/label-scene";
import type { MapRenderWorld } from "./render-world";

/** IDs in assignments, entities, labels and picking all belong to the same projection. */
export interface PoliticalRenderSource {
  stateByCell: PackedGraph["cells"]["state"];
  provinceByCell: PackedGraph["cells"]["province"];
  states: PackedGraph["states"];
  provinces: PackedGraph["provinces"];
  labelRenderState: LabelRenderState | undefined;
  /** Optional projected ID -> source-map ID mappings for inspector/export navigation. */
  sourceStateIds?: Readonly<Record<number, number>>;
  sourceProvinceIds?: Readonly<Record<number, number>>;
}

export function getMapPoliticalSource(pack: PackedGraph, labelRenderState?: LabelRenderState): PoliticalRenderSource {
  return {
    stateByCell: pack.cells.state,
    provinceByCell: pack.cells.province,
    states: pack.states,
    provinces: pack.provinces,
    labelRenderState
  };
}

/** One projected world is consumed by fills, borders, halos, labels and domain picking. */
export function projectPoliticalRenderWorld(world: MapRenderWorld, source: PoliticalRenderSource): MapRenderWorld {
  const count = world.cells.i.length;
  if (source.stateByCell.length !== count || source.provinceByCell.length !== count) {
    throw new Error("Political assignments must match the map cell count");
  }
  return {
    ...world,
    cells:
      source.stateByCell === world.cells.state && source.provinceByCell === world.cells.province
        ? world.cells
        : { ...world.cells, state: source.stateByCell, province: source.provinceByCell },
    states: source.states,
    provinces: source.provinces,
    labelRenderState: source.labelRenderState,
    politicalSourceIds: { states: source.sourceStateIds, provinces: source.sourceProvinceIds }
  };
}
