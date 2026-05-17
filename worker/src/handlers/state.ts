import { requireAuth } from '../auth.ts';
import { getState, putState } from '../db.ts';
import type { AppState, Env } from '../types.ts';

export async function handleGetState(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const state = await getState(env.DB, userId);
  return json(state);
}

export async function handlePutState(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let state: AppState;
  try {
    state = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!state.meals || !Array.isArray(state.grocery)) {
    return json({ error: 'Invalid state shape' }, 400);
  }

  await putState(env.DB, userId, state);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
