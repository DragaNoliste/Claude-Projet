import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import { DEFAULT_TASKS } from '../lib/defaults';

export function useTaskLibrary() {
  const [tasks, setTasks] = useState<string[]>(DEFAULT_TASKS);
  useEffect(() => {
    db.kvGet<string[]>('taskLibrary').then((t) => t && setTasks(t)).catch(() => {});
  }, []);
  const save = useCallback((list: string[]) => {
    setTasks(list);
    void db.kvSet('taskLibrary', list);
  }, []);
  return {
    tasks,
    add: (t: string) => {
      const v = t.trim();
      if (v && !tasks.includes(v)) save([...tasks, v]);
    },
    edit: (i: number, t: string) => save(tasks.map((x, j) => (j === i ? t.trim() : x)).filter(Boolean)),
    remove: (i: number) => save(tasks.filter((_, j) => j !== i)),
    move: (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= tasks.length) return;
      const n = [...tasks];
      [n[i], n[j]] = [n[j], n[i]];
      save(n);
    },
    reset: () => save(DEFAULT_TASKS),
  };
}

export type TaskLibrary = ReturnType<typeof useTaskLibrary>;
