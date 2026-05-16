export function significantWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2),
  );
}

export function matchRecipe(
  mealName: string,
  recipes: { id: string; name: string; tags: string[] }[],
): string | undefined {
  const a = mealName.toLowerCase().trim();
  const mealWords = significantWords(mealName);

  return recipes.find(r => {
    const b = r.name.toLowerCase().trim();
    if (a === b || a.includes(b) || b.includes(a)) return true;

    const recipeWords = significantWords(r.name);
    const tagWords = new Set(r.tags.flatMap(t => [...significantWords(t)]));

    for (const word of mealWords) {
      if (recipeWords.has(word) || tagWords.has(word)) return true;
    }
    return false;
  })?.id;
}
