// Serializable campaign contracts. See docs/prd/grand-strategy-implementation-plan.md.
// Campaign state is owned by the simulation (src/generators/campaign); the source map stays authoritative
// for geography and is never mutated by play.

/** Game speeds: 0 is paused; 1–3 map to increasing days per real second. */
export type CampaignSpeed = 0 | 1 | 2 | 3;

export interface CampaignDate {
  year: number;
  /** Day of the year, 0-based. */
  day: number;
}

/** What the player picked before pressing Play. */
export interface CampaignSetup {
  /** `pack.states` id of the country the player controls. */
  playerCountryId: number;
  /** Seed of the source map, for traceability. */
  mapSeed: string;
  startYear: number;
}

export interface CampaignState {
  schemaVersion: 1;
  playerCountryId: number;
  mapSeed: string;
  date: CampaignDate;
  /** Total simulated days, the deterministic tick counter. */
  tick: number;
}
