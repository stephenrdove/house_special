export interface Meal {
  name: string;
  notes: string;
  leftover: boolean;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  warn: boolean;
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

export type View = 'calendar' | 'grocery' | 'import' | 'settings';

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
