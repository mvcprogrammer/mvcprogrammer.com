#!/usr/bin/env node
// mvcprogrammer.com — tools/cf-stats.mjs
// Visitor and engagement figures from the CloudFront access logs. Downloads the log files for the
// window with the AWS CLI (aws s3 sync, so a second run only fetches what is new), parses the gzipped
// W3C lines, drops scanners and known crawlers, and prints per-day visits, unique visitors,
// referrers, regions, and what the engagement beacon (GET /ping, see main.js) recorded: how many
// real browsers loaded the page and on what kind of screen, which sections visitors reached, which
// edition and profile links they clicked, and how long the page stayed visible. No dependencies
// beyond Node 22+. The parsing and session rules live in tools/lib/cf-logs.mjs, shared with
// tools/stats-export.mjs, which writes the same figures as day files for the dashboard.
//
//   node tools/cf-stats.mjs                      # the last 7 days
//   node tools/cf-stats.mjs --days 30 --scanners # a month, plus the 4xx and bot breakdown
//   node tools/cf-stats.mjs --exclude-ip 203.0.113.7  # leave your own visits out (or CF_STATS_EXCLUDE_IPS)
//
// The bucket defaults to mvcprogrammer-cf-logs-<account id> in the current AWS account; override
// with --bucket or CF_LOG_BUCKET. The five distributions log under cf/ (mvcprogrammer.com), blazor/,
// angular/, react/, and fhir/ (the patient explorer); --prefix narrows the run to one or more of them (comma-separated). Files are
// cached under ~/.cache/mvcprogrammer-cf-stats/.
import {
  BOT_PATTERN,
  SECTION_ORDER,
  SESSION_GAP_MINUTES,
  classifyRows,
  dayKey,
  dayKeysBetween,
  headerComment,
  loadRows,
  parseCommonArgs,
  run,
  selectVisits,
  windowSince,
} from './lib/cf-logs.mjs';

run(main);

function main() {
  const options = parseCommonArgs(process.argv.slice(2), {
    help: () => console.log(headerComment(import.meta.url)),
    extra: (arg, _next, parsed) => {
      if (arg === '--scanners') {
        parsed.scanners = true;
        return true;
      }
      return false;
    },
  });
  const since = windowSince(options.days);
  const rows = loadRows(options, since);
  if (rows.length === 0) {
    console.log(`No log lines since ${since.toDateString()} under ${options.prefixes.join(', ')}.`);
    return;
  }

  classifyRows(rows, options.excludeIps);
  report(rows, selectVisits(rows), since, options, new Set(options.excludeIps));
}

function report(rows, visits, since, options, excluded) {
  const days = dayKeysBetween(dayKey(since), dayKey(new Date()));
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
      sum(dayVisits, (visit) => visit.resumeDownloads.length),
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

  const loaded = visits.filter((visit) => visit.loads > 0);
  if (loaded.length > 0) {
    console.log(`\nBeacon reach: ${loaded.length} of ${visits.length} visits (${percent(loaded.length, visits.length)}) sent a load ping; the rest ran no script or left before it fired.`);
    console.log(`Screens:${top(loaded.map((visit) => visit.viewport ?? '?'), 3)}. Color scheme:${top(loaded.map((visit) => visit.scheme ?? '?'), 2)}.`);
  }
  const clicksOf = (kind) => visits.flatMap((visit) => visit.clicks.filter((click) => click.kind === kind));
  const clickLine = (label, kind) => {
    const clicks = clicksOf(kind);
    const inVisits = visits.filter((visit) => visit.clicks.some((click) => click.kind === kind)).length;
    if (clicks.length === 0) {
      console.log(`${label}: none.`);
      return;
    }
    console.log(`${label}: ${clicks.length} in ${inVisits} visits, to${top(clicks.map((click) => click.target), 6)}; from${top(clicks.map((click) => click.from), 6)}.`);
  };
  console.log('');
  clickLine('Edition links clicked', 'edition');
  clickLine('GitHub links clicked', 'github');
  clickLine('LinkedIn and Flickr links clicked', 'social');

  console.log(`\nReferrers: ${top(visits.map((visit) => visit.referrer).filter(Boolean), 8) || ' none'}`);
  console.log(`Edge locations: ${top(visits.map((visit) => visit.pop), 10)}`);

  if (options.scanners) {
    const errors = rows.filter((row) => row.status.startsWith('4'));
    console.log(`\n${errors.length} requests ended in 4xx (${percent(errors.length, rows.length)} of all), ${percent(errors.filter((row) => row.bot).length, errors.length)} of them from bots or empty user agents.`);
    console.log(`Top 4xx paths:${top(errors.map((row) => row.path), 15)}`);
    console.log(`Bot families:${top(rows.filter((row) => row.bot).map((row) => (row.ua === '-' ? '(no user agent)' : (BOT_PATTERN.exec(row.ua)?.[0] ?? row.ua).toLowerCase())), 15)}`);
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
