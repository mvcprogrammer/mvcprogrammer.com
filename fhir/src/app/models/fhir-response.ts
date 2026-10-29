/** A FHIR API answer with the response facts the "under the hood" log reports. */
export interface FhirResponse<T> {
  readonly body: T;
  readonly status: number;

  /** Round trip as the browser saw it. */
  readonly durationMs: number;

  /** CloudFront's X-Cache header, or null when no edge answered. */
  readonly xCache: string | null;

  readonly etag: string | null;
  readonly contentType: string | null;
}
