#!/usr/bin/env node
// mvcprogrammer.com — tools/stats-export.mjs
// Writes the day files the visitor dashboard (stats/) reads: one JSON file per calendar day in the
// site's time zone under <out>/days/YYYY-MM-DD.json, plus <out>/index.json listing the days that
// exist. A day file holds the day's request totals and one small record per visit: a salted visitor
// token, the local hour, the editions loaded, the referrer host, the country of the serving edge,
// and what the beacon reported (screen, color scheme, sections reached, seconds visible, links
// clicked), plus Experience API and resume activity. The dashboard filters and sums these in the
// browser, so no server is involved and no IP address, browser string, or raw path leaves the logs.
// The parsing and the definition of a visit are shared with tools/cf-stats.mjs through
// tools/lib/cf-logs.mjs.
//
//   node tools/stats-export.mjs                              # rebuild the last 3 days into stats/public/data
//   node tools/stats-export.mjs --days 365 --out /tmp/stats  # a year, somewhere else
//   STATS_VISITOR_SALT=... node tools/stats-export.mjs       # the salt that makes visitor tokens stable across runs
//
// Shares --days, --bucket, --prefix, --exclude-ip, and --no-sync with cf-stats.mjs. The salt comes
// from --salt or STATS_VISITOR_SALT; without one the tokens are salted with "local", which is fine on
// a laptop and wrong for the published data. Every run rebuilds the whole window, because CloudFront
// can deliver a log file hours after the requests in it.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  EDITION_ORDER,
  SECTION_ORDER,
  TIME_ZONE,
  classifyRows,
  dayKey,
  dayKeysBetween,
  editionOf,
  headerComment,
  hourOf,
  loadRows,
  parseCommonArgs,
  run,
  selectVisits,
  windowSince,
} from './lib/cf-logs.mjs';
import { countryOfEdge } from './lib/edge-locations.mjs';

/** Bumped whenever a day file's shape changes in a way the dashboard must know about. */
export const SCHEMA_VERSION = 1;

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
      return false;
    },
  });
  const out = options.out ?? DEFAULT_OUT;
  const salt = options.salt ?? process.env.STATS_VISITOR_SALT ?? null;
  if (salt === null) {
    process.stderr.write('No STATS_VISITOR_SALT; visitor tokens are salted with "local".\n');
  }

  const now = new Date();
  const since = windowSince(options.days, now);
  const rows = classifyRows(loadRows(options, since), options.excludeIps).filter((row) => !row.own);
  const visits = selectVisits(rows);
  const days = dayKeysBetween(dayKey(since), dayKey(now));

  mkdirSync(join(out, 'days'), { recursive: true });
  for (const day of days) {
    const file = buildDayFile(day, rows.filter((row) => row.day === day), visits.filter((visit) => visit.day === day), salt ?? 'local');
    writeFileSync(join(out, 'days', `${day}.json`), stableJson(file));
  }
  const index = buildIndex(readIndex(join(out, 'index.json')), days, now);
  writeFileSync(join(out, 'index.json'), stableJson(index));
  console.log(`Wrote ${days.length} day files (${days[0]} to ${days[days.length - 1]}) and index.json to ${out}; ${visits.length} visits in ${rows.length} requests.`);
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
    record.screen = visit.viewport ?? '?';
    record.scheme = visit.scheme ?? '?';
  }
  if (visit.viewed.size > 0) {
    record.sections = [...SECTION_ORDER.filter((id) => visit.viewed.has(id)), ...[...visit.viewed].filter((id) => !SECTION_ORDER.includes(id)).sort()];
  }
  if (visit.secondsVisible !== null) {
    record.seconds = visit.secondsVisible;
  }
  if (visit.clicks.length > 0) {
    record.clicks = visit.clicks.map((click) => `${click.kind}/${click.target}/${click.from}`);
  }
  if (visit.api > 0) {
    record.apiCalls = visit.api;
  }
  if (visit.skillClicks.length > 0) {
    record.skills = [...visit.skillClicks];
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
