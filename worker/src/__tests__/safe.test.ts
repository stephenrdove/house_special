import { describe, expect, it } from 'vitest';
import {
  safeJsonParse,
  validateDayPlans,
  validateExtractedRecipe,
  validateGroceryItems,
} from '../utils/safe';

// ── safeJsonParse ─────────────────────────────────────────────────────────────

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse<string[]>('["a","b"]', [])).toEqual(['a', 'b']);
  });

  it('returns the fallback for null / undefined / empty string', () => {
    expect(safeJsonParse<string[]>(null, [])).toEqual([]);
    expect(safeJsonParse<string[]>(undefined, [])).toEqual([]);
    expect(safeJsonParse<string[]>('', [])).toEqual([]);
  });

  it('returns the fallback for malformed JSON', () => {
    expect(safeJsonParse<unknown>('{not valid}', null)).toBeNull();
    expect(safeJsonParse<unknown[]>('[1,2,', [])).toEqual([]);
  });

  it('does not throw on bare strings or numbers when fallback expects array', () => {
    // 'hello' is not JSON; '"hello"' is. We treat the unquoted form as malformed.
    expect(safeJsonParse<string[]>('hello', ['fallback'])).toEqual(['fallback']);
  });

  it('returns the parsed value even when its type does not match the generic', () => {
    // safeJsonParse only protects against parse failures, not shape — callers
    // still need to validate. This documents that behavior.
    expect(safeJsonParse<string[]>('{"oops":1}', [])).toEqual({ oops: 1 });
  });
});

// ── validateDayPlans ──────────────────────────────────────────────────────────

describe('validateDayPlans', () => {
  it('accepts a well-formed plan', () => {
    const input = {
      days: [
        { date: '2026-05-17', meal: 'Tacos', leftover: false, notes: 'easy' },
        { date: '2026-05-18', meal: 'Pasta', leftover: false },
      ],
    };
    const out = validateDayPlans(input);
    expect(out).toEqual([
      { date: '2026-05-17', meal: 'Tacos', leftover: false, notes: 'easy' },
      { date: '2026-05-18', meal: 'Pasta', leftover: false },
    ]);
  });

  it('rejects non-object input', () => {
    expect(validateDayPlans(null)).toBeNull();
    expect(validateDayPlans(undefined)).toBeNull();
    expect(validateDayPlans('days')).toBeNull();
    expect(validateDayPlans([])).toBeNull();
  });

  it('rejects when days is missing or not an array', () => {
    expect(validateDayPlans({})).toBeNull();
    expect(validateDayPlans({ days: 'oops' })).toBeNull();
    expect(validateDayPlans({ days: {} })).toBeNull();
  });

  it('rejects an empty days array', () => {
    expect(validateDayPlans({ days: [] })).toBeNull();
  });

  it('rejects a day with missing or wrong-typed fields', () => {
    expect(validateDayPlans({ days: [{ date: '2026-05-17', meal: 'Tacos' /* no leftover */ }] })).toBeNull();
    expect(validateDayPlans({ days: [{ date: 123, meal: 'Tacos', leftover: false }] })).toBeNull();
    expect(validateDayPlans({ days: [{ date: '2026-05-17', meal: 'Tacos', leftover: 'no' }] })).toBeNull();
  });

  it('rejects a non-string notes field', () => {
    expect(validateDayPlans({ days: [{ date: '2026-05-17', meal: 'Tacos', leftover: false, notes: 5 }] })).toBeNull();
  });

  it('omits notes when not provided rather than emitting undefined', () => {
    const out = validateDayPlans({ days: [{ date: '2026-05-17', meal: 'Tacos', leftover: false }] });
    expect(out).toEqual([{ date: '2026-05-17', meal: 'Tacos', leftover: false }]);
    expect(out![0]).not.toHaveProperty('notes');
  });

  it('rejects null entries inside days', () => {
    expect(validateDayPlans({ days: [null] })).toBeNull();
  });
});

// ── validateGroceryItems ──────────────────────────────────────────────────────

describe('validateGroceryItems', () => {
  it('accepts a well-formed list', () => {
    const out = validateGroceryItems({
      items: [
        { name: 'Olive oil', category: 'Pantry / Dry Goods', warn: false, meal_ids: ['m1', 'm2'] },
        { name: 'Chicken', category: 'Meat & Seafood', warn: true, meal_ids: [] },
      ],
    });
    expect(out).toEqual([
      { name: 'Olive oil', category: 'Pantry / Dry Goods', warn: false, meal_ids: ['m1', 'm2'] },
      { name: 'Chicken', category: 'Meat & Seafood', warn: true, meal_ids: [] },
    ]);
  });

  it('coerces an unknown category to "Other"', () => {
    const out = validateGroceryItems({
      items: [{ name: 'Sprinkles', category: 'NotACategory', warn: false, meal_ids: [] }],
    });
    expect(out?.[0].category).toBe('Other');
  });

  it('drops non-string meal_ids and falls back to [] when missing', () => {
    const out = validateGroceryItems({
      items: [{ name: 'Salt', category: 'Other', warn: false, meal_ids: ['ok', 5, null] }],
    });
    expect(out?.[0].meal_ids).toEqual(['ok']);

    const out2 = validateGroceryItems({
      items: [{ name: 'Pepper', category: 'Other', warn: false }],
    });
    expect(out2?.[0].meal_ids).toEqual([]);
  });

  it('accepts an empty items array (a valid but trivial list)', () => {
    expect(validateGroceryItems({ items: [] })).toEqual([]);
  });

  it('rejects structurally invalid inputs', () => {
    expect(validateGroceryItems(null)).toBeNull();
    expect(validateGroceryItems({})).toBeNull();
    expect(validateGroceryItems({ items: 'nope' })).toBeNull();
  });

  it('coerces missing/non-boolean warn to false', () => {
    const out = validateGroceryItems({ items: [{ name: 'Salt', category: 'Other' /* no warn */ }] });
    expect(out).toEqual([{ name: 'Salt', category: 'Other', warn: false, meal_ids: [] }]);
  });

  it('skips items with invalid name and returns remaining valid items', () => {
    expect(validateGroceryItems({ items: [{ name: 5, category: 'Other', warn: false, meal_ids: [] }] })).toEqual([]);
  });
});

// ── validateExtractedRecipe ───────────────────────────────────────────────────

describe('validateExtractedRecipe', () => {
  const valid = {
    name: 'Garlic Pasta',
    ingredients: [
      { name: '1 lb spaghetti', category: 'Pantry / Dry Goods' },
      { name: '4 cloves garlic', category: 'Produce' },
    ],
    steps: ['Boil water', 'Cook pasta'],
    notes: 'Reserve some pasta water.',
    tags: ['quick', 'italian'],
  };

  it('accepts a well-formed recipe', () => {
    expect(validateExtractedRecipe(valid)).toEqual(valid);
  });

  it('coerces an unknown ingredient category to "Other"', () => {
    const out = validateExtractedRecipe({
      ...valid,
      ingredients: [{ name: 'Olive oil', category: 'Liquid Gold' }],
    });
    expect(out?.ingredients[0].category).toBe('Other');
  });

  it('drops non-string steps and tags', () => {
    const out = validateExtractedRecipe({
      ...valid,
      steps: ['Boil water', 7, null, 'Cook pasta'],
      tags: ['quick', 9, { bad: true }],
    });
    expect(out?.steps).toEqual(['Boil water', 'Cook pasta']);
    expect(out?.tags).toEqual(['quick']);
  });

  it('defaults notes to "" when missing or wrong-typed', () => {
    const { notes: _omit, ...withoutNotes } = valid;
    expect(validateExtractedRecipe(withoutNotes)?.notes).toBe('');
    expect(validateExtractedRecipe({ ...valid, notes: 5 })?.notes).toBe('');
  });

  it('defaults tags to [] when missing', () => {
    const { tags: _omit, ...withoutTags } = valid;
    expect(validateExtractedRecipe(withoutTags)?.tags).toEqual([]);
  });

  it('rejects empty or blank name', () => {
    expect(validateExtractedRecipe({ ...valid, name: '' })).toBeNull();
    expect(validateExtractedRecipe({ ...valid, name: '   ' })).toBeNull();
  });

  it('rejects empty ingredients list', () => {
    expect(validateExtractedRecipe({ ...valid, ingredients: [] })).toBeNull();
  });

  it('rejects malformed ingredient entries', () => {
    expect(validateExtractedRecipe({ ...valid, ingredients: [{ category: 'Other' }] })).toBeNull();
    expect(validateExtractedRecipe({ ...valid, ingredients: [null] })).toBeNull();
  });

  it('rejects when steps is not an array', () => {
    expect(validateExtractedRecipe({ ...valid, steps: 'just boil it' })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateExtractedRecipe(null)).toBeNull();
    expect(validateExtractedRecipe('recipe')).toBeNull();
    expect(validateExtractedRecipe(42)).toBeNull();
  });
});
