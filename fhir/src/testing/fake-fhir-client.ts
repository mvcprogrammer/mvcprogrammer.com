import { FhirClient } from '../app/interfaces/fhir-client';
import { CapabilitySubset } from '../app/models/capability-subset';
import { FhirResponse } from '../app/models/fhir-response';
import { PatientSearchResult } from '../app/models/patient-search-result';
import { PatientSummary } from '../app/models/patient-summary';
import { PatientSearchRequest } from '../app/requests/patient-search-request';
import { createCapabilitySubset, createFhirResponse, createPatientSearchResult, createPatientSummary } from './test-data';

/** Scriptable FhirClient. Each method runs the function a test assigns and records its arguments. */
export class FakeFhirClient extends FhirClient {
  /** Requests passed to searchPatients(), in call order. */
  readonly searches: PatientSearchRequest[] = [];

  /** Patient ids passed to getSummary(), in call order. */
  readonly summaryCalls: string[] = [];

  /** Patient ids passed to getRawBundle(), in call order. */
  readonly rawCalls: string[] = [];

  /** How many times getCapability() ran. */
  capabilityCalls = 0;

  /** Behaviour of searchPatients(). */
  onSearchPatients: (request: PatientSearchRequest) => Promise<FhirResponse<PatientSearchResult>> = () =>
    Promise.resolve(createFhirResponse(createPatientSearchResult()));

  /** Behaviour of getSummary(). */
  onGetSummary: (patientId: string) => Promise<FhirResponse<PatientSummary>> = () => Promise.resolve(createFhirResponse(createPatientSummary()));

  /** Behaviour of getRawBundle(). */
  onGetRawBundle: (patientId: string) => Promise<FhirResponse<string>> = () =>
    Promise.resolve(createFhirResponse('{\n  "resourceType": "Bundle"\n}', { contentType: 'application/fhir+json; charset=utf-8' }));

  /** Behaviour of getCapability(). */
  onGetCapability: () => Promise<FhirResponse<CapabilitySubset>> = () => Promise.resolve(createFhirResponse(createCapabilitySubset()));

  override searchPatients(request: PatientSearchRequest): Promise<FhirResponse<PatientSearchResult>> {
    this.searches.push(request);
    return this.onSearchPatients(request);
  }

  override getSummary(patientId: string): Promise<FhirResponse<PatientSummary>> {
    this.summaryCalls.push(patientId);
    return this.onGetSummary(patientId);
  }

  override getRawBundle(patientId: string): Promise<FhirResponse<string>> {
    this.rawCalls.push(patientId);
    return this.onGetRawBundle(patientId);
  }

  override getCapability(): Promise<FhirResponse<CapabilitySubset>> {
    this.capabilityCalls++;
    return this.onGetCapability();
  }
}
