import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { ContactRequest } from '../requests/contact-request';
import { HttpContactClient } from './http-contact-client';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';

describe('HttpContactClient', () => {
  let client: HttpContactClient;
  let http: HttpTestingController;

  const request: ContactRequest = {
    name: 'Neal Thomas',
    email: 'neal@example.test',
    topic: 'Job opportunity',
    reply: 'Email',
    phone: '',
    message: 'Hello, I have a role for you.',
    website: '',
    elapsed: 1234,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS }, HttpContactClient],
    });
    client = TestBed.inject(HttpContactClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('send', () => {
    it('should post the request as JSON to the configured endpoint', async () => {
      // Act
      const pending = client.send(request);
      const sent = http.expectOne(TEST_SITE_OPTIONS.contactEndpoint);
      sent.flush({ ok: true });

      // Assert
      expect(sent.request.method).toBe('POST');
      expect(sent.request.body).toEqual(request);
      expect(sent.request.headers.get('Accept')).toBe('application/json');
      expect(sent.request.timeout).toBe(HttpContactClient.TIMEOUT_MS);
      await expect(pending).resolves.toBeUndefined();
    });

    it('should resolve on an empty success body', async () => {
      // Act
      const pending = client.send(request);
      http.expectOne(TEST_SITE_OPTIONS.contactEndpoint).flush(null, { status: 204, statusText: 'No Content' });

      // Assert
      await expect(pending).resolves.toBeUndefined();
    });

    it('should reject with the status code when the Lambda refuses the message', async () => {
      // Act
      const pending = client.send(request);
      http.expectOne(TEST_SITE_OPTIONS.contactEndpoint).flush({ error: 'rate' }, { status: 429, statusText: 'Too Many Requests' });

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 429 });
    });
  });
});
