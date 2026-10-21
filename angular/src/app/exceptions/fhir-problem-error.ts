import { HttpErrorResponse } from '@angular/common/http';

/** A FHIR API request that failed: a problem-details answer, a non-JSON body, a timeout, or no connection. */
export class FhirProblemError extends Error {
  /** Shown when the function answers 429. */
  static readonly RATE_LIMIT_MESSAGE = 'That is a lot of requests in a row; wait a moment and try again.';

  /** Shown when the function answers 502 or 504, the sandbox being slow or down. */
  static readonly UPSTREAM_MESSAGE = 'The sandbox is slow or down right now. Try again in a moment.';

  /** Shown when the browser gave up waiting. */
  static readonly TIMEOUT_MESSAGE = 'The request timed out. Try again in a moment.';

  /** Shown when the request never reached the function. */
  static readonly NETWORK_MESSAGE = 'Could not reach the API. Check the connection and try again.';

  /** Shown when a success status carried something that is not JSON, as a host serving HTML does. */
  static readonly NOT_JSON_MESSAGE = 'The function answered with something that is not JSON.';

  /**
   * @param message What to tell the visitor.
   * @param status HTTP status, 0 when no response arrived.
   * @param title The problem's title, when the function sent one.
   * @param durationMs Round trip until the failure.
   * @param xCache CloudFront's X-Cache header, when present.
   * @param timedOut True when the browser aborted the request.
   */
  constructor(
    message: string,
    readonly status: number,
    readonly title: string | null,
    readonly durationMs: number,
    readonly xCache: string | null,
    readonly timedOut: boolean,
  ) {
    super(message);
    this.name = 'FhirProblemError';
  }

  /** True for 502 and 504, when the sandbox rather than the function failed. */
  get upstreamFailed(): boolean {
    return this.status === 502 || this.status === 504;
  }

  /**
   * Maps whatever HttpClient rejected with to a typed error with a visitor-facing message.
   * @param error The rejection, normally an HttpErrorResponse.
   * @param durationMs Round trip until the failure.
   */
  static from(error: unknown, durationMs: number): FhirProblemError {
    if (!(error instanceof HttpErrorResponse)) {
      return new FhirProblemError(FhirProblemError.NETWORK_MESSAGE, 0, null, durationMs, null, false);
    }

    const xCache = error.headers.get('x-cache');
    const cause = error.error as { name?: unknown; title?: unknown; detail?: unknown } | null;
    if (error.status === 0) {
      // The fetch backend aborts a slow request with a DOMException named TimeoutError.
      const timedOut = cause !== null && typeof cause === 'object' && cause.name === 'TimeoutError';
      return new FhirProblemError(timedOut ? FhirProblemError.TIMEOUT_MESSAGE : FhirProblemError.NETWORK_MESSAGE, 0, null, durationMs, xCache, timedOut);
    }

    if (error.status >= 200 && error.status < 300) {
      return new FhirProblemError(FhirProblemError.NOT_JSON_MESSAGE, error.status, null, durationMs, xCache, false);
    }

    const title = cause !== null && typeof cause === 'object' && typeof cause.title === 'string' ? cause.title : null;
    const detail = cause !== null && typeof cause === 'object' && typeof cause.detail === 'string' ? cause.detail : null;
    return new FhirProblemError(detail ?? FhirProblemError.messageFor(error.status), error.status, title, durationMs, xCache, false);
  }

  private static messageFor(status: number): string {
    if (status === 429) {
      return FhirProblemError.RATE_LIMIT_MESSAGE;
    }

    if (status === 502 || status === 504) {
      return FhirProblemError.UPSTREAM_MESSAGE;
    }

    return `The request failed (${status}).`;
  }
}
