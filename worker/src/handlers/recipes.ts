import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../auth.ts';
import { createFamilyForUser, deleteRecipe, getFamilyId, insertRecipe, listRecipes } from '../db.ts';
import type { Env } from '../types.ts';
import { isSafeUrl, safeJsonParse, validateExtractedRecipe } from '../utils/safe.ts';

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
        description: 'Ingredients with quantities and grocery category, one per item',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Ingredient with quantity, e.g. "2 cups broccoli florets"' },
            category: {
              type: 'string',
              enum: ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Frozen', 'Pantry / Dry Goods', 'Canned Goods', 'Condiments & Sauces', 'Other'],
            },
          },
          required: ['name', 'category'],
        },
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

  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);

  let body: { url?: string; text?: string; file?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.url && !body.text && !body.file) return json({ error: 'url, text, or file required' }, 400);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let sourceUrl: string | undefined;
  let messages: Anthropic.MessageParam[];

  if (body.file) {
    const match = body.file.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return json({ error: 'Invalid file data' }, 400);
    const [, mimeType, data] = match;

    const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    let mediaBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam;

    if (mimeType === 'application/pdf') {
      mediaBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data },
      };
    } else if (VALID_IMAGE_TYPES.includes(mimeType)) {
      mediaBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data,
        },
      };
    } else {
      return json({ error: 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or PDF.' }, 400);
    }

    messages = [{
      role: 'user',
      content: [mediaBlock, { type: 'text', text: 'Extract the recipe and call the extract_recipe tool.' }],
    }];
  } else {
    let content: string;
    if (body.url) {
      if (!isSafeUrl(body.url)) return json({ error: 'URL must start with http:// or https://' }, 400);
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
    messages = [{
      role: 'user',
      content: `Extract the recipe from this content and call the extract_recipe tool:\n\n${content}`,
    }];
  }

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      tools: [EXTRACT_RECIPE_TOOL],
      tool_choice: { type: 'tool', name: 'extract_recipe' },
      messages,
    });
  } catch (err) {
    console.error('extract_recipe call failed', err);
    return json({ error: 'AI service is unavailable. Please try again in a moment.' }, 502);
  }

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return json({ error: 'Could not extract recipe from that content.' }, 500);
  }

  const extracted = validateExtractedRecipe(toolUse.input);
  if (!extracted) {
    console.error('extract_recipe returned invalid tool input', toolUse.input);
    return json({ error: 'Could not extract recipe from that content.' }, 500);
  }

  return json({ ...extracted, source_url: sourceUrl ?? null });
}

export async function handleSaveRecipe(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);

  let body: {
    name?: string;
    source_url?: string | null;
    ingredients?: (string | { name: string; category: string })[];
    steps?: string[];
    notes?: string;
    tags?: string[];
  };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.name?.trim()) return json({ error: 'name required' }, 400);
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) return json({ error: 'ingredients required' }, 400);

  // Normalise: wrap plain strings from old clients into {name, category} objects
  const ingredients = body.ingredients.map(i =>
    typeof i === 'string' ? { name: i, category: 'Other' } : i
  );

  const id = await insertRecipe(env.DB, familyId, {
    name: body.name.trim(),
    source_url: body.source_url ?? null,
    ingredients: JSON.stringify(ingredients),
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
  const recipes = rows.map(r => {
    const rawIngredients = safeJsonParse<(string | { name: string; category: string })[]>(r.ingredients, []);
    return {
      id: r.id,
      name: r.name,
      source_url: r.source_url,
      ingredients: rawIngredients.map(i => typeof i === 'string' ? { name: i, category: 'Other' } : i),
      steps: safeJsonParse<string[]>(r.steps, []),
      notes: r.notes,
      tags: safeJsonParse<string[]>(r.tags, []),
      created_at: r.created_at,
    };
  });

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
