import { useEffect, useMemo, useRef, useState } from 'react';
import type { UsersStore } from '../hooks/useUsers';
import { useEquipmentOptions } from '../hooks/useUsers';
import type { AnnotationStyle, ProjectRecord } from '../types';
import { Button, Field, Icon, inputCls, Modal, toast, Toggle } from '../components/ui';
import { db } from '../lib/db';
import { buildFields } from '../lib/render';
import { ownerOf } from '../hooks/useProject';
import { formatDate } from '../lib/utils';
import { useReports, type ReportsStore } from './useReports';
import { DayView } from './DayView';
import { PhotoEditor } from './PhotoEditor';
import { HoursView, WeekView, type WeekScope } from './WeekViews';
import { addDays, frDate, frLong, frShort, isoWeek, mondayOf, newActivity, weekDays } from './logic';
import { deleteReportPhotos, photoFromProject } from './photos';
import type { ReportPhoto, ReportSettings } from './types';
import { readDailyWorkbook, type ImportPreview } from './excelImport';

type Tab = 'day' | 'week' | 'hours' | 'settings';

// ------------------------------------------------------------------ Import from a V1 photo project
function ProjectPhotosModal({ open, onClose, rs, ownerId }: { open: boolean; onClose: () => void; rs: ReportsStore; ownerId: string }) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const options = useEquipmentOptions();
  useEffect(() => {
    if (open) db.listProjects().then((l) => setProjects(l.filter((p) => ownerOf(p) === ownerId && p.photos.length)));
  }, [open, ownerId]);

  const run = async (p: ProjectRecord) => {
    const s = rs.settings!;
    setBusy(p.id);
    const acts = [...rs.current!.activities];
    const newPhotos: ReportPhoto[] = [];
    for (const ph of p.photos) {
      const f = buildFields(p, ph);
      const opt = options.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group }))).find((o) => o.code === f.project && (!f.designation || o.designation === f.designation));
      const projet = s.reportProjects.find((x) => x.toLowerCase() === opt?.group.toLowerCase()) ?? s.reportProjects.find((x) => f.project.toUpperCase().startsWith(x.toUpperCase())) ?? s.reportProjects[0];
      const equipement = opt?.label ?? f.project;
      const text = f.task || f.designation || 'Photo';
      let act = acts.find((a) => a.equipement === equipement && a.activite.trim().toLowerCase() === text.trim().toLowerCase());
      if (!act) {
        act = { ...newActivity(projet), equipement, activite: text, repere: f.repere, obs: f.observations };
        acts.push(act);
      }
      try {
        const stored = await photoFromProject(p, ph, f);
        newPhotos.push({ ...stored, activityId: act.id, caption: text, annotate: true });
      } catch {
        toast(`Photo illisible : ${ph.name}`, 'error');
      }
    }
    rs.update((r) => ({ ...r, activities: acts, photos: [...r.photos, ...newPhotos] }));
    setBusy(null);
    toast(`${newPhotos.length} photo(s) annotée(s) ajoutée(s) au rapport, rangées par activité.`, 'success');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajouter les photos d’un projet photo">
      <p className="mb-3 text-sm text-slate-400">
        Les photos annotées dans l’onglet <b className="text-slate-200">Photos</b> sont ajoutées au rapport du {rs.current ? frDate(rs.current.date) : ''}. Chaque couple <i>équipement + tâche</i> devient une ligne d’activité (ou complète la ligne existante).
      </p>
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-md border border-navy-700 bg-navy-950/40 p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name || 'Projet sans nom'}</p>
              <p className="text-xs text-slate-400">
                {formatDate(p.date)} · {p.photos.length} photo(s) · {p.designation}
              </p>
            </div>
            <Button size="sm" variant="primary" disabled={!!busy} onClick={() => void run(p)}>
              {busy === p.id ? 'Ajout…' : 'Ajouter'}
            </Button>
          </li>
        ))}
        {!projects.length && <li className="text-sm text-slate-500">Aucun projet photo avec des photos pour cet utilisateur.</li>}
      </ul>
    </Modal>
  );
}

// ------------------------------------------------------------------ Excel import
function ImportModal({ open, onClose, rs, ownerId }: { open: boolean; onClose: () => void; rs: ReportsStore; ownerId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      setPrev(null);
      setPick(new Set());
    }
  }, [open]);

  const run = async () => {
    if (!prev) return;
    const dates = [...pick];
    const clash = dates.filter((d) => rs.reports.some((r) => r.date === d));
    if (clash.length && !confirm(`Remplacer les rapports déjà présents pour : ${clash.map(frDate).join(', ')} ?`)) return;
    setBusy(true);
    try {
      for (const d of clash) await deleteReportPhotos(rs.reports.find((r) => r.date === d)!.photos.map((p) => p.id));
      const reports = await prev.run(dates, ownerId, rs.settings!, rs.reports);
      if (prev.logo && !rs.settings!.headerLogo) {
        rs.saveSettings({ ...rs.settings!, headerLogo: prev.logo });
        toast('Logo de l’en-tête récupéré depuis le fichier Excel.', 'info');
      }
      for (const r of reports) await rs.upsert(r);
      toast(`${reports.length} rapport(s) importé(s).`, 'success');
      if (reports[0]) rs.setDate(reports[reports.length - 1].date);
      onClose();
    } catch (e) {
      toast(`Import impossible : ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer un rapport Excel existant" wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Choisissez un fichier <b className="text-slate-200">Daily Report …xlsx</b> : chaque feuille datée (ex. 24-11-2026) devient un rapport, avec l’effectif, les activités, les éléments en attente, l’HSE et les photos.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              const p = await readDailyWorkbook(f);
              setPrev(p);
              setFileName(f.name);
              setPick(new Set(p.sheets.filter((x) => x.activities + x.waiting > 0).map((x) => x.date)));
            } catch (err) {
              toast((err as Error).message || 'Fichier illisible.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button variant="primary" icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy && !prev ? 'Lecture du fichier…' : 'Choisir le fichier Excel'}
        </Button>
        {prev && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              <b>{fileName}</b> — cochez les jours à importer :
            </p>
            <table className="w-full text-sm">
              <thead className="text-[10.5px] uppercase tracking-wider text-steel">
                <tr>
                  <th className="w-8" />
                  <th className="px-2 py-1 text-left">Feuille</th>
                  <th className="px-2 py-1 text-right">Activités</th>
                  <th className="px-2 py-1 text-right">En attente</th>
                  <th className="px-2 py-1 text-right">Effectif</th>
                  <th className="px-2 py-1 text-right">Photos</th>
                  <th className="px-2 py-1 text-left" />
                </tr>
              </thead>
              <tbody>
                {prev.sheets.map((x) => (
                  <tr key={x.date} className="border-t border-navy-800">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={pick.has(x.date)}
                        onChange={(e) =>
                          setPick((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(x.date);
                            else n.delete(x.date);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 font-semibold capitalize">
                      {x.name} <span className="text-xs font-normal text-slate-500">{frShort(x.date)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">{x.activities}</td>
                    <td className="px-2 py-1.5 text-right">{x.waiting}</td>
                    <td className="px-2 py-1.5 text-right">{x.people}</td>
                    <td className="px-2 py-1.5 text-right">{x.photos}</td>
                    <td className="px-2 py-1.5 text-xs text-amber-300">{rs.reports.some((r) => r.date === x.date) ? 'remplacera le rapport existant' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button variant="primary" icon="check" disabled={!pick.size || busy} onClick={() => void run()}>
                {busy ? 'Import en cours…' : `Importer ${pick.size} jour(s)`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Settings
function SettingsView({ rs }: { rs: ReportsStore }) {
  const [s, setS] = useState<ReportSettings>(rs.settings!);
  const dirty = JSON.stringify(s) !== JSON.stringify(rs.settings);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-navy-700 bg-navy-900/80 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Projets du tableau des activités</h3>
        <input className={inputCls} value={s.reportProjects.join(', ')} onChange={(e) => setS({ ...s, reportProjects: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
        <p className="mt-1 text-xs text-slate-500">Séparés par des virgules, ex. SMP, PAP, PAT. Les noms doivent correspondre aux groupes de votre liste d’équipements.</p>
      </section>
      <section className="rounded-lg border border-navy-700 bg-navy-900/80 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Effectif : projets, heures et cumul</h3>
        <table className="w-full max-w-3xl text-sm">
          <thead className="text-[10.5px] uppercase tracking-wider text-steel">
            <tr>
              <th className="px-1 py-1 text-left">Projet</th>
              <th className="px-1 py-1">Heures matin</th>
              <th className="px-1 py-1">Heures après-midi</th>
              <th className="px-1 py-1">Horaires affichés</th>
              <th className="px-1 py-1">Heures cumulées au départ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.effectifProjects.map((p, i) => {
              const set = (patch: Partial<typeof p>) => setS({ ...s, effectifProjects: s.effectifProjects.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <tr key={i}>
                  <td className="p-1">
                    <input className={inputCls} value={p.name} onChange={(e) => set({ name: e.target.value })} />
                  </td>
                  <td className="p-1">
                    <input type="number" min={0} max={12} step={0.5} className={inputCls} value={p.hours[0]} onChange={(e) => set({ hours: [+e.target.value, p.hours[1]] })} />
                  </td>
                  <td className="p-1">
                    <input type="number" min={0} max={12} step={0.5} className={inputCls} value={p.hours[1]} onChange={(e) => set({ hours: [p.hours[0], +e.target.value] })} />
                  </td>
                  <td className="flex gap-1 p-1">
                    <input className={inputCls} value={p.slots[0]} onChange={(e) => set({ slots: [e.target.value, p.slots[1]] })} />
                    <input className={inputCls} value={p.slots[1]} onChange={(e) => set({ slots: [p.slots[0], e.target.value] })} />
                  </td>
                  <td className="p-1">
                    <input type="number" min={0} className={inputCls} value={p.cumulStart} onChange={(e) => set({ cumulStart: +e.target.value || 0 })} />
                  </td>
                  <td className="p-1">
                    <Button size="sm" variant="ghost" icon="trash" aria-label="Retirer" onClick={() => setS({ ...s, effectifProjects: s.effectifProjects.filter((_, j) => j !== i) })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Button size="sm" variant="ghost" icon="plus" className="mt-2" onClick={() => setS({ ...s, effectifProjects: [...s.effectifProjects, { name: 'NOUVEAU', hours: [4, 4], slots: ['08:00–12:00', '13:00–17:00'], cumulStart: 0 }] })}>
          Ajouter un projet
        </Button>
        <p className="mt-2 text-xs text-slate-500">Heures du jour = effectif du matin × heures du matin + effectif de l’après-midi × heures de l’après-midi. « Heures cumulées au départ » = total déjà réalisé avant le premier rapport saisi dans l’application.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-navy-700 bg-navy-900/80 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Métiers (un par ligne)</h3>
          <textarea rows={12} className={`${inputCls} font-mono text-xs`} value={s.metiers.join('\n')} onChange={(e) => setS({ ...s, metiers: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
        </section>
        <section className="space-y-3 rounded-lg border border-navy-700 bg-navy-900/80 p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em]">En-tête par défaut des nouveaux rapports</h3>
          {(
            [
              ['affaire', 'N° d’affaire'],
              ['projets', 'Projets'],
              ['atelier', 'Atelier'],
              ['etabliPar', 'Établi par'],
              ['verifiePar', 'Vérifié par'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input className={inputCls} value={s.header[k]} onChange={(e) => setS({ ...s, header: { ...s.header, [k]: e.target.value } })} />
            </Field>
          ))}
          <Field label="Logo de l’en-tête Excel" hint="Récupéré automatiquement à l’import d’un Daily Report, ou choisissez une image (PNG / JPG).">
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-48 items-center justify-center overflow-hidden rounded border border-navy-600 bg-white">
                {s.headerLogo ? <img src={s.headerLogo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-500">Aucun logo</span>}
              </div>
              <label className="cursor-pointer rounded-md border border-navy-600 bg-navy-700 px-2.5 py-1.5 text-xs hover:bg-navy-600">
                Choisir…
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    const rd = new FileReader();
                    rd.onload = () => setS({ ...s, headerLogo: String(rd.result) });
                    rd.readAsDataURL(f);
                  }}
                />
              </label>
              {s.headerLogo && (
                <Button size="sm" variant="ghost" icon="trash" aria-label="Retirer le logo" onClick={() => setS({ ...s, headerLogo: undefined })} />
              )}
            </div>
          </Field>
          <div className="rounded-md border border-navy-700 px-3">
            <Toggle label="Annoter automatiquement les photos ajoutées à une activité" checked={s.annotatePhotos} onChange={(annotatePhotos) => setS({ ...s, annotatePhotos })} />
          </div>
        </section>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => setS(rs.settings!)}>
          Annuler les modifications
        </Button>
        <Button
          variant="primary"
          icon="save"
          disabled={!dirty}
          onClick={() => {
            rs.saveSettings(s);
            toast('Paramètres des rapports enregistrés.', 'success');
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Main
export function ReportsApp({ users, style }: { users: UsersStore; style: AnnotationStyle }) {
  const user = users.current!;
  const rs = useReports(user.id, user.name, user.equipment);
  const equipOptions = useEquipmentOptions();
  const lookup = (label: string) => equipOptions.flatMap((g) => g.items).find((o) => o.label === label);
  const [tab, setTab] = useState<Tab>('day');
  const [scopeSel, setScopeSel] = useState<string | 'WEEK'>('WEEK');
  const [photo, setPhoto] = useState<string | null>(null);
  const [modal, setModal] = useState<'import' | 'v1' | null>(null);
  const [exporting, setExporting] = useState(false);

  const monday = mondayOf(rs.date);
  const days7 = weekDays(monday, 7);
  const days = days7.slice(0, 6);
  const week = isoWeek(rs.date);
  const sc: WeekScope = useMemo(() => ({ days, selected: scopeSel, week }), [days.join(), scopeSel, week]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekReports = rs.reports.filter((r) => days7.includes(r.date));

  if (!rs.settings) return <p className="p-6 text-sm text-slate-400">Chargement des rapports…</p>;

  const doExport = async (kind: 'day' | 'week') => {
    await rs.flush();
    setExporting(true);
    try {
      const { exportDay, exportWeek } = await import('./excelExport');
      if (kind === 'day' && rs.current) await exportDay(rs.current, rs.settings!, rs.reports, style, lookup);
      if (kind === 'week') await exportWeek(weekReports, rs.settings!, style, lookup, days7.filter((d) => d <= days7[5] || weekReports.some((r) => r.date === d)), week, rs.reports, user.name);
      toast('Fichier Excel généré.', 'success');
    } catch (e) {
      toast(`Erreur d’export : ${(e as Error).message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const prevReport = [...rs.reports].reverse().find((r) => r.date < rs.date);

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-3 sm:p-5">
      {/* ---------------- Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-700 bg-navy-900/80 p-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon="left" aria-label="Semaine précédente" onClick={() => rs.setDate(addDays(monday, -7))} />
          <div className="px-1 text-sm font-bold">
            Semaine {week}
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              {frDate(days7[0])} → {frDate(days7[6])}
            </span>
          </div>
          <Button size="sm" variant="ghost" icon="right" aria-label="Semaine suivante" onClick={() => rs.setDate(addDays(monday, 7))} />
        </div>
        <div className="flex flex-wrap gap-1">
          {tab !== 'day' && tab !== 'settings' && (
            <button type="button" onClick={() => setScopeSel('WEEK')} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${scopeSel === 'WEEK' ? 'border-accent bg-accent/15 text-white' : 'border-navy-600 text-slate-300 hover:border-slate-400'}`}>
              Toute la semaine
            </button>
          )}
          {days7.map((d) => {
            const has = rs.reports.some((r) => r.date === d);
            const on = tab === 'day' || tab === 'settings' ? rs.date === d : scopeSel === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => (tab === 'day' || tab === 'settings' ? rs.setDate(d) : (setScopeSel(d), rs.setDate(d)))}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs capitalize ${on ? 'border-accent bg-accent/15 text-white' : 'border-navy-600 text-slate-300 hover:border-slate-400'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${has ? 'bg-emerald-400' : 'bg-navy-600'}`} />
                {frShort(d)}
              </button>
            );
          })}
          <input type="date" className="rounded-md border border-navy-600 bg-navy-950 px-2 py-1 text-xs" value={rs.date} onChange={(e) => e.target.value && rs.setDate(e.target.value)} title="Aller à une date" />
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {(
            [
              ['day', 'Rapport du jour'],
              ['week', 'Semaine'],
              ['hours', 'Effectif & heures'],
              ['settings', 'Paramètres'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-navy-700 text-white shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon="upload" onClick={() => setModal('import')}>
          Importer un rapport Excel
        </Button>
        {tab === 'day' && rs.current && (
          <Button size="sm" icon="image" onClick={() => setModal('v1')}>
            Photos d’un projet
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon="download" disabled={!rs.current || exporting} onClick={() => void doExport('day')}>
            Excel du {frDate(rs.date)}
          </Button>
          <Button size="sm" variant="primary" icon="zip" disabled={!weekReports.length || exporting} onClick={() => void doExport('week')}>
            Excel semaine {week} ({weekReports.length} j.)
          </Button>
        </div>
      </div>

      {/* ---------------- Views */}
      {tab === 'day' &&
        (rs.current ? (
          <>
            <DayView rs={rs} style={style} onPhoto={setPhoto} />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="danger"
                icon="trash"
                onClick={async () => {
                  if (confirm(`Supprimer définitivement le rapport du ${frDate(rs.date)} et ses photos ?`)) {
                    await rs.remove();
                    toast('Rapport supprimé.', 'success');
                  }
                }}
              >
                Supprimer ce rapport
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-navy-600 bg-navy-900/50 px-6 py-14 text-center">
            <Icon name="list" className="h-10 w-10 text-accent" />
            <div>
              <p className="text-base font-semibold">Pas encore de rapport pour le {frLong(rs.date)}</p>
              <p className="mt-1 text-sm text-slate-400">Créez-le en un clic : l’effectif et les activités non terminées de la veille sont repris automatiquement.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {prevReport && (
                <Button variant="primary" icon="copyDown" onClick={() => void rs.create('continue')}>
                  Reprendre le rapport du {frDate(prevReport.date)}
                </Button>
              )}
              <Button variant={prevReport ? 'secondary' : 'primary'} icon="plus" onClick={() => void rs.create('blank')}>
                Rapport vierge
              </Button>
              <Button icon="upload" onClick={() => setModal('import')}>
                Importer un fichier Excel
              </Button>
            </div>
          </div>
        ))}
      {tab === 'week' && <WeekView rs={rs} sc={sc} />}
      {tab === 'hours' && <HoursView rs={rs} sc={sc} />}
      {tab === 'settings' && <SettingsView key={user.id} rs={rs} />}

      <PhotoEditor rs={rs} id={photo} style={style} lookup={lookup} onClose={() => setPhoto(null)} onNavigate={setPhoto} />
      <ImportModal open={modal === 'import'} onClose={() => setModal(null)} rs={rs} ownerId={user.id} />
      <ProjectPhotosModal open={modal === 'v1'} onClose={() => setModal(null)} rs={rs} ownerId={user.id} />
      {exporting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
          <div className="rounded-xl border border-navy-600 bg-navy-900 px-8 py-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider">Génération du fichier Excel…</p>
            <p className="mt-1 text-xs text-slate-400">Mise en page, effectif, activités et photos</p>
          </div>
        </div>
      )}
    </div>
  );
}
