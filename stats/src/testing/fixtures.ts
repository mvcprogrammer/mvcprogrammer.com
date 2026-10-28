import type { DayKey } from '../app/dates';
import { addDays, dayKeysBetween } from '../app/dates';
import type { DayLoad, StatsClient } from '../app/data/stats-client';
import { SCHEMA_VERSION, type DayFile, type StatsIndex, type VisitRecord } from '../app/data/types';

/** A visit with sensible defaults; override what the test cares about. */
export function makeVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return { token: 'aaaaaaaaaa', hour: 10, editions: ['js'], country: 'US', edge: 'IAD', ...overrides };
}

/** A day file with the given visits. */
export function makeDay(day: DayKey, visits: readonly VisitRecord[], requests = visits.length * 10 + 50, scannerRequests = 40): DayFile {
  return { schemaVersion: SCHEMA_VERSION, day, timeZone: 'America/New_York', requests, scannerRequests, visits };
}

/** A small, fully deterministic pseudo-random sequence (mulberry32), so a generated fixture is the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EDITION_WEIGHTS: ReadonlyArray<[string, number]> = [['js', 0.4], ['react', 0.3], ['angular', 0.17], ['blazor', 0.13]];
const REFERRERS: ReadonlyArray<[string | undefined, number]> = [[undefined, 0.75], ['www.linkedin.com', 0.12], ['www.google.com', 0.08], ['github.com', 0.05]];
const COUNTRIES: ReadonlyArray<[[string, string], number]> = [[['US', 'IAD'], 0.5], [['DE', 'FRA'], 0.2], [['NL', 'AMS'], 0.1], [['GB', 'LHR'], 0.1], [['CA', 'YUL'], 0.1]];
const SECTIONS = ['about', 'services', 'portfolio', 'resume', 'contact', 'colophon'];

function pick<T>(random: () => number, weighted: ReadonlyArray<[T, number]>): T {
  let roll = random();
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) {
      return value;
    }
  }
  return weighted[weighted.length - 1]?.[0] as T;
}

/** A plausible range of days with a weekday rhythm, for the Dashboard tests and the dev server when there are no logs. */
export function generateDays(from: DayKey, to: DayKey, seed = 7): DayFile[] {
  const random = seeded(seed);
  return dayKeysBetween(from, to).map((day, index) => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const base = weekday === 0 || weekday === 6 ? 6 : 14;
    const count = Math.max(1, Math.round(base + (random() - 0.5) * 8 + index * 0.1));
    const visits: VisitRecord[] = [];
    for (let i = 0; i < count; i++) {
      const [country, edge] = pick(random, COUNTRIES);
      const referrer = pick(random, REFERRERS);
      const edition = pick(random, EDITION_WEIGHTS);
      const ranScript = random() < 0.7;
      const reached = ranScript && random() < 0.6 ? SECTIONS.slice(0, 1 + Math.floor(random() * SECTIONS.length)) : [];
      const visit: VisitRecord = {
        token: Math.floor(random() * 4000).toString(16).padStart(10, '0'),
        hour: Math.min(23, Math.floor(8 + random() * 14)),
        editions: random() < 0.1 ? [edition, 'angular'].filter((value, position, list) => list.indexOf(value) === position) : [edition],
        country,
        edge,
        ...(referrer === undefined ? {} : { referrer }),
        ...(ranScript ? { loads: 1, screen: pick(random, [['desktop', 0.6], ['phone', 0.33], ['tablet', 0.07]]), scheme: random() < 0.55 ? 'dark' : 'light' } : {}),
        ...(reached.length > 0 ? { sections: reached, seconds: Math.round(10 + random() * 200) } : {}),
        ...(ranScript && random() < 0.12 ? { clicks: [`edition/${pick(random, [['angular', 0.4], ['react', 0.4], ['blazor', 0.2]])}/${pick(random, [['header', 0.6], ['about', 0.3], ['hero', 0.1]])}`] } : {}),
        ...(ranScript && random() < 0.08 ? { clicks: [`github/${random() < 0.6 ? 'profile' : 'mvcprogrammer.com'}/about`] } : {}),
        ...(random() < 0.5 ? { apiCalls: 1 } : {}),
        ...(random() < 0.05 ? { resumes: [edition === 'js' ? 'vanilla' : edition] } : {}),
      };
      visits.push(visit);
    }
    return makeDay(day, visits);
  });
}

/** A StatsClient over in-memory day files; days not in the list load as missing. */
export function fakeStatsClient(days: readonly DayFile[], generatedAt = '2026-10-18T13:00:00Z'): StatsClient & { readonly requested: DayKey[] } {
  const byDay = new Map(days.map((day) => [day.day, day]));
  const requested: DayKey[] = [];
  const index: StatsIndex = { schemaVersion: SCHEMA_VERSION, generatedAt, timeZone: 'America/New_York', days: [...byDay.keys()].sort() };
  return {
    requested,
    loadIndex: () => Promise.resolve(index),
    loadDays: (keys) => {
      requested.push(...keys);
      return Promise.resolve(keys.map((day): DayLoad => ({ day, file: byDay.get(day) ?? null })));
    },
  };
}

/** The last `count` days ending the day before `today`, for tests that want a stable window. */
export function recentRange(today: DayKey, count: number): { from: DayKey; to: DayKey } {
  return { from: addDays(today, -(count - 1)), to: today };
}
