import { useEffect, useState } from 'react';
import type { Status } from './types';
import { reportThumbUrl } from './photos';

export const cellCls =
  'w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-slate-100 placeholder:text-slate-600 hover:border-navy-600 focus:border-accent focus:bg-navy-950 focus:outline-none';

const PILL: Record<string, string> = {
  TERMINÉ: 'bg-emerald-500/15 text-emerald-300',
  'EN COURS': 'bg-sky-500/15 text-sky-300',
  'EN ATTENTE': 'bg-amber-500/15 text-amber-300',
  'ATTENTE PHASE SUIVANTE': 'bg-amber-500/15 text-amber-300',
  BLOQUÉ: 'bg-red-500/15 text-red-300',
  'NON DÉMARRÉ': 'bg-slate-500/20 text-slate-300',
  'À RENSEIGNER': 'bg-slate-500/20 text-slate-400',
};
export function StatusPill({ s }: { s: Status }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${PILL[s] ?? PILL['À RENSEIGNER']}`}>{s}</span>;
}

export function Progress({ v }: { v: number | null }) {
  if (v === null) return null;
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-navy-700">
      <span className="block h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
    </span>
  );
}

export function Kpi({ label, value, sub, hl }: { label: string; value: React.ReactNode; sub?: React.ReactNode; hl?: boolean }) {
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${hl ? 'border-accent/40 bg-gradient-to-b from-accent/10 to-transparent' : 'border-navy-700 bg-navy-900/80'}`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-steel">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Thumb({ id, onClick, className = 'h-9 w-12' }: { id: string; onClick?: () => void; className?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    reportThumbUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <button type="button" onClick={onClick} className={`${className} shrink-0 overflow-hidden rounded border border-navy-600 bg-navy-800`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-700 px-4 py-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-200">{children}</h2>
      {right}
    </header>
  );
}
