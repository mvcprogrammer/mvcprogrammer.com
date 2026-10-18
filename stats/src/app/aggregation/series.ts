import { dayKeysBetween, weekStart, type DayKey, type DayRange } from '../dates';
import type { DayFile } from '../data/types';
import { quantile, summarize } from './aggregate';
import type { VisitRecord } from '../data/types';

/** A day's (or week's) worth of numbers for the main chart. */
export interface SeriesPoint {
  /** The day, or the Monday of the week. */
  readonly key: DayKey;
  readonly visits: number;
  readonly visitors: number;
  /** Share of visits that sent any ping, or null with no visits. */
  readonly beaconReach: number | null;
  /** Median seconds visible, or null when nothing was reported. */
  readonly medianSeconds: number | null;
  readonly editionClicks: number;
  readonly requests: number;
  readonly scannerRequests: number;
  /** True when no file exists for the day (or for any day of the week). */
  readonly missing: boolean;
}

/** The days of a range with their visits (already filtered) and whether a file existed. */
export interface DayVisits {
  readonly day: DayKey;
  readonly file: DayFile | null;
  readonly visits: readonly VisitRecord[];
}

/** Daily points past this many days become weekly ones, because daily lines past three months are noise. */
export const WEEKLY_FROM_DAYS = 90;

function point(key: DayKey, days: readonly DayVisits[]): SeriesPoint {
  const visits = days.flatMap((day) => day.visits);
  const summary = summarize(visits);
  return {
    key,
    visits: summary.visits,
    visitors: summary.visitors,
    beaconReach: summary.visits === 0 ? null : summary.beaconReached / summary.visits,
    medianSeconds: quantile(summary.seconds, 0.5),
    editionClicks: summary.editionClickVisits,
    requests: days.reduce((total, day) => total + (day.file?.requests ?? 0), 0),
    scannerRequests: days.reduce((total, day) => total + (day.file?.scannerRequests ?? 0), 0),
    missing: days.some((day) => day.file === null),
  };
}

/** One point per day of the range, or per week when the range is long. */
export function buildSeries(range: DayRange, days: readonly DayVisits[]): SeriesPoint[] {
  const byDay = new Map(days.map((day) => [day.day, day]));
  const keys = dayKeysBetween(range.from, range.to);
  const lookup = (key: DayKey): DayVisits => byDay.get(key) ?? { day: key, file: null, visits: [] };
  if (keys.length <= WEEKLY_FROM_DAYS) {
    return keys.map((key) => point(key, [lookup(key)]));
  }
  const weeks = new Map<DayKey, DayVisits[]>();
  for (const key of keys) {
    const monday = weekStart(key);
    const bucket = weeks.get(monday) ?? [];
    bucket.push(lookup(key));
    weeks.set(monday, bucket);
  }
  return [...weeks.entries()].map(([monday, bucket]) => point(monday, bucket));
}

/** The last seven points' values of a field, for a tile's sparkline. */
export function sparkline(points: readonly SeriesPoint[], pick: (p: SeriesPoint) => number | null): number[] {
  return points.slice(-7).map((p) => pick(p) ?? 0);
}
