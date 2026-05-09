import { requireAuth } from '../auth.ts';
import { updateGroceryItem } from '../db.ts';
import type { Env } from '../types.ts';

export async function handlePatchGrocery(
  request: Request,
  env: Env,
  itemId: string,
): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let body: { checked: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (typeof body.checked !== 'boolean') {
    return json({ error: 'checked must be a boolean' }, 400);
  }

  const updated = await updateGroceryItem(env.DB, userId, itemId, body.checked);
  if (!updated) return json({ error: 'Item not found' }, 404);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
