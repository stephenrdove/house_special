export const DAY_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const DAY_NAMES_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Use local-date formatting for meal keys so that a family in UTC+12 at 1am
// local time gets a key for *today* (local), not yesterday (UTC).
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a YYYY-MM-DD key as local noon so that getDay()/getDate() return the
// right values for display. Noon avoids DST-at-midnight edge cases for all
// timezones within ±12h of UTC (which covers all inhabited places).
export function parseDateKey(key: string): Date {
  return new Date(key + 'T12:00:00');
}
