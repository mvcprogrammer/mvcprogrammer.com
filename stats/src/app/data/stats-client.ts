import type { DayKey } from '../dates';
import { SCHEMA_VERSION, type DayFile, type StatsIndex } from './types';

/** One day's file, or the reason there is none. */
export interface DayLoad {
  readonly day: DayKey;
  /** The file, or null when the server has no file for that day (a 404). */
  readonly file: DayFile | null;
}

/** Reads the index and the day files. The fetch implementation is the production one; tests use a fake. */
export interface StatsClient {
  /** The index; every call fetches it again so the "Updated" stamp is fresh. */
  loadIndex(signal?: AbortSignal): Promise<StatsIndex>;
  /**
   * The files for the given days, in the same order, fetched in parallel and cached. Not abortable:
   * a day file is shared by every view that needs it, so one caller going away must not fail another.
   */
  loadDays(days: readonly DayKey[]): Promise<DayLoad[]>;
}

/** Thrown for a non-2xx response other than a missing day file. */
export class HttpStatusError extends Error {
  /** The response status. */
  readonly status: number;
  /** The requested URL. */
  readonly url: string;

  constructor(status: number, url: string) {
    super(`${url} answered ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
  }
}

/** Thrown when a file was written by a newer exporter than this build understands. */
export class SchemaVersionError extends Error {
  /** The version in the file. */
  readonly found: number;

  constructor(found: number) {
    super(`The data is schema ${found}; this dashboard understands ${SCHEMA_VERSION}. Redeploy the dashboard.`);
    this.name = 'SchemaVersionError';
    this.found = found;
  }
}

/** The fetch signature the client needs. */
export type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/**
 * The production client: `baseUrl/index.json` and `baseUrl/days/<day>.json`, with the day files
 * cached in memory for the life of the page. A 404 for a day is not an error; the day has no file.
 */
export function createFetchStatsClient(baseUrl: string, fetchFn: FetchLike = (input, init) => fetch(input, init)): StatsClient {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cache = new Map<DayKey, Promise<DayLoad>>();

  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const url = `${base}${path}`;
    const response = await fetchFn(url, { signal });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new HttpStatusError(response.status, url);
    }
    const body = (await response.json()) as T & { schemaVersion?: number };
    if (typeof body.schemaVersion === 'number' && body.schemaVersion > SCHEMA_VERSION) {
      throw new SchemaVersionError(body.schemaVersion);
    }
    return body;
  }

  return {
    async loadIndex(signal) {
      const index = await getJson<StatsIndex>('index.json', signal);
      if (index === null) {
        throw new HttpStatusError(404, `${base}index.json`);
      }
      return index;
    },

    loadDays(days) {
      return Promise.all(
        days.map((day) => {
          const cached = cache.get(day);
          if (cached !== undefined) {
            return cached;
          }
          const pending = getJson<DayFile>(`days/${day}.json`).then(
            (file): DayLoad => ({ day, file }),
            (error: unknown) => {
              cache.delete(day); // a failed fetch is retried next time
              throw error;
            },
          );
          cache.set(day, pending);
          return pending;
        }),
      );
    },
  };
}
