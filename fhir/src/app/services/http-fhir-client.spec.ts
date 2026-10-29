import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { HttpFhirClient } from './http-fhir-client';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { createCapabilitySubset, createPatientSearchResult, createPatientSummary } from '../../testing/test-data';

describe('HttpFhirClient', () => {
  let client: HttpFhirClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS }, HttpFhirClient],
    });
    client = TestBed.inject(HttpFhirClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('searchPatients', () => {
    it('should request the family alone with a timeout, the JSON accept header, and deserialize the body with the response facts', async () => {
      // Arrange
      const result = createPatientSearchResult();

      // Act
      const pending = client.searchPatients({ family: 'Programmer', birthdate: '', identifier: '' });
      const request = http.expectOne('api/fhir/patients?family=Programmer');
      request.flush(result, { headers: { 'x-cache': 'Hit from cloudfront', etag: '"v1"', 'content-type': 'application/json' } });

      // Assert
      expect(request.request.method).toBe('GET');
      expect(request.request.timeout).toBe(HttpFhirClient.TIMEOUT_MS);
      expect(request.request.headers.get('Accept')).toBe('application/json, application/problem+json');
      const response = await pending;
      expect(response.body).toEqual(result);
      expect(response.status).toBe(200);
      expect(response.xCache).toBe('Hit from cloudfront');
      expect(response.etag).toBe('"v1"');
      expect(response.contentType).toBe('application/json');
      expect(response.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should escape every filled parameter in the query string', async () => {
      // Act
      const pending = client.searchPatients({ family: 'O Brien', birthdate: '1979-04-12', identifier: 'urn:mrn|12 345' });
      http.expectOne('api/fhir/patients?family=O%20Brien&birthdate=1979-04-12&identifier=urn%3Amrn%7C12%20345').flush(createPatientSearchResult());

      // Assert
      await expect(pending).resolves.toBeTruthy();
    });

    it('should reject with a FhirProblemError carrying the problem detail on an error status', async () => {
      // Act
      const pending = client.searchPatients({ family: 'Programmer', birthdate: '', identifier: '' });
      http.expectOne('api/fhir/patients?family=Programmer').flush(
        { title: 'Bad Gateway', status: 502, detail: 'The sandbox answered 500.' },
        { status: 502, statusText: 'Bad Gateway', headers: { 'x-cache': 'Error from cloudfront' } },
      );

      // Assert
      const error = await pending.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FhirProblemError);
      const problem = error as FhirProblemError;
      expect(problem.status).toBe(502);
      expect(problem.title).toBe('Bad Gateway');
      expect(problem.message).toBe('The sandbox answered 500.');
      expect(problem.xCache).toBe('Error from cloudfront');
      expect(problem.upstreamFailed).toBe(true);
    });

    it('should reject with the rate-limit message on 429 without a detail', async () => {
      // Act
      const pending = client.searchPatients({ family: 'Programmer', birthdate: '', identifier: '' });
      http.expectOne('api/fhir/patients?family=Programmer').flush({ title: 'Too Many Requests', status: 429 }, { status: 429, statusText: 'Too Many Requests' });

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 429, message: FhirProblemError.RATE_LIMIT_MESSAGE });
    });

    it('should reject with the not-JSON message for a null body', async () => {
      // Act
      const pending = client.searchPatients({ family: 'Programmer', birthdate: '', identifier: '' });
      http.expectOne('api/fhir/patients?family=Programmer').flush(null);

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 204, message: FhirProblemError.NOT_JSON_MESSAGE });
    });

    it('should reject with the network message when the request never completes', async () => {
      // Act
      const pending = client.searchPatients({ family: 'Programmer', birthdate: '', identifier: '' });
      http.expectOne('api/fhir/patients?family=Programmer').error(new ProgressEvent('error'));

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 0, timedOut: false, message: FhirProblemError.NETWORK_MESSAGE });
    });
  });

  describe('getSummary', () => {
    it('should request the escaped patient id and deserialize the summary', async () => {
      // Arrange
      const summary = createPatientSummary();

      // Act
      const pending = client.getSummary('a/b');
      const request = http.expectOne('api/fhir/patients/a%2Fb/summary');
      request.flush(summary);

      // Assert
      expect(request.request.timeout).toBe(HttpFhirClient.TIMEOUT_MS);
      await expect(pending).resolves.toMatchObject({ body: summary, status: 200 });
    });

    it('should reject with a 404 problem for an unknown patient', async () => {
      // Act
      const pending = client.getSummary('missing');
      http.expectOne('api/fhir/patients/missing/summary').flush({ title: 'Not Found', status: 404 }, { status: 404, statusText: 'Not Found' });

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 404, title: 'Not Found', message: 'The request failed (404).' });
    });
  });

  describe('getRawBundle', () => {
    it('should request the bundle as text with the FHIR accept header', async () => {
      // Act
      const pending = client.getRawBundle('78785');
      const request = http.expectOne('api/fhir/patients/78785/raw');
      request.flush('{\n  "resourceType": "Bundle"\n}', { headers: { 'content-type': 'application/fhir+json; charset=utf-8' } });

      // Assert
      expect(request.request.responseType).toBe('text');
      expect(request.request.headers.get('Accept')).toBe('application/fhir+json, application/problem+json');
      const response = await pending;
      expect(response.body).toBe('{\n  "resourceType": "Bundle"\n}');
      expect(response.contentType).toBe('application/fhir+json; charset=utf-8');
    });

    it('should reject with a FhirProblemError on an error status', async () => {
      // Act
      const pending = client.getRawBundle('78785');
      http.expectOne('api/fhir/patients/78785/raw').flush('upstream timeout', { status: 504, statusText: 'Gateway Timeout' });

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 504, message: FhirProblemError.UPSTREAM_MESSAGE });
    });
  });

  describe('getCapability', () => {
    it('should request the capability subset and deserialize it', async () => {
      // Arrange
      const capability = createCapabilitySubset();

      // Act
      const pending = client.getCapability();
      http.expectOne('api/fhir/capability').flush(capability);

      // Assert
      await expect(pending).resolves.toMatchObject({ body: capability });
    });
  });
});
