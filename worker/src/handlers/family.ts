import { requireAuth } from '../auth.ts';
import { acceptInvite, createFamilyForUser, createInviteToken, getFamilyConstraints, getFamilyId, getFamilyMembers, leaveFamily, setFamilyConstraints } from '../db.ts';
import type { Env } from '../types.ts';
import { safeJsonParse, validateConstraints } from '../utils/safe.ts';

export async function handleGetFamily(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ familyId: null, members: [], constraints: null });

  const [members, constraintsRaw] = await Promise.all([
    getFamilyMembers(env.DB, familyId),
    getFamilyConstraints(env.DB, familyId),
  ]);

  const constraints = safeJsonParse<unknown>(constraintsRaw, null);
  return json({ familyId, members, constraints });
}

export async function handleCreateInvite(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);

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

export async function handleUpdateConstraints(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);

  let body: { constraints: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const constraints = validateConstraints(body?.constraints);
  if (!constraints) return json({ error: 'Invalid constraints shape' }, 400);

  await setFamilyConstraints(env.DB, familyId, JSON.stringify(constraints));
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
