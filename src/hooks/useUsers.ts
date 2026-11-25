import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db';
import { buildOptions, DEFAULT_FORMAT, SEED_USERS, type EquipmentGroup, type ListFormat, type ProjectGroup, type UserSeed } from '../lib/projectList';
import { uid } from '../lib/utils';

export type UserProfile = UserSeed;

/**
 * Local user profiles (no password: the app runs on one PC, data never leaves it).
 * Each user has their own equipment list, list format and project history.
 */
export function useUsers() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let list = await db.kvGet<UserProfile[]>('users').catch(() => undefined);
      if (!list?.length) {
        list = SEED_USERS.map((u) => ({ ...u, equipment: u.equipment.map((g) => ({ ...g, items: [...g.items] })) }));
        await db.kvSet('users', list).catch(() => {});
      }
      const cur = await db.kvGet<string>('currentUserId').catch(() => undefined);
      setUsers(list);
      setCurrentId(cur && list.some((u) => u.id === cur) ? cur : null);
      setReady(true);
    })();
  }, []);

  const persist = useCallback((list: UserProfile[]) => {
    setUsers(list);
    void db.kvSet('users', list);
  }, []);

  const selectUser = useCallback(async (id: string | null) => {
    setCurrentId(id);
    if (id) await db.kvSet('currentUserId', id);
    else await db.kvSet('currentUserId', '');
  }, []);

  const current = users?.find((u) => u.id === currentId) ?? null;

  const updateCurrent = useCallback(
    (patch: Partial<Pick<UserProfile, 'equipment' | 'name'> & ListFormat>) => {
      if (!users || !currentId) return;
      persist(users.map((u) => (u.id === currentId ? { ...u, ...patch } : u)));
    },
    [users, currentId, persist],
  );

  const addUser = useCallback(
    (name: string): UserProfile | null => {
      const n = name.trim().toUpperCase();
      if (!n || !users) return null;
      if (users.some((u) => u.name === n)) return null;
      const u: UserProfile = { id: uid(), name: n, equipment: [], ...DEFAULT_FORMAT };
      persist([...users, u]);
      return u;
    },
    [users, persist],
  );

  const removeUser = useCallback(
    (id: string) => {
      if (!users || users.length <= 1) return;
      persist(users.filter((u) => u.id !== id));
    },
    [users, persist],
  );

  const options = useMemo<ProjectGroup[]>(() => (current ? buildOptions(current.equipment, current) : []), [current]);

  return { ready, users: users ?? [], current, currentId, selectUser, updateCurrent, addUser, removeUser, options };
}

export type UsersStore = ReturnType<typeof useUsers>;

/** Equipment dropdown entries of the current user. */
export const EquipmentContext = createContext<ProjectGroup[]>([]);
export const useEquipmentOptions = () => useContext(EquipmentContext);

export type { EquipmentGroup };
