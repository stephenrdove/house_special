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
  // The most-recent payload we tried to persist. Retried on user click.
  const pendingState = useRef<AppState | null>(null);

  useEffect(() => {
    if (!authed) return;
    api.getState()
      .then(remote => {
        setState(remote);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(remote));
      })
      .catch(err => {
        console.warn('initial state load failed, falling back to cache', err);
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
          if (cached.meals) setState(cached);
        } catch { /* malformed cache */ }
      });
  }, [authed]);

  const save = useCallback(async (next: AppState) => {
    pendingState.current = next;
    setSync('saving');
    try {
      await api.putState(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      pendingState.current = null;
      setSync('saved');
      setTimeout(() => {
        // Only clear the indicator if nothing has failed in the meantime.
        setSync(prev => (prev === 'saved' ? 'idle' : prev));
      }, 4000);
    } catch (err) {
      console.error('save failed', err);
      // Keep the optimistic state in the UI so the user doesn't lose typed
      // edits — but leave sync='error' sticky so they know it's not on the
      // server. They can click the indicator to retry.
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

  const retrySave = useCallback(() => {
    const target = pendingState.current ?? state;
    save(target);
  }, [save, state]);

  return { state, mutate, sync, retrySave };
}
