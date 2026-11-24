import { useEffect, useMemo, useRef, useState } from 'react';
import { PROJECT_GROUPS, type ProjectOption } from '../lib/projectList';
import { Icon, inputCls } from './ui';

/**
 * Project name field: free text + searchable dropdown of the equipment list (PAP / SMP / PAT).
 * Picking an entry calls onPick (Projet = "PAP-M76AAR15", Designation = "Sump Tank").
 */
export function ProjectCombobox({
  id = 'project-name',
  value,
  onChange,
  onPick,
  placeholder = 'Choisir dans la liste ou saisir…',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (opt: ProjectOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return PROJECT_GROUPS.map((g) => ({
      group: g.group,
      items: g.items.filter((it) => {
        const hay = `${it.code} ${it.label} ${it.designation}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      }),
    })).filter((g) => g.items.length);
  }, [query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    // Show the full list when the field already holds a choice; otherwise filter by what was typed.
    const selectedIdx = PROJECT_GROUPS.flatMap((g) => g.items).findIndex((it) => it.code === value);
    setQuery(selectedIdx >= 0 ? '' : value);
    setActive(Math.max(0, selectedIdx));
    setOpen(true);
  };

  const pick = (it: ProjectOption) => {
    onPick(it);
    setOpen(false);
  };

  let idx = -1;
  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          className={`${inputCls} pr-9 font-semibold`}
          placeholder={placeholder}
          value={value}
          onFocus={openList}
          onClick={() => !open && openList()}
          onChange={(e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) return openList();
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open && flat[active]) {
              e.preventDefault();
              pick(flat[active]);
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === 'Tab') setOpen(false);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Afficher la liste"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : openList())}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-navy-700 hover:text-white"
        >
          <Icon name={open ? 'up' : 'down'} className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          className="relative mt-1 max-h-72 overflow-y-auto rounded-md border border-navy-600 bg-navy-950 pb-1 shadow-xl shadow-black/40"
        >
          {groups.map((g) => (
            <li key={g.group} role="presentation">
              <div className="sticky top-0 z-10 flex items-center justify-between border-y border-navy-700 bg-navy-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
                <span>{g.group}</span>
                <span className="font-medium text-slate-500">{g.items.length}</span>
              </div>
              <ul role="group" aria-label={g.group}>
                {g.items.map((it) => {
                  idx++;
                  const i = idx;
                  const selected = it.code === value;
                  return (
                    <li
                      key={it.label}
                      role="option"
                      aria-selected={selected}
                      data-idx={i}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(it)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex cursor-pointer items-center gap-2 border-l-2 px-3 py-1.5 ${i === active ? 'border-accent bg-accent/10' : 'border-transparent'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-100">{it.code}</span>
                          <span className="font-mono text-[11px] text-steel">{it.no}</span>
                        </span>
                        <span className="block text-[13px] leading-snug text-slate-300">{it.designation}</span>
                      </span>
                      {selected && <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!flat.length && <li className="px-3 py-2 text-sm text-slate-500">Aucun résultat — le texte saisi sera utilisé tel quel.</li>}
        </ul>
      )}
    </div>
  );
}
