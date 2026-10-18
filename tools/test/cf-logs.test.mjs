// mvcprogrammer.com — tools/test/cf-logs.test.mjs
// Tests for the shared log library: parsing, scanner and owner classification, session building,
// the visit rule, the command line, and the calendar math in the site's time zone.
//
//   node --test tools/test/
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  addDays,
  buildSessions,
  classifyRows,
  dayKey,
  dayKeysBetween,
  editionOf,
  hourOf,
  isVisit,
  parseCommonArgs,
  parseLogText,
  readLogs,
  selectVisits,
  startOfDayKey,
  windowSince,
} from '../lib/cf-logs.mjs';
import { CHROME, IPHONE, OWN_IP, ROWS, sampleLogText } from './fixtures/sample-log.mjs';

const EPOCH = new Date(0);

function parsedRows(since = EPOCH) {
  return classifyRows(parseLogText(sampleLogText(), since), [OWN_IP]);
}

// ---------------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------------

test('parseLogText reads every data line and decodes the percent-encoded fields', () => {
  const rows = parseLogText(sampleLogText(), EPOCH);
  assert.equal(rows.length, ROWS.length);
  const first = rows.find((row) => row.referrer === 'https://www.linkedin.com/');
  assert.equal(first.ua, CHROME, 'user agent is decoded');
  assert.equal(first.host, 'mvcprogrammer.com', 'the host header, not the CloudFront domain');
  assert.equal(first.pop, 'IAD', 'the edge code is the first three letters');
  assert.equal(first.at.toISOString(), '2026-10-17T14:00:00.000Z');
  assert.equal(first.day, '2026-10-17');
});

test('parseLogText drops lines before the window and ignores comments', () => {
  const rows = parseLogText(sampleLogText(), new Date('2026-10-17T04:00:00Z'));
  assert.equal(rows.length, ROWS.length - 2, 'the two rows from 2026-10-16 are gone');
  assert.ok(rows.every((row) => row.at >= new Date('2026-10-17T04:00:00Z')));
  assert.equal(rows.filter((row) => row.day === '2026-10-18').length, 1, 'only the view ping after local midnight falls on the 18th');
});

test('parseLogText tolerates a missing field by filling in a dash', () => {
  const rows = parseLogText('#Fields: date time c-ip\n2026-10-17\t14:00:00\t203.0.113.10\n', EPOCH);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ua, '-');
  assert.equal(rows[0].host, '-');
});

test('readLogs gunzips every .gz file in a folder and skips a folder that does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cf-logs-'));
  writeFileSync(join(dir, 'E1.2026-10-17-14.abc.gz'), gzipSync(sampleLogText()));
  writeFileSync(join(dir, 'notes.txt'), 'ignored');
  assert.equal(readLogs(dir, EPOCH).length, ROWS.length);
  assert.deepEqual(readLogs(join(dir, 'missing'), EPOCH), []);
});

// ---------------------------------------------------------------------------------------------------
// Classification, sessions, visits
// ---------------------------------------------------------------------------------------------------

test('classifyRows marks crawlers, empty user agents, and the owner', () => {
  const rows = parsedRows();
  const bots = rows.filter((row) => row.bot);
  assert.equal(bots.length, 3, 'two Googlebot lines and one empty user agent');
  assert.ok(bots.some((row) => row.ua === '-'));
  assert.equal(rows.filter((row) => row.own).length, 2);
  assert.ok(rows.every((row) => row.visitor === `${row.ip} ${row.ua}`));
});

test('buildSessions splits a visitor at a 30-minute gap and keeps shorter gaps together', () => {
  const sessions = buildSessions(parsedRows().filter((row) => row.ip === '203.0.113.10'));
  assert.equal(sessions.length, 2, 'scenario A and scenario B');
  const [a, b] = sessions;
  assert.equal(a.pages, 2, 'the page on the default edition and the page on the Angular edition');
  assert.deepEqual([...a.hosts], ['mvcprogrammer.com', 'angular.mvcprogrammer.com']);
  assert.equal(a.referrer, 'www.linkedin.com');
  assert.equal(a.loads, 1);
  assert.equal(a.viewport, 'desktop');
  assert.equal(a.scheme, 'dark');
  assert.deepEqual([...a.viewed], ['about', 'portfolio']);
  assert.equal(a.api, 1);
  assert.deepEqual(a.skillClicks, ['Angular']);
  assert.deepEqual(a.clicks, [{ kind: 'edition', target: 'angular', from: 'header' }]);
  assert.equal(a.secondsVisible, 75);
  assert.equal(b.pages, 1, 'a 304 on the page still counts as a page view');
  assert.equal(b.referrer, '', 'a return visit with no referrer is direct');
  assert.equal(b.secondsVisible, 5);
});

test('buildSessions keeps a session that crosses local midnight on the day it started', () => {
  const sessions = buildSessions(parsedRows().filter((row) => row.ip === '198.51.100.7'));
  assert.equal(sessions.length, 2, 'scenario C and scenario D, 80 minutes apart');
  const [c, d] = sessions;
  assert.deepEqual(c.resumeDownloads, ['react']);
  assert.deepEqual(c.clicks, [{ kind: 'github', target: 'profile', from: 'about' }]);
  assert.equal(d.day, '2026-10-17');
  assert.equal(d.end.toISOString(), '2026-10-18T04:05:00.000Z', 'the view ping after midnight is still part of it');
  assert.deepEqual([...d.viewed], ['about']);
});

test('isVisit needs a page and at least one asset, API call, or ping', () => {
  const sessions = buildSessions(parsedRows());
  const onlyPage = sessions.find((session) => session.ip === '192.0.2.9');
  assert.equal(isVisit(onlyPage), false, 'scenario H fetched the page and nothing else');
  const probe = sessions.find((session) => session.ip === '192.0.2.5');
  assert.equal(isVisit(probe), false, 'scenario F never loaded a page');
  const phone = sessions.find((session) => session.ua === IPHONE || session.visitor.endsWith(IPHONE));
  assert.equal(isVisit(phone), true);
});

test('selectVisits leaves out bots and the owner and returns the five visits in the fixture', () => {
  const visits = selectVisits(parsedRows());
  assert.equal(visits.length, 5, 'I, A, B, C, D');
  assert.ok(visits.every((visit) => visit.ip !== OWN_IP));
  assert.ok(visits.every((visit) => !visit.visitor.includes('Googlebot')));
  assert.deepEqual(visits.map((visit) => visit.day).sort(), ['2026-10-16', '2026-10-17', '2026-10-17', '2026-10-17', '2026-10-17']);
});

test('editionOf maps the four hosts and passes anything else through', () => {
  assert.equal(editionOf('mvcprogrammer.com'), 'js');
  assert.equal(editionOf('www.mvcprogrammer.com'), 'js');
  assert.equal(editionOf('angular.mvcprogrammer.com'), 'angular');
  assert.equal(editionOf('react.mvcprogrammer.com'), 'react');
  assert.equal(editionOf('blazor.mvcprogrammer.com'), 'blazor');
  assert.equal(editionOf('drm68g34kommd.cloudfront.net'), 'drm68g34kommd.cloudfront.net');
});

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

test('parseCommonArgs applies the defaults and reads every shared argument', () => {
  const options = parseCommonArgs(['--days', '30', '--bucket', 'b', '--prefix', 'cf,/react/', '--exclude-ip', '1.1.1.1, 2.2.2.2', '--no-sync']);
  assert.equal(options.days, 30);
  assert.equal(options.bucket, 'b');
  assert.deepEqual(options.prefixes, ['cf/', 'react/']);
  assert.deepEqual(options.excludeIps.slice(-2), ['1.1.1.1', '2.2.2.2']);
  assert.equal(options.noSync, true);
  assert.equal(parseCommonArgs([], { days: 3 }).days, 3);
});

test('parseCommonArgs hands unknown arguments to the tool first and rejects the rest', () => {
  const options = parseCommonArgs(['--out', 'dir', '--days', '2'], {
    extra: (arg, next, parsed) => {
      if (arg === '--out') {
        parsed.out = next();
        return true;
      }
      return false;
    },
  });
  assert.equal(options.out, 'dir');
  assert.equal(options.days, 2);
  assert.throws(() => parseCommonArgs(['--bogus']), /Unknown argument --bogus/);
  assert.throws(() => parseCommonArgs(['--days']), /--days needs a value/);
  assert.throws(() => parseCommonArgs(['--days', '0']), /positive integer/);
  assert.throws(() => parseCommonArgs(['--prefix', ' , ']), /at least one prefix/);
});

// ---------------------------------------------------------------------------------------------------
// Calendar math
// ---------------------------------------------------------------------------------------------------

test('dayKey and hourOf use the site time zone, not the machine zone', () => {
  assert.equal(dayKey(new Date('2026-10-18T03:50:00Z')), '2026-10-17', 'before 04:00Z it is still the 17th in New York');
  assert.equal(hourOf(new Date('2026-10-18T03:50:00Z')), 23);
  assert.equal(dayKey(new Date('2026-10-18T04:00:00Z')), '2026-10-18');
  assert.equal(hourOf(new Date('2026-10-18T04:00:00Z')), 0);
  assert.equal(hourOf(new Date('2026-01-15T05:00:00Z')), 0, 'standard time is five hours behind');
});

test('startOfDayKey finds local midnight on either side of a daylight saving change', () => {
  assert.equal(startOfDayKey('2026-10-17').toISOString(), '2026-10-17T04:00:00.000Z');
  assert.equal(startOfDayKey('2026-03-08').toISOString(), '2026-03-08T05:00:00.000Z', 'the day the clocks go forward starts in standard time');
  assert.equal(startOfDayKey('2026-03-09').toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(startOfDayKey('2026-11-01').toISOString(), '2026-11-01T04:00:00.000Z', 'the day the clocks go back starts in daylight time');
  assert.equal(startOfDayKey('2026-11-02').toISOString(), '2026-11-02T05:00:00.000Z');
});

test('addDays and dayKeysBetween do calendar arithmetic across month and year ends', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(dayKeysBetween('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(dayKeysBetween('2026-10-18', '2026-10-17'), []);
});

test('windowSince starts days - 1 days before today at local midnight', () => {
  const now = new Date('2026-10-18T15:00:00Z');
  assert.equal(windowSince(1, now).toISOString(), '2026-10-18T04:00:00.000Z');
  assert.equal(windowSince(3, now).toISOString(), '2026-10-16T04:00:00.000Z');
  assert.equal(windowSince(7, new Date('2026-10-18T02:00:00Z')).toISOString(), '2026-10-11T04:00:00.000Z', 'at 22:00 local it is still the 17th');
});
