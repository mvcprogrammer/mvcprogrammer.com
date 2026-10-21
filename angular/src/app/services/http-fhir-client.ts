import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SITE_OPTIONS } from '../configurations/site-options';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { FhirClient } from '../interfaces/fhir-client';
import { CapabilitySubset } from '../models/capability-subset';
import { FhirResponse } from '../models/fhir-response';
import { PatientSearchResult } from '../models/patient-search-result';
import { PatientSummary } from '../models/patient-summary';
import { PatientSearchRequest } from '../requests/patient-search-request';

/** FHIR API client over HttpClient. Paths are relative, so CloudFront routes /api/fhir on this origin to the Lambda. */
@Injectable()
export class HttpFhirClient extends FhirClient {
  /** The function's own budget is 22 s under CloudFront's 30 s; the browser waits a little past that. */
  static readonly TIMEOUT_MS = 32_000;

  private static readonly JSON_ACCEPT = 'application/json, application/problem+json';
  private static readonly FHIR_ACCEPT = 'application/fhir+json, application/problem+json';

  private readonly http = inject(HttpClient);
  private readonly options = inject(SITE_OPTIONS);

  /** @inheritdoc */
  override searchPatients(request: PatientSearchRequest): Promise<FhirResponse<PatientSearchResult>> {
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
  override getSummary(patientId: string): Promise<FhirResponse<PatientSummary>> {
    return this.getJson<PatientSummary>(`${this.options.fhirApiBase}/patients/${encodeURIComponent(patientId)}/summary`);
  }

  /** @inheritdoc */
  override async getRawBundle(patientId: string): Promise<FhirResponse<string>> {
    const path = `${this.options.fhirApiBase}/patients/${encodeURIComponent(patientId)}/raw`;
    const started = performance.now();
    try {
      const response = await firstValueFrom(
        this.http.get(path, {
          observe: 'response',
          responseType: 'text',
          headers: { Accept: HttpFhirClient.FHIR_ACCEPT },
          timeout: HttpFhirClient.TIMEOUT_MS,
        }),
      );
      return HttpFhirClient.toFhirResponse(response, response.body ?? '', started);
    } catch (error: unknown) {
      throw FhirProblemError.from(error, HttpFhirClient.elapsed(started));
    }
  }

  /** @inheritdoc */
  override getCapability(): Promise<FhirResponse<CapabilitySubset>> {
    return this.getJson<CapabilitySubset>(`${this.options.fhirApiBase}/capability`);
  }

  private async getJson<T>(path: string): Promise<FhirResponse<T>> {
    const started = performance.now();
    try {
      const response = await firstValueFrom(
        this.http.get<T>(path, {
          observe: 'response',
          headers: { Accept: HttpFhirClient.JSON_ACCEPT },
          timeout: HttpFhirClient.TIMEOUT_MS,
        }),
      );
      if (response.body === null) {
        throw new FhirProblemError(FhirProblemError.NOT_JSON_MESSAGE, response.status, null, HttpFhirClient.elapsed(started), response.headers.get('x-cache'), false);
      }

      return HttpFhirClient.toFhirResponse(response, response.body, started);
    } catch (error: unknown) {
      if (error instanceof FhirProblemError) {
        throw error;
      }

      throw FhirProblemError.from(error, HttpFhirClient.elapsed(started));
    }
  }

  private static toFhirResponse<T>(response: HttpResponse<unknown>, body: T, started: number): FhirResponse<T> {
    return {
      body,
      status: response.status,
      durationMs: HttpFhirClient.elapsed(started),
      xCache: response.headers.get('x-cache'),
      etag: response.headers.get('etag'),
      contentType: response.headers.get('content-type'),
    };
  }

  private static elapsed(started: number): number {
    return Math.round(performance.now() - started);
  }
}
