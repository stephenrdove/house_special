import { handleCallback, handleLogin, handleLogout, handleMe, requireAuth } from './auth.ts';
import { createFamilyForUser, getFamilyId, getState, putState, updateGroceryItem } from './db.ts';
import { handleCreateInvite, handleGetFamily, handleJoinFamily, handleLeaveFamily, handleUpdatePrompt } from './handlers/family.ts';
import type { AppState, Env } from './types.ts';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;

    // ── Auth routes ────────────────────────────────────────────────────────────
    if (url.pathname === '/auth/login')    response = await handleLogin(env);
    else if (url.pathname === '/auth/callback') response = await handleCallback(request, env);
    else if (url.pathname === '/auth/me')  response = await handleMe(request, env);
    else if (url.pathname === '/auth/logout') response = handleLogout();

    // ── Family routes ──────────────────────────────────────────────────────────
    else if (url.pathname === '/families/me' && request.method === 'GET')
      response = await handleGetFamily(request, env);
    else if (url.pathname === '/families/invite' && request.method === 'POST')
      response = await handleCreateInvite(request, env);
    else if (url.pathname === '/families/join' && request.method === 'POST')
      response = await handleJoinFamily(request, env);
    else if (url.pathname === '/families/me' && request.method === 'DELETE')
      response = await handleLeaveFamily(request, env);
    else if (url.pathname === '/families/prompt' && request.method === 'PUT')
      response = await handleUpdatePrompt(request, env);

    // ── State routes ───────────────────────────────────────────────────────────
    else if (url.pathname === '/state' && request.method === 'GET')
      response = await handleGetState(request, env);
    else if (url.pathname === '/state' && request.method === 'PUT')
      response = await handlePutState(request, env);
    else if (url.pathname.startsWith('/grocery/') && request.method === 'PATCH') {
      const itemId = url.pathname.slice('/grocery/'.length);
      response = await handlePatchGrocery(request, env, itemId);
    }

    else {
      response = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Attach CORS headers to all non-redirect responses
    if (response.status < 300 || response.status >= 400) {
      const merged = new Response(response.body, response);
      Object.entries(cors).forEach(([k, v]) => merged.headers.set(k, v));
      return merged;
    }
    return response;
  },
};

// ── Inline state handlers (need familyId context) ─────────────────────────────

async function handleGetState(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ meals: {}, grocery: [] });
  const state = await getState(env.DB, familyId);
  return json(state);
}

async function handlePutState(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  let state: AppState;
  try { state = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!state.meals || !Array.isArray(state.grocery)) return json({ error: 'Invalid state shape' }, 400);
  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);
  await putState(env.DB, familyId, state);
  return json({ ok: true });
}

async function handlePatchGrocery(request: Request, env: Env, itemId: string): Promise<Response> {
  const ctx = await authContext(request, env);
  if (!ctx) return json({ error: 'Unauthorized' }, 401);
  let body: { checked: boolean };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (typeof body.checked !== 'boolean') return json({ error: 'checked must be boolean' }, 400);
  const updated = await updateGroceryItem(env.DB, ctx.familyId, itemId, body.checked);
  if (!updated) return json({ error: 'Item not found' }, 404);
  return json({ ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authContext(
  request: Request, env: Env,
): Promise<{ userId: string; familyId: string } | null> {
  const userId = await requireAuth(request, env);
  if (!userId) return null;
  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return null;
  return { userId, familyId };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':      allowed,
    'Access-Control-Allow-Methods':     'GET, PUT, PATCH, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}
