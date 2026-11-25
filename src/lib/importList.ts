/**
 * Import of equipment lists from Excel (.xlsx), CSV / TXT files or text copied from Excel.
 *
 * Expected layout (same as the site spreadsheets) — extra columns are ignored:
 *
 *   CHEMITECS                                   <- group title (a row with a single cell)
 *   No.   Tank Name                 Client Tag  <- header row (optional, used to find the columns)
 *   5553  INTER ACID TOWER TRAIN B  LEVEL 1     <- items
 *   ...
 *   MS HOPPERS                                  <- next group
 */
import JSZip from 'jszip';
import type { EquipmentGroup, EquipmentItem } from './projectList';

type Rows = string[][];

// ------------------------------------------------------------------ Text / CSV
function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 30).join('\n');
  if (sample.includes('\t')) return '\t';
  const semi = (sample.match(/;/g) ?? []).length;
  const comma = (sample.match(/,/g) ?? []).length;
  return semi >= comma && semi > 0 ? ';' : ',';
}

/** RFC-4180-ish parser (quotes, escaped quotes, newlines inside quotes). */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): Rows {
  const rows: Rows = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ------------------------------------------------------------------ XLSX (Office Open XML)
function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const textOf = (el: Element) => Array.from(el.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');

export async function readXlsx(data: Blob | ArrayBuffer): Promise<{ sheet: string; rows: Rows }[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => zip.file(path)?.async('string');

  const shared: string[] = [];
  const ss = await read('xl/sharedStrings.xml');
  if (ss) for (const si of Array.from(xml(ss).getElementsByTagName('si'))) shared.push(textOf(si));

  const wb = await read('xl/workbook.xml');
  const relsXml = await read('xl/_rels/workbook.xml.rels');
  if (!wb || !relsXml) throw new Error('Fichier Excel invalide');
  const rels = new Map(Array.from(xml(relsXml).getElementsByTagName('Relationship')).map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']));

  const out: { sheet: string; rows: Rows }[] = [];
  for (const s of Array.from(xml(wb).getElementsByTagName('sheet'))) {
    const target = rels.get(s.getAttribute('r:id')) ?? '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const sheetXml = await read(path);
    if (!sheetXml) continue;
    const rows: Rows = [];
    for (const r of Array.from(xml(sheetXml).getElementsByTagName('row'))) {
      const row: string[] = [];
      for (const c of Array.from(r.getElementsByTagName('c'))) {
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        const value = t === 's' ? (shared[+v] ?? '') : t === 'inlineStr' ? textOf(c) : v;
        row[colIndex(c.getAttribute('r') ?? 'A')] = value;
      }
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    out.push({ sheet: s.getAttribute('name') ?? 'Feuille', rows });
  }
  return out;
}

// ------------------------------------------------------------------ Rows -> groups
const isHeader = (cells: string[]) =>
  cells.some((c) => /^(no\.?|n°|num(éro)?|number)$/i.test(c)) && cells.some((c) => /tank|name|nom|d[ée]signation|equipment|équipement/i.test(c));

export function rowsToGroups(rows: Rows, fallbackGroup = 'LISTE'): EquipmentGroup[] {
  const groups: EquipmentGroup[] = [];
  let current: EquipmentGroup | null = null;
  let col = { no: 0, name: 1, tag: 2 };

  for (const raw of rows) {
    const cells = raw.map((c) => String(c ?? '').trim());
    const filled = cells.filter(Boolean);
    if (!filled.length) continue;

    if (isHeader(cells)) {
      const find = (re: RegExp, d: number) => {
        const i = cells.findIndex((c) => re.test(c));
        return i >= 0 ? i : d;
      };
      col = {
        no: find(/^(no\.?|n°|num(éro)?|number)$/i, 0),
        name: find(/tank|name|nom|d[ée]signation|equipment|équipement/i, 1),
        tag: find(/tag|rep[èe]re|client/i, 2),
      };
      continue;
    }
    // A row with a single text cell in the first column = group title.
    if (filled.length === 1 && cells[0] && !/^\d+$/.test(cells[0])) {
      current = groups.find((g) => g.group === cells[0]) ?? null;
      if (!current) {
        current = { group: cells[0], items: [] };
        groups.push(current);
      }
      continue;
    }
    const item: EquipmentItem = { no: cells[col.no] ?? '', name: cells[col.name] ?? '', tag: cells[col.tag] ?? '' };
    if (!item.no && !item.name && !item.tag) continue;
    if (!current) {
      current = { group: fallbackGroup, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups.filter((g) => g.items.length);
}

export function parseText(text: string): EquipmentGroup[] {
  return rowsToGroups(parseDelimited(text));
}

export async function parseFile(file: File): Promise<EquipmentGroup[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const sheets = await readXlsx(file);
    return mergeGroups([], sheets.flatMap((s) => rowsToGroups(s.rows, s.sheet)));
  }
  if (name.endsWith('.xls')) throw new Error('Ancien format .xls : enregistrez le fichier en .xlsx ou .csv depuis Excel.');
  return parseText(await file.text());
}

// ------------------------------------------------------------------ Helpers
const key = (it: EquipmentItem) => `${it.no}|${it.name}|${it.tag}`.toLowerCase();

/** Add `extra` into `base`: same group names are merged, duplicate lines skipped. */
export function mergeGroups(base: EquipmentGroup[], extra: EquipmentGroup[]): EquipmentGroup[] {
  const out = base.map((g) => ({ group: g.group, items: [...g.items] }));
  for (const g of extra) {
    let target = out.find((x) => x.group.toLowerCase() === g.group.toLowerCase());
    if (!target) {
      target = { group: g.group, items: [] };
      out.push(target);
    }
    const seen = new Set(target.items.map(key));
    for (const it of g.items) if (!seen.has(key(it))) {
      seen.add(key(it));
      target.items.push(it);
    }
  }
  return out;
}

export const countItems = (groups: EquipmentGroup[]) => groups.reduce((n, g) => n + g.items.length, 0);

/** Export a list as CSV (opens in Excel) — same layout as the import, so it can be re-imported. */
export function groupsToCsv(groups: EquipmentGroup[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(esc(g.group));
    lines.push('No.;Tank Name;Client Tag');
    for (const it of g.items) lines.push([it.no, it.name, it.tag].map(esc).join(';'));
    lines.push('');
  }
  return '﻿' + lines.join('\r\n');
}
