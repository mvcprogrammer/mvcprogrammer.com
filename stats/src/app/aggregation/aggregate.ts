import { EDITIONS, SECTION_ORDER, type VisitRecord } from '../data/types';
import { DIRECT, type Segment } from '../query/query';

/** Counts keyed by value. */
export type Counts = Readonly<Record<string, number>>;

/** Everything the tiles and panels show for a set of visits. Pure data; the formatters turn it into text. */
export interface Summary {
  readonly visits: number;
  /** Distinct visitor tokens. */
  readonly visitors: number;
  /** Visits that sent any ping (load, view, or leave): the script ran. */
  readonly beaconReached: number;
  /** Visits that sent a load ping, which is where screen and scheme come from. */
  readonly beaconLoads: number;
  /** Visits that reached at least one section. */
  readonly engaged: number;
  readonly byEdition: Counts;
  readonly byScreen: Counts;
  readonly byScheme: Counts;
  readonly byReferrer: Counts;
  readonly byCountry: Counts;
  /** Visit starts per local hour, 24 entries. */
  readonly byHour: readonly number[];
  /** Engaged visits that reached each section, in page order. */
  readonly sectionReach: Counts;
  /** Seconds visible, one per visit that reported it, sorted ascending. */
  readonly seconds: readonly number[];
  /** Clicks keyed by kind/target/place. */
  readonly clicks: Counts;
  /** Visits with at least one edition click. */
  readonly editionClickVisits: number;
  /** Visits with at least one GitHub click, and the split between the profile and repositories. */
  readonly githubClickVisits: number;
  readonly githubProfileClicks: number;
  readonly githubRepoClicks: number;
  /** Visits that called the Experience API. */
  readonly apiLoads: number;
  readonly skillClicks: Counts;
  readonly resumeDownloads: Counts;
}

/** The empty summary, for a range with no visits. */
export const EMPTY_SUMMARY: Summary = summarize([]);

/** True when the visit matches every segment. */
export function matches(visit: VisitRecord, segments: readonly Segment[]): boolean {
  return segments.every((segment) => {
    switch (segment.dimension) {
      case 'edition':
        return visit.editions.includes(segment.value);
      case 'screen':
        return visit.screen === segment.value;
      case 'scheme':
        return visit.scheme === segment.value;
      case 'referrer':
        return (visit.referrer ?? DIRECT) === segment.value;
      case 'country':
        return visit.country === segment.value;
    }
  });
}

/** The visits that match every segment. */
export function filterVisits(visits: readonly VisitRecord[], segments: readonly Segment[]): VisitRecord[] {
  return segments.length === 0 ? [...visits] : visits.filter((visit) => matches(visit, segments));
}

/** Counts of each value, with `first` keys ahead of the rest and the rest by count descending, then name. */
export function countBy(values: Iterable<string>, first: readonly string[] = []): Counts {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const head = first.filter((key) => counts.has(key));
  const tail = [...counts.keys()].filter((key) => !first.includes(key)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
  return Object.fromEntries([...head, ...tail].map((key) => [key, counts.get(key) ?? 0]));
}

/** True when the visit sent any ping at all, so the script ran in a real browser. */
export function ranScript(visit: VisitRecord): boolean {
  return (visit.loads ?? 0) > 0 || (visit.sections?.length ?? 0) > 0 || visit.seconds !== undefined || (visit.clicks?.length ?? 0) > 0;
}

/** The summary of a set of visits. */
export function summarize(visits: readonly VisitRecord[]): Summary {
  const loaded = visits.filter((visit) => (visit.loads ?? 0) > 0);
  const reached = visits.filter(ranScript);
  const engaged = visits.filter((visit) => (visit.sections?.length ?? 0) > 0);
  const byHour = new Array<number>(24).fill(0);
  for (const visit of visits) {
    if (visit.hour >= 0 && visit.hour < 24) {
      byHour[visit.hour] = (byHour[visit.hour] ?? 0) + 1;
    }
  }
  const clicks = visits.flatMap((visit) => visit.clicks ?? []);
  const github = clicks.filter((click) => click.startsWith('github/'));

  return {
    visits: visits.length,
    visitors: new Set(visits.map((visit) => visit.token)).size,
    beaconReached: reached.length,
    beaconLoads: loaded.length,
    engaged: engaged.length,
    byEdition: countBy(visits.flatMap((visit) => visit.editions), EDITIONS),
    byScreen: countBy(loaded.map((visit) => visit.screen ?? '?'), ['phone', 'tablet', 'desktop']),
    byScheme: countBy(loaded.map((visit) => visit.scheme ?? '?'), ['light', 'dark']),
    byReferrer: countBy(visits.map((visit) => visit.referrer ?? DIRECT)),
    byCountry: countBy(visits.map((visit) => visit.country)),
    byHour,
    sectionReach: countBy(engaged.flatMap((visit) => visit.sections ?? []), SECTION_ORDER),
    seconds: visits.flatMap((visit) => (visit.seconds === undefined ? [] : [visit.seconds])).sort((a, b) => a - b),
    clicks: countBy(clicks),
    editionClickVisits: visits.filter((visit) => visit.clicks?.some((click) => click.startsWith('edition/')) ?? false).length,
    githubClickVisits: visits.filter((visit) => visit.clicks?.some((click) => click.startsWith('github/')) ?? false).length,
    githubProfileClicks: github.filter((click) => click.startsWith('github/profile/')).length,
    githubRepoClicks: github.filter((click) => !click.startsWith('github/profile/')).length,
    apiLoads: visits.filter((visit) => (visit.apiCalls ?? 0) > 0).length,
    skillClicks: countBy(visits.flatMap((visit) => visit.skills ?? [])),
    resumeDownloads: countBy(visits.flatMap((visit) => visit.resumes ?? [])),
  };
}

/** Visitors seen on more than one day: tokens that appear in more than one of the day lists. */
export function returningVisitors(days: ReadonlyArray<readonly VisitRecord[]>): number {
  const daysSeen = new Map<string, number>();
  for (const visits of days) {
    for (const token of new Set(visits.map((visit) => visit.token))) {
      daysSeen.set(token, (daysSeen.get(token) ?? 0) + 1);
    }
  }
  return [...daysSeen.values()].filter((count) => count > 1).length;
}

/** The value at a quantile of a sorted list, or null for an empty list. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
}

/** A share as a ratio, or null when the whole is zero. */
export function share(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

/** The relative change from `previous` to `current`, or null when there is nothing to compare against. */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

/** Upper bounds, in seconds, of the time-on-page buckets; the last bucket is open-ended. */
export const TIME_BUCKETS = [10, 30, 60, 120, 300] as const;

/** Labels for the buckets, in order. */
export const TIME_BUCKET_LABELS = ['0-10 s', '10-30 s', '30-60 s', '1-2 min', '2-5 min', '5 min+'] as const;

/** How many visits fall in each time-on-page bucket. */
export function bucketSeconds(seconds: readonly number[]): number[] {
  const buckets = new Array<number>(TIME_BUCKETS.length + 1).fill(0);
  for (const value of seconds) {
    const index = TIME_BUCKETS.findIndex((bound) => value < bound);
    const slot = index === -1 ? TIME_BUCKETS.length : index;
    buckets[slot] = (buckets[slot] ?? 0) + 1;
  }
  return buckets;
}

/** A click key split into its parts. */
export function splitClick(key: string): { kind: string; target: string; place: string } {
  const [kind = '?', target = '?', ...rest] = key.split('/');
  return { kind, target, place: rest.join('/') || '?' };
}
