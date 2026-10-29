import { DataSource } from './data-source';
import { UpstreamRequest } from './upstream-request';

/** What happened upstream, for the "under the hood" panel. A cached response carries the original request's trace. */
export interface Trace {
  readonly dataSource: DataSource;
  readonly requests: readonly UpstreamRequest[];
  readonly totalDurationMs: number;

  /** Entries received across every request. */
  readonly bundleEntries: number;
  readonly pagesWalked: number;

  /** Maximum pages followed per search. */
  readonly pageCap: number;

  /** True when any search hit the page cap, so a list may be incomplete. */
  readonly truncated: boolean;

  /** ISO 8601 date-time the trace was recorded. */
  readonly generatedAt: string;
}
