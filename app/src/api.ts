import type { AppState, ExtractedRecipe, FamilyConstraints, FamilyMember, GroceryItem, Recipe, User } from './types';

const BASE = import.meta.env.VITE_WORKER_URL as string;
if (!BASE) throw new Error('VITE_WORKER_URL is not set. Add it to your .env file.');

export const UNAUTHORIZED_EVENT = 'hs:unauthorized';

// Centralized response handling. Any 401 broadcasts an event so the auth layer
// can reset state from a single place, instead of every call site duplicating
// "if 401, log out" logic.
async function handle(res: Response): Promise<Response> {
  if (res.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.clone().json() as { error?: string };
      if (body?.error) message = body.error;
    } catch { /* non-JSON body */ }
    throw new ApiError(message, res.status);
  }
  return res;
}

export class ApiError extends Error {
  status: number;
  rateLimited?: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  await handle(res);
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
    await handle(res);
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
      const err = new ApiError(body.error, 429);
      err.rateLimited = true;
      throw err;
    }
    await handle(res);
    return res.json() as Promise<{ weeks: { week: number; days: { date: string; meal: string; notes?: string; leftover: boolean }[] }[]; grocery: Pick<GroceryItem, 'name' | 'category' | 'warn'>[] }>;
  },
  listRecipes:   ()                                        => req<Recipe[]>('/families/recipes'),
  saveRecipe:    (r: Omit<Recipe, 'id' | 'created_at'>)   => req<{ id: string; ok: boolean }>('/families/recipes', { method: 'POST', body: JSON.stringify(r) }),
  extractRecipe: (body: { url?: string; text?: string; file?: string }) => req<ExtractedRecipe>('/families/recipes/extract', { method: 'POST', body: JSON.stringify(body) }),
  deleteRecipe:  (id: string)                              => req<{ ok: boolean }>(`/families/recipes/${id}`, { method: 'DELETE' }),
  loginUrl:      ()                             => `${BASE}/auth/login`,
};
