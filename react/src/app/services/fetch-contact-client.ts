import type { SiteOptions } from '../configurations/site-options';
import { HttpStatusError } from '../exceptions/http-status-error';
import type { ContactClient } from '../interfaces/contact-client';
import type { ContactRequest } from '../requests/contact-request';

/** Posts contact messages to the Lambda function URL in SiteOptions.contactEndpoint. */
export class FetchContactClient implements ContactClient {
  /** The Lambda sends mail through SES before answering, so this is longer than the API's timeout. */
  static readonly TIMEOUT_MS = 20_000;

  private readonly options: SiteOptions;
  private readonly fetch: typeof globalThis.fetch;

  /**
   * @param options The site endpoints; contactEndpoint is used.
   * @param fetch The fetch function, the global one unless a test supplies another.
   */
  constructor(
    options: SiteOptions,
    fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args),
  ) {
    this.options = options;
    this.fetch = fetch;
  }

  /** @inheritdoc */
  async send(request: ContactRequest): Promise<void> {
    const response = await this.fetch(this.options.contactEndpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(FetchContactClient.TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new HttpStatusError(response.status, this.options.contactEndpoint);
    }
  }
}
