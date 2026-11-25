import { useMemo, useState } from 'react';
import type { ReportsStore } from './useReports';
import type { Activity, DailyReport, ReportSettings } from './types';
import { inputCls } from '../components/ui';
import { Kpi, Progress, SectionTitle, StatusPill } from './ui';
import { cumulHours, dayHours, dayPeople, frShort, hoursOf, isFilled, metierHours, metierPeople, peopleOf, splitEquip, statusOf } from './logic';

export interface WeekScope {
  days: string[]; // Mon..Sat
  selected: string | 'WEEK';
  week: number;
}

const inScope = (rs: ReportsStore, sc: WeekScope) => rs.reports.filter((r) => (sc.selected === 'WEEK' ? sc.days.includes(r.date) : r.date === sc.selected));

type Row = Activity & { date: string };

function Equip({ e }: { e: string }) {
  const x = splitEquip(e);
  if (!e) return null;
  return (
    <div className="text-[11.5px] text-slate-400">
      <b className="text-slate-200">{x.no}</b>
      {x.name && ` · ${x.name}`}
      {x.tag && ` · ${x.tag}`}
    </div>
  );
}

function Bars({ items }: { items: { label: string; value: number; text?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-44 items-end gap-3 px-2 pt-3">
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold text-slate-200">{i.value ? (i.text ?? i.value) : ''}</span>
          <div className={`w-full max-w-[56px] rounded-t ${i.value ? 'bg-gradient-to-b from-accent to-orange-800' : 'bg-navy-700'}`} style={{ height: `${Math.max(2, (i.value / max) * 120)}px` }} />
          <span className="text-[11px] capitalize text-slate-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Week activities
export function WeekView({ rs, sc }: { rs: ReportsStore; sc: WeekScope }) {
  const reports = inScope(rs, sc);
  const all: Row[] = reports.flatMap((r) => r.activities.filter(isFilled).map((a) => ({ ...a, date: r.date })));
  const acts = all.filter((a) => a.type === 'ACTIVITE');
  const waits = all.filter((a) => a.type === 'ATTENTE');
  const done = acts.filter((a) => statusOf(a) === 'TERMINÉ').length;
  const [fp, setFp] = useState('');
  const [fs, setFs] = useState('');
  const [ft, setFt] = useState<'ACTIVITE' | 'ATTENTE' | ''>('ACTIVITE');
  const [q, setQ] = useState('');
  const s = rs.settings!;

  // Same activity across the week (same equipment + text)
  const weekReports = rs.reports.filter((r) => sc.days.includes(r.date));
  const trend = (a: Row) =>
    weekReports
      .map((r) => ({ d: r.date, x: r.activities.find((y) => y.type === a.type && y.activite.trim() === a.activite.trim() && y.equipement === a.equipement) }))
      .filter((t) => t.x);

  const list = all.filter(
    (a) =>
      (!fp || a.projet === fp) &&
      (!ft || a.type === ft) &&
      (!fs || statusOf(a).startsWith(fs)) &&
      (!q || `${a.equipement} ${a.activite} ${a.obs} ${a.mo}`.toLowerCase().includes(q.toLowerCase())),
  );

  const byEquip = useMemo(() => {
    const m = new Map<string, { p: string; e: string; n: number; ok: number; run: number; days: Set<string> }>();
    for (const a of acts) {
      const k = `${a.projet}|${a.equipement}`;
      const v = m.get(k) ?? { p: a.projet, e: a.equipement, n: 0, ok: 0, run: 0, days: new Set<string>() };
      v.n++;
      const st = statusOf(a);
      if (st === 'TERMINÉ') v.ok++;
      if (st === 'EN COURS') v.run++;
      v.days.add(a.date);
      m.set(k, v);
    }
    return [...m.values()].sort((a, b) => a.p.localeCompare(b.p) || b.n - a.n);
  }, [acts]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={sc.selected === 'WEEK' ? `Activités semaine ${sc.week}` : 'Activités du jour'} value={acts.length} sub={`${new Set(acts.map((a) => a.equipement + a.activite)).size} activités différentes`} hl />
        <Kpi label="Terminées" value={done} sub={acts.length ? `${Math.round((done / acts.length) * 100)} % de réalisation` : ''} />
        <Kpi label="En cours" value={acts.filter((a) => statusOf(a) === 'EN COURS').length} />
        <Kpi label="Éléments en attente" value={new Set(waits.map((a) => a.equipement + a.activite)).size} sub="distincts" />
        <Kpi label="Équipements" value={new Set(acts.map((a) => a.equipement).filter(Boolean)).size} sub="bacs / appareils" />
        <Kpi label="Jours saisis" value={`${reports.length} / ${sc.selected === 'WEEK' ? 6 : 1}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle>Activités par jour</SectionTitle>
          <Bars
            items={sc.days.map((d) => {
              const r = rs.reports.find((x) => x.date === d);
              return { label: frShort(d), value: r ? r.activities.filter((a) => a.type === 'ACTIVITE' && isFilled(a)).length : 0 };
            })}
          />
        </section>
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle>Synthèse par projet et équipement</SectionTitle>
          <div className="max-h-56 overflow-auto px-3 pb-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-900 text-[10.5px] uppercase tracking-wider text-steel">
                <tr>
                  <th className="px-2 py-1.5 text-left">Projet</th>
                  <th className="px-2 py-1.5 text-left">Équipement</th>
                  <th className="px-2 py-1.5 text-right">Act.</th>
                  <th className="px-2 py-1.5 text-right">Term.</th>
                  <th className="px-2 py-1.5 text-right">En cours</th>
                  <th className="px-2 py-1.5 text-right">Jours</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {byEquip.map((v) => (
                  <tr key={v.p + v.e} className="border-t border-navy-800">
                    <td className="px-2 py-1 font-bold">{v.p}</td>
                    <td className="px-2 py-1">
                      <Equip e={v.e} />
                    </td>
                    <td className="px-2 py-1 text-right">{v.n}</td>
                    <td className="px-2 py-1 text-right text-emerald-300">{v.ok}</td>
                    <td className="px-2 py-1 text-right text-sky-300">{v.run}</td>
                    <td className="px-2 py-1 text-right">{v.days.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle right={<span className="text-sm font-bold text-accent">{list.length}</span>}>{sc.selected === 'WEEK' ? `Toutes les activités — semaine ${sc.week}` : 'Activités du jour'}</SectionTitle>
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          <select className={`${inputCls} w-auto`} value={fp} onChange={(e) => setFp(e.target.value)}>
            <option value="">Tous les projets</option>
            {s.reportProjects.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className={`${inputCls} w-auto`} value={fs} onChange={(e) => setFs(e.target.value)}>
            <option value="">Tous les statuts</option>
            {['TERMINÉ', 'EN COURS', 'BLOQUÉ', 'NON DÉMARRÉ', 'À RENSEIGNER', 'EN ATTENTE', 'ATTENTE PHASE SUIVANTE'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select className={`${inputCls} w-auto`} value={ft} onChange={(e) => setFt(e.target.value as typeof ft)}>
            <option value="ACTIVITE">Activités</option>
            <option value="ATTENTE">Éléments en attente</option>
            <option value="">Tout</option>
          </select>
          <input className={`${inputCls} w-72`} placeholder="Rechercher (équipement, activité, métier…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-[600px] overflow-auto p-3">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-navy-900 text-[10.5px] uppercase tracking-wider text-steel">
              <tr>
                <th className="px-2 py-1.5 text-left">Date</th>
                <th className="px-2 py-1.5 text-left">Projet</th>
                <th className="px-2 py-1.5 text-left">Équipement / activité</th>
                <th className="px-2 py-1.5 text-left">Main-d’œuvre</th>
                <th className="px-2 py-1.5 text-right">Qté</th>
                <th className="px-2 py-1.5 text-left">Avanc.</th>
                <th className="px-2 py-1.5 text-left">Statut</th>
                <th className="px-2 py-1.5 text-left">Suivi sur la semaine</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t border-navy-800 align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs capitalize text-slate-400">{frShort(a.date)}</td>
                  <td className="px-2 py-1.5 font-bold">{a.projet}</td>
                  <td className="px-2 py-1.5">
                    <Equip e={a.equipement} />
                    {a.activite}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-400">{a.mo}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {a.qte} <span className="text-xs text-slate-500">{a.type === 'ATTENTE' ? '' : a.unite}</span>
                  </td>
                  <td className="w-20 px-2 py-1.5 text-xs">
                    {a.type === 'ATTENTE' ? a.depuis : a.avancement !== null ? `${a.avancement} %` : '—'}
                    <Progress v={a.type === 'ATTENTE' ? null : a.avancement} />
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusPill s={statusOf(a)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {trend(a).map((t) => (
                        <span key={t.d} className="flex items-center gap-1 text-[10.5px] capitalize text-slate-500">
                          {frShort(t.d)}
                          <StatusPill s={statusOf(t.x!)} />
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-sm text-slate-500">
                    Aucune activité pour cette sélection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Effectif & hours
export function HoursView({ rs, sc }: { rs: ReportsStore; sc: WeekScope }) {
  const s: ReportSettings = rs.settings!;
  const reports = inScope(rs, sc);
  const hours = reports.reduce((t, r) => t + dayHours(r, s), 0);
  const hj = reports.reduce((t, r) => t + dayPeople(r, s), 0);
  const lastDate = reports.length ? reports[reports.length - 1].date : sc.days[sc.days.length - 1];
  const metiers = [...new Set([...s.metiers, ...reports.flatMap((r) => Object.keys(r.effectif))])];
  const byDay = (d: string): DailyReport | undefined => rs.reports.find((r) => r.date === d);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={sc.selected === 'WEEK' ? `Total heures semaine ${sc.week}` : 'Heures du jour'} value={`${hours} h`} sub="tous projets" hl />
        <Kpi label="Hommes-jours" value={hj} sub={`${reports.length} jour(s) saisi(s)`} />
        <Kpi label="Effectif moyen / jour" value={reports.length ? Math.round(hj / reports.length) : '–'} />
        <Kpi label="Effectif max / jour" value={Math.max(0, ...reports.map((r) => dayPeople(r, s)))} />
        {s.effectifProjects.slice(-2).map((p) => (
          <Kpi key={p.name} label={`Heures cumulées ${p.name}`} value={cumulHours(rs.reports, s, p.name, lastDate)} sub={`au ${lastDate.split('-').reverse().join('/')}`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle>Heures par jour</SectionTitle>
          <Bars items={sc.days.map((d) => ({ label: frShort(d), value: byDay(d) ? dayHours(byDay(d)!, s) : 0, text: `${byDay(d) ? dayHours(byDay(d)!, s) : 0} h` }))} />
        </section>
        <section className="rounded-lg border border-navy-700 bg-navy-900/80">
          <SectionTitle>Heures par projet</SectionTitle>
          <table className="w-full text-sm">
            <thead className="text-[10.5px] uppercase tracking-wider text-steel">
              <tr>
                <th className="px-4 py-1.5 text-left">Projet</th>
                <th className="px-2 py-1.5 text-right">Hommes-jours</th>
                <th className="px-2 py-1.5 text-right">Heures</th>
                <th className="px-2 py-1.5 text-right">Cumul</th>
                <th className="px-4 py-1.5 text-left">Part</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {s.effectifProjects.map((p) => {
                const h = reports.reduce((t, r) => t + hoursOf(r, s, p.name), 0);
                return (
                  <tr key={p.name} className="border-t border-navy-800">
                    <td className="px-4 py-1.5 font-bold">{p.name}</td>
                    <td className="px-2 py-1.5 text-right">{reports.reduce((t, r) => t + peopleOf(r, p.name), 0)}</td>
                    <td className="px-2 py-1.5 text-right">{h} h</td>
                    <td className="px-2 py-1.5 text-right text-slate-400">{cumulHours(rs.reports, s, p.name, lastDate)} h</td>
                    <td className="px-4 py-1.5">
                      <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-navy-700 align-middle">
                        <span className="block h-full bg-accent" style={{ width: `${hours ? (h / hours) * 100 : 0}%` }} />
                      </span>{' '}
                      <span className="text-xs text-slate-400">{hours ? Math.round((h / hours) * 100) : 0} %</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-navy-600 font-bold">
                <td className="px-4 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right">{hj}</td>
                <td className="px-2 py-1.5 text-right text-accent">{hours} h</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <section className="rounded-lg border border-navy-700 bg-navy-900/80">
        <SectionTitle>Effectif par métier et par jour (tous projets)</SectionTitle>
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[720px] text-center text-sm tabular-nums">
            <thead className="text-[10.5px] uppercase tracking-wider text-steel">
              <tr>
                <th className="px-2 py-1.5 text-left">Métier</th>
                {sc.days.map((d) => (
                  <th key={d} className="px-2 py-1.5 capitalize">
                    {frShort(d)}
                  </th>
                ))}
                <th className="px-2 py-1.5">Hommes-jours</th>
                <th className="px-2 py-1.5">Heures</th>
              </tr>
            </thead>
            <tbody>
              {metiers.map((m) => {
                const hjm = sc.days.reduce((t, d) => t + (byDay(d) && (sc.selected === 'WEEK' || sc.selected === d) ? metierPeople(byDay(d)!, m) : 0), 0);
                const hm = sc.days.reduce((t, d) => t + (byDay(d) && (sc.selected === 'WEEK' || sc.selected === d) ? metierHours(byDay(d)!, s, m) : 0), 0);
                if (!hjm) return null;
                return (
                  <tr key={m} className="border-t border-navy-800">
                    <td className="px-2 py-1 text-left text-xs">{m}</td>
                    {sc.days.map((d) => (
                      <td key={d} className="px-2 py-1">
                        {byDay(d) ? metierPeople(byDay(d)!, m) || '' : <span className="text-slate-700">·</span>}
                      </td>
                    ))}
                    <td className="px-2 py-1 font-semibold">{hjm}</td>
                    <td className="px-2 py-1 font-semibold text-accent">{hm} h</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-navy-600 font-bold">
                <td className="px-2 py-1.5 text-left">TOTAL</td>
                {sc.days.map((d) => (
                  <td key={d}>{byDay(d) ? dayPeople(byDay(d)!, s) : ''}</td>
                ))}
                <td>{hj}</td>
                <td className="text-accent">{hours} h</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
