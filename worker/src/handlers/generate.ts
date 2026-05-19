import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../auth.ts';
import { checkAndIncrementGenerations, createFamilyForUser, decrementGeneration, getFamilyConstraints, getFamilyId, getState, listRecipes } from '../db.ts';
import type { Env } from '../types.ts';
import { matchRecipe } from '../utils/matching.ts';
import { type Constraints, safeJsonParse, validateDayPlans, validateGroceryItems } from '../utils/safe.ts';

interface DayPlan {
  id: string;
  date: string;
  meal: string;
  notes?: string;
  leftover: boolean;
  recipe_id?: string;
}

const DEFAULT_CONSTRAINTS: Constraints = {
  family: { adults: 2, children: [{ age: 2 }] },
  allergies: ['gluten'],
  dietary_restrictions: [],
  favorites: [],
  avoid: [],
  preferred_cuisines: [],
  notes: '',
};

function getNextSunday(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (7 - today.getDay()) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().slice(0, 10);
}

function buildWeekSchedule(startDateStr: string): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = new Date(startDateStr + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return `${dayNames[d.getDay()]} ${d.toISOString().slice(0, 10)}`;
  }).join('\n');
}

function getRecentMealHistory(
  meals: Record<string, { name: string; leftover: boolean }>,
): string[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(today.getDate() - 28);
  return Object.entries(meals)
    .filter(([date, meal]) => {
      const d = new Date(date);
      return d >= cutoff && d < today && meal.name && !meal.leftover;
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, meal]) => `${date}: ${meal.name}`);
}

function buildConstraintsSummary(c: Constraints, recipeNames: string[] = []): string {
  const totalEaters = c.family.adults + c.family.children.length;
  const familyParts: string[] = [];
  if (c.family.adults === 1) familyParts.push('1 adult');
  else familyParts.push(`${c.family.adults} adults`);
  for (const child of c.family.children) familyParts.push(`1 child age ${child.age}`);

  const lines: string[] = [`Family: ${totalEaters} people (${familyParts.join(', ')})`];

  if (c.allergies.length > 0)
    lines.push(`Allergies (hard constraints — no exceptions): ${c.allergies.join(', ')}`);
  if (c.dietary_restrictions.length > 0)
    lines.push(`Dietary restrictions: ${c.dietary_restrictions.join(', ')}`);
  if (c.family.children.some(ch => ch.age < 5))
    lines.push('Toddler-friendly required: simple flavors, no spice, soft textures');
  lines.push('Recipes: 30–45 minutes or less on weeknights');

  // Saved recipes are listed first and separately — these are real recipes the family
  // has stored and should be used with high priority.
  if (recipeNames.length > 0)
    lines.push(`\nSaved recipes (use these — the family has them and enjoys making them):\n${recipeNames.map(n => `- ${n}`).join('\n')}`);

  if (c.favorites.length > 0)
    lines.push(`\nOther go-to meals:\n${c.favorites.map(f => `- ${f}`).join('\n')}`);

  if (c.avoid.length > 0)
    lines.push(`\nAvoid: ${c.avoid.join(', ')}`);
  if (c.preferred_cuisines.length > 0)
    lines.push(`Preferred cuisines: ${c.preferred_cuisines.join(', ')}`);
  if (c.notes.trim())
    lines.push(`\nNotes: ${c.notes.trim()}`);

  return lines.join('\n');
}


const SUGGEST_DINNERS_TOOL: Anthropic.Tool = {
  name: 'suggest_dinners',
  description: 'Submit a 7-day dinner plan for the family',
  input_schema: {
    type: 'object' as const,
    properties: {
      days: {
        type: 'array',
        description: 'Exactly 7 dinner entries, one per day in order',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            meal: { type: 'string', description: 'Short meal name, 2-5 words max' },
            notes: { type: 'string', description: 'One short phrase only if essential, otherwise empty string' },
            leftover: { type: 'boolean', description: 'true if this is a leftover night' },
          },
          required: ['date', 'meal', 'leftover'],
        },
        minItems: 7,
        maxItems: 7,
      },
    },
    required: ['days'],
  },
};

const BUILD_GROCERY_TOOL: Anthropic.Tool = {
  name: 'build_grocery_list',
  description: 'Submit a complete grocery shopping list for the meal plan',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: {
              type: 'string',
              enum: ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Frozen', 'Pantry / Dry Goods', 'Canned Goods', 'Condiments & Sauces', 'Other'],
            },
            warn: { type: 'boolean', description: 'true if this item needs a certified allergy-safe version' },
            meal_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of the meals in this plan that require this ingredient',
            },
          },
          required: ['name', 'category', 'warn', 'meal_ids'],
        },
      },
    },
    required: ['items'],
  },
};

export async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let familyId = await getFamilyId(env.DB, userId);
  if (!familyId) familyId = await createFamilyForUser(env.DB, userId);

  const rateCheck = await checkAndIncrementGenerations(env.DB, familyId);
  if (!rateCheck.allowed) {
    return json({ error: `Daily limit reached (${rateCheck.limit} generations per day). Resets at midnight.`, limit: rateCheck.limit }, 429);
  }

  let body: { startDate?: string } = {};
  try { body = await request.json(); } catch { /* no body is fine */ }

  if (body.startDate !== undefined) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) && !isNaN(Date.parse(body.startDate + 'T00:00:00Z'));
    if (!valid) return json({ error: 'startDate must be a valid YYYY-MM-DD date' }, 400);
  }

  const [constraintsRaw, state, recipes] = await Promise.all([
    getFamilyConstraints(env.DB, familyId),
    getState(env.DB, familyId),
    listRecipes(env.DB, familyId),
  ]);

  const recipeNames = recipes.map(r => r.name);

  const constraints: Constraints = safeJsonParse<Constraints>(constraintsRaw, DEFAULT_CONSTRAINTS);

  const history = getRecentMealHistory(state.meals);
  const startDate = body.startDate ?? getNextSunday();
  const weekSchedule = buildWeekSchedule(startDate);
  const constraintsSummary = buildConstraintsSummary(constraints, recipeNames);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // ── Call 1: suggest 7 dinners ─────────────────────────────────────────────
  let mealResponse: Anthropic.Message;
  try {
    mealResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [SUGGEST_DINNERS_TOOL],
      tool_choice: { type: 'tool', name: 'suggest_dinners' },
      system: `You are a family meal planning assistant.\n\n${constraintsSummary}`,
      messages: [
        {
          role: 'user',
          content: `Plan 7 family dinners for this week:\n${weekSchedule}\n\nInclude exactly 1 leftover night. Keep meal names short (2–5 words). Only add notes if essential.${history.length > 0 ? `\n\nRecent meals — do not repeat these:\n${history.join('\n')}` : ''}\n\nCall the suggest_dinners tool with your complete plan.`,
        },
      ],
    });
  } catch (err) {
    console.error('suggest_dinners call failed', err);
    await decrementGeneration(env.DB, familyId);
    return json({ error: 'AI service is unavailable. Please try again in a moment.' }, 502);
  }

  const mealToolUse = mealResponse.content.find(b => b.type === 'tool_use');
  if (!mealToolUse || mealToolUse.type !== 'tool_use') {
    await decrementGeneration(env.DB, familyId);
    return json({ error: 'Failed to generate meal plan' }, 500);
  }

  const rawDays = validateDayPlans(mealToolUse.input);
  if (!rawDays) {
    console.error('suggest_dinners returned invalid tool input', mealToolUse.input);
    await decrementGeneration(env.DB, familyId);
    return json({ error: 'Generated plan was malformed. Please try again.' }, 500);
  }

  // Assign stable IDs and match saved recipes.
  const recipesForMatching = recipes.map(r => ({
    id: r.id,
    name: r.name,
    tags: safeJsonParse<string[]>(r.tags, []),
  }));

  const days: DayPlan[] = rawDays.map(day => {
    const id = crypto.randomUUID();
    const recipe_id = matchRecipe(day.meal, recipesForMatching);
    return recipe_id ? { ...day, id, recipe_id } : { ...day, id };
  });

  // ── Call 2: build grocery list ─────────────────────────────────────────────
  // Use short tokens (m1–m7) instead of UUIDs in the LLM context so Haiku
  // reliably copies them back in meal_ids. Map back to real UUIDs after.
  const shortIdMap: Record<string, string> = {};  // short → real UUID
  const daysForLLM = days.map((day, i) => {
    const shortId = `m${i + 1}`;
    shortIdMap[shortId] = day.id;
    return { id: shortId, date: day.date, meal: day.meal, ...(day.notes ? { notes: day.notes } : {}), leftover: day.leftover };
  });

  const allergyNote = constraints.allergies.length > 0
    ? `\nAllergies (mark warn: true for any item needing a certified safe version): ${constraints.allergies.join(', ')}`
    : '';

  let groceryResponse: Anthropic.Message;
  try {
    groceryResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      tools: [BUILD_GROCERY_TOOL],
      tool_choice: { type: 'tool', name: 'build_grocery_list' },
      system: `You are a grocery list generator for a family.${allergyNote}`,
      messages: [
        {
          role: 'user',
          content: `Generate a complete grocery list for this meal plan:\n\n${JSON.stringify(daysForLLM, null, 2)}\n\nInclude all ingredients needed. Deduplicate items across meals (e.g. olive oil used in 3 meals = one entry). For each item, set meal_ids to the array of meal IDs (m1–m7) that require it. Call the build_grocery_list tool.`,
        },
      ],
    });
  } catch (err) {
    console.error('build_grocery_list call failed', err);
    // Don't refund the rate-limit here: the meal plan succeeded, so the user
    // got value. Return what we have plus an empty grocery list rather than
    // forcing a full re-run.
    return json({
      weeks: [{ week: 1, days }],
      grocery: [],
      warning: 'Grocery list generation failed. You can edit meals to regenerate it.',
    });
  }

  const groceryToolUse = groceryResponse.content.find(b => b.type === 'tool_use');
  if (!groceryToolUse || groceryToolUse.type !== 'tool_use') {
    return json({
      weeks: [{ week: 1, days }],
      grocery: [],
      warning: 'Grocery list generation failed.',
    });
  }

  const groceryItems = validateGroceryItems(groceryToolUse.input);
  if (!groceryItems) {
    console.error('build_grocery_list returned invalid tool input', groceryToolUse.input);
    return json({
      weeks: [{ week: 1, days }],
      grocery: [],
      warning: 'Grocery list was malformed.',
    });
  }

  return json({
    weeks: [{ week: 1, days }],
    grocery: groceryItems.map(item => ({
      name: item.name,
      category: item.category,
      warn: item.warn,
      source_meal_ids: item.meal_ids.map(sid => shortIdMap[sid] ?? sid).filter(Boolean),
    })),
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
