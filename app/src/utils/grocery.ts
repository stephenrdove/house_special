import type { GroceryItem, RecipeIngredient } from '../types';

export const MEASUREMENT_RE = /^[\d\s½¼¾⅓⅔⅛⅜⅝⅞.\/,-]+\s*(tablespoons?|teaspoons?|tbsp?|tsp?|cups?|fluid\s+oz|fl\.?\s*oz|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|litres?|l|pinch(?:es)?|dash(?:es)?|handfuls?|cloves?|slices?|cans?|packages?|pkgs?|bunch(?:es)?|heads?|stalks?|sprigs?|strips?|pieces?|pcs?)?\s*(of\s+)?/i;

export function toGroceryName(ingredient: string): string {
  const stripped = ingredient.replace(MEASUREMENT_RE, '').trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function significantWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  );
}

export function nameOverlaps(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

export function mergeIntoGrocery(
  grocery: GroceryItem[],
  ingredients: RecipeIngredient[],
  mealId: string,
): GroceryItem[] {
  const result = [...grocery];
  for (const ingredient of ingredients) {
    const groceryName = toGroceryName(ingredient.name);
    const exists = result.some(g => nameOverlaps(g.name, groceryName));
    if (!exists) {
      result.push({
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: groceryName,
        category: ingredient.category,
        checked: false,
        warn: false,
        source_meal_ids: [mealId],
      });
    }
  }
  return result;
}

export function removeLinkedGroceryItems(grocery: GroceryItem[], mealId: string): GroceryItem[] {
  return grocery
    .map(item => {
      if (!item.source_meal_ids.includes(mealId)) return item;
      const remaining = item.source_meal_ids.filter(id => id !== mealId);
      if (remaining.length === 0) return null;
      return { ...item, source_meal_ids: remaining };
    })
    .filter((item): item is GroceryItem => item !== null);
}
