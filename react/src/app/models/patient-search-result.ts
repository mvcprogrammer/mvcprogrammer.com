import type { PatientListItem } from './patient-list-item';
import type { SearchQuery } from './search-query';
import type { Trace } from './trace';

/** Envelope returned by GET /api/fhir/patients: one page of at most twenty matches. */
export interface PatientSearchResult {
  /** Number of items returned. */
  readonly count: number;

  /** Matches on the server, present only when the sandbox reported a total. */
  readonly total?: number;

  readonly query: SearchQuery;
  readonly items: readonly PatientListItem[];
  readonly trace: Trace;
}
