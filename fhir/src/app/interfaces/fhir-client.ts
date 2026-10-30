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

/**
 * The FHIR API behind the patient explorer: the reads, and the writes under the demo guard. Every
 * method resolves with the body and the response facts the explorer's log reports, and rejects with
 * a FhirProblemError. The writes carry the session token themselves. An abstract class
 * rather than an interface so it can serve as the injection token.
 */
export abstract class FhirClient {
  /** GET /api/fhir/patients?family=&birthdate=&identifier=: one page of matches. */
  abstract searchPatients(request: PatientSearchRequest): Promise<FhirResponse<PatientSearchResult>>;

  /** GET /api/fhir/patients/{id}/summary: demographics, counts, conditions, vitals, and the upstream trace. */
  abstract getSummary(patientId: string): Promise<FhirResponse<PatientSummary>>;

  /** GET /api/fhir/patients/{id}/raw: the FHIR bundle behind a summary, pretty-printed, as text. */
  abstract getRawBundle(patientId: string): Promise<FhirResponse<string>>;

  /** GET /api/fhir/capability: what the sandbox supports of what the explorer needs. */
  abstract getCapability(): Promise<FhirResponse<CapabilitySubset>>;

  /** POST /api/fhir/patients with Idempotency-Key: 201 for a new patient, 200 when the key had already made one. */
  abstract createPatient(input: PatientInput, idempotencyKey: string): Promise<FhirResponse<PatientWriteResult>>;

  /** PUT /api/fhir/patients/{id}: full replacement of the demographics. */
  abstract replacePatient(patientId: string, input: PatientInput): Promise<FhirResponse<PatientWriteResult>>;

  /** PATCH /api/fhir/patients/{id} as application/json-patch+json. */
  abstract patchPatient(patientId: string, operations: readonly PatientPatchOperation[]): Promise<FhirResponse<PatientWriteResult>>;

  /** DELETE /api/fhir/patients/{id}: 204, repeatable. */
  abstract deletePatient(patientId: string): Promise<FhirResponse<null>>;

  /** POST /api/fhir/patients/{id}/conditions: 201 for a new condition, 200 when the patient already has it active. */
  abstract addCondition(patientId: string, input: ConditionInput): Promise<FhirResponse<ConditionWriteResult>>;

  /** POST /api/fhir/patients/{id}/conditions/{conditionId}/resolve, no body: 204, again for a condition already resolved. */
  abstract resolveCondition(patientId: string, conditionId: string): Promise<FhirResponse<null>>;
}
