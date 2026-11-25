/**
 * Report photos.
 *  - "rp:<id>:o" original image (full resolution, never modified)
 *  - "rp:<id>"   display copy (max 1600 px, no annotation)
 *  - "rp:<id>:t" thumbnail
 * Annotations (Projet / Désignation / Repère / Tâche) are drawn on demand from the original,
 * so they always follow the activity line and are exported in HD.
 */
import { db } from '../lib/db';
import { canvasToBlob, renderAnnotated } from '../lib/render';
import { loadLogo, loadOriginalBitmap } from '../lib/images';
import { formatDate, uid } from '../lib/utils';
import type { AnnotationFields, AnnotationStyle, PhotoData, ProjectRecord } from '../types';
import type { Activity, DailyReport, ReportPhoto } from './types';

export const DISPLAY_MAX = 1600;
/** Long side of photos written to Excel (HD). */
export const EXCEL_PHOTO_MAX = 2000;
const THUMB = 320;

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function scaledCanvas(src: CanvasImageSource & { width: number; height: number }, max: number) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Store an original image: original + display copy + thumbnail. */
async function storeOriginal(original: Blob): Promise<{ id: string; width: number; height: number; original: true }> {
  const bmp = await decode(original);
  try {
    const id = uid();
    const display = scaledCanvas(bmp, DISPLAY_MAX);
    const thumb = scaledCanvas(bmp, THUMB);
    const [d, t] = await Promise.all([canvasToBlob(display, 'image/jpeg', 0.9), canvasToBlob(thumb, 'image/jpeg', 0.8)]);
    await db.putBlobs([
      [`rp:${id}:o`, original],
      [`rp:${id}`, d],
      [`rp:${id}:t`, t],
    ]);
    thumbCache.set(id, URL.createObjectURL(t));
    return { id, width: bmp.width, height: bmp.height, original: true };
  } finally {
    bmp.close();
  }
}

/** Photo added on an activity line (or imported from Excel): stored untouched. */
export const addReportPhoto = (file: Blob) => storeOriginal(file);
export const storeRawPhoto = (blob: Blob) => storeOriginal(blob);

/** Photo taken from a V1 photo project: original + the annotation values typed there. */
export async function photoFromProject(project: ProjectRecord, photo: PhotoData, fields: AnnotationFields) {
  const blob = await db.getBlob(`${photo.id}:orig`);
  if (!blob) {
    // Fallback: decode through the V1 helper (keeps orientation)
    const bmp = await loadOriginalBitmap(photo.id);
    const c = scaledCanvas(bmp, 4000);
    bmp.close();
    return { ...(await storeOriginal(await canvasToBlob(c, 'image/jpeg', 0.95))), ann: annFrom(fields, project) };
  }
  return { ...(await storeOriginal(blob)), ann: annFrom(fields, project) };
}
const annFrom = (f: AnnotationFields, _p: ProjectRecord) => ({ projet: f.project, designation: f.designation, repere: f.repere, tache: f.task });

// ------------------------------------------------------------------ Annotation values
export interface EquipLookup {
  (label: string): { code: string; designation: string } | undefined;
}

/** Values drawn on a photo: per-photo overrides, else its activity line. */
export function photoFields(photo: ReportPhoto, act: Activity | undefined, report: DailyReport, lookup: EquipLookup): AnnotationFields {
  const opt = act ? lookup(act.equipement) : undefined;
  const o = photo.ann ?? {};
  return {
    project: o.projet || opt?.code || act?.equipement.split('|')[0].trim() || act?.projet || '',
    designation: o.designation ?? opt?.designation ?? '',
    repere: o.repere || act?.repere || '',
    task: o.tache || act?.activite || photo.caption,
    date: formatDate(report.date),
    site: '',
    observations: '',
  };
}

/** Render a photo (annotated or not) at `max` px from the best stored source. */
export async function renderReportPhoto(p: ReportPhoto, fields: AnnotationFields | null, style: AnnotationStyle, max: number, canvas = document.createElement('canvas')) {
  const src = (p.original && (await db.getBlob(`rp:${p.id}:o`))) || (await db.getBlob(`rp:${p.id}`));
  if (!src) throw new Error('Photo introuvable');
  const bmp = await decode(src);
  try {
    if (fields) renderAnnotated(canvas, bmp, bmp.width, bmp.height, fields, style, max, await loadLogo(style.logoDataUrl));
    else {
      const c = scaledCanvas(bmp, max);
      canvas.width = c.width;
      canvas.height = c.height;
      canvas.getContext('2d')!.drawImage(c, 0, 0);
    }
    return canvas;
  } finally {
    bmp.close();
  }
}

/** HD JPEG for the Excel export. */
export async function reportPhotoHD(p: ReportPhoto, fields: AnnotationFields | null, style: AnnotationStyle) {
  const c = await renderReportPhoto(p, fields, style, EXCEL_PHOTO_MAX);
  const blob = await canvasToBlob(c, 'image/jpeg', 0.92);
  const out = { blob, width: c.width, height: c.height };
  c.width = c.height = 0;
  return out;
}

// ------------------------------------------------------------------ Thumbnails & cleanup
const thumbCache = new Map<string, string>();
export async function reportThumbUrl(id: string): Promise<string> {
  const hit = thumbCache.get(id);
  if (hit) return hit;
  const b = await db.getBlob(`rp:${id}:t`);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  thumbCache.set(id, u);
  return u;
}
export const reportPhotoBlob = (id: string) => db.getBlob(`rp:${id}`);
export async function deleteReportPhotos(ids: string[]) {
  ids.forEach((id) => {
    const u = thumbCache.get(id);
    if (u) URL.revokeObjectURL(u);
    thumbCache.delete(id);
  });
  await db.deleteKeys(ids.flatMap((id) => [`rp:${id}`, `rp:${id}:t`, `rp:${id}:o`]));
}
