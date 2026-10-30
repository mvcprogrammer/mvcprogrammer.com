import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SITE_OPTIONS } from '../configurations/site-options';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { DemoSession } from '../interfaces/demo-session';
import { FhirClient } from '../interfaces/fhir-client';
import { CapabilitySubset } from '../models/capability-subset';
import { ConditionWriteResult } from '../models/condition-write-result';
import { FhirResponse } from '../models/fhir-response';
import { PatientSearchResult } from '../models/patient-search-result';
import { PatientSummary } from '../models/patient-summary';
import { PatientWriteResult } from '../models/patient-write-result';
import { ConditionInput } from '../requests/condition-input';
import { PatientInput } from '../requests/patient-input';
import { PatientPatchOperation } from '../requests/patient-patch-operation';
import { PatientSearchRequest } from '../requests/patient-search-request';

/** FHIR API client over HttpClient. Paths are relative, so CloudFront routes /api/fhir on this origin to the Lambda. Writes carry the demo session's token. */
@Injectable()
export class HttpFhirClient extends FhirClient {
  /** The function's own budget is 22 s under CloudFront's 30 s; the browser waits a little past that. */
  static readonly TIMEOUT_MS = 32_000;

  private static readonly JSON_ACCEPT = 'application/json, application/problem+json';
  private static readonly FHIR_ACCEPT = 'application/fhir+json, application/problem+json';

  /** The header every write carries. */
  static readonly SESSION_HEADER = 'X-Demo-Session';

  /** The header a create is made idempotent on. */
  static readonly IDEMPOTENCY_HEADER = 'Idempotency-Key';

  private static readonly JSON_PATCH = 'application/json-patch+json';

  /**
   * CloudFront reaches the function URL through Origin Access Control and signs each request; for a
   * request with a body, Lambda requires the body's SHA-256 in this header or the signature fails
   * and the write never reaches the function.
   */
  static readonly PAYLOAD_HASH_HEADER = 'x-amz-content-sha256';

  private readonly http = inject(HttpClient);
  private readonly options = inject(SITE_OPTIONS);
  private readonly session = inject(DemoSession);

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

  /** @inheritdoc */
  override createPatient(input: PatientInput, idempotencyKey: string): Promise<FhirResponse<PatientWriteResult>> {
    return this.send<PatientWriteResult>('POST', `${this.options.fhirApiBase}/patients`, input, 'application/json', {
      [HttpFhirClient.IDEMPOTENCY_HEADER]: idempotencyKey,
    });
  }

  /** @inheritdoc */
  override replacePatient(patientId: string, input: PatientInput): Promise<FhirResponse<PatientWriteResult>> {
    return this.send<PatientWriteResult>('PUT', this.patientPath(patientId), input, 'application/json');
  }

  /** @inheritdoc */
  override patchPatient(patientId: string, operations: readonly PatientPatchOperation[]): Promise<FhirResponse<PatientWriteResult>> {
    return this.send<PatientWriteResult>('PATCH', this.patientPath(patientId), operations, HttpFhirClient.JSON_PATCH);
  }

  /** @inheritdoc */
  override deletePatient(patientId: string): Promise<FhirResponse<null>> {
    return this.send<null>('DELETE', this.patientPath(patientId), null, null);
  }

  /** @inheritdoc */
  override addCondition(patientId: string, input: ConditionInput): Promise<FhirResponse<ConditionWriteResult>> {
    return this.send<ConditionWriteResult>('POST', `${this.patientPath(patientId)}/conditions`, input, 'application/json');
  }

  /** @inheritdoc */
  override resolveCondition(patientId: string, conditionId: string): Promise<FhirResponse<null>> {
    return this.send<null>('POST', `${this.patientPath(patientId)}/conditions/${encodeURIComponent(conditionId)}/resolve`, null, null);
  }

  private patientPath(patientId: string): string {
    return `${this.options.fhirApiBase}/patients/${encodeURIComponent(patientId)}`;
  }

  /** A write: the session header always, a body in its media type when there is one, and the answer's facts; a 204 has a null body. */
  private async send<T>(method: string, path: string, body: unknown, contentType: string | null, extraHeaders: Record<string, string> = {}): Promise<FhirResponse<T>> {
    const started = performance.now();
    const headers: Record<string, string> = {
      Accept: HttpFhirClient.JSON_ACCEPT,
      [HttpFhirClient.SESSION_HEADER]: this.session.token,
      ...extraHeaders,
    };
    const payload = body === null ? undefined : JSON.stringify(body);
    if (contentType !== null && payload !== undefined) {
      headers['Content-Type'] = contentType;
      headers[HttpFhirClient.PAYLOAD_HASH_HEADER] = await HttpFhirClient.sha256(payload);
    }

    try {
      const response = await firstValueFrom(
        this.http.request<T>(method, path, {
          body: payload,
          observe: 'response',
          headers,
          timeout: HttpFhirClient.TIMEOUT_MS,
        }),
      );
      return HttpFhirClient.toFhirResponse(response, (response.status === 204 ? null : response.body) as T, started);
    } catch (error: unknown) {
      throw FhirProblemError.from(error, HttpFhirClient.elapsed(started));
    }
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

  /** Lower-case hex SHA-256 of the UTF-8 text, through Web Crypto. */
  static async sha256(text: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private static elapsed(started: number): number {
    return Math.round(performance.now() - started);
  }
}
