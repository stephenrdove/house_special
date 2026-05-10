import { requireAuth } from '../auth.ts';
import { acceptInvite, createInviteToken, getFamilyId, getFamilyMembers, getFamilyPromptContext, leaveFamily, setFamilyPromptContext } from '../db.ts';
import type { Env } from '../types.ts';

export async function handleGetFamily(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ familyId: null, members: [], promptContext: null });

  const [members, promptContext] = await Promise.all([
    getFamilyMembers(env.DB, familyId),
    getFamilyPromptContext(env.DB, familyId),
  ]);

  return json({ familyId, members, promptContext });
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

  let body: { token: string; force?: boolean };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.token) return json({ error: 'token required' }, 400);

  const result = await acceptInvite(env.DB, userId, body.token, body.force ?? false);
  if (!result.ok) {
    const status = result.conflict ? 409 : 400;
    return json({ error: result.error, conflict: result.conflict }, status);
  }
  return json({ ok: true });
}

export async function handleLeaveFamily(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  await leaveFamily(env.DB, userId);
  return json({ ok: true });
}

export async function handleUpdatePrompt(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  let body: { context: string | null };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const context = body.context === null ? null : String(body.context).trim() || null;
  await setFamilyPromptContext(env.DB, familyId, context);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
