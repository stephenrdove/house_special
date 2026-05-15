import type { AppState, ExtractedRecipe, FamilyConstraints, FamilyMember, GroceryItem, Recipe, User } from './types';

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
  getFamily:        ()                                => req<{ familyId: string; members: FamilyMember[]; constraints: FamilyConstraints | null }>('/families/me'),
  createInvite:     ()                                => req<{ token: string; url: string }>('/families/invite', { method: 'POST' }),
  joinFamily:       async (token: string, force = false): Promise<{ ok: boolean; conflict?: boolean }> => {
    const res = await fetch(`${BASE}/families/join`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, force }),
    });
    if (res.status === 409) return { ok: false, conflict: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  leaveFamily:      ()                                => req<{ ok: boolean }>('/families/me', { method: 'DELETE' }),
  updateConstraints: (constraints: FamilyConstraints) => req<{ ok: boolean }>('/families/constraints', { method: 'PUT', body: JSON.stringify({ constraints }) }),
  generatePlan:     async (startDate: string) => {
    const res = await fetch(`${BASE}/families/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate }),
    });
    if (res.status === 429) {
      const body = await res.json() as { error: string };
      throw Object.assign(new Error(body.error), { rateLimited: true });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<{ weeks: { week: number; days: { date: string; meal: string; notes?: string; leftover: boolean }[] }[]; grocery: Pick<GroceryItem, 'name' | 'category' | 'warn'>[] }>;
  },
  listRecipes:   ()                                        => req<Recipe[]>('/families/recipes'),
  saveRecipe:    (r: Omit<Recipe, 'id' | 'created_at'>)   => req<{ id: string; ok: boolean }>('/families/recipes', { method: 'POST', body: JSON.stringify(r) }),
  extractRecipe: (body: { url?: string; text?: string })   => req<ExtractedRecipe>('/families/recipes/extract', { method: 'POST', body: JSON.stringify(body) }),
  deleteRecipe:  (id: string)                              => req<{ ok: boolean }>(`/families/recipes/${id}`, { method: 'DELETE' }),
  loginUrl:      ()                             => `${BASE}/auth/login`,
};
