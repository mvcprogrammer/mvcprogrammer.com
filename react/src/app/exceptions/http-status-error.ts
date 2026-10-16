/** A response the server answered with a status outside 2xx. Carries the status so callers need not parse the message. */
export class HttpStatusError extends Error {
  /** The HTTP status code of the response. */
  readonly status: number;

  /** The request URL, for diagnostics. */
  readonly url: string;

  /**
   * @param status The HTTP status code of the response.
   * @param url The request URL.
   */
  constructor(status: number, url: string) {
    super(`The request to ${url} failed with status ${status}.`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
  }
}
