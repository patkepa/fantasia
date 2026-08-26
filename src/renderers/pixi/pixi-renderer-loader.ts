import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import { bindRendererCommands, rendererCommands } from "@/renderers/core/renderer-commands";
import {
  getPixiRendererSnapshot,
  pixiRendererController,
  preloadPixiRenderer,
  reportPixiRendererFailure,
  syncPixiRendererViewport,
  syncPixiRendererVisibility
} from "./pixi-renderer-controller";
import { activatePixiRendererOwnership } from "./pixi-renderer-ownership";
import { RendererStartCoordinator } from "./renderer-start-coordinator";

export const PIXI_RENDERER_FAILURE_EVENT = "map:pixi-renderer:failure";

activatePixiRendererOwnership();
bindRendererCommands(pixiRendererController);
window.MapRendererCommands = rendererCommands;

// Fetch and parse Pixi while generation and the rest of application startup continue.
void preloadPixiRenderer().catch(() => undefined);

const startCoordinator = new RendererStartCoordinator(async (revision, isCurrent) => {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (isCurrent()) await pixiRendererController.start(revision, isCurrent);
});
let observedStartTask: Promise<void> | null = null;

const scheduleStart = (): void => {
  const task = startCoordinator.request();
  if (task === observedStartTask) return;
  observedStartTask = task;
  void task.catch(showRendererFailure).finally(() => {
    if (observedStartTask === task) observedStartTask = null;
  });
};

// Vite evaluates module scripts independently. If a generated map is already present by the time this loader finishes
// evaluating, its one-off `map:generated` event has been missed and the Pixi surface would otherwise never mount.
const startIfMapIsReady = (): void => {
  if (typeof pack === "undefined" || !pack?.cells?.i?.length) return;
  const snapshot = getPixiRendererSnapshot();
  if (snapshot?.lifecycleState === "committed" && snapshot.cells === pack.cells.i.length) return;
  scheduleStart();
};

export function showRendererFailure(error: unknown): void {
  reportPixiRendererFailure(error);
  const message = error instanceof Error ? error.message : "Unable to initialize graphics acceleration";
  const snapshot = getPixiRendererSnapshot();
  const existing = document.getElementById("pixi-renderer-failure");
  const alert = existing ?? document.createElement("div");
  alert.id = "pixi-renderer-failure";
  alert.setAttribute("role", "alert");
  alert.className = "pixi-renderer-failure";
  alert.dataset.rendererDiagnostics = JSON.stringify({ error: message, snapshot });
  alert.textContent = `The map renderer could not present a valid frame. Reload the page or check graphics acceleration. ${message}`;
  if (!existing) document.getElementById("map")?.before(alert);
  window.dispatchEvent(new CustomEvent(PIXI_RENDERER_FAILURE_EVENT, { detail: { error: message, snapshot } }));
}

window.addEventListener("map:generated", scheduleStart);
window.addEventListener("map:loaded", scheduleStart);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startIfMapIsReady, { once: true });
else startIfMapIsReady();
window.addEventListener("load", startIfMapIsReady, { once: true });
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});
window.addEventListener("map:viewport-resized", syncPixiRendererViewport);
