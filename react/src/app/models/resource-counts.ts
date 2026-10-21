/** Exact counts from `_summary=count` searches, independent of the page caps. */
export interface ResourceCounts {
  readonly conditions: number;
  readonly encounters: number;
  readonly observations: number;
}
