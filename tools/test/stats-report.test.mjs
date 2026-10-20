// mvcprogrammer.com — tools/test/stats-report.test.mjs
// Tests for the run summary: the Markdown rendered from a report built off the fixture log, the
// upload and invalidation lines, and the text for a run whose export did not finish.
//
//   node --test tools/test/stats-report.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSessions, classifyRows, isVisit, newLogCounters, parseLogText, windowSince } from '../lib/cf-logs.mjs';
import { buildDayFile, buildReport, dayTotals } from '../stats-export.mjs';
import { renderReport } from '../stats-report.mjs';
import { OWN_IP, sampleLogText } from './fixtures/sample-log.mjs';

const NOW = new Date('2026-10-18T15:00:00Z');

/** The report an export of the fixture log would write for a three-day window ending on 2026-10-18. */
function fixtureReport() {
  const counters = Object.assign(newLogCounters(), { prefix: 'cf/', files: 2, bytes: 4096, syncSeconds: 3.21, parseSeconds: 0.04 });
  const all = classifyRows(parseLogText(sampleLogText(), new Date(0), counters), [OWN_IP]);
  const rows = all.filter((row) => !row.own);
  const sessions = buildSessions(rows.filter((row) => !row.bot));
  const visits = sessions.filter(isVisit);
  const files = ['2026-10-16', '2026-10-17'].map((day) => {
    const dayRows = rows.filter((row) => row.day === day);
    return dayTotals(buildDayFile(day, dayRows, visits.filter((visit) => visit.day === day), 'test'), dayRows, 1500);
  });
  const since = windowSince(3, NOW);
  return buildReport({
    now: NOW,
    days: 3,
    since,
    margin: new Date(since.getTime() - 30 * 60_000),
    bucket: 'mvcprogrammer-cf-logs-000000000000',
    prefixes: [counters],
    rows: { total: all.length, own: all.length - rows.length, scanners: rows.filter((row) => row.bot).length, sessions: sessions.length, visits: visits.length },
    files,
    missingDays: ['2026-10-18'],
    index: { days: ['2026-10-15', '2026-10-16', '2026-10-17'] },
    timing: { load: 3.25, build: 0.12, total: 3.37 },
  });
}

const SYNC_LOG = 'upload: out/days/2026-10-17.json to s3://mvcprogrammer.com/stats/data/days/2026-10-17.json\nupload: out/index.json to s3://mvcprogrammer.com/stats/data/index.json\n';
const INVALIDATION = { Location: 'https://cloudfront.amazonaws.com/...', Invalidation: { Id: 'I2EXAMPLE', Status: 'InProgress', CreateTime: '2026-10-18T15:00:02.123000+00:00' } };
const OUT_FILES = ['days/2026-10-16.json', 'days/2026-10-17.json', 'index.json'];

function render(overrides = {}) {
  return renderReport({
    report: fixtureReport(),
    trigger: 'manual run by neal (days = 3)',
    syncLog: SYNC_LOG,
    syncOutcome: 'success',
    invalidation: INVALIDATION,
    invalidationOutcome: 'success',
    outFiles: OUT_FILES,
    outDir: 'out',
    commit: 'b445345c0ffee',
    node: 'v24.0.0',
    ...overrides,
  });
}

test('buildReport holds counts and day keys only, never a row', () => {
  const report = fixtureReport();
  assert.deepEqual(Object.keys(report), ['schemaVersion', 'generatedAt', 'timeZone', 'window', 'bucket', 'prefixes', 'rows', 'files', 'missingDays', 'index', 'timing']);
  assert.deepEqual(report.window, { days: 3, firstDay: '2026-10-16', lastDay: '2026-10-18', since: '2026-10-16T04:00:00.000Z', parsedFrom: '2026-10-16T03:30:00.000Z' });
  assert.deepEqual(report.rows, { total: 33, own: 2, scanners: 3, sessions: 7, visits: 5 });
  assert.deepEqual(report.index, { days: 3, firstDay: '2026-10-15', lastDay: '2026-10-17' });
  const text = JSON.stringify(report);
  assert.ok(!text.includes('203.0.113'), 'no IP address');
  assert.ok(!text.includes(OWN_IP), 'not even the excluded one');
  assert.ok(!text.includes('Mozilla'), 'no browser string');
});

test('dayTotals carries the day file totals plus the beacon and API rows behind them', () => {
  const [day16, day17] = fixtureReport().files;
  assert.deepEqual(day16, { day: '2026-10-16', requests: 2, scannerRequests: 0, pings: 0, apiRequests: 0, visits: 1, visitors: 1, bytes: 1500 });
  assert.equal(day17.requests, 28);
  assert.equal(day17.scannerRequests, 4, 'two Googlebot lines, one empty user agent, one 404');
  assert.equal(day17.pings, 10);
  assert.equal(day17.apiRequests, 1);
  assert.equal(day17.visits, 4, 'A, B, C, D');
  assert.equal(day17.visitors, 2, 'two browsers');
});

test('renderReport opens with the run table and the trigger', () => {
  const text = render();
  assert.ok(text.startsWith('## Export visitor stats\n\n| Run | Detail |\n| --- | --- |\n| Trigger | manual run by neal (days = 3) |\n'));
  assert.ok(text.includes('| Window | 2026-10-16 to 2026-10-18 (3 days, America/New_York), parsed from 2026-10-16 03:30 UTC |'));
  assert.ok(text.includes('| Log bucket | `mvcprogrammer-cf-logs-000000000000` |'));
  assert.ok(text.includes('| Finished | 2026-10-18 15:00 UTC |'));
  assert.ok(text.includes('| Commit | `b445345` |'), 'the commit is shortened');
  assert.ok(text.includes('| Node | v24.0.0 |'));
});

test('renderReport tallies the log files per prefix with a total row', () => {
  const text = render();
  assert.ok(text.includes('| `cf/` | 2 | 4.0 KB | 35 | 2 | 0 | 0 | 33 |'));
  assert.ok(text.includes('| **Total** | 2 | 4.0 KB | 35 | 2 | 0 | 0 | 33 |'));
});

test('renderReport shows how the rows were classified and what each day file holds', () => {
  const text = render();
  assert.ok(text.includes('| Rows in window | Owner (excluded) | Bot browsers | Real browsers | Sessions | Visits |\n| ---: | ---: | ---: | ---: | ---: | ---: |\n| 33 | 2 | 3 | 28 | 7 | 5 |'));
  assert.ok(text.includes('Scanner requests are those from a bot browser string or answered with a 4xx'));
  assert.ok(text.includes('| `2026-10-17` | 28 | 4 | 10 | 1 | 4 | 2 | 1.5 KB |'));
  assert.ok(text.includes('Days in the window with no log lines (no file written): `2026-10-18`.'));
  assert.ok(text.includes('The index lists 3 days, `2026-10-15` to `2026-10-17`.'));
});

test('renderReport reads the uploads off the sync output and names the invalidation', () => {
  const text = render();
  assert.ok(text.includes('Uploaded 2 files: `days/2026-10-17.json`, `index.json`.'));
  assert.ok(text.includes('3 files in the output folder, 1 already up to date.'));
  assert.ok(text.includes('Invalidation `I2EXAMPLE` created at 2026-10-18 15:00 UTC for `/data/*`, status InProgress.'));
});

test('renderReport says so when nothing changed, nothing was synced, or nothing was invalidated', () => {
  const unchanged = render({ syncLog: '', invalidation: null });
  assert.ok(unchanged.includes('Every file in the bucket was already up to date; nothing was uploaded.'));
  assert.ok(unchanged.includes('No invalidation was created.'));
  const dryRun = render({ syncLog: null, syncOutcome: 'skipped', invalidation: null, invalidationOutcome: 'skipped', outFiles: null });
  assert.ok(dryRun.includes('Nothing was uploaded: the sync step did not run'));
  assert.ok(!dryRun.includes('Invalidation'), 'the dry-run line stands alone');
  const laptop = render({ syncLog: null, syncOutcome: undefined, invalidation: null, invalidationOutcome: undefined, outFiles: null });
  assert.ok(laptop.includes('Nothing was uploaded: the sync step did not run'), 'without outcomes the files decide');
});

test('renderReport reports a failed sync or invalidation step even though aws left a file behind', () => {
  const emptySync = render({ syncLog: '', syncOutcome: 'failure', invalidation: null, invalidationOutcome: 'skipped' });
  assert.ok(emptySync.includes('**The sync step ended with failure**; see the log.'));
  assert.ok(!emptySync.includes('already up to date; nothing was uploaded'), 'an empty log after a failure is not a quiet success');
  assert.ok(emptySync.includes('The invalidation step did not run.'));
  assert.ok(!emptySync.includes('already up to date.'), 'no up-to-date count after a failure');
  const partial = render({ syncLog: 'upload: out/index.json to s3://x/stats/data/index.json\n', syncOutcome: 'failure', invalidation: {}, invalidationOutcome: 'failure' });
  assert.ok(partial.includes('**The sync step ended with failure**; see the log. Uploaded before it stopped: `index.json`.'));
  assert.ok(partial.includes('**The invalidation step ended with failure**; see the log.'));
});

test('renderReport strips the synced folder from the uploaded paths whatever it is called', () => {
  const log = 'upload: stats/public/data/days/2026-10-17.json to s3://x/stats/data/days/2026-10-17.json\n';
  assert.ok(render({ syncLog: log, outDir: 'stats/public/data/' }).includes('Uploaded 1 file: `days/2026-10-17.json`.'));
  assert.ok(render({ syncLog: log, outDir: undefined }).includes('Uploaded 1 file: `stats/public/data/days/2026-10-17.json`.'));
});

test('renderReport lists every stage with its seconds', () => {
  const text = render();
  assert.ok(text.includes('| Sync `cf/` | 3.2 |'));
  assert.ok(text.includes('| Parse (all prefixes) | 0.0 |'));
  assert.ok(text.includes('| Sessions, visits, and day files | 0.1 |'));
  assert.ok(text.includes('| **Exporter total** | 3.4 |'));
});

test('renderReport explains a run whose export did not finish, or left a report it cannot read', () => {
  const text = render({ report: null, reportProblem: 'missing', syncLog: null, invalidation: null, outFiles: null });
  assert.ok(text.includes('| Trigger | manual run by neal (days = 3) |'));
  assert.ok(text.includes('**The export did not finish**'));
  assert.ok(!text.includes('### Log files read'), 'no tables without a report');
  const broken = render({ report: null, reportProblem: 'unreadable', syncLog: null, invalidation: null, outFiles: null });
  assert.ok(broken.includes('**The export left a report that is not valid JSON**'));
  assert.ok(render({ trigger: '' }).includes('| Trigger | not recorded |'), 'an empty trigger from the workflow reads as not recorded');
});

test('renderReport ends with one newline and never a row of the log', () => {
  const text = render();
  assert.ok(text.endsWith('|\n') && !text.endsWith('\n\n'));
  assert.ok(!text.includes('203.0.113'));
  assert.ok(!text.includes('Mozilla'));
});
