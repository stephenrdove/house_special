import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../auth.ts';
import { checkAndIncrementGenerations, getFamilyConstraints, getFamilyId, getState, listRecipes } from '../db.ts';
import type { Env } from '../types.ts';

interface Constraints {
  family: { adults: number; children: { age: number }[] };
  allergies: string[];
  dietary_restrictions: string[];
  favorites: string[];
  avoid: string[];
  preferred_cuisines: string[];
  notes: string;
}

interface DayPlan {
  date: string;
  meal: string;
  notes?: string;
  leftover: boolean;
}

interface GroceryItem {
  name: string;
  category: string;
  warn: boolean;
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

function significantWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2),
  );
}

function matchRecipe(
  mealName: string,
  recipes: { id: string; name: string; tags: string[] }[],
): string | undefined {
  const a = mealName.toLowerCase().trim();
  const mealWords = significantWords(mealName);

  return recipes.find(r => {
    const b = r.name.toLowerCase().trim();

    // Exact or substring match
    if (a === b || a.includes(b) || b.includes(a)) return true;

    // Word-level overlap between meal and recipe name or tags
    const recipeWords = significantWords(r.name);
    const tagWords = new Set(r.tags.flatMap(t => significantWords(t)));

    for (const word of mealWords) {
      if (recipeWords.has(word) || tagWords.has(word)) return true;
    }
    return false;
  })?.id;
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
          },
          required: ['name', 'category', 'warn'],
        },
      },
    },
    required: ['items'],
  },
};

export async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const familyId = await getFamilyId(env.DB, userId);
  if (!familyId) return json({ error: 'No family found' }, 404);

  const rateCheck = await checkAndIncrementGenerations(env.DB, familyId);
  if (!rateCheck.allowed) {
    return json({ error: `Daily limit reached (${rateCheck.limit} generations per day). Resets at midnight.`, limit: rateCheck.limit }, 429);
  }

  let body: { startDate?: string } = {};
  try { body = await request.json(); } catch { /* no body is fine */ }

  const [constraintsRaw, state, recipes] = await Promise.all([
    getFamilyConstraints(env.DB, familyId),
    getState(env.DB, familyId),
    listRecipes(env.DB, familyId),
  ]);

  const recipeNames = recipes.map(r => r.name);

  const constraints: Constraints = constraintsRaw
    ? JSON.parse(constraintsRaw) as Constraints
    : DEFAULT_CONSTRAINTS;

  const history = getRecentMealHistory(state.meals);
  const startDate = body.startDate ?? getNextSunday();
  const weekSchedule = buildWeekSchedule(startDate);
  const constraintsSummary = buildConstraintsSummary(constraints, recipeNames);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // ── Call 1: suggest 14 dinners ─────────────────────────────────────────────
  const mealResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
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

  const mealToolUse = mealResponse.content.find(b => b.type === 'tool_use');
  if (!mealToolUse || mealToolUse.type !== 'tool_use') {
    return json({ error: 'Failed to generate meal plan' }, 500);
  }

  const rawDays = (mealToolUse.input as { days: DayPlan[] }).days;

  // Tag each day with a recipe_id if the meal name matches a saved recipe.
  const recipesForMatching = recipes.map(r => ({
    id: r.id,
    name: r.name,
    tags: JSON.parse(r.tags) as string[],
  }));

  const days = rawDays.map(day => {
    const recipe_id = matchRecipe(day.meal, recipesForMatching);
    return recipe_id ? { ...day, recipe_id } : day;
  });

  // ── Call 2: build grocery list ─────────────────────────────────────────────
  const allergyNote = constraints.allergies.length > 0
    ? `\nAllergies (mark warn: true for any item needing a certified safe version): ${constraints.allergies.join(', ')}`
    : '';

  const groceryResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [BUILD_GROCERY_TOOL],
    tool_choice: { type: 'tool', name: 'build_grocery_list' },
    system: `You are a grocery list generator for a family.${allergyNote}`,
    messages: [
      {
        role: 'user',
        content: `Generate a complete grocery list for this 14-day meal plan:\n\n${JSON.stringify(days, null, 2)}\n\nInclude all ingredients needed. Deduplicate items. Call the build_grocery_list tool.`,
      },
    ],
  });

  const groceryToolUse = groceryResponse.content.find(b => b.type === 'tool_use');
  if (!groceryToolUse || groceryToolUse.type !== 'tool_use') {
    return json({ error: 'Failed to generate grocery list' }, 500);
  }

  const groceryItems = (groceryToolUse.input as { items: GroceryItem[] }).items;

  return json({
    weeks: [{ week: 1, days }],
    grocery: groceryItems,
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
