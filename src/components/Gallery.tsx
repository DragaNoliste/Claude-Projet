import { useEffect, useRef } from 'react';
import type { ProjectStore } from '../hooks/useProject';
import { Button, Icon } from './ui';

export function UploadButton({ store, children, variant = 'primary' }: { store: ProjectStore; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void store.addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant={variant} icon="upload" onClick={() => ref.current?.click()} disabled={!!store.importing}>
        {children}
      </Button>
    </>
  );
}

export function Gallery({ store }: { store: ProjectStore }) {
  const p = store.project!;
  const { selected, setSelected, currentId, setCurrentId, thumbs } = store;
  const currentRef = useRef<HTMLDivElement>(null);
  const lastClicked = useRef<string | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [currentId]);

  const toggle = (id: string, shift: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (shift && lastClicked.current) {
        const ids = p.photos.map((ph) => ph.id);
        const [a, b] = [ids.indexOf(lastClicked.current), ids.indexOf(id)].sort((x, y) => x - y);
        const turnOn = !s.has(id);
        ids.slice(a, b + 1).forEach((x) => (turnOn ? n.add(x) : n.delete(x)));
      } else if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    lastClicked.current = id;
  };

  const all = p.photos.map((ph) => ph.id);
  const incomplete = p.photos.filter((ph) => !ph.repere.trim() || !ph.task.trim()).map((ph) => ph.id);

  if (!p.photos.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-navy-600 bg-navy-900/50 px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon name="upload" className="h-7 w-7" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-100">Glissez-déposez vos photos ici</p>
          <p className="mt-1 text-sm text-slate-400">JPG, PNG, WebP — plusieurs fichiers à la fois. Traitement local, rien n’est envoyé.</p>
        </div>
        <UploadButton store={store}>Choisir des photos</UploadButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <UploadButton store={store} variant="secondary">
          Ajouter
        </UploadButton>
        <div className="mx-1 h-5 w-px bg-navy-600" />
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(all))}>
          Tout sélectionner
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(incomplete))} disabled={!incomplete.length}>
          Incomplètes ({incomplete.length})
        </Button>
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Désélectionner
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon="trash"
              onClick={() => {
                if (confirm(`Retirer ${selected.size} photo(s) du projet ?`)) void store.removePhotos([...selected]);
              }}
            >
              Retirer ({selected.size})
            </Button>
          </>
        )}
        <span className="ml-auto hidden text-xs text-slate-500 md:inline">Maj+clic : sélection multiple</span>
      </div>

      <div className="grid max-h-[340px] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5 overflow-y-auto pr-1">
        {p.photos.map((ph, i) => {
          const isCur = ph.id === currentId;
          const isSel = selected.has(ph.id);
          const done = ph.repere.trim() && ph.task.trim();
          return (
            <div
              key={ph.id}
              ref={isCur ? currentRef : undefined}
              className={`group relative cursor-pointer overflow-hidden rounded-md border-2 bg-navy-950 transition-all ${
                isCur ? 'border-accent shadow-lg shadow-accent/20' : isSel ? 'border-sky-500/70' : 'border-navy-700 hover:border-navy-600'
              }`}
              onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey ? toggle(ph.id, e.shiftKey) : setCurrentId(ph.id))}
              title={ph.name}
            >
              <div className="aspect-[4/3] w-full">
                {thumbs[ph.id] ? (
                  <img src={thumbs[ph.id]} alt={ph.name} className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="h-full w-full animate-pulse bg-navy-800" />
                )}
              </div>
              <button
                type="button"
                aria-label={isSel ? 'Désélectionner' : 'Sélectionner'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(ph.id, e.shiftKey);
                }}
                className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border transition-opacity ${
                  isSel ? 'border-sky-400 bg-sky-500 text-white' : 'border-white/60 bg-black/40 text-transparent opacity-80 group-hover:opacity-100'
                }`}
              >
                <Icon name="check" className="h-3.5 w-3.5" />
              </button>
              <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
              <div className="flex items-center gap-1.5 border-t border-navy-700 px-2 py-1">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`truncate text-[11px] font-medium ${ph.repere ? 'text-slate-200' : 'italic text-slate-500'}`}>{ph.repere || 'Sans repère'}</span>
              </div>
            </div>
          );
        })}
        {store.importing &&
          Array.from({ length: store.importing.total - store.importing.done }).map((_, i) => (
            <div key={`ph-${i}`} className="aspect-[4/3] animate-pulse rounded-md border-2 border-navy-700 bg-navy-800" />
          ))}
      </div>
    </div>
  );
}
