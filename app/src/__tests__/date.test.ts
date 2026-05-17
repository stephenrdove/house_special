import { describe, expect, it } from 'vitest';
import { dateKey, parseDateKey } from '../utils/date';

describe('dateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 16); // May 16 2026, local midnight
    expect(dateKey(d)).toBe('2026-05-16');
  });

  it('pads month and day with leading zeros', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05'); // Jan 5
    expect(dateKey(new Date(2026, 8, 3))).toBe('2026-09-03'); // Sep 3
  });

  it('uses local date, not UTC — dates near midnight stay correct', () => {
    // Build a Date at local noon (UTC offset irrelevant — getFullYear/Month/Date
    // are always local). Calling dateKey should give the same local date.
    const d = new Date(2026, 11, 31, 12, 0, 0); // Dec 31 local noon
    expect(dateKey(d)).toBe('2026-12-31');
  });

  it('round-trips through parseDateKey', () => {
    const original = '2026-07-04';
    const parsed = parseDateKey(original);
    expect(dateKey(parsed)).toBe(original);
  });
});

describe('parseDateKey', () => {
  it('returns a Date whose local date properties match the key', () => {
    const d = parseDateKey('2026-05-16');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);  // May = 4 (0-indexed)
    expect(d.getDate()).toBe(16);
  });

  it('parses at local noon so getDay() is reliable for all timezones', () => {
    // 2026-05-17 is a Sunday
    const d = parseDateKey('2026-05-17');
    expect(d.getDay()).toBe(0); // Sunday
  });

  it('handles month boundaries correctly', () => {
    const d = parseDateKey('2026-03-01');
    expect(d.getMonth()).toBe(2); // March = 2
    expect(d.getDate()).toBe(1);
  });

  it('handles leap year dates', () => {
    const d = parseDateKey('2028-02-29');
    expect(d.getDate()).toBe(29);
    expect(d.getMonth()).toBe(1); // Feb
  });
});
