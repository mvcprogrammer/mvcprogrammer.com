import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { createCapabilitySubset, createPatientSearchResult, createPatientSummary } from '../../testing/test-data';
import { jsonResponse, TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { FetchFhirClient } from './fetch-fhir-client';

/** A Response with the headers the explorer's log reads. */
function fhirResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('FetchFhirClient', () => {
  describe('searchPatients', () => {
    it('should GET the family alone with the JSON accept header and a timeout, and report the response facts', async () => {
      // Arrange
      const result = createPatientSearchResult();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        fhirResponse(200, result, { 'x-cache': 'Hit from cloudfront', etag: '"v1"' }),
      );
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const response = await client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' });

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('api/fhir/patients?family=Watsica');
      expect(init?.headers).toEqual({ Accept: 'application/json, application/problem+json' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(response.body).toEqual(result);
      expect(response.status).toBe(200);
      expect(response.xCache).toBe('Hit from cloudfront');
      expect(response.etag).toBe('"v1"');
      expect(response.contentType).toBe('application/json');
      expect(response.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should escape every filled parameter in the query string', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(200, createPatientSearchResult()));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      await client.searchPatients({ family: 'O Brien', birthdate: '1979-04-12', identifier: 'urn:mrn|12 345' });

      // Assert
      expect(fetch.mock.calls[0]![0]).toBe('api/fhir/patients?family=O%20Brien&birthdate=1979-04-12&identifier=urn%3Amrn%7C12%20345');
    });

    it('should reject with a FhirProblemError carrying the problem detail on an error status', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        fhirResponse(502, { title: 'Bad Gateway', status: 502, detail: 'The sandbox answered 500.' }, { 'x-cache': 'Error from cloudfront' }),
      );
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const error = await client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' }).catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(FhirProblemError);
      const problem = error as FhirProblemError;
      expect(problem.status).toBe(502);
      expect(problem.title).toBe('Bad Gateway');
      expect(problem.message).toBe('The sandbox answered 500.');
      expect(problem.xCache).toBe('Error from cloudfront');
      expect(problem.upstreamFailed).toBe(true);
    });

    it('should reject with the rate-limit message on 429 without a detail', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(429, { title: 'Too Many Requests', status: 429 }));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 429,
        message: FhirProblemError.RATE_LIMIT_MESSAGE,
      });
    });

    it('should reject with the status message when the error body is not JSON', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(504, null, { invalidJson: true }));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 504,
        title: null,
        message: FhirProblemError.UPSTREAM_MESSAGE,
      });
    });

    it('should reject with the not-JSON message when a success body is not JSON, as a host serving HTML does', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, null, { invalidJson: true }));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 200,
        message: FhirProblemError.NOT_JSON_MESSAGE,
      });
    });

    it('should reject with the not-JSON message for a null body', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(200, null));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 200,
        message: FhirProblemError.NOT_JSON_MESSAGE,
      });
    });

    it('should map a timeout rejection to the timeout message', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 0,
        timedOut: true,
        message: FhirProblemError.TIMEOUT_MESSAGE,
      });
    });

    it('should map any other rejection to the network message', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.searchPatients({ family: 'Watsica', birthdate: '', identifier: '' })).rejects.toMatchObject({
        status: 0,
        timedOut: false,
        message: FhirProblemError.NETWORK_MESSAGE,
      });
    });
  });

  describe('getSummary', () => {
    it('should GET the escaped patient id and return the summary', async () => {
      // Arrange
      const summary = createPatientSummary();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(200, summary));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const response = await client.getSummary('a/b');

      // Assert
      expect(fetch.mock.calls[0]![0]).toBe('api/fhir/patients/a%2Fb/summary');
      expect(response.body).toEqual(summary);
    });

    it('should reject with a 404 problem for an unknown patient', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(404, { title: 'Not Found', status: 404 }));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.getSummary('missing')).rejects.toMatchObject({ status: 404, title: 'Not Found', message: 'The request failed (404).' });
    });
  });

  describe('getRawBundle', () => {
    it('should GET the bundle as text with the FHIR accept header', async () => {
      // Arrange
      const text = '{\n  "resourceType": "Bundle"\n}';
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(text, { status: 200, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8' } }),
      );
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const response = await client.getRawBundle('78785');

      // Assert
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('api/fhir/patients/78785/raw');
      expect(init?.headers).toEqual({ Accept: 'application/fhir+json, application/problem+json' });
      expect(response.body).toBe(text);
      expect(response.contentType).toBe('application/fhir+json; charset=utf-8');
    });

    it('should reject with a FhirProblemError on an error status', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('upstream timeout', { status: 504 }));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.getRawBundle('78785')).rejects.toMatchObject({ status: 504, message: FhirProblemError.UPSTREAM_MESSAGE });
    });
  });

  describe('getCapability', () => {
    it('should GET the capability subset and return it', async () => {
      // Arrange
      const capability = createCapabilitySubset();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fhirResponse(200, capability));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const response = await client.getCapability();

      // Assert
      expect(fetch.mock.calls[0]![0]).toBe('api/fhir/capability');
      expect(response.body).toEqual(capability);
    });
  });

  describe('constructor', () => {
    it('should use the global fetch when none is given', async () => {
      // Arrange
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fhirResponse(200, createCapabilitySubset()));
      const client = new FetchFhirClient(TEST_SITE_OPTIONS);

      // Act
      await client.getCapability();

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});
