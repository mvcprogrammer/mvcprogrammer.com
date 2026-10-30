import { ClinicalStatus } from '../app/enumerations/clinical-status';
import { Sex } from '../app/enumerations/sex';
import { CONDITION_PICK_LIST } from '../app/content/condition-pick-list';
import { CapabilitySubset } from '../app/models/capability-subset';
import { ConditionWriteResult } from '../app/models/condition-write-result';
import { FhirResponse } from '../app/models/fhir-response';
import { PatientListItem } from '../app/models/patient-list-item';
import { PatientSearchResult } from '../app/models/patient-search-result';
import { PatientSummary } from '../app/models/patient-summary';
import { PatientWriteResult } from '../app/models/patient-write-result';
import { Trace } from '../app/models/trace';
import { PatientInput } from '../app/requests/patient-input';
import { FakeDemoSession } from './fake-demo-session';

/** A FHIR API answer around a body; override the response facts the test cares about. */
export function createFhirResponse<T>(body: T, overrides: Partial<Omit<FhirResponse<T>, 'body'>> = {}): FhirResponse<T> {
  return {
    body,
    status: 200,
    durationMs: 120,
    xCache: 'Miss from cloudfront',
    etag: '"abc123"',
    contentType: 'application/json; charset=utf-8',
    ...overrides,
  };
}

/** A trace with one upstream request; override what the test cares about. */
export function createTrace(overrides: Partial<Trace> = {}): Trace {
  return {
    dataSource: { name: 'HAPI FHIR R4 public test server', baseUrl: 'https://hapi.fhir.org/baseR4' },
    requests: [{ method: 'GET', url: 'https://hapi.fhir.org/baseR4/Patient?family=Programmer', status: 200, durationMs: 110, entries: 1, pages: 1 }],
    totalDurationMs: 110,
    bundleEntries: 1,
    pagesWalked: 1,
    pageCap: 5,
    truncated: false,
    generatedAt: '2026-10-21T15:00:00Z',
    ...overrides,
  };
}

/** One search row with sensible defaults; override what the test cares about. */
export function createPatientListItem(overrides: Partial<PatientListItem> = {}): PatientListItem {
  return {
    id: '78785',
    name: 'Watsica258, Kimi714',
    familyName: 'Watsica258',
    givenName: 'Kimi714',
    birthDate: '1963-03-02',
    birthYear: 1963,
    sex: Sex.Female,
    ...overrides,
  };
}

/** A search result with the given rows, as the API returns it. */
export function createPatientSearchResult(...items: PatientListItem[]): PatientSearchResult {
  const rows = items.length === 0 ? [createPatientListItem()] : items;
  return { count: rows.length, query: { family: 'Programmer' }, items: rows, trace: createTrace() };
}

/** A search result with no rows, as a wiped sandbox returns. */
export function createEmptyPatientSearchResult(): PatientSearchResult {
  return { count: 0, query: { family: 'Programmer' }, items: [], trace: createTrace({ bundleEntries: 0, requests: [] }) };
}

/** A patient summary with one active condition, one resolved condition, and two vitals; override what the test cares about. */
export function createPatientSummary(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    patient: {
      id: '78785',
      name: 'Watsica258, Kimi714',
      familyName: 'Watsica258',
      givenName: 'Kimi714',
      initials: 'KW',
      sex: Sex.Female,
      birthDate: '1963-03-02',
      age: 63,
      mrn: 'eed8a921',
      identifiers: [{ system: 'http://hospital.example/mrn', value: 'eed8a921', type: 'MR' }],
    },
    counts: { conditions: 2, encounters: 31, observations: 240 },
    conditions: {
      active: [{ display: 'Essential hypertension (disorder)', code: '59621000', system: 'http://snomed.info/sct', systemLabel: 'SNOMED CT', clinicalStatus: ClinicalStatus.Active, onsetDate: '2010-05-01' }],
      resolved: [{ display: 'Acute bronchitis (disorder)', code: '10509002', systemLabel: 'SNOMED CT', clinicalStatus: ClinicalStatus.Resolved }],
    },
    vitals: [
      { date: '2026-03-31T10:47:00Z', name: 'Blood pressure', loincCode: '85354-9', components: [{ name: 'Systolic', loincCode: '8480-6', value: 108, unit: 'mm[Hg]' }, { name: 'Diastolic', loincCode: '8462-4', value: 82, unit: 'mm[Hg]' }] },
      { date: '2026-03-31', name: 'Body weight', loincCode: '29463-7', value: 64.6, unit: 'kg' },
    ],
    trace: createTrace({ requests: [
      { method: 'GET', url: 'https://hapi.fhir.org/baseR4/Patient/78785', status: 200, durationMs: 105, entries: 1, pages: 1 },
      { method: 'GET', url: 'https://hapi.fhir.org/baseR4/Condition?patient=78785', status: 200, durationMs: 411, entries: 2, pages: 1 },
    ], totalDurationMs: 580, bundleEntries: 3 }),
    ...overrides,
  };
}

/** A capability answer in which everything the explorer needs is supported; override what the test cares about. */
export function createCapabilitySubset(overrides: Partial<CapabilitySubset> = {}): CapabilitySubset {
  return {
    ok: true,
    fhirVersion: '4.0.1',
    software: { name: 'HAPI FHIR Server', version: '8.1.0' },
    baseUrl: 'https://hapi.fhir.org/baseR4',
    checkedAt: '2026-10-21T15:00:00Z',
    resources: [
      { type: 'Patient', supported: true, searchParams: [{ name: 'family', supported: true }] },
      { type: 'Condition', supported: true, searchParams: [{ name: 'patient', supported: true }] },
      { type: 'Observation', supported: true, searchParams: [{ name: 'patient', supported: true }] },
      { type: 'Encounter', supported: true, searchParams: [{ name: 'patient', supported: true }] },
    ],
    ...overrides,
  };
}

/** A patient summary for a patient this session created: the demo-session identifier carries the fake session's token. */
export function createOwnPatientSummary(id = 'mine-1'): PatientSummary {
  const summary = createPatientSummary();
  return {
    ...summary,
    patient: {
      ...summary.patient,
      id,
      identifiers: [
        ...summary.patient.identifiers,
        { system: 'https://mvcprogrammer.com/fhir/demo-session', value: FakeDemoSession.TOKEN },
        { system: 'https://mvcprogrammer.com/fhir/idempotency', value: '0c9b8a7d-6e5f-4a3b-8c2d-000000000001' },
      ],
    },
  };
}

/** What a write returns for the given input, as the function maps it: demographics plus a one-request trace. */
export function createPatientWriteResult(input: PatientInput, id = 'new-1'): PatientWriteResult {
  const given = input.givenName && input.givenName.trim() !== '' ? input.givenName.trim() : undefined;
  return {
    patient: {
      id,
      name: given ? `${input.familyName}, ${given}` : input.familyName,
      familyName: input.familyName,
      givenName: given,
      initials: ((given?.charAt(0) ?? '') + input.familyName.charAt(0)).toUpperCase(),
      sex: input.sex,
      birthDate: input.birthDate,
      mrn: input.mrn,
      identifiers: [
        ...(input.mrn ? [{ system: 'https://mvcprogrammer.com/fhir/mrn', value: input.mrn, type: 'MR' }] : []),
        { system: 'https://mvcprogrammer.com/fhir/demo-session', value: FakeDemoSession.TOKEN },
        { system: 'https://mvcprogrammer.com/fhir/idempotency', value: '0c9b8a7d-6e5f-4a3b-8c2d-000000000001' },
      ],
    },
    trace: createTrace({
      requests: [{ method: 'POST', url: 'https://hapi.fhir.org/baseR4/Patient', status: 201, durationMs: 180, entries: 1, pages: 1 }],
      totalDurationMs: 180,
    }),
  };
}

/** What an add returns for a listed code, as the function maps it: the active condition with an id, and the three-request trace (the guard read, the active count, the create). */
export function createConditionWriteResult(code = '59621000', patientId = 'mine-1', id = 'cond-1'): ConditionWriteResult {
  const entry = CONDITION_PICK_LIST.find((c) => c.code === code) ?? { code, display: 'Unknown condition' };
  return {
    condition: { id, display: entry.display, code: entry.code, system: 'http://snomed.info/sct', systemLabel: 'SNOMED CT', clinicalStatus: ClinicalStatus.Active, recordedDate: '2026-10-30' },
    trace: createTrace({
      requests: [
        { method: 'GET', url: `https://hapi.fhir.org/baseR4/Patient/${patientId}`, status: 200, durationMs: 120, entries: 1, pages: 1 },
        { method: 'GET', url: `https://hapi.fhir.org/baseR4/Condition?patient=Patient%2F${patientId}&clinical-status=active&_summary=count`, status: 200, durationMs: 95, entries: 1, pages: 1 },
        { method: 'POST', url: 'https://hapi.fhir.org/baseR4/Condition', status: 201, durationMs: 160, entries: 1, pages: 1 },
      ],
      totalDurationMs: 375,
      bundleEntries: 3,
      pagesWalked: 3,
    }),
  };
}
