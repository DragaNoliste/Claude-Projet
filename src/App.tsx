import { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from './hooks/useProject';
import { EquipmentContext, useUsers } from './hooks/useUsers';
import { DataModal, UserChooser, UserMenu } from './components/UsersUI';
import { ReportsApp } from './report/ReportsApp';
import { useTaskLibrary } from './hooks/useTaskLibrary';
import { ProjectPanel } from './components/ProjectPanel';
import { StylePanel } from './components/StylePanel';
import { ExportPanel, type ExportMode, type ExportScope } from './components/ExportPanel';
import { Gallery } from './components/Gallery';
import { PreviewPane } from './components/PreviewPane';
import { BulkPanel, DetailsPanel, type Clipboard } from './components/DetailsPanel';
import { HistoryModal, ShortcutsModal, TaskLibraryModal } from './components/Modals';
import { Button, Icon, Panel, toast, Toaster } from './components/ui';
import { exportAsFiles, exportAsZip } from './lib/exporter';
import { isEditableTarget } from './lib/utils';

type LeftTab = 'project' | 'style' | 'export';

export default function App() {
  const users = useUsers();
  const store = useProject(users.currentId);
  const library = useTaskLibrary();
  const { project } = store;
  const [tab, setTab] = useState<LeftTab>('project');
  // V1 = photo annotation, V2 = daily reports
  const [mode, setModeState] = useState<'photos' | 'rapports'>(() => (localStorage.getItem('ipa-mode') === 'rapports' ? 'rapports' : 'photos'));
  const setMode = (m: 'photos' | 'rapports') => {
    setModeState(m);
    localStorage.setItem('ipa-mode', m);
  };
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [modal, setModal] = useState<'history' | 'library' | 'shortcuts' | 'data' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  const repereRef = useRef<HTMLInputElement>(null);

  const photos = project?.photos ?? [];
  const idx = photos.findIndex((p) => p.id === store.currentId);
  const current = idx >= 0 ? photos[idx] : undefined;

  // ------------------------------------------------------------ Navigation
  const go = useCallback(
    (delta: number, focus = false) => {
      if (!photos.length) return;
      const n = Math.min(photos.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + delta));
      store.setCurrentId(photos[n].id);
      if (focus) setTimeout(() => repereRef.current?.select(), 0);
    },
    [photos, idx, store],
  );

  const createNew = useCallback(async () => {
    const created = await store.newProject();
    setTab('project');
    toast(created ? 'Nouveau projet créé. Le précédent est dans l’historique.' : 'Un projet vierge est déjà ouvert.', created ? 'success' : 'info');
    setTimeout(() => document.getElementById('project-name')?.focus(), 50);
  }, [store]);

  // ------------------------------------------------------------ Copy helpers
  const copyCurrent = useCallback(() => {
    if (!current) return;
    setClipboard({ repere: current.repere, task: current.task, observations: current.observations });
    toast('Informations copiées.', 'info');
  }, [current]);
  const pasteToCurrent = useCallback(() => {
    if (!current || !clipboard) return;
    store.updatePhoto(current.id, { task: clipboard.task, observations: clipboard.observations });
    toast('Tâche et observations collées (repère conservé).', 'success');
  }, [current, clipboard, store]);
  const copyFromPrevious = useCallback(() => {
    if (!current || idx <= 0) return;
    const prev = photos[idx - 1];
    store.updatePhoto(current.id, { task: prev.task, observations: prev.observations });
    toast('Tâche copiée depuis la photo précédente.', 'success');
  }, [current, idx, photos, store]);

  // ------------------------------------------------------------ Export
  const runExport = useCallback(
    async (scope: ExportScope, mode: ExportMode) => {
      if (!project || progress) return;
      const list = scope === 'all' ? project.photos : scope === 'selected' ? project.photos.filter((p) => store.selected.has(p.id)) : current ? [current] : [];
      if (!list.length) return toast('Aucune photo à exporter.', 'error');
      if (!project.name.trim() && !confirm('Le nom du projet est vide. Exporter quand même ?')) return;
      const incomplete = list.filter((p) => !p.repere.trim() || !p.task.trim()).length;
      if (incomplete && !confirm(`${incomplete} photo(s) n’ont pas de repère ou de tâche. Exporter quand même ?`)) return;
      await store.saveNow();
      setProgress({ done: 0, total: list.length });
      try {
        const cb = (done: number, total: number) => setProgress({ done, total });
        if (mode === 'zip') await exportAsZip(project, list, cb);
        else await exportAsFiles(project, list, cb);
        toast(`${list.length} photo(s) exportée(s).`, 'success');
      } catch (e) {
        toast(`Erreur d’export : ${(e as Error).message}`, 'error');
      } finally {
        setProgress(null);
      }
    },
    [project, progress, store, current],
  );

  // ------------------------------------------------------------ Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || !project || modeRef.current !== 'photos') return;
      const editing = isEditableTarget(e.target);
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        go(e.shiftKey ? -1 : 1, true);
      } else if (ctrl && k === 'd') {
        e.preventDefault();
        copyFromPrevious();
      } else if (ctrl && e.shiftKey && k === 'c') {
        e.preventDefault();
        copyCurrent();
      } else if (ctrl && e.shiftKey && k === 'v') {
        e.preventDefault();
        pasteToCurrent();
      } else if (ctrl && k === 'e') {
        e.preventDefault();
        void runExport(e.shiftKey ? 'all' : 'current', e.shiftKey ? 'zip' : 'files');
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (editing || ctrl || e.altKey) {
        return;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === ' ' && current) {
        e.preventDefault();
        store.setSelected((s) => {
          const n = new Set(s);
          if (n.has(current.id)) n.delete(current.id);
          else n.add(current.id);
          return n;
        });
      } else if (e.key === 'Delete' && current) {
        if (confirm('Retirer cette photo du projet ?')) void store.removePhotos([current.id]);
      } else if (e.key === '?') {
        setModal('shortcuts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, project, go, copyFromPrevious, copyCurrent, pasteToCurrent, runExport, current, store]);

  // ------------------------------------------------------------ Drag & drop anywhere
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || modeRef.current !== 'photos') return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e) && modeRef.current === 'photos') e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e) || modeRef.current !== 'photos') return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) void store.addFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [store]);

  if (users.ready && !users.current) return <UserChooser users={users} />;
  if (!project || !users.current) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-400">Chargement…</div>;
  }

  // ------------------------------------------------------------ Steps
  const allDone = photos.length > 0 && photos.every((p) => p.repere.trim() && p.task.trim());
  const steps = [
    { n: 1, label: 'Projet', done: !!project.name.trim(), target: 'step-project', tab: 'project' as LeftTab },
    { n: 2, label: 'Photos', done: photos.length > 0, target: 'step-photos' },
    { n: 3, label: 'Détails', done: allDone, target: 'step-details' },
    { n: 4, label: 'Aperçu', done: allDone, target: 'step-preview' },
    { n: 5, label: 'Export', done: false, target: 'step-project', tab: 'export' as LeftTab },
  ];

  return (
    <EquipmentContext.Provider value={users.options}>
    <div className="flex min-h-screen flex-col">
      {/* ================================================================ Header */}
      <header className="sticky top-0 z-30 border-b border-navy-700 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-navy-600 bg-navy-800">
              <Icon name="image" className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-bold uppercase tracking-[0.14em] text-white">Industrial Photo Annotator</h1>
              <p className="truncate text-[11px] text-slate-400">
                {project.name || 'Nouveau projet'} ·{' '}
                <span className={store.saveState === 'saved' ? 'text-emerald-400/80' : 'text-amber-300/80'}>
                  {store.saveState === 'saved' ? 'Enregistré localement' : 'Enregistrement…'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 rounded-md border border-navy-600 bg-navy-900 p-0.5" role="tablist" aria-label="Module">
            {(
              [
                ['photos', 'image', 'Photos'],
                ['rapports', 'list', 'Rapports'],
              ] as const
            ).map(([m, ic, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${mode === m ? 'bg-accent text-navy-950' : 'text-slate-300 hover:text-white'}`}
              >
                <Icon name={ic} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <nav className={`mx-auto hidden items-center gap-1 ${mode === 'photos' ? '2xl:flex' : ''}`} aria-label="Étapes">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (s.tab) setTab(s.tab);
                    document.getElementById(s.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-navy-800"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-700 text-slate-300'
                    }`}
                  >
                    {s.done ? <Icon name="check" className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                </button>
                {i < steps.length - 1 && <span className="h-px w-4 bg-navy-600" />}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="ghost" icon="plus" onClick={() => void createNew()} title="Nouveau projet" className={`max-sm:px-2 ${mode !== 'photos' ? '!hidden' : ''}`}>
              <span className="hidden md:inline">Nouveau</span>
            </Button>
            <Button variant="ghost" icon="history" onClick={() => setModal('history')} title="Historique des projets" className={`max-sm:px-2 ${mode !== 'photos' ? '!hidden' : ''}`}>
              <span className="hidden md:inline">Historique</span>
            </Button>
            <Button variant="ghost" icon="list" onClick={() => setModal('library')} title="Bibliothèque de tâches" className={`max-sm:px-2 ${mode !== 'photos' ? '!hidden' : ''}`}>
              <span className="hidden lg:inline">Tâches</span>
            </Button>
            <Button variant="ghost" icon="folder" onClick={() => setModal('data')} title="Données : importer la liste des équipements" className="max-sm:px-2">
              <span className="hidden lg:inline">Données</span>
            </Button>
            <Button variant="ghost" icon="keyboard" onClick={() => setModal('shortcuts')} title="Raccourcis clavier (?)" className={`max-sm:hidden ${mode !== 'photos' ? '!hidden' : ''}`} />
            <Button variant="primary" icon="zip" disabled={!photos.length || !!progress} onClick={() => void runExport('all', 'zip')} className={`ml-1 ${mode !== 'photos' ? '!hidden' : ''}`}>
              <span className="hidden sm:inline">Exporter tout</span>
              <span className="sm:hidden">ZIP</span>
            </Button>
            <div className="ml-1.5"><UserMenu users={users} onOpenData={() => setModal('data')} /></div>
          </div>
        </div>
      </header>

      {/* ================================================================ Main */}
      {mode === 'rapports' ? (
        <div className="flex-1">
          <ReportsApp key={users.current.id} users={users} style={project.style} />
        </div>
      ) : (
      <main className="mx-auto grid w-full max-w-[1800px] flex-1 gap-4 p-3 sm:p-5 lg:grid-cols-[300px_minmax(0,1fr)_340px] xl:grid-cols-[330px_minmax(0,1fr)_380px]">
        {/* ---------- Left: project / style / export */}
        <aside id="step-project" className="scroll-mt-20 space-y-4">
          <div className="overflow-hidden rounded-lg border border-navy-700 bg-navy-900/80 lg:sticky lg:top-[72px]">
            <div className="grid grid-cols-3 border-b border-navy-700">
              {(
                [
                  ['project', '1 · Projet'],
                  ['style', 'Style'],
                  ['export', '5 · Export'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`border-b-2 px-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    tab === k ? 'border-accent text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="p-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
              {tab === 'project' && <ProjectPanel store={store} />}
              {tab === 'style' && <StylePanel store={store} />}
              {tab === 'export' && <ExportPanel store={store} busy={!!progress} onExport={(s, m) => void runExport(s, m)} />}
            </div>
          </div>
        </aside>

        {/* ---------- Center: gallery + preview */}
        <section className="min-w-0 space-y-4">
          <Panel id="step-photos" step={2} title={`Photos (${photos.length})`} className="scroll-mt-20">
            <Gallery store={store} />
            {store.importing && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Import et optimisation des photos…</span>
                  <span>
                    {store.importing.done} / {store.importing.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(store.importing.done / store.importing.total) * 100}%` }} />
                </div>
              </div>
            )}
          </Panel>
          <Panel id="step-preview" step={4} title="Aperçu en direct" className="scroll-mt-20">
            <PreviewPane store={store} onPrev={() => go(-1)} onNext={() => go(1)} />
          </Panel>
        </section>

        {/* ---------- Right: details + bulk */}
        <aside className="min-w-0 space-y-4">
          <Panel
            id="step-details"
            step={3}
            title="Détails de la photo"
            className="scroll-mt-20"
            right={current && <span className="rounded bg-navy-700 px-2 py-0.5 text-[11px] font-semibold text-slate-200">{idx + 1} / {photos.length}</span>}
          >
            <DetailsPanel
              store={store}
              library={library}
              repereRef={repereRef}
              clipboard={clipboard}
              onCopy={copyCurrent}
              onPaste={pasteToCurrent}
              onCopyPrevious={copyFromPrevious}
              onOpenLibrary={() => setModal('library')}
              onNext={() => go(1, true)}
            />
          </Panel>
          <Panel title={`Saisie groupée${store.selected.size ? ` (${store.selected.size})` : ''}`}>
            <BulkPanel store={store} />
          </Panel>
        </aside>
      </main>
      )}

      <footer className="border-t border-navy-800 px-5 py-3 text-center text-[11px] text-slate-500">
        100 % local — vos photos ne quittent jamais cet ordinateur. Appuyez sur <span className="font-mono text-slate-400">?</span> pour les raccourcis clavier.
      </footer>

      {/* ================================================================ Overlays */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-accent px-16 py-12 text-center">
            <Icon name="upload" className="h-10 w-10 text-accent" />
            <p className="text-lg font-semibold text-white">Déposez vos photos pour les ajouter au projet</p>
          </div>
        </div>
      )}
      {progress && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[min(90vw,380px)] rounded-xl border border-navy-600 bg-navy-900 p-6 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-200">Génération des photos annotées</p>
            <p className="mt-1 text-xs text-slate-400">Pleine résolution — traitement local</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-700">
              <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {progress.done} / {progress.total}
            </p>
          </div>
        </div>
      )}

      <HistoryModal
        open={modal === 'history'}
        onClose={() => setModal(null)}
        currentId={project.id}
        ownerId={users.current.id}
        ownerName={users.current.name}
        onOpen={async (id) => {
          setModal(null);
          if (await store.loadProject(id)) toast('Projet ouvert.', 'success');
        }}
        onNew={async () => {
          setModal(null);
          await createNew();
        }}
      />
      <TaskLibraryModal open={modal === 'library'} onClose={() => setModal(null)} library={library} />
      <ShortcutsModal open={modal === 'shortcuts'} onClose={() => setModal(null)} />
      <DataModal open={modal === 'data'} onClose={() => setModal(null)} users={users} />
      <Toaster />
    </div>
    </EquipmentContext.Provider>
  );
}
