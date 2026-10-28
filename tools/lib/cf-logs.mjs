// mvcprogrammer.com — tools/lib/cf-logs.mjs
// Everything the two log tools share: downloading the CloudFront access logs with the AWS CLI,
// parsing the gzipped W3C lines, telling scanners from browsers, grouping a browser's requests into
// sessions, and the calendar math that cuts days in the site's time zone. tools/cf-stats.mjs prints
// a text report from these pieces and tools/stats-export.mjs writes the day files the dashboard
// reads, so a visit, a visitor, or a beacon event means the same thing in both. No dependencies
// beyond Node 22+.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** The zone days are cut on: the site's owner reads the report in Tampa Bay, and the dashboard labels agree with it. */
export const TIME_ZONE = 'America/New_York';

/** Log prefixes in the bucket, one per distribution: the main site, then the three framework editions. */
export const DEFAULT_PREFIXES = ['cf/', 'blazor/', 'angular/', 'react/'];

/** A visitor that sends no further request within this many minutes has left. */
export const SESSION_GAP_MINUTES = 30;

/** Browser strings of crawlers, scanners, and tools; the same list the resume Lambda uses, plus the ones seen in the logs. */
export const BOT_PATTERN =
  /bot|crawl|spider|preview|facebookexternalhit|slack|linkedinbot|whatsapp|telegram|discord|skype|twitterbot|headless|curl|wget|python|go-http|java\/|scrapy|okhttp|libwww|httpclient|zgrab|censys|nmap|masscan|gort|dataprovider|semrush|ahrefs|mj12|petalbot|bytespider|yandex|baidu|duckduck|applebot|bingbot|googlebot|gptbot|claudebot|anthropic|openai|perplexity|ccbot|amazonbot|axios|node-fetch|https?:\/\//i;

/** The page's sections in reading order, for the reach table. */
export const SECTION_ORDER = ['about', 'services', 'portfolio', 'resume', 'contact', 'colophon'];

/** Edition ids in display order, and the host each one is served from. */
export const EDITION_ORDER = ['js', 'angular', 'react', 'blazor'];
const EDITION_BY_HOST = new Map([
  ['mvcprogrammer.com', 'js'],
  ['www.mvcprogrammer.com', 'js'],
  ['angular.mvcprogrammer.com', 'angular'],
  ['react.mvcprogrammer.com', 'react'],
  ['blazor.mvcprogrammer.com', 'blazor'],
]);

/** The edition id for a host header, or the host itself when it is not one of the four. */
export function editionOf(host) {
  return EDITION_BY_HOST.get(host) ?? host;
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

/**
 * Parses the arguments both tools accept: --days N, --bucket B, --prefix P[,P], --exclude-ip a,b,
 * --no-sync, and --help. `extra(arg, next)` gets every other argument first and returns true when
 * it took it; `next()` consumes the argument's value. Throws on a bad or unknown argument.
 */
export function parseCommonArgs(argv, { days = 7, extra = () => false, help = () => {} } = {}) {
  const options = {
    days,
    bucket: undefined,
    prefixes: DEFAULT_PREFIXES,
    excludeIps: (process.env.CF_STATS_EXCLUDE_IPS ?? '').split(',').map((ip) => ip.trim()).filter(Boolean),
    noSync: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`${arg} needs a value`);
      }
      return argv[++i];
    };
    if (extra(arg, next, options)) {
      continue;
    }
    switch (arg) {
      case '--days':
        options.days = Number.parseInt(next(), 10);
        if (!Number.isInteger(options.days) || options.days < 1) {
          throw new Error('--days must be a positive integer');
        }
        break;
      case '--bucket':
        options.bucket = next();
        break;
      case '--prefix':
        options.prefixes = next()
          .split(',')
          .map((prefix) => prefix.trim().replace(/^\/+/, ''))
          .filter(Boolean)
          .map((prefix) => (prefix.endsWith('/') ? prefix : `${prefix}/`));
        if (options.prefixes.length === 0) {
          throw new Error('--prefix needs at least one prefix');
        }
        break;
      case '--exclude-ip':
        options.excludeIps.push(...next().split(',').map((ip) => ip.trim()).filter(Boolean));
        break;
      case '--no-sync':
        options.noSync = true;
        break;
      case '--help':
      case '-h':
        help();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }
  return options;
}

/** The leading comment block of a tool, for --help. */
export function headerComment(moduleUrl) {
  return readFileSync(new URL(moduleUrl))
    .toString()
    .split('\n')
    .filter((line) => line.startsWith('//'))
    .map((line) => line.slice(3))
    .join('\n');
}

/** Runs a tool's main function, printing an Error's message and exiting 1 instead of a stack trace. */
export function run(main) {
  try {
    main();
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    console.error(error.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------------
// Downloading and parsing
// ---------------------------------------------------------------------------------------------------

/** The AWS account id of the current credentials, for the default bucket name. */
export function accountId() {
  try {
    return execFileSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Could not read the AWS account id; pass --bucket or set CF_LOG_BUCKET.');
  }
}

/** --bucket, else CF_LOG_BUCKET, else mvcprogrammer-cf-logs-<account id>. */
export function resolveBucket(options) {
  return options.bucket ?? process.env.CF_LOG_BUCKET ?? `mvcprogrammer-cf-logs-${accountId()}`;
}

/** Where a prefix's files are cached: ~/.cache/mvcprogrammer-cf-stats/<bucket>/<prefix>. */
export function cacheDirFor(bucket, prefix) {
  return join(homedir(), '.cache', 'mvcprogrammer-cf-stats', bucket, prefix.replace(/\/+$/, ''));
}

/** Fetches only the files for the days in the window (names carry the UTC day: <dist>.YYYY-MM-DD-HH.<hash>.gz). A prefix with no files yet is fine. */
export function syncLogs(bucket, prefix, cacheDir, since) {
  mkdirSync(cacheDir, { recursive: true });
  const includes = [];
  // Local days spill into neighbouring UTC days, so take one day of margin on each side.
  for (let day = new Date(since.getTime() - 86_400_000); day <= new Date(Date.now() + 86_400_000); day.setDate(day.getDate() + 1)) {
    includes.push('--include', `*.${day.toISOString().slice(0, 10)}-*`);
  }
  const args = ['s3', 'sync', `s3://${bucket}/${prefix}`, cacheDir, '--exclude', '*', ...includes, '--no-progress'];
  process.stderr.write(`Syncing s3://${bucket}/${prefix} into ${cacheDir} ...\n`);
  try {
    execFileSync('aws', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    throw new Error('aws s3 sync failed; check your AWS credentials or pass --no-sync to use the cached files.');
  }
}

/**
 * Syncs (unless told not to) and parses every prefix, returning the rows in the window sorted by
 * time. When `trace` is an array, one `newLogCounters()` record per prefix is pushed onto it, with
 * the prefix name and the seconds the sync and the parse took, so a run can report what it read.
 */
export function loadRows(options, since, trace = null) {
  const bucket = resolveBucket(options);
  const rows = [];
  for (const prefix of options.prefixes) {
    const cacheDir = cacheDirFor(bucket, prefix);
    const counters = newLogCounters();
    counters.prefix = prefix;
    const syncStarted = performance.now();
    if (!options.noSync) {
      syncLogs(bucket, prefix, cacheDir, since);
    }
    counters.syncSeconds = seconds(syncStarted);
    const parseStarted = performance.now();
    rows.push(...readLogs(cacheDir, since, counters));
    counters.parseSeconds = seconds(parseStarted);
    trace?.push(counters);
  }
  rows.sort((a, b) => a.at - b.at);
  return rows;
}

/** Elapsed seconds since a `performance.now()` mark, to the millisecond. */
export function seconds(since) {
  return Math.round(performance.now() - since) / 1000;
}

/**
 * A fresh tally of what `readLogs` and `parseLogText` saw: files and compressed bytes read, every
 * non-empty line, and how each line was handled. `comments` are the `#Version` and `#Fields` lines,
 * `orphans` are data lines before any `#Fields` header (never seen in a real file), `beforeWindow`
 * are data lines older than the window, and `rows` are the lines that became rows.
 */
export function newLogCounters() {
  return { files: 0, bytes: 0, lines: 0, comments: 0, orphans: 0, beforeWindow: 0, rows: 0 };
}

/** Parses every cached file whose lines fall inside the window into plain objects, tallying into `counters` when given. */
export function readLogs(cacheDir, since, counters = null) {
  if (!existsSync(cacheDir)) {
    return [];
  }
  const rows = [];
  for (const name of readdirSync(cacheDir).filter((file) => file.endsWith('.gz')).sort()) {
    const compressed = readFileSync(join(cacheDir, name));
    if (counters !== null) {
      counters.files++;
      counters.bytes += compressed.length;
    }
    rows.push(...parseLogText(gunzipSync(compressed).toString('utf8'), since, counters));
  }
  return rows;
}

/** Parses the text of one W3C log file, keeping the lines at or after `since`, tallying into `counters` when given. */
export function parseLogText(text, since, counters = null) {
  const tally = counters ?? newLogCounters();
  const rows = [];
  let fields = null;
  for (const line of text.split('\n')) {
    if (line === '') {
      continue;
    }
    tally.lines++;
    if (line.startsWith('#Fields:')) {
      fields = line.slice('#Fields:'.length).trim().split(/\s+/);
      tally.comments++;
      continue;
    }
    if (line.startsWith('#')) {
      tally.comments++;
      continue;
    }
    if (fields === null) {
      tally.orphans++;
      continue;
    }

    const values = line.split('\t');
    const get = (field) => values[fields.indexOf(field)] ?? '-';
    const at = new Date(`${get('date')}T${get('time')}Z`);
    if (at < since) {
      tally.beforeWindow++;
      continue;
    }
    tally.rows++;

    rows.push({
      at,
      day: dayKey(at),
      pop: get('x-edge-location').slice(0, 3),
      ip: get('c-ip'),
      method: get('cs-method'),
      host: get('x-host-header'),
      path: get('cs-uri-stem'),
      status: get('sc-status'),
      referrer: decode(get('cs(Referer)')),
      ua: decode(get('cs(User-Agent)')),
      query: get('cs-uri-query'),
      result: get('x-edge-result-type'),
    });
  }
  return rows;
}

/** Marks every row as a bot, as the owner's own traffic, and with its visitor key (IP plus browser string). */
export function classifyRows(rows, excludedIps) {
  const excluded = new Set(excludedIps);
  for (const row of rows) {
    row.bot = row.ua === '-' || BOT_PATTERN.test(row.ua);
    row.own = excluded.has(row.ip);
    row.visitor = `${row.ip} ${row.ua}`;
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------
// Sessions and visits
// ---------------------------------------------------------------------------------------------------

/** Groups a visitor's requests (same IP and browser string) into sessions separated by SESSION_GAP_MINUTES. */
export function buildSessions(rows) {
  const byVisitor = new Map();
  for (const row of rows) {
    if (!byVisitor.has(row.visitor)) {
      byVisitor.set(row.visitor, []);
    }
    byVisitor.get(row.visitor).push(row);
  }

  const sessions = [];
  for (const [visitor, requests] of byVisitor) {
    let current = null;
    for (const row of requests) {
      if (current === null || row.at - current.end > SESSION_GAP_MINUTES * 60_000) {
        current = {
          visitor,
          ip: row.ip,
          start: row.at,
          end: row.at,
          day: row.day,
          pop: row.pop,
          referrer: '',
          hosts: new Set(),
          requests: 0,
          pages: 0,
          engaged: 0,
          api: 0,
          skillClicks: [],
          resumeDownloads: [],
          viewed: new Set(),
          secondsVisible: null,
          loads: 0,
          viewport: null,
          scheme: null,
          clicks: [],
        };
        sessions.push(current);
      }
      current.end = row.at;
      current.requests++;
      if (current.referrer === '' && isExternalReferrer(row)) {
        current.referrer = new URL(row.referrer).host;
      }
      if (isPage(row)) {
        current.pages++;
        current.hosts.add(row.host);
      }
      if (isAsset(row) || row.path.startsWith('/api/') || row.path === '/ping') {
        current.engaged++;
      }
      if (row.path.startsWith('/api/experience') || row.path.startsWith('/api/skills')) {
        current.api++;
      }
      const skill = /(?:^|&)skill=([^&]+)/.exec(row.query);
      if (skill !== null && row.path.startsWith('/api/experience')) {
        current.skillClicks.push(decode(decode(skill[1])));
      }
      if (row.path.startsWith('/resume/') && (row.status === '200' || row.status === '206')) {
        current.resumeDownloads.push(resumeEdition(row.path));
      }
      if (row.path === '/ping') {
        const params = new URLSearchParams(row.query === '-' ? '' : row.query);
        if (params.get('e') === 'load') {
          current.loads++;
          current.viewport = params.get('v') ?? current.viewport;
          current.scheme = params.get('c') ?? current.scheme;
        } else if (params.get('e') === 'click' && params.get('k') !== null) {
          current.clicks.push({ kind: params.get('k'), target: params.get('t') ?? '?', from: params.get('f') ?? '?' });
        } else if (params.get('e') === 'view' && params.get('s') !== null) {
          current.viewed.add(params.get('s'));
        } else if (params.get('e') === 'leave') {
          const seconds = Number.parseInt(params.get('t') ?? '', 10);
          if (Number.isFinite(seconds)) {
            current.secondsVisible = Math.max(current.secondsVisible ?? 0, seconds);
          }
        }
      }
    }
  }
  return sessions;
}

/** A session counts as a visit when it loaded a page and at least one asset, API call, or ping. */
export function isVisit(session) {
  return session.pages > 0 && session.engaged > 0;
}

/** The visits among the rows: the sessions of non-bot, non-owner browsers that qualify. */
export function selectVisits(rows) {
  return buildSessions(rows.filter((row) => !row.bot && !row.own)).filter(isVisit);
}

function isPage(row) {
  return row.method === 'GET' && (row.path === '/' || row.path.endsWith('.html')) && (row.status === '200' || row.status === '304');
}

function isAsset(row) {
  return (row.status === '200' || row.status === '304') && /\.(css|js|woff2|webp|png|svg|json|wasm)$/.test(row.path);
}

function isExternalReferrer(row) {
  if (row.referrer === '-' || row.referrer === '') {
    return false;
  }
  try {
    const host = new URL(row.referrer).host;
    return host !== row.host && !host.endsWith('.mvcprogrammer.com') && host !== 'mvcprogrammer.com';
  } catch {
    return false;
  }
}

/** The edition tag of a resume file name (Neal_Thomas_Resume-react.pdf is "react"); the untagged base file is "base". */
function resumeEdition(path) {
  const match = /-([a-z]+)\.pdf$/i.exec(path);
  return match === null ? 'base' : match[1].toLowerCase();
}

/** A percent-decoded value, or the value itself when it is not valid percent encoding. */
export function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------------------------------
// Calendar math in the site's time zone
// ---------------------------------------------------------------------------------------------------

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The wall-clock fields of an instant in TIME_ZONE. */
function zonedParts(date) {
  const parts = {};
  for (const { type, value } of PARTS.formatToParts(date)) {
    if (type !== 'literal') {
      parts[type] = Number.parseInt(value, 10);
    }
  }
  return parts;
}

/** The day an instant falls on in TIME_ZONE, as YYYY-MM-DD. */
export function dayKey(date) {
  const { year, month, day } = zonedParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The hour (0 to 23) an instant falls in, in TIME_ZONE. */
export function hourOf(date) {
  return zonedParts(date).hour;
}

/** Midnight at the start of a YYYY-MM-DD day in TIME_ZONE, as an instant. */
export function startOfDayKey(key) {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  let instant = new Date(Date.UTC(year, month - 1, day));
  // Shift by the zone's offset at the guess, then once more in case the first shift crossed a DST change.
  for (let pass = 0; pass < 2; pass++) {
    const { hour, minute } = zonedParts(instant);
    const minutesPastMidnight = dayKey(instant) === key ? hour * 60 + minute : (hour * 60 + minute) - 24 * 60;
    if (minutesPastMidnight === 0) {
      break;
    }
    instant = new Date(instant.getTime() - minutesPastMidnight * 60_000);
  }
  return instant;
}

/** The YYYY-MM-DD day `count` days after a day key (negative counts go back). Calendar math, no zone involved. */
export function addDays(key, count) {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
}

/** Every day key from `first` to `last` inclusive. */
export function dayKeysBetween(first, last) {
  const keys = [];
  for (let key = first; key <= last; key = addDays(key, 1)) {
    keys.push(key);
  }
  return keys;
}

/** The start of the reporting window: midnight in TIME_ZONE, `days - 1` days before the day `now` falls on. */
export function windowSince(days, now = new Date()) {
  return startOfDayKey(addDays(dayKey(now), -(days - 1)));
}
