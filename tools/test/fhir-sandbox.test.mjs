// mvcprogrammer.com — tools/test/fhir-sandbox.test.mjs
// Tests for the shared sandbox library behind tools/fhir-reap.mjs and tools/fhir-e2e.mjs: the
// command line, the age arithmetic, the paged listing, the delete cascade, and the summary. Every
// upstream call goes through a fake fetch that records what was asked.
//
//   node --test tools/test/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_BASE,
  SESSION_SYSTEM,
  ageHours,
  cutoffInstant,
  deletePatientCascade,
  listSessionPatients,
  parseSandboxArgs,
  renderSummary,
} from '../lib/fhir-sandbox.mjs';

const BASE = 'https://sandbox.test/r4';

/** A fetch that answers from a table keyed by `METHOD url` and records every call. */
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url}`);
    const answer = routes[`${method} ${url}`] ?? routes[`${method} *`];
    if (!answer) throw new Error(`no route for ${method} ${url}`);
    const { status = 200, body = null } = typeof answer === 'function' ? answer() : answer;
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (body ? JSON.stringify(body) : '') };
  };
  return { fetchImpl, calls };
}

function patient(id, { session = 'aaaaaaaa-0000-4000-8000-000000000000', updated = '2026-11-01T10:00:00.000+00:00', family = 'Patient', given = ['Demo'] } = {}) {
  return {
    resourceType: 'Patient',
    id,
    meta: { lastUpdated: updated },
    identifier: [{ system: SESSION_SYSTEM, value: session }],
    name: [{ family, given }],
  };
}

function bundle(resources, next = null) {
  return { resourceType: 'Bundle', type: 'searchset', entry: resources.map((resource) => ({ resource })), link: next ? [{ relation: 'next', url: next }] : [] };
}

// ---------------------------------------------------------------------------------------------------
// The command line

test('parseSandboxArgs applies the defaults and keeps positionals', () => {
  const { options, positional } = parseSandboxArgs(['https://fhir.example/']);
  assert.equal(options.base, DEFAULT_BASE);
  assert.equal(options.maxAgeHours, 24);
  assert.equal(options.dryRun, false);
  assert.equal(options.summary, null);
  assert.deepEqual(positional, ['https://fhir.example/']);
});

test('parseSandboxArgs reads every option and trims the base', () => {
  const { options } = parseSandboxArgs(['--base', `${BASE}/`, '--max-age-hours', '0', '--dry-run', '--summary', 'out.md']);
  assert.equal(options.base, BASE);
  assert.equal(options.maxAgeHours, 0);
  assert.equal(options.dryRun, true);
  assert.equal(options.summary, 'out.md');
});

test('parseSandboxArgs rejects a bad base or age', () => {
  assert.throws(() => parseSandboxArgs(['--base', 'ftp://x']), /--base/);
  assert.throws(() => parseSandboxArgs(['--max-age-hours', 'soon']), /--max-age-hours/);
  assert.throws(() => parseSandboxArgs(['--max-age-hours', '-1']), /--max-age-hours/);
});

// ---------------------------------------------------------------------------------------------------
// Ages

test('ageHours and cutoffInstant agree on the threshold', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  assert.equal(ageHours('2026-11-03T12:00:00Z', now), 24);
  assert.ok(Number.isNaN(ageHours(undefined, now)));
  assert.equal(cutoffInstant(24, now), '2026-11-03T12:00:00.000Z');
});

// ---------------------------------------------------------------------------------------------------
// Listing

test('listSessionPatients follows next links, filters by cutoff, and sorts oldest first', async () => {
  const page1 = `${BASE}/Patient?identifier=${encodeURIComponent(`${SESSION_SYSTEM}|`)}&_count=100&_elements=id%2Cidentifier%2Cname%2Cmeta&_lastUpdated=lt2026-11-03T12%3A00%3A00.000Z`;
  const page2 = `${BASE}?_getpages=abc&_getpagesoffset=100`;
  const { fetchImpl, calls } = fakeFetch({
    [`GET ${page1}`]: { body: bundle([patient('2', { updated: '2026-11-02T00:00:00.000+00:00', family: 'Test', given: ['Tester'] })], page2) },
    [`GET ${page2}`]: { body: bundle([patient('1', { updated: '2026-10-30T00:00:00.000+00:00', session: 'bbbbbbbb-0000-4000-8000-000000000000' }), { resourceType: 'OperationOutcome' }]) },
  });

  const rows = await listSessionPatients({ base: BASE, cutoff: '2026-11-03T12:00:00.000Z', fetchImpl });

  assert.deepEqual(calls, [`GET ${page1}`, `GET ${page2}`]);
  assert.deepEqual(rows.map((r) => r.id), ['1', '2']);
  assert.deepEqual(rows[1], { id: '2', name: 'Test, Tester', session: 'aaaaaaaa', lastUpdated: '2026-11-02T00:00:00.000+00:00' });
  assert.equal(rows[0].session, 'bbbbbbbb');
});

test('listSessionPatients omits the date filter without a cutoff and fails loudly on an error', async () => {
  const url = `${BASE}/Patient?identifier=${encodeURIComponent(`${SESSION_SYSTEM}|`)}&_count=100&_elements=id%2Cidentifier%2Cname%2Cmeta`;
  const ok = fakeFetch({ [`GET ${url}`]: { body: bundle([]) } });
  assert.deepEqual(await listSessionPatients({ base: BASE, fetchImpl: ok.fetchImpl }), []);

  const down = fakeFetch({ 'GET *': { status: 503 } });
  await assert.rejects(() => listSessionPatients({ base: BASE, fetchImpl: down.fetchImpl }), /503 listing patients/);
});

// ---------------------------------------------------------------------------------------------------
// The cascade

const conditionsOf = (id) => `${BASE}/Condition?patient=${id}&_count=200&_elements=id`;

test('deletePatientCascade deletes the conditions before the patient and tolerates one already gone', async () => {
  const { fetchImpl, calls } = fakeFetch({
    [`GET ${conditionsOf('9')}`]: { body: bundle([{ resourceType: 'Condition', id: 'c1' }, { resourceType: 'Condition', id: 'c2' }]) },
    [`DELETE ${BASE}/Condition/c1`]: { status: 200 },
    [`DELETE ${BASE}/Condition/c2`]: { status: 410 },
    [`DELETE ${BASE}/Patient/9`]: { status: 200 },
  });

  const result = await deletePatientCascade({ base: BASE, patientId: '9', fetchImpl });

  assert.deepEqual(calls, [`GET ${conditionsOf('9')}`, `DELETE ${BASE}/Condition/c1`, `DELETE ${BASE}/Condition/c2`, `DELETE ${BASE}/Patient/9`]);
  assert.deepEqual(result, { patientId: '9', conditions: [{ id: 'c1', outcome: 'deleted' }, { id: 'c2', outcome: 'gone' }], patient: 'deleted', ok: true });
});

test('deletePatientCascade stops before the patient when a condition delete fails', async () => {
  const { fetchImpl, calls } = fakeFetch({
    [`GET ${conditionsOf('9')}`]: { body: bundle([{ resourceType: 'Condition', id: 'c1' }, { resourceType: 'Condition', id: 'c2' }]) },
    [`DELETE ${BASE}/Condition/c1`]: { status: 500 },
  });

  const result = await deletePatientCascade({ base: BASE, patientId: '9', fetchImpl });

  assert.equal(calls.length, 2);
  assert.deepEqual(result, { patientId: '9', conditions: [{ id: 'c1', outcome: '500' }], patient: 'skipped', ok: false });
});

test('deletePatientCascade reports a patient already gone as success and a refusal as failure', async () => {
  const gone = fakeFetch({ [`GET ${conditionsOf('9')}`]: { body: bundle([]) }, [`DELETE ${BASE}/Patient/9`]: { status: 404 } });
  assert.deepEqual(await deletePatientCascade({ base: BASE, patientId: '9', fetchImpl: gone.fetchImpl }), { patientId: '9', conditions: [], patient: 'gone', ok: true });

  const refused = fakeFetch({ [`GET ${conditionsOf('9')}`]: { body: bundle([]) }, [`DELETE ${BASE}/Patient/9`]: { status: 409 } });
  assert.deepEqual(await deletePatientCascade({ base: BASE, patientId: '9', fetchImpl: refused.fetchImpl }), { patientId: '9', conditions: [], patient: '409', ok: false });
});

// ---------------------------------------------------------------------------------------------------
// The summary

test('renderSummary tabulates a dry run and an applied run', () => {
  const rows = [{ id: '9', name: 'Patient, Demo', session: 'aaaaaaaa', lastUpdated: '2026-11-01T10:00:00.000+00:00' }];

  const dry = renderSummary({ title: 'Reaper', base: BASE, maxAgeHours: 24, dryRun: true, rows });
  assert.match(dry, /Dry run: nothing was deleted/);
  assert.match(dry, /\| 9 \| Patient, Demo \| aaaaaaaa \| 2026-11-01T10:00 \|  \| would delete \|/);

  const results = new Map([['9', { patientId: '9', conditions: [{ id: 'c1', outcome: 'deleted' }], patient: 'deleted', ok: true }]]);
  const applied = renderSummary({ title: 'Reaper', base: BASE, maxAgeHours: 0, dryRun: false, rows, results });
  assert.match(applied, /Every session patient, whatever its age/);
  assert.match(applied, /\| c1 deleted \| patient deleted \|/);

  assert.match(renderSummary({ title: 'Reaper', base: BASE, maxAgeHours: 24, dryRun: false, rows: [] }), /No session patients matched/);
});
