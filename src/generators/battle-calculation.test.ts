import { expect, it, vi } from "vitest";
import {
  calculateBattleCasualtyRates,
  calculateBattleMorale,
  calculateBattleStrength,
  calculateUnitLosses
} from "./battle-calculation";
import { createSimulationRandom } from "./simulation-random";

it("computes phase strength from explicit units and population settings", () => {
  const units = [
    { name: "Archers", power: 2, type: "ranged" },
    { name: "Cavalry", power: 3, type: "mounted" }
  ];
  const forces = { Archers: 100, Cavalry: 50 };
  expect(calculateBattleStrength(forces, units, "skirmish", 1000)).toBe(4.95);
  expect(calculateBattleStrength(forces, units, "melee", 1000)).toBe(4.65);
  expect(calculateBattleStrength({}, units, "melee", 1000)).toBe(0);
});

it("preserves phase casualty fractions, morale and capped unit losses", () => {
  const rates = calculateBattleCasualtyRates(
    { power: 100, die: 6, phase: "melee" },
    { power: 100, die: 6, phase: "skirmish" },
    () => 0.5
  );
  expect(rates).toEqual({ attackers: 0.05, defenders: 0.05 });
  expect(calculateBattleMorale(80, rates.attackers)).toBe(74);
  expect(calculateBattleMorale(2, rates.attackers)).toBe(0);
  const random = vi.fn(() => 0.5);
  expect(calculateUnitLosses(100, 3, 0.1, random)).toBe(3);
  expect(random).toHaveBeenCalledTimes(1); // integer losses do not consume rounding randomness
});

it("matches legacy probabilistic rounding across fractional losses", () => {
  const draws = [0.5, 0.1, 0.5, 0.9];
  expect(calculateUnitLosses(25, 25, 0.1, () => draws.shift()!)).toBe(3);
  expect(calculateUnitLosses(25, 25, 0.1, () => draws.shift()!)).toBe(2);
});

it("resumes a deterministic calculation sequence from serialized state and RNG", () => {
  const random = createSimulationRandom({ algorithm: "mulberry32-v1", value: 12345 });
  let remaining = 1000;
  const step = (survivors: number, next: () => number) => survivors - calculateUnitLosses(1000, survivors, 0.01, next);
  for (let i = 0; i < 5; i++) remaining = step(remaining, random.next);
  const saved = JSON.stringify({ remaining, random: random.snapshot() });
  for (let i = 0; i < 10; i++) remaining = step(remaining, random.next);
  const restored = JSON.parse(saved);
  const resumedRandom = createSimulationRandom(restored.random);
  for (let i = 0; i < 10; i++) restored.remaining = step(restored.remaining, resumedRandom.next);
  expect(restored.remaining).toBe(remaining);
  expect(resumedRandom.snapshot()).toEqual(random.snapshot());
});
