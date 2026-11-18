// App shell session: which top-level screen is showing (main menu or workspace) and what kind of
// session the workspace is running. Each session kind maps onto one workspace capability mode:
//   Editor   -> "edit"  (library-backed, autosaved into the browser map library)
//   Showcase -> "view"  (curated seeded worlds, read-only)
//   Play     -> "play"  (read-only map + campaign simulation)

import { clearSelectedCountry } from "@/components/country-selection";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { LayerControls } from "@/components/layers/layer-controls";
import { tip } from "@/components/tooltips";
import { getShowcaseMap } from "@/data/showcase-maps";
import { Services } from "@/services";
import { documentDirtyState } from "@/services/document-dirty-state";
import { MapLibrary } from "@/services/io/map-library";
import { captureMapThumbnail, getShowcaseThumbnail, storeShowcaseThumbnail } from "@/services/io/map-thumbnail";
import { ensureEl } from "@/utils";
import { ApplicationController } from "./application-controller";
import { getApplicationState } from "./application-state";
import { closePlaySession, openPlaySession } from "./play-session";
import { setWorkspaceMode, type WorkspaceMode } from "./workspace-mode";

export type SessionKind = "editor" | "play" | "showcase";

export type MapSource =
  | { kind: "new" }
  | { kind: "file"; file: Blob }
  | { kind: "library"; id: string }
  | { kind: "showcase"; id: string };

export interface AppSession {
  kind: SessionKind;
  source: MapSource;
}

export interface AppShellSnapshot {
  screen: "menu" | "workspace";
  session: AppSession | null;
  /** A session start or exit is in progress. */
  busy: boolean;
}

const SESSION_MODES: Record<SessionKind, WorkspaceMode> = { editor: "edit", play: "play", showcase: "view" };

let snapshot: AppShellSnapshot = { screen: "menu", session: null, busy: false };
const listeners = new Set<() => void>();

export const getAppShell = (): AppShellSnapshot => snapshot;

export function subscribeToAppShell(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function startSession(kind: SessionKind, source: MapSource): Promise<boolean> {
  if (snapshot.busy) return false;
  publish({ busy: true });
  try {
    if (!(await leaveCurrentSession())) return false;
    // Loading and generation are authoring operations; the session's own mode is applied afterwards.
    if (!(await setWorkspaceMode("edit"))) return false;

    MapLibrary.setActiveEntryId(null);
    await openSource(source);
    if (kind === "editor") await attachLibraryEntry(source);

    await setWorkspaceMode(SESSION_MODES[kind]);
    if (kind === "play") {
      LayerControls.applyPreset("political"); // countries are picked on the political map
      openPlaySession();
    }
    publish({ screen: "workspace", session: { kind, source } });
    return true;
  } catch (error) {
    getApplicationState().ERROR && console.error(error);
    tip(`Could not open the map: ${(error as Error)?.message || "unknown error"}`, true, "error", 6000);
    return false;
  } finally {
    publish({ busy: false });
  }
}

export async function returnToMenu(): Promise<void> {
  if (snapshot.busy || snapshot.screen === "menu") return;
  publish({ busy: true });
  try {
    if (await leaveCurrentSession()) publish({ screen: "menu", session: null }); // the map stays as the menu backdrop
  } finally {
    publish({ busy: false });
  }
}

/** Deep-linked maps are already loaded by the runtime; adopt them as an Editor session. */
export function enterDeepLinkedEditor(): void {
  publish({ screen: "workspace", session: { kind: "editor", source: { kind: "new" } } });
  void attachLibraryEntry({ kind: "new" });
}

async function openSource(source: MapSource): Promise<void> {
  if (source.kind === "new") return ApplicationController.openGeneratedMap();
  if (source.kind === "file") return ApplicationController.openMapFile(source.file);
  if (source.kind === "showcase") {
    const showcase = getShowcaseMap(source.id);
    if (!showcase) throw new Error("Unknown showcase map");
    await ApplicationController.openGeneratedMap(showcase.seed);
    ensureEl<HTMLInputElement>("mapName").value = showcase.name;
    if (!getShowcaseThumbnail(showcase.id)) {
      const thumbnail = await captureThumbnail();
      if (thumbnail) storeShowcaseThumbnail(showcase.id, thumbnail);
    }
    return;
  }
  const blob = await MapLibrary.get(source.id);
  if (!blob) throw new Error("The map is no longer in the library");
  await ApplicationController.openMapFile(blob);
}

/** Editor sessions always edit a library entry, so their saves and autosaves land in the library. */
async function attachLibraryEntry(source: MapSource): Promise<void> {
  if (source.kind === "library") {
    MapLibrary.setActiveEntryId(source.id);
    return;
  }
  const mapData = await Services.Save.prepareMapData();
  const id = await MapLibrary.save({
    name: ensureEl<HTMLInputElement>("mapName").value,
    seed: getApplicationState().seed,
    blob: new Blob([mapData], { type: "text/plain" }),
    thumbnail: await captureThumbnail()
  });
  MapLibrary.setActiveEntryId(id);
}

/** Close the running session: unsaved Editor changes are kept in the library before anything else loads. */
async function leaveCurrentSession(): Promise<boolean> {
  const session = snapshot.session;
  if (!session) return true;
  if (session.kind === "editor") {
    if (getApplicationState().customization) {
      tip("Finish or cancel the active editing tool first", false, "error");
      return false;
    }
    const entryId = MapLibrary.getActiveEntryId();
    if (entryId && documentDirtyState.isDirty()) {
      const revision = documentDirtyState.getRevision();
      await Services.Save.saveToStorage(await Services.Save.prepareMapData());
      documentDirtyState.markSaved(revision);
      const thumbnail = await captureThumbnail();
      if (thumbnail) await MapLibrary.setThumbnail(entryId, thumbnail);
    }
  }
  if (session.kind === "play") closePlaySession();
  closeDialogs();
  clearSelectedCountry();
  return true;
}

function captureThumbnail(): Promise<string | undefined> {
  const { graphWidth, graphHeight } = getApplicationState();
  return captureMapThumbnail(graphWidth, graphHeight);
}

if (typeof window !== "undefined") {
  document.body.dataset.appScreen = snapshot.screen;
  // New/loaded/resampled maps started from inside the Editor become their own library entries,
  // so they never overwrite the map the session was opened with.
  window.addEventListener("map:generated", () => {
    if (snapshot.session?.kind === "editor" && !snapshot.busy) void attachLibraryEntry({ kind: "new" });
  });
}

function publish(patch: Partial<AppShellSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  document.body.dataset.appScreen = snapshot.screen;
  if (snapshot.session) document.body.dataset.appSession = snapshot.session.kind;
  else delete document.body.dataset.appSession;
  for (const listener of listeners) listener();
}
