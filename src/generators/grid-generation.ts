import { buildGrid, type GeneratedGrid, type GridBuildRequest } from "./grid-builder";

interface GridWorkerResponse {
  id: number;
  grid?: GeneratedGrid;
  error?: string;
}

interface PendingGridRequest {
  id: number;
  reject: (reason?: unknown) => void;
  resolve: (grid: GeneratedGrid) => void;
}

export class GridGenerationModule {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending: PendingGridRequest | null = null;

  generate(request: GridBuildRequest): Promise<GeneratedGrid> {
    if (typeof Worker === "undefined") return Promise.resolve(buildGrid(request));
    // A running worker cannot cancel a synchronous Voronoi build. Replace it only when busy;
    // otherwise keep the warm worker alive for the next generation.
    if (this.pending) {
      this.cancelPending();
      this.worker?.terminate();
      this.worker = null;
    }
    const worker = this.getWorker();
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pending = { id, reject, resolve };
      worker.postMessage({ id, request });
    });
  }

  cancel(): void {
    this.requestId++;
    this.cancelPending();
    this.worker?.terminate();
    this.worker = null;
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./grid-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<GridWorkerResponse>) => this.resolveWorkerMessage(data);
    worker.onerror = event => this.rejectWorkerRequest(event.error || new Error(event.message));
    this.worker = worker;
    return worker;
  }

  private resolveWorkerMessage({ error, grid, id }: GridWorkerResponse): void {
    const pending = this.pending;
    if (!pending || pending.id !== id) return;
    this.pending = null;
    if (error) pending.reject(new Error(error));
    else if (grid) pending.resolve(grid);
    else pending.reject(new Error("Grid worker returned no grid"));
  }

  private rejectWorkerRequest(error: unknown): void {
    const pending = this.pending;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    pending?.reject(error);
  }

  private cancelPending(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(new Error("Grid generation cancelled"));
  }
}

export const GridGeneration = new GridGenerationModule();
window.GridGeneration = GridGeneration;
