import { useRef, useState } from 'react';
import { createBackup, readBackup, type BackupInfo } from '../lib/backup';
import { Button, Icon, Modal, toast } from './ui';

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

export function BackupModal({ open, onClose, beforeAction }: { open: boolean; onClose: () => void; beforeAction: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ text: string; pct?: number } | null>(null);
  const [pending, setPending] = useState<{ name: string; info: BackupInfo; restore: Awaited<ReturnType<typeof readBackup>>['restore'] } | null>(null);
  const progress = (text: string, done?: number, total?: number) => setBusy({ text, pct: total ? Math.round(((done ?? 0) / total) * 100) : undefined });

  const doBackup = async () => {
    try {
      await beforeAction();
      progress('Lecture des données…');
      const info = await createBackup(progress);
      toast(`Sauvegarde créée : ${info.projects} projet(s) photo, ${info.reports} rapport(s), ${info.images} image(s).`, 'success');
    } catch (e) {
      toast(`Échec de la sauvegarde : ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    try {
      await beforeAction();
      await pending.restore(progress);
      toast('Sauvegarde restaurée. Rechargement…', 'success');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast(`Échec de la restauration : ${(e as Error).message}`, 'error');
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && (setPending(null), onClose())} title="Sauvegarde / restauration des données">
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-400">
          Vos données sont enregistrées <b className="text-slate-200">uniquement dans ce navigateur</b>. Faites régulièrement une sauvegarde et copiez le fichier sur une clé USB, un disque ou OneDrive :
          elle contient <b className="text-slate-200">tous les utilisateurs</b>, projets photo, rapports journaliers, photos originales, listes d’équipements et paramètres.
        </p>

        <section className="space-y-2 rounded-md border border-navy-700 bg-navy-950/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="download" className="h-4 w-4 text-accent" /> Sauvegarder
          </h3>
          <p className="text-xs text-slate-400">Télécharge un fichier « Sauvegarde Industrial Photo Annotator aaaa-mm-jj.zip ».</p>
          <Button variant="primary" icon="save" disabled={!!busy} onClick={() => void doBackup()}>
            Sauvegarder toutes les données
          </Button>
        </section>

        <section className="space-y-2 rounded-md border border-navy-700 bg-navy-950/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="upload" className="h-4 w-4 text-accent" /> Restaurer
          </h3>
          <p className="text-xs text-slate-400">
            Les éléments de la sauvegarde remplacent ceux qui portent le même identifiant ; les autres données déjà présentes sont conservées. Utile après un nettoyage du navigateur ou sur un nouvel
            ordinateur.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const b = await readBackup(f);
                setPending({ name: f.name, info: b.info, restore: b.restore });
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          />
          {!pending ? (
            <Button icon="upload" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              Choisir un fichier de sauvegarde…
            </Button>
          ) : (
            <div className="space-y-3 rounded border border-accent/40 bg-accent/5 p-3">
              <p className="text-sm">
                <b>{pending.name}</b>
                <br />
                <span className="text-xs text-slate-400">
                  Créée le {fmt(pending.info.createdAt)} · {pending.info.users} utilisateur(s) · {pending.info.projects} projet(s) photo · {pending.info.reports} rapport(s) · {pending.info.images} image(s)
                </span>
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={!!busy} onClick={() => setPending(null)}>
                  Annuler
                </Button>
                <Button variant="primary" icon="check" disabled={!!busy} onClick={() => void doRestore()}>
                  Restaurer cette sauvegarde
                </Button>
              </div>
            </div>
          )}
        </section>

        {busy && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{busy.text}</span>
              {busy.pct !== undefined && <span>{busy.pct} %</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
              <div className={`h-full bg-accent transition-all ${busy.pct === undefined ? 'w-1/3 animate-pulse' : ''}`} style={busy.pct !== undefined ? { width: `${busy.pct}%` } : undefined} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
