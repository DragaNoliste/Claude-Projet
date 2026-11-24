import { useEffect, useRef, useState } from 'react';
import type { ProjectStore } from '../hooks/useProject';
import { buildFields, renderAnnotated } from '../lib/render';
import { getPreviewBitmap, loadLogo } from '../lib/images';
import { Button, Icon } from './ui';

export function PreviewPane({ store, onPrev, onNext }: { store: ProjectStore; onPrev: () => void; onNext: () => void }) {
  const p = store.project!;
  const photo = p.photos.find((ph) => ph.id === store.currentId);
  const idx = photo ? p.photos.indexOf(photo) : -1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [outSize, setOutSize] = useState<string>('');

  // Re-render on any change of text/style. Rendering a ~1800px preview takes a few ms.
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    Promise.all([getPreviewBitmap(photo.id), loadLogo(p.style.logoDataUrl)])
      .then(([bmp, logo]) => {
        if (cancelled) return;
        const fields = buildFields(p, photo);
        for (const c of [canvasRef.current, fullscreen ? fullRef.current : null]) {
          if (c) renderAnnotated(c, bmp, bmp.width, bmp.height, fields, p.style, 0, logo);
        }
        // Compute the real output dimensions
        const ms = p.exportSettings.maxSize;
        const scale = ms > 0 && Math.max(photo.width, photo.height) > ms ? ms / Math.max(photo.width, photo.height) : 1;
        const c = canvasRef.current;
        if (c) setOutSize(`${Math.round(photo.width * scale)} × ${Math.round((c.height / c.width) * photo.width * scale)} px`);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [photo, p.name, p.date, p.site, p.style, p.exportSettings.maxSize, fullscreen, p]);

  useEffect(() => {
    if (!fullscreen) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [fullscreen]);

  if (!photo) {
    return (
      <div className="checker flex aspect-[16/10] items-center justify-center rounded-lg border border-navy-700 text-sm text-slate-500">
        L’aperçu de la photo annotée s’affichera ici.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="checker relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border border-navy-700 p-2 sm:p-3">
        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={() => setFullscreen(true)}
            className="max-h-[58vh] max-w-full cursor-zoom-in rounded-sm shadow-2xl shadow-black/60"
            style={{ width: 'auto', height: 'auto' }}
            title="Cliquer pour agrandir"
          />
        )}
        <button
          type="button"
          onClick={onPrev}
          disabled={idx <= 0}
          aria-label="Photo précédente"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-0"
        >
          <Icon name="left" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={idx >= p.photos.length - 1}
          aria-label="Photo suivante"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-0"
        >
          <Icon name="right" className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="truncate">
          <span className="font-semibold text-slate-200">
            Photo {idx + 1} / {p.photos.length}
          </span>{' '}
          · {photo.name}
        </span>
        <span className="flex items-center gap-3">
          <span>Sortie : {outSize}</span>
          <Button size="sm" variant="ghost" icon="expand" onClick={() => setFullscreen(true)}>
            Plein écran
          </Button>
        </span>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy-950" onClick={() => setFullscreen(false)}>
          <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-300">
            <span>
              Photo {idx + 1} / {p.photos.length} — {photo.repere || 'Sans repère'}
            </span>
            <button className="rounded p-1.5 hover:bg-white/10" aria-label="Fermer" onClick={() => setFullscreen(false)}>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <canvas ref={fullRef} className="max-h-full max-w-full object-contain" style={{ width: 'auto', height: 'auto' }} />
          </div>
        </div>
      )}
    </div>
  );
}
