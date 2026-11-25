import type { Activity, DailyReport, Effectif, ReportHeader, ReportSettings, Status } from './types';
import type { EquipmentGroup } from '../lib/projectList';
import { uid } from '../lib/utils';

// ------------------------------------------------------------------ Defaults
export const DEFAULT_METIERS = [
  "CHEF D'ATELIER", 'CONTREMAÎTRE', 'SOUDEUR', 'AIDE-SOUDEUR', 'CHAUDRONNIER', 'AIDE-CHAUDRONNIER', 'TOURNEUR', 'AIDE-TOURNEUR',
  'TUYAUTEUR', 'CONDUCTEUR DE MACHINE', 'CONTRÔLEUR QUALITÉ', 'MEULEUR', 'MONTEUR / AJUSTEUR', 'PEINTRE', 'AIDE-PEINTRE',
  'FINISSEUR', 'MANŒUVRE', 'SABLEUR', 'AIDE-SABLEUR',
];
export const UNITS = ['pcs', 'Ens.', 'ml', 'm²', 'kg', 'jours'];
const SLOTS: [string, string] = ['08:00–12:00', '13:00–17:00'];

export function defaultSettings(userId: string, userName: string, groups: EquipmentGroup[]): ReportSettings {
  if (userId === 'khalid') {
    return {
      reportProjects: ['SMP', 'PAP', 'PAT'],
      effectifProjects: [
        { name: 'SMP', hours: [4, 4], slots: SLOTS, cumulStart: 0 },
        { name: 'PAT', hours: [4, 4], slots: SLOTS, cumulStart: 0 },
        { name: 'PAP', hours: [4, 4], slots: SLOTS, cumulStart: 0 },
        { name: 'MHS', hours: [5, 4], slots: ['08:00–13:00', '13:00–17:00'], cumulStart: 0 },
        { name: 'MS', hours: [4, 4], slots: SLOTS, cumulStart: 0 },
      ],
      metiers: [...DEFAULT_METIERS],
      header: { affaire: '5564 – 5555 – 5551', projets: 'SMP-PAP-PAT', atelier: '309', etabliPar: 'Janati Idrissi Khalid', verifiePar: '', revision: '00' },
      annotatePhotos: true,
    };
  }
  const names = groups.map((g) => g.group);
  const projects = names.length ? names : ['PROJET 1'];
  return {
    reportProjects: projects,
    effectifProjects: projects.map((name) => ({ name, hours: [4, 4], slots: SLOTS, cumulStart: 0 })),
    metiers: [...DEFAULT_METIERS],
    header: { affaire: '', projets: projects.join('-'), atelier: '', etabliPar: userName, verifiePar: '', revision: '00' },
    annotatePhotos: true,
  };
}

export function emptyEffectif(s: ReportSettings): Effectif {
  const e: Effectif = {};
  for (const m of s.metiers) {
    e[m] = {};
    for (const p of s.effectifProjects) e[m][p.name] = [0, 0];
  }
  return e;
}

export function newActivity(projet: string, type: Activity['type'] = 'ACTIVITE'): Activity {
  return { id: uid(), projet, type, equipement: '', repere: '', activite: '', nbr: '', mo: '', unite: type === 'ATTENTE' ? '' : 'pcs', qte: '', avancement: null, etat: 'auto', obs: '', depuis: '' };
}

export function newReport(ownerId: string, date: string, s: ReportSettings, header?: ReportHeader): DailyReport {
  const now = Date.now();
  const blank = Object.fromEntries(s.reportProjects.map((p) => [p, '']));
  return {
    id: `${ownerId}:${date}`,
    ownerId,
    date,
    header: { ...(header ?? s.header) },
    effectif: emptyEffectif(s),
    autoEffectif: true,
    activities: [],
    photos: [],
    next: { ...blank },
    problems: { ...blank },
    hse: { accidents: 0, presqu: 0, cq: 0, nc: 0, remarques: '' },
    createdAt: now,
    updatedAt: now,
  };
}

/** New report that continues a previous one: same header and effectif, unfinished activities and waiting items. */
export function continueReport(prev: DailyReport, date: string, s: ReportSettings): DailyReport {
  const r = newReport(prev.ownerId, date, s, prev.header);
  r.effectif = structuredClone(prev.effectif);
  const gap = Math.max(1, Math.round((Date.parse(date) - Date.parse(prev.date)) / 86400000));
  r.activities = prev.activities
    .filter((a) => statusOf(a) !== 'TERMINÉ')
    .map((a) => {
      const m = /^(\d+)\s*(jours?)?$/i.exec(a.depuis.trim());
      const depuis = a.type === 'ATTENTE' && m ? `${+m[1] + gap} jours` : a.depuis;
      return { ...a, id: uid(), depuis };
    });
  r.next = { ...r.next };
  r.autoEffectif = prev.autoEffectif ?? true;
  if (r.autoEffectif) r.effectif = computeAutoEffectif(r, s);
  return r;
}

// ------------------------------------------------------------------ Status (replaces the Excel formulas)
export function statusOf(a: Activity): Status {
  if (a.type === 'ATTENTE') return /suivant|next/i.test(a.obs) ? 'ATTENTE PHASE SUIVANTE' : 'EN ATTENTE';
  if (a.etat === 'BLOQUÉ' || /bloq/i.test(a.obs)) return 'BLOQUÉ';
  if (a.avancement !== null && a.avancement >= 100) return 'TERMINÉ';
  if (a.avancement !== null && a.avancement > 0) return 'EN COURS';
  if (a.etat === 'EN COURS') return 'EN COURS';
  if (a.etat === 'NON DÉMARRÉ') return 'NON DÉMARRÉ';
  return 'À RENSEIGNER';
}

export const isFilled = (a: Activity) => !!(a.activite.trim() || a.equipement.trim());

export function projectSummary(r: DailyReport, projet: string) {
  const acts = r.activities.filter((a) => a.projet === projet && a.type === 'ACTIVITE' && isFilled(a));
  const st = acts.map(statusOf);
  return {
    activites: acts.length,
    terminees: st.filter((s) => s === 'TERMINÉ').length,
    enCours: st.filter((s) => s === 'EN COURS').length,
    bloquees: st.filter((s) => s === 'BLOQUÉ').length,
    attente: r.activities.filter((a) => a.projet === projet && a.type === 'ATTENTE' && isFilled(a)).length,
  };
}

// ------------------------------------------------------------------ Effectif & hours
export const persons = (r: DailyReport, projet: string, half: 0 | 1) =>
  Object.values(r.effectif).reduce((s, row) => s + (row[projet]?.[half] || 0), 0);

/** People present that day on a project = max(morning, afternoon) per trade. */
export const peopleOf = (r: DailyReport, projet: string) =>
  Object.values(r.effectif).reduce((s, row) => s + Math.max(row[projet]?.[0] || 0, row[projet]?.[1] || 0), 0);

export function hoursOf(r: DailyReport, s: ReportSettings, projet: string) {
  const p = s.effectifProjects.find((x) => x.name === projet);
  if (!p) return 0;
  return persons(r, projet, 0) * p.hours[0] + persons(r, projet, 1) * p.hours[1];
}
export const dayHours = (r: DailyReport, s: ReportSettings) => s.effectifProjects.reduce((t, p) => t + hoursOf(r, s, p.name), 0);
export const dayPeople = (r: DailyReport, s: ReportSettings) => s.effectifProjects.reduce((t, p) => t + peopleOf(r, p.name), 0);

export function metierHours(r: DailyReport, s: ReportSettings, metier: string) {
  const row = r.effectif[metier] ?? {};
  return s.effectifProjects.reduce((t, p) => t + (row[p.name]?.[0] || 0) * p.hours[0] + (row[p.name]?.[1] || 0) * p.hours[1], 0);
}
export function metierPeople(r: DailyReport, metier: string) {
  const row = r.effectif[metier] ?? {};
  return Object.values(row).reduce((t, v) => t + Math.max(v[0] || 0, v[1] || 0), 0);
}

/** Cumulated hours of a project up to and including `date`. */
export function cumulHours(all: DailyReport[], s: ReportSettings, projet: string, date: string) {
  const p = s.effectifProjects.find((x) => x.name === projet);
  return (p?.cumulStart ?? 0) + all.filter((r) => r.date <= date).reduce((t, r) => t + hoursOf(r, s, projet), 0);
}

// ------------------------------------------------------------------ Dates & weeks
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export function mondayOf(iso: string) {
  const d = fromISO(iso);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return toISO(d);
}
export function isoWeek(iso: string) {
  const d = fromISO(iso);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}
export const weekDays = (monday: string, n = 7) => Array.from({ length: n }, (_, i) => addDays(monday, i));
export const frShort = (iso: string) => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }).replace('.', '');
export const frLong = (iso: string) => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
export const frDate = (iso: string) => iso.split('-').reverse().join('/');
/** Sheet name used in Excel, e.g. 24-11-2026 */
export const sheetName = (iso: string) => iso.split('-').reverse().join('-');

// ------------------------------------------------------------------ Trades per worker
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

/** "Chaudronnier" -> "CHAUDRONNIER" when it matches a trade of the list; other text is kept. */
export function matchMetier(t: string, metiers: string[]): string {
  const p = plain(t);
  if (!p) return '';
  return metiers.find((m) => plain(m) === p) ?? metiers.find((m) => plain(m) === p.replace(/S$/, '')) ?? t.trim();
}

/** One trade per worker (NBR boxes), taken from moList or, for older lines, from the "mo" text. */
export function moSlots(a: Activity, metiers: string[]): string[] {
  const n = Math.min(20, Math.max(0, parseInt(a.nbr, 10) || 0));
  const src = a.moList ?? a.mo.split(/\s*[+,;/]\s*/).filter(Boolean).map((t) => matchMetier(t, metiers));
  return Array.from({ length: n }, (_, i) => src[i] ?? '');
}

export const moText = (list: string[]) => list.filter(Boolean).join(' + ');

const isChef = (m: string) => plain(m) === 'CHEFDATELIER';
const isContremaitre = (m: string) => plain(m) === 'CONTREMAITRE';

/**
 * Effectif computed from the activities:
 *  - activity projects (SMP, PAP, PAT…): one person per trade chosen in "Main-d'œuvre", same morning and afternoon;
 *    CHEF D'ATELIER and CONTREMAÎTRE = 1 / 1 when the project has at least one activity that day, else 0;
 *  - other projects (MHS, MS…): unchanged (entered by hand).
 */
export function computeAutoEffectif(r: DailyReport, s: ReportSettings): Effectif {
  const eff: Effectif = {};
  const rows = new Set([...s.metiers, ...Object.keys(r.effectif)]);
  for (const m of rows) eff[m] = { ...(r.effectif[m] ?? {}) };
  for (const p of s.reportProjects) {
    const acts = r.activities.filter((a) => a.projet === p && a.type === 'ACTIVITE' && isFilled(a));
    const counts = new Map<string, number>();
    for (const a of acts)
      for (const t of moSlots(a, s.metiers)) {
        if (!t) continue;
        const m = matchMetier(t, s.metiers);
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    for (const m of counts.keys()) if (!eff[m]) eff[m] = {};
    for (const m of Object.keys(eff)) {
      let n = counts.get(m) ?? 0;
      if (isChef(m) || isContremaitre(m)) n = acts.length ? 1 : 0;
      eff[m][p] = [n, n];
    }
  }
  // Drop custom rows that no longer count anybody.
  for (const m of Object.keys(eff)) if (!s.metiers.includes(m) && Object.values(eff[m]).every((v) => !v[0] && !v[1])) delete eff[m];
  return eff;
}

/** Split "5555-TB01 | SUMP TANK | M76AAR15" */
export function splitEquip(e: string): { no: string; name: string; tag: string } {
  const [no = '', name = '', tag = ''] = e.split('|').map((x) => x.trim());
  return { no, name, tag };
}
