import type { AppState, FamilyMember, User } from './types';

const BASE = import.meta.env.VITE_WORKER_URL as string;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  me:           ()                              => req<User>('/auth/me'),
  logout:       ()                              => req<{ ok: boolean }>('/auth/logout'),
  getState:     ()                              => req<AppState>('/state'),
  putState:     (state: AppState)               => req<{ ok: boolean }>('/state', { method: 'PUT', body: JSON.stringify(state) }),
  patchGrocery:  (id: string, checked: boolean) => req<{ ok: boolean }>(`/grocery/${id}`, { method: 'PATCH', body: JSON.stringify({ checked }) }),
  getFamily:     ()                             => req<{ familyId: string; members: FamilyMember[] }>('/families/me'),
  createInvite:  ()                             => req<{ token: string; url: string }>('/families/invite', { method: 'POST' }),
  joinFamily:    (token: string)                => req<{ ok: boolean }>('/families/join', { method: 'POST', body: JSON.stringify({ token }) }),
  loginUrl:      ()                             => `${BASE}/auth/login`,
};
