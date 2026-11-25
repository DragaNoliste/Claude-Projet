/**
 * Excel export reproducing the design of the site template (sheet "25-11-2026" of
 * "Daily Report 24-11-2026.xlsx"): Arial, navy #002060 headers, framed blocks,
 * coloured progress cells, orange "éléments en attente" band, 4-per-row photo report, A3 landscape.
 * Values are written directly (no formulas), so there is no #REF! / #N/A.
 */
import type { Workbook, Worksheet, Borders, Fill, Border, PaperSize } from 'exceljs';
/** A3 paper (Excel code 8), as in the site template — missing from the ExcelJS type list. */
const A3 = 8 as unknown as PaperSize;
import type { Activity, DailyReport, ReportSettings } from './types';
import { cumulHours, dayHours, dayPeople, frDate, hoursOf, isFilled, metierHours, metierPeople, peopleOf, persons, projectSummary, sheetName, statusOf } from './logic';
import { photoFields, reportPhotoHD, type EquipLookup } from './photos';
import type { AnnotationStyle } from '../types';
import { downloadBlob } from '../lib/exporter';
import { sanitizeFilename } from '../lib/utils';

// ------------------------------------------------------------------ Palette of the template
const C = {
  navy: 'FF002060',
  navy2: 'FF215C98',
  light: 'FFD9E1F2',
  grey: 'FFF2F2F2',
  zebra: 'FFF2F5FA',
  yellow: 'FFFFF2CC',
  amber: 'FFFFC000',
  green: 'FF00B050',
  white: 'FFFFFFFF',
  black: 'FF000000',
  text: 'FF1F1F1F',
  grid: 'FFBFBFBF',
  photoGrid: 'FF8EA9DB',
  caption: 'FFE9EEF6',
  waitFill: 'FFFBE2D5',
  waitLine: 'FFF4B183',
  waitTop: 'FFED7D31',
  waitText: 'FF843C0C',
  muted: 'FF595959',
};
const PROJECT_FILLS = ['FFA1BFCD', 'FFECD5E9', 'FFD1E1D3', 'FFFCE4D6', 'FFDDEBF7', 'FFE2EFDA'];
const STATUS: Record<string, [string, string]> = {
  TERMINÉ: ['FFC6EFCE', 'FF006100'],
  'EN COURS': ['FFFFEB9C', 'FF7F6000'],
  'NON DÉMARRÉ': ['FFEDEDED', 'FF404040'],
  'À RENSEIGNER': ['FFEDEDED', 'FF404040'],
  BLOQUÉ: ['FFFFC7CE', 'FF9C0006'],
  'EN ATTENTE': [C.waitFill, C.black],
  'ATTENTE PHASE SUIVANTE': [C.waitFill, C.black],
};
const WIDTHS = [11.14, 25.71, 47.57, 28.57, 22.86, 9.57, 25.29, 13.29, 17.14, 16.14, 15.29, 19, 18.14, 20, 15.29, 22.86];

// ------------------------------------------------------------------ Helpers
/** Excel dates have no time zone: build them in UTC so they never shift to the previous day. */
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const colName = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const fill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const line = (style: Border['style'], argb: string): Partial<Border> => ({ style, color: { argb } });
const parse = (ref: string) => {
  const [a, b = a] = ref.split(':');
  const p = (x: string) => ({ c: colNum(x.match(/[A-Z]+/)![0]), r: +x.match(/\d+/)![0] });
  return { a: p(a), b: p(b) };
};

interface Style {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bg?: string;
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  nf?: string;
  /** inner grid colour (thin), null = no border */
  grid?: string | null;
  rotate?: number;
  font?: string;
}

/** Merge (if range), write the value and style every cell of the range. */
function put(ws: Worksheet, ref: string, value: unknown, st: Style = {}) {
  const { a, b } = parse(ref);
  if (a.c !== b.c || a.r !== b.r) ws.mergeCells(ref);
  for (let r = a.r; r <= b.r; r++)
    for (let c = a.c; c <= b.c; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: st.font ?? 'Arial', size: st.size ?? 11, bold: st.bold, italic: st.italic, color: { argb: st.color ?? C.black } };
      cell.alignment = { horizontal: st.h ?? 'center', vertical: st.v ?? 'middle', wrapText: st.wrap ?? true, textRotation: st.rotate };
      if (st.bg) cell.fill = fill(st.bg);
      if (st.nf) cell.numFmt = st.nf;
      if (st.grid !== null) {
        const g = line('thin', st.grid ?? C.grid);
        cell.border = { top: g, left: g, bottom: g, right: g } as Partial<Borders>;
      }
    }
  ws.getCell(a.r, a.c).value = value as never;
}

/** Medium (or other) frame around a range, keeping inner borders. */
function frame(ws: Worksheet, ref: string, argb = C.navy, style: Border['style'] = 'medium') {
  const { a, b } = parse(ref);
  const e = line(style, argb);
  for (let c = a.c; c <= b.c; c++) {
    const t = ws.getCell(a.r, c);
    t.border = { ...t.border, top: e } as Partial<Borders>;
    const btm = ws.getCell(b.r, c);
    btm.border = { ...btm.border, bottom: e } as Partial<Borders>;
  }
  for (let r = a.r; r <= b.r; r++) {
    const l = ws.getCell(r, a.c);
    l.border = { ...l.border, left: e } as Partial<Borders>;
    const rt = ws.getCell(r, b.c);
    rt.border = { ...rt.border, right: e } as Partial<Borders>;
  }
}

const H = (ws: Worksheet, r: number, h: number) => (ws.getRow(r).height = h);
const colPx = (c: number) => Math.round((WIDTHS[c - 1] ?? 10) * 7 + 5);
/** Pixel offset from the left of column `c1` -> fractional 0-based column anchor. */
function colAnchor(c1: number, px: number) {
  let c = c1;
  while (px > colPx(c)) {
    px -= colPx(c);
    c++;
  }
  return c - 1 + px / colPx(c);
}

/** Split columns A..P into `n` side-by-side photo slots of (nearly) equal width. */
function photoSlots(n: number): [number, number][] {
  const total = WIDTHS.reduce((t, _, i) => t + colPx(i + 1), 0);
  const slots: [number, number][] = [];
  let start = 1;
  let acc = 0;
  for (let c = 1; c <= 16; c++) {
    acc += colPx(c);
    const target = (total * (slots.length + 1)) / n;
    const remainingCols = 16 - c;
    const remainingSlots = n - slots.length - 1;
    const next = c < 16 ? colPx(c + 1) : 0;
    // close the slot when we are closest to the target (and enough columns are left for the others)
    if (slots.length < n - 1 && (Math.abs(acc - target) <= Math.abs(acc + next - target) || remainingCols <= remainingSlots)) {
      slots.push([start, c]);
      start = c + 1;
    }
  }
  slots.push([start, 16]);
  return slots;
}

async function imageSize(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const s = { w: bmp.width, h: bmp.height };
  bmp.close();
  return s;
}

function section(ws: Worksheet, r: number, ref: string, title: string) {
  put(ws, ref, title, { bold: true, color: C.navy, bg: C.light, h: 'left', grid: null });
  H(ws, r, 24);
}

/** Estimated row height for wrapped text in a given column span (chars per line). */
const fitHeight = (texts: [string, number][], min = 30) => Math.max(min, ...texts.map(([t, w]) => Math.ceil((t.length || 1) / w) * 15 + 6));

// ------------------------------------------------------------------ Day sheet
async function addDaySheet(wb: Workbook, r: DailyReport, s: ReportSettings, all: DailyReport[], style: AnnotationStyle, lookup: EquipLookup) {
  const ws = wb.addWorksheet(sheetName(r.date), {
    pageSetup: {
      paperSize: A3,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.31, right: 0.31, top: 0.5, bottom: 0.5, header: 0.19, footer: 0.19 },
    },
    views: [{ showGridLines: false, zoomScale: 70 }],
  });
  WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = 17; c <= 26; c++) ws.getColumn(c).hidden = true;

  const P = s.reportProjects;
  const E = s.effectifProjects;
  const others = E.filter((p) => !P.includes(p.name));

  // ---------------- Title (row 2)
  H(ws, 2, 56.1);
  H(ws, 3, 6);
  put(ws, 'D2:M2', "RAPPORT JOURNALIER D'AVANCEMENT DES TRAVAUX", { size: 20, bold: true, color: C.navy, grid: null });
  put(ws, 'N2:P2', fromISO(r.date), { size: 14, bold: true, color: C.white, bg: C.navy, nf: '[$-40C]dddd dd mmmm yyyy', grid: null });
  for (let c = 1; c <= 16; c++) ws.getCell(2, c).border = { bottom: line('thick', C.navy) } as Partial<Borders>;
  if (s.headerLogo) {
    const [, mime, b64] = /^data:image\/(\w+);base64,(.*)$/.exec(s.headerLogo) ?? [];
    if (b64) {
      const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const { w, h } = await imageSize(new Blob([bin], { type: `image/${mime}` }));
      const k = Math.min(280 / w, 58 / h);
      const id = wb.addImage({ base64: b64, extension: mime === 'png' ? 'png' : 'jpeg' });
      ws.addImage(id, { tl: { col: 1.05, row: 1 + (74.8 - h * k) / 2 / 74.8 }, ext: { width: Math.round(w * k), height: Math.round(h * k) } });
    }
  }

  // ---------------- Header block (rows 4–10)
  const label = (ref: string, t: string) => {
    put(ws, ref, t, { size: 10, bold: true, color: C.white, bg: C.navy, h: 'left', grid: null });
    frame(ws, ref, C.black);
  };
  const val = (ref: string, v: unknown, extra: Style = {}) => {
    put(ws, ref, v, { size: 11, bold: true, h: 'left', grid: null, ...extra });
    frame(ws, ref, C.black);
  };
  [4, 6, 7, 8, 9, 10].forEach((row) => H(ws, row, 18.95));
  H(ws, 5, 8);
  label('B4:C4', "N° d'affaire");
  val('D4:H4', r.header.affaire);
  label('B6:C6', 'Projets');
  val('D6:H6', r.header.projets);
  label('I6', 'Atelier');
  val('J6', r.header.atelier);
  const matin = E.reduce((t, p) => t + persons(r, p.name, 0), 0);
  const am = E.reduce((t, p) => t + persons(r, p.name, 1), 0);
  label('I7', 'Total matin');
  val('J7', matin);
  label('B8:C8', 'Établi par');
  val('D8:H8', r.header.etabliPar);
  label('I8', 'Total après-midi');
  val('J8', am);
  label('B10:C10', 'Date du rapport');
  val('D10:G10', fromISO(r.date), { bg: C.yellow, nf: 'dd/mm/yyyy' });
  label('I10', 'Révision');
  val('J10', r.header.revision || '00', { bold: false, nf: '@' });

  // ---------------- Synthesis (D12:I…)
  let row = 12;
  H(ws, 11, 10);
  put(ws, `D${row}:I${row}`, "SYNTHÈSE DE L'ÉTAT DES PROJETS – AUJOURD'HUI", { size: 10, bold: true, color: C.navy, bg: C.light });
  H(ws, row++, 24.95);
  ['Projet', 'Effectif matin / après-midi', 'Activités', 'Terminées', 'En cours', 'Éléments en attente'].forEach((t, i) =>
    put(ws, `${colName(4 + i)}${row}`, t, { size: 9, bold: true, color: C.white, bg: C.navy }),
  );
  H(ws, row++, 24.95);
  const tot = [0, 0, 0, 0, 0, 0];
  const NUM = '0;\\-0;"–"';
  const synthRow = (name: string, v: number[], bold: boolean, bg?: string) => {
    put(ws, `D${row}`, name, { size: 10, bold: true, color: C.navy, bg });
    put(ws, `E${row}`, `${v[0]} / ${v[1]}`, { size: 10, bold, color: C.text, bg });
    put(ws, `F${row}`, v[2], { size: 10, bold, color: C.text, nf: NUM, bg });
    put(ws, `G${row}`, v[3], { size: 10, bold, color: 'FF375623', nf: NUM, bg });
    put(ws, `H${row}`, v[4], { size: 10, bold, color: 'FF7F6000', nf: NUM, bg });
    put(ws, `I${row}`, v[5], { size: 10, bold, color: 'FFC55A11', nf: NUM, bg });
    H(ws, row++, 24.95);
  };
  for (const p of P) {
    const x = projectSummary(r, p);
    const v = [persons(r, p, 0), persons(r, p, 1), x.activites, x.terminees, x.enCours, x.attente];
    v.forEach((n, i) => (tot[i] += n));
    synthRow(p, v, false);
  }
  synthRow('TOTAL', tot, true, C.grey);
  const blocked = r.activities.filter((a) => isFilled(a) && statusOf(a) === 'BLOQUÉ').length;
  put(ws, `D${row}:I${row}`, `Taux de réalisation du jour : ${tot[2] ? Math.round((tot[3] / tot[2]) * 100) + '%' : '–'}   |   Éléments bloqués : ${blocked}`, {
    size: 10,
    bold: true,
    italic: true,
    color: C.navy,
  });
  H(ws, row, 24.95);
  frame(ws, `D12:I${row}`);
  row += 1;
  H(ws, row++, 9.95);

  // ---------------- Effectif
  section(ws, row, `B${row}:J${row}`, "EFFECTIF / MAIN-D'ŒUVRE");
  others.slice(0, 2).forEach((p, i) => {
    const lc = i === 0 ? 'L' : 'N';
    const vc = i === 0 ? 'M' : 'O';
    put(ws, `${lc}${row}`, `Heures cumulées ${p.name}`, { size: 9, bold: true, italic: true, color: 'FF404040', h: 'right', grid: null });
    put(ws, `${vc}${row}`, cumulHours(all, s, p.name, r.date), { bold: true, color: C.white, bg: C.green, nf: '0" h"' });
  });
  row++;
  // Columns: template mapping for SMP · PAT · PAP · MHS · MS, else two columns per project from D.
  const template = E.map((p) => p.name).join('|') === 'SMP|PAT|PAP|MHS|MS';
  const cols: { p: (typeof E)[number]; m: string; a: string; head: string; hoursCell?: string }[] = template
    ? [
        { p: E[0], m: 'D', a: 'E', head: 'D:E' },
        { p: E[1], m: 'F', a: 'H', head: 'F:H' },
        { p: E[2], m: 'I', a: 'J', head: 'I:J' },
        { p: E[3], m: 'L', a: 'M', head: 'K:L', hoursCell: 'M' },
        { p: E[4], m: 'N', a: 'O', head: 'N', hoursCell: 'O' },
      ]
    : E.map((p, i) => ({ p, m: colName(4 + i * 2), a: colName(5 + i * 2), head: `${colName(4 + i * 2)}:${colName(5 + i * 2)}` }));
  const lastEffCol = template ? 'O' : colName(3 + E.length * 2);
  const headRow = row;
  put(ws, `B${row}:C${row + 1}`, 'Métier', { bold: true, color: C.white, bg: C.navy });
  for (const c of cols) {
    const [h1, h2] = c.head.split(':');
    put(ws, h2 ? `${h1}${row}:${h2}${row}` : `${h1}${row}`, `Projet : ${c.p.name}`, { bold: true, color: C.white, bg: C.navy });
    if (c.hoursCell) put(ws, `${c.hoursCell}${row}`, hoursOf(r, s, c.p.name), { bold: true, color: C.white, bg: C.navy2, nf: '0" h"' });
    if (template && c.m === 'F') put(ws, `F${row + 1}:G${row + 1}`, c.p.slots[0], { size: 9, color: C.white, bg: C.navy });
    else put(ws, `${c.m}${row + 1}`, c.p.slots[0], { size: 9, color: C.white, bg: C.navy });
    put(ws, `${c.a}${row + 1}`, c.p.slots[1], { size: 9, color: C.white, bg: C.navy });
  }
  if (template) put(ws, `K${row + 1}`, 'ÉQUIPE MHS', { size: 9, bold: true, bg: C.amber });
  H(ws, row, 21.95);
  H(ws, row + 1, 18);
  row += 2;
  const metiers = [...new Set([...s.metiers, ...Object.keys(r.effectif)])];
  metiers.forEach((m, i) => {
    const bg = i % 2 ? C.zebra : undefined;
    put(ws, `B${row}:C${row}`, m, { size: 10, bold: true, color: C.text, bg });
    // empty styled cells for the whole line
    for (let c = 4; c <= colNum(lastEffCol); c++) put(ws, `${colName(c)}${row}`, null, { bg: template && c === 11 ? C.yellow : bg, nf: '0;\\-0;""' });
    for (const c of cols) {
      const v = r.effectif[m]?.[c.p.name] ?? [0, 0];
      if (template && c.m === 'F') {
        put(ws, `F${row}:G${row}`, v[0] || null, { bg, nf: '0;\\-0;""' });
      } else ws.getCell(`${c.m}${row}`).value = v[0] || null;
      ws.getCell(`${c.a}${row}`).value = v[1] || null;
    }
    H(ws, row++, 17.1);
  });
  put(ws, `B${row}:C${row}`, 'TOTAL', { size: 12, bold: true, color: C.navy, bg: C.light });
  for (let c = 4; c <= colNum(lastEffCol); c++) put(ws, `${colName(c)}${row}`, null, { size: 12, bold: true, color: C.navy, bg: C.light, nf: '0;\\-0;"–"' });
  for (const c of cols) {
    if (template && c.m === 'F') {
      put(ws, `F${row}:G${row}`, persons(r, c.p.name, 0), { size: 12, bold: true, color: C.navy, bg: C.light, nf: '0;\\-0;"–"' });
    } else ws.getCell(`${c.m}${row}`).value = persons(r, c.p.name, 0);
    ws.getCell(`${c.a}${row}`).value = persons(r, c.p.name, 1);
  }
  H(ws, row, 21.95);
  frame(ws, `B${headRow}:${lastEffCol}${row}`);
  row++;
  put(ws, `B${row}:P${row}`, `Heures du jour : ${E.map((p) => `${p.name} ${hoursOf(r, s, p.name)} h`).join('  ·  ')}   —   Total ${dayHours(r, s)} h  (${dayPeople(r, s)} personnes)`, {
    size: 9,
    italic: true,
    bold: true,
    color: 'FF404040',
    h: 'left',
    grid: null,
  });
  H(ws, row++, 18);
  H(ws, row++, 12);

  // ---------------- Activities (new printed page, as in the template)
  ws.getRow(row - 1).addPageBreak();
  put(ws, `B${row}:F${row}`, 'TRAVAUX JOURNALIERS – ACTIVITÉS DU JOUR', { bold: true, color: C.navy, bg: C.light, h: 'left', grid: null });
  put(ws, `G${row}`, 'Légende avancement :', { size: 9, bold: true, color: C.navy, bg: C.light, h: 'right', grid: null });
  put(ws, `H${row}`, 'Terminé', { size: 9, bold: true, color: STATUS['TERMINÉ'][1], bg: STATUS['TERMINÉ'][0] });
  put(ws, `I${row}`, 'En cours', { size: 9, bold: true, color: STATUS['EN COURS'][1], bg: STATUS['EN COURS'][0] });
  put(ws, `J${row}`, 'Non démarré', { size: 9, bold: true, color: STATUS['NON DÉMARRÉ'][1], bg: STATUS['NON DÉMARRÉ'][0] });
  put(ws, `K${row}:N${row}`, 'Bloqué / En retard', { size: 9, bold: true, color: STATUS['BLOQUÉ'][1], bg: STATUS['BLOQUÉ'][0] });
  H(ws, row++, 21.95);
  H(ws, row++, 6);
  const hdr: [string, string][] = [
    ['B', 'PROJET'],
    ['C', 'ÉQUIPEMENTS'],
    ['D:E', 'ACTIVITÉS DU JOUR'],
    ['F', 'NBR'],
    ['G', "MAIN-D'ŒUVRE"],
    ['H', 'UNITÉ'],
    ['I', 'QTÉ'],
    ['J', 'AVANCEMENT %'],
    ['K:N', 'PHASE / OBSERVATIONS'],
  ];
  for (const [c, t] of hdr) {
    const [c1, c2] = c.split(':');
    put(ws, c2 ? `${c1}${row}:${c2}${row}` : `${c1}${row}`, t, { bold: true, color: C.white, bg: C.navy });
  }
  H(ws, row, 30);
  frame(ws, `B${row}:N${row}`);
  row++;

  P.forEach((p, pi) => {
    const acts = r.activities.filter((a) => a.projet === p && a.type === 'ACTIVITE' && isFilled(a));
    const waits = r.activities.filter((a) => a.projet === p && a.type === 'ATTENTE' && isFilled(a));
    const start = row;
    const actRow = (a: Activity | null) => {
      const st = a ? statusOf(a) : 'À RENSEIGNER';
      const [sbg, sfg] = STATUS[st] ?? STATUS['À RENSEIGNER'];
      put(ws, `C${row}`, a?.equipement ?? '', { bold: true, color: C.navy });
      put(ws, `D${row}:E${row}`, a?.activite ?? '', { h: 'left' });
      put(ws, `F${row}`, a?.nbr ? +a.nbr || a.nbr : null);
      put(ws, `G${row}`, a?.mo ?? '');
      put(ws, `H${row}`, a?.unite ?? '');
      put(ws, `I${row}`, a?.qte ? +a.qte || a.qte : null);
      put(ws, `J${row}`, a ? (a.avancement === null ? (a.etat !== 'auto' ? a.etat : null) : a.avancement / 100) : null, {
        bold: true,
        nf: '0%;\\-0%;0%;@',
        bg: a ? sbg : undefined,
        color: a ? sfg : C.black,
      });
      put(ws, `K${row}:N${row}`, a?.obs ?? '');
      H(ws, row++, a ? fitHeight([[a.activite, 60], [a.equipement, 38], [a.mo, 28], [a.obs, 70]]) : 21.95);
    };
    if (acts.length) acts.forEach(actRow);
    else actRow(null);

    if (waits.length) {
      const w0 = row;
      waits.forEach((a, k) => {
        const days = parseInt(a.depuis, 10) || 0;
        const [hbg, hfg] = days >= 10 ? ['FFF8CBAD', 'FFC00000'] : days >= 2 ? ['FFFCE4D6', 'FFC55A11'] : [C.waitFill, C.black];
        put(ws, `C${row}`, a.equipement, { bold: true, color: C.navy });
        put(ws, `D${row}:F${row}`, a.activite, { h: 'left', bg: C.waitFill, grid: C.waitLine });
        put(ws, `G${row}`, a.mo || 'Aucune opération prévue', { italic: true, color: C.waitText, bg: C.waitFill, grid: C.waitLine });
        put(ws, `H${row}`, a.depuis, { bold: true, bg: hbg, color: hfg, grid: C.waitLine });
        put(ws, `I${row}`, a.qte, { bg: C.waitFill, grid: C.waitLine });
        put(ws, `J${row}`, null, { bg: C.waitFill, grid: C.waitLine });
        put(ws, `K${row}:N${row}`, a.obs, { bold: true, color: C.waitText, bg: C.waitFill, grid: C.waitLine });
        if (k === 0) for (let c = 3; c <= 14; c++) ws.getCell(row, c).border = { ...ws.getCell(row, c).border, top: line('medium', C.waitTop) } as Partial<Borders>;
        H(ws, row++, fitHeight([[a.activite, 85], [a.obs, 70], [a.equipement, 38]], 24));
      });
      put(ws, `A${w0}:A${row - 1}`, 'ÉLÉMENTS EN ATTENTE', { size: row - w0 > 2 ? 12 : 8, bold: true, bg: C.amber, rotate: 90 });
      frame(ws, `A${w0}:A${row - 1}`, C.black);
    }
    put(ws, `B${start}:B${row - 1}`, p, { size: row - start > 1 ? 20 : 14, bold: true, color: C.navy, bg: PROJECT_FILLS[pi % PROJECT_FILLS.length] });
    frame(ws, `B${start}:N${row - 1}`);
  });
  H(ws, row++, 12);

  // ---------------- Next day / problems / HSE
  section(ws, row, `B${row}:N${row}`, 'SUITE DES TRAVAUX, PROBLÈMES & HSE');
  row++;
  const nTop = row;
  put(ws, `B${row}:C${row}`, 'PROJET', { size: 10, bold: true, color: C.white, bg: C.navy });
  put(ws, `D${row}:I${row}`, 'ACTIVITÉS PRÉVUES – PROCHAIN JOUR OUVRÉ', { size: 10, bold: true, color: C.white, bg: C.navy });
  put(ws, `J${row}:N${row}`, 'PROBLÈMES / ACTION CLIENT REQUISE', { size: 10, bold: true, color: C.white, bg: C.navy });
  H(ws, row++, 21.95);
  for (const p of P) {
    put(ws, `B${row}:C${row}`, p, { size: 12, bold: true, color: C.navy, bg: C.grey });
    put(ws, `D${row}:I${row}`, r.next[p] ?? '', { h: 'left', v: 'top' });
    put(ws, `J${row}:N${row}`, r.problems[p] ?? '', { h: 'left', v: 'top' });
    H(ws, row++, fitHeight([[r.next[p] ?? '', 110], [r.problems[p] ?? '', 90]], 39.95));
  }
  frame(ws, `B${nTop}:N${row - 1}`);
  H(ws, row++, 8.1);
  const hseTop = row;
  (
    [
      ['B:C', 'HSE & QUALITÉ'],
      ['D:F', 'Accidents avec arrêt'],
      ['G:H', "Presqu'accidents / observations"],
      ['I', 'Contrôles CQ'],
      ['J', 'NC émises'],
      ['K:N', 'Remarques HSE / qualité'],
    ] as const
  ).forEach(([c, t]) => {
    const [c1, c2] = c.split(':');
    put(ws, c2 ? `${c1}${row}:${c2}${row}` : `${c1}${row}`, t, { size: 9, bold: true, color: C.white, bg: C.navy });
  });
  H(ws, row++, 21.95);
  const alert = (n: number): Style => (n > 0 ? { bg: 'FFF8CBAD', color: 'FFC00000' } : {});
  put(ws, `B${row}:C${row}`, "Aujourd'hui", { size: 10, bold: true, color: C.navy, bg: C.grey });
  put(ws, `D${row}:F${row}`, r.hse.accidents, { size: 12, bold: true, ...alert(r.hse.accidents) });
  put(ws, `G${row}:H${row}`, r.hse.presqu, { size: 12, bold: true, ...alert(r.hse.presqu) });
  put(ws, `I${row}`, r.hse.cq, { size: 12, bold: true });
  put(ws, `J${row}`, r.hse.nc, { size: 12, bold: true, ...alert(r.hse.nc) });
  put(ws, `K${row}:N${row}`, r.hse.remarques, { h: 'left' });
  H(ws, row, 30);
  frame(ws, `B${hseTop}:N${row}`);
  row++;
  H(ws, row++, 14.1);

  // ---------------- Photo report (2, 3 or 4 large photos per row, 4K images)
  const photoTop = row;
  put(ws, `A${row}:P${row}`, 'REPORTAGE PHOTOGRAPHIQUE', { size: 14, bold: true, color: C.white, bg: C.navy, grid: null });
  H(ws, row++, 26.1);
  const perRow = s.excelPhotosPerRow ?? 2;
  const SLOTS = photoSlots(perRow);
  // Excel rows are limited to 409 pt: 2 per row = very large photos.
  // Excel rows are limited to 409 pt: in 2-per-row mode each photo spans 2 rows to fill its wide slot.
  const rowPt = perRow === 2 ? 345 : perRow === 3 ? 300 : 200.1;
  const span = perRow === 2 ? 2 : 1;
  const areaPx = (span * rowPt * 4) / 3;
  for (const p of [...P, '']) {
    const list = r.photos.filter((ph) => (r.activities.find((a) => a.id === ph.activityId)?.projet ?? '') === p);
    if (!list.length) continue;
    put(ws, `A${row}:P${row}`, p || 'AUTRES PHOTOS', { size: 13, bold: true, italic: true, color: C.navy, bg: C.light, grid: C.photoGrid });
    H(ws, row++, 21.95);
    for (let i = 0; i < list.length; i += perRow) {
      const imgRow = row;
      for (let k = 0; k < span; k++) H(ws, imgRow + k, rowPt);
      const capRow = imgRow + span;
      H(ws, capRow, 30);
      for (let k = 0; k < perRow; k++) {
        const [c1, c2] = SLOTS[k];
        const ph = list[i + k];
        put(ws, `${colName(c1)}${imgRow}:${colName(c2)}${capRow - 1}`, null, { italic: true, color: 'FF9E9E9E', bg: C.white, grid: C.photoGrid });
        put(ws, `${colName(c1)}${capRow}:${colName(c2)}${capRow}`, ph?.caption ?? null, { size: 10, bold: true, color: C.text, bg: C.caption, grid: C.photoGrid });
        if (!ph) continue;
        // HD rendering from the original, with Projet / Désignation / Repère / Tâche of its activity line.
        let hd: Awaited<ReturnType<typeof reportPhotoHD>>;
        try {
          const act = r.activities.find((a) => a.id === ph.activityId);
          hd = await reportPhotoHD(ph, ph.annotate ? photoFields(ph, act, r, lookup) : null, style);
        } catch {
          continue;
        }
        const slotW = Array.from({ length: c2 - c1 + 1 }, (_, j) => colPx(c1 + j)).reduce((t, x) => t + x, 0);
        const boxH = areaPx - 12;
        const sc = Math.min((slotW - 16) / hd.width, boxH / hd.height);
        const w = Math.round(hd.width * sc);
        const h = Math.round(hd.height * sc);
        const id = wb.addImage({ buffer: (await hd.blob.arrayBuffer()) as never, extension: 'jpeg' });
        ws.addImage(id, { tl: { col: colAnchor(c1, (slotW - w) / 2), row: imgRow - 1 + ((6 + (boxH - h) / 2) / areaPx) * span }, ext: { width: w, height: h } });
      }
      row = capRow + 1;
    }
  }
  if (row > photoTop + 1) ws.getRow(photoTop - 1).addPageBreak();

  // ---------------- Validation
  H(ws, row++, 12);
  section(ws, row, `B${row}:N${row}`, 'VALIDATION DU RAPPORT');
  row++;
  const vTop = row;
  put(ws, `B${row}:F${row}`, 'ÉTABLI PAR – PROMINOX', { size: 10, bold: true, color: C.white, bg: C.navy });
  put(ws, `G${row}:J${row}`, 'VÉRIFIÉ PAR – PROMINOX', { size: 10, bold: true, color: C.white, bg: C.navy });
  put(ws, `K${row}:N${row}`, 'ACCUSÉ DE RÉCEPTION CLIENT', { size: 10, bold: true, color: C.white, bg: C.navy });
  H(ws, row++, 21.95);
  put(ws, `B${row}:F${row}`, `Nom : ${r.header.etabliPar}`, { size: 10, bold: true, color: C.text, h: 'left' });
  put(ws, `G${row}:J${row}`, `Nom : ${r.header.verifiePar}`, { size: 10, color: C.muted, h: 'left' });
  put(ws, `K${row}:N${row}`, 'Nom :', { size: 10, color: C.muted, h: 'left' });
  H(ws, row++, 30);
  ['B:F', 'G:J', 'K:N'].forEach((c) => put(ws, `${c.split(':')[0]}${row}:${c.split(':')[1]}${row}`, 'Signature :', { size: 10, color: C.muted, h: 'left', v: 'top' }));
  H(ws, row++, 30);
  put(ws, `B${row}:F${row}`, `Date : ${frDate(r.date)}`, { size: 10, color: C.muted, h: 'left' });
  put(ws, `G${row}:J${row}`, 'Date :', { size: 10, color: C.muted, h: 'left' });
  put(ws, `K${row}:N${row}`, 'Date :', { size: 10, color: C.muted, h: 'left' });
  H(ws, row, 20.1);
  frame(ws, `B${vTop}:N${row}`);

  ws.pageSetup.printArea = `A1:P${row}`;
}

// ------------------------------------------------------------------ Week summaries (same palette)
function titleRow(ws: Worksheet, ref: string, t: string) {
  put(ws, ref, t, { size: 14, bold: true, color: C.white, bg: C.navy, h: 'left', grid: null });
  ws.getRow(parse(ref).a.r).height = 26;
}
const th = (ws: Worksheet, ref: string, t: string) => put(ws, ref, t, { size: 10, bold: true, color: C.white, bg: C.navy });

function addRecapWeek(wb: Workbook, reports: DailyReport[], s: ReportSettings, title: string) {
  const ws = wb.addWorksheet('RECAP_SEMAINE', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], pageSetup: { paperSize: A3, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  [12, 9, 44, 11, 46, 7, 28, 10, 9, 12, 22, 32].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  titleRow(ws, 'A1:L1', `RÉCAPITULATIF HEBDOMADAIRE – PROJETS, ÉQUIPEMENTS & ACTIVITÉS — ${title}`);
  const acts = reports.flatMap((r) => r.activities.filter((a) => a.type === 'ACTIVITE' && isFilled(a)));
  const done = acts.filter((a) => statusOf(a) === 'TERMINÉ').length;
  put(
    ws,
    'A2:L2',
    `Activités : ${acts.length}   ·   Terminées : ${done}   ·   En cours : ${acts.filter((a) => statusOf(a) === 'EN COURS').length}   ·   Taux de réalisation : ${acts.length ? Math.round((done / acts.length) * 100) : 0}%   ·   Heures : ${reports.reduce((t, r) => t + dayHours(r, s), 0)} h`,
    { bold: true, color: C.navy, bg: C.light, h: 'left', grid: null },
  );
  ['Date', 'Projet', 'Équipement', 'Type', 'Activité / élément', 'NBR', "Main-d'œuvre", 'Unité', 'Qté', 'Avancement', 'Statut', 'Phase / observations'].forEach((h, i) => th(ws, `${colName(i + 1)}4`, h));
  let row = 5;
  for (const r of reports)
    for (const a of r.activities.filter(isFilled)) {
      const st = statusOf(a);
      const [bg, fg] = STATUS[st] ?? STATUS['À RENSEIGNER'];
      const v = [fromISO(r.date), a.projet, a.equipement, a.type === 'ATTENTE' ? 'ATTENTE' : 'ACTIVITÉ', a.activite, a.nbr, a.mo, a.type === 'ATTENTE' ? a.depuis : a.unite, a.qte, a.avancement === null ? '' : a.avancement / 100, st, a.obs];
      v.forEach((x, i) =>
        put(ws, `${colName(i + 1)}${row}`, x === '' ? null : x, {
          size: 10,
          h: [2, 4, 6, 11].includes(i) ? 'left' : 'center',
          nf: i === 0 ? 'dd/mm/yyyy' : i === 9 ? '0%' : undefined,
          bg: i === 10 || i === 9 ? bg : a.type === 'ATTENTE' ? C.waitFill : undefined,
          color: i === 10 ? fg : i === 2 ? C.navy : C.black,
          bold: i === 10 || i === 2,
        }),
      );
      row++;
    }
  ws.autoFilter = { from: 'A4', to: `L${Math.max(5, row - 1)}` };
}

function addRecapEffectif(wb: Workbook, reports: DailyReport[], s: ReportSettings, days: string[], title: string, all: DailyReport[]) {
  const ws = wb.addWorksheet('RECAP_EFFECTIF', { views: [{ showGridLines: false }], pageSetup: { paperSize: A3, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.getColumn(1).width = 28;
  for (let i = 2; i <= days.length + 3; i++) ws.getColumn(i).width = 14;
  const last = colName(days.length + 3);
  titleRow(ws, `A1:${last}1`, `RÉCAPITULATIF HEBDOMADAIRE – EFFECTIF / MAIN-D'ŒUVRE — ${title}`);
  const hours = reports.reduce((t, r) => t + dayHours(r, s), 0);
  const hj = reports.reduce((t, r) => t + dayPeople(r, s), 0);
  put(ws, `A2:${last}2`, `Jours enregistrés : ${reports.length}   ·   Hommes-jours : ${hj}   ·   Heures : ${hours} h   ·   Effectif moyen / jour : ${reports.length ? Math.round(hj / reports.length) : 0}`, {
    bold: true,
    color: C.navy,
    bg: C.light,
    h: 'left',
    grid: null,
  });
  th(ws, 'A4', 'Métier');
  days.forEach((d, i) => put(ws, `${colName(i + 2)}4`, fromISO(d), { size: 10, bold: true, color: C.white, bg: C.navy, nf: 'ddd dd/mm' }));
  th(ws, `${colName(days.length + 2)}4`, 'Hommes-jours');
  th(ws, `${colName(days.length + 3)}4`, 'Heures');
  let row = 5;
  const byDay = (d: string) => reports.find((r) => r.date === d);
  const metiers = [...new Set([...s.metiers, ...reports.flatMap((r) => Object.keys(r.effectif))])];
  metiers.forEach((m, idx) => {
    const bg = idx % 2 ? C.zebra : undefined;
    put(ws, `A${row}`, m, { size: 10, bold: true, color: C.text, h: 'left', bg });
    let n = 0,
      h = 0;
    days.forEach((d, i) => {
      const r = byDay(d);
      if (r) {
        n += metierPeople(r, m);
        h += metierHours(r, s, m);
      }
      put(ws, `${colName(i + 2)}${row}`, r ? metierPeople(r, m) : null, { bg, nf: '0;\\-0;""' });
    });
    put(ws, `${colName(days.length + 2)}${row}`, n, { bold: true, bg, nf: '0;\\-0;""' });
    put(ws, `${colName(days.length + 3)}${row}`, h, { bold: true, bg, nf: '0" h";\\-0;""' });
    row++;
  });
  put(ws, `A${row}`, 'TOTAL', { size: 12, bold: true, color: C.navy, bg: C.light });
  days.forEach((d, i) => put(ws, `${colName(i + 2)}${row}`, byDay(d) ? dayPeople(byDay(d)!, s) : null, { size: 12, bold: true, color: C.navy, bg: C.light }));
  put(ws, `${colName(days.length + 2)}${row}`, hj, { size: 12, bold: true, color: C.navy, bg: C.light });
  put(ws, `${colName(days.length + 3)}${row}`, hours, { size: 12, bold: true, color: C.white, bg: C.green, nf: '0" h"' });
  frame(ws, `A4:${last}${row}`);
  row += 2;
  const pTop = row;
  ['Projet', 'Hommes-jours', 'Heures', 'Heures cumulées', 'Heures / ½ journée'].forEach((t, i) => th(ws, `${colName(i + 1)}${row}`, t));
  row++;
  const lastDate = reports.length ? reports[reports.length - 1].date : days[days.length - 1];
  for (const p of s.effectifProjects) {
    put(ws, `A${row}`, p.name, { bold: true, color: C.navy });
    put(ws, `B${row}`, reports.reduce((t, r) => t + peopleOf(r, p.name), 0));
    put(ws, `C${row}`, reports.reduce((t, r) => t + hoursOf(r, s, p.name), 0), { nf: '0" h"' });
    put(ws, `D${row}`, cumulHours(all, s, p.name, lastDate), { bold: true, color: C.white, bg: C.green, nf: '0" h"' });
    put(ws, `E${row}`, `${p.hours[0]} h + ${p.hours[1]} h`, { size: 10 });
    row++;
  }
  frame(ws, `A${pTop}:E${row - 1}`);
}

function addHistory(wb: Workbook, all: DailyReport[], s: ReportSettings) {
  const ws = wb.addWorksheet('HISTORIQUE', { views: [{ state: 'frozen', ySplit: 2, showGridLines: false }] });
  [12, 9, 44, 11, 46, 12, 22, 12, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  titleRow(ws, 'A1:I1', 'HISTORIQUE — une ligne par activité et par jour, depuis le premier rapport');
  ['Date', 'Projet', 'Équipement', 'Type', 'Activité / élément', 'Avancement', 'Statut', 'Effectif jour', 'Heures jour'].forEach((h, i) => th(ws, `${colName(i + 1)}2`, h));
  let row = 3;
  for (const r of all)
    for (const a of r.activities.filter(isFilled)) {
      const st = statusOf(a);
      const [bg, fg] = STATUS[st] ?? STATUS['À RENSEIGNER'];
      [fromISO(r.date), a.projet, a.equipement, a.type, a.activite, a.avancement === null ? null : a.avancement / 100, st, dayPeople(r, s), dayHours(r, s)].forEach((x, i) =>
        put(ws, `${colName(i + 1)}${row}`, x, {
          size: 10,
          h: i === 2 || i === 4 ? 'left' : 'center',
          nf: i === 0 ? 'dd/mm/yyyy' : i === 5 ? '0%' : i === 8 ? '0" h"' : undefined,
          bg: i === 6 ? bg : undefined,
          color: i === 6 ? fg : C.black,
          bold: i === 6,
        }),
      );
      row++;
    }
  ws.autoFilter = { from: 'A2', to: `I${Math.max(3, row - 1)}` };
}

// ------------------------------------------------------------------ Entry points
async function newWorkbook(author: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = author || 'Industrial Photo Annotator';
  wb.created = new Date();
  return wb;
}

async function save(wb: Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export async function exportDay(r: DailyReport, s: ReportSettings, all: DailyReport[], style: AnnotationStyle, lookup: EquipLookup) {
  const wb = await newWorkbook(r.header.etabliPar);
  await addDaySheet(wb, r, s, all, style, lookup);
  await save(wb, `Daily Report ${sheetName(r.date)}.xlsx`);
}

export async function exportWeek(reports: DailyReport[], s: ReportSettings, style: AnnotationStyle, lookup: EquipLookup, days: string[], week: number, all: DailyReport[], user: string) {
  const wb = await newWorkbook(reports[0]?.header.etabliPar ?? user);
  const title = `Semaine ${week} (${frDate(days[0])} → ${frDate(days[days.length - 1])})`;
  for (const r of reports) await addDaySheet(wb, r, s, all, style, lookup);
  addRecapWeek(wb, reports, s, title);
  addRecapEffectif(wb, reports, s, days, title, all);
  addHistory(wb, all.filter((r) => r.date <= days[days.length - 1]), s);
  await save(wb, `Daily Report ${sanitizeFilename(user, 20)} Semaine ${week}.xlsx`);
}
