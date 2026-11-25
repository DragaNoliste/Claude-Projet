import type { ProjectStore } from '../hooks/useProject';
import { Field, inputCls } from './ui';
import { ProjectCombobox } from './ProjectCombobox';
import { ModelPicker } from './ModelPicker';

export function ProjectPanel({ store }: { store: ProjectStore }) {
  const p = store.project!;
  const total = p.photos.length;
  const complete = p.photos.filter((ph) => ph.repere.trim() && ph.task.trim()).length;
  return (
    <div className="space-y-4">
      <Field label="Projet *" htmlFor="project-name" hint="Tapez pour filtrer (tag, n° ou nom du bac), ou saisissez un nom libre.">
        <ProjectCombobox
          value={p.name}
          designation={p.designation}
          onChange={(name) => store.updateProject({ name })}
          onPick={(o) => store.updateProject({ name: o.code, designation: o.designation })}
        />
      </Field>
      <Field label="Désignation" htmlFor="project-designation">
        <input
          id="project-designation"
          className={inputCls}
          placeholder="Remplie automatiquement depuis la liste"
          value={p.designation}
          onChange={(e) => store.updateProject({ designation: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date *" htmlFor="project-date">
          <input id="project-date" type="date" className={inputCls} value={p.date} onChange={(e) => store.updateProject({ date: e.target.value })} />
        </Field>
        <Field label="Site / Zone" htmlFor="project-site">
          <input id="project-site" className={inputCls} placeholder="Optionnel" value={p.site} onChange={(e) => store.updateProject({ site: e.target.value })} />
        </Field>
      </div>
      <Field label="Modèle d’annotation" hint="Réglages détaillés (police, couleurs, logo…) dans l’onglet Style.">
        <ModelPicker store={store} />
      </Field>
      <p className="text-xs leading-relaxed text-slate-500">
        Ces informations s’appliquent automatiquement à toutes les photos, sauf si elles sont personnalisées individuellement.
      </p>
      {total > 0 && (
        <div className="rounded-md border border-navy-700 bg-navy-950/50 p-3">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-slate-400">Photos renseignées</span>
            <span className={complete === total ? 'font-semibold text-emerald-400' : 'font-semibold text-slate-200'}>
              {complete} / {total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(complete / total) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
