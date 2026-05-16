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
  family: { adults: 2, children: [{ age: 2 }] },
  allergies: ['gluten'],
  dietary_restrictions: [],
  favorites: [
    'Al Fresco chicken meatballs with GF pasta and marinara',
    "Kevin's sous vide meats (Korean BBQ, Tikka Masala) over jasmine rice",
    'Bubba Burgers on GF buns',
    'Chicken burgers (Costco-style) on GF buns',
    'Hotdog night on GF buns',
    'Frozen GF pizza (Udi\'s, Against the Grain)',
    'Egg scramble or breakfast sandwich on GF bread',
    'Taco night with corn tortillas',
    'Rice bowls (protein + jasmine rice + veggie)',
    'Roasted chicken thighs with oven-roasted veggies',
    'GF stir fry over rice with tamari',
  ],
  avoid: [],
  preferred_cuisines: ['Italian', 'Mexican', 'Asian'],
  notes: 'Adult female has celiac disease — strictly gluten-free, not just gluten-sensitive. Watch for hidden gluten: use tamari not soy sauce, avoid malt vinegar, non-GF oats, seasoning packets, flour-dusted frozen foods.\n\nWednesday alternates each fortnight: "⭐ Fan Favorite Night" (rotate Chicken and Cashew, Sesame Chicken, Chicken Parmesan — all GF) or "🆕 Try Something New Night" (GF, toddler-friendly, adventurous). Label clearly in the meal name.',
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
