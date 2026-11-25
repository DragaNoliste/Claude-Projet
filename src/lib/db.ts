/**
 * Minimal IndexedDB wrapper. Everything stays in the user's browser.
 *  - projects : ProjectRecord (metadata + per-photo text, no binaries)
 *  - blobs    : image binaries, keys "<photoId>:orig" | ":prev" | ":thumb"
 *  - kv       : settings (task library, templates, last project, default style)
 *               + V2 daily reports under keys "report:<ownerId>:<yyyy-mm-dd>"
 */
import type { ProjectRecord } from '../types';
import type { DailyReport } from '../report/types';

const DB_NAME = 'industrial-photo-annotator';
// Version 1 on purpose: V2 reports live in the kv store (keys "report:<owner>:<date>"),
// so the Version 1 app can still open the same database.
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

type StoreName = 'projects' | 'blobs' | 'kv';

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDB();
  const tx = db.transaction(store, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const s = tx.objectStore(store);
  const r = fn(s);
  const result = r instanceof IDBRequest ? await reqToPromise(r) : await r;
  await done;
  return result;
}

/** Read every [key, value] of a store (used by the backup). */
async function readAll<T>(store: StoreName): Promise<[IDBValidKey, T][]> {
  const dbi = await openDB();
  return new Promise((resolve, reject) => {
    const out: [IDBValidKey, T][] = [];
    const tx = dbi.transaction(store, 'readonly');
    const req = tx.objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out.push([c.primaryKey, c.value as T]);
      c.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

/** Write many entries in one transaction (keyPath stores ignore the key). */
async function writeAll(store: StoreName, entries: [IDBValidKey, unknown][]): Promise<void> {
  if (!entries.length) return;
  const dbi = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = dbi.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    for (const [k, v] of entries) {
      if (s.keyPath) s.put(v);
      else s.put(v, k);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const backupDb = { readAll, writeAll };

export const db = {
  async getReport(id: string): Promise<DailyReport | undefined> {
    return withStore('kv', 'readonly', (s) => s.get('report:' + id) as IDBRequest<DailyReport | undefined>);
  },
  async putReport(r: DailyReport): Promise<void> {
    await withStore('kv', 'readwrite', (s) => s.put(r, 'report:' + r.id));
  },
  async deleteReport(id: string): Promise<void> {
    await withStore('kv', 'readwrite', (s) => s.delete('report:' + id));
  },
  async listReports(ownerId: string): Promise<DailyReport[]> {
    const range = IDBKeyRange.bound(`report:${ownerId}:`, `report:${ownerId}:￿`);
    const all = await withStore('kv', 'readonly', (s) => s.getAll(range) as IDBRequest<DailyReport[]>);
    return all.filter((r) => r.ownerId === ownerId).sort((a, b) => a.date.localeCompare(b.date));
  },
  async deleteKeys(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const dbi = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction('blobs', 'readwrite');
      const st = tx.objectStore('blobs');
      for (const k of keys) st.delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async getProject(id: string): Promise<ProjectRecord | undefined> {
    return withStore('projects', 'readonly', (s) => s.get(id) as IDBRequest<ProjectRecord | undefined>);
  },
  async putProject(p: ProjectRecord): Promise<void> {
    await withStore('projects', 'readwrite', (s) => s.put(p));
  },
  async listProjects(): Promise<ProjectRecord[]> {
    const all = await withStore('projects', 'readonly', (s) => s.getAll() as IDBRequest<ProjectRecord[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async deleteProject(p: ProjectRecord): Promise<void> {
    await withStore('projects', 'readwrite', (s) => s.delete(p.id));
    await db.deletePhotoBlobs(p.photos.map((ph) => ph.id));
  },
  async getBlob(key: string): Promise<Blob | undefined> {
    return withStore('blobs', 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);
  },
  async putBlobs(entries: [string, Blob][]): Promise<void> {
    const dbi = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction('blobs', 'readwrite');
      const s = tx.objectStore('blobs');
      for (const [k, b] of entries) s.put(b, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  async deletePhotoBlobs(photoIds: string[]): Promise<void> {
    if (!photoIds.length) return;
    const dbi = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction('blobs', 'readwrite');
      const s = tx.objectStore('blobs');
      for (const id of photoIds) for (const suf of ['orig', 'prev', 'thumb']) s.delete(`${id}:${suf}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async kvGet<T>(key: string): Promise<T | undefined> {
    return withStore('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
  },
  async kvSet<T>(key: string, value: T): Promise<void> {
    await withStore('kv', 'readwrite', (s) => s.put(value, key));
  },
};
