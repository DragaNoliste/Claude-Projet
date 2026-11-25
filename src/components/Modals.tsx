import { useEffect, useState } from 'react';
import type { TaskLibrary } from '../hooks/useTaskLibrary';
import type { ProjectRecord } from '../types';
import { db } from '../lib/db';
import { formatDate } from '../lib/utils';
import { thumbUrlFor } from '../lib/images';
import { ownerOf } from '../hooks/useProject';
import { Button, Icon, inputCls, Kbd, Modal, toast } from './ui';

// ------------------------------------------------------------------ Task library
export function TaskLibraryModal({ open, onClose, library }: { open: boolean; onClose: () => void; library: TaskLibrary }) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const commitEdit = () => {
    if (editing !== null) library.edit(editing, editText);
    setEditing(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Bibliothèque de tâches">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Nouvelle description (ex. Travaux de soudage sur {repere}.)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                library.add(draft);
                setDraft('');
              }
            }}
          />
          <Button
            variant="primary"
            icon="plus"
            disabled={!draft.trim()}
            onClick={() => {
              library.add(draft);
              setDraft('');
            }}
          >
            Ajouter
          </Button>
        </div>
        <ul className="divide-y divide-navy-700 rounded-md border border-navy-700">
          {library.tasks.map((t, i) => (
            <li key={`${t}-${i}`} className="flex items-center gap-1 px-2 py-1.5">
              {editing === i ? (
                <input
                  autoFocus
                  className={inputCls}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate px-1 text-sm text-slate-200" title={t}>
                  {t}
                </span>
              )}
              <button className="rounded p-1.5 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => library.move(i, -1)} aria-label="Monter">
                <Icon name="up" className="h-3.5 w-3.5" />
              </button>
              <button className="rounded p-1.5 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-30" disabled={i === library.tasks.length - 1} onClick={() => library.move(i, 1)} aria-label="Descendre">
                <Icon name="down" className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded p-1.5 text-slate-400 hover:bg-navy-700 hover:text-white"
                onClick={() => {
                  setEditing(i);
                  setEditText(t);
                }}
                aria-label="Modifier"
              >
                <Icon name="edit" className="h-3.5 w-3.5" />
              </button>
              <button className="rounded p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300" onClick={() => library.remove(i)} aria-label="Supprimer">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {!library.tasks.length && <li className="p-3 text-sm text-slate-500">La bibliothèque est vide.</li>}
        </ul>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Rétablir la liste de tâches par défaut ?')) library.reset();
            }}
          >
            Rétablir la liste par défaut
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Project history
function ProjectThumb({ project }: { project: ProjectRecord }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const first = project.photos[0];
    if (!first) return;
    let u = '';
    thumbUrlFor(first.id).then((x) => {
      u = x;
      setUrl(x);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [project]);
  return (
    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-navy-800 text-slate-600">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon name="image" className="h-6 w-6" />}
    </div>
  );
}

export function HistoryModal({
  open,
  onClose,
  currentId,
  ownerId,
  ownerName,
  onOpen,
  onNew,
}: {
  open: boolean;
  onClose: () => void;
  currentId: string;
  ownerId: string;
  ownerName: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [q, setQ] = useState('');
  const refresh = () => db.listProjects().then(setProjects);
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const list = (projects ?? []).filter((p) => ownerOf(p) === ownerId).filter((p) => `${p.name} ${p.site} ${p.date}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal open={open} onClose={onClose} title={`Historique des projets — ${ownerName}`} wide>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Rechercher un projet…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="primary" icon="plus" onClick={onNew}>
            Nouveau
          </Button>
        </div>
        {projects === null ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : !list.length ? (
          <p className="text-sm text-slate-500">Aucun projet enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => {
              const done = p.photos.filter((ph) => ph.repere && ph.task).length;
              return (
                <li key={p.id} className={`flex items-center gap-3 rounded-md border p-2 ${p.id === currentId ? 'border-accent/60 bg-accent/5' : 'border-navy-700 bg-navy-950/40'}`}>
                  <ProjectThumb project={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {p.name || <span className="italic text-slate-500">Projet sans nom</span>}
                      {p.id === currentId && <span className="ml-2 text-[10px] font-medium uppercase text-accent">en cours</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {formatDate(p.date)}
                      {p.site && ` · ${p.site}`} · {p.photos.length} photo(s) · {done}/{p.photos.length} renseignées
                    </p>
                    <p className="text-[11px] text-slate-500">Modifié le {new Date(p.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant={p.id === currentId ? 'secondary' : 'primary'} disabled={p.id === currentId} onClick={() => onOpen(p.id)}>
                      Ouvrir
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon="trash"
                      disabled={p.id === currentId}
                      title={p.id === currentId ? 'Impossible de supprimer le projet en cours' : 'Supprimer définitivement'}
                      aria-label="Supprimer"
                      onClick={async () => {
                        if (!confirm(`Supprimer définitivement « ${p.name || 'Projet sans nom'} » et ses ${p.photos.length} photo(s) stockées localement ? Cette action est irréversible.`)) return;
                        await db.deleteProject(p);
                        toast('Projet supprimé.', 'success');
                        void refresh();
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-slate-500">Les projets et photos sont enregistrés uniquement dans ce navigateur, sur cet ordinateur.</p>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Shortcuts
export const SHORTCUTS: [string[], string][] = [
  [['→', 'PgDn'], 'Photo suivante (hors champ de saisie)'],
  [['←', 'PgUp'], 'Photo précédente (hors champ de saisie)'],
  [['Ctrl', 'Entrée'], 'Photo suivante + curseur dans « Repère » (fonctionne partout)'],
  [['Ctrl', 'Maj', 'Entrée'], 'Photo précédente + curseur dans « Repère »'],
  [['Entrée'], 'Dans « Repère » : passer à « Tâche réalisée »'],
  [['Ctrl', 'D'], 'Copier tâche + observations de la photo précédente'],
  [['Ctrl', 'Maj', 'C'], 'Copier les infos de la photo'],
  [['Ctrl', 'Maj', 'V'], 'Coller les infos copiées'],
  [['Espace'], 'Cocher / décocher la photo actuelle'],
  [['Ctrl', 'S'], 'Enregistrer maintenant (photos et rapports)'],
  [['Ctrl', 'E'], 'Exporter la photo actuelle'],
  [['Ctrl', 'Maj', 'E'], 'Tout exporter en ZIP'],
  [['Suppr'], 'Retirer la photo actuelle'],
  [['?'], 'Afficher cette aide'],
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Raccourcis clavier">
      <ul className="divide-y divide-navy-700">
        {SHORTCUTS.map(([keys, desc]) => (
          <li key={desc} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-slate-300">{desc}</span>
            <span className="flex shrink-0 gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
