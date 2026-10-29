import { ClinicalStatus } from '../app/enumerations/clinical-status';
import { Sex } from '../app/enumerations/sex';
import { CapabilitySubset } from '../app/models/capability-subset';
import { FhirResponse } from '../app/models/fhir-response';
import { PatientListItem } from '../app/models/patient-list-item';
import { PatientSearchResult } from '../app/models/patient-search-result';
import { PatientSummary } from '../app/models/patient-summary';
import { Trace } from '../app/models/trace';

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
