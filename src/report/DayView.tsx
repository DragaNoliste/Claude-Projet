import { useMemo, useRef, useState } from 'react';
import type { ReportsStore } from './useReports';
import type { Activity, DailyReport, ReportSettings } from './types';
import type { AnnotationStyle } from '../types';
import { useEquipmentOptions } from '../hooks/useUsers';
import type { ProjectGroup } from '../lib/projectList';
import { Field, Icon, inputCls, toast, Toggle } from '../components/ui';
import { cellCls, Kpi, Progress, SectionTitle, StatusPill, Thumb } from './ui';
import { dayHours, frDate, frLong, isFilled, moSlots, moText, newActivity, persons, projectSummary, statusOf, UNITS } from './logic';
import { addReportPhoto, deleteReportPhotos } from './photos';

type Patch = (fn: (r: DailyReport) => DailyReport) => void;

function equipOptions(options: ProjectGroup[], projet: string) {
  const g = options.find((x) => x.group.toLowerCase() === projet.toLowerCase());
  return (g ? [g] : options).flatMap((x) => x.items);
}

// ------------------------------------------------------------------ Trades: one dropdown per worker
function MoPicker({ a, metiers, onChange, onText }: { a: Activity; metiers: string[]; onChange: (list: string[]) => void; onText: (mo: string) => void }) {
  const slots = moSlots(a, metiers);
  if (!slots.length) {
    return (
      <input
        className={`${cellCls} text-xs text-slate-400`}
        placeholder="← indiquez NBR"
        value={a.mo}
        onChange={(e) => onText(e.target.value)}
        title="Saisissez le nombre de personnes (NBR) pour choisir un métier par personne"
      />
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {slots.map((v, i) => (
        <select
          key={i}
          aria-label={`Métier de la personne ${i + 1}`}
          className={`${cellCls} py-0.5 text-[11.5px] ${v ? '' : 'text-amber-300/80'}`}
          value={v}
          onChange={(e) => onChange(slots.map((x, j) => (j === i ? e.target.value : x)))}
        >
          <option value="">{`${i + 1}. — métier —`}</option>
          {v && !metiers.includes(v) && <option value={v}>{v}</option>}
          {metiers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Activity row
function ActivityRow({
  a,
  report,
  settings,
  patch,
  onPhoto,
}: {
  a: Activity;
  report: DailyReport;
  settings: ReportSettings;
  style?: AnnotationStyle;
  patch: Patch;
  onPhoto: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<Activity>) => patch((r) => ({ ...r, activities: r.activities.map((x) => (x.id === a.id ? { ...x, ...p } : x)) }));
  const photos = report.photos.filter((p) => p.activityId === a.id);
  const status = statusOf(a);
  const waiting = a.type === 'ATTENTE';

  const addPhotos = async (files: FileList) => {
    setBusy(true);
    const added: Awaited<ReturnType<typeof addReportPhoto>>[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await addReportPhoto(f));
      } catch {
        toast(`Image illisible : ${f.name}`, 'error');
      }
    }
    // The original is kept: Projet / Désignation / Repère / Tâche are drawn from this line (HD in Excel).
    patch((r) => ({ ...r, photos: [...r.photos, ...added.map((p) => ({ ...p, activityId: a.id, caption: a.activite, annotate: settings.annotatePhotos }))] }));
    setBusy(false);
    if (added.length) toast(`${added.length} photo(s) ajoutée(s)${settings.annotatePhotos ? ' — annotation automatique' : ''}.`, 'success');
  };

  const del = async () => {
    if (isFilled(a) && !confirm('Supprimer cette ligne ?')) return;
    const ids = photos.map((p) => p.id);
    patch((r) => ({ ...r, activities: r.activities.filter((x) => x.id !== a.id), photos: r.photos.filter((p) => p.activityId !== a.id) }));
    await deleteReportPhotos(ids);
  };

  return (
    <tr className="group border-b border-navy-800 align-top hover:bg-navy-850/60">
      <td className="w-[250px] min-w-[200px] px-1 py-1">
        <input list={`eq-${a.projet}`} className={`${cellCls} text-xs text-slate-400`} placeholder="Équipement (liste)…" value={a.equipement} onChange={(e) => up({ equipement: e.target.value })} />
        <input className={`${cellCls} font-mono text-[11px] text-slate-400`} placeholder="Repère (photo)" value={a.repere} onChange={(e) => up({ repere: e.target.value })} />
      </td>
      <td className="min-w-[220px] px-1 py-1">
        <textarea rows={2} className={`${cellCls} resize-y`} placeholder={waiting ? 'Élément en attente…' : 'Activité du jour…'} value={a.activite} onChange={(e) => up({ activite: e.target.value })} />
      </td>
      {waiting ? (
        <>
          <td className="w-24 px-1 py-1">
            <input className={cellCls} placeholder="ex. 12 jours" value={a.depuis} onChange={(e) => up({ depuis: e.target.value })} />
          </td>
          <td className="w-20 px-1 py-1">
            <input className={cellCls} placeholder="Ens." value={a.qte} onChange={(e) => up({ qte: e.target.value })} />
          </td>
        </>
      ) : (
        <>
          <td className="w-16 min-w-[64px] px-1 py-1">
            <input
              type="number"
              min={0}
              max={20}
              className={`${cellCls} text-center`}
              title="Nombre de personnes : autant de cases Main-d’œuvre"
              value={a.nbr}
              onChange={(e) => {
                const nbr = e.target.value === '' ? '' : String(Math.min(20, Math.max(0, Math.round(+e.target.value))));
                // Resize the trade list with the number of workers, keeping what was already chosen.
                const list = moSlots({ ...a, nbr }, settings.metiers);
                up({ nbr, moList: list, mo: nbr ? moText(list) : a.mo });
              }}
            />
          </td>
          <td className="w-48 min-w-[190px] px-1 py-1">
            <MoPicker a={a} metiers={settings.metiers} onChange={(list) => up({ moList: list, mo: moText(list) })} onText={(mo) => up({ mo, moList: undefined })} />
          </td>
          <td className="w-28 min-w-[120px] px-1 py-1">
            <div className="flex gap-1">
              <input className={`${cellCls} w-12 text-right`} inputMode="decimal" placeholder="Qté" value={a.qte} onChange={(e) => up({ qte: e.target.value })} />
              <input list="units-list" className={`${cellCls} w-14 text-xs`} value={a.unite} onChange={(e) => up({ unite: e.target.value })} />
            </div>
          </td>
          <td className="w-24 min-w-[100px] px-1 py-1">
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                className={`${cellCls} w-14 text-right`}
                value={a.avancement ?? ''}
                onChange={(e) => up({ avancement: e.target.value === '' ? null : Math.max(0, Math.min(100, +e.target.value)) })}
              />
              <span className="text-xs text-slate-500">%</span>
            </div>
            <Progress v={a.avancement} />
          </td>
          <td className="w-28 min-w-[120px] px-1 py-1">
            <select className={`${cellCls} text-xs`} value={a.etat} onChange={(e) => up({ etat: e.target.value as Activity['etat'] })}>
              <option value="auto">Auto (selon %)</option>
              <option value="EN COURS">En cours</option>
              <option value="NON DÉMARRÉ">Non démarré</option>
              <option value="BLOQUÉ">Bloqué</option>
            </select>
          </td>
        </>
      )}
      <td className="w-36 px-1 py-1.5">
        <StatusPill s={status} />
      </td>
      <td className="min-w-[150px] px-1 py-1">
        <input className={`${cellCls} text-xs`} placeholder={waiting ? 'Situation…' : 'Phase / observations'} value={a.obs} onChange={(e) => up({ obs: e.target.value })} />
      </td>
      <td className="w-44 px-1 py-1">
        <div className="flex flex-wrap items-center gap-1">
          {photos.map((p) => (
            <span key={p.id} className="relative" title={p.annotate ? 'Annotée automatiquement — cliquer pour modifier' : 'Non annotée — cliquer pour annoter'}>
              <Thumb id={p.id} onClick={() => onPhoto(p.id)} />
              {p.annotate && <span className="pointer-events-none absolute -right-1 -top-1 rounded bg-accent px-1 text-[9px] font-bold leading-tight text-navy-950">A</span>}
            </span>
          ))}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && void addPhotos(e.target.files).finally(() => (e.target.value = ''))} />
          <button
            type="button"
            title={settings.annotatePhotos ? 'Ajouter des photos (annotées automatiquement)' : 'Ajouter des photos'}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-navy-600 text-slate-500 hover:border-accent hover:text-accent disabled:animate-pulse"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
      </td>
      <td className="w-8 px-1 py-1.5">
        <button type="button" onClick={() => void del()} className="rounded p-1 text-slate-600 opacity-60 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100" aria-label="Supprimer la ligne">
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function ActivityTable({ type, projet, ...p }: { type: Activity['type']; projet: string; report: DailyReport; settings: ReportSettings; style: AnnotationStyle; patch: Patch; onPhoto: (id: string) => void }) {
  const rows = p.report.activities.filter((a) => a.projet === projet && a.type === type);
  const waiting = type === 'ATTENTE';
  const add = () => p.patch((r) => ({ ...r, activities: [...r.activities, newActivity(projet, type)] }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1350px] text-left">
        <thead>
          <tr className="border-b border-navy-600 text-[10.5px] uppercase tracking-wider text-steel">
            <th className="px-2 py-1.5 font-semibold">Équipement · repère</th>
            <th className="px-2 py-1.5 font-semibold">{waiting ? 'Élément en attente' : 'Activité du jour'}</th>
            {waiting ? (
              <>
                <th className="px-2 py-1.5 font-semibold">Depuis</th>
                <th className="px-2 py-1.5 font-semibold">Qté</th>
              </>
            ) : (
              <>
                <th className="px-2 py-1.5 text-center font-semibold">NBR</th>
                <th className="px-2 py-1.5 font-semibold">Main-d’œuvre</th>
                <th className="px-2 py-1.5 font-semibold">Qté · unité</th>
                <th className="px-2 py-1.5 font-semibold">Avanc.</th>
                <th className="px-2 py-1.5 font-semibold">État</th>
              </>
            )}
            <th className="px-2 py-1.5 font-semibold">Statut</th>
            <th className="px-2 py-1.5 font-semibold">{waiting ? 'Situation' : 'Phase / observations'}</th>
            <th className="px-2 py-1.5 font-semibold">Photos</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <ActivityRow key={a.id} a={a} {...p} />
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add} className="mt-1 flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
        <Icon name="plus" className="h-3.5 w-3.5" /> {waiting ? 'Ajouter un élément en attente' : 'Ajouter une activité'}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Day view
export function DayView({ rs, style, onPhoto }: { rs: ReportsStore; style: AnnotationStyle; onPhoto: (id: string) => void }) {
  const r = rs.current!;
  const s = rs.settings!;
  const options = useEquipmentOptions();
  const patch: Patch = rs.update;
  const acts = r.activities.filter((a) => a.type === 'ACTIVITE' && isFilled(a));
  const done = acts.filter((a) => statusOf(a) === 'TERMINÉ').length;
  const matin = s.effectifProjects.reduce((t, p) => t + persons(r, p.name, 0), 0);
  const am = s.effectifProjects.reduce((t, p) => t + persons(r, p.name, 1), 0);
  const hours = dayHours(r, s);
  const setHeader = (k: keyof DailyReport['header'], v: string) => patch((x) => ({ ...x, header: { ...x.header, [k]: v } }));
  const setEff = (m: string, p: string, half: 0 | 1, v: number) =>
    patch((x) => {
      const row = { ...(x.effectif[m] ?? {}) };
      const cur = row[p] ?? [0, 0];
      row[p] = half === 0 ? [v, cur[1]] : [cur[0], v];
      return { ...x, effectif: { ...x.effectif, [m]: row } };
    });
  const metiers = useMemo(() => [...new Set([...s.metiers, ...Object.keys(r.effectif)])], [s.metiers, r.effectif]);
  const tableProps = { report: r, settings: s, style, patch, onPhoto };
  const isAuto = (p: string) => !!r.autoEffectif && s.reportProjects.includes(p);

  return (
    <div className="space-y-4">
      {/* datalists */}
      {s.reportProjects.map((p) => (
        <datalist key={p} id={`eq-${p}`}>
          {equipOptions(options, p).map((o) => (
            <option key={o.label} value={o.label} />
          ))}
        </datalist>
      ))}
      <datalist id="metiers-list">
        {s.metiers.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="units-list">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* ---------------- Header */}
      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle right={<span className="text-xs capitalize text-slate-400">{frLong(r.date)}</span>}>Rapport journalier d’avancement des travaux</SectionTitle>
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ['affaire', 'N° d’affaire'],
              ['projets', 'Projets'],
              ['atelier', 'Atelier'],
              ['etabliPar', 'Établi par'],
              ['verifiePar', 'Vérifié par'],
              ['revision', 'Révision'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input className={inputCls} value={r.header[k]} onChange={(e) => setHeader(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </section>

      {/* ---------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Effectif" value={`${matin} / ${am}`} sub="matin / après-midi" />
        <Kpi label="Heures du jour" value={`${hours} h`} sub="calcul automatique" hl />
        <Kpi label="Activités" value={acts.length} sub={`${done} terminées`} />
        <Kpi label="Taux de réalisation" value={acts.length ? `${Math.round((done / acts.length) * 100)} %` : '–'} sub="terminées / activités" />
        <Kpi label="Éléments en attente" value={r.activities.filter((a) => a.type === 'ATTENTE' && isFilled(a)).length} />
        <Kpi label="Photos" value={r.photos.length} sub="reportage du jour" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------------- Synthesis */}
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle>Synthèse de l’état des projets</SectionTitle>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-steel">
                  <th className="px-2 py-1.5 text-left">Projet</th>
                  <th className="px-2 py-1.5 text-right">Effectif M / AM</th>
                  <th className="px-2 py-1.5 text-right">Activités</th>
                  <th className="px-2 py-1.5 text-right">Terminées</th>
                  <th className="px-2 py-1.5 text-right">En cours</th>
                  <th className="px-2 py-1.5 text-right">En attente</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {s.reportProjects.map((p) => {
                  const x = projectSummary(r, p);
                  return (
                    <tr key={p} className="border-t border-navy-800">
                      <td className="px-2 py-1.5 font-bold">{p}</td>
                      <td className="px-2 py-1.5 text-right">
                        {persons(r, p, 0)} / {persons(r, p, 1)}
                      </td>
                      <td className="px-2 py-1.5 text-right">{x.activites}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-300">{x.terminees}</td>
                      <td className="px-2 py-1.5 text-right text-sky-300">{x.enCours}</td>
                      <td className="px-2 py-1.5 text-right text-amber-300">{x.attente}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Effectif */}
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle
            right={
              <div className="flex items-center gap-3">
                <div className="w-64">
                  <Toggle label="Calcul auto depuis la main-d’œuvre" checked={!!r.autoEffectif} onChange={(v) => patch((x) => ({ ...x, autoEffectif: v }))} />
                </div>
                <span className="text-sm font-bold text-accent">{hours} h</span>
              </div>
            }
          >
            Effectif / main-d’œuvre
          </SectionTitle>
          {r.autoEffectif && (
            <p className="border-b border-navy-800 px-4 py-1.5 text-[11px] text-slate-400">
              <b className="text-sky-300">{s.reportProjects.join(', ')}</b> : calculé depuis la colonne Main-d’œuvre des activités (chef d’atelier et contremaître = 1 si le projet a au moins une
              activité, sinon 0). <b className="text-accent">{s.effectifProjects.filter((p) => !s.reportProjects.includes(p.name)).map((p) => p.name).join(', ') || '—'}</b> : à saisir.
            </p>
          )}
          <div className="max-h-[430px] overflow-auto p-2">
            <table className="w-full text-center text-xs">
              <thead className="sticky top-0 bg-navy-900">
                <tr className="text-[10.5px] uppercase tracking-wider text-steel">
                  <th className="px-1 py-1 text-left">Métier</th>
                  {s.effectifProjects.map((p) => (
                    <th key={p.name} colSpan={2} className="border-l border-navy-700 px-1 py-1">
                      {p.name}
                      <div className="font-normal normal-case text-slate-500">
                        {p.hours[0]} h · {p.hours[1]} h
                      </div>
                      <div className={`mt-0.5 rounded px-1 text-[9px] font-bold normal-case tracking-normal ${isAuto(p.name) ? 'bg-sky-500/15 text-sky-300' : 'bg-accent/15 text-accent'}`}>
                        {isAuto(p.name) ? 'auto' : 'à saisir'}
                      </div>
                    </th>
                  ))}
                  <th className="border-l border-navy-700 px-1 py-1">Heures</th>
                </tr>
                <tr className="text-[10px] text-slate-500">
                  <th />
                  {s.effectifProjects.map((p) => (
                    <th key={p.name} colSpan={2} className="border-l border-navy-700">
                      <span className="inline-block w-1/2">M</span>
                      <span className="inline-block w-1/2">AM</span>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {metiers.map((m) => {
                  const h = s.effectifProjects.reduce((t, p) => t + (r.effectif[m]?.[p.name]?.[0] || 0) * p.hours[0] + (r.effectif[m]?.[p.name]?.[1] || 0) * p.hours[1], 0);
                  return (
                    <tr key={m} className="border-t border-navy-800">
                      <td className="whitespace-nowrap px-1 py-0.5 text-left text-[11.5px] text-slate-300">{m}</td>
                      {s.effectifProjects.map((p) =>
                        ([0, 1] as const).map((half) => (
                          <td key={p.name + half} className={`px-0.5 py-0.5 ${half === 0 ? 'border-l border-navy-700' : ''}`}>
                            {isAuto(p.name) ? (
                              <span className={`inline-block w-10 py-0.5 text-center text-xs ${r.effectif[m]?.[p.name]?.[half] ? 'font-semibold text-sky-200' : 'text-slate-700'}`}>
                                {r.effectif[m]?.[p.name]?.[half] || '·'}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                className="w-10 rounded border border-navy-700 bg-navy-950 py-0.5 text-center text-xs focus:border-accent focus:outline-none"
                                value={r.effectif[m]?.[p.name]?.[half] || ''}
                                onChange={(e) => setEff(m, p.name, half, Math.max(0, +e.target.value || 0))}
                              />
                            )}
                          </td>
                        )),
                      )}
                      <td className="border-l border-navy-700 px-1 font-semibold text-accent">{h || ''}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-navy-600 bg-navy-850 font-bold">
                  <td className="px-1 py-1 text-left">TOTAL</td>
                  {s.effectifProjects.map((p) =>
                    ([0, 1] as const).map((half) => (
                      <td key={p.name + half} className={half === 0 ? 'border-l border-navy-700' : ''}>
                        {persons(r, p.name, half)}
                      </td>
                    )),
                  )}
                  <td className="border-l border-navy-700 text-accent">{hours} h</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---------------- Activities per project */}
      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle right={<span className="text-xs text-slate-500">Le statut est calculé automatiquement à partir de l’avancement (100 % = terminé)</span>}>
          Travaux journaliers — activités du jour
        </SectionTitle>
        <div className="space-y-5 p-3">
          {s.reportProjects.map((p) => (
            <div key={p}>
              <h3 className="mb-1 rounded bg-accent/10 px-2 py-1 text-xs font-bold tracking-[0.12em] text-accent">{p}</h3>
              <ActivityTable type="ACTIVITE" projet={p} {...tableProps} />
              <h4 className="mb-1 mt-3 px-2 text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Éléments en attente — {p}</h4>
              <ActivityTable type="ATTENTE" projet={p} {...tableProps} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Next / problems / HSE */}
      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle>Suite des travaux, problèmes & HSE</SectionTitle>
        <div className="space-y-3 p-4">
          {s.reportProjects.map((p) => (
            <div key={p} className="grid gap-3 md:grid-cols-[60px_1fr_1fr]">
              <span className="pt-2 text-sm font-bold">{p}</span>
              <textarea rows={2} className={inputCls} placeholder="Activités prévues — prochain jour ouvré" value={r.next[p] ?? ''} onChange={(e) => patch((x) => ({ ...x, next: { ...x.next, [p]: e.target.value } }))} />
              <textarea rows={2} className={inputCls} placeholder="Problèmes / action client requise" value={r.problems[p] ?? ''} onChange={(e) => patch((x) => ({ ...x, problems: { ...x.problems, [p]: e.target.value } }))} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 border-t border-navy-700 pt-3 md:grid-cols-5">
            {(
              [
                ['accidents', 'Accidents avec arrêt'],
                ['presqu', 'Presqu’accidents'],
                ['cq', 'Contrôles CQ'],
                ['nc', 'NC émises'],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input type="number" min={0} className={inputCls} value={r.hse[k]} onChange={(e) => patch((x) => ({ ...x, hse: { ...x.hse, [k]: Math.max(0, +e.target.value || 0) } }))} />
              </Field>
            ))}
            <Field label="Remarques HSE / qualité">
              <input className={inputCls} value={r.hse.remarques} onChange={(e) => patch((x) => ({ ...x, hse: { ...x.hse, remarques: e.target.value } }))} />
            </Field>
          </div>
        </div>
      </section>

      {/* ---------------- Photo report */}
      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle
          right={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Bouton + sur chaque ligne · cliquez une photo pour l’annoter</span>
              {r.photos.length > 0 && (
                <button
                  type="button"
                  className="rounded border border-accent/50 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10"
                  onClick={() => {
                    const all = r.photos.every((p) => p.annotate);
                    patch((x) => ({ ...x, photos: x.photos.map((p) => ({ ...p, annotate: !all })) }));
                    toast(all ? 'Annotations retirées de toutes les photos.' : 'Toutes les photos seront annotées (Projet / Repère / Tâche de leur ligne).', 'success');
                  }}
                >
                  {r.photos.every((p) => p.annotate) ? 'Retirer les annotations' : 'Annoter toutes les photos'}
                </button>
              )}
            </div>
          }
        >
          Reportage photographique · {r.photos.length}
        </SectionTitle>
        <div className="space-y-4 p-4">
          {[...s.reportProjects, ''].map((p) => {
            const list = r.photos.filter((ph) => (r.activities.find((a) => a.id === ph.activityId)?.projet ?? '') === p);
            if (!list.length) return null;
            return (
              <div key={p}>
                <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-accent">{p || 'Photos non rattachées à une activité'}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((ph) => (
                    <figure key={ph.id} className="overflow-hidden rounded-md border border-navy-700 bg-navy-950">
                      <div className="relative">
                        <Thumb id={ph.id} onClick={() => onPhoto(ph.id)} className="block aspect-[4/3] h-auto w-full border-0" />
                        {ph.annotate && <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-accent px-1.5 text-[10px] font-bold text-navy-950">ANNOTÉE</span>}
                      </div>
                      <input
                        className={`${cellCls} text-center text-xs`}
                        value={ph.caption}
                        onChange={(e) => patch((x) => ({ ...x, photos: x.photos.map((q) => (q.id === ph.id ? { ...q, caption: e.target.value } : q)) }))}
                        title="Légende dans le rapport Excel"
                      />
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
          {!r.photos.length && <p className="text-sm text-slate-500">Aucune photo. Utilisez le bouton + sur une ligne d’activité, ou « Photos d’un projet » en haut de la page.</p>}
        </div>
      </section>

      <p className="text-center text-xs text-slate-500">
        Rapport du {frDate(r.date)} · enregistré automatiquement sur cet ordinateur{rs.saving ? ' …' : ''}
      </p>
    </div>
  );
}
