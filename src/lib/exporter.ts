import JSZip from 'jszip';
import type { ExportSettings, PhotoData, ProjectRecord } from '../types';
import { buildFields, canvasToBlob, renderAnnotated } from './render';
import { loadLogo, loadOriginalBitmap } from './images';
import { sanitizeFilename } from './utils';

export function fileNameFor(photo: PhotoData, index: number, total: number, settings: ExportSettings): string {
  const ext = settings.format === 'png' ? 'png' : 'jpg';
  const num = String(index + 1).padStart(Math.max(2, String(total).length), '0');
  let base: string;
  switch (settings.naming) {
    case 'original':
      base = sanitizeFilename(photo.name.replace(/\.[^.]+$/, ''), 80);
      break;
    case 'index-repere-task':
      base = `${num}_${sanitizeFilename(photo.repere || 'sans-repere', 30)}_${sanitizeFilename(photo.task.replace(/\{.*?\}/g, ''), 40)}`;
      break;
    default:
      base = `${num}_${sanitizeFilename(photo.repere || 'sans-repere', 40)}`;
  }
  return `${base}.${ext}`;
}

/** Full-resolution render of one photo. */
export async function renderPhotoBlob(project: ProjectRecord, photo: PhotoData): Promise<Blob> {
  const [bmp, logo] = await Promise.all([loadOriginalBitmap(photo.id), loadLogo(project.style.logoDataUrl)]);
  const canvas = document.createElement('canvas');
  try {
    renderAnnotated(canvas, bmp, bmp.width, bmp.height, buildFields(project, photo), project.style, project.exportSettings.maxSize, logo);
    const s = project.exportSettings;
    return await canvasToBlob(canvas, s.format === 'png' ? 'image/png' : 'image/jpeg', s.format === 'png' ? undefined : s.quality);
  } finally {
    bmp.close();
    canvas.width = canvas.height = 0; // free memory
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ProgressFn = (done: number, total: number) => void;

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, dot)}_${i}${name.slice(dot)}`;
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
}

/** Index of each photo in the full project (keeps numbering stable when exporting a subset). */
function indexOf(project: ProjectRecord, photo: PhotoData) {
  return project.photos.findIndex((p) => p.id === photo.id);
}

export async function exportAsZip(project: ProjectRecord, photos: PhotoData[], onProgress?: ProgressFn): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (let i = 0; i < photos.length; i++) {
    onProgress?.(i, photos.length);
    const p = photos[i];
    const blob = await renderPhotoBlob(project, p);
    zip.file(uniqueName(fileNameFor(p, indexOf(project, p), project.photos.length, project.exportSettings), used), blob);
  }
  onProgress?.(photos.length, photos.length);
  // Images are already compressed: STORE is much faster and nearly as small.
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const zipName = `${sanitizeFilename(project.name || 'Projet', 50)}_${project.date || 'photos'}.zip`;
  downloadBlob(out, zipName);
}

export async function exportAsFiles(project: ProjectRecord, photos: PhotoData[], onProgress?: ProgressFn): Promise<void> {
  const used = new Set<string>();
  for (let i = 0; i < photos.length; i++) {
    onProgress?.(i, photos.length);
    const p = photos[i];
    const blob = await renderPhotoBlob(project, p);
    downloadBlob(blob, uniqueName(fileNameFor(p, indexOf(project, p), project.photos.length, project.exportSettings), used));
    // Small pause so the browser accepts consecutive downloads.
    if (photos.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
  onProgress?.(photos.length, photos.length);
}
