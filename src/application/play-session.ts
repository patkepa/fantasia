// Play session host: owns the running campaign and drives its clock. Simulation rules live in
// src/generators/campaign; this module only schedules ticks and publishes snapshots to the UI.

import { advanceDay, createCampaign } from "@/generators/campaign/campaign-simulation";
import type { CampaignSetup, CampaignSpeed, CampaignState } from "@/types/campaign/campaign";

export type PlayPhase = "choosing-country" | "running";

export interface PlaySessionSnapshot {
  phase: PlayPhase;
  campaign: CampaignState | null;
  speed: CampaignSpeed;
}

/** Real milliseconds per simulated day for each speed. */
const DAY_INTERVAL: Record<Exclude<CampaignSpeed, 0>, number> = { 1: 1000, 2: 200, 3: 50 };

let snapshot: PlaySessionSnapshot | null = null;
let timer: number | undefined;
let resumeSpeed: Exclude<CampaignSpeed, 0> = 1;
const listeners = new Set<() => void>();

export function getPlaySession(): PlaySessionSnapshot | null {
  return snapshot;
}

export function subscribeToPlaySession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Enter the pre-game lobby on the loaded map. */
export function openPlaySession(): void {
  stopClock();
  publish({ phase: "choosing-country", campaign: null, speed: 0 });
}

/** Start a campaign as the chosen country. The game starts paused. */
export function startCampaign(setup: CampaignSetup): void {
  if (!snapshot) return;
  stopClock();
  publish({ phase: "running", campaign: createCampaign(setup), speed: 0 });
}

export function setCampaignSpeed(speed: CampaignSpeed): void {
  if (!snapshot?.campaign) return;
  stopClock();
  if (speed) {
    resumeSpeed = speed;
    timer = window.setInterval(tick, DAY_INTERVAL[speed]);
  }
  publish({ ...snapshot, speed });
}

export function toggleCampaignPause(): void {
  if (snapshot?.campaign) setCampaignSpeed(snapshot.speed ? 0 : resumeSpeed);
}

export function closePlaySession(): void {
  stopClock();
  publish(null);
}

function tick(): void {
  if (snapshot?.campaign) publish({ ...snapshot, campaign: advanceDay(snapshot.campaign) });
}

function stopClock(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

function publish(next: PlaySessionSnapshot | null): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

// A hidden tab pauses the game instead of catching up on missed days.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && snapshot?.speed) setCampaignSpeed(0);
  });
}
