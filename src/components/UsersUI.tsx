import { useEffect, useMemo, useRef, useState } from 'react';
import type { UsersStore } from '../hooks/useUsers';
import { buildOptions, type EquipmentGroup } from '../lib/projectList';
import { countItems, groupsToCsv, mergeGroups, parseFile, parseText } from '../lib/importList';
import { downloadBlob } from '../lib/exporter';
import { Button, Field, Icon, inputCls, Modal, Segmented, toast, Toggle } from './ui';

const initials = (name: string) => name.slice(0, 2).toUpperCase();

// ------------------------------------------------------------------ Start screen
export function UserChooser({ users }: { users: UsersStore }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const add = () => {
    const u = users.addUser(name);
    if (!u) return toast('Nom vide ou déjà utilisé.', 'error');
    void users.selectUser(u.id);
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-navy-600 bg-navy-900/90 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-navy-600 bg-navy-800">
            <Icon name="image" className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Industrial Photo Annotator</h1>
            <p className="text-xs text-slate-400">Qui utilise l’application ?</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {users.users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => void users.selectUser(u.id)}
              className="group flex items-center gap-3 rounded-lg border-2 border-navy-600 bg-navy-950/60 p-4 text-left transition-colors hover:border-accent"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent group-hover:bg-accent group-hover:text-navy-950">
                {initials(u.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold tracking-wide text-white">{u.name}</span>
                <span className="block truncate text-xs text-slate-400">
                  {u.equipment.map((g) => g.group).join(' · ') || 'Liste vide'} — {countItems(u.equipment)} équip.
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          {adding ? (
            <div className="flex gap-2">
              <input autoFocus className={inputCls} placeholder="Nom du nouvel utilisateur" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
              <Button variant="primary" onClick={add}>
                Créer
              </Button>
            </div>
          ) : (
            <Button variant="ghost" icon="plus" size="sm" onClick={() => setAdding(true)}>
              Ajouter un utilisateur
            </Button>
          )}
        </div>
        <p className="mt-5 text-xs text-slate-500">Chaque utilisateur a sa propre liste d’équipements et son propre historique de projets, enregistrés sur cet ordinateur.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Header menu
export function UserMenu({ users, onOpenData }: { users: UsersStore; onOpenData: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const cur = users.current!;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-md border border-navy-600 bg-navy-800 pl-1 pr-2 text-sm text-slate-100 hover:border-accent/60"
        title="Changer d’utilisateur"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-navy-950">{initials(cur.name)}</span>
        <span className="hidden font-semibold tracking-wide sm:inline">{cur.name}</span>
        <Icon name="down" className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-navy-600 bg-navy-900 shadow-2xl">
          <p className="border-b border-navy-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-steel">Utilisateur</p>
          {users.users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (u.id !== cur.id) {
                  void users.selectUser(u.id);
                  toast(`Bonjour ${u.name} — vos projets et votre liste sont chargés.`, 'success');
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-navy-700"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">{initials(u.name)}</span>
              <span className="flex-1 font-medium">{u.name}</span>
              {u.id === cur.id && <Icon name="check" className="h-4 w-4 text-accent" />}
            </button>
          ))}
          <div className="border-t border-navy-700">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenData();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-navy-700"
            >
              <Icon name="folder" className="h-4 w-4 text-steel" /> Données / import de la liste
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void users.selectUser(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-navy-700"
            >
              <Icon name="history" className="h-4 w-4 text-steel" /> Écran de choix / ajouter un utilisateur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Data / import window
function GroupSummary({ groups, onRemove }: { groups: EquipmentGroup[]; onRemove?: (g: string) => void }) {
  if (!groups.length) return <p className="text-sm text-slate-500">Aucun équipement.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((g) => (
        <span key={g.group} className="inline-flex items-center gap-1.5 rounded border border-navy-600 bg-navy-950/60 py-1 pl-2 pr-1 text-xs text-slate-200">
          <span className="font-semibold text-accent">{g.group}</span>
          <span className="text-slate-400">{g.items.length}</span>
          {onRemove && (
            <button type="button" className="rounded p-0.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300" aria-label={`Supprimer ${g.group}`} onClick={() => onRemove(g.group)}>
              <Icon name="x" className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function DataModal({ open, onClose, users }: { open: boolean; onClose: () => void; users: UsersStore }) {
  const cur = users.current;
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<{ groups: EquipmentGroup[]; source: string } | null>(null);
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setParsed(null);
      setPaste('');
    }
  }, [open]);

  const example = useMemo(() => {
    if (!cur) return null;
    const src = parsed?.groups.length ? parsed.groups : cur.equipment;
    const o = buildOptions(src.slice(0, 1).map((g) => ({ ...g, items: g.items.slice(0, 1) })), cur)[0]?.items[0];
    return o ?? null;
  }, [cur, parsed]);

  if (!cur) return null;

  const analyse = (groups: EquipmentGroup[], source: string) => {
    if (!groups.length) {
      toast('Aucun équipement reconnu. Vérifiez le format (titre du groupe, puis lignes No. / Tank Name / Client Tag).', 'error');
      return;
    }
    setParsed({ groups, source });
  };

  const confirmImport = () => {
    if (!parsed) return;
    const next = mode === 'replace' ? parsed.groups : mergeGroups(cur.equipment, parsed.groups);
    users.updateCurrent({ equipment: next });
    toast(`Liste de ${cur.name} mise à jour : ${countItems(next)} équipements.`, 'success');
    setParsed(null);
    setPaste('');
  };

  return (
    <Modal open={open} onClose={onClose} title={`Données — liste de ${cur.name}`} wide>
      <div className="space-y-6">
        {/* Current list */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-steel">
              Liste actuelle — {countItems(cur.equipment)} équipements
            </h3>
            <Button
              size="sm"
              variant="ghost"
              icon="download"
              disabled={!cur.equipment.length}
              onClick={() => downloadBlob(new Blob([groupsToCsv(cur.equipment)], { type: 'text/csv;charset=utf-8' }), `Liste_${cur.name}.csv`)}
            >
              Exporter (Excel CSV)
            </Button>
          </div>
          <GroupSummary
            groups={cur.equipment}
            onRemove={(g) => {
              if (confirm(`Retirer le groupe « ${g} » de la liste de ${cur.name} ?`)) users.updateCurrent({ equipment: cur.equipment.filter((x) => x.group !== g) });
            }}
          />
        </section>

        {/* Import */}
        <section className="space-y-3 border-t border-navy-700 pt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-steel">Importer une nouvelle liste</h3>
          <p className="text-xs leading-relaxed text-slate-400">
            Même présentation que vos tableaux : une ligne avec le <b className="text-slate-200">nom du groupe</b> (ex. CHEMITECS), puis les colonnes{' '}
            <b className="text-slate-200">No. · Tank Name · Client Tag</b>. Les autres colonnes (Liste déroulante, Poids…) sont ignorées.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt,.tsv,.xls"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              try {
                analyse(await parseFile(f), f.name);
              } catch (err) {
                toast((err as Error).message || 'Fichier illisible.', 'error');
              } finally {
                setBusy(false);
              }
            }}
          />
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
            <Button variant="primary" icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
              Fichier Excel / CSV
            </Button>
            <div className="space-y-2">
              <textarea
                rows={4}
                className={`${inputCls} font-mono text-xs`}
                placeholder={'…ou copiez les cellules dans Excel (Ctrl+C) et collez-les ici (Ctrl+V)\n\nCHEMITECS\nNo.\tTank Name\tClient Tag\n5553\tINTER ACID TOWER TRAIN B\tLEVEL 1'}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <Button size="sm" disabled={!paste.trim()} onClick={() => analyse(parseText(paste), 'texte collé')}>
                Analyser le texte collé
              </Button>
            </div>
          </div>

          {parsed && (
            <div className="space-y-3 rounded-md border border-accent/40 bg-accent/5 p-3">
              <p className="text-sm text-slate-200">
                <b>{countItems(parsed.groups)}</b> équipements trouvés dans <span className="text-slate-400">{parsed.source}</span> :
              </p>
              <GroupSummary groups={parsed.groups} />
              <div className="max-h-28 overflow-y-auto rounded border border-navy-700 bg-navy-950/60 p-2 font-mono text-[11px] text-slate-300">
                {parsed.groups.flatMap((g) => g.items.slice(0, 3).map((it, i) => <div key={`${g.group}-${i}`}>{[g.group, it.no, it.name, it.tag].join(' | ')}</div>))}
              </div>
              <Segmented<'add' | 'replace'>
                value={mode}
                options={[
                  { value: 'add', label: 'Ajouter à la liste actuelle' },
                  { value: 'replace', label: 'Remplacer toute la liste' },
                ]}
                onChange={setMode}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setParsed(null)}>
                  Annuler
                </Button>
                <Button variant="primary" icon="check" onClick={confirmImport}>
                  Importer pour {cur.name}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Format */}
        <section className="space-y-3 border-t border-navy-700 pt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-steel">Texte écrit sur la photo quand on choisit un équipement</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Projet" htmlFor="fmt-project">
              <input id="fmt-project" className={`${inputCls} font-mono`} value={cur.projectFormat} onChange={(e) => users.updateCurrent({ projectFormat: e.target.value })} />
            </Field>
            <Field label="Designation" htmlFor="fmt-desig">
              <input id="fmt-desig" className={`${inputCls} font-mono`} value={cur.designationFormat} onChange={(e) => users.updateCurrent({ designationFormat: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            Mots-clés : <span className="font-mono text-slate-300">{'{groupe}'}</span> · <span className="font-mono text-slate-300">{'{no}'}</span> ·{' '}
            <span className="font-mono text-slate-300">{'{nom}'}</span> · <span className="font-mono text-slate-300">{'{tag}'}</span>
          </p>
          <div className="rounded-md border border-navy-700 px-3">
            <Toggle label="Mettre les noms en forme (SUMP TANK → Sump Tank)" checked={cur.niceCase} onChange={(niceCase) => users.updateCurrent({ niceCase })} />
          </div>
          {example && (
            <div className="rounded-md border border-navy-700 bg-[linear-gradient(160deg,#8a8278,#5f5a53)] px-3 py-2.5 text-center text-sm text-white" style={{ fontFamily: 'Arial, sans-serif', textShadow: '0 1px 2px rgba(0,0,0,.9)' }}>
              <div>Projet: {example.code}</div>
              <div>Designation: {example.designation}</div>
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
