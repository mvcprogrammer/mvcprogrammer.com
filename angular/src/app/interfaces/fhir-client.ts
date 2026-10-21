import { CapabilitySubset } from '../models/capability-subset';
import { FhirResponse } from '../models/fhir-response';
import { PatientSearchResult } from '../models/patient-search-result';
import { PatientSummary } from '../models/patient-summary';
import { PatientSearchRequest } from '../requests/patient-search-request';

/**
 * Reads the FHIR API behind the patient explorer. Every method resolves with the body and the
 * response facts the explorer's log reports, and rejects with a FhirProblemError. An abstract class
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
}
