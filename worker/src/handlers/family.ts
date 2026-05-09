import { requireAuth } from '../auth.ts';
import { acceptInvite, createInviteToken, getFamilyId, getFamilyMembers } from '../db.ts';
import type { Env } from '../types.ts';

export async function handleGetFamily(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  const members = await getFamilyMembers(env.DB, familyId);
  return json({ familyId, members });
}

export async function handleCreateInvite(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  const token = await createInviteToken(env.DB, familyId, userId);
  const url = `${env.ALLOWED_ORIGIN}?join=${token}`;
  return json({ token, url });
}

export async function handleJoinFamily(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let body: { token: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.token) return json({ error: 'token required' }, 400);

  const result = await acceptInvite(env.DB, userId, body.token);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
