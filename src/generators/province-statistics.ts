import type { PackedGraph } from "@/types/PackedGraph";

export interface ProvinceStatistics {
  area: number;
  rural: number;
  urban: number;
  burgs: number[];
}

export interface PopulationSettings {
  populationRate: number;
  urbanization: number;
}

export interface ProvinceStatisticsSource {
  cells: Pick<PackedGraph["cells"], "i" | "province" | "area" | "pop" | "burg">;
  provinces: readonly Pick<PackedGraph["provinces"][number], "i" | "removed">[];
  burgs: readonly Pick<PackedGraph["burgs"][number], "population" | "removed">[];
}

/** Raw map units; no cached editor statistics or application settings are read. */
export function getProvinceStatistics({
  cells,
  provinces,
  burgs
}: ProvinceStatisticsSource): Map<number, ProvinceStatistics> {
  const statistics = new Map<number, ProvinceStatistics>();
  for (const province of provinces) {
    if (province?.i && !province.removed) statistics.set(province.i, { area: 0, rural: 0, urban: 0, burgs: [] });
  }
  for (const cellId of cells.i) {
    const summary = statistics.get(cells.province[cellId]);
    if (!summary) continue;
    summary.area += cells.area[cellId];
    summary.rural += cells.pop[cellId];
    const burgId = cells.burg[cellId];
    const burg = burgs[burgId];
    if (!burgId || !burg || burg.removed) continue;
    summary.urban += burg.population ?? 0;
    summary.burgs.push(burgId);
  }
  return statistics;
}

/** Convert once at a caller's boundary; rounding is a presentation/rules decision. */
export function getProvincePopulation(
  population: { rural?: number; urban?: number },
  { populationRate, urbanization }: PopulationSettings
): { rural: number; urban: number; total: number } {
  const rural = (population.rural ?? 0) * populationRate;
  const urban = (population.urban ?? 0) * populationRate * urbanization;
  return { rural, urban, total: rural + urban };
}
