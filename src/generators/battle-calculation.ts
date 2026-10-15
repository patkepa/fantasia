export type BattleRandom = () => number;

export interface BattleForce {
  power: number;
  die: number;
  phase: string;
}

const phaseCasualtyRate: Record<string, number> = {
  skirmish: 0.1,
  melee: 0.2,
  pursue: 0.3,
  retreat: 0.3,
  boarding: 0.2,
  shelling: 0.1,
  chase: 0.03,
  withdrawal: 0.03,
  blockade: 0,
  sheltering: 0,
  sortie: 0.1,
  bombardment: 0.05,
  storming: 0.2,
  defense: 0.2,
  looting: 0.5,
  surrendering: 0.5,
  surprise: 0.3,
  shock: 0.3,
  landing: 0.3,
  flee: 0,
  waiting: 0,
  maneuvering: 0.1,
  dogfight: 0.2
};

/** The manual editor's phase casualty model with an explicit random stream. */
export function calculateBattleCasualtyRates(
  attackers: BattleForce,
  defenders: BattleForce,
  random: BattleRandom
): { attackers: number; defenders: number } {
  const attack = attackers.power * (attackers.die / 10 + 0.4);
  const defense = defenders.power * (defenders.die / 10 + 0.4);
  const casualties = random() * Math.max(phaseCasualtyRate[attackers.phase], phaseCasualtyRate[defenders.phase]);
  return {
    attackers: (casualties * defense) / (attack + defense),
    defenders: (casualties * attack) / (attack + defense)
  };
}

export function calculateUnitLosses(initial: number, survivors: number, rate: number, random: BattleRandom): number {
  const expected = initial * rate * (0.8 + random() * 0.4);
  // Match legacy probabilistic rounding, including not consuming a draw for an integer.
  const fraction = expected % 1;
  const rounded = ~~expected + Number(fraction > 0 && random() < fraction);
  return Math.min(rounded, survivors);
}

export function calculateBattleMorale(morale: number, casualtyRate: number): number {
  return Math.max(morale - casualtyRate * 100 - 1, 0);
}

const strengthByPhase: Record<string, Record<string, number>> = {
  // field battle phases
  skirmish: {
    melee: 0.2,
    ranged: 2.4,
    mounted: 0.1,
    machinery: 3,
    naval: 1,
    armored: 0.2,
    aviation: 1.8,
    magical: 1.8
  }, // ranged excel
  melee: { melee: 2, ranged: 1.2, mounted: 1.5, machinery: 0.5, naval: 0.2, armored: 2, aviation: 0.8, magical: 0.8 }, // melee excel
  pursue: { melee: 1, ranged: 1, mounted: 4, machinery: 0.05, naval: 1, armored: 1, aviation: 1.5, magical: 0.6 }, // mounted excel
  retreat: {
    melee: 0.1,
    ranged: 0.01,
    mounted: 0.5,
    machinery: 0.01,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.8,
    magical: 0.05
  }, // reduced

  // naval battle phases
  shelling: { melee: 0, ranged: 0.2, mounted: 0, machinery: 2, naval: 2, armored: 0, aviation: 0.1, magical: 0.5 }, // naval and machinery excel
  boarding: {
    melee: 1,
    ranged: 0.5,
    mounted: 0.5,
    machinery: 0,
    naval: 0.5,
    armored: 0.4,
    aviation: 0,
    magical: 0.2
  }, // melee excel
  chase: { melee: 0, ranged: 0.15, mounted: 0, machinery: 1, naval: 1, armored: 0, aviation: 0.15, magical: 0.5 }, // reduced
  withdrawal: {
    melee: 0,
    ranged: 0.02,
    mounted: 0,
    machinery: 0.5,
    naval: 0.1,
    armored: 0,
    aviation: 0.1,
    magical: 0.3
  }, // reduced

  // siege phases
  blockade: {
    melee: 0.25,
    ranged: 0.25,
    mounted: 0.2,
    machinery: 0.5,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.25,
    magical: 0.25
  }, // no active actions
  sheltering: {
    melee: 0.3,
    ranged: 0.5,
    mounted: 0.2,
    machinery: 0.5,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.25,
    magical: 0.25
  }, // no active actions
  sortie: { melee: 2, ranged: 0.5, mounted: 1.2, machinery: 0.2, naval: 0.1, armored: 0.5, aviation: 1, magical: 1 }, // melee excel
  bombardment: {
    melee: 0.2,
    ranged: 0.5,
    mounted: 0.2,
    machinery: 3,
    naval: 1,
    armored: 0.5,
    aviation: 1,
    magical: 1
  }, // machinery excel
  storming: {
    melee: 1,
    ranged: 0.6,
    mounted: 0.5,
    machinery: 1,
    naval: 0.1,
    armored: 0.1,
    aviation: 0.5,
    magical: 0.5
  }, // melee excel
  defense: { melee: 2, ranged: 3, mounted: 1, machinery: 1, naval: 0.1, armored: 1, aviation: 0.5, magical: 1 }, // ranged excel
  looting: {
    melee: 1.6,
    ranged: 1.6,
    mounted: 0.5,
    machinery: 0.2,
    naval: 0.02,
    armored: 0.2,
    aviation: 0.1,
    magical: 0.3
  }, // melee excel
  surrendering: {
    melee: 0.1,
    ranged: 0.1,
    mounted: 0.05,
    machinery: 0.01,
    naval: 0.01,
    armored: 0.02,
    aviation: 0.01,
    magical: 0.03
  }, // reduced

  // ambush phases
  surprise: { melee: 2, ranged: 2.4, mounted: 1, machinery: 1, naval: 1, armored: 1, aviation: 0.8, magical: 1.2 }, // increased
  shock: {
    melee: 0.5,
    ranged: 0.5,
    mounted: 0.5,
    machinery: 0.4,
    naval: 0.3,
    armored: 0.1,
    aviation: 0.4,
    magical: 0.5
  }, // reduced

  // landing phases
  landing: {
    melee: 0.8,
    ranged: 0.6,
    mounted: 0.6,
    machinery: 0.5,
    naval: 0.5,
    armored: 0.5,
    aviation: 0.5,
    magical: 0.6
  }, // reduced
  flee: {
    melee: 0.1,
    ranged: 0.01,
    mounted: 0.5,
    machinery: 0.01,
    naval: 0.5,
    armored: 0.1,
    aviation: 0.2,
    magical: 0.05
  }, // reduced
  waiting: {
    melee: 0.05,
    ranged: 0.5,
    mounted: 0.05,
    machinery: 0.5,
    naval: 2,
    armored: 0.05,
    aviation: 0.5,
    magical: 0.5
  }, // reduced

  // air battle phases
  maneuvering: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.2, naval: 0, armored: 0, aviation: 1, magical: 0.2 }, // aviation
  dogfight: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.1, naval: 0, armored: 0, aviation: 2, magical: 0.1 } // aviation
};

export function calculateBattleStrength(
  forces: Readonly<Record<string, number>>,
  units: readonly { name: string; power: number; type: string }[],
  phase: string,
  populationRate: number
): number {
  let total = 0;
  for (const unit of units) {
    const value = (forces[unit.name] || 0) * unit.power * strengthByPhase[phase][unit.type];
    if (value) total += value; // Preserve d3.sum's handling of missing unit weights.
  }
  return total / Math.max(populationRate / 10, 10);
}
