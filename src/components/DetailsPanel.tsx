import { useState, type RefObject } from 'react';
import type { ProjectStore } from '../hooks/useProject';
import type { TaskLibrary } from '../hooks/useTaskLibrary';
import type { PhotoData } from '../types';
import { formatDate, incrementRef } from '../lib/utils';
import { Button, Field, Icon, inputCls, Kbd, toast } from './ui';
import { ProjectCombobox } from './ProjectCombobox';

export type Clipboard = Pick<PhotoData, 'repere' | 'task' | 'observations'> | null;

export function DetailsPanel({
  store,
  library,
  repereRef,
  clipboard,
  onCopy,
  onPaste,
  onCopyPrevious,
  onOpenLibrary,
  onNext,
}: {
  store: ProjectStore;
  library: TaskLibrary;
  repereRef: RefObject<HTMLInputElement | null>;
  clipboard: Clipboard;
  onCopy: () => void;
  onPaste: () => void;
  onCopyPrevious: () => void;
  onOpenLibrary: () => void;
  onNext: () => void;
}) {
  const p = store.project!;
  const photo = p.photos.find((ph) => ph.id === store.currentId);
  const idx = photo ? p.photos.indexOf(photo) : -1;
  const [showOverrides, setShowOverrides] = useState(false);
  const [libFilter, setLibFilter] = useState('');

  if (!photo) {
    return <p className="text-sm text-slate-500">Importez des photos puis sélectionnez-en une pour saisir le repère et la tâche réalisée.</p>;
  }
  const up = (patch: Partial<PhotoData>) => store.updatePhoto(photo.id, patch);
  const hasOverrides = !!(photo.projectOverride || photo.designationOverride || photo.dateOverride || photo.siteOverride);
  const filtered = library.tasks.filter((t) => t.toLowerCase().includes(libFilter.toLowerCase()));

  return (
    <div className="space-y-4">
      <Field label="Repère *" htmlFor="repere">
        <input
          id="repere"
          ref={repereRef}
          className={`${inputCls} font-mono text-base font-semibold tracking-wide`}
          placeholder="Ex. V-101"
          value={photo.repere}
          onChange={(e) => up({ repere: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.ctrlKey) {
              e.preventDefault();
              document.getElementById('task')?.focus();
            }
          }}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Tâche réalisée *"
        htmlFor="task"
        hint={
          <>
            Astuce : écrivez <span className="font-mono text-slate-400">{'{repere}'}</span> pour insérer automatiquement le repère de chaque photo.
          </>
        }
      >
        <textarea
          id="task"
          rows={3}
          className={`${inputCls} resize-y`}
          placeholder="Ex. Travaux de soudage sur la virole V-101."
          value={photo.task}
          onChange={(e) => up({ task: e.target.value })}
        />
      </Field>

      {/* Quick task library */}
      <div className="rounded-md border border-navy-700 bg-navy-950/40">
        <div className="flex items-center gap-2 border-b border-navy-700 px-2 py-1.5">
          <Icon name="list" className="h-3.5 w-3.5 shrink-0 text-steel" />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            placeholder="Bibliothèque de tâches — filtrer…"
            value={libFilter}
            onChange={(e) => setLibFilter(e.target.value)}
          />
          <button type="button" onClick={onOpenLibrary} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10">
            Gérer
          </button>
        </div>
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-2">
          {filtered.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => up({ task: t })}
              className={`rounded border px-2 py-1 text-left text-xs transition-colors ${
                photo.task === t ? 'border-accent bg-accent/15 text-accent' : 'border-navy-600 text-slate-300 hover:border-accent/60 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
          {!filtered.length && <span className="text-xs text-slate-500">Aucune tâche trouvée.</span>}
        </div>
      </div>

      <Field label="Observations (optionnel)" htmlFor="obs">
        <textarea id="obs" rows={2} className={`${inputCls} resize-y`} placeholder="Remarques, réserves…" value={photo.observations} onChange={(e) => up({ observations: e.target.value })} />
      </Field>

      {/* Per-photo overrides */}
      <div className="rounded-md border border-navy-700">
        <button type="button" onClick={() => setShowOverrides((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
          <span>
            Personnaliser projet / désignation / date / site
            {hasOverrides && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">modifié</span>}
          </span>
          <Icon name={showOverrides ? 'up' : 'down'} className="h-4 w-4" />
        </button>
        {showOverrides && (
          <div className="space-y-2.5 border-t border-navy-700 p-3">
            <ProjectCombobox
              id="photo-project"
              placeholder={`Projet : ${p.name || '—'}`}
              value={photo.projectOverride}
              designation={photo.designationOverride}
              onChange={(v) => up({ projectOverride: v })}
              onPick={(o) => up({ projectOverride: o.code, designationOverride: o.designation })}
            />
            <input
              className={inputCls}
              placeholder={`Désignation : ${(photo.projectOverride ? '' : p.designation) || '—'}`}
              value={photo.designationOverride}
              onChange={(e) => up({ designationOverride: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={photo.dateOverride} onChange={(e) => up({ dateOverride: e.target.value })} title={`Par défaut : ${formatDate(p.date)}`} />
              <input className={inputCls} placeholder={`Site : ${p.site || '—'}`} value={photo.siteOverride} onChange={(e) => up({ siteOverride: e.target.value })} />
            </div>
            {hasOverrides && (
              <Button size="sm" variant="ghost" onClick={() => up({ projectOverride: '', designationOverride: '', dateOverride: '', siteOverride: '' })}>
                Revenir aux valeurs du projet
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Copy tools */}
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" icon="copyDown" disabled={idx <= 0} onClick={onCopyPrevious} title="Copier tâche + observations de la photo précédente (Ctrl+D)">
          Précédente
        </Button>
        <Button size="sm" icon="copy" onClick={onCopy} title="Copier les infos de cette photo (Ctrl+Maj+C)">
          Copier
        </Button>
        <Button size="sm" icon="paste" disabled={!clipboard} onClick={onPaste} title="Coller la tâche et les observations copiées (Ctrl+Maj+V)">
          Coller
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon="left" disabled={idx <= 0} onClick={() => store.movePhoto(photo.id, -1)} title="Déplacer la photo vers la gauche">
          Déplacer
        </Button>
        <Button variant="ghost" size="sm" disabled={idx >= p.photos.length - 1} onClick={() => store.movePhoto(photo.id, 1)} title="Déplacer la photo vers la droite">
          <Icon name="right" className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          className="ml-auto text-red-300 hover:text-red-200"
          onClick={() => {
            if (confirm('Retirer cette photo du projet ?')) void store.removePhotos([photo.id]);
          }}
        >
          Retirer
        </Button>
      </div>

      <Button variant="primary" className="w-full" icon="right" disabled={idx >= p.photos.length - 1} onClick={onNext}>
        Photo suivante <span className="ml-1 text-[11px] font-normal opacity-70">Ctrl+Entrée</span>
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------------ Bulk tools
export function BulkPanel({ store }: { store: ProjectStore }) {
  const p = store.project!;
  const photo = p.photos.find((ph) => ph.id === store.currentId);
  const ids = p.photos.filter((ph) => store.selected.has(ph.id)).map((ph) => ph.id); // ordered as gallery
  const [fields, setFields] = useState({ task: true, observations: false, overrides: false });
  const [startRef, setStartRef] = useState('');
  const [step, setStep] = useState(1);
  const n = ids.length;

  const applyFromCurrent = () => {
    if (!photo) return;
    const targets = ids.filter((id) => id !== photo.id);
    if (!targets.length) return toast('Sélectionnez d’autres photos que la photo actuelle.', 'error');
    store.updatePhotos(targets, () => ({
      ...(fields.task ? { task: photo.task } : {}),
      ...(fields.observations ? { observations: photo.observations } : {}),
      ...(fields.overrides ? { projectOverride: photo.projectOverride, designationOverride: photo.designationOverride, dateOverride: photo.dateOverride, siteOverride: photo.siteOverride } : {}),
    }));
    toast(`Informations copiées vers ${targets.length} photo(s). Les repères sont conservés.`, 'success');
  };

  const numberRefs = () => {
    const start = startRef.trim();
    if (!start) return toast('Indiquez le premier repère (ex. V-101).', 'error');
    store.updatePhotos(ids, (_, order) => ({ repere: incrementRef(start, order * step) }));
    toast(`${n} repères numérotés : ${start} → ${incrementRef(start, (n - 1) * step)}.`, 'success');
  };

  if (!n) {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        Cochez plusieurs photos dans la galerie (ou <Kbd>Maj</Kbd>+clic) pour copier une tâche sur toutes, ou numéroter les repères automatiquement.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-slate-400">
          Copier depuis la photo actuelle <span className="font-semibold text-slate-200">({photo?.repere || `n° ${p.photos.indexOf(photo!) + 1}`})</span> vers les{' '}
          {n} photo(s) sélectionnée(s) — les repères restent différents :
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-200">
          {(
            [
              ['task', 'Tâche'],
              ['observations', 'Observations'],
              ['overrides', 'Projet/date/site perso.'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={fields[k]} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <Button className="w-full" icon="copyDown" onClick={applyFromCurrent} disabled={!photo}>
          Appliquer à la sélection
        </Button>
      </div>

      <div className="space-y-2 border-t border-navy-700 pt-4">
        <p className="text-xs text-slate-400">Numérotation automatique des repères (ordre de la galerie) :</p>
        <div className="flex gap-2">
          <input className={`${inputCls} font-mono`} placeholder="1er repère : V-101" value={startRef} onChange={(e) => setStartRef(e.target.value)} />
          <input type="number" min={1} className={`${inputCls} w-20`} value={step} onChange={(e) => setStep(Math.max(1, +e.target.value || 1))} title="Pas" />
        </div>
        <Button className="w-full" icon="hash" onClick={numberRefs}>
          Numéroter {n} repère(s)
        </Button>
      </div>
    </div>
  );
}
