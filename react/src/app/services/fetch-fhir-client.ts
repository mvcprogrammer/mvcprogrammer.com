import type { SiteOptions } from '../configurations/site-options';
import { FhirProblemError, type ProblemDetails } from '../exceptions/fhir-problem-error';
import type { FhirClient } from '../interfaces/fhir-client';
import type { CapabilitySubset } from '../models/capability-subset';
import type { FhirResponse } from '../models/fhir-response';
import type { PatientSearchResult } from '../models/patient-search-result';
import type { PatientSummary } from '../models/patient-summary';
import type { PatientSearchRequest } from '../requests/patient-search-request';

/** FHIR API client over fetch. Paths are relative, so CloudFront routes /api/fhir on this origin to the Lambda. */
export class FetchFhirClient implements FhirClient {
  /** The function's own budget is 22 s under CloudFront's 30 s; the browser waits a little past that. */
  static readonly TIMEOUT_MS = 32_000;

  private static readonly JSON_ACCEPT = 'application/json, application/problem+json';
  private static readonly FHIR_ACCEPT = 'application/fhir+json, application/problem+json';

  private readonly options: SiteOptions;
  private readonly fetch: typeof globalThis.fetch;

  /**
   * @param options The site endpoints; fhirApiBase is used.
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
  searchPatients(request: PatientSearchRequest): Promise<FhirResponse<PatientSearchResult>> {
    let path = `${this.options.fhirApiBase}/patients?family=${encodeURIComponent(request.family)}`;
    if (request.birthdate !== '') {
      path += `&birthdate=${encodeURIComponent(request.birthdate)}`;
    }

    if (request.identifier !== '') {
      path += `&identifier=${encodeURIComponent(request.identifier)}`;
    }

    return this.getJson<PatientSearchResult>(path);
  }

  /** @inheritdoc */
  getSummary(patientId: string): Promise<FhirResponse<PatientSummary>> {
    return this.getJson<PatientSummary>(
      `${this.options.fhirApiBase}/patients/${encodeURIComponent(patientId)}/summary`,
    );
  }

  /** @inheritdoc */
  async getRawBundle(patientId: string): Promise<FhirResponse<string>> {
    const path = `${this.options.fhirApiBase}/patients/${encodeURIComponent(patientId)}/raw`;
    const started = performance.now();
    const response = await this.get(path, FetchFhirClient.FHIR_ACCEPT, started);
    const text = await response.text();
    return FetchFhirClient.toFhirResponse(response, text, started);
  }

  /** @inheritdoc */
  getCapability(): Promise<FhirResponse<CapabilitySubset>> {
    return this.getJson<CapabilitySubset>(`${this.options.fhirApiBase}/capability`);
  }

  private async getJson<T>(path: string): Promise<FhirResponse<T>> {
    const started = performance.now();
    const response = await this.get(path, FetchFhirClient.JSON_ACCEPT, started);
    let body: T | null;
    try {
      body = (await response.json()) as T | null;
    } catch {
      throw FhirProblemError.notJson(
        response.status,
        FetchFhirClient.elapsed(started),
        response.headers.get('x-cache'),
      );
    }

    if (body === null) {
      throw FhirProblemError.notJson(
        response.status,
        FetchFhirClient.elapsed(started),
        response.headers.get('x-cache'),
      );
    }

    return FetchFhirClient.toFhirResponse(response, body, started);
  }

  /** GET with the timeout; a status outside 2xx becomes a FhirProblemError from the problem body, a rejection a network or timeout error. */
  private async get(path: string, accept: string, started: number): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetch(path, {
        headers: { Accept: accept },
        signal: AbortSignal.timeout(FetchFhirClient.TIMEOUT_MS),
      });
    } catch (error: unknown) {
      throw FhirProblemError.fromRejection(error, FetchFhirClient.elapsed(started));
    }

    if (!response.ok) {
      let problem: ProblemDetails | null = null;
      try {
        const parsed: unknown = await response.json();
        problem = parsed !== null && typeof parsed === 'object' ? (parsed as ProblemDetails) : null;
      } catch {
        problem = null;
      }

      throw FhirProblemError.fromResponse(
        response.status,
        problem,
        FetchFhirClient.elapsed(started),
        response.headers.get('x-cache'),
      );
    }

    return response;
  }

  private static toFhirResponse<T>(response: Response, body: T, started: number): FhirResponse<T> {
    return {
      body,
      status: response.status,
      durationMs: FetchFhirClient.elapsed(started),
      xCache: response.headers.get('x-cache'),
      etag: response.headers.get('etag'),
      contentType: response.headers.get('content-type'),
    };
  }

  private static elapsed(started: number): number {
    return Math.round(performance.now() - started);
  }
}
