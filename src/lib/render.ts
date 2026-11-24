/**
 * Canvas renderer for the annotation panel ("cartouche").
 * All sizes are relative to the image size, so a downscaled preview looks
 * exactly like the full-resolution export.
 */
import type { AnnotationFields, AnnotationStyle, PhotoData, ProjectRecord } from '../types';
import { formatDate } from './utils';

export function buildFields(project: Pick<ProjectRecord, 'name' | 'designation' | 'date' | 'site'>, photo: PhotoData): AnnotationFields {
  const repere = photo.repere.trim();
  // {repere} placeholder lets one task text be shared across photos with different references.
  const task = photo.task.trim().replace(/\{\s*rep[eè]re\s*\}/gi, repere || '—');
  const ownProject = photo.projectOverride.trim();
  return {
    project: ownProject || project.name.trim(),
    // A photo with its own project keeps its own designation (possibly empty).
    designation: ownProject ? (photo.designationOverride ?? '').trim() : (photo.designationOverride ?? '').trim() || (project.designation ?? '').trim(),
    repere,
    task,
    date: formatDate(photo.dateOverride.trim() || project.date),
    site: photo.siteOverride.trim() || project.site.trim(),
    observations: photo.observations.trim(),
  };
}

interface Row {
  label: string;
  value: string;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // Word longer than the line: hard split by characters.
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = word;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

interface LaidOutRow {
  label: string;
  lines: string[];
  height: number;
  stacked: boolean;
}

interface Column {
  rows: LaidOutRow[];
  width: number;
  height: number;
  labelWidth: number;
}

interface Metrics {
  base: number;
  labelSize: number;
  lineH: number;
  rowGap: number;
  pad: number;
  accent: number;
  font: string;
}

function metricsFor(imgW: number, imgH: number, style: AnnotationStyle): Metrics {
  // Geometric mean keeps text proportional for any aspect ratio (panoramas, portraits...).
  const base = Math.max(11, Math.sqrt(imgW * imgH) * 0.023 * style.fontScale);
  return {
    base,
    labelSize: base * 0.78,
    lineH: base * 1.3,
    rowGap: base * 0.45,
    pad: base * 0.85,
    accent: style.showAccentBar ? Math.max(3, base * 0.2) : 0,
    font: style.fontFamily,
  };
}

function layoutColumn(ctx: CanvasRenderingContext2D, rows: Row[], width: number, m: Metrics, style: AnnotationStyle): Column {
  ctx.font = `700 ${m.labelSize}px ${m.font}`;
  const labelWidth = Math.max(...rows.map((r) => ctx.measureText(r.label).width), 0) + m.base * 0.7;
  const stacked = width - labelWidth < m.base * 7;
  ctx.font = `600 ${m.base}px ${m.font}`;
  const laid = rows.map<LaidOutRow>((r) => {
    const value = style.uppercaseValues ? r.value.toLocaleUpperCase('fr-FR') : r.value;
    const lines = wrapText(ctx, value || '—', stacked ? width : width - labelWidth);
    const height = stacked ? m.labelSize * 1.25 + lines.length * m.lineH : lines.length * m.lineH;
    return { label: r.label, lines, height, stacked };
  });
  const height = laid.reduce((acc, r) => acc + r.height, 0) + Math.max(0, laid.length - 1) * m.rowGap;
  return { rows: laid, width, height, labelWidth };
}

function drawColumn(ctx: CanvasRenderingContext2D, col: Column, x: number, y: number, m: Metrics, style: AnnotationStyle) {
  let cy = y;
  ctx.textBaseline = 'alphabetic';
  col.rows.forEach((r, i) => {
    if (i > 0 && style.showSeparators) {
      ctx.fillStyle = hexToRgba(style.textColor, 0.16);
      ctx.fillRect(x, cy - m.rowGap / 2 - Math.max(1, m.base * 0.03) / 2, col.width, Math.max(1, m.base * 0.03));
    }
    // Baseline of the first line inside a line box of lineH.
    const firstBaseline = (lineTop: number) => lineTop + m.lineH * 0.5 + m.base * 0.36;
    ctx.font = `700 ${m.labelSize}px ${m.font}`;
    ctx.fillStyle = style.labelColor;
    if (r.stacked) {
      ctx.fillText(r.label, x, cy + m.labelSize);
      const top = cy + m.labelSize * 1.25;
      ctx.font = `600 ${m.base}px ${m.font}`;
      ctx.fillStyle = style.textColor;
      r.lines.forEach((ln, li) => ctx.fillText(ln, x, firstBaseline(top + li * m.lineH)));
    } else {
      ctx.fillText(r.label, x, firstBaseline(cy) - (m.base - m.labelSize) * 0.36);
      ctx.font = `600 ${m.base}px ${m.font}`;
      ctx.fillStyle = style.textColor;
      r.lines.forEach((ln, li) => ctx.fillText(ln, x + col.labelWidth, firstBaseline(cy + li * m.lineH)));
    }
    cy += r.height + m.rowGap;
  });
}

function rowsFor(f: AnnotationFields, style: AnnotationStyle) {
  const main: Row[] = [{ label: 'PROJET', value: f.project }];
  if (f.designation) main.push({ label: 'DÉSIGNATION', value: f.designation });
  main.push({ label: 'REPÈRE', value: f.repere }, { label: 'TÂCHE RÉALISÉE', value: f.task });
  const meta: Row[] = style.showDate ? [{ label: 'DATE', value: f.date }] : [];
  if (style.showSite && f.site) meta.push({ label: 'SITE', value: f.site });
  const obs: Row[] = style.showObservations && f.observations ? [{ label: 'OBSERVATIONS', value: f.observations }] : [];
  return { main, meta, obs };
}

// ------------------------------------------------------------------ Text-on-photo layout
/** Labels as written on site photos: "Projet: …", "Designation: …", "Rep: …", "Tache: …" */
function textRows(f: AnnotationFields, style: AnnotationStyle): Row[] {
  const rows: Row[] = [{ label: 'Projet', value: f.project }];
  if (f.designation) rows.push({ label: 'Designation', value: f.designation });
  rows.push({ label: 'Rep', value: f.repere }, { label: 'Tache', value: f.task });
  if (style.showDate && f.date) rows.push({ label: 'Date', value: f.date });
  if (style.showSite && f.site) rows.push({ label: 'Site', value: f.site });
  if (style.showObservations && f.observations) rows.push({ label: 'Obs', value: f.observations });
  return rows;
}

function drawTextLayout(ctx: CanvasRenderingContext2D, imgW: number, imgH: number, f: AnnotationFields, style: AnnotationStyle) {
  const base = Math.max(12, Math.sqrt(imgW * imgH) * 0.038 * style.fontScale);
  const lineH = base * 1.27;
  const margin = Math.max(8, Math.min(imgW, imgH) * 0.06);
  const maxW = imgW - margin * 2;
  const font = `500 ${base}px ${style.fontFamily}`;
  ctx.font = font;

  // Build wrapped lines; the first line of each row starts with its coloured label.
  const lines: { label: string; text: string }[] = [];
  for (const r of textRows(f, style)) {
    const value = (style.uppercaseValues ? r.value.toLocaleUpperCase('fr-FR') : r.value) || '—';
    const prefix = `${r.label}: `;
    wrapText(ctx, prefix + value, maxW).forEach((ln, i) => {
      const hasLabel = i === 0 && ln.startsWith(r.label + ':');
      lines.push({ label: hasLabel ? `${r.label}:` : '', text: hasLabel ? ln.slice(r.label.length + 1) : ln });
    });
  }

  const totalH = lines.length * lineH;
  const top = style.position === 'top' ? margin : imgH - margin - totalH;
  const align = style.position === 'bottom-left' ? 'left' : style.position === 'bottom-right' ? 'right' : 'center';

  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const labelW = ln.label ? ctx.measureText(ln.label).width : 0;
    const w = labelW + ctx.measureText(ln.text).width;
    const x = align === 'left' ? margin : align === 'right' ? imgW - margin - w : (imgW - w) / 2;
    const y = top + i * lineH + base * 0.95;
    // 1) soft drop shadow + outline for readability on bright backgrounds
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${style.shadowStrength})`;
    ctx.shadowBlur = base * 0.22;
    ctx.shadowOffsetY = base * 0.04;
    if (style.textOutline) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = Math.max(1, base * 0.07);
      if (ln.label) ctx.strokeText(ln.label, x, y);
      ctx.strokeText(ln.text, x + labelW, y);
    }
    // 2) the text itself
    if (ln.label) {
      ctx.fillStyle = style.labelColor;
      ctx.fillText(ln.label, x, y);
    }
    ctx.fillStyle = style.textColor;
    ctx.fillText(ln.text, x + labelW, y);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ Logo
function drawLogo(ctx: CanvasRenderingContext2D, logo: CanvasImageSource & { width: number; height: number }, imgY: number, imgW: number, imgH: number, style: AnnotationStyle) {
  const short = Math.min(imgW, imgH);
  const box = short * style.logoSize;
  const s = box / Math.max(logo.width, logo.height);
  const w = logo.width * s;
  const h = logo.height * s;
  const margin = short * 0.03;
  const x = style.logoPosition.endsWith('left') ? margin : imgW - margin - w;
  const y = style.logoPosition.startsWith('top') ? imgY + margin : imgY + imgH - margin - h;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(logo, x, y, w, h);
}

/**
 * Render the annotated image.
 * @param source decoded image (any resolution — output size derives from srcW/srcH and maxSize)
 * @param maxSize optional long-side limit for the photo part (0 = keep source size)
 * @param logo decoded logo image (see loadLogo), or null
 */
export function renderAnnotated(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  fields: AnnotationFields,
  style: AnnotationStyle,
  maxSize = 0,
  logo: (CanvasImageSource & { width: number; height: number }) | null = null,
): HTMLCanvasElement {
  const scale = maxSize > 0 && Math.max(srcW, srcH) > maxSize ? maxSize / Math.max(srcW, srcH) : 1;
  const imgW = Math.round(srcW * scale);
  const imgH = Math.round(srcH * scale);
  const ctx = canvas.getContext('2d')!;

  if (style.layout === 'text') {
    canvas.width = imgW;
    canvas.height = imgH;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, imgW, imgH);
    if (logo) drawLogo(ctx, logo, 0, imgW, imgH, style);
    drawTextLayout(ctx, imgW, imgH, fields, style);
    return canvas;
  }

  const m = metricsFor(imgW, imgH, style);
  const isBand = style.position === 'top' || style.position === 'bottom';
  const extend = isBand && style.mode === 'extend';

  // ---- Panel geometry
  const margin = isBand ? 0 : Math.round(m.base * 0.8);
  const panelW = isBand ? imgW : Math.min(imgW - margin * 2, Math.max(imgW * style.cornerWidth, m.base * 13));
  const innerX = m.pad + (isBand ? 0 : m.accent);
  const innerW = panelW - innerX - m.pad;

  const { main, meta, obs } = rowsFor(fields, style);
  const twoColumns = isBand && meta.length > 0 && innerW > m.base * 34;
  let columns: Column[];
  const colGap = m.base * 1.6;
  if (twoColumns) {
    const leftW = (innerW - colGap) * 0.66;
    const rightW = innerW - colGap - leftW;
    columns = [layoutColumn(ctx, [...main, ...obs], leftW, m, style), layoutColumn(ctx, meta, rightW, m, style)];
  } else {
    columns = [layoutColumn(ctx, [...main, ...meta, ...obs], innerW, m, style)];
  }
  const contentH = Math.max(...columns.map((c) => c.height));
  const bandAccent = isBand ? m.accent : 0;
  const panelH = Math.ceil(contentH + m.pad * 2 + bandAccent);

  // ---- Canvas size
  canvas.width = imgW;
  canvas.height = extend ? imgH + panelH : imgH;
  const imgY = extend && style.position === 'top' ? panelH : 0;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, imgY, imgW, imgH);

  // ---- Panel position
  let px = 0;
  let py = 0;
  switch (style.position) {
    case 'bottom':
      py = extend ? imgH : imgH - panelH;
      break;
    case 'top':
      py = 0;
      break;
    case 'bottom-left':
      px = margin;
      py = imgH - panelH - margin;
      break;
    case 'bottom-right':
      px = imgW - panelW - margin;
      py = imgH - panelH - margin;
      break;
  }

  ctx.fillStyle = hexToRgba(style.bgColor, extend ? 1 : style.bgOpacity);
  ctx.fillRect(px, py, panelW, panelH);

  if (m.accent > 0) {
    ctx.fillStyle = style.accentColor;
    if (isBand) {
      // Stripe on the edge touching the photo.
      const ay = style.position === 'bottom' ? py : py + panelH - m.accent;
      ctx.fillRect(px, ay, panelW, m.accent);
    } else {
      ctx.fillRect(px, py, m.accent, panelH);
    }
  }

  const contentY = py + m.pad + (isBand && style.position === 'bottom' ? bandAccent : 0);
  let cx = px + innerX;
  columns.forEach((col, i) => {
    if (i > 0 && style.showSeparators) {
      ctx.fillStyle = hexToRgba(style.textColor, 0.16);
      ctx.fillRect(cx - colGap / 2, contentY, Math.max(1, m.base * 0.03), contentH);
    }
    drawColumn(ctx, col, cx, contentY, m, style);
    cx += col.width + colGap;
  });

  if (logo) drawLogo(ctx, logo, imgY, imgW, imgH, style);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Échec de l’encodage de l’image'))), type, quality);
  });
}
