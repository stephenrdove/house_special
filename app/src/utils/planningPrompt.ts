import type { AppState, FamilyConstraints } from '../types';
import { DEFAULT_CONSTRAINTS } from '../types';

export function getNextSunday(): string {
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

function buildFamilyContext(c: FamilyConstraints): string {
  const totalEaters = c.family.adults + c.family.children.length;
  const familyParts: string[] = [];
  if (c.family.adults === 1) familyParts.push('one adult');
  else familyParts.push(`${c.family.adults} adults`);
  for (const child of c.family.children) {
    familyParts.push(`one ${child.age}-year-old`);
  }

  const lines: string[] = [
    `Plan 7 days of family dinners for a family of ${totalEaters} eater${totalEaters !== 1 ? 's' : ''}: ${familyParts.join(', ')}. Generate a complete grocery shopping list organized by store section.`,
  ];

  const dietaryLines: string[] = [];
  if (c.allergies.length > 0) {
    dietaryLines.push(`- ALLERGIES (safety-critical — hard constraints, no exceptions): ${c.allergies.join(', ')}`);
  }
  if (c.dietary_restrictions.length > 0) {
    dietaryLines.push(`- Dietary restrictions: ${c.dietary_restrictions.join(', ')}`);
  }
  if (c.family.children.some(ch => ch.age < 5)) {
    dietaryLines.push('- Toddler-friendly — simple flavors, no spicy food, soft textures or finger-food friendly when possible');
  }
  dietaryLines.push('- No elaborate or time-consuming recipes — 30–45 minutes or less on weeknights');

  lines.push('', '**Dietary requirements:**', ...dietaryLines);

  lines.push(
    '',
    '**Meal plan structure:**',
    '- Plan dinner for all 7 days',
    '- Include 1 leftover night',
    '- Keep meal names short and simple (2–5 words)',
    '- Keep it practical and filling',
  );

  if (c.favorites.length > 0) {
    lines.push('', '**Go-to meals — pull from these regularly:**', ...c.favorites.map(f => `- ${f}`));
  }

  if (c.avoid.length > 0) {
    lines.push('', `**Avoid these ingredients/dishes:** ${c.avoid.join(', ')}`);
  }

  if (c.preferred_cuisines.length > 0) {
    lines.push('', `**Preferred cuisines:** ${c.preferred_cuisines.join(', ')}`);
  }

  if (c.notes.trim()) {
    lines.push('', '**Additional notes:**', c.notes.trim());
  }

  return lines.join('\n');
}

// Not exported — the JSON format spec must never appear in a user-editable field.
function buildLockedSection(state: AppState, startDate: string): string {
  const recentMeals = getRecentMeals(state);
  const recentSection = recentMeals
    ? `\n\n**Recent meals — avoid repeating these in the upcoming plan:**\n${recentMeals}`
    : '';

  return `**Week schedule:**
${buildWeekSchedule(startDate)}

**Output format: valid JSON only.** No explanation, no markdown, no extra text. Do not create an artifact, canvas, or interactive view. The response must start with { and end with }

{
  "weeks": [
    {
      "week": 1,
      "days": [
        { "date": "YYYY-MM-DD", "meal": "Meal name", "notes": "", "leftover": false }
      ]
    }
  ],
  "grocery": [
    { "category": "Produce", "name": "Item name", "warn": false },
    { "category": "Condiments & Sauces", "name": "Tamari (soy sauce)", "warn": true }
  ]
}

**Rules:**
- "leftover": true for the 1 leftover night
- "warn": true for items needing certified allergy-safe versions (e.g. certified GF)
- "notes": keep empty or 1 short phrase max — no verbose descriptions
- Categories: Produce, Meat & Seafood, Dairy & Eggs, Frozen, Pantry / Dry Goods, Canned Goods, Condiments & Sauces, Other${recentSection}`;
}

export function buildPlanningPrompt(state: AppState, constraints?: FamilyConstraints | null, startDate?: string): string {
  const c = constraints ?? DEFAULT_CONSTRAINTS;
  const date = startDate ?? getNextSunday();
  return `${buildFamilyContext(c)}\n\n${buildLockedSection(state, date)}`;
}
