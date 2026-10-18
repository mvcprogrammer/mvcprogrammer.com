/**
 * Calendar math on day keys (YYYY-MM-DD) in the site's time zone. No date library: the Intl APIs
 * give today's key in America/New_York, and everything else is arithmetic on keys, so a daylight
 * saving change can never shift a day. Mirrors tools/lib/cf-logs.mjs, which cuts the day files.
 */

/** The zone the day files are cut on; the dashboard's "today" is today there, wherever the reader is. */
export const TIME_ZONE = 'America/New_York';

/** A calendar day as YYYY-MM-DD. */
export type DayKey = string;

/** An inclusive span of days. */
export interface DayRange {
  readonly from: DayKey;
  readonly to: DayKey;
}

const DAY_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const KEY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** True for a well-formed day key that names a real calendar day (so 2026-02-31 is refused). */
export function isDayKey(value: string): value is DayKey {
  return DAY_KEY_PATTERN.test(value) && addDays(value, 0) === value;
}

/** The day an instant falls on in the site's time zone. */
export function todayKey(now: Date = new Date()): DayKey {
  return KEY_FORMAT.format(now);
}

function parts(key: DayKey): [number, number, number] {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return [year ?? 0, month ?? 0, day ?? 0];
}

function keyOf(utc: Date): DayKey {
  return utc.toISOString().slice(0, 10);
}

/** The day `count` days after a key; negative counts go back. */
export function addDays(key: DayKey, count: number): DayKey {
  const [year, month, day] = parts(key);
  return keyOf(new Date(Date.UTC(year, month - 1, day + count)));
}

/** The number of days from one key to another, negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Every day from `from` to `to` inclusive; empty when `to` is earlier. */
export function dayKeysBetween(from: DayKey, to: DayKey): DayKey[] {
  const keys: DayKey[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) {
    keys.push(key);
  }
  return keys;
}

/** The first day of the month a key falls in. */
export function monthStart(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

/** The last day of the month a key falls in. */
export function monthEnd(key: DayKey): DayKey {
  const [year, month] = parts(key);
  return keyOf(new Date(Date.UTC(year, month, 0)));
}

/** The number of days in a range, counting both ends. */
export function rangeLength(range: DayRange): number {
  return daysBetween(range.from, range.to) + 1;
}

/** The range of the same length that ends the day before `range` starts. */
export function previousPeriod(range: DayRange): DayRange {
  const length = rangeLength(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** The Monday on or before a key, for weekly buckets. */
export function weekStart(key: DayKey): DayKey {
  const [year, month, day] = parts(key);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 is Sunday
  return addDays(key, -((weekday + 6) % 7));
}
