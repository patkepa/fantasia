import { describe, expect, it } from "vitest";
import { GenerationRunGuard } from "./generation-run-guard";

describe("GenerationRunGuard", () => {
  it("returns the active run until it has settled", async () => {
    const guard = new GenerationRunGuard();
    let complete: (() => void) | undefined;
    const first = guard.run(
      () =>
        new Promise<void>(resolve => {
          complete = resolve;
        })
    );
    const second = guard.run(async () => {
      throw new Error("A concurrent generation must not start");
    });

    expect(second).toBe(first);
    expect(guard.isRunning).toBe(true);
    await Promise.resolve();
    complete?.();
    await first;
    await Promise.resolve();
    expect(guard.isRunning).toBe(false);
  });
});
