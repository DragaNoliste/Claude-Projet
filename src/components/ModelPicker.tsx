import type { ProjectStore } from '../hooks/useProject';
import type { AnnotationStyle } from '../types';
import { DEFAULT_STYLE, PANEL_STYLE } from '../lib/defaults';
import { Icon, toast } from './ui';

/** Mini photo used in the model previews. */
function MiniPhoto({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(160deg,#9a9186_0%,#7d766c_55%,#5f5a53_100%)]">
      {/* steel parts */}
      <div className="absolute left-[18%] top-[22%] h-[18%] w-[46%] rounded-sm bg-[#4a3326]" />
      <div className="absolute left-[30%] top-[38%] h-[30%] w-[8%] rotate-[25deg] rounded-sm bg-[#3e2b20]" />
      <div className="absolute left-[44%] top-[38%] h-[30%] w-[8%] rotate-[25deg] rounded-sm bg-[#3e2b20]" />
      <div className="absolute left-[58%] top-[38%] h-[30%] w-[8%] rotate-[25deg] rounded-sm bg-[#3e2b20]" />
      {children}
    </div>
  );
}

function Model1Preview() {
  return (
    <div>
      <MiniPhoto />
      <div className="border-t-2 border-[#f28c28] bg-[#0f1626] px-1.5 py-1 text-left text-[6.5px] leading-[1.45]">
        {[
          ['PROJET', 'PAP-M76AAR15'],
          ['DÉSIGNATION', 'Sump Tank'],
          ['REPÈRE', 'M-55TB01'],
          ['TÂCHE', 'Assemblage…'],
        ].map(([l, v]) => (
          <div key={l} className="flex gap-1">
            <span className="w-[42px] shrink-0 font-bold text-[#f28c28]">{l}</span>
            <span className="truncate text-white">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Model2Preview() {
  return (
    <MiniPhoto>
      <div
        className="absolute inset-x-0 bottom-[6%] text-center text-[7px] leading-[1.3] text-white"
        style={{ fontFamily: 'Arial, sans-serif', textShadow: '0 0.5px 1.5px rgba(0,0,0,.9)' }}
      >
        <div>Projet: PAP-M76AAR15</div>
        <div>Designation: Sump Tank</div>
        <div>Rep: M-55TB01</div>
        <div>Tache: Assemblage Anchor Chair</div>
      </div>
      <div className="absolute bottom-[5%] left-[4%] h-[13%] w-[10%] overflow-hidden rounded-[1px]">
        <div className="h-1/2 bg-[#b5332e]" />
        <div className="h-1/2 bg-[#1f3c88]" />
      </div>
    </MiniPhoto>
  );
}

const MODELS: { key: 'panel' | 'text'; title: string; desc: string; style: AnnotationStyle; Preview: () => React.ReactElement; recommended?: boolean }[] = [
  { key: 'panel', title: 'Modèle 1 — Cartouche', desc: 'Bandeau encadré sous la photo, rien n’est masqué.', style: PANEL_STYLE, Preview: Model1Preview },
  { key: 'text', title: 'Modèle 2 — Texte sur photo', desc: 'Texte blanc centré + logo, style chantier.', style: DEFAULT_STYLE, Preview: Model2Preview, recommended: true },
];

export function ModelPicker({ store }: { store: ProjectStore }) {
  const s = store.project!.style;
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Modèle d’annotation">
      {MODELS.map((m) => {
        const active = s.layout === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return;
              // Switch the whole look, but keep the company logo the user already set.
              store.setStyle({ ...m.style, logoDataUrl: s.logoDataUrl, logoPosition: s.logoPosition, logoSize: s.logoSize });
              toast(`${m.title} appliqué à toutes les photos.`, 'success');
            }}
            className={`group relative overflow-hidden rounded-md border-2 text-left transition-all ${
              active ? 'border-accent shadow-lg shadow-accent/15' : 'border-navy-600 hover:border-slate-400'
            }`}
          >
            <m.Preview />
            <div className="space-y-0.5 bg-navy-950/80 px-2 py-1.5">
              <p className={`text-[11px] font-bold leading-tight ${active ? 'text-accent' : 'text-slate-100'}`}>{m.title}</p>
              <p className="text-[10px] leading-snug text-slate-400">{m.desc}</p>
            </div>
            {m.recommended && (
              <span className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide text-white">Recommandé</span>
            )}
            {active && (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-navy-950">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
