import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationStyle, ExportSettings, PhotoData, ProjectRecord } from '../types';
import { db } from '../lib/db';
import { DEFAULT_EXPORT, DEFAULT_STYLE } from '../lib/defaults';
import { forgetPreview, processAndStore, thumbUrlFor } from '../lib/images';
import { todayISO, uid } from '../lib/utils';
import { toast } from '../components/ui';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i;

/** Projects saved before user profiles existed belong to Khalid. */
export const LEGACY_OWNER = 'khalid';
export const ownerOf = (p: Pick<ProjectRecord, 'ownerId'>) => p.ownerId || LEGACY_OWNER;
const lastKey = (owner: string) => `lastProjectId:${owner}`;

async function createProjectRecord(ownerId: string): Promise<ProjectRecord> {
  const saved = await db.kvGet<AnnotationStyle>('defaultStyle');
  const defaultStyle = saved?.layout ? saved : DEFAULT_STYLE;
  const now = Date.now();
  return {
    id: uid(),
    ownerId,
    name: '',
    designation: '',
    date: todayISO(),
    site: '',
    createdAt: now,
    updatedAt: now,
    style: { ...DEFAULT_STYLE, ...defaultStyle },
    exportSettings: { ...DEFAULT_EXPORT },
    photos: [],
  };
}

function normalize(rec: ProjectRecord): ProjectRecord {
  return {
    ...rec,
    designation: rec.designation ?? '',
    // Projects saved before the "text on photo" layout existed switch to the new default look.
    style: rec.style?.layout ? { ...DEFAULT_STYLE, ...rec.style } : { ...DEFAULT_STYLE },
    exportSettings: { ...DEFAULT_EXPORT, ...rec.exportSettings },
    // Fill fields that may be missing in projects saved by older versions.
    photos: rec.photos.map((p) => ({ ...p, projectOverride: p.projectOverride ?? '', designationOverride: p.designationOverride ?? '', dateOverride: p.dateOverride ?? '', siteOverride: p.siteOverride ?? '', observations: p.observations ?? '' })),
  };
}

export function useProject(userId: string | null) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const projectRef = useRef<ProjectRecord | null>(null);
  projectRef.current = project;
  const dirty = useRef(false);
  const userRef = useRef(userId);
  userRef.current = userId;

  // ---------- Persistence
  const saveNow = useCallback(async (p: ProjectRecord | null = projectRef.current) => {
    if (!p) return;
    dirty.current = false;
    await db.putProject({ ...p, updatedAt: Date.now() });
    await db.kvSet(lastKey(ownerOf(p)), p.id);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    if (!project || !dirty.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      saveNow(project).catch(() => toast('Échec de la sauvegarde locale', 'error'));
    }, 500);
    return () => clearTimeout(t);
  }, [project, saveNow]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current && projectRef.current) void saveNow(projectRef.current);
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [saveNow]);

  const mutate = useCallback((fn: (p: ProjectRecord) => ProjectRecord) => {
    dirty.current = true;
    setProject((p) => (p ? fn(p) : p));
  }, []);

  // ---------- Load / switch projects
  const resetRuntime = useCallback(() => {
    setThumbs((old) => {
      Object.values(old).forEach((u) => u && URL.revokeObjectURL(u));
      return {};
    });
    setSelected(new Set());
  }, []);

  const loadProject = useCallback(
    async (id: string) => {
      if (dirty.current && projectRef.current) await saveNow(projectRef.current);
      const rec = await db.getProject(id);
      if (!rec) return false;
      const p = normalize(rec);
      resetRuntime();
      dirty.current = false;
      setProject(p);
      setCurrentId(p.photos[0]?.id ?? null);
      await db.kvSet(lastKey(ownerOf(p)), p.id);
      const entries = await Promise.all(p.photos.map(async (ph) => [ph.id, await thumbUrlFor(ph.id)] as const));
      setThumbs(Object.fromEntries(entries));
      return true;
    },
    [resetRuntime, saveNow],
  );

  const newProject = useCallback(async () => {
    const cur = projectRef.current;
    if (cur && !cur.name.trim() && !cur.site.trim() && !cur.photos.length) return false; // already a blank project
    if (dirty.current && cur) await saveNow(cur);
    const p = await createProjectRecord(userRef.current ?? LEGACY_OWNER);
    resetRuntime();
    setProject(p);
    setCurrentId(null);
    await saveNow(p);
    return true;
  }, [resetRuntime, saveNow]);

  // Load the last project of the selected user (and again whenever the user changes).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || loadedFor.current === userId) return; // also guards StrictMode double-invoke
    loadedFor.current = userId;
    (async () => {
      if (dirty.current && projectRef.current) await saveNow(projectRef.current).catch(() => {});
      try {
        let last = await db.kvGet<string>(lastKey(userId));
        if (!last && userId === LEGACY_OWNER) last = await db.kvGet<string>('lastProjectId'); // pre-users version
        if (last) {
          const rec = await db.getProject(last);
          if (rec && ownerOf(rec) === userId && (await loadProject(last))) return;
        }
      } catch {
        toast('Stockage local indisponible : les projets ne seront pas sauvegardés.', 'error');
      }
      const p = await createProjectRecord(userId);
      resetRuntime();
      dirty.current = false;
      setProject(p);
      setCurrentId(null);
      saveNow(p).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- Project fields
  const updateProject = useCallback(
    (patch: Partial<Pick<ProjectRecord, 'name' | 'designation' | 'date' | 'site'>>) => mutate((p) => ({ ...p, ...patch })),
    [mutate],
  );
  const updateStyle = useCallback((patch: Partial<AnnotationStyle>) => mutate((p) => ({ ...p, style: { ...p.style, ...patch } })), [mutate]);
  const setStyle = useCallback((style: AnnotationStyle) => mutate((p) => ({ ...p, style: { ...DEFAULT_STYLE, ...style } })), [mutate]);
  const updateExport = useCallback(
    (patch: Partial<ExportSettings>) => mutate((p) => ({ ...p, exportSettings: { ...p.exportSettings, ...patch } })),
    [mutate],
  );

  // ---------- Photos
  const updatePhoto = useCallback(
    (id: string, patch: Partial<PhotoData>) => mutate((p) => ({ ...p, photos: p.photos.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)) })),
    [mutate],
  );

  /** Apply a patch function to several photos. `order` = position within the given id list. */
  const updatePhotos = useCallback(
    (ids: string[], fn: (ph: PhotoData, order: number) => Partial<PhotoData>) =>
      mutate((p) => {
        const orderMap = new Map(ids.map((id, i) => [id, i]));
        return { ...p, photos: p.photos.map((ph) => (orderMap.has(ph.id) ? { ...ph, ...fn(ph, orderMap.get(ph.id)!) } : ph)) };
      }),
    [mutate],
  );

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const proj = projectRef.current;
      if (!proj) return;
      const files = Array.from(fileList)
        .filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const skipped = Array.from(fileList).length - files.length;
      if (!files.length) {
        toast('Aucune image valide dans la sélection.', 'error');
        return;
      }
      const projectId = proj.id;
      const failed: string[] = [];
      let firstId: string | null = null;
      setImporting({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const id = uid();
        try {
          const info = await processAndStore(id, f);
          if (projectRef.current?.id !== projectId) break; // user switched project
          const photo: PhotoData = {
            id,
            name: f.name,
            width: info.width,
            height: info.height,
            repere: '',
            task: '',
            observations: '',
            projectOverride: '',
            designationOverride: '',
            dateOverride: '',
            siteOverride: '',
          };
          firstId ??= id;
          const url = URL.createObjectURL(info.thumb);
          setThumbs((t) => ({ ...t, [id]: url }));
          mutate((p) => ({ ...p, photos: [...p.photos, photo] }));
          setCurrentId((c) => c ?? id);
        } catch {
          failed.push(f.name);
        }
        setImporting({ done: i + 1, total: files.length });
      }
      setImporting(null);
      if (firstId) setCurrentId(firstId);
      const ok = files.length - failed.length;
      if (ok) toast(`${ok} photo${ok > 1 ? 's' : ''} importée${ok > 1 ? 's' : ''}.`, 'success');
      if (failed.length) toast(`Format non pris en charge : ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''} (utilisez JPG/PNG/WebP).`, 'error');
      if (skipped) toast(`${skipped} fichier(s) ignoré(s) (pas des images).`, 'info');
    },
    [mutate],
  );

  const removePhotos = useCallback(
    async (ids: string[]) => {
      const proj = projectRef.current;
      if (!proj || !ids.length) return;
      const idSet = new Set(ids);
      const remaining = proj.photos.filter((p) => !idSet.has(p.id));
      // Choose a sensible new current photo
      setCurrentId((cur) => {
        if (cur && !idSet.has(cur)) return cur;
        const oldIdx = proj.photos.findIndex((p) => p.id === cur);
        return remaining[Math.min(Math.max(0, oldIdx), remaining.length - 1)]?.id ?? null;
      });
      mutate((p) => ({ ...p, photos: p.photos.filter((ph) => !idSet.has(ph.id)) }));
      setSelected((s) => new Set([...s].filter((id) => !idSet.has(id))));
      setThumbs((t) => {
        const n = { ...t };
        for (const id of ids) {
          if (n[id]) URL.revokeObjectURL(n[id]);
          delete n[id];
        }
        return n;
      });
      ids.forEach(forgetPreview);
      await db.deletePhotoBlobs(ids);
    },
    [mutate],
  );

  const movePhoto = useCallback(
    (id: string, delta: number) =>
      mutate((p) => {
        const i = p.photos.findIndex((ph) => ph.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= p.photos.length) return p;
        const photos = [...p.photos];
        [photos[i], photos[j]] = [photos[j], photos[i]];
        return { ...p, photos };
      }),
    [mutate],
  );

  return {
    project,
    thumbs,
    currentId,
    setCurrentId,
    selected,
    setSelected,
    importing,
    saveState,
    loadProject,
    newProject,
    saveNow,
    updateProject,
    updateStyle,
    setStyle,
    updateExport,
    updatePhoto,
    updatePhotos,
    addFiles,
    removePhotos,
    movePhoto,
  };
}

export type ProjectStore = ReturnType<typeof useProject>;
