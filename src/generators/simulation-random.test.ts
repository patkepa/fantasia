import { expect, it, vi } from "vitest";
import { createSimulationRandom } from "./simulation-random";

it("has a stable sequence and independent streams without global randomness", () => {
  const globalRandom = vi.spyOn(Math, "random").mockImplementation(() => {
    throw new Error("ambient RNG");
  });
  try {
    const random = createSimulationRandom({ algorithm: "mulberry32-v1", value: 1 });
    const separate = createSimulationRandom({ algorithm: "mulberry32-v1", value: 1 });
    expect(random.next()).toBe(0.6270739405881613);
    expect(random.next()).toBe(0.002735721180215478);
    expect(separate.next()).toBe(0.6270739405881613);
    const saved = random.snapshot();
    const resumed = createSimulationRandom(JSON.parse(JSON.stringify(saved)));
    expect(resumed.next()).toBe(random.next());
    saved.value = 0;
    expect(resumed.next()).toBe(random.next());
  } finally {
    globalRandom.mockRestore();
  }
});

it("rejects invalid random states instead of silently changing continuation", () => {
  for (const value of [-1, NaN, Infinity, 0.5, 4294967296]) {
    expect(() => createSimulationRandom({ algorithm: "mulberry32-v1", value })).toThrow("invalid");
  }
});
