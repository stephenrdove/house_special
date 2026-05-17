export interface Meal {
  id: string;
  name: string;
  notes: string;
  leftover: boolean;
  recipe_id?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  warn: boolean;
  source_meal_ids: string[];
}

export interface RecipeIngredient {
  name: string;
  category: string;
}

export interface AppState {
  meals: Record<string, Meal>;
  grocery: GroceryItem[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  picture: string;
  is_owner: boolean;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export type View = 'calendar' | 'grocery' | 'import' | 'recipes' | 'settings';

export interface Recipe {
  id: string;
  name: string;
  source_url: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  notes: string;
  tags: string[];
  created_at: number;
}

export interface ExtractedRecipe {
  name: string;
  source_url?: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  notes: string;
  tags: string[];
}

export interface FamilyConstraints {
  family: {
    adults: number;
    children: { age: number }[];
  };
  allergies: string[];
  dietary_restrictions: string[];
  favorites: string[];
  avoid: string[];
  preferred_cuisines: string[];
  notes: string;
}

export const DEFAULT_CONSTRAINTS: FamilyConstraints = {
  family: { adults: 2, children: [] },
  allergies: [],
  dietary_restrictions: [],
  favorites: [],
  avoid: [],
  preferred_cuisines: [],
  notes: '',
};

export const GROCERY_CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Frozen',
  'Pantry / Dry Goods',
  'Canned Goods',
  'Condiments & Sauces',
  'Other',
] as const;

export type GroceryCategory = typeof GROCERY_CATEGORIES[number];
