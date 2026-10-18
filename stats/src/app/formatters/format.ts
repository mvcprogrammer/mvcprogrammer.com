import type { DayKey } from '../dates';

const NUMBER = new Intl.NumberFormat('en-US');
const DAY_SHORT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const DAY_LONG = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const DAY_WITH_YEAR = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const STAMP = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** 1,234. */
export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** A ratio as a percentage with one decimal under 10% and none above ("7.5%", "42%"), or an em dash for null. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) {
    return '–';
  }
  const percent = ratio * 100;
  return `${percent < 10 && percent !== 0 ? percent.toFixed(1) : Math.round(percent).toString()}%`;
}

/** Seconds as "45s" or "1m 05s", or an em dash for null. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '–';
  }
  const whole = Math.round(seconds);
  if (whole < 60) {
    return `${whole}s`;
  }
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}m ${rest.toString().padStart(2, '0')}s`;
}

/** A relative change as "+18%" or "-6%", or null when there is nothing to show. */
export function formatDelta(ratio: number | null): string | null {
  if (ratio === null || !Number.isFinite(ratio)) {
    return null;
  }
  const percent = Math.round(ratio * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/** A difference in percentage points as "+4 pts". */
export function formatPoints(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) {
    return null;
  }
  const points = Math.round((current - previous) * 100);
  return `${points > 0 ? '+' : ''}${points} pts`;
}

function utcDate(key: DayKey): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** "Oct 17". */
export function formatDayShort(key: DayKey): string {
  return DAY_SHORT.format(utcDate(key));
}

/** "Oct 17, 2026". */
export function formatDayWithYear(key: DayKey): string {
  return DAY_WITH_YEAR.format(utcDate(key));
}

/** "Saturday, October 17, 2026". */
export function formatDayLong(key: DayKey): string {
  return DAY_LONG.format(utcDate(key));
}

/** "Oct 1 – Oct 17, 2026" or "Oct 17, 2026" for a single day. */
export function formatRange(from: DayKey, to: DayKey): string {
  if (from === to) {
    return formatDayWithYear(from);
  }
  return from.slice(0, 4) === to.slice(0, 4) ? `${formatDayShort(from)} – ${formatDayWithYear(to)}` : `${formatDayWithYear(from)} – ${formatDayWithYear(to)}`;
}

/** "just now", "35 min ago", "2 h ago", "3 days ago". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return 'unknown';
  }
  const minutes = Math.round((now.getTime() - then) / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 36) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / 24)} days ago`;
}

/** The exact local time of an ISO stamp, for a tooltip. */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? STAMP.format(date) : iso;
}

/** "14:00" for an hour of the day. */
export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/** The flag emoji for a two-letter country code, or an empty string for an unknown one. */
export function flagOf(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) {
    return '';
  }
  return String.fromCodePoint(...[...country].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/** A country's English name, or the code when the browser does not know it. */
export function countryName(country: string): string {
  if (country === '??') {
    return 'Unknown';
  }
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}
