#!/usr/bin/env node
// mvcprogrammer.com — tools/cf-stats.mjs
// Visitor and engagement figures from the CloudFront access logs. Downloads the log files for the
// window with the AWS CLI (aws s3 sync, so a second run only fetches what is new), parses the gzipped
// W3C lines, drops scanners and known crawlers, and prints per-day visits, unique visitors,
// referrers, regions, and what the engagement beacon (GET /ping, see main.js) recorded: which
// sections visitors reached and how long the page stayed visible. No dependencies beyond Node 22+.
//
//   node tools/cf-stats.mjs                      # the last 7 days
//   node tools/cf-stats.mjs --days 30 --scanners # a month, plus the 4xx and bot breakdown
//   node tools/cf-stats.mjs --exclude-ip 203.0.113.7  # leave your own visits out (or CF_STATS_EXCLUDE_IPS)
//
// The bucket defaults to mvcprogrammer-cf-logs-<account id> in the current AWS account; override
// with --bucket or CF_LOG_BUCKET. The three distributions log under cf/ (mvcprogrammer.com), blazor/,
// and angular/; --prefix narrows the run to one or more of them (comma-separated). Files are cached
// under ~/.cache/mvcprogrammer-cf-stats/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Log prefixes in the bucket, one per distribution: the main site, then the two framework editions. */
const DEFAULT_PREFIXES = ['cf/', 'blazor/', 'angular/'];

/** A visitor that sends no further request within this many minutes has left. */
const SESSION_GAP_MINUTES = 30;

/** Browser strings of crawlers, scanners, and tools; the same list the resume Lambda uses, plus the ones seen in the logs. */
const BOT_PATTERN =
  /bot|crawl|spider|preview|facebookexternalhit|slack|linkedinbot|whatsapp|telegram|discord|skype|twitterbot|headless|curl|wget|python|go-http|java\/|scrapy|okhttp|libwww|httpclient|zgrab|censys|nmap|masscan|gort|dataprovider|semrush|ahrefs|mj12|petalbot|bytespider|yandex|baidu|duckduck|applebot|bingbot|googlebot|gptbot|claudebot|anthropic|openai|perplexity|ccbot|amazonbot|axios|node-fetch|https?:\/\//i;

/** The page's sections in reading order, for the reach table. */
const SECTION_ORDER = ['about', 'services', 'freelance', 'portfolio', 'resume', 'contact', 'colophon'];

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (options.days - 1));

  const bucket = options.bucket ?? process.env.CF_LOG_BUCKET ?? `mvcprogrammer-cf-logs-${accountId()}`;
  const rows = [];
  for (const prefix of options.prefixes) {
    const cacheDir = join(homedir(), '.cache', 'mvcprogrammer-cf-stats', bucket, prefix.replace(/\/+$/, ''));
    if (!options.noSync) {
      syncLogs(bucket, prefix, cacheDir, since);
    }
    rows.push(...readLogs(cacheDir, since));
  }
  rows.sort((a, b) => a.at - b.at);
  if (rows.length === 0) {
    console.log(`No log lines since ${since.toDateString()} under ${options.prefixes.join(', ')}.`);
    return;
  }

  const excluded = new Set(options.excludeIps);
  for (const row of rows) {
    row.bot = row.ua === '-' || BOT_PATTERN.test(row.ua);
    row.own = excluded.has(row.ip);
    row.visitor = `${row.ip} ${row.ua}`;
  }

  const sessions = buildSessions(rows.filter((row) => !row.bot && !row.own));
  const visits = sessions.filter((session) => session.pages > 0 && session.engaged > 0);
  report(rows, visits, since, options, excluded);
}

/** --days N, --bucket B, --prefix P[,P], --exclude-ip a,b, --no-sync, --scanners. */
function parseArgs(argv) {
  const options = {
    days: 7,
    bucket: undefined,
    prefixes: DEFAULT_PREFIXES,
    excludeIps: (process.env.CF_STATS_EXCLUDE_IPS ?? '').split(',').map((ip) => ip.trim()).filter(Boolean),
    noSync: false,
    scanners: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) {
        fail(`${arg} needs a value`);
      }
      return argv[++i];
    };
    switch (arg) {
      case '--days':
        options.days = Number.parseInt(next(), 10);
        if (!Number.isInteger(options.days) || options.days < 1) {
          fail('--days must be a positive integer');
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
          fail('--prefix needs at least one prefix');
        }
        break;
      case '--exclude-ip':
        options.excludeIps.push(...next().split(',').map((ip) => ip.trim()).filter(Boolean));
        break;
      case '--no-sync':
        options.noSync = true;
        break;
      case '--scanners':
        options.scanners = true;
        break;
      case '--help':
      case '-h':
        console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').filter((line) => line.startsWith('//')).map((line) => line.slice(3)).join('\n'));
        process.exit(0);
        break;
      default:
        fail(`Unknown argument ${arg}`);
    }
  }
  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function accountId() {
  try {
    return execFileSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], { encoding: 'utf8' }).trim();
  } catch {
    fail('Could not read the AWS account id; pass --bucket or set CF_LOG_BUCKET.');
  }
}

/** Fetches only the files for the days in the window (names carry the UTC day: <dist>.YYYY-MM-DD-HH.<hash>.gz). A prefix with no files yet is fine. */
function syncLogs(bucket, prefix, cacheDir, since) {
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
    fail('aws s3 sync failed; check your AWS credentials or pass --no-sync to use the cached files.');
  }
}

/** Parses every cached file whose lines fall inside the window into plain objects. */
function readLogs(cacheDir, since) {
  if (!existsSync(cacheDir)) {
    return [];
  }

  const rows = [];
  for (const name of readdirSync(cacheDir).filter((file) => file.endsWith('.gz')).sort()) {
    const text = gunzipSync(readFileSync(join(cacheDir, name))).toString('utf8');
    let fields = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('#Fields:')) {
        fields = line.slice('#Fields:'.length).trim().split(/\s+/);
        continue;
      }
      if (line === '' || line.startsWith('#') || fields === null) {
        continue;
      }

      const values = line.split('\t');
      const get = (field) => values[fields.indexOf(field)] ?? '-';
      const at = new Date(`${get('date')}T${get('time')}Z`);
      if (at < since) {
        continue;
      }

      rows.push({
        at,
        day: localDay(at),
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
  }
  return rows;
}

/** Groups a visitor's requests (same IP and browser string) into sessions separated by SESSION_GAP_MINUTES. */
function buildSessions(rows) {
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
          resumeDownloads: 0,
          viewed: new Set(),
          secondsVisible: null,
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
        current.resumeDownloads++;
      }
      if (row.path === '/ping') {
        const params = new URLSearchParams(row.query === '-' ? '' : row.query);
        if (params.get('e') === 'view' && params.get('s') !== null) {
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

function report(rows, visits, since, options, excluded) {
  const days = [];
  for (const day = new Date(since); day <= new Date(); day.setDate(day.getDate() + 1)) {
    days.push(localDay(day));
  }
  const first = rows[0].at;
  const last = rows[rows.length - 1].at;

  console.log(`CloudFront access logs, ${first.toLocaleString()} to ${last.toLocaleString()} (local time)`);
  console.log(`${rows.length} requests${excluded.size > 0 ? `, excluding ${[...excluded].join(', ')}` : ''}`);
  console.log(`A visit is a non-bot browser that loaded the page and at least one asset, API call, or ping, within ${SESSION_GAP_MINUTES}-minute sessions.\n`);

  const table = [['day', 'requests', 'scanner %', 'visits', 'visitors', 'resume downloads']];
  for (const day of days) {
    const dayRows = rows.filter((row) => row.day === day);
    const dayVisits = visits.filter((visit) => visit.day === day);
    const scanners = dayRows.filter((row) => row.bot || row.status.startsWith('4')).length;
    table.push([
      day,
      dayRows.length,
      dayRows.length > 0 ? percent(scanners, dayRows.length) : '-',
      dayVisits.length,
      new Set(dayVisits.map((visit) => visit.visitor)).size,
      sum(dayVisits, (visit) => visit.resumeDownloads),
    ]);
  }
  printTable(table);

  const visitors = new Set(visits.map((visit) => visit.visitor));
  const daysSeen = new Map();
  for (const visit of visits) {
    daysSeen.set(visit.visitor, (daysSeen.get(visit.visitor) ?? new Set()).add(visit.day));
  }
  const returning = [...daysSeen.values()].filter((set) => set.size > 1).length;
  console.log(`\nVisits ${visits.length}, unique visitors ${visitors.size}, seen on more than one day ${returning}.`);
  if (visits.length === 0) {
    return;
  }

  console.log(`By edition:${top(visits.flatMap((visit) => [...visit.hosts]), 5)}.`);

  console.log(`Loaded the Experience API: ${percent(visits.filter((visit) => visit.api > 0).length, visits.length)} of visits.`);
  const clicks = visits.flatMap((visit) => visit.skillClicks);
  console.log(`Skill filter clicks: ${clicks.length} in ${visits.filter((visit) => visit.skillClicks.length > 0).length} visits${top(clicks, 5)}.`);

  const timed = visits.filter((visit) => visit.secondsVisible !== null).map((visit) => visit.secondsVisible).sort((a, b) => a - b);
  if (timed.length > 0) {
    console.log(`\nTime on page (${timed.length} visits reported it): median ${seconds(quantile(timed, 0.5))}, 75th percentile ${seconds(quantile(timed, 0.75))}, 90th ${seconds(quantile(timed, 0.9))}, longest ${seconds(timed[timed.length - 1])}.`);
  } else {
    console.log('\nNo time-on-page or section pings yet (the beacon needs the /ping route on this distribution).');
  }

  const reached = visits.filter((visit) => visit.viewed.size > 0);
  if (reached.length > 0) {
    const ids = [...SECTION_ORDER, ...new Set(visits.flatMap((visit) => [...visit.viewed]).filter((id) => !SECTION_ORDER.includes(id)))];
    const reachTable = [['section reached', 'visits', 'share']];
    for (const id of ids) {
      const count = visits.filter((visit) => visit.viewed.has(id)).length;
      if (count > 0 || SECTION_ORDER.includes(id)) {
        reachTable.push([id, count, percent(count, reached.length)]);
      }
    }
    console.log(`\nSection reach, of the ${reached.length} visits that sent view pings:`);
    printTable(reachTable);
  }

  console.log(`\nReferrers: ${top(visits.map((visit) => visit.referrer).filter(Boolean), 8) || ' none'}`);
  console.log(`Edge locations: ${top(visits.map((visit) => visit.pop), 10)}`);

  if (options.scanners) {
    const errors = rows.filter((row) => row.status.startsWith('4'));
    console.log(`\n${errors.length} requests ended in 4xx (${percent(errors.length, rows.length)} of all), ${percent(errors.filter((row) => row.bot).length, errors.length)} of them from bots or empty user agents.`);
    console.log(`Top 4xx paths:${top(errors.map((row) => row.path), 15)}`);
    console.log(`Bot families:${top(rows.filter((row) => row.bot).map((row) => (row.ua === '-' ? '(no user agent)' : (BOT_PATTERN.exec(row.ua)?.[0] ?? row.ua).toLowerCase())), 15)}`);
  }
}

function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function percent(part, whole) {
  return whole === 0 ? '-' : `${Math.round((100 * part) / whole)}%`;
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

function seconds(value) {
  return value >= 90 ? `${Math.round(value / 60)} min` : `${value} s`;
}

/** " a (12), b (3)" for the most common values, or "" when there are none. */
function top(values, limit) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ` ${value} (${count})`)
    .join(',');
}

function printTable(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((row) => String(row[i]).length)));
  for (const row of rows) {
    console.log(row.map((cell, i) => (i === 0 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join('  '));
  }
}
