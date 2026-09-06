import { describe, expect, it } from "vitest";
import { buildGrid } from "./grid-builder";
import { GridGeneration, GridGenerationModule } from "./grid-generation";

describe("buildGrid", () => {
  const request = { seed: "worker-grid", graphWidth: 1000, graphHeight: 600, cellsDesired: 1000 };

  it("is deterministic and produces a complete Voronoi grid", () => {
    const first = buildGrid(request);
    const second = buildGrid(request);

    expect(first.points).toEqual(second.points);
    expect(first.cells.c).toEqual(second.cells.c);
    expect(first.vertices.p).toEqual(second.vertices.p);
    expect(first.cells.i).toEqual(second.cells.i);
    expect(first.cells.i.length).toBe(first.points.length);
    expect(first.cells.i[0]).toBe(0);
    expect(first.cells.i.at(-1)).toBe(first.points.length - 1);
  });

  it("uses a compact index array when the map has fewer than 65,536 cells", () => {
    expect(buildGrid(request).cells.i).toBeInstanceOf(Uint16Array);
  });

  it("falls back to the shared pure builder when workers are unavailable", async () => {
    const previousWorker = globalThis.Worker;
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
    await expect(GridGeneration.generate(request)).resolves.toMatchObject({ seed: request.seed });
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: previousWorker });
  });

  it("keeps an idle grid worker alive for the next generation request", async () => {
    const previousWorker = globalThis.Worker;
    const workers: TestGridWorker[] = [];
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: class extends TestGridWorker {
        constructor(...args: ConstructorParameters<typeof TestGridWorker>) {
          super(...args);
          workers.push(this);
        }
      }
    });
    const generation = new GridGenerationModule();

    await generation.generate(request);
    await generation.generate({ ...request, seed: "worker-grid-second" });

    expect(workers).toHaveLength(1);
    expect(workers[0].requests).toHaveLength(2);
    generation.cancel();
    expect(workers[0].terminated).toBe(true);
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: previousWorker });
  });

  it("replaces a busy worker so a superseded generation does not block the next request", async () => {
    const previousWorker = globalThis.Worker;
    const workers: TestGridWorker[] = [];
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: class extends TestGridWorker {
        constructor(...args: ConstructorParameters<typeof TestGridWorker>) {
          super(...args);
          workers.push(this);
        }
      }
    });
    const generation = new GridGenerationModule();

    const first = generation.generate(request);
    const second = generation.generate({ ...request, seed: "worker-grid-replacement" });

    await expect(first).rejects.toThrow("cancelled");
    await expect(second).resolves.toMatchObject({ seed: "worker-grid-replacement" });
    expect(workers).toHaveLength(2);
    expect(workers[0].terminated).toBe(true);
    generation.cancel();
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: previousWorker });
  });
});

class TestGridWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  requests: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.requests.push(message);
    const { id, request } = message as { id: number; request: Parameters<typeof buildGrid>[0] };
    queueMicrotask(() => this.onmessage?.({ data: { grid: buildGrid(request), id } } as MessageEvent));
  }

  terminate(): void {
    this.terminated = true;
  }
}
