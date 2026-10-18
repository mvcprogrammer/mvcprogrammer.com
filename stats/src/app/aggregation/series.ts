import { addDays, dayKeysBetween, daysBetween, weekStart, type DayKey, type DayRange } from '../dates';
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

/** The spans the range is drawn in: one per day, or one per calendar week (Monday to Sunday, clipped to the range) when it is long. */
export function bucketSpans(range: DayRange): DayRange[] {
  const keys = dayKeysBetween(range.from, range.to);
  if (keys.length <= WEEKLY_FROM_DAYS) {
    return keys.map((key) => ({ from: key, to: key }));
  }
  const spans: DayRange[] = [];
  for (const key of keys) {
    const last = spans[spans.length - 1];
    if (last !== undefined && weekStart(key) === weekStart(last.from)) {
      spans[spans.length - 1] = { from: last.from, to: key };
    } else {
      spans.push({ from: key, to: key });
    }
  }
  return spans;
}

function pointsFor(spans: readonly DayRange[], days: readonly DayVisits[]): SeriesPoint[] {
  const byDay = new Map(days.map((day) => [day.day, day]));
  const lookup = (key: DayKey): DayVisits => byDay.get(key) ?? { day: key, file: null, visits: [] };
  return spans.map((span) => point(span.from, dayKeysBetween(span.from, span.to).map(lookup)));
}

/** One point per day of the range, or per week when the range is long. */
export function buildSeries(range: DayRange, days: readonly DayVisits[]): SeriesPoint[] {
  return pointsFor(bucketSpans(range), days);
}

/**
 * The previous period's points, one for one with the current series: each current span is shifted
 * back by the range length, so the dashed line compares the same number of days at every point even
 * when the two periods start on different weekdays.
 */
export function buildPreviousSeries(current: DayRange, previous: DayRange, days: readonly DayVisits[]): SeriesPoint[] {
  const shift = daysBetween(previous.from, current.from);
  const spans = bucketSpans(current).map((span) => ({ from: addDays(span.from, -shift), to: addDays(span.to, -shift) }));
  return pointsFor(spans, days);
}

/** The last seven points' values of a field, for a tile's sparkline. */
export function sparkline(points: readonly SeriesPoint[], pick: (p: SeriesPoint) => number | null): number[] {
  return points.slice(-7).map((p) => pick(p) ?? 0);
}
