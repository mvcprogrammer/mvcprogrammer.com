#!/usr/bin/env node
// mvcprogrammer.com — tools/fhir-e2e.mjs
// Drives the explorer's write side end to end through its API, the way the page does: create a
// demo patient, replay the create, add a condition, add it again, resolve it, read the summary,
// delete the patient, delete it again. Every step prints its outcome and the first failure stops the
// run with exit status 1. Whatever happens, the run ends by deleting what it created: first through
// the API with its own session token, and if that cannot (the function is down, the token is
// rejected), directly on the sandbox through tools/lib/fhir-sandbox.mjs, so a failed run leaves no
// litter behind. Only a hard kill escapes that, which is what tools/fhir-reap.mjs is for.
//
//   node tools/fhir-e2e.mjs https://fhir.mvcprogrammer.com/           # the live host
//   node tools/fhir-e2e.mjs http://localhost:4200/                    # a local preview (see fhir/README.md)
//   node tools/fhir-e2e.mjs http://localhost:4200/ --base https://hapi.fhir.org/baseR4   # the sandbox behind it
//   node tools/fhir-e2e.mjs https://fhir.mvcprogrammer.com/ --stop-after add             # fail on purpose, to watch the clean-up
import { createHash, randomUUID } from 'node:crypto';
import { deletePatientCascade, parseSandboxArgs } from './lib/fhir-sandbox.mjs';

const { options, positional } = parseSandboxArgs(process.argv.slice(2));
const host = positional[0];
const stopAfter = positional[1] === '--stop-after' ? positional[2] : null;
if (!host || !/^https?:\/\//.test(host) || (stopAfter !== null && !['create', 'add'].includes(stopAfter))) {
  console.error('Usage: node tools/fhir-e2e.mjs <explorer url> [--base <fhir base>] [--stop-after create|add]');
  process.exit(2);
}
const api = `${host.replace(/\/+$/, '')}/api/fhir`;
const session = randomUUID();
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const CONDITION_CODE = '59621000'; // Essential hypertension, the first entry of the function's pick list

/** The ids this run created and has not yet deleted through the API. */
const created = new Set();
let failures = 0;

/**
 * One API call. A request with a body also carries the body's SHA-256 in x-amz-content-sha256, as
 * the explorer does: CloudFront signs the request to the function URL and Lambda rejects a signed
 * body without it.
 */
async function call(method, path, { body, headers = {}, expect }) {
  const payload = body ? JSON.stringify(body) : undefined;
  const bodyHeaders = payload ? { 'Content-Type': 'application/json', 'x-amz-content-sha256': createHash('sha256').update(payload).digest('hex') } : {};
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Accept: 'application/json', 'X-Demo-Session': session, ...bodyHeaders, ...headers },
    body: payload,
  });
  const text = await response.text();
  const json = text ? safeJson(text) : null;
  const ok = expect.includes(response.status);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${method} ${path} -> ${response.status}${ok ? '' : ` (expected ${expect.join(' or ')})`}`);
  if (!ok) {
    failures++;
    if (json) console.log(`     ${JSON.stringify(json).slice(0, 300)}`);
    throw new Error(`${method} ${path} answered ${response.status}`);
  }
  return { status: response.status, json };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function run() {
  console.log(`Explorer ${api}  session ${session.slice(0, 8)}  sandbox ${options.base}`);

  const key = randomUUID();
  const input = { familyName: 'Check', givenName: 'E2E', sex: 'unknown', birthDate: '1990-01-01', mrn: `E2E-${stamp}` };
  const create = await call('POST', '/patients', { body: input, headers: { 'Idempotency-Key': key }, expect: [201] });
  const id = create.json?.patient?.id;
  if (!id) throw new Error('the create answered 201 without a patient id');
  created.add(id);
  console.log(`     Patient/${id}`);
  if (stopAfter === 'create') throw new Error('stopped after the create on request');

  const replay = await call('POST', '/patients', { body: input, headers: { 'Idempotency-Key': key }, expect: [200] });
  if (replay.json?.patient?.id !== id) throw new Error(`the replayed create returned Patient/${replay.json?.patient?.id}, not Patient/${id}`);

  const add = await call('POST', `/patients/${id}/conditions`, { body: { code: CONDITION_CODE }, expect: [201] });
  const conditionId = add.json?.condition?.id;
  if (!conditionId) throw new Error('the add answered 201 without a condition id');
  console.log(`     Condition/${conditionId}`);
  if (stopAfter === 'add') throw new Error('stopped after the add on request');

  await call('POST', `/patients/${id}/conditions`, { body: { code: CONDITION_CODE }, expect: [200] });
  await call('POST', `/patients/${id}/conditions/${conditionId}/resolve`, { expect: [204] });

  const summary = await call('GET', `/patients/${id}/summary`, { expect: [200] });
  const resolved = summary.json?.conditions?.resolved ?? [];
  const active = summary.json?.conditions?.active ?? [];
  if (!resolved.some((c) => c.id === conditionId) || active.some((c) => c.id === conditionId)) {
    throw new Error(`the summary does not show Condition/${conditionId} as resolved (active ${active.length}, resolved ${resolved.length})`);
  }
  console.log(`     summary: ${active.length} active, ${resolved.length} resolved`);

  await call('DELETE', `/patients/${id}`, { expect: [204] });
  created.delete(id);
  await call('DELETE', `/patients/${id}`, { expect: [204] });
}

/** Deletes what the run still owns: the API first, the sandbox directly when the API cannot. */
async function cleanUp() {
  for (const id of created) {
    try {
      await call('DELETE', `/patients/${id}`, { expect: [204] });
      created.delete(id);
    } catch {
      const result = await deletePatientCascade({ base: options.base, patientId: id });
      console.log(`${result.ok ? 'ok  ' : 'FAIL'} sandbox delete Patient/${id}: ${result.conditions.map((c) => `${c.id}:${c.outcome}`).join(' ') || 'no conditions'} patient ${result.patient}`);
      if (result.ok) created.delete(id);
      else failures++;
    }
  }
}

let exitCode = 0;
try {
  await run();
} catch (error) {
  exitCode = 1;
  console.error(`Stopped: ${error.message}`);
} finally {
  await cleanUp();
  if (created.size > 0) {
    exitCode = 1;
    console.error(`Left on the sandbox: ${[...created].map((id) => `Patient/${id}`).join(', ')} (run tools/fhir-reap.mjs)`);
  }
}
console.log(exitCode === 0 ? 'All steps passed and nothing was left behind.' : `${failures} step${failures === 1 ? '' : 's'} failed.`);
process.exit(exitCode);
