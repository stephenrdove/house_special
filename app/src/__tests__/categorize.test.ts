import { describe, expect, it } from 'vitest';
import { categorizeGroceryItem } from '../utils/categorize';

describe('categorizeGroceryItem', () => {
  describe('produce', () => {
    it.each([
      ['broccoli', 'Produce'],
      ['garlic', 'Produce'],
      ['cherry tomatoes', 'Produce'],
      ['baby spinach', 'Produce'],
      ['avocado', 'Produce'],
      ['sweet potato', 'Produce'],
      ['bell pepper', 'Produce'],
      ['mushrooms', 'Produce'],
      ['lemon', 'Produce'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('meat & seafood', () => {
    it.each([
      ['chicken thighs', 'Meat & Seafood'],
      ['ground beef', 'Meat & Seafood'],
      ['salmon fillet', 'Meat & Seafood'],
      ['shrimp', 'Meat & Seafood'],
      ['bacon', 'Meat & Seafood'],
      ['Italian sausage', 'Meat & Seafood'],
      ['turkey', 'Meat & Seafood'],
      ['pork tenderloin', 'Meat & Seafood'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('dairy & eggs', () => {
    it.each([
      ['eggs', 'Dairy & Eggs'],
      ['whole milk', 'Dairy & Eggs'],
      ['butter', 'Dairy & Eggs'],
      ['cheddar cheese', 'Dairy & Eggs'],
      ['Greek yogurt', 'Dairy & Eggs'],
      ['heavy cream', 'Dairy & Eggs'],
      ['cream cheese', 'Dairy & Eggs'],
      ['sour cream', 'Dairy & Eggs'],
      ['parmesan', 'Dairy & Eggs'],
      ['oat milk', 'Dairy & Eggs'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('frozen', () => {
    it.each([
      ['frozen peas', 'Frozen'],
      ['frozen corn', 'Frozen'],
      ['frozen chicken breasts', 'Frozen'],
      ['frozen edamame', 'Frozen'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });

    it('frozen overrides other categories', () => {
      expect(categorizeGroceryItem('frozen chicken', [])).toBe('Frozen');
      expect(categorizeGroceryItem('frozen broccoli', [])).toBe('Frozen');
    });
  });

  describe('pantry / dry goods', () => {
    it.each([
      ['all-purpose flour', 'Pantry / Dry Goods'],
      ['gluten-free flour', 'Pantry / Dry Goods'],
      ['jasmine rice', 'Pantry / Dry Goods'],
      ['penne pasta', 'Pantry / Dry Goods'],
      ['granulated sugar', 'Pantry / Dry Goods'],
      ['baking powder', 'Pantry / Dry Goods'],
      ['vanilla extract', 'Pantry / Dry Goods'],
      ['walnuts', 'Pantry / Dry Goods'],
      ['rolled oats', 'Pantry / Dry Goods'],
      ['cumin', 'Pantry / Dry Goods'],
      ['smoked paprika', 'Pantry / Dry Goods'],
      ['peanut butter', 'Pantry / Dry Goods'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('canned goods', () => {
    it.each([
      ['black beans', 'Canned Goods'],
      ['chickpeas', 'Canned Goods'],
      ['chicken broth', 'Canned Goods'],
      ['beef stock', 'Canned Goods'],
      ['tomato paste', 'Canned Goods'],
      ['coconut milk', 'Canned Goods'],
      ['diced tomatoes', 'Canned Goods'],
      ['crushed tomatoes', 'Canned Goods'],
      ['kidney beans', 'Canned Goods'],
      ['cannellini beans', 'Canned Goods'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('condiments & sauces', () => {
    it.each([
      ['olive oil', 'Condiments & Sauces'],
      ['sesame oil', 'Condiments & Sauces'],
      ['soy sauce', 'Condiments & Sauces'],
      ['tamari', 'Condiments & Sauces'],
      ['dijon mustard', 'Condiments & Sauces'],
      ['balsamic vinegar', 'Condiments & Sauces'],
      ['sriracha', 'Condiments & Sauces'],
      ['tahini', 'Condiments & Sauces'],
      ['fish sauce', 'Condiments & Sauces'],
      ['hoisin sauce', 'Condiments & Sauces'],
      ['maple syrup', 'Condiments & Sauces'],
      ['honey', 'Condiments & Sauces'],
    ])('%s → %s', (name, expected) => {
      expect(categorizeGroceryItem(name, [])).toBe(expected);
    });
  });

  describe('phrase priority — more specific wins over single keyword', () => {
    it('olive oil → Condiments, not Canned (olive)', () => {
      expect(categorizeGroceryItem('olive oil', [])).toBe('Condiments & Sauces');
    });
    it('chicken broth → Canned Goods, not Meat & Seafood (chicken)', () => {
      expect(categorizeGroceryItem('chicken broth', [])).toBe('Canned Goods');
    });
    it('tomato paste → Canned Goods, not Produce (tomato)', () => {
      expect(categorizeGroceryItem('tomato paste', [])).toBe('Canned Goods');
    });
    it('sesame oil → Condiments, not Pantry (sesame seed)', () => {
      expect(categorizeGroceryItem('sesame oil', [])).toBe('Condiments & Sauces');
    });
    it('oat milk → Dairy & Eggs, not Pantry (oat)', () => {
      expect(categorizeGroceryItem('oat milk', [])).toBe('Dairy & Eggs');
    });
    it('cream cheese → Dairy & Eggs (phrase), not just cream', () => {
      expect(categorizeGroceryItem('cream cheese', [])).toBe('Dairy & Eggs');
    });
  });

  describe('existing grocery list matching', () => {
    it('inherits category from an existing item with overlapping words', () => {
      const existing = [{ name: 'Olive Oil', category: 'Condiments & Sauces' }];
      expect(categorizeGroceryItem('extra virgin olive oil', existing)).toBe('Condiments & Sauces');
    });

    it('respects user-overridden category even when it differs from dictionary', () => {
      const existing = [{ name: 'Broccoli', category: 'Other' }];
      expect(categorizeGroceryItem('broccoli florets', existing)).toBe('Other');
    });

    it('falls back to dictionary when no existing item matches', () => {
      const existing = [{ name: 'Pasta', category: 'Pantry / Dry Goods' }];
      expect(categorizeGroceryItem('broccoli', existing)).toBe('Produce');
    });
  });

  describe('fallback', () => {
    it('returns Other for unrecognized items', () => {
      expect(categorizeGroceryItem('mystery ingredient', [])).toBe('Other');
      expect(categorizeGroceryItem('foobarbaz', [])).toBe('Other');
    });
  });
});
