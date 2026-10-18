// mvcprogrammer.com — tools/test/stats-export.test.mjs
// Tests for the day-file exporter: the visit records, the totals, the visitor tokens, the index,
// and a golden day file built from the fixture log. UPDATE_GOLDEN=1 rewrites the golden file when
// the schema changes on purpose (and SCHEMA_VERSION goes up with it).
//
//   node --test 'tools/test/*.test.mjs'
//   UPDATE_GOLDEN=1 node --test tools/test/stats-export.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';

import { classifyRows, parseLogText, selectVisits } from '../lib/cf-logs.mjs';
import { SCHEMA_VERSION, buildDayFile, buildIndex, stableJson, token, visitRecord } from '../stats-export.mjs';
import { OWN_IP, sampleLogText } from './fixtures/sample-log.mjs';

const GOLDEN = new URL('./fixtures/golden/2026-10-17.json', import.meta.url);
const DAY = '2026-10-17';
const SALT = 'test';

/** The exporter's inputs for the fixture day: the owner's rows dropped, bots kept, visits that started that day. */
function fixtureDay() {
  const rows = classifyRows(parseLogText(sampleLogText(), new Date(0)), [OWN_IP]).filter((row) => !row.own);
  const visits = selectVisits(rows);
  return { rows: rows.filter((row) => row.day === DAY), visits: visits.filter((visit) => visit.day === DAY) };
}

test('buildDayFile matches the golden file byte for byte', () => {
  const { rows, visits } = fixtureDay();
  const actual = stableJson(buildDayFile(DAY, rows, visits, SALT));
  if (process.env.UPDATE_GOLDEN) {
    writeFileSync(GOLDEN, actual);
  }
  assert.equal(actual, readFileSync(GOLDEN, 'utf8'));
});

test('buildDayFile is deterministic whatever order the inputs arrive in', () => {
  const { rows, visits } = fixtureDay();
  assert.equal(stableJson(buildDayFile(DAY, rows, visits, SALT)), stableJson(buildDayFile(DAY, [...rows].reverse(), [...visits].reverse(), SALT)));
});

test('buildDayFile carries the schema, the day, the zone, and the request totals', () => {
  const { rows, visits } = fixtureDay();
  const file = buildDayFile(DAY, rows, visits, SALT);
  assert.equal(file.schemaVersion, SCHEMA_VERSION);
  assert.equal(file.day, DAY);
  assert.equal(file.timeZone, 'America/New_York');
  assert.equal(file.requests, rows.length);
  assert.equal(file.scannerRequests, 4, 'two Googlebot lines, one empty user agent, one 404');
  assert.deepEqual(Object.keys(file), ['schemaVersion', 'day', 'timeZone', 'requests', 'scannerRequests', 'visits']);
});

test('buildDayFile lists one record per visit in start order', () => {
  const { rows, visits } = fixtureDay();
  const file = buildDayFile(DAY, rows, visits, SALT);
  assert.equal(file.visits.length, 4, 'A, B, C, D');
  assert.deepEqual(file.visits.map((visit) => visit.hour), [10, 10, 22, 23]);
  assert.equal(new Set(file.visits.map((visit) => visit.token)).size, 2, 'two browsers');
  assert.equal(file.visits[0].token, file.visits[1].token, 'A and B are the same browser');
  assert.equal(file.visits[2].token, file.visits[3].token, 'C and D are the same browser');
});

test('visitRecord describes scenario A in full', () => {
  const { visits } = fixtureDay();
  const [a] = visits.sort((x, y) => x.start - y.start);
  assert.deepEqual(visitRecord(a, SALT), {
    token: token(a.visitor, SALT),
    hour: 10,
    editions: ['js', 'angular'],
    country: 'US',
    edge: 'IAD',
    referrer: 'www.linkedin.com',
    loads: 1,
    screen: 'desktop',
    scheme: 'dark',
    sections: ['about', 'portfolio'],
    seconds: 75,
    clicks: ['edition/angular/header'],
    apiCalls: 1,
    skills: ['Angular'],
  });
});

test('visitRecord leaves out what a visit did not do', () => {
  const { visits } = fixtureDay();
  const sorted = visits.sort((x, y) => x.start - y.start);
  const b = visitRecord(sorted[1], SALT);
  assert.equal(b.referrer, undefined, 'a return visit with no referrer is direct');
  assert.equal(b.sections, undefined);
  assert.equal(b.clicks, undefined);
  assert.equal(b.seconds, 5);
  const c = visitRecord(sorted[2], SALT);
  assert.deepEqual(c.editions, ['react']);
  assert.deepEqual(c.resumes, ['react']);
  assert.deepEqual(c.clicks, ['github/profile/about']);
  assert.equal(c.screen, 'phone');
  assert.equal(c.country, 'DE');
  const d = visitRecord(sorted[3], SALT);
  assert.equal(d.loads, undefined, 'D never sent a load ping');
  assert.equal(d.screen, undefined);
  assert.deepEqual(d.sections, ['about'], 'but it did reach a section');
});

test('visitRecord never includes an IP address or browser string', () => {
  const { visits } = fixtureDay();
  for (const visit of visits) {
    const text = JSON.stringify(visitRecord(visit, SALT));
    assert.ok(!text.includes(visit.ip), 'no IP');
    assert.ok(!text.includes('Mozilla'), 'no user agent');
  }
});

test('token is a 10-digit salted hash that changes with the salt', () => {
  const a = token('203.0.113.10 Mozilla/5.0', 'one');
  assert.match(a, /^[0-9a-f]{10}$/);
  assert.equal(a, token('203.0.113.10 Mozilla/5.0', 'one'), 'stable for the same salt');
  assert.notEqual(a, token('203.0.113.10 Mozilla/5.0', 'two'));
  assert.notEqual(a, token('203.0.113.11 Mozilla/5.0', 'one'));
});

test('buildIndex merges the days an earlier run wrote and stamps the time', () => {
  const now = new Date('2026-10-18T15:00:00Z');
  const fresh = buildIndex(null, ['2026-10-17', '2026-10-18'], now);
  assert.deepEqual(fresh, { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-10-18T15:00:00.000Z', timeZone: 'America/New_York', days: ['2026-10-17', '2026-10-18'] });
  const merged = buildIndex({ schemaVersion: SCHEMA_VERSION, days: ['2026-10-15', '2026-10-16', '2026-10-17'] }, ['2026-10-17', '2026-10-18'], now);
  assert.deepEqual(merged.days, ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  const stale = buildIndex({ schemaVersion: SCHEMA_VERSION + 1, days: ['2000-01-01'] }, ['2026-10-18'], now);
  assert.deepEqual(stale.days, ['2026-10-18'], 'days from another schema are not carried over');
});

test('stableJson is two-space JSON with one trailing newline', () => {
  assert.equal(stableJson({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n');
});
