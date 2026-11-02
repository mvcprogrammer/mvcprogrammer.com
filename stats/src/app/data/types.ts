import type { DayKey } from '../dates';

/** The schema this build understands; a file from a newer schema is refused with a message to redeploy. */
export const SCHEMA_VERSION = 1;

/**
 * The four editions and the patient explorer, in display order, as the day files name them. The
 * explorer is not an edition of the site, but it is the fifth host with its own distribution and
 * log, and it sits in the same dimension so one switcher and one filter cover every host.
 */
export const EDITIONS = ['js', 'angular', 'react', 'blazor', 'fhir'] as const;

/** One of the four editions, or the patient explorer. */
export type Edition = (typeof EDITIONS)[number];

/** How each edition is named on screen. */
export const EDITION_LABELS: Readonly<Record<Edition, string>> = { js: 'JS', angular: 'Angular', react: 'React', blazor: 'Blazor', fhir: 'FHIR explorer' };

/**
 * How day files written before the explorer had an id named it: by its host. `normalizeDayFile`
 * maps these to the id, so the history before 2026-11-02 counts under the same key.
 */
export const LEGACY_EDITION_IDS: Readonly<Record<string, Edition>> = { 'fhir.mvcprogrammer.com': 'fhir' };

/** The page's sections in reading order, for the funnel. */
export const SECTION_ORDER = ['about', 'services', 'portfolio', 'resume', 'contact', 'colophon'] as const;

/** How each section is named on screen. */
export const SECTION_LABELS: Readonly<Record<string, string>> = {
  about: 'About',
  services: 'Services',
  portfolio: 'Portfolio',
  resume: 'Resume',
  contact: 'Contact',
  colophon: 'Colophon',
};

/** stats/data/index.json. */
export interface StatsIndex {
  readonly schemaVersion: number;
  /** When the exporter last ran, ISO 8601. */
  readonly generatedAt: string;
  readonly timeZone: string;
  /** The days that have a file, sorted. */
  readonly days: readonly DayKey[];
}

/** One visit, as tools/stats-export.mjs writes it. Fields the visit had nothing for are absent. */
export interface VisitRecord {
  /** A salted hash of the browser; the same browser gets the same token every day. */
  readonly token: string;
  /** The local hour the visit started, 0 to 23. */
  readonly hour: number;
  /** The editions it loaded a page on (the patient explorer is "fhir"), in display order. */
  readonly editions: readonly string[];
  /** Two-letter country of the CloudFront edge that served it, or "??". */
  readonly country: string;
  /** The edge code itself, for example "IAD". */
  readonly edge: string;
  /** The external referrer host; absent for a direct visit. */
  readonly referrer?: string;
  /** Load pings sent; absent when the script never ran. */
  readonly loads?: number;
  readonly screen?: string;
  readonly scheme?: string;
  /** Sections reached, in page order. */
  readonly sections?: readonly string[];
  /** The largest seconds-visible value reported. */
  readonly seconds?: number;
  /** Links followed, as kind/target/place. */
  readonly clicks?: readonly string[];
  /** Experience API calls. */
  readonly apiCalls?: number;
  /** Patient explorer API calls, and how many of them were writes (create, replace, patch, delete). */
  readonly fhirCalls?: number;
  readonly fhirWrites?: number;
  readonly skills?: readonly string[];
  readonly resumes?: readonly string[];
}

/** stats/data/days/YYYY-MM-DD.json. */
export interface DayFile {
  readonly schemaVersion: number;
  readonly day: DayKey;
  readonly timeZone: string;
  /** Every request that day, scanners included, the owner excluded. */
  readonly requests: number;
  /** Requests from bots, with no user agent, or ending in 4xx. */
  readonly scannerRequests: number;
  /** The visits that started that day, in start order. */
  readonly visits: readonly VisitRecord[];
}
