import {
  getWorkspaceMode,
  registerWorkspaceModeCommitHandler,
  registerWorkspaceModeTransitionHandler
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
  // View and Play share one read-only view session; only crossing the Edit boundary starts or ends it.
  const validate = registerWorkspaceModeTransitionHandler(
    (next, previous) => previous !== "edit" || next === "edit" || lifecycle.canEnterView()
  );
  const commit = registerWorkspaceModeCommitHandler((next, previous) => {
    if (previous === "edit") lifecycle.enterView();
    else if (next === "edit") lifecycle.leaveView();
  });
  return {
    dispose: () => {
      active = false;
      validate();
      commit();
    },
    mapLoaded: () => {
      if (active && getWorkspaceMode() !== "edit") lifecycle.refreshView();
    }
  };
}
