import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ---------------------------------------------------------------- Toasts
type ToastType = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  text: string;
  type: ToastType;
}
let listeners: ((t: ToastMsg) => void)[] = [];
let toastId = 0;
export function toast(text: string, type: ToastType = 'info') {
  const t = { id: ++toastId, text, type };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.type === 'error' ? 6000 : 3200);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-in pointer-events-auto rounded-md border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${
            t.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
              : t.type === 'error'
                ? 'border-red-500/40 bg-red-950/90 text-red-100'
                : 'border-navy-600 bg-navy-800/95 text-slate-100'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Icons
const ICONS: Record<string, string> = {
  upload: 'M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  download: 'M12 4v12m0 0l-4-4m4 4l4-4M4 18v1a2 2 0 002 2h12a2 2 0 002-2v-1',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8m0-5v5h5M12 7v5l3 3',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  paste: 'M9 4h6v3H9zM7 5H5v15h14V5h-2M9 13h6M9 17h4',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15 9h.01',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  zip: 'M6 3h9l4 4v14H6zM11 3v2h2v2h-2v2h2v2h-2v2',
  folder: 'M3 6h6l2 2h10v11H3z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  copyDown: 'M8 4h8v6h3l-7 7-7-7h3z M5 20h14',
  hash: 'M5 9h14M5 15h14M10 3L8 21M16 3l-2 18',
  help: 'M9 9a3 3 0 115 2c-1 1-2 1.5-2 3M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
};

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name] ?? ''} />
    </svg>
  );
}

// ---------------------------------------------------------------- Buttons
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-navy-950 hover:bg-accent-hover font-semibold shadow-sm shadow-accent/20',
  secondary: 'bg-navy-700 text-slate-100 hover:bg-navy-600 border border-navy-600',
  ghost: 'text-slate-300 hover:bg-navy-700 hover:text-white',
  danger: 'bg-red-600/15 text-red-300 hover:bg-red-600/30 border border-red-500/30',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm'
      } ${VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form fields
export const inputCls =
  'w-full rounded-md border border-navy-600 bg-navy-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/60';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-steel">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm text-slate-200">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-navy-600'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-navy-600 bg-navy-950/60 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-accent text-navy-950' : 'text-slate-300 hover:bg-navy-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Panels & modal
export function Panel({ title, step, right, children, id, className = '' }: { title: string; step?: number; right?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`rounded-lg border border-navy-700 bg-navy-900/80 ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-navy-700 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-200">
          {step !== undefined && <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/15 text-[11px] text-accent">{step}</span>}
          {title}
        </h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-xl border border-navy-600 bg-navy-900 shadow-2xl sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <header className="flex items-center justify-between border-b border-navy-700 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-navy-700 hover:text-white" aria-label="Fermer">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">{children}</kbd>;
}
