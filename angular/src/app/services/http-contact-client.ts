import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SITE_OPTIONS } from '../configurations/site-options';
import { ContactClient } from '../interfaces/contact-client';
import { ContactRequest } from '../requests/contact-request';

/** Posts contact messages to the Lambda function URL in SiteOptions.contactEndpoint. */
@Injectable()
export class HttpContactClient extends ContactClient {
  /** The Lambda sends mail through SES before answering, so this is longer than the API's timeout. */
  static readonly TIMEOUT_MS = 20_000;

  private readonly http = inject(HttpClient);
  private readonly options = inject(SITE_OPTIONS);

  /** @inheritdoc */
  override async send(request: ContactRequest): Promise<void> {
    await firstValueFrom(
      this.http.post(this.options.contactEndpoint, request, {
        headers: { Accept: 'application/json' },
        observe: 'response',
        timeout: HttpContactClient.TIMEOUT_MS,
      }),
    );
  }
}
