import {
  getWorkspaceMode,
  registerWorkspaceModeCommitHandler,
  registerWorkspaceModeTransitionHandler,
  type WorkspaceMode
} from "./workspace-mode";

export interface WorkspaceLifecycle {
  canEnterView: () => boolean;
  enterView: () => void;
  leaveView: () => void;
  refreshView: () => void;
}

/** Explicit mode transitions, separate from browser startup and validation. */
export function bindWorkspaceLifecycle(lifecycle: WorkspaceLifecycle): { dispose: () => void; mapLoaded: () => void } {
  let active = true;
  const validate = registerWorkspaceModeTransitionHandler(next => next !== "view" || lifecycle.canEnterView());
  const transitions: Record<WorkspaceMode, Partial<Record<WorkspaceMode, () => void>>> = {
    edit: { view: lifecycle.enterView },
    view: { edit: lifecycle.leaveView }
  };
  const commit = registerWorkspaceModeCommitHandler((next, previous) => transitions[previous][next]?.());
  return {
    dispose: () => {
      active = false;
      validate();
      commit();
    },
    mapLoaded: () => {
      if (active && getWorkspaceMode() === "view") lifecycle.refreshView();
    }
  };
}
