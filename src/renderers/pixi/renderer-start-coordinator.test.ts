import { describe, expect, it, vi } from "vitest";
import { RendererStartCoordinator } from "./renderer-start-coordinator";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

describe("RendererStartCoordinator", () => {
  it("renders the latest revision after an in-flight request instead of dropping it", async () => {
    const first = deferred();
    const revisions: number[] = [];
    const currentChecks: boolean[] = [];
    const coordinator = new RendererStartCoordinator(async (revision, isCurrent) => {
      revisions.push(revision);
      if (revision === 1) await first.promise;
      currentChecks.push(isCurrent());
    });

    const task = coordinator.request();
    expect(coordinator.request()).toBe(task);
    first.resolve();
    await task;

    expect(revisions).toEqual([1, 2]);
    expect(currentChecks).toEqual([false, true]);
  });

  it("ignores a stale failure and continues with the latest revision", async () => {
    const first = deferred();
    const start = vi.fn(async (revision: number) => {
      if (revision === 1) await first.promise;
    });
    const coordinator = new RendererStartCoordinator(start);

    const task = coordinator.request();
    coordinator.request();
    first.reject(new Error("stale render failed"));

    await expect(task).resolves.toBeUndefined();
    expect(start.mock.calls.map(([revision]) => revision)).toEqual([1, 2]);
  });

  it("reports a failure from the latest revision and accepts a later retry", async () => {
    const start = vi.fn(async (revision: number) => {
      if (revision === 1) throw new Error("renderer unavailable");
    });
    const coordinator = new RendererStartCoordinator(start);

    await expect(coordinator.request()).rejects.toThrow("renderer unavailable");
    await expect(coordinator.request()).resolves.toBeUndefined();
    expect(start).toHaveBeenCalledTimes(2);
  });
});
