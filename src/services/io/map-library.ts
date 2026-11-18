// Browser library of the user's maps: every map created or opened in the Editor gets an entry here.
// Kept in its own IndexedDB database so the legacy "lastMap" quick-save slot stays untouched.

const DATABASE_NAME = "fantasia-map-library";
const STORE_NAME = "maps";
export const MAP_LIBRARY_CHANGE_EVENT = "map-library:change";

export interface MapLibraryEntry {
  id: string;
  name: string;
  seed: string;
  createdAt: number;
  updatedAt: number;
  size: number;
  /** JPEG data URL of the map, when one was captured. */
  thumbnail?: string;
}

interface MapLibraryRecord extends MapLibraryEntry {
  blob: Blob;
}

let activeEntryId: string | null = null;

export const MapLibrary = {
  /** Entries without their payload, most recently updated first. */
  async list(): Promise<MapLibraryEntry[]> {
    const records = await request<MapLibraryRecord[]>("readonly", store => store.getAll());
    return records.map(({ blob: _blob, ...entry }) => entry).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<Blob | undefined> {
    return (await request<MapLibraryRecord | undefined>("readonly", store => store.get(id)))?.blob;
  },

  /** Create (no `id`) or overwrite an entry; returns its id. */
  async save(data: { id?: string; name: string; seed: string; blob: Blob; thumbnail?: string }): Promise<string> {
    const id = data.id ?? crypto.randomUUID();
    const existing = data.id
      ? await request<MapLibraryRecord | undefined>("readonly", store => store.get(id))
      : undefined;
    const now = Date.now();
    const record: MapLibraryRecord = {
      id,
      name: data.name || "Untitled map",
      seed: data.seed,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      size: data.blob.size,
      thumbnail: data.thumbnail ?? existing?.thumbnail,
      blob: data.blob
    };
    await request("readwrite", store => store.put(record));
    notifyChange();
    return id;
  },

  async setThumbnail(id: string, thumbnail: string): Promise<void> {
    const record = await request<MapLibraryRecord | undefined>("readonly", store => store.get(id));
    if (!record) return;
    await request("readwrite", store => store.put({ ...record, thumbnail }));
    notifyChange();
  },

  async remove(id: string): Promise<void> {
    await request("readwrite", store => store.delete(id));
    if (activeEntryId === id) activeEntryId = null;
    notifyChange();
  },

  async download(id: string): Promise<void> {
    const record = await request<MapLibraryRecord | undefined>("readonly", store => store.get(id));
    if (!record) throw new Error("Map is not in the library");
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement("a");
    link.download = `${record.name}.map`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  /** The entry that browser-storage saves of the open document (manual or autosave) are mirrored into. */
  getActiveEntryId: (): string | null => activeEntryId,
  setActiveEntryId(id: string | null): void {
    activeEntryId = id;
  },

  /** Mirror a browser-storage save into the active entry; a no-op outside library-backed editing. */
  async saveActiveDocument(blob: Blob, name: string, seed: string): Promise<void> {
    if (activeEntryId) await MapLibrary.save({ id: activeEntryId, name, seed, blob });
  }
};

function notifyChange(): void {
  window.dispatchEvent(new Event(MAP_LIBRARY_CHANGE_EVENT));
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is not supported"));
  databasePromise ??= new Promise((resolve, reject) => {
    const open = window.indexedDB.open(DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME))
        open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => {
      databasePromise = null;
      reject(open.error ?? new Error("IndexedDB request error"));
    };
  });
  return databasePromise;
}

async function request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const store = (await openDatabase()).transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const pending = action(store);
    pending.onsuccess = () => resolve(pending.result as T);
    pending.onerror = () => reject(pending.error ?? new Error("IndexedDB request failed"));
  });
}
