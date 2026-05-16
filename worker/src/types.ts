export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN: string;
  ANTHROPIC_API_KEY: string;
}

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  picture: string;
}

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

export interface AppState {
  meals: Record<string, Meal>;
  grocery: GroceryItem[];
}
