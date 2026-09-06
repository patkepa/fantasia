/** Keeps global-state map generation runs from interleaving at browser yield points. */
export class GenerationRunGuard {
  private active: Promise<void> | null = null;

  get isRunning(): boolean {
    return this.active !== null;
  }

  run(task: () => Promise<void>): Promise<void> {
    if (this.active) return this.active;
    const run = Promise.resolve().then(task);
    this.active = run;
    void run.then(
      () => this.release(run),
      () => this.release(run)
    );
    return run;
  }

  private release(run: Promise<void>): void {
    if (this.active === run) this.active = null;
  }
}
