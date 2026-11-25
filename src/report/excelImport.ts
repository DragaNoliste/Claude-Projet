/**
 * Import of existing "Daily Report dd-mm-yyyy.xlsx" files (site template).
 * Blocks are located by their titles, not by fixed rows, so shifted sheets still work.
 * Photos placed in cells (Excel "image in cell" / rich data) are imported too.
 */
import JSZip from 'jszip';
import type { Activity, DailyReport, ReportSettings } from './types';
import { emptyEffectif, newActivity, newReport } from './logic';
import { storeRawPhoto } from './photos';

type Cells = Map<string, string | { vm: number }>;
interface SheetData {
  name: string;
  date: string;
  cells: Cells;
  merges: { c1: number; r1: number; c2: number; r2: number }[];
  maxRow: number;
}

const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colStr = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

export interface ImportPreview {
  /** Company logo found in the sheet header (data URL). */
  logo?: string;
  sheets: { name: string; date: string; activities: number; waiting: number; photos: number; people: number }[];
  run: (dates: string[], ownerId: string, s: ReportSettings, existing: DailyReport[]) => Promise<DailyReport[]>;
}

export async function readDailyWorkbook(file: File): Promise<ImportPreview> {
  const zip = await JSZip.loadAsync(file);
  const rd = (p: string) => zip.file(p)?.async('string') ?? Promise.resolve(undefined);
  const ss: string[] = [];
  const sx = await rd('xl/sharedStrings.xml');
  if (sx) for (const m of sx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));

  // ---- images in cells: vm (1-based) -> media path
  const meta = (await rd('xl/metadata.xml')) ?? '';
  const fut = [...(meta.match(/<futureMetadata name="XLRICHVALUE"[\s\S]*?<\/futureMetadata>/)?.[0] ?? '').matchAll(/rvb i="(\d+)"/g)].map((m) => +m[1]);
  const vmBk = [...(meta.match(/<valueMetadata[\s\S]*?<\/valueMetadata>/)?.[0] ?? '').matchAll(/<bk>\s*<rc t="\d+" v="(\d+)"/g)].map((m) => +m[1]);
  const rv = [...((await rd('xl/richData/rdrichvalue.xml')) ?? '').matchAll(/<rv [^>]*>([\s\S]*?)<\/rv>/g)].map((m) => [...m[1].matchAll(/<v[^>]*>([\s\S]*?)<\/v>/g)].map((x) => x[1]));
  const relIds = [...((await rd('xl/richData/richValueRel.xml')) ?? '').matchAll(/r:id="([^"]+)"/g)].map((m) => m[1]);
  const relT: Record<string, string> = {};
  for (const m of ((await rd('xl/richData/_rels/richValueRel.xml.rels')) ?? '').matchAll(/<Relationship [^>]*>/g)) {
    const id = m[0].match(/Id="([^"]+)"/)?.[1];
    const t = m[0].match(/Target="([^"]+)"/)?.[1];
    if (id && t) relT[id] = 'xl/' + t.replace(/^\.\.\//, '').replace(/^\/xl\//, '');
  }
  const vmToMedia = (vm: number) => {
    const rvi = fut[vmBk[vm - 1]];
    const rel = relIds[+(rv[rvi]?.[0] ?? -1)];
    return rel ? relT[rel] : undefined;
  };

  // ---- sheets named like dates
  const wb = (await rd('xl/workbook.xml')) ?? '';
  const rels = (await rd('xl/_rels/workbook.xml.rels')) ?? '';
  const sheets: SheetData[] = [];
  for (const m of wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const name = dec(m[1]);
    const dm = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(name.trim());
    if (!dm) continue;
    const target = rels.match(new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${m[2]}"`))?.[1];
    if (!target) continue;
    const x = await rd(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    if (!x) continue;
    const cells: Cells = new Map();
    let maxRow = 0;
    for (const c of x.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = c[2].match(/ t="(\w+)"/)?.[1];
      const vm = c[2].match(/ vm="(\d+)"/)?.[1];
      const body = c[3] ?? '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val: string | { vm: number } = v === undefined ? '' : t === 's' ? ss[+v] ?? '' : dec(v);
      if (t === 'inlineStr') val = dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((y) => y[1]).join(''));
      if (vm) val = { vm: +vm };
      if (val === '' || (typeof val === 'string' && val.startsWith('#'))) continue;
      cells.set(c[1], val);
      maxRow = Math.max(maxRow, +c[1].match(/\d+/)![0]);
    }
    const merges = [...x.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map((g) => ({ c1: colNum(g[1]), r1: +g[2], c2: colNum(g[3]), r2: +g[4] }));
    sheets.push({ name, date: `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`, cells, merges, maxRow });
  }
  if (!sheets.length) throw new Error('Aucune feuille datée (ex. 24-11-2026) trouvée dans ce fichier.');

  // ---- company logo: picture anchored at the top of a dated sheet (rows 1–3)
  let logo: string | undefined;
  for (const m of wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    if (logo || !/^\d{1,2}[-./]\d{1,2}[-./]\d{4}$/.test(dec(m[1]).trim())) continue;
    const target = rels.match(new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`))?.[1];
    if (!target) continue;
    const sheetFile = (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/').pop()!;
    const sRels = await rd(`xl/worksheets/_rels/${sheetFile}.rels`);
    const drawing = sRels?.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/)?.[1];
    if (!drawing) continue;
    const dx = await rd(`xl/drawings/${drawing}`);
    const dRels = await rd(`xl/drawings/_rels/${drawing}.rels`);
    if (!dx || !dRels) continue;
    for (const a of dx.matchAll(/<xdr:(?:oneCellAnchor|twoCellAnchor)[\s\S]*?<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g)) {
      const row0 = +(a[0].match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1] ?? 99);
      const embed = a[0].match(/r:embed="([^"]+)"/)?.[1];
      if (row0 > 2 || !embed) continue;
      const media = dRels.match(new RegExp(`Id="${embed}"[^>]*Target="([^"]+)"`))?.[1];
      const file = media && zip.file(`xl/${media.replace(/^\.\.\//, '')}`);
      if (!file) continue;
      const ext = (media.split('.').pop() ?? 'png').toLowerCase();
      logo = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${await file.async('base64')}`;
      break;
    }
  }

  const parsed = sheets.map((sh) => parseSheet(sh));
  return {
    logo,
    sheets: parsed.map((p) => ({
      name: p.sheet.name,
      date: p.sheet.date,
      activities: p.acts.filter((a) => a.type === 'ACTIVITE').length,
      waiting: p.acts.filter((a) => a.type === 'ATTENTE').length,
      photos: p.photos.length,
      people: Object.values(p.eff).reduce((t, row) => t + Object.values(row).reduce((u, v) => u + Math.max(v[0], v[1]), 0), 0),
    })),
    run: async (dates, ownerId, s, existing) => {
      const out: DailyReport[] = [];
      for (const p of parsed.filter((x) => dates.includes(x.sheet.date))) {
        const prev = existing.find((r) => r.date === p.sheet.date);
        const r = newReport(ownerId, p.sheet.date, s, { ...s.header, ...p.header });
        if (prev) r.createdAt = prev.createdAt;
        // effectif: keep the app's trades + any found in the file
        r.effectif = emptyEffectif(s);
        for (const [m, row] of Object.entries(p.eff)) r.effectif[m] = { ...(r.effectif[m] ?? {}), ...row };
        // map file project names to the report blocks (case-insensitive)
        const proj = (x: string) => s.reportProjects.find((y) => norm(y) === norm(x)) ?? x;
        r.activities = p.acts.map((a) => ({ ...a, projet: proj(a.projet) }));
        for (const k of Object.keys(p.next)) r.next[proj(k)] = p.next[k];
        for (const k of Object.keys(p.problems)) r.problems[proj(k)] = p.problems[k];
        r.hse = { ...r.hse, ...p.hse };
        for (const ph of p.photos) {
          const media = vmToMedia(ph.vm);
          if (!media) continue;
          // One stored copy per occurrence: removing a photo never breaks another one.
          const blob = await zip.file(media)?.async('blob');
          if (!blob) continue;
          const stored = await storeRawPhoto(blob);
          const act = r.activities.find((a) => a.activite.trim() === ph.caption.trim()) ?? null;
          // Photos of the site reports usually already carry their text: not re-annotated by default.
          r.photos.push({ ...stored, caption: ph.caption, activityId: act?.id ?? null, annotate: false });
        }
        out.push(r);
      }
      return out;
    },
  };
}

function parseSheet(sh: SheetData) {
  const { cells, merges } = sh;
  const S = (ref: string) => {
    const v = cells.get(ref);
    return typeof v === 'string' ? v.trim() : '';
  };
  const at = (c: number, r: number) => S(`${colStr(c)}${r}`);
  const findRow = (col: number, re: RegExp, from = 1, to = sh.maxRow) => {
    for (let r = from; r <= to; r++) if (re.test(norm(at(col, r)))) return r;
    return -1;
  };
  /** First non-empty value to the right of a label. */
  const rightOf = (re: RegExp) => {
    for (let r = 1; r <= 12; r++)
      for (let c = 1; c <= 12; c++)
        if (re.test(norm(at(c, r)))) {
          for (let k = c + 1; k <= c + 6; k++) if (at(k, r)) return at(k, r);
        }
    return '';
  };

  const header = {
    affaire: rightOf(/^N.? D.?AFFAIRE/),
    projets: rightOf(/^PROJETS$/),
    atelier: rightOf(/^ATELIER$/),
    etabliPar: rightOf(/^ETABLI PAR$/),
    revision: rightOf(/^REVISION$/) || '00',
    verifiePar: '',
  };
  const blockOrder = header.projets.split(/[-–,/ ]+/).filter(Boolean);

  // ---------------- Effectif
  const eff: Record<string, Record<string, [number, number]>> = {};
  const r0 = findRow(2, /^METIER$/);
  if (r0 > 0) {
    const projCols: { name: string; col: number }[] = [];
    for (let c = 3; c <= 20; c++) {
      const m = /^PROJET\s*:\s*(.+)$/i.exec(at(c, r0));
      if (m) projCols.push({ name: m[1].trim(), col: c });
    }
    const slotCols: number[] = [];
    for (let c = 3; c <= 20; c++) if (/\d{1,2}[:h]\d{2}\s*[–-]\s*\d{1,2}[:h]\d{2}/.test(at(c, r0 + 1))) slotCols.push(c);
    const pairs = projCols.map((p, i) => {
      const end = projCols[i + 1]?.col ?? 99;
      const own = slotCols.filter((c) => c >= p.col && c < end);
      return { name: p.name, cols: [own[0], own[1]] as [number | undefined, number | undefined] };
    });
    for (let r = r0 + 2; r <= r0 + 40; r++) {
      const m = at(2, r);
      if (!m) continue;
      if (/^TOTAL/.test(norm(m))) break;
      eff[m] = {};
      for (const p of pairs) {
        const num = (c?: number) => (c ? +(cells.get(`${colStr(c)}${r}`) as string) || 0 : 0);
        eff[m][p.name] = [num(p.cols[0]), num(p.cols[1])];
      }
    }
  }

  // ---------------- Activities
  const acts: Activity[] = [];
  const hRow = findRow(4, /ACTIVITES DU JOUR/);
  const endRow = findRow(2, /SUITE DES TRAVAUX/, Math.max(1, hRow));
  if (hRow > 0) {
    const last = endRow > 0 ? endRow - 1 : hRow + 80;
    const bBlocks = merges.filter((g) => g.c1 === 2 && g.r1 > hRow && g.r1 <= last && g.r2 > g.r1).sort((a, b) => a.r1 - b.r1);
    const waitBlocks = merges.filter((g) => g.c1 === 1 && g.r1 > hRow && g.r1 <= last && /EN ATTENTE/.test(norm(at(1, g.r1))));
    const projectOf = (r: number) => {
      const i = bBlocks.findIndex((g) => r >= g.r1 && r <= g.r2);
      if (i < 0) return blockOrder[0] ?? 'PROJET';
      return at(2, bBlocks[i].r1) || blockOrder[i] || `PROJET ${i + 1}`;
    };
    for (let r = hRow + 1; r <= last; r++) {
      const d = at(4, r);
      if (!d) continue;
      const waiting = waitBlocks.some((g) => r >= g.r1 && r <= g.r2);
      const a = newActivity(projectOf(r), waiting ? 'ATTENTE' : 'ACTIVITE');
      a.equipement = at(3, r);
      a.activite = d;
      a.obs = at(11, r);
      if (waiting) {
        a.mo = /aucune/i.test(at(7, r)) ? '' : at(7, r);
        a.depuis = at(8, r);
        a.qte = at(9, r);
      } else {
        a.nbr = at(6, r);
        a.mo = at(7, r);
        a.unite = at(8, r);
        a.qte = at(9, r);
        const j = at(10, r);
        const n = parseFloat(j.replace(',', '.'));
        if (Number.isFinite(n)) a.avancement = Math.round((n <= 1 ? n * 100 : n) * 10) / 10;
        else if (/TERMIN/i.test(j)) a.avancement = 100;
        else if (/COURS/i.test(j)) a.etat = 'EN COURS';
        else if (/BLOQ/i.test(j)) a.etat = 'BLOQUÉ';
        else if (/NON/i.test(j)) a.etat = 'NON DÉMARRÉ';
      }
      acts.push(a);
    }
  }

  // ---------------- Next day / problems / HSE
  const next: Record<string, string> = {};
  const problems: Record<string, string> = {};
  const nRow = findRow(4, /ACTIVITES PREVUES/);
  if (nRow > 0)
    for (let r = nRow + 1; r <= nRow + 8; r++) {
      const p = at(2, r);
      if (!p || /HSE/.test(norm(p))) break;
      next[p] = at(4, r);
      problems[p] = at(10, r);
    }
  const hseRow = findRow(2, /^AUJOURD.?HUI$/);
  const num = (c: number) => (hseRow > 0 ? +at(c, hseRow) || 0 : 0);
  const hse = { accidents: num(4), presqu: num(7), cq: num(9), nc: num(10), remarques: hseRow > 0 ? at(11, hseRow) : '' };

  // ---------------- Photos (image cells after "REPORTAGE PHOTOGRAPHIQUE")
  const pRow = findRow(1, /REPORTAGE PHOTO/);
  const photos: { vm: number; caption: string; r: number; c: number }[] = [];
  if (pRow > 0)
    for (const [ref, v] of cells) {
      if (typeof v !== 'object') continue;
      const r = +ref.match(/\d+/)![0];
      if (r < pRow) continue;
      const c = colNum(ref.match(/[A-Z]+/)![0]);
      let caption = '';
      for (let k = r + 1; k <= r + 4 && !caption; k++) {
        const t = at(c, k);
        if (blockOrder.some((p) => norm(p) === norm(t)) || /^(SMP|PAP|PAT)$/.test(norm(t))) break; // next section title, not a caption
        caption = t;
      }
      photos.push({ vm: v.vm, caption, r, c });
    }
  photos.sort((a, b) => a.r - b.r || a.c - b.c); // report order: row by row

  return { sheet: sh, header, eff, acts, next, problems, hse, photos };
}
