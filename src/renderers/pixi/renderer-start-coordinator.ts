export type RendererStartTask = (revision: number, isCurrent: () => boolean) => Promise<void>;

/** Serializes renderer starts without dropping a newer world requested while the current one is rendering. */
export class RendererStartCoordinator {
  private latestRevision = 0;
  private running: Promise<void> | null = null;

  constructor(private readonly start: RendererStartTask) {}

  get requestedRevision(): number {
    return this.latestRevision;
  }

  request(): Promise<void> {
    this.latestRevision++;
    this.running ??= this.drain();
    return this.running;
  }

  private async drain(): Promise<void> {
    try {
      while (true) {
        const revision = this.latestRevision;
        try {
          await this.start(revision, () => revision === this.latestRevision);
        } catch (error) {
          if (revision === this.latestRevision) throw error;
        }
        if (revision === this.latestRevision) return;
      }
    } finally {
      this.running = null;
    }
  }
}
