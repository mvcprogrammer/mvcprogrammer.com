import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { DemoSession } from '../interfaces/demo-session';
import { HttpFhirClient } from './http-fhir-client';
import { FakeDemoSession } from '../../testing/fake-demo-session';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { createCapabilitySubset, createConditionWriteResult, createPatientSearchResult, createPatientSummary, createPatientWriteResult } from '../../testing/test-data';

describe('HttpFhirClient', () => {
  let client: HttpFhirClient;
  let http: HttpTestingController;

  /** The writes hash their body before sending; this lets that settle so the request exists. */
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS }, { provide: DemoSession, useValue: new FakeDemoSession() }, HttpFhirClient],
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

  describe('createPatient', () => {
    it('should POST the input as JSON with the session and idempotency headers and map a 201', async () => {
      // Arrange
      const input = { familyName: 'Dickens', givenName: 'Charles' };
      const result = createPatientWriteResult(input);

      // Act
      const pending = client.createPatient(input, '0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d');
      await settle();
      const request = http.expectOne('api/fhir/patients');
      request.flush(result, { status: 201, statusText: 'Created', headers: { 'cache-control': 'no-store', location: '/api/fhir/patients/new-1/summary' } });

      // Assert
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('X-Demo-Session')).toBe(FakeDemoSession.TOKEN);
      expect(request.request.headers.get('Idempotency-Key')).toBe('0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d');
      expect(request.request.headers.get('Content-Type')).toBe('application/json');
      expect(request.request.headers.get('Accept')).toBe('application/json, application/problem+json');
      expect(request.request.body).toBe(JSON.stringify(input));
      // CloudFront's signed request to the function URL needs the body's hash.
      expect(request.request.headers.get('x-amz-content-sha256')).toBe('d3f29a4f103fb9d4762090810b208250c39680ae81ae54bee3d68c3410b14975');
      expect(request.request.timeout).toBe(HttpFhirClient.TIMEOUT_MS);
      const response = await pending;
      expect(response.status).toBe(201);
      expect(response.body).toEqual(result);
      expect(response.etag).toBeNull();
    });

    it('should map a 200 for a repeated key and a 400 validation problem with its field errors', async () => {
      // Act
      const repeated = client.createPatient({ familyName: 'Dickens' }, '0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d');
      await settle();
      http.expectOne('api/fhir/patients').flush(createPatientWriteResult({ familyName: 'Dickens' }), { status: 200, statusText: 'OK' });
      const rejected = client.createPatient({ familyName: '' }, '0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d');
      await settle();
      http.expectOne('api/fhir/patients').flush(
        { type: 'https://mvcprogrammer.com/api/problems/validation-failed', title: 'Validation failed', status: 400, detail: 'One or more fields are invalid.', errors: { familyName: ['required'] } },
        { status: 400, statusText: 'Bad Request' },
      );

      // Assert
      expect((await repeated).status).toBe(200);
      const error = await rejected.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FhirProblemError);
      expect((error as FhirProblemError).status).toBe(400);
      expect((error as FhirProblemError).errors).toEqual({ familyName: ['required'] });
    });
  });

  describe('addCondition', () => {
    it('should POST the code to the conditions path with the session header and the body hash, and map a 201', async () => {
      // Arrange
      const result = createConditionWriteResult('59621000', 'mine-1');

      // Act
      const pending = client.addCondition('mine-1', { code: '59621000' });
      await settle();
      const request = http.expectOne('api/fhir/patients/mine-1/conditions');
      request.flush(result, { status: 201, statusText: 'Created', headers: { 'cache-control': 'no-store', location: '/api/fhir/patients/mine-1/summary' } });

      // Assert
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('X-Demo-Session')).toBe(FakeDemoSession.TOKEN);
      expect(request.request.headers.has('Idempotency-Key')).toBe(false);
      expect(request.request.headers.get('Content-Type')).toBe('application/json');
      expect(request.request.body).toBe('{"code":"59621000"}');
      expect(request.request.headers.get('x-amz-content-sha256')).toBe(await HttpFhirClient.sha256('{"code":"59621000"}'));
      const response = await pending;
      expect(response.status).toBe(201);
      expect(response.body).toEqual(result);
    });

    it('should escape the patient id, map a 200 for a repeat, and reject a 422 with the problem the function sent', async () => {
      // Act
      const repeated = client.addCondition('a/b', { code: '59621000' });
      await settle();
      http.expectOne('api/fhir/patients/a%2Fb/conditions').flush(createConditionWriteResult('59621000', 'a/b'), { status: 200, statusText: 'OK' });
      const rejected = client.addCondition('mine-1', { code: '123456' });
      await settle();
      http.expectOne('api/fhir/patients/mine-1/conditions').flush(
        { type: 'https://mvcprogrammer.com/api/problems/condition-rejected', title: 'Condition rejected', status: 422, detail: "Code '123456' is not on the pick list; send one of the 10 SNOMED CT codes the operation documents." },
        { status: 422, statusText: 'Unprocessable Content' },
      );

      // Assert
      expect((await repeated).status).toBe(200);
      const error = await rejected.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FhirProblemError);
      expect((error as FhirProblemError).status).toBe(422);
      expect((error as FhirProblemError).title).toBe('Condition rejected');
      expect((error as FhirProblemError).message).toBe("Code '123456' is not on the pick list; send one of the 10 SNOMED CT codes the operation documents.");
    });
  });

  describe('replacePatient, patchPatient, deletePatient', () => {
    it('should PUT the input to the patient path with the session header', async () => {
      // Act
      const pending = client.replacePatient('new 1', { familyName: 'Dickens' });
      await settle();
      const request = http.expectOne('api/fhir/patients/new%201');
      request.flush(createPatientWriteResult({ familyName: 'Dickens' }, 'new 1'));

      // Assert
      expect(request.request.method).toBe('PUT');
      expect(request.request.headers.get('X-Demo-Session')).toBe(FakeDemoSession.TOKEN);
      expect(request.request.headers.has('Idempotency-Key')).toBe(false);
      expect(request.request.headers.get('Content-Type')).toBe('application/json');
      expect((await pending).body.patient.id).toBe('new 1');
    });

    it('should PATCH the operations as application/json-patch+json', async () => {
      // Arrange
      const operations = [{ op: 'test' as const, path: '/givenName' as const, value: 'Charles' }, { op: 'replace' as const, path: '/givenName' as const, value: 'Chuck' }];

      // Act
      const pending = client.patchPatient('new-1', operations);
      await settle();
      const request = http.expectOne('api/fhir/patients/new-1');
      request.flush(createPatientWriteResult({ familyName: 'Dickens', givenName: 'Chuck' }));

      // Assert
      expect(request.request.method).toBe('PATCH');
      expect(request.request.headers.get('Content-Type')).toBe('application/json-patch+json');
      expect(request.request.body).toBe(JSON.stringify(operations));
      expect(request.request.headers.get('x-amz-content-sha256')).toBe(await HttpFhirClient.sha256(JSON.stringify(operations)));
      expect((await pending).body.patient.givenName).toBe('Chuck');
    });

    it('should DELETE without a body and resolve a 204 with a null body', async () => {
      // Act
      const pending = client.deletePatient('new-1');
      await settle();
      const request = http.expectOne('api/fhir/patients/new-1');
      request.flush(null, { status: 204, statusText: 'No Content' });

      // Assert
      expect(request.request.method).toBe('DELETE');
      expect(request.request.body).toBeNull();
      expect(request.request.headers.has('Content-Type')).toBe(false);
      expect(request.request.headers.has('x-amz-content-sha256')).toBe(false);
      const response = await pending;
      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
    });

    it('should reject a write with the problem the function sent', async () => {
      // Act
      const pending = client.deletePatient('mvc-programmer');
      await settle();
      http.expectOne('api/fhir/patients/mvc-programmer').flush(
        { type: 'https://mvcprogrammer.com/api/problems/read-only', title: 'Demo patient is read-only', status: 403, detail: 'Read-only.' },
        { status: 403, statusText: 'Forbidden' },
      );

      // Assert
      const error = (await pending.catch((e: unknown) => e)) as FhirProblemError;
      expect(error.status).toBe(403);
      expect(error.message).toBe('Read-only.');
      expect(error.errors).toEqual({});
    });
  });
});
