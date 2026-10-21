/** RFC 9457 problem details as the FHIR function sends them. */
export interface ProblemDetails {
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
}

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

  /** HTTP status, 0 when no response arrived. */
  readonly status: number;

  /** The problem's title, when the function sent one. */
  readonly title: string | null;

  /** Round trip until the failure. */
  readonly durationMs: number;

  /** CloudFront's X-Cache header, when present. */
  readonly xCache: string | null;

  /** True when the browser aborted the request. */
  readonly timedOut: boolean;

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
    status: number,
    title: string | null,
    durationMs: number,
    xCache: string | null,
    timedOut: boolean,
  ) {
    super(message);
    this.name = 'FhirProblemError';
    this.status = status;
    this.title = title;
    this.durationMs = durationMs;
    this.xCache = xCache;
    this.timedOut = timedOut;
  }

  /** True for 502 and 504, when the sandbox rather than the function failed. */
  get upstreamFailed(): boolean {
    return this.status === 502 || this.status === 504;
  }

  /**
   * The error for a response outside 2xx, from its problem body when the function sent one.
   * @param status The response status.
   * @param problem The parsed problem details, or null when the body was not one.
   * @param durationMs Round trip until the failure.
   * @param xCache CloudFront's X-Cache header, when present.
   */
  static fromResponse(
    status: number,
    problem: ProblemDetails | null,
    durationMs: number,
    xCache: string | null,
  ): FhirProblemError {
    const title = typeof problem?.title === 'string' ? problem.title : null;
    const detail = typeof problem?.detail === 'string' ? problem.detail : null;
    return new FhirProblemError(
      detail ?? FhirProblemError.messageFor(status),
      status,
      title,
      durationMs,
      xCache,
      false,
    );
  }

  /**
   * The error for a fetch that rejected: a timeout or a network failure.
   * @param error Whatever fetch rejected with.
   * @param durationMs Round trip until the failure.
   */
  static fromRejection(error: unknown, durationMs: number): FhirProblemError {
    if (error instanceof FhirProblemError) {
      return error;
    }

    const timedOut =
      error !== null &&
      typeof error === 'object' &&
      (error as { name?: unknown }).name === 'TimeoutError';
    return new FhirProblemError(
      timedOut ? FhirProblemError.TIMEOUT_MESSAGE : FhirProblemError.NETWORK_MESSAGE,
      0,
      null,
      durationMs,
      null,
      timedOut,
    );
  }

  /**
   * The error for a success status whose body was not JSON.
   * @param status The response status.
   * @param durationMs Round trip so far.
   * @param xCache CloudFront's X-Cache header, when present.
   */
  static notJson(status: number, durationMs: number, xCache: string | null): FhirProblemError {
    return new FhirProblemError(
      FhirProblemError.NOT_JSON_MESSAGE,
      status,
      null,
      durationMs,
      xCache,
      false,
    );
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
