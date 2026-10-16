import { HttpStatusError } from '../exceptions/http-status-error';
import type { ContactRequest } from '../requests/contact-request';
import { jsonResponse, TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { FetchContactClient } from './fetch-contact-client';

/** A request as the form builds it. */
function createRequest(): ContactRequest {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    topic: 'Job opportunity',
    reply: 'Email',
    phone: '',
    message: 'I would like to talk about a role.',
    website: '',
    elapsed: 12_000,
  };
}

describe('FetchContactClient', () => {
  describe('send', () => {
    it('should POST the request as JSON to the endpoint with the Accept header and a timeout signal', async () => {
      // Arrange
      const request = createRequest();
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 200 }));
      const client = new FetchContactClient(TEST_SITE_OPTIONS, fetch);

      // Act
      await client.send(request);

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('https://contact.example.test/');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init?.body as string)).toEqual(request);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should resolve on an empty success body', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }));
      const client = new FetchContactClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.send(createRequest())).resolves.toBeUndefined();
    });

    it('should reject with HttpStatusError carrying the status when the Lambda refuses the message', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse(429, { title: 'Too Many Requests' }));
      const client = new FetchContactClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const promise = client.send(createRequest());

      // Assert
      await expect(promise).rejects.toBeInstanceOf(HttpStatusError);
      await expect(promise).rejects.toMatchObject({
        status: 429,
        url: 'https://contact.example.test/',
      });
    });

    it('should propagate a rejected fetch, such as a timeout', async () => {
      // Arrange
      const timeout = new DOMException('The operation timed out.', 'TimeoutError');
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(timeout);
      const client = new FetchContactClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.send(createRequest())).rejects.toBe(timeout);
    });

    it('should use the global fetch when none is given', async () => {
      // Arrange
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 200 }));
      const client = new FetchContactClient(TEST_SITE_OPTIONS);

      // Act
      await client.send(createRequest());

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});
