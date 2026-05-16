import { describe, expect, it } from 'vitest';
import { mergeIntoGrocery, removeLinkedGroceryItems, toGroceryName } from '../utils/grocery';
import type { GroceryItem, RecipeIngredient } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function item(overrides: Partial<GroceryItem> & { name: string }): GroceryItem {
  return { id: `g_${Math.random()}`, category: 'Other', checked: false, warn: false, source_meal_ids: [], ...overrides };
}

function ingredient(name: string, category = 'Produce'): RecipeIngredient {
  return { name, category };
}

// ── toGroceryName ─────────────────────────────────────────────────────────────

describe('toGroceryName', () => {
  it.each([
    ['1 egg', 'Egg'],
    ['2 tablespoons granulated sugar', 'Granulated sugar'],
    ['1 teaspoon pure vanilla extract', 'Pure vanilla extract'],
    ['1 cup all-purpose gluten-free flour', 'All-purpose gluten-free flour'],
    ['3 chicken thighs', 'Chicken thighs'],
    ['1/2 cup coconut milk', 'Coconut milk'],
    ['¼ teaspoon vanilla', 'Vanilla'],
    ['2 tbsp olive oil', 'Olive oil'],
    ['500g ground beef', 'Ground beef'],
    ['1 lb salmon fillet', 'Salmon fillet'],
    ['2 cans black beans', 'Black beans'],
    ['1 pinch salt', 'Salt'],
  ])('strips measurement from %s → %s', (input, expected) => {
    expect(toGroceryName(input)).toBe(expected);
  });

  it('capitalizes the first letter', () => {
    expect(toGroceryName('1 egg')).toBe('Egg');
    expect(toGroceryName('2 cups broccoli')).toBe('Broccoli');
  });

  it('leaves names without measurements unchanged except capitalization', () => {
    expect(toGroceryName('salt')).toBe('Salt');
    expect(toGroceryName('olive oil')).toBe('Olive oil');
    expect(toGroceryName('Broccoli')).toBe('Broccoli');
  });
});

// ── mergeIntoGrocery ──────────────────────────────────────────────────────────

describe('mergeIntoGrocery', () => {
  it('adds new items with the given meal ID', () => {
    const result = mergeIntoGrocery([], [ingredient('Broccoli', 'Produce')], 'meal-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Broccoli');
    expect(result[0].category).toBe('Produce');
    expect(result[0].source_meal_ids).toEqual(['meal-1']);
  });

  it('strips measurements when adding items', () => {
    const result = mergeIntoGrocery([], [ingredient('2 cups broccoli florets', 'Produce')], 'meal-1');
    expect(result[0].name).toBe('Broccoli florets');
  });

  it('skips items that already exist by word overlap', () => {
    const existing = [item({ name: 'Broccoli florets' })];
    const result = mergeIntoGrocery(existing, [ingredient('Broccoli', 'Produce')], 'meal-1');
    expect(result).toHaveLength(1);
  });

  it('adds multiple distinct items', () => {
    const result = mergeIntoGrocery(
      [],
      [ingredient('Chicken', 'Meat & Seafood'), ingredient('Broccoli', 'Produce')],
      'meal-1',
    );
    expect(result).toHaveLength(2);
  });

  it('preserves existing unrelated items', () => {
    const existing = [item({ name: 'Eggs' })];
    const result = mergeIntoGrocery(existing, [ingredient('Broccoli')], 'meal-1');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Eggs');
  });

  it('does not modify existing items when a duplicate is skipped', () => {
    const existing = [item({ name: 'Olive Oil', category: 'Condiments & Sauces', source_meal_ids: [] })];
    const result = mergeIntoGrocery(existing, [ingredient('olive oil', 'Condiments & Sauces')], 'meal-1');
    expect(result).toHaveLength(1);
    expect(result[0].source_meal_ids).toEqual([]); // original untouched
  });
});

// ── removeLinkedGroceryItems ──────────────────────────────────────────────────

describe('removeLinkedGroceryItems', () => {
  it('removes items linked only to the removed meal', () => {
    const grocery = [item({ name: 'Broccoli', source_meal_ids: ['meal-1'] })];
    expect(removeLinkedGroceryItems(grocery, 'meal-1')).toHaveLength(0);
  });

  it('unlinks but keeps items shared by multiple meals', () => {
    const grocery = [item({ name: 'Olive Oil', source_meal_ids: ['meal-1', 'meal-2'] })];
    const result = removeLinkedGroceryItems(grocery, 'meal-1');
    expect(result).toHaveLength(1);
    expect(result[0].source_meal_ids).toEqual(['meal-2']);
  });

  it('leaves ad hoc items (empty source_meal_ids) untouched', () => {
    const grocery = [item({ name: 'Milk', source_meal_ids: [] })];
    expect(removeLinkedGroceryItems(grocery, 'meal-1')).toHaveLength(1);
  });

  it('leaves items linked only to other meals untouched', () => {
    const grocery = [item({ name: 'Chicken', source_meal_ids: ['meal-2'] })];
    const result = removeLinkedGroceryItems(grocery, 'meal-1');
    expect(result).toHaveLength(1);
    expect(result[0].source_meal_ids).toEqual(['meal-2']);
  });

  it('handles a mix of linked, shared, and ad hoc items', () => {
    const grocery = [
      item({ name: 'Broccoli', source_meal_ids: ['meal-1'] }),         // remove
      item({ name: 'Olive Oil', source_meal_ids: ['meal-1', 'meal-2'] }), // unlink
      item({ name: 'Milk', source_meal_ids: [] }),                      // keep
      item({ name: 'Chicken', source_meal_ids: ['meal-2'] }),           // keep
    ];
    const result = removeLinkedGroceryItems(grocery, 'meal-1');
    expect(result).toHaveLength(3);
    expect(result.find(g => g.name === 'Broccoli')).toBeUndefined();
    expect(result.find(g => g.name === 'Olive Oil')?.source_meal_ids).toEqual(['meal-2']);
  });
});
