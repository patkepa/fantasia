export class HeightmapHistory {
  private snapshots: Uint8Array[] = [];
  private stateClaimSnapshots: Uint16Array[] = [];
  private position = 0;

  get current(): Uint8Array | undefined {
    return this.snapshots[this.position - 1];
  }

  get currentStateClaims(): Uint16Array | undefined {
    return this.stateClaimSnapshots[this.position - 1];
  }

  get previousPosition(): number {
    return this.position - 1;
  }

  get nextPosition(): number {
    return this.position + 1;
  }

  get canUndo(): boolean {
    return this.position > 1;
  }

  get canRedo(): boolean {
    return this.position < this.snapshots.length;
  }

  commit(heights: Uint8Array, stateClaims?: Uint16Array): void {
    this.snapshots = this.snapshots.slice(0, this.position);
    this.stateClaimSnapshots = this.stateClaimSnapshots.slice(0, this.position);
    this.snapshots.push(heights.slice());
    this.stateClaimSnapshots.push(stateClaims?.slice() ?? new Uint16Array(heights.length));
    this.position = this.snapshots.length;
  }

  restore(position: number): Uint8Array | undefined {
    if (position < 1 || position > this.snapshots.length) return undefined;
    this.position = position;
    return this.current?.slice();
  }

  reset(heights: Uint8Array, stateClaims?: Uint16Array): void {
    this.snapshots = [];
    this.stateClaimSnapshots = [];
    this.position = 0;
    this.commit(heights, stateClaims);
  }

  clear(): void {
    this.snapshots = [];
    this.stateClaimSnapshots = [];
    this.position = 0;
  }
}
