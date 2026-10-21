/** One request the FHIR function made to the sandbox, with its paging walk folded in. */
export interface UpstreamRequest {
  readonly method: string;

  /** The first page's URL; later pages come from `link[rel=next]`. */
  readonly url: string;

  /** HTTP status of the last page fetched. */
  readonly status: number;

  /** Wall time across every attempt and page. */
  readonly durationMs: number;

  /** Bundle entries received across all pages, or the total for a count search. */
  readonly entries: number;

  /** Pages walked, including the first. */
  readonly pages: number;
}
