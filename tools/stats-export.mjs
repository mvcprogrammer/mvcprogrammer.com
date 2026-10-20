#!/usr/bin/env node
// mvcprogrammer.com — tools/stats-export.mjs
// Writes the day files the visitor dashboard (stats/) reads: one JSON file per calendar day in the
// site's time zone under <out>/days/YYYY-MM-DD.json, plus <out>/index.json listing the days that
// exist. A day file holds the day's request totals and one small record per visit: a salted visitor
// token, the local hour, the editions loaded, the referrer host, the country of the serving edge,
// and what the beacon reported (screen, color scheme, sections reached, seconds visible, links
// clicked), plus Experience API and resume activity. The dashboard filters and sums these in the
// browser, so no server is involved and no IP address or browser string leaves the logs; beacon and
// query values are reduced to the vocabulary the page sends, so a hand-made request cannot plant text.
// The parsing and the definition of a visit are shared with tools/cf-stats.mjs through
// tools/lib/cf-logs.mjs.
//
//   node tools/stats-export.mjs                              # rebuild the last 3 days into stats/public/data
//   node tools/stats-export.mjs --days 365 --out /tmp/stats  # a year, somewhere else
//   STATS_VISITOR_SALT=... node tools/stats-export.mjs       # the salt that makes visitor tokens stable across runs
//   node tools/stats-export.mjs --allow-local-salt            # a laptop run with the fixed salt "local"
//   node tools/stats-export.mjs --report report.json          # also write an account of the run (see stats-report.mjs)
//
// Shares --days, --bucket, --prefix, --exclude-ip, and --no-sync with cf-stats.mjs. The salt comes
// from --salt or STATS_VISITOR_SALT and is required: a known salt would make the tokens guessable
// from an IP address and browser string, so a laptop run without one must say --allow-local-salt.
// Every run rebuilds the whole window, because CloudFront can deliver a log file hours after the
// requests in it. The index merges the days an earlier run listed with the files already on disk
// under <out>/days/, so a run never forgets a day it did not rebuild. --report writes a JSON
// account of the run (files and lines read per prefix, how the rows were classified, the totals of
// every day written, and the seconds each stage took) that tools/stats-report.mjs renders for the
// workflow's job summary; it holds counts and day keys only, never a row.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  EDITION_ORDER,
  SECTION_ORDER,
  SESSION_GAP_MINUTES,
  TIME_ZONE,
  buildSessions,
  classifyRows,
  dayKey,
  dayKeysBetween,
  editionOf,
  headerComment,
  hourOf,
  isVisit,
  loadRows,
  parseCommonArgs,
  resolveBucket,
  run,
  seconds,
  windowSince,
} from './lib/cf-logs.mjs';
import { countryOfEdge } from './lib/edge-locations.mjs';

/** Bumped whenever a day file's shape changes in a way the dashboard must know about. */
export const SCHEMA_VERSION = 1;

/** The beacon values the page can send; anything else came from a hand-made request and is reduced to "?" or dropped. */
const SCREENS = new Set(['phone', 'tablet', 'desktop']);
const SCHEMES = new Set(['light', 'dark']);
const CLICK_KINDS = new Set(['edition', 'github', 'social']);

/** A leave ping larger than a day is a forged or broken value. */
const MAX_SECONDS = 86_400;

/** A click target, place, or skill as the page sends it: a short token of plain characters, else "?". */
function clean(value) {
  const text = String(value ?? '').slice(0, 40);
  return /^[A-Za-z0-9 .+#_-]+$/.test(text) ? text : '?';
}

/** Where the dashboard's dev server reads the data from. */
const DEFAULT_OUT = 'stats/public/data';

// Run only as a script; the tests import the builders below without triggering a run.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(main);
}

function main() {
  const options = parseCommonArgs(process.argv.slice(2), {
    days: 3,
    help: () => console.log(headerComment(import.meta.url)),
    extra: (arg, next, parsed) => {
      if (arg === '--out') {
        parsed.out = next();
        return true;
      }
      if (arg === '--salt') {
        parsed.salt = next();
        return true;
      }
      if (arg === '--allow-local-salt') {
        parsed.allowLocalSalt = true;
        return true;
      }
      if (arg === '--report') {
        parsed.report = next();
        return true;
      }
      return false;
    },
  });
  const out = options.out ?? DEFAULT_OUT;
  const salt = options.salt ?? process.env.STATS_VISITOR_SALT ?? null;
  if (salt === null && !options.allowLocalSalt) {
    throw new Error('No visitor salt: set STATS_VISITOR_SALT or pass --salt. A fixed salt would make the tokens guessable, so a laptop run must say --allow-local-salt.');
  }

  const started = performance.now();
  const now = new Date();
  const since = windowSince(options.days, now);
  // Parse from one session gap before the window, so a visit that began before midnight and ran into
  // the first day is seen whole and stays on the day it started; only visits that started inside the
  // window are written, and the request totals count the window's rows alone.
  const margin = new Date(since.getTime() - SESSION_GAP_MINUTES * 60_000);
  const prefixes = [];
  const allRows = classifyRows(loadRows(options, margin, prefixes), options.excludeIps);
  const rows = allRows.filter((row) => !row.own);
  const firstDay = dayKey(since);
  const sessions = buildSessions(rows.filter((row) => !row.bot)).filter((session) => session.day >= firstDay);
  const visits = sessions.filter(isVisit);
  const days = dayKeysBetween(firstDay, dayKey(now));
  const loaded = seconds(started);

  // A day with no log lines at all (before logging started, or past the bucket's retention) gets no
  // file, so the dashboard shows it as missing rather than as a day nobody visited.
  const written = days.filter((day) => rows.some((row) => row.day === day));
  mkdirSync(join(out, 'days'), { recursive: true });
  const files = [];
  for (const day of written) {
    const file = buildDayFile(day, rows.filter((row) => row.day === day), visits.filter((visit) => visit.day === day), salt ?? 'local');
    const text = stableJson(file);
    writeFileSync(join(out, 'days', `${day}.json`), text);
    files.push(dayTotals(file, rows.filter((row) => row.day === day), Buffer.byteLength(text)));
  }
  const onDisk = readdirSync(join(out, 'days')).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map((name) => name.slice(0, 10));
  const index = buildIndex(readIndex(join(out, 'index.json')), [...onDisk, ...written], now);
  writeFileSync(join(out, 'index.json'), stableJson(index));
  const span = written.length === 0 ? 'none' : `${written[0]} to ${written[written.length - 1]}`;
  console.log(`Wrote ${written.length} day files (${span}) and index.json to ${out}; ${visits.length} visits in ${rows.length} requests; ${days.length - written.length} days in the window had no log lines.`);

  if (options.report !== undefined) {
    const report = buildReport({
      now,
      days: options.days,
      since,
      margin,
      bucket: resolveBucket(options),
      prefixes,
      rows: { total: allRows.length, own: allRows.length - rows.length, scanners: rows.filter((row) => row.bot).length, sessions: sessions.length, visits: visits.length },
      files,
      missingDays: days.filter((day) => !written.includes(day)),
      index,
      timing: { load: loaded, build: seconds(started) - loaded, total: seconds(started) },
    });
    writeFileSync(options.report, stableJson(report));
  }
}

/** What a run read, kept, and wrote, in counts and day keys only (no row ever lands in the report), for tools/stats-report.mjs. */
export function buildReport({ now, days, since, margin, bucket, prefixes, rows, files, missingDays, index, timing }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    timeZone: TIME_ZONE,
    window: { days, firstDay: dayKey(since), lastDay: dayKey(now), since: since.toISOString(), parsedFrom: margin.toISOString() },
    bucket,
    prefixes,
    rows,
    files,
    missingDays,
    index: { days: index.days.length, firstDay: index.days[0] ?? null, lastDay: index.days[index.days.length - 1] ?? null },
    timing,
  };
}

/** The figures of one day file for the report: the totals it carries, the beacon and API rows behind it, and its size. */
export function dayTotals(file, rows, bytes) {
  return {
    day: file.day,
    requests: file.requests,
    scannerRequests: file.scannerRequests,
    pings: rows.filter((row) => row.path === '/ping').length,
    apiRequests: rows.filter((row) => row.path.startsWith('/api/')).length,
    visits: file.visits.length,
    visitors: new Set(file.visits.map((visit) => visit.token)).size,
    bytes,
  };
}

/**
 * The day file for one day: the request totals (bots included, the owner excluded) and one record
 * per visit that started on that day, in start order. Records rather than pre-summed counters, so
 * the dashboard can apply any combination of filters exactly, unique visitors inside a segment
 * included, and the files stay small at this site's traffic: about 200 bytes a visit. Pure, so the
 * tests can feed it synthetic rows and compare against a golden file.
 */
export function buildDayFile(day, rows, visits, salt) {
  const records = visits.map((visit) => [visit, visitRecord(visit, salt)]);
  records.sort(([a, ra], [b, rb]) => a.start - b.start || ra.token.localeCompare(rb.token));
  return {
    schemaVersion: SCHEMA_VERSION,
    day,
    timeZone: TIME_ZONE,
    requests: rows.length,
    scannerRequests: rows.filter((row) => row.bot || row.status.startsWith('4')).length,
    visits: records.map(([, record]) => record),
  };
}

/**
 * One visit as the dashboard sees it. Fields the visit has nothing for are left out, so a visit
 * that never ran the script has no screen, scheme, sections, or seconds, and a direct visit has no
 * referrer. Nothing here identifies a person: the token is a salted hash of the IP and browser
 * string, and the country comes from the CloudFront edge that served the visit, not from the IP.
 */
export function visitRecord(visit, salt) {
  const record = {
    token: token(visit.visitor, salt),
    hour: hourOf(visit.start),
    editions: editionsOf(visit),
    country: countryOfEdge(visit.pop),
    edge: visit.pop,
  };
  if (visit.referrer !== '') {
    record.referrer = visit.referrer;
  }
  if (visit.loads > 0) {
    record.loads = visit.loads;
    record.screen = SCREENS.has(visit.viewport) ? visit.viewport : '?';
    record.scheme = SCHEMES.has(visit.scheme) ? visit.scheme : '?';
  }
  const sections = SECTION_ORDER.filter((id) => visit.viewed.has(id));
  if (sections.length > 0) {
    record.sections = sections;
  }
  if (visit.secondsVisible !== null) {
    record.seconds = Math.min(Math.max(0, visit.secondsVisible), MAX_SECONDS);
  }
  const clicks = visit.clicks.filter((click) => CLICK_KINDS.has(click.kind)).map((click) => `${click.kind}/${clean(click.target)}/${clean(click.from)}`);
  if (clicks.length > 0) {
    record.clicks = clicks;
  }
  if (visit.api > 0) {
    record.apiCalls = visit.api;
  }
  const skills = visit.skillClicks.map(clean).filter((skill) => skill !== '?');
  if (skills.length > 0) {
    record.skills = skills;
  }
  if (visit.resumeDownloads.length > 0) {
    record.resumes = [...visit.resumeDownloads];
  }
  return record;
}

/** The index: the days that have a file, merged with the days an earlier run wrote, and when this run happened. */
export function buildIndex(existing, days, now) {
  const known = existing !== null && existing.schemaVersion === SCHEMA_VERSION ? existing.days : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    timeZone: TIME_ZONE,
    days: distinct([...known, ...days]),
  };
}

function readIndex(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** A visitor's token: a salted SHA-256 of the IP and browser string, cut to 10 hex digits. Enough to count uniques, useless to identify anyone. */
export function token(visitor, salt) {
  return createHash('sha256').update(`${salt}\n${visitor}`).digest('hex').slice(0, 10);
}

/** The editions a visit loaded a page on, in display order; a visit that moved between editions counts in each. */
function editionsOf(visit) {
  const editions = [...visit.hosts].map(editionOf);
  return [...EDITION_ORDER.filter((edition) => editions.includes(edition)), ...editions.filter((edition) => !EDITION_ORDER.includes(edition)).sort()];
}

function distinct(values) {
  return [...new Set(values)].sort();
}

/** Two-space JSON with a trailing newline; key order is fixed by the builders above, so a rerun writes the same bytes. */
export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
