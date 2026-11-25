import { useEffect, useRef, useState } from 'react';
import type { ReportsStore } from './useReports';
import type { AnnotationStyle } from '../types';
import type { PhotoAnnotation } from './types';
import { Button, Field, Icon, inputCls, toast, Toggle } from '../components/ui';
import { deleteReportPhotos, photoFields, renderReportPhoto, type EquipLookup } from './photos';

/**
 * Annotate a report photo: HD preview with Projet / Désignation / Repère / Tâche taken
 * automatically from its activity line, each value can be replaced for this photo.
 */
export function PhotoEditor({ rs, id, style, lookup, onClose, onNavigate }: { rs: ReportsStore; id: string | null; style: AnnotationStyle; lookup: EquipLookup; onClose: () => void; onNavigate: (id: string) => void }) {
  const r = rs.current;
  const photo = r?.photos.find((p) => p.id === id);
  const act = r?.activities.find((a) => a.id === photo?.activityId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ann = photo?.ann ?? {};
  const fields = photo && r ? photoFields(photo, act, r, lookup) : null;
  const auto = photo && r ? photoFields({ ...photo, ann: {} }, act, r, lookup) : null;
  const key = JSON.stringify([photo?.annotate, fields, style]);

  // Live HD preview (debounced while typing)
  useEffect(() => {
    if (!photo || !r || !canvasRef.current) return;
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      renderReportPhoto(photo, photo.annotate ? fields : null, style, 1600, canvasRef.current!)
        .then(() => alive && setErr(''))
        .catch((e: Error) => alive && setErr(e.message))
        .finally(() => alive && setBusy(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  useEffect(() => {
    if (!id) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [id, onClose]);

  if (!id || !photo || !r || !fields || !auto) return null;

  const setPhoto = (patch: Partial<typeof photo>) => rs.update((x) => ({ ...x, photos: x.photos.map((p) => (p.id === photo.id ? { ...p, ...patch } : p)) }));
  const setAnn = (k: keyof PhotoAnnotation, v: string) => setPhoto({ ann: { ...ann, [k]: v } });
  const list = r.photos;
  const idx = list.findIndex((p) => p.id === photo.id);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-950/97 lg:flex-row">
      {/* ---------- Preview */}
      <div className="relative flex min-h-[55vh] flex-1 items-center justify-center p-3 lg:min-h-0">
        <canvas ref={canvasRef} className={`max-h-full max-w-full object-contain shadow-2xl transition-opacity ${busy ? 'opacity-70' : ''}`} style={{ width: 'auto', height: 'auto' }} />
        {err && <p className="absolute text-sm text-red-300">{err}</p>}
        <button
          type="button"
          disabled={idx <= 0}
          onClick={() => onNavigate(list[idx - 1].id)}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white disabled:opacity-0"
          aria-label="Photo précédente"
        >
          <Icon name="left" className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={idx >= list.length - 1}
          onClick={() => onNavigate(list[idx + 1].id)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white disabled:opacity-0"
          aria-label="Photo suivante"
        >
          <Icon name="right" className="h-5 w-5" />
        </button>
        <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-0.5 text-xs text-slate-300">
          Photo {idx + 1} / {list.length} · {photo.original ? 'original HD conservé' : 'ancienne photo (sans original)'}
        </span>
      </div>

      {/* ---------- Panel */}
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-navy-700 bg-navy-900 p-4 lg:w-[380px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em]">Annoter la photo</h2>
          <Button size="sm" variant="ghost" icon="x" onClick={onClose} aria-label="Fermer" />
        </div>

        <div className="rounded-md border border-navy-700 px-3">
          <Toggle label="Annoter cette photo (Projet / Repère / Tâche)" checked={!!photo.annotate} onChange={(v) => setPhoto({ annotate: v })} />
        </div>
        {!photo.original && photo.annotate && (
          <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
            Cette photo a été ajoutée avant la mise à jour : elle peut déjà contenir un texte. Ajoutez-la à nouveau sur la ligne pour garder l’original HD.
          </p>
        )}

        <Field label="Ligne d’activité">
          <select className={inputCls} value={photo.activityId ?? ''} onChange={(e) => setPhoto({ activityId: e.target.value || null })}>
            <option value="">— non rattachée —</option>
            {r.activities
              .filter((a) => a.activite.trim() || a.equipement.trim())
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.projet} · {a.activite.slice(0, 60) || a.equipement}
                </option>
              ))}
          </select>
        </Field>

        <div className={`space-y-3 ${photo.annotate ? '' : 'pointer-events-none opacity-40'}`}>
          <p className="text-xs text-slate-400">Les valeurs viennent automatiquement de la ligne d’activité. Saisissez une valeur pour la remplacer sur cette photo uniquement.</p>
          {(
            [
              ['projet', 'Projet', auto.project],
              ['designation', 'Désignation', auto.designation],
              ['repere', 'Repère', auto.repere],
              ['tache', 'Tâche', auto.task],
            ] as const
          ).map(([k, label, placeholder]) => (
            <Field key={k} label={label}>
              <div className="flex gap-1">
                <input className={inputCls} placeholder={placeholder || '—'} value={ann[k] ?? ''} onChange={(e) => setAnn(k, e.target.value)} />
                {ann[k] && (
                  <Button size="sm" variant="ghost" icon="x" title="Revenir à la valeur automatique" aria-label="Valeur automatique" onClick={() => setAnn(k, '')} />
                )}
              </div>
            </Field>
          ))}
          <p className="text-[11px] text-slate-500">Style, police et logo : ceux de l’onglet Photos (Style).</p>
        </div>

        <Field label="Légende dans le rapport Excel">
          <input className={inputCls} value={photo.caption} onChange={(e) => setPhoto({ caption: e.target.value })} />
        </Field>

        <div className="flex flex-wrap gap-2 border-t border-navy-700 pt-3">
          <Button
            size="sm"
            variant="secondary"
            icon="copyDown"
            onClick={() => {
              const n = r.photos.filter((p) => p.activityId === photo.activityId && p.id !== photo.id).length;
              rs.update((x) => ({ ...x, photos: x.photos.map((p) => (p.activityId === photo.activityId ? { ...p, annotate: photo.annotate, ann: { ...photo.ann } } : p)) }));
              toast(`Annotation appliquée aux ${n} autre(s) photo(s) de la ligne.`, 'success');
            }}
          >
            Appliquer à la ligne
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            onClick={async () => {
              if (!confirm('Retirer cette photo du rapport ?')) return;
              const next = list[idx + 1] ?? list[idx - 1];
              rs.update((x) => ({ ...x, photos: x.photos.filter((p) => p.id !== photo.id) }));
              await deleteReportPhotos([photo.id]);
              if (next) onNavigate(next.id);
              else onClose();
            }}
          >
            Retirer
          </Button>
        </div>
      </aside>
    </div>
  );
}
