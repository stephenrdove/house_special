import { describe, expect, it } from 'vitest';
import { matchRecipe, significantWords } from '../utils/matching';

// ── significantWords ───────────────────────────────────────────────────────────

describe('significantWords', () => {
  it('filters out words with 2 or fewer characters', () => {
    expect(significantWords('a an in').size).toBe(0);
    expect(significantWords('is it of').size).toBe(0);
  });

  it('lowercases and tokenizes', () => {
    const words = significantWords('Olive Oil');
    expect(words.has('olive')).toBe(true);
    expect(words.has('oil')).toBe(true);
  });

  it('strips punctuation and hyphens', () => {
    const words = significantWords('gluten-free pancakes');
    expect(words.has('gluten')).toBe(true);
    expect(words.has('free')).toBe(true);
    expect(words.has('pancakes')).toBe(true);
  });

  it('deduplicates repeated words', () => {
    const words = significantWords('chicken chicken chicken');
    expect(words.size).toBe(1);
  });
});

// ── matchRecipe ───────────────────────────────────────────────────────────────

const RECIPES = [
  { id: 'r1', name: 'Easy Gluten-Free Pancakes', tags: ['breakfast', 'pancakes', 'gluten-free'] },
  { id: 'r2', name: 'Chicken Tikka Masala', tags: ['indian', 'chicken', 'curry'] },
  { id: 'r3', name: 'Spaghetti Bolognese', tags: ['italian', 'pasta', 'beef'] },
  { id: 'r4', name: 'Asian Sesame Stir Fry', tags: ['asian', 'quick', 'vegetables'] },
];

describe('matchRecipe', () => {
  it('matches by exact name', () => {
    expect(matchRecipe('Chicken Tikka Masala', RECIPES)).toBe('r2');
  });

  it('matches by substring (meal name contains recipe name)', () => {
    expect(matchRecipe('Easy Gluten-Free Pancakes with syrup', RECIPES)).toBe('r1');
  });

  it('matches abbreviations by word overlap (GF Pancakes → Gluten-Free Pancakes)', () => {
    expect(matchRecipe('GF Pancakes', RECIPES)).toBe('r1');
  });

  it('matches by recipe name word overlap', () => {
    expect(matchRecipe('Tikka Masala', RECIPES)).toBe('r2');
  });

  it('matches by tag word overlap', () => {
    expect(matchRecipe('Italian Pasta Bake', RECIPES)).toBe('r3');
  });

  it('matches sesame stir fry by name words', () => {
    expect(matchRecipe('Sesame Stir Fry', RECIPES)).toBe('r4');
  });

  it('returns undefined when no match found', () => {
    // "Fish Tacos" shares no significant words with any recipe or tag in RECIPES
    expect(matchRecipe('Fish Tacos al Pastor', RECIPES)).toBeUndefined();
    // "Lemon Risotto" shares no significant words either
    expect(matchRecipe('Lemon Risotto', RECIPES)).toBeUndefined();
  });

  it('returns undefined for empty recipe list', () => {
    expect(matchRecipe('Pancakes', [])).toBeUndefined();
  });

  it('returns undefined for very short non-matching meal names', () => {
    expect(matchRecipe('Soup', RECIPES)).toBeUndefined();
  });
});
