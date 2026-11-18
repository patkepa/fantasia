// Pure campaign simulation: explicit state in, new state out. No DOM, Pixi, storage, or globals.
// Game systems (economy, movement, combat, AI) will plug into `advanceDay` in a fixed, documented order.

import type { CampaignDate, CampaignSetup, CampaignState } from "@/types/campaign/campaign";

export const DAYS_PER_YEAR = 365;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function createCampaign(setup: CampaignSetup): CampaignState {
  return {
    schemaVersion: 1,
    playerCountryId: setup.playerCountryId,
    mapSeed: setup.mapSeed,
    date: { year: setup.startYear, day: 0 },
    tick: 0
  };
}

/** Advance the campaign by one day. Future systems run here, in order, against `next`. */
export function advanceDay(state: CampaignState): CampaignState {
  const rollsOver = state.date.day + 1 >= DAYS_PER_YEAR;
  const date: CampaignDate = rollsOver
    ? { year: state.date.year + 1, day: 0 }
    : { ...state.date, day: state.date.day + 1 };
  return { ...state, date, tick: state.tick + 1 };
}

export function formatCampaignDate({ year, day }: CampaignDate): string {
  let month = 0;
  let remaining = day;
  while (remaining >= MONTH_LENGTHS[month]) remaining -= MONTH_LENGTHS[month++];
  return `${remaining + 1} ${MONTH_NAMES[month]} ${year}`;
}
