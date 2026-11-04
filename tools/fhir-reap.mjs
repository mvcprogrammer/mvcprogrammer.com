#!/usr/bin/env node
// mvcprogrammer.com — tools/fhir-reap.mjs
// Removes the demo patients the explorer's visitors left on the public sandbox. Every patient the
// function creates carries the visitor's session token as an identifier, and the token lives in the
// visitor's browser; once that browser is gone, so is the only credential that could delete the
// patient through the API. This lists every such patient older than a threshold and deletes it,
// conditions first. The seeded patient and the HL7 ETL cohort carry no session identifier and are
// never candidates. Run by hand, or from the Actions tab (.github/workflows/fhir-reap.yml); it has
// no schedule by decision, so every deletion is one somebody asked for.
//
//   node tools/fhir-reap.mjs --dry-run                     # list what a run would delete (24 h and older)
//   node tools/fhir-reap.mjs                               # delete them
//   node tools/fhir-reap.mjs --max-age-hours 0             # every session patient, whatever its age
//   node tools/fhir-reap.mjs --base https://r4.smarthealthit.org --summary summary.md
//
// Exit status: 0 when every candidate was deleted (or there were none), 1 when any delete failed.
import { appendFile } from 'node:fs/promises';
import { cutoffInstant, deletePatientCascade, listSessionPatients, parseSandboxArgs, renderSummary } from './lib/fhir-sandbox.mjs';

const { options } = parseSandboxArgs(process.argv.slice(2));
const { base, maxAgeHours, dryRun, summary } = options;
const cutoff = maxAgeHours > 0 ? cutoffInstant(maxAgeHours) : null;

const rows = await listSessionPatients({ base, cutoff });
console.log(`${dryRun ? 'DRY RUN' : 'APPLY'}: ${rows.length} session patient${rows.length === 1 ? '' : 's'} on ${base}${cutoff ? ` last updated before ${cutoff}` : ''}`);

const results = new Map();
let failed = 0;
for (const row of rows) {
  const label = `${row.id} ${row.name} session ${row.session} updated ${row.lastUpdated.slice(0, 16)}`;
  if (dryRun) {
    console.log(`  would delete ${label}`);
    continue;
  }
  const result = await deletePatientCascade({ base, patientId: row.id });
  results.set(row.id, result);
  const conditions = result.conditions.map((c) => `${c.id}:${c.outcome}`).join(' ') || 'no conditions';
  console.log(`  ${result.ok ? 'deleted' : 'FAILED '} ${label}  ${conditions}  patient ${result.patient}`);
  if (!result.ok) failed++;
}

if (summary) {
  await appendFile(summary, renderSummary({ title: 'FHIR sandbox reaper', base, maxAgeHours, dryRun, rows, results }));
}
if (failed > 0) {
  console.error(`${failed} of ${rows.length} could not be deleted; run again once the sandbox answers.`);
  process.exit(1);
}
