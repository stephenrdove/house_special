export function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface Constraints {
  family: { adults: number; children: { age: number }[] };
  allergies: string[];
  dietary_restrictions: string[];
  favorites: string[];
  avoid: string[];
  preferred_cuisines: string[];
  notes: string;
}

export function validateConstraints(input: unknown): Constraints | null {
  if (typeof input !== 'object' || input === null) return null;
  const c = input as Record<string, unknown>;

  if (typeof c.family !== 'object' || c.family === null) return null;
  const f = c.family as Record<string, unknown>;
  if (typeof f.adults !== 'number') return null;
  if (!Array.isArray(f.children)) return null;
  for (const child of f.children) {
    if (typeof child !== 'object' || child === null || typeof (child as Record<string, unknown>).age !== 'number') return null;
  }

  for (const key of ['allergies', 'dietary_restrictions', 'favorites', 'avoid', 'preferred_cuisines'] as const) {
    if (!Array.isArray(c[key])) return null;
    for (const item of c[key] as unknown[]) {
      if (typeof item !== 'string') return null;
    }
  }

  if (typeof c.notes !== 'string') return null;

  return {
    family: { adults: f.adults as number, children: (f.children as { age: number }[]) },
    allergies: c.allergies as string[],
    dietary_restrictions: c.dietary_restrictions as string[],
    favorites: c.favorites as string[],
    avoid: c.avoid as string[],
    preferred_cuisines: c.preferred_cuisines as string[],
    notes: c.notes,
  };
}

// Small runtime guards for data we don't fully trust:
// JSON columns in D1 (which may be legacy/corrupt) and tool-call inputs from
// Anthropic (which may not match the declared schema if the model misbehaves).

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const GROCERY_CATEGORIES = new Set([
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Frozen',
  'Pantry / Dry Goods', 'Canned Goods', 'Condiments & Sauces', 'Other',
]);

export type ToolDayPlan = { date: string; meal: string; notes?: string; leftover: boolean };

export function validateDayPlans(input: unknown): ToolDayPlan[] | null {
  if (typeof input !== 'object' || input === null) return null;
  const days = (input as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) return null;
  const out: ToolDayPlan[] = [];
  for (const d of days) {
    if (typeof d !== 'object' || d === null) return null;
    const r = d as Record<string, unknown>;
    if (typeof r.date !== 'string' || typeof r.meal !== 'string' || typeof r.leftover !== 'boolean') return null;
    if (r.notes !== undefined && typeof r.notes !== 'string') return null;
    out.push({ date: r.date, meal: r.meal, leftover: r.leftover, ...(r.notes ? { notes: r.notes as string } : {}) });
  }
  return out;
}

export type ToolGroceryItem = { name: string; category: string; warn: boolean; meal_ids: string[] };

export function validateGroceryItems(input: unknown): ToolGroceryItem[] | null {
  if (typeof input !== 'object' || input === null) return null;
  const items = (input as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const out: ToolGroceryItem[] = [];
  for (const i of items) {
    if (typeof i !== 'object' || i === null) return null;
    const r = i as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.category !== 'string' || typeof r.warn !== 'boolean') return null;
    const category = GROCERY_CATEGORIES.has(r.category) ? r.category : 'Other';
    const meal_ids = Array.isArray(r.meal_ids) ? r.meal_ids.filter((m): m is string => typeof m === 'string') : [];
    out.push({ name: r.name, category, warn: r.warn, meal_ids });
  }
  return out;
}

export type ToolExtractedRecipe = {
  name: string;
  ingredients: { name: string; category: string }[];
  steps: string[];
  notes: string;
  tags: string[];
};

export function validateExtractedRecipe(input: unknown): ToolExtractedRecipe | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) return null;
  if (!Array.isArray(r.steps)) return null;

  const ingredients: { name: string; category: string }[] = [];
  for (const i of r.ingredients) {
    if (typeof i !== 'object' || i === null) return null;
    const ing = i as Record<string, unknown>;
    if (typeof ing.name !== 'string') return null;
    const category = typeof ing.category === 'string' && GROCERY_CATEGORIES.has(ing.category) ? ing.category : 'Other';
    ingredients.push({ name: ing.name, category });
  }

  const steps = r.steps.filter((s): s is string => typeof s === 'string');
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [];
  const notes = typeof r.notes === 'string' ? r.notes : '';

  return { name: r.name, ingredients, steps, notes, tags };
}
