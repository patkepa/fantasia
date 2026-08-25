import type { RendererResourceKind, RendererResourceTracker } from "./resource-budget";

export interface RendererResourceHandle<T> {
  readonly value: T;
  release: () => void;
}

export interface RendererResourceCacheOptions<T> {
  budgetBytes: number;
  destroy: (value: T, key: string) => void;
  estimateBytes: (value: T, key: string) => number;
  kind: RendererResourceKind;
  tracker?: RendererResourceTracker;
}

interface CacheEntry<T> {
  bytes: number;
  lastUsed: number;
  references: number;
  resourceId: string;
  value: T;
}

interface EvictionCandidate {
  key: string;
  lastUsed: number;
}

export class RendererResourceCache<T> {
  private static sequence = 0;
  private readonly cacheId = `renderer-cache:${++RendererResourceCache.sequence}`;
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly pending = new Map<string, Promise<CacheEntry<T>>>();
  private readonly unused = new MinHeap<EvictionCandidate>((left, right) => left.lastUsed - right.lastUsed);
  private clock = 0;
  private generation = 0;
  private totalBytes = 0;

  constructor(private readonly options: RendererResourceCacheOptions<T>) {
    if (!Number.isFinite(options.budgetBytes) || options.budgetBytes < 0) {
      throw new Error(`Invalid renderer cache budget: ${options.budgetBytes}`);
    }
  }

  async acquire(key: string, load: () => Promise<T>): Promise<RendererResourceHandle<T>> {
    const entry = this.entries.get(key) ?? (await this.load(key, load));
    entry.references++;
    entry.lastUsed = ++this.clock;
    this.evictUnused();

    let released = false;
    return {
      value: entry.value,
      release: () => {
        if (released) return;
        released = true;
        entry.references = Math.max(0, entry.references - 1);
        entry.lastUsed = ++this.clock;
        if (entry.references === 0) this.unused.push({ key, lastUsed: entry.lastUsed });
        this.evictUnused();
      }
    };
  }

  clear(): void {
    this.generation++;
    this.pending.clear();
    this.unused.clear();
    for (const [key, entry] of this.entries) this.destroyEntry(key, entry);
    this.entries.clear();
    this.totalBytes = 0;
  }

  getSnapshot(): { bytes: number; entries: number; referenced: number } {
    return {
      bytes: this.totalBytes,
      entries: this.entries.size,
      referenced: [...this.entries.values()].filter(entry => entry.references > 0).length
    };
  }

  private load(key: string, load: () => Promise<T>): Promise<CacheEntry<T>> {
    const pending = this.pending.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const promise = load()
      .then(value => {
        if (generation !== this.generation) {
          this.options.destroy(value, key);
          throw new Error(`Renderer resource load superseded: ${key}`);
        }
        const bytes = this.options.estimateBytes(value, key);
        if (!Number.isFinite(bytes) || bytes < 0) {
          this.options.destroy(value, key);
          throw new Error(`Invalid cached renderer resource size: ${bytes}`);
        }
        const entry: CacheEntry<T> = {
          bytes,
          lastUsed: ++this.clock,
          references: 0,
          resourceId: `${this.cacheId}:${key}`,
          value
        };
        this.entries.set(key, entry);
        this.totalBytes += bytes;
        this.options.tracker?.acquire(entry.resourceId, this.options.kind, bytes);
        return entry;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  private evictUnused(): void {
    while (this.totalBytes > this.options.budgetBytes) {
      const candidate = this.unused.pop();
      if (!candidate) return;
      const entry = this.entries.get(candidate.key);
      if (!entry || entry.references !== 0 || entry.lastUsed !== candidate.lastUsed) continue;
      this.entries.delete(candidate.key);
      this.destroyEntry(candidate.key, entry);
    }
  }

  private destroyEntry(key: string, entry: CacheEntry<T>): void {
    this.totalBytes -= entry.bytes;
    this.options.tracker?.release(entry.resourceId);
    this.options.destroy(entry.value, key);
  }
}

class MinHeap<T> {
  private readonly values: T[] = [];

  constructor(private readonly compare: (left: T, right: T) => number) {}

  clear(): void {
    this.values.length = 0;
  }

  pop(): T | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length && last) {
      this.values[0] = last;
      this.siftDown();
    }
    return first;
  }

  push(value: T): void {
    this.values.push(value);
    this.siftUp();
  }

  private siftDown(): void {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (left < this.values.length && this.compare(this.values[left], this.values[next]) < 0) next = left;
      if (right < this.values.length && this.compare(this.values[right], this.values[next]) < 0) next = right;
      if (next === index) return;
      [this.values[index], this.values[next]] = [this.values[next], this.values[index]];
      index = next;
    }
  }

  private siftUp(): void {
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.values[index], this.values[parent]) >= 0) return;
      [this.values[index], this.values[parent]] = [this.values[parent], this.values[index]];
      index = parent;
    }
  }
}
