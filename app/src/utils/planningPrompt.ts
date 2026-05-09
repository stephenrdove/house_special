import type { AppState } from '../types';

function getNextSunday(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (7 - today.getDay()) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().slice(0, 10);
}

function getRecentMeals(state: AppState): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(today.getDate() - 28);
  return Object.entries(state.meals)
    .filter(([date, meal]) => {
      const d = new Date(date);
      return d >= cutoff && d < today && meal.name && !meal.leftover;
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, meal]) => `  ${date}: ${meal.name}`)
    .join('\n');
}

export function buildPlanningPrompt(state: AppState): string {
  const startDate = getNextSunday();
  const recentMeals = getRecentMeals(state);
  const recentSection = recentMeals
    ? `\n\n**Recent meals — avoid repeating these in the upcoming plan:**\n${recentMeals}`
    : '';

  return `Plan 14 days of family dinners for a family of 3 eaters: one adult man, one adult woman, and one 2.5-year-old toddler. Generate a complete grocery shopping list organized by store section.

**Dietary requirements:**
- Strictly gluten-free — the mom has celiac disease. No wheat, barley, rye, or hidden gluten. Watch for: soy sauce (use tamari), malt vinegar, non-GF oats, flour-dusted frozen foods, and seasoning packets
- Toddler-friendly — simple flavors, no spicy food, soft textures or finger-food friendly when possible
- No elaborate or time-consuming recipes — 30–45 minutes or less on weeknights

**Meal plan structure:**
- Plan dinner for all 14 days
- Include 2 leftover nights spread across the two weeks
- Repeating meals across Week 1 and Week 2 is totally fine and encouraged
- Keep it practical and filling

**Our go-to meals — pull from these regularly:**
- Al Fresco chicken meatballs with GF pasta and marinara
- Kevin's brand pre-cooked sous vide meats (e.g. Korean BBQ chicken, Tikka Masala) over jasmine rice with a simple veggie
- Bubba Burgers on GF buns
- Chicken burgers (Costco-style) on GF buns
- Hotdog night — GF hotdogs on GF buns
- Frozen GF pizza night (e.g. Udi's, Against the Grain)
- Egg scramble or egg/cheese/avocado/bacon sandwich on GF bread
- Taco night with corn tortillas, ground beef or chicken
- Rice bowls — protein + jasmine rice + veggie
- Roasted chicken thighs with oven-roasted veggies
- GF stir fry over rice with tamari

**Wednesday — Special Night:**
Alternates each fortnight between:
- **Fan Favorite Night** — rotate through: ⭐ Chicken and Cashew, ⭐ Sesame Chicken, ⭐ Chicken Parmesan (all GF)
- **Try Something New Night** — GF, toddler-friendly, more adventurous

Label Wednesday clearly: "⭐ Fan Favorite: Sesame Chicken" or "🆕 New: Thai Basil Beef Bowl"

**Output format: valid JSON only.** No explanation, no markdown, no extra text.

{
  "weeks": [
    {
      "week": 1,
      "days": [
        { "date": "YYYY-MM-DD", "meal": "Meal name", "notes": "optional", "leftover": false }
      ]
    },
    { "week": 2, "days": [...] }
  ],
  "grocery": [
    { "category": "Produce", "name": "Item name", "warn": false },
    { "category": "Condiments & Sauces", "name": "Tamari (soy sauce)", "warn": true }
  ]
}

**Rules:**
- "leftover": true for leftover nights
- "warn": true for items needing certified GF versions
- Dates start from ${startDate}
- Categories: Produce, Meat & Seafood, Dairy & Eggs, Frozen, Pantry / Dry Goods, Canned Goods, Condiments & Sauces, Other
- Don't repeat the same Wednesday Fan Favorite two fortnights in a row${recentSection}`;
}
