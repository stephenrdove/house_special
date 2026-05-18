import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AppState, SyncStatus } from '../types';

const EMPTY: AppState = { meals: {}, grocery: [] };
const LOCAL_KEY = 'housespecial_local';
const DEBOUNCE_MS = 800;

interface CachedState {
  state: AppState;
  updatedAt: number;
}

function readCache(): CachedState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // New format: { state: AppState, updatedAt: number }
    if (parsed.state && typeof parsed.updatedAt === 'number') {
      return parsed as unknown as CachedState;
    }
    // Old format: plain AppState
    if (parsed.meals) {
      return { state: parsed as unknown as AppState, updatedAt: 0 };
    }
    return null;
  } catch { return null; }
}

function writeCache(state: AppState, updatedAt: number) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ state, updatedAt }));
}

export function useAppState(authed: boolean) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The most-recent payload we tried to persist. Retried on user click.
  const pendingState = useRef<AppState | null>(null);

  const save = useCallback(async (next: AppState) => {
    pendingState.current = next;
    setSync('saving');
    try {
      await api.putState(next);
      writeCache(next, Date.now());
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

  useEffect(() => {
    if (!authed) return;
    api.getState()
      .then(remote => {
        const { updated_at: serverUpdatedAt, ...serverState } = remote;
        const cached = readCache();
        if (cached && cached.updatedAt > serverUpdatedAt) {
          // Local has unsaved edits newer than the server — restore and retry save
          console.warn('local state is newer than server, restoring and retrying save');
          setState(cached.state);
          save(cached.state);
        } else {
          setState(serverState);
          writeCache(serverState, serverUpdatedAt);
        }
      })
      .catch(err => {
        console.warn('initial state load failed, falling back to cache', err);
        const cached = readCache();
        if (cached) setState(cached.state);
      });
  }, [authed, save]);

  const mutate = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      writeCache(next, Date.now());
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
