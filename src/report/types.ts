/** V2 — daily report ("Rapport journalier d'avancement des travaux") data model. */

export type ActivityType = 'ACTIVITE' | 'ATTENTE';
/** Manual state; 'auto' = computed from the progress %. */
export type ActivityState = 'auto' | 'EN COURS' | 'NON DÉMARRÉ' | 'BLOQUÉ';
export type Status = 'TERMINÉ' | 'EN COURS' | 'NON DÉMARRÉ' | 'BLOQUÉ' | 'À RENSEIGNER' | 'EN ATTENTE' | 'ATTENTE PHASE SUIVANTE';

export interface Activity {
  id: string;
  /** Report project block (SMP / PAP / PAT …). */
  projet: string;
  type: ActivityType;
  /** Equipment line, e.g. "5555-TB01 | SUMP TANK | M76AAR15". */
  equipement: string;
  /** Part mark written on photos ("Rep:"), e.g. M-55TB01. Optional. */
  repere: string;
  activite: string;
  /** Number of workers. */
  nbr: string;
  /** Trades as text, e.g. "Chaudronnier + Soudeur" (kept in sync with moList, used by the Excel export). */
  mo: string;
  /** One trade per worker: length follows NBR. */
  moList?: string[];
  unite: string;
  qte: string;
  /** Progress 0–100, null = not filled. */
  avancement: number | null;
  etat: ActivityState;
  /** Phase / observations / waiting situation. */
  obs: string;
  /** Waiting items: since when, e.g. "12 jours". */
  depuis: string;
}

export interface PhotoAnnotation {
  projet?: string;
  designation?: string;
  repere?: string;
  tache?: string;
}

export interface ReportPhoto {
  id: string;
  activityId: string | null;
  caption: string;
  width: number;
  height: number;
  /** The untouched original is stored ("rp:<id>:o"), so annotations can be redrawn in HD at any time. */
  original?: boolean;
  /** Draw Projet / Désignation / Repère / Tâche on the photo (from its activity line). */
  annotate?: boolean;
  /** Per-photo values replacing the ones taken from the activity (empty = automatic). */
  ann?: PhotoAnnotation;
}

export interface ReportHeader {
  affaire: string;
  projets: string;
  atelier: string;
  etabliPar: string;
  verifiePar: string;
  revision: string;
}

export interface Hse {
  accidents: number;
  presqu: number;
  cq: number;
  nc: number;
  remarques: string;
}

/** effectif[métier][projet] = [matin, après-midi] */
export type Effectif = Record<string, Record<string, [number, number]>>;

export interface DailyReport {
  /** `${ownerId}:${date}` */
  id: string;
  ownerId: string;
  /** ISO yyyy-mm-dd */
  date: string;
  header: ReportHeader;
  effectif: Effectif;
  /** true = effectif of the activity projects is computed from the trades (Main-d'œuvre). Missing = manual (imported reports). */
  autoEffectif?: boolean;
  activities: Activity[];
  photos: ReportPhoto[];
  next: Record<string, string>;
  problems: Record<string, string>;
  hse: Hse;
  createdAt: number;
  updatedAt: number;
}

export interface EffectifProject {
  name: string;
  /** Hours counted per person for [morning, afternoon]. */
  hours: [number, number];
  /** Displayed time slots, e.g. ["08:00–12:00", "13:00–17:00"]. */
  slots: [string, string];
  /** Cumulated hours before the first report stored in the app. */
  cumulStart: number;
}

export interface ReportSettings {
  /** Project blocks of the activity table (SMP, PAP, PAT…). */
  reportProjects: string[];
  /** Columns of the effectif table (SMP, PAT, PAP, MHS, MS…). */
  effectifProjects: EffectifProject[];
  metiers: string[];
  header: ReportHeader;
  /** Company logo at the top-left of the Excel report (data URL), taken from an imported Daily Report or uploaded. */
  headerLogo?: string;
  /** Photos per row in the Excel photo report (2 = largest). */
  excelPhotosPerRow?: 2 | 3 | 4;
  /** Annotate photos added to an activity with the current photo style. */
  annotatePhotos: boolean;
}
