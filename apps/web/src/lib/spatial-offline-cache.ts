/** Offline IndexedDB cache shared by window and dedicated Worker contexts. */
export type SpatialCacheKind = "roads" | "tile" | "regional";
type SpatialCacheEntry = {
  key: string;
  kind: SpatialCacheKind;
  payload: unknown;
  bytes: number;
  savedAt: number;
  lastAccessedAt: number;
  expiresAt: number;
};
type CacheStats = { id: "stats"; count: number; bytes: number };
type SpatialDatabase = IDBDatabase;

const DATABASE_NAME = "tirkha-spatial-offline";
const DATABASE_VERSION = 1;
const ENTRY_STORE = "entries";
const STATS_STORE = "meta";
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 1_600;
const MAX_ENTRY_BYTES = 48 * 1024 * 1024;
const TTL: Record<SpatialCacheKind, number> = {
  roads: 14 * 24 * 60 * 60 * 1_000,
  tile: 30 * 24 * 60 * 60 * 1_000,
  regional: 12 * 60 * 60 * 1_000,
};

let databasePromise: Promise<SpatialDatabase | null> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function openDatabase(): Promise<SpatialDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  const pending = new Promise<SpatialDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    let settled = false;
    try { request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
    catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ENTRY_STORE)) {
        const entries = database.createObjectStore(ENTRY_STORE, { keyPath: "key" });
        entries.createIndex("byLastAccessedAt", "lastAccessedAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(STATS_STORE)) database.createObjectStore(STATS_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = request.onblocked = () => {
      settled = true;
      databasePromise = null;
      resolve(null);
    };
  }).catch((): SpatialDatabase | null => null);
  databasePromise = pending;
  return pending;
}

function estimateBytes(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { return MAX_ENTRY_BYTES + 1; }
}

/** Returns a payload only while its per-kind TTL is valid; IDB failures are cache misses. */
export async function getSpatialOfflineValue<T>(key: string, kind: SpatialCacheKind, options: { allowExpired?: boolean } = {}): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;
  return new Promise<T | undefined>((resolve) => {
    let payload: T | undefined;
    let transaction: IDBTransaction;
    try { transaction = database.transaction([ENTRY_STORE, STATS_STORE], "readwrite"); }
    catch { resolve(undefined); return; }
    const store = transaction.objectStore(ENTRY_STORE);
    const request = store.get(key) as IDBRequest<SpatialCacheEntry | undefined>;
    request.onsuccess = () => {
      const entry = request.result;
      const now = Date.now();
      if (!entry || entry.kind !== kind) return;
      if (entry.expiresAt <= now && !options.allowExpired) {
        store.delete(key);
        const meta = transaction.objectStore(STATS_STORE);
        const statsRequest = meta.get("stats") as IDBRequest<CacheStats | undefined>;
        statsRequest.onsuccess = () => {
          const stats = statsRequest.result;
          if (stats) meta.put({ ...stats, count: Math.max(0, stats.count - 1), bytes: Math.max(0, stats.bytes - entry.bytes) });
        };
        return;
      }
      entry.lastAccessedAt = now;
      payload = entry.payload as T;
      if (entry.expiresAt > now) store.put(entry);
    };
    transaction.oncomplete = () => resolve(payload);
    transaction.onerror = transaction.onabort = () => resolve(undefined);
  }).catch(() => undefined);
}

function evictToBudget(database: SpatialDatabase, targetBytes = MAX_CACHE_BYTES): Promise<void> {
  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try { transaction = database.transaction([ENTRY_STORE, STATS_STORE], "readwrite"); }
    catch { resolve(); return; }
    const entries = transaction.objectStore(ENTRY_STORE);
    const meta = transaction.objectStore(STATS_STORE);
    const statsRequest = meta.get("stats") as IDBRequest<CacheStats | undefined>;
    statsRequest.onsuccess = () => {
      const stats = statsRequest.result ?? { id: "stats", count: 0, bytes: 0 };
      const cursorRequest = entries.index("byLastAccessedAt").openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) { meta.put(stats); return; }
        const entry = cursor.value as SpatialCacheEntry;
        const overBudget = stats.bytes > targetBytes || stats.count > MAX_CACHE_ENTRIES;
        if (entry.expiresAt <= Date.now() || overBudget) {
          stats.bytes = Math.max(0, stats.bytes - entry.bytes);
          stats.count = Math.max(0, stats.count - 1);
          cursor.delete();
        }
        cursor.continue();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => resolve();
  });
}

async function writeEntry(database: SpatialDatabase, entry: SpatialCacheEntry): Promise<boolean> {
  const result = await new Promise<boolean>((resolve) => {
    let transaction: IDBTransaction;
    try { transaction = database.transaction([ENTRY_STORE, STATS_STORE], "readwrite"); }
    catch { resolve(false); return; }
    const entries = transaction.objectStore(ENTRY_STORE);
    const meta = transaction.objectStore(STATS_STORE);
    let oldEntry: SpatialCacheEntry | undefined;
    let stats: CacheStats | undefined;
    let reads = 0;
    const save = () => {
      reads += 1;
      if (reads !== 2) return;
      const next: CacheStats = {
        id: "stats",
        count: Math.max(0, (stats?.count ?? 0) + (oldEntry ? 0 : 1)),
        bytes: Math.max(0, (stats?.bytes ?? 0) - (oldEntry?.bytes ?? 0) + entry.bytes),
      };
      entries.put(entry);
      meta.put(next);
    };
    const oldRequest = entries.get(entry.key) as IDBRequest<SpatialCacheEntry | undefined>;
    const statsRequest = meta.get("stats") as IDBRequest<CacheStats | undefined>;
    oldRequest.onsuccess = () => { oldEntry = oldRequest.result; save(); };
    statsRequest.onsuccess = () => { stats = statsRequest.result; save(); };
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = transaction.onabort = () => resolve(false);
  });
  if (result) await evictToBudget(database);
  return result;
}

/** Stores a cloneable GeoJSON payload; a failed/quota-limited cache write never fails map rendering. */
export function putSpatialOfflineValue(key: string, kind: SpatialCacheKind, payload: unknown): Promise<boolean> {
  const bytes = estimateBytes(payload);
  if (!key || bytes < 1 || bytes > MAX_ENTRY_BYTES) return Promise.resolve(false);
  const now = Date.now();
  const entry: SpatialCacheEntry = { key, kind, payload, bytes, savedAt: now, lastAccessedAt: now, expiresAt: now + TTL[kind] };
  const operation = writeQueue.then(async () => {
    const database = await openDatabase();
    if (!database) return false;
    if (await writeEntry(database, entry)) return true;
    await evictToBudget(database, Math.floor(MAX_CACHE_BYTES / 2));
    return writeEntry(database, entry);
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation.catch(() => false);
}

/** Explicit local-only reset for recovery or future storage controls. */
export async function clearSpatialOfflineCache(): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction([ENTRY_STORE, STATS_STORE], "readwrite");
      transaction.objectStore(ENTRY_STORE).clear();
      transaction.objectStore(STATS_STORE).put({ id: "stats", count: 0, bytes: 0 } satisfies CacheStats);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => resolve();
    } catch { resolve(); }
  });
}
