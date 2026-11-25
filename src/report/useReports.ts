import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../lib/db';
import { toast } from '../components/ui';
import type { EquipmentGroup } from '../lib/projectList';
import type { DailyReport, ReportSettings } from './types';
import { computeAutoEffectif, continueReport, defaultSettings, newReport, toISO } from './logic';
import { deleteReportPhotos } from './photos';

export function useReports(userId: string, userName: string, groups: EquipmentGroup[]) {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [date, setDate] = useState(() => toISO(new Date()));
  const [saving, setSaving] = useState(false);
  const pending = useRef(new Map<string, DailyReport>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Load settings + reports of the user
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await db.kvGet<ReportSettings>(`reportSettings:${userId}`);
      const base = defaultSettings(userId, userName, groups);
      const s = saved ? { ...base, ...saved, header: { ...base.header, ...saved.header } } : base;
      const list = await db.listReports(userId);
      if (!alive) return;
      setSettings(s);
      setReports(list);
      // Open the most recent report if today has none yet.
      const today = toISO(new Date());
      if (!list.some((r) => r.date === today) && list.length) setDate(list[list.length - 1].date);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- Persistence (debounced, flushed on page hide)
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const items = [...pending.current.values()];
    pending.current.clear();
    for (const r of items) await db.putReport(r);
    setSaving(false);
  }, []);
  useEffect(() => {
    const f = () => void flush();
    window.addEventListener('beforeunload', f);
    document.addEventListener('visibilitychange', f);
    return () => {
      window.removeEventListener('beforeunload', f);
      document.removeEventListener('visibilitychange', f);
      void flush();
    };
  }, [flush]);

  const schedule = useCallback(
    (r: DailyReport) => {
      pending.current.set(r.id, r);
      setSaving(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush().catch(() => toast('Échec de la sauvegarde du rapport', 'error')), 500);
    },
    [flush],
  );

  const current = useMemo(() => reports.find((r) => r.date === date) ?? null, [reports, date]);

  const update = useCallback(
    (fn: (r: DailyReport) => DailyReport) => {
      setReports((list) =>
        list.map((r) => {
          if (r.date !== date) return r;
          let n = { ...fn(r), updatedAt: Date.now() };
          // Effectif follows the trades chosen in the activities (automatic mode).
          if (n.autoEffectif && settings) n = { ...n, effectif: computeAutoEffectif(n, settings) };
          schedule(n);
          return n;
        }),
      );
    },
    [date, schedule, settings],
  );

  const upsert = useCallback(async (r: DailyReport) => {
    await db.putReport(r);
    setReports((list) => [...list.filter((x) => x.id !== r.id), r].sort((a, b) => a.date.localeCompare(b.date)));
  }, []);

  const create = useCallback(
    async (mode: 'blank' | 'continue') => {
      if (!settings) return;
      const prev = [...reports].reverse().find((r) => r.date < date);
      const r = mode === 'continue' && prev ? continueReport(prev, date, settings) : newReport(userId, date, settings);
      await upsert(r);
      toast(mode === 'continue' && prev ? `Rapport créé à partir du ${prev.date.split('-').reverse().join('/')}.` : 'Rapport vierge créé.', 'success');
    },
    [settings, reports, date, userId, upsert],
  );

  const remove = useCallback(async () => {
    if (!current) return;
    await db.deleteReport(current.id);
    await deleteReportPhotos(current.photos.map((p) => p.id));
    setReports((l) => l.filter((r) => r.id !== current.id));
  }, [current]);

  const saveSettings = useCallback(
    (s: ReportSettings) => {
      setSettings(s);
      void db.kvSet(`reportSettings:${userId}`, s);
    },
    [userId],
  );

  return { settings, saveSettings, reports, date, setDate, current, update, create, remove, upsert, saving, flush };
}

export type ReportsStore = ReturnType<typeof useReports>;
