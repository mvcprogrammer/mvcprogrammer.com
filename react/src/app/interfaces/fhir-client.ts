import type { CapabilitySubset } from '../models/capability-subset';
import type { FhirResponse } from '../models/fhir-response';
import type { PatientSearchResult } from '../models/patient-search-result';
import type { PatientSummary } from '../models/patient-summary';
import type { PatientSearchRequest } from '../requests/patient-search-request';

/**
 * Reads the FHIR API behind the patient explorer. Every method resolves with the body and the
 * response facts the explorer's log reports, and rejects with a FhirProblemError.
 */
export interface FhirClient {
  /** GET /api/fhir/patients?family=&birthdate=&identifier=: one page of matches. */
  searchPatients(request: PatientSearchRequest): Promise<FhirResponse<PatientSearchResult>>;

  /** GET /api/fhir/patients/{id}/summary: demographics, counts, conditions, vitals, and the upstream trace. */
  getSummary(patientId: string): Promise<FhirResponse<PatientSummary>>;

  /** GET /api/fhir/patients/{id}/raw: the FHIR bundle behind a summary, pretty-printed, as text. */
  getRawBundle(patientId: string): Promise<FhirResponse<string>>;

  /** GET /api/fhir/capability: what the sandbox supports of what the explorer needs. */
  getCapability(): Promise<FhirResponse<CapabilitySubset>>;
}
