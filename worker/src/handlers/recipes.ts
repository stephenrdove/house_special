import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../auth.ts';
import { deleteRecipe, getFamilyId, insertRecipe, listRecipes } from '../db.ts';
import type { Env } from '../types.ts';

function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s{2,}/g, ' ').trim();
}

const EXTRACT_RECIPE_TOOL: Anthropic.Tool = {
  name: 'extract_recipe',
  description: 'Extract a structured recipe from the provided content',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Recipe name, concise (3–7 words)' },
      ingredients: {
        type: 'array',
        description: 'Ingredients with quantities, one per item',
        items: { type: 'string' },
      },
      steps: {
        type: 'array',
        description: 'Ordered preparation steps, one action per item',
        items: { type: 'string' },
      },
      notes: {
        type: 'string',
        description: 'Tips, substitutions, or serving suggestions. Empty string if none.',
      },
      tags: {
        type: 'array',
        description: 'Short classification tags (e.g. "gluten-free", "30-min", "pasta")',
        items: { type: 'string' },
        maxItems: 8,
      },
    },
    required: ['name', 'ingredients', 'steps', 'notes', 'tags'],
  },
};

export async function handleExtractRecipe(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  let body: { url?: string; text?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.url && !body.text) return json({ error: 'url or text required' }, 400);

  let content: string;
  let sourceUrl: string | undefined;

  if (body.url) {
    sourceUrl = body.url;
    let res: Response;
    try {
      res = await fetch(body.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HouseSpecial/1.0)' } });
    } catch {
      return json({ error: 'Could not fetch that URL. Try pasting the recipe text instead.' }, 502);
    }
    if (!res.ok) return json({ error: 'Could not fetch that URL. Try pasting the recipe text instead.' }, 502);
    const html = await res.text();
    content = stripHtml(html).slice(0, 30000);
  } else {
    content = (body.text ?? '').slice(0, 30000);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    tools: [EXTRACT_RECIPE_TOOL],
    tool_choice: { type: 'tool', name: 'extract_recipe' },
    messages: [
      {
        role: 'user',
        content: `Extract the recipe from this content and call the extract_recipe tool:\n\n${content}`,
      },
    ],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return json({ error: 'Could not extract recipe from that content.' }, 500);
  }

  const extracted = toolUse.input as {
    name: string;
    ingredients: string[];
    steps: string[];
    notes: string;
    tags: string[];
  };

  return json({ ...extracted, source_url: sourceUrl ?? null });
}

export async function handleSaveRecipe(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  let body: {
    name?: string;
    source_url?: string | null;
    ingredients?: string[];
    steps?: string[];
    notes?: string;
    tags?: string[];
  };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.name?.trim()) return json({ error: 'name required' }, 400);
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) return json({ error: 'ingredients required' }, 400);

  const id = await insertRecipe(env.DB, familyId, {
    name: body.name.trim(),
    source_url: body.source_url ?? null,
    ingredients: JSON.stringify(body.ingredients ?? []),
    steps: JSON.stringify(body.steps ?? []),
    notes: body.notes ?? '',
    tags: JSON.stringify(body.tags ?? []),
  });

  return json({ id, ok: true });
}

export async function handleListRecipes(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json([]);

  const rows = await listRecipes(env.DB, familyId);
  const recipes = rows.map(r => ({
    id: r.id,
    name: r.name,
    source_url: r.source_url,
    ingredients: JSON.parse(r.ingredients) as string[],
    steps: JSON.parse(r.steps) as string[],
    notes: r.notes,
    tags: JSON.parse(r.tags) as string[],
    created_at: r.created_at,
  }));

  return json(recipes);
}

export async function handleDeleteRecipe(request: Request, env: Env, recipeId: string): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  const deleted = await deleteRecipe(env.DB, familyId, recipeId);
  if (!deleted) return json({ error: 'Recipe not found' }, 404);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
