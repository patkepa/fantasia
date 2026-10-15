import { getWorkspaceMode, type WorkspaceMode } from "@/application/workspace-mode";

export interface DocumentDirtyState {
  clear: () => void;
  isDirty: () => boolean;
  mark: () => void;
  getRevision: () => number;
  markSaved: (revision: number) => void;
}

export function createDocumentDirtyState(getWorkspaceMode: () => WorkspaceMode): DocumentDirtyState {
  let dirty = false;
  let revision = 0;
  return {
    clear: () => {
      revision++;
      dirty = false;
    },
    isDirty: () => dirty,
    mark: () => {
      if (getWorkspaceMode() !== "edit") return;
      revision++;
      dirty = true;
    },
    getRevision: () => revision,
    markSaved: savedRevision => {
      if (savedRevision === revision) dirty = false;
    }
  };
}

export const documentDirtyState = createDocumentDirtyState(getWorkspaceMode);
