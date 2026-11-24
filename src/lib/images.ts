import { db } from './db';
import { canvasToBlob } from './render';

export const PREVIEW_MAX = 1800;
const THUMB_MAX = 360;

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback through <img> (some browsers are pickier with createImageBitmap)
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function scaled(bmp: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasToBlob(c, 'image/jpeg', quality);
}

export interface ProcessedImage {
  width: number;
  height: number;
  thumb: Blob;
  preview: Blob;
}

/** Decode once, store original + preview + thumbnail locally. */
export async function processAndStore(id: string, file: File): Promise<ProcessedImage> {
  const bmp = await decode(file);
  try {
    const [preview, thumb] = [await scaled(bmp, PREVIEW_MAX, 0.9), await scaled(bmp, THUMB_MAX, 0.8)];
    await db.putBlobs([
      [`${id}:orig`, file],
      [`${id}:prev`, preview],
      [`${id}:thumb`, thumb],
    ]);
    previewBlobs.set(id, preview);
    return { width: bmp.width, height: bmp.height, thumb, preview };
  } finally {
    bmp.close();
  }
}

// ---- Preview cache (small LRU of decoded bitmaps for instant live preview)
const previewBlobs = new Map<string, Blob>();
const bitmapCache = new Map<string, Promise<ImageBitmap>>();
const LRU_SIZE = 8;

export function getPreviewBitmap(id: string): Promise<ImageBitmap> {
  const hit = bitmapCache.get(id);
  if (hit) {
    bitmapCache.delete(id);
    bitmapCache.set(id, hit);
    return hit;
  }
  const p = (async () => {
    const blob = previewBlobs.get(id) ?? (await db.getBlob(`${id}:prev`));
    if (!blob) throw new Error('Aperçu introuvable');
    return decode(blob);
  })();
  bitmapCache.set(id, p);
  p.catch(() => bitmapCache.delete(id));
  while (bitmapCache.size > LRU_SIZE) {
    const oldest = bitmapCache.keys().next().value as string;
    const old = bitmapCache.get(oldest);
    bitmapCache.delete(oldest);
    old?.then((b) => b.close()).catch(() => {});
  }
  return p;
}

export function forgetPreview(id: string) {
  previewBlobs.delete(id);
  const p = bitmapCache.get(id);
  bitmapCache.delete(id);
  p?.then((b) => b.close()).catch(() => {});
}

export async function loadOriginalBitmap(id: string): Promise<ImageBitmap> {
  const blob = await db.getBlob(`${id}:orig`);
  if (!blob) throw new Error('Image originale introuvable');
  return decode(blob);
}

// ---- Logo (data URL stored in the style)
const logoCache = new Map<string, Promise<HTMLImageElement>>();
export function loadLogo(dataUrl: string): Promise<HTMLImageElement | null> {
  if (!dataUrl) return Promise.resolve(null);
  let p = logoCache.get(dataUrl);
  if (!p) {
    const img = new Image();
    img.src = dataUrl;
    p = img.decode().then(() => img);
    logoCache.set(dataUrl, p);
    p.catch(() => logoCache.delete(dataUrl));
  }
  return p.catch(() => null);
}

/** Read a logo file, downscale it to max 800 px and return a PNG data URL (transparency kept). */
export async function logoFileToDataUrl(file: File): Promise<string> {
  const bmp = await decode(file);
  try {
    const s = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    bmp.close();
  }
}

export async function thumbUrlFor(id: string): Promise<string> {
  const blob = await db.getBlob(`${id}:thumb`);
  return blob ? URL.createObjectURL(blob) : '';
}
