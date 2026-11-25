/**
 * Full backup / restore of the app data (everything stored in this browser):
 * photo projects, daily reports, users, equipment lists, settings, templates and all images.
 *
 * Backup file (.zip):
 *   manifest.json   app, version, date, counts
 *   projects.json   photo projects
 *   kv.json         settings, users, reports… ([key, value][])
 *   blobs.json      [key, file name, MIME type][]
 *   blobs/<n>       image files
 */
import JSZip from 'jszip';
import { backupDb } from './db';
import { downloadBlob } from './exporter';
import { todayISO } from './utils';

const APP = 'industrial-photo-annotator';
const FORMAT = 1;

export interface BackupInfo {
  createdAt: string;
  projects: number;
  reports: number;
  images: number;
  users: number;
}

type Progress = (text: string, done?: number, total?: number) => void;

export async function createBackup(onProgress?: Progress): Promise<BackupInfo> {
  onProgress?.('Lecture des données…');
  const [projects, kv, blobs] = await Promise.all([backupDb.readAll('projects'), backupDb.readAll('kv'), backupDb.readAll<Blob>('blobs')]);
  const zip = new JSZip();
  const index: [string, string, string][] = [];
  blobs.forEach(([key, blob], i) => {
    const file = `blobs/${i}`;
    index.push([String(key), file, blob.type]);
    zip.file(file, blob);
  });
  const users = (kv.find(([k]) => k === 'users')?.[1] as unknown[] | undefined)?.length ?? 0;
  const info: BackupInfo = {
    createdAt: new Date().toISOString(),
    projects: projects.length,
    reports: kv.filter(([k]) => String(k).startsWith('report:')).length,
    images: blobs.length,
    users,
  };
  zip.file('manifest.json', JSON.stringify({ app: APP, format: FORMAT, ...info }, null, 1));
  zip.file('projects.json', JSON.stringify(projects.map(([, v]) => v)));
  zip.file('kv.json', JSON.stringify(kv));
  zip.file('blobs.json', JSON.stringify(index));
  // Images are already compressed: STORE is fast; JSON is deflated.
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => onProgress?.('Création du fichier…', Math.round(m.percent), 100));
  downloadBlob(out, `Sauvegarde Industrial Photo Annotator ${todayISO()}.zip`);
  return info;
}

/** Read a backup and show what it contains (nothing is written yet). */
export async function readBackup(file: File) {
  const zip = await JSZip.loadAsync(file);
  const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? 'null');
  if (!manifest || manifest.app !== APP) throw new Error('Ce fichier n’est pas une sauvegarde Industrial Photo Annotator.');
  if (manifest.format > FORMAT) throw new Error('Sauvegarde créée par une version plus récente de l’application.');
  return {
    info: manifest as BackupInfo,
    /** Merge the backup into this browser: same items are replaced, other existing data is kept. */
    restore: async (onProgress?: Progress) => {
      const projects = JSON.parse((await zip.file('projects.json')?.async('string')) ?? '[]') as { id: string }[];
      const kv = JSON.parse((await zip.file('kv.json')?.async('string')) ?? '[]') as [string, unknown][];
      const index = JSON.parse((await zip.file('blobs.json')?.async('string')) ?? '[]') as [string, string, string][];
      // Images first, in batches, so a big backup does not hold everything twice in memory.
      for (let i = 0; i < index.length; i += 25) {
        const batch: [string, Blob][] = [];
        for (const [key, name, type] of index.slice(i, i + 25)) {
          const f = zip.file(name);
          if (f) batch.push([key, new Blob([await f.async('arraybuffer')], { type })]);
        }
        await backupDb.writeAll('blobs', batch);
        onProgress?.('Restauration des images…', Math.min(index.length, i + 25), index.length);
      }
      await backupDb.writeAll(
        'projects',
        projects.map((p) => [p.id, p]),
      );
      await backupDb.writeAll('kv', kv);
      return manifest as BackupInfo;
    },
  };
}
