import { useEffect, useRef, useState } from 'react';
import type { ProjectStore } from '../hooks/useProject';
import { ModelPicker } from './ModelPicker';
import type { AnnotationStyle, LogoPosition, PanelPosition, StyleTemplate } from '../types';
import { logoFileToDataUrl } from '../lib/images';
import { BUILTIN_TEMPLATES, FONT_OPTIONS } from '../lib/defaults';
import { db } from '../lib/db';
import { uid } from '../lib/utils';
import { Button, Field, Icon, inputCls, Segmented, toast, Toggle } from './ui';

const POSITIONS: { value: PanelPosition; label: string }[] = [
  { value: 'bottom', label: 'Bas' },
  { value: 'top', label: 'Haut' },
  { value: 'bottom-left', label: 'Bas G.' },
  { value: 'bottom-right', label: 'Bas D.' },
];

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 shrink-0" />
      {label}
    </label>
  );
}

export function StylePanel({ store }: { store: ProjectStore }) {
  const s = store.project!.style;
  const set = (patch: Partial<AnnotationStyle>) => store.updateStyle(patch);
  const isBand = s.position === 'top' || s.position === 'bottom';
  const isText = s.layout === 'text';
  const logoInput = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [newName, setNewName] = useState('');
  useEffect(() => {
    db.kvGet<StyleTemplate[]>('templates').then((t) => setTemplates(t ?? []));
  }, []);
  const persist = (list: StyleTemplate[]) => {
    setTemplates(list);
    void db.kvSet('templates', list);
  };

  const saveTemplate = () => {
    const name = newName.trim();
    if (!name) return toast('Donnez un nom au modèle.', 'error');
    const existing = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) persist(templates.map((t) => (t.id === existing.id ? { ...t, style: { ...s } } : t)));
    else persist([...templates, { id: uid(), name, style: { ...s } }]);
    setNewName('');
    toast(existing ? `Modèle « ${name} » mis à jour.` : `Modèle « ${name} » enregistré.`, 'success');
  };

  const all = [...BUILTIN_TEMPLATES, ...templates];

  return (
    <div className="space-y-5">
      <Field label="Modèle d’annotation" hint="Les réglages ci-dessous personnalisent le modèle choisi.">
        <ModelPicker store={store} />
      </Field>
      <Field label={isText ? 'Position du texte' : 'Position du cartouche'}>
        <Segmented value={s.position} options={POSITIONS} onChange={(position) => set({ position })} />
      </Field>
      {isText ? null : isBand ? (
        <Field
          label="Placement"
          hint={s.mode === 'extend' ? 'Le bandeau est ajouté en dehors de la photo : rien n’est masqué.' : 'Le bandeau est dessiné sur la photo (semi-transparent).'}
        >
          <Segmented
            value={s.mode}
            options={[
              { value: 'extend', label: 'Hors photo (recommandé)' },
              { value: 'overlay', label: 'Sur la photo' },
            ]}
            onChange={(mode) => set({ mode })}
          />
        </Field>
      ) : (
        <Field label={`Largeur de l’encart : ${Math.round(s.cornerWidth * 100)} %`}>
          <input type="range" min={0.3} max={0.9} step={0.02} value={s.cornerWidth} onChange={(e) => set({ cornerWidth: +e.target.value })} className="w-full" />
        </Field>
      )}

      <Field label={`Taille du texte : ${Math.round(s.fontScale * 100)} %`}>
        <input type="range" min={0.6} max={1.8} step={0.05} value={s.fontScale} onChange={(e) => set({ fontScale: +e.target.value })} className="w-full" />
      </Field>

      <Field label="Police" htmlFor="font">
        <select id="font" className={inputCls} value={s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <ColorInput label="Texte" value={s.textColor} onChange={(textColor) => set({ textColor })} />
        <ColorInput label="Libellés" value={s.labelColor} onChange={(labelColor) => set({ labelColor })} />
        {!isText && <ColorInput label="Fond" value={s.bgColor} onChange={(bgColor) => set({ bgColor })} />}
        {!isText && <ColorInput label="Accent" value={s.accentColor} onChange={(accentColor) => set({ accentColor })} />}
      </div>

      {isText ? (
        <Field label={`Ombre du texte : ${Math.round(s.shadowStrength * 100)} %`}>
          <input type="range" min={0} max={1} step={0.05} value={s.shadowStrength} onChange={(e) => set({ shadowStrength: +e.target.value })} className="w-full" />
        </Field>
      ) : (
        !(isBand && s.mode === 'extend') && (
          <Field label={`Opacité du fond : ${Math.round(s.bgOpacity * 100)} %`}>
            <input type="range" min={0.3} max={1} step={0.02} value={s.bgOpacity} onChange={(e) => set({ bgOpacity: +e.target.value })} className="w-full" />
          </Field>
        )
      )}

      <div className="divide-y divide-navy-700/60 rounded-md border border-navy-700 px-3">
        {isText ? (
          <Toggle label="Contour noir des lettres" checked={s.textOutline} onChange={(textOutline) => set({ textOutline })} />
        ) : (
          <>
            <Toggle label="Barre d’accent" checked={s.showAccentBar} onChange={(showAccentBar) => set({ showAccentBar })} />
            <Toggle label="Lignes de séparation" checked={s.showSeparators} onChange={(showSeparators) => set({ showSeparators })} />
          </>
        )}
        <Toggle label="Afficher la date" checked={s.showDate} onChange={(showDate) => set({ showDate })} />
        <Toggle label="Afficher le site" checked={s.showSite} onChange={(showSite) => set({ showSite })} />
        <Toggle label="Afficher les observations" checked={s.showObservations} onChange={(showObservations) => set({ showObservations })} />
        <Toggle label="Valeurs en MAJUSCULES" checked={s.uppercaseValues} onChange={(uppercaseValues) => set({ uppercaseValues })} />
      </div>

      {/* ---------------- Logo */}
      <div className="space-y-2.5 border-t border-navy-700 pt-4">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-steel">
          <Icon name="image" className="h-3.5 w-3.5" /> Logo (optionnel)
        </h3>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              set({ logoDataUrl: await logoFileToDataUrl(f) });
              toast('Logo ajouté.', 'success');
            } catch {
              toast('Image de logo illisible (utilisez PNG ou JPG).', 'error');
            }
          }}
        />
        <div className="flex items-center gap-2">
          <div className="checker flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-navy-600">
            {s.logoDataUrl ? <img src={s.logoDataUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Icon name="image" className="h-5 w-5 text-slate-600" />}
          </div>
          <Button size="sm" icon="upload" onClick={() => logoInput.current?.click()}>
            {s.logoDataUrl ? 'Changer' : 'Ajouter un logo'}
          </Button>
          {s.logoDataUrl && <Button size="sm" variant="danger" icon="trash" aria-label="Retirer le logo" onClick={() => set({ logoDataUrl: '' })} />}
        </div>
        {s.logoDataUrl && (
          <>
            <Segmented<LogoPosition>
              value={s.logoPosition}
              options={[
                { value: 'bottom-left', label: 'Bas G.' },
                { value: 'bottom-right', label: 'Bas D.' },
                { value: 'top-left', label: 'Haut G.' },
                { value: 'top-right', label: 'Haut D.' },
              ]}
              onChange={(logoPosition) => set({ logoPosition })}
            />
            <Field label={`Taille du logo : ${Math.round(s.logoSize * 100)} %`}>
              <input type="range" min={0.05} max={0.3} step={0.01} value={s.logoSize} onChange={(e) => set({ logoSize: +e.target.value })} className="w-full" />
            </Field>
          </>
        )}
      </div>

      {/* ---------------- Templates */}
      <div className="space-y-2.5 border-t border-navy-700 pt-4">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-steel">
          <Icon name="layers" className="h-3.5 w-3.5" /> Modèles de style
        </h3>
        <ul className="space-y-1">
          {all.map((t) => (
            <li key={t.id} className="group flex items-center gap-1 rounded-md border border-navy-700 bg-navy-950/40 pr-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm text-slate-200 hover:text-white"
                onClick={() => {
                  // Built-in models have no logo: keep the one already set.
                  store.setStyle(t.builtin ? { ...t.style, logoDataUrl: s.logoDataUrl, logoPosition: s.logoPosition, logoSize: s.logoSize } : t.style);
                  toast(`Modèle « ${t.name} » appliqué.`, 'success');
                }}
                title="Appliquer ce modèle"
              >
                <span className="flex h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-white/10">
                  <span className="w-1/3" style={{ background: t.style.accentColor }} />
                  <span className="flex-1" style={{ background: t.style.bgColor }} />
                </span>
                <span className="truncate">{t.name}</span>
              </button>
              {!t.builtin && (
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                  title="Supprimer le modèle"
                  onClick={() => {
                    if (confirm(`Supprimer le modèle « ${t.name} » ?`)) persist(templates.filter((x) => x.id !== t.id));
                  }}
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Nom du nouveau modèle"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
          />
          <Button icon="save" onClick={saveTemplate} title="Enregistrer le style actuel comme modèle">
            Enregistrer
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={async () => {
            await db.kvSet('defaultStyle', s);
            toast('Style défini par défaut pour les nouveaux projets.', 'success');
          }}
        >
          Utiliser ce style par défaut pour les nouveaux projets
        </Button>
      </div>
    </div>
  );
}
