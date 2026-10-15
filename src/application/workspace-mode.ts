export type WorkspaceMode = "view" | "edit";

export type WorkspaceCapability = "map:inspect" | "map:edit" | "map:generate";

export interface WorkspaceModeOptions {
  onCapabilityDenied?: (message: string) => void;
  root?: HTMLElement | null;
}

type WorkspaceModeListener = (mode: WorkspaceMode) => void;
type WorkspaceModeTransitionHandler = (
  nextMode: WorkspaceMode,
  previousMode: WorkspaceMode
) => boolean | Promise<boolean>;
type WorkspaceModeCommitHandler = (nextMode: WorkspaceMode, previousMode: WorkspaceMode) => void;

const CAPABILITIES: Readonly<Record<WorkspaceMode, ReadonlySet<WorkspaceCapability>>> = {
  view: new Set(["map:inspect"]),
  edit: new Set(["map:inspect", "map:edit", "map:generate"])
};

const CAPABILITY_MESSAGES: Readonly<Record<Exclude<WorkspaceCapability, "map:inspect">, string>> = {
  "map:edit": "Switch to Edit mode to change this map",
  "map:generate": "Switch to Edit mode to generate or regenerate map content"
};
const WORKSPACE_MODE_STORAGE_KEY = "workspace-mode";

let mode: WorkspaceMode = "view";
let root: HTMLElement | null = null;
let onCapabilityDenied: (message: string) => void = () => undefined;
const listeners = new Set<WorkspaceModeListener>();
const transitionHandlers = new Set<WorkspaceModeTransitionHandler>();
const commitHandlers = new Set<WorkspaceModeCommitHandler>();
let transitionQueue: Promise<unknown> = Promise.resolve();

export function initializeWorkspaceMode(options: WorkspaceModeOptions = {}): () => void {
  mode = getStoredWorkspaceMode() ?? mode;
  root = options.root ?? getDefaultRoot();
  onCapabilityDenied = options.onCapabilityDenied ?? (() => undefined);
  applyModeAttribute();

  return () => {
    if (root) root.removeAttribute("data-workspace-mode");
    root = null;
    onCapabilityDenied = () => undefined;
  };
}

export function getWorkspaceMode(): WorkspaceMode {
  return mode;
}

export function setWorkspaceMode(nextMode: WorkspaceMode): Promise<boolean> {
  const transition = transitionQueue.then(() => transitionTo(nextMode));
  // A failed transition must not prevent subsequent requests from being processed.
  transitionQueue = transition.catch(() => undefined);
  return transition;
}

async function transitionTo(nextMode: WorkspaceMode): Promise<boolean> {
  if (nextMode === mode) return true;

  for (const handler of transitionHandlers) {
    if (!(await handler(nextMode, mode))) return false;
  }

  for (const handler of commitHandlers) handler(nextMode, mode);
  mode = nextMode;
  storeWorkspaceMode();
  applyModeAttribute();
  for (const listener of listeners) listener(mode);
  return true;
}

export function hasWorkspaceCapability(capability: WorkspaceCapability): boolean {
  return CAPABILITIES[mode].has(capability);
}

export function requireWorkspaceCapability(capability: WorkspaceCapability): boolean {
  if (hasWorkspaceCapability(capability)) return true;

  if (capability !== "map:inspect") onCapabilityDenied(CAPABILITY_MESSAGES[capability]);
  return false;
}

export function subscribeToWorkspaceMode(listener: WorkspaceModeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Validation only. Put lifecycle side effects in a commit handler. */
export function registerWorkspaceModeTransitionHandler(handler: WorkspaceModeTransitionHandler): () => void {
  transitionHandlers.add(handler);
  return () => transitionHandlers.delete(handler);
}

/** Runs synchronously after all guards accept, before publishing the new mode. */
export function registerWorkspaceModeCommitHandler(handler: WorkspaceModeCommitHandler): () => void {
  commitHandlers.add(handler);
  return () => commitHandlers.delete(handler);
}

function getDefaultRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.body ?? document.documentElement;
}

function getStoredWorkspaceMode(): WorkspaceMode | null {
  try {
    const stored = sessionStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    return stored === "view" || stored === "edit" ? stored : null;
  } catch {
    return null;
  }
}

function storeWorkspaceMode(): void {
  try {
    sessionStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, mode);
  } catch {
    // Session storage is optional; workspace mode remains in memory when it is unavailable.
  }
}

function applyModeAttribute(): void {
  root?.setAttribute("data-workspace-mode", mode);
}

export function resetWorkspaceModeForTests(): void {
  mode = "view";
  root = null;
  onCapabilityDenied = () => undefined;
  listeners.clear();
  transitionHandlers.clear();
  commitHandlers.clear();
  transitionQueue = Promise.resolve();
}
