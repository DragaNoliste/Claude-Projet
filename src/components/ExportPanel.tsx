import type { ProjectStore } from '../hooks/useProject';
import type { ExportFormat, NamingPattern } from '../types';
import { MAX_SIZE_OPTIONS } from '../lib/defaults';
import { fileNameFor } from '../lib/exporter';
import { Button, Field, inputCls, Segmented } from './ui';

export type ExportScope = 'current' | 'selected' | 'all';
export type ExportMode = 'zip' | 'files';

export function ExportPanel({
  store,
  onExport,
  busy,
}: {
  store: ProjectStore;
  onExport: (scope: ExportScope, mode: ExportMode) => void;
  busy: boolean;
}) {
  const p = store.project!;
  const s = p.exportSettings;
  const total = p.photos.length;
  const sel = store.selected.size;
  const current = p.photos.find((ph) => ph.id === store.currentId);
  const currentIdx = current ? p.photos.indexOf(current) : -1;

  return (
    <div className="space-y-4">
      <Field label="Format de sortie">
        <Segmented<ExportFormat>
          value={s.format}
          options={[
            { value: 'jpeg', label: 'JPG' },
            { value: 'png', label: 'PNG (sans perte)' },
          ]}
          onChange={(format) => store.updateExport({ format })}
        />
      </Field>
      {s.format === 'jpeg' && (
        <Field label={`Qualité JPG : ${Math.round(s.quality * 100)} %`} hint="92 % = excellent compromis qualité / poids.">
          <input type="range" min={0.5} max={1} step={0.01} value={s.quality} onChange={(e) => store.updateExport({ quality: +e.target.value })} className="w-full" />
        </Field>
      )}
      <Field label="Dimensions" htmlFor="maxsize">
        <select id="maxsize" className={inputCls} value={s.maxSize} onChange={(e) => store.updateExport({ maxSize: +e.target.value })}>
          {MAX_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nom des fichiers" htmlFor="naming" hint={current ? <>Ex. : <span className="font-mono text-slate-400">{fileNameFor(current, currentIdx, total, s)}</span></> : undefined}>
        <select id="naming" className={inputCls} value={s.naming} onChange={(e) => store.updateExport({ naming: e.target.value as NamingPattern })}>
          <option value="index-repere">N° + Repère</option>
          <option value="index-repere-task">N° + Repère + Tâche</option>
          <option value="original">Nom d’origine</option>
        </select>
      </Field>

      <div className="space-y-2 border-t border-navy-700 pt-4">
        <Button variant="primary" icon="zip" className="w-full" disabled={!total || busy} onClick={() => onExport('all', 'zip')}>
          Tout exporter en ZIP ({total})
        </Button>
        <Button icon="download" className="w-full" disabled={!total || busy} onClick={() => onExport('all', 'files')}>
          Tout exporter (fichiers séparés)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button icon="image" size="sm" disabled={!current || busy} onClick={() => onExport('current', 'files')}>
            Photo actuelle
          </Button>
          <Button icon="check" size="sm" disabled={!sel || busy} onClick={() => onExport('selected', sel > 1 ? 'zip' : 'files')}>
            Sélection ({sel})
          </Button>
        </div>
        <p className="text-xs text-slate-500">Traitement 100 % local : aucune photo n’est envoyée sur Internet.</p>
      </div>
    </div>
  );
}
