/**
 * Minimal IndexedDB wrapper. Everything stays in the user's browser.
 *  - projects : ProjectRecord (metadata + per-photo text, no binaries)
 *  - blobs    : image binaries, keys "<photoId>:orig" | ":prev" | ":thumb"
 *  - kv       : settings (task library, templates, last project, default style)
 */
import type { ProjectRecord } from '../types';

const DB_NAME = 'industrial-photo-annotator';
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

export const db = {
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
