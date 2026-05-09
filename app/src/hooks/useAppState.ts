import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AppState, SyncStatus } from '../types';

const EMPTY: AppState = { meals: {}, grocery: [] };
const LOCAL_KEY = 'housespecial_local';
const DEBOUNCE_MS = 800;

export function useAppState(authed: boolean) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authed) return;
    api.getState()
      .then(remote => {
        setState(remote);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(remote));
      })
      .catch(() => {
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
          if (cached.meals) setState(cached);
        } catch {}
      });
  }, [authed]);

  const save = useCallback(async (next: AppState) => {
    setSync('saving');
    try {
      await api.putState(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      setSync('saved');
      setTimeout(() => setSync('idle'), 2500);
    } catch {
      setSync('error');
    }
  }, []);

  const mutate = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), DEBOUNCE_MS);
      return next;
    });
  }, [save]);

  return { state, mutate, sync };
}
