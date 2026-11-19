/**
 * A copy of the church's data kept on this device, so a returning user sees Home at once
 * while fresh data loads behind it. Cleared when they sign out.
 */
const DB = "traqi-cache", STORE = "church", KEY = "last";

function open(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}

export type Cached<T> = { userId: string; churchId: string; meId: string; at: number; state: T };

export async function readCache<T>(userId: string): Promise<Cached<T> | null> {
  const db = await open(); if (!db) return null;
  return new Promise((res) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => { const v = r.result as Cached<T> | undefined; res(v && v.userId === userId && Date.now() - v.at < 14 * 864e5 ? v : null); };
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}

export async function writeCache<T>(v: Cached<T>) {
  const db = await open(); if (!db) return;
  try { db.transaction(STORE, "readwrite").objectStore(STORE).put(v, KEY); } catch { /* storage full or blocked */ }
}

export async function clearCache() {
  const db = await open(); if (!db) return;
  try { db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY); } catch { /* nothing to clear */ }
}
