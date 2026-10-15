import { describe, expect, test } from "vitest";
import { createDocumentDirtyState } from "./document-dirty-state";

describe("document dirty state", () => {
  test("marks committed edits but ignores View-mode exploration", () => {
    let mode: "edit" | "view" = "view";
    const dirtyState = createDocumentDirtyState(() => mode);

    dirtyState.mark();
    expect(dirtyState.isDirty()).toBe(false);

    mode = "edit";
    dirtyState.mark();
    expect(dirtyState.isDirty()).toBe(true);

    dirtyState.clear();
    expect(dirtyState.isDirty()).toBe(false);
  });
});

describe("save revisions", () => {
  test("a completed save preserves edits made while it was pending", async () => {
    const state = createDocumentDirtyState(() => "edit");
    state.mark();
    const revision = state.getRevision();
    const save = Promise.resolve().then(() => state.markSaved(revision));
    state.mark();
    await save;
    expect(state.isDirty()).toBe(true);
    state.markSaved(state.getRevision());
    expect(state.isDirty()).toBe(false);
  });

  test("a save from a previous document cannot clear edits to a loaded document", () => {
    const state = createDocumentDirtyState(() => "edit");
    state.mark();
    const revision = state.getRevision();
    state.clear();
    state.mark();
    state.markSaved(revision);
    expect(state.isDirty()).toBe(true);
  });

  test("out-of-order saves cannot clear a newer edit", () => {
    const state = createDocumentDirtyState(() => "edit");
    state.mark();
    const first = state.getRevision();
    state.mark();
    const second = state.getRevision();
    state.markSaved(second);
    expect(state.isDirty()).toBe(false);
    state.mark();
    state.markSaved(first);
    expect(state.isDirty()).toBe(true);
  });
});
