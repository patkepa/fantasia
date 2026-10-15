export interface SimulationRandomState {
  algorithm: "mulberry32-v1";
  value: number;
}

/** Independent, serializable stream. Never changes or consumes Math.random. */
export function createSimulationRandom(initial: SimulationRandomState): {
  next: () => number;
  snapshot: () => SimulationRandomState;
} {
  if (
    initial.algorithm !== "mulberry32-v1" ||
    !Number.isInteger(initial.value) ||
    initial.value < 0 ||
    initial.value > 0xffffffff
  ) {
    throw new Error("Unsupported or invalid simulation random state");
  }
  let value = initial.value;
  return {
    next: () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    },
    snapshot: () => ({ algorithm: "mulberry32-v1", value })
  };
}
