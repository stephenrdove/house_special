import { describe, expect, it } from 'vitest';
import { isSafeUrl, validateConstraints } from '../utils/safe';

// ── isSafeUrl ─────────────────────────────────────────────────────────────────

describe('isSafeUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeUrl('https://example.com/recipe')).toBe(true);
    expect(isSafeUrl('http://example.com/recipe')).toBe(true);
  });

  it('rejects file:// URLs', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects ftp:// URLs', () => {
    expect(isSafeUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects bare paths and hostnames without a scheme', () => {
    expect(isSafeUrl('/etc/passwd')).toBe(false);
    expect(isSafeUrl('example.com')).toBe(false);
  });

  it('rejects empty string and non-string values', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });

  it('accepts URLs with query strings and fragments', () => {
    expect(isSafeUrl('https://example.com/recipe?id=1&page=2#instructions')).toBe(true);
  });
});

// ── validateConstraints ───────────────────────────────────────────────────────

const VALID: Parameters<typeof validateConstraints>[0] = {
  family: { adults: 2, children: [{ age: 3 }] },
  allergies: ['gluten'],
  dietary_restrictions: ['vegetarian'],
  favorites: ['Tacos'],
  avoid: ['liver'],
  preferred_cuisines: ['Italian'],
  notes: 'Keep it simple on weeknights.',
};

describe('validateConstraints', () => {
  it('accepts a well-formed constraints object', () => {
    const out = validateConstraints(VALID);
    expect(out).toEqual(VALID);
  });

  it('accepts zero children', () => {
    expect(validateConstraints({ ...VALID, family: { adults: 1, children: [] } })).not.toBeNull();
  });

  it('accepts empty string arrays', () => {
    expect(validateConstraints({ ...VALID, allergies: [], favorites: [], avoid: [] })).not.toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateConstraints(null)).toBeNull();
    expect(validateConstraints('constraints')).toBeNull();
    expect(validateConstraints(42)).toBeNull();
  });

  it('rejects missing or invalid family block', () => {
    const { family: _f, ...noFamily } = VALID;
    expect(validateConstraints(noFamily)).toBeNull();
    expect(validateConstraints({ ...VALID, family: null })).toBeNull();
    expect(validateConstraints({ ...VALID, family: { adults: 'two', children: [] } })).toBeNull();
    expect(validateConstraints({ ...VALID, family: { adults: 2 } })).toBeNull(); // missing children
  });

  it('rejects children with non-numeric age', () => {
    expect(validateConstraints({ ...VALID, family: { adults: 2, children: [{ age: 'old' }] } })).toBeNull();
    expect(validateConstraints({ ...VALID, family: { adults: 2, children: [{}] } })).toBeNull();
  });

  it('rejects non-array string fields', () => {
    expect(validateConstraints({ ...VALID, allergies: 'gluten' })).toBeNull();
    expect(validateConstraints({ ...VALID, favorites: null })).toBeNull();
  });

  it('rejects non-string items inside string arrays', () => {
    expect(validateConstraints({ ...VALID, allergies: ['gluten', 5] })).toBeNull();
    expect(validateConstraints({ ...VALID, dietary_restrictions: [{ type: 'vegan' }] })).toBeNull();
  });

  it('rejects non-string notes', () => {
    expect(validateConstraints({ ...VALID, notes: 42 })).toBeNull();
    expect(validateConstraints({ ...VALID, notes: null })).toBeNull();
  });

  it('rejects when required fields are missing', () => {
    const { notes: _n, ...noNotes } = VALID;
    expect(validateConstraints(noNotes)).toBeNull();
    const { preferred_cuisines: _p, ...noCuisines } = VALID;
    expect(validateConstraints(noCuisines)).toBeNull();
  });
});
