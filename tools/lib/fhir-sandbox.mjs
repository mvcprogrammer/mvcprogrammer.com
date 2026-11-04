// mvcprogrammer.com — tools/lib/fhir-sandbox.mjs
// What the two sandbox tools share: listing the patients the explorer created on a FHIR R4 server
// (every one carries the demo-session identifier the function stamps), deleting one with its
// conditions first (the sandbox enforces referential integrity and answers 409 while a condition
// still references the patient), and the age arithmetic tools/fhir-reap.mjs filters on.
// tools/fhir-e2e.mjs uses the delete as its fallback when a run's own session can no longer reach
// what it created. Talks FHIR directly, outside the function's guard, because the guard is ours and
// the public sandbox has none; only the identifier systems below are ever addressed, so the seeded
// patient and the HL7 ETL cohort, which carry neither, are never candidates. No dependencies beyond
// Node 22+ (global fetch).

/** The identifier system the function stamps the visitor's session token on every patient it creates. */
export const SESSION_SYSTEM = 'https://mvcprogrammer.com/fhir/demo-session';

/** The public HAPI FHIR R4 sandbox the explorer reads and writes. */
export const DEFAULT_BASE = 'https://hapi.fhir.org/baseR4';

const FHIR_JSON = 'application/fhir+json';
const HEADERS = { Accept: FHIR_JSON };

/** Patients per search page; HAPI caps _count well above this. */
export const PAGE_SIZE = 100;

/** Pages followed through link[rel=next] per listing, including the first; a runaway next chain stops here. */
export const PAGE_CAP = 20;

/**
 * Parses the options the sandbox tools share. Unknown options are left for the caller; the
 * positional arguments come back untouched.
 *   --base <url>            the FHIR base (default DEFAULT_BASE)
 *   --max-age-hours <n>     only patients last updated at least this long ago (default 24, 0 = all)
 *   --dry-run               list, delete nothing
 *   --summary <path>        append a Markdown account to this file (the job summary on Actions)
 */
export function parseSandboxArgs(argv, defaults = {}) {
  const options = { base: DEFAULT_BASE, maxAgeHours: 24, dryRun: false, summary: null, ...defaults };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') options.base = argv[++i];
    else if (arg === '--max-age-hours') options.maxAgeHours = Number(argv[++i]);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--summary') options.summary = argv[++i];
    else positional.push(arg);
  }
  if (typeof options.base !== 'string' || !/^https?:\/\//.test(options.base)) throw new Error(`--base must be an http(s) URL, got ${options.base}`);
  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours < 0) throw new Error(`--max-age-hours must be a number of hours, got ${options.maxAgeHours}`);
  options.base = options.base.replace(/\/+$/, '');
  return { options, positional };
}

/** Hours between a resource's lastUpdated and now; NaN when the stamp is missing or unreadable. */
export function ageHours(lastUpdated, now = new Date()) {
  const stamp = Date.parse(lastUpdated ?? '');
  return (now.getTime() - stamp) / 3_600_000;
}

/** The cut-off a `--max-age-hours` means, as an ISO instant for the server-side `_lastUpdated=lt` filter. */
export function cutoffInstant(maxAgeHours, now = new Date()) {
  return new Date(now.getTime() - maxAgeHours * 3_600_000).toISOString();
}

/** One line a listing prints and the summary tabulates. */
function describe(patient) {
  const name = patient.name?.[0] ?? {};
  const label = [name.family, ...(name.given ?? [])].filter(Boolean).join(', ');
  const session = patient.identifier?.find((i) => i.system === SESSION_SYSTEM)?.value ?? '';
  return {
    id: patient.id,
    name: label || '(unnamed)',
    session: session.slice(0, 8),
    lastUpdated: patient.meta?.lastUpdated ?? '',
  };
}

/**
 * Lists the patients carrying an identifier in `system` (any value when `value` is empty) that were
 * last updated before `cutoff` (an ISO instant; null for no filter), following next links up to
 * PAGE_CAP pages. Returns the trimmed rows describe() makes, oldest first.
 */
export async function listSessionPatients({ base, system = SESSION_SYSTEM, value = '', cutoff = null, fetchImpl = fetch }) {
  const params = new URLSearchParams({ identifier: `${system}|${value}`, _count: String(PAGE_SIZE), _elements: 'id,identifier,name,meta' });
  if (cutoff) params.append('_lastUpdated', `lt${cutoff}`);
  let url = `${base}/Patient?${params}`;
  const rows = [];
  for (let page = 0; url && page < PAGE_CAP; page++) {
    const response = await fetchImpl(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`${response.status} listing patients from ${url}`);
    const bundle = await response.json();
    for (const entry of bundle.entry ?? []) {
      if (entry.resource?.resourceType === 'Patient') rows.push(describe(entry.resource));
    }
    url = bundle.link?.find((l) => l.relation === 'next')?.url ?? null;
  }
  rows.sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));
  return rows;
}

/** Ids of the conditions that reference the patient, from one bounded search. */
async function conditionIds(base, patientId, fetchImpl) {
  const url = `${base}/Condition?${new URLSearchParams({ patient: patientId, _count: '200', _elements: 'id' })}`;
  const response = await fetchImpl(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} listing conditions of Patient/${patientId}`);
  const bundle = await response.json();
  return (bundle.entry ?? []).map((e) => e.resource?.id).filter(Boolean);
}

/** A delete's outcome: `deleted`, `gone` (404 or 410: already removed, the state a delete asks for), or the failing status. */
async function deleteResource(base, type, id, fetchImpl) {
  const response = await fetchImpl(`${base}/${type}/${id}`, { method: 'DELETE', headers: HEADERS });
  if (response.ok) return 'deleted';
  if (response.status === 404 || response.status === 410) return 'gone';
  return String(response.status);
}

/**
 * Deletes one patient and, first, every condition that references it. A condition already gone is
 * skipped so a retry after a partial failure finishes the job; a condition whose delete fails stops
 * the cascade before the patient, so a 409 never masks the real cause. Returns what happened to each.
 */
export async function deletePatientCascade({ base, patientId, fetchImpl = fetch }) {
  const conditions = [];
  for (const id of await conditionIds(base, patientId, fetchImpl)) {
    const outcome = await deleteResource(base, 'Condition', id, fetchImpl);
    conditions.push({ id, outcome });
    if (outcome !== 'deleted' && outcome !== 'gone') return { patientId, conditions, patient: 'skipped', ok: false };
  }
  const patient = await deleteResource(base, 'Patient', patientId, fetchImpl);
  return { patientId, conditions, patient, ok: patient === 'deleted' || patient === 'gone' };
}

/** The Markdown table the Actions job summary shows: one row per candidate with what happened to it. */
export function renderSummary({ title, base, maxAgeHours, dryRun, rows, results = new Map() }) {
  const lines = [`## ${title}`, '', `Base: \`${base}\`. ${maxAgeHours > 0 ? `Patients last updated more than ${maxAgeHours} hours ago.` : 'Every session patient, whatever its age.'} ${dryRun ? 'Dry run: nothing was deleted.' : ''}`.trim(), ''];
  if (rows.length === 0) {
    lines.push('No session patients matched.');
    return `${lines.join('\n')}\n`;
  }
  lines.push('| Patient | Name | Session | Last updated | Conditions | Outcome |', '|---|---|---|---|---|---|');
  for (const row of rows) {
    const result = results.get(row.id);
    const conditions = result ? result.conditions.map((c) => `${c.id} ${c.outcome}`).join(', ') || 'none' : '';
    const outcome = dryRun ? 'would delete' : result ? (result.ok ? `patient ${result.patient}` : `FAILED (patient ${result.patient})`) : 'not reached';
    lines.push(`| ${row.id} | ${row.name} | ${row.session} | ${row.lastUpdated.slice(0, 16)} | ${conditions} | ${outcome} |`);
  }
  return `${lines.join('\n')}\n`;
}
