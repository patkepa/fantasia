import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/application/workspace-mode", () => ({ getWorkspaceMode: () => "edit" }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services", () => ({ Services: { Save: { prepareMapData: vi.fn(), saveToStorage: vi.fn() } } }));
vi.mock("@/utils", () => ({ ensureEl: () => ({ valueAsNumber: 1 }), ra: (items: string[]) => items[0] }));

import { Services } from "@/services";
import { initiateAutosave } from "./autosave";
import { documentDirtyState } from "./document-dirty-state";
import { MAP_MUTATED_EVENT } from "./map-mutation";

beforeEach(() => {
  vi.useFakeTimers();
  const events = new EventTarget();
  vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
  vi.stubGlobal("dispatchEvent", events.dispatchEvent.bind(events));
  vi.stubGlobal("localStorage", { getItem: () => "true" });
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("ERROR", false);
  documentDirtyState.clear();
  vi.mocked(Services.Save.prepareMapData).mockResolvedValue("snapshot");
  vi.mocked(Services.Save.saveToStorage).mockResolvedValue(undefined);
  initiateAutosave();
  window.dispatchEvent(new Event(MAP_MUTATED_EVENT));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("autosave lifecycle", () => {
  it("retains edits during a pending save and does not start overlapping autosaves", async () => {
    let finish!: () => void;
    vi.mocked(Services.Save.saveToStorage).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event(MAP_MUTATED_EVENT));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(Services.Save.saveToStorage).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(documentDirtyState.isDirty()).toBe(true);
    vi.mocked(Services.Save.saveToStorage).mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(Services.Save.saveToStorage).toHaveBeenCalledTimes(2);
    expect(documentDirtyState.isDirty()).toBe(false);
  });

  it("keeps the document dirty after a failed save and retries", async () => {
    vi.mocked(Services.Save.saveToStorage).mockRejectedValueOnce(new Error("Storage unavailable"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(documentDirtyState.isDirty()).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(documentDirtyState.isDirty()).toBe(false);
  });

  it("does not clear newer edits on a manual-save completion event", () => {
    window.dispatchEvent(new Event("map:saved"));
    expect(documentDirtyState.isDirty()).toBe(true);
  });
});
