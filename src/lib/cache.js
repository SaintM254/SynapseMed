// Two-level cache:
//  - localStorage for small JSON (the Drive folder tree, with a short TTL)
//  - IndexedDB for extracted text / summaries (can be large, kept offline)

export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage write failed', err);
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ---- Drive tree cache (10-minute TTL, refreshed by the Sync button) ----
export const TREE_TTL = 10 * 60 * 1000;

export function getCachedTree(rootId) {
  const entry = lsGet(`synapsemed.tree.${rootId}`);
  if (!entry || Date.now() - entry.at > TREE_TTL) return null;
  return entry.tree;
}

export function setCachedTree(rootId, tree) {
  lsSet(`synapsemed.tree.${rootId}`, { at: Date.now(), tree });
}

export function clearTreeCaches() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('synapsemed.tree.')) localStorage.removeItem(key);
    }
  } catch {}
}

// ---- IndexedDB ----
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('synapsemed', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function idbKeys() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbEntries(prefix) {
  const keys = (await idbKeys()).filter((k) => String(k).startsWith(prefix));
  const out = [];
  for (const k of keys) out.push({ key: String(k), value: await idbGet(k) });
  return out;
}

export async function idbClear() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
