import { afterEach, expect, it, vi } from "vitest";
import { bindWorkspaceLifecycle } from "./workspace-lifecycle";
import {
  getWorkspaceMode,
  registerWorkspaceModeTransitionHandler,
  resetWorkspaceModeForTests,
  setWorkspaceMode
} from "./workspace-mode";

afterEach(resetWorkspaceModeForTests);

it("runs no lifecycle side effects when a later guard rejects a transition", async () => {
  await setWorkspaceMode("edit");
  const enterView = vi.fn();
  bindWorkspaceLifecycle({ canEnterView: () => true, refreshView: () => undefined, enterView, leaveView: vi.fn() });
  registerWorkspaceModeTransitionHandler(() => false);
  expect(await setWorkspaceMode("view")).toBe(false);
  expect(enterView).not.toHaveBeenCalled();
  expect(getWorkspaceMode()).toBe("edit");
});

it("serializes overlapping requests against the mode committed by the previous request", async () => {
  const calls: string[] = [];
  let release!: (value: boolean) => void;
  const gate = new Promise<boolean>(resolve => {
    release = resolve;
  });
  registerWorkspaceModeTransitionHandler((next, previous) => {
    calls.push(`${previous}:${next}`);
    return next === "edit" ? gate : true;
  });
  const lifecycle = bindWorkspaceLifecycle({
    canEnterView: () => true,
    refreshView: () => undefined,
    enterView: () => {
      calls.push("enter");
    },
    leaveView: () => {
      calls.push("leave");
    }
  });
  const edit = setWorkspaceMode("edit");
  const view = setWorkspaceMode("view");
  await Promise.resolve();
  expect(calls).toEqual(["view:edit"]);
  release(true);
  expect(await edit).toBe(true);
  expect(await view).toBe(true);
  expect(calls).toEqual(["view:edit", "leave", "edit:view", "enter"]);
  expect(getWorkspaceMode()).toBe("view");
  lifecycle.dispose();
});

it("recovers after a rejected asynchronous guard and refreshes View on map load only", async () => {
  const remove = registerWorkspaceModeTransitionHandler(() => Promise.reject(new Error("guard failed")));
  await expect(setWorkspaceMode("edit")).rejects.toThrow("guard failed");
  remove();
  const enterView = vi.fn();
  const refreshView = vi.fn();
  const binding = bindWorkspaceLifecycle({ canEnterView: () => true, enterView, refreshView, leaveView: vi.fn() });
  binding.mapLoaded();
  expect(refreshView).toHaveBeenCalledTimes(1);
  expect(enterView).not.toHaveBeenCalled();
  await setWorkspaceMode("edit");
  binding.mapLoaded();
  expect(refreshView).toHaveBeenCalledTimes(1);
  binding.dispose();
  await setWorkspaceMode("view");
  binding.mapLoaded();
  expect(refreshView).toHaveBeenCalledTimes(1);
  expect(enterView).not.toHaveBeenCalled();
});
