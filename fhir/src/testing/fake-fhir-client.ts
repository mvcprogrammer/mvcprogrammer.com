import { FhirClient } from '../app/interfaces/fhir-client';
import { CapabilitySubset } from '../app/models/capability-subset';
import { ConditionWriteResult } from '../app/models/condition-write-result';
import { FhirResponse } from '../app/models/fhir-response';
import { PatientSearchResult } from '../app/models/patient-search-result';
import { PatientSummary } from '../app/models/patient-summary';
import { PatientWriteResult } from '../app/models/patient-write-result';
import { ConditionInput } from '../app/requests/condition-input';
import { PatientInput } from '../app/requests/patient-input';
import { PatientPatchOperation } from '../app/requests/patient-patch-operation';
import { PatientSearchRequest } from '../app/requests/patient-search-request';
import { createCapabilitySubset, createConditionWriteResult, createFhirResponse, createPatientSearchResult, createPatientSummary, createPatientWriteResult } from './test-data';

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

  /** Inputs and keys passed to createPatient(), in call order. */
  readonly creates: { input: PatientInput; key: string }[] = [];

  /** Ids and inputs passed to replacePatient(), in call order. */
  readonly replaces: { id: string; input: PatientInput }[] = [];

  /** Ids and operations passed to patchPatient(), in call order. */
  readonly patches: { id: string; operations: readonly PatientPatchOperation[] }[] = [];

  /** Ids passed to deletePatient(), in call order. */
  readonly deletes: string[] = [];

  /** Ids and inputs passed to addCondition(), in call order. */
  readonly conditionAdds: { id: string; input: ConditionInput }[] = [];

  /** Patient and condition ids passed to resolveCondition(), in call order. */
  readonly resolves: { patientId: string; conditionId: string }[] = [];

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

  /** Behaviour of createPatient(): a 201 with the input echoed as the new patient. */
  onCreatePatient: (input: PatientInput, key: string) => Promise<FhirResponse<PatientWriteResult>> = (input) =>
    Promise.resolve(createFhirResponse(createPatientWriteResult(input), { status: 201, xCache: null, etag: null }));

  /** Behaviour of replacePatient(): a 200 with the input echoed. */
  onReplacePatient: (id: string, input: PatientInput) => Promise<FhirResponse<PatientWriteResult>> = (id, input) =>
    Promise.resolve(createFhirResponse(createPatientWriteResult(input, id), { xCache: null, etag: null }));

  /** Behaviour of patchPatient(): a 200 with the stored patient unchanged (tests override to show the patch applied). */
  onPatchPatient: (id: string, operations: readonly PatientPatchOperation[]) => Promise<FhirResponse<PatientWriteResult>> = (id) =>
    Promise.resolve(createFhirResponse(createPatientWriteResult({ familyName: 'Watsica258', givenName: 'Kimi714' }, id), { xCache: null, etag: null }));

  /** Behaviour of deletePatient(): a 204. */
  onDeletePatient: (id: string) => Promise<FhirResponse<null>> = () => Promise.resolve(createFhirResponse(null, { status: 204, xCache: null, etag: null, contentType: null }));

  /** Behaviour of addCondition(): a 201 with the listed condition for the code. */
  onAddCondition: (id: string, input: ConditionInput) => Promise<FhirResponse<ConditionWriteResult>> = (id, input) =>
    Promise.resolve(createFhirResponse(createConditionWriteResult(input.code, id), { status: 201, xCache: null, etag: null }));

  /** Behaviour of resolveCondition(): a 204. */
  onResolveCondition: (patientId: string, conditionId: string) => Promise<FhirResponse<null>> = () =>
    Promise.resolve(createFhirResponse(null, { status: 204, xCache: null, etag: null, contentType: null }));

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

  override createPatient(input: PatientInput, idempotencyKey: string): Promise<FhirResponse<PatientWriteResult>> {
    this.creates.push({ input, key: idempotencyKey });
    return this.onCreatePatient(input, idempotencyKey);
  }

  override replacePatient(patientId: string, input: PatientInput): Promise<FhirResponse<PatientWriteResult>> {
    this.replaces.push({ id: patientId, input });
    return this.onReplacePatient(patientId, input);
  }

  override patchPatient(patientId: string, operations: readonly PatientPatchOperation[]): Promise<FhirResponse<PatientWriteResult>> {
    this.patches.push({ id: patientId, operations });
    return this.onPatchPatient(patientId, operations);
  }

  override deletePatient(patientId: string): Promise<FhirResponse<null>> {
    this.deletes.push(patientId);
    return this.onDeletePatient(patientId);
  }

  override addCondition(patientId: string, input: ConditionInput): Promise<FhirResponse<ConditionWriteResult>> {
    this.conditionAdds.push({ id: patientId, input });
    return this.onAddCondition(patientId, input);
  }

  override resolveCondition(patientId: string, conditionId: string): Promise<FhirResponse<null>> {
    this.resolves.push({ patientId, conditionId });
    return this.onResolveCondition(patientId, conditionId);
  }
}
