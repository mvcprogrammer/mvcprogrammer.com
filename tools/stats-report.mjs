#!/usr/bin/env node
// mvcprogrammer.com — tools/stats-report.mjs
// Renders the account of an export run (tools/stats-export.mjs --report) as the Markdown that the
// stats workflow appends to its job summary, so the Actions run page says what the run read, how
// it classified the rows, what it wrote, what it uploaded, and how long each part took, without
// anyone opening the log. Everything it prints is a count, a day key, a file name, or a duration.
//
//   node tools/stats-report.mjs --report run/report.json >> "$GITHUB_STEP_SUMMARY"
//   node tools/stats-report.mjs --report run/report.json --out out --sync-log run/sync.log --sync-outcome success \
//     --invalidation run/invalidation.json --invalidation-outcome success --trigger "manual run"
//
// --report is the exporter's JSON; when the file is missing the summary says the export did not
// finish, so the workflow can render after a failed step. --out is the folder that was synced, for
// the count of files that were already up to date. --sync-log is what `aws s3 sync` printed (its
// `upload:` lines are the files that changed) and --invalidation the JSON `aws cloudfront
// create-invalidation` returned; --sync-outcome and --invalidation-outcome are those steps'
// outcomes as Actions reports them (success, failure, cancelled, skipped), because a failed `aws`
// command leaves an empty file behind, so the file alone cannot tell a failure from a quiet success.
// --trigger is one line about what started the run.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { headerComment, run } from './lib/cf-logs.mjs';

// Run only as a script; the tests import the renderer below without triggering a run.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(main);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = readJson(options.report);
  const invalidation = readJson(options.invalidation);
  const syncLog = options.syncLog !== undefined && existsSync(options.syncLog) ? readFileSync(options.syncLog, 'utf8') : null;
  const outFiles = options.out !== undefined && existsSync(options.out) ? listFiles(options.out) : null;
  process.stdout.write(
    renderReport({
      report: report.value,
      reportProblem: report.problem,
      trigger: options.trigger,
      syncLog,
      syncOutcome: options.syncOutcome,
      invalidation: invalidation.value,
      invalidationOutcome: options.invalidationOutcome,
      outFiles,
      outDir: options.out,
      commit: process.env.GITHUB_SHA,
      node: process.version,
    }),
  );
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`${arg} needs a value`);
      }
      return argv[++i];
    };
    switch (arg) {
      case '--report':
        options.report = next();
        break;
      case '--out':
        options.out = next();
        break;
      case '--sync-log':
        options.syncLog = next();
        break;
      case '--invalidation':
        options.invalidation = next();
        break;
      case '--sync-outcome':
        options.syncOutcome = next();
        break;
      case '--invalidation-outcome':
        options.invalidationOutcome = next();
        break;
      case '--trigger':
        options.trigger = next();
        break;
      case '--help':
      case '-h':
        console.log(headerComment(import.meta.url));
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }
  if (options.report === undefined) {
    throw new Error('--report is required');
  }
  return options;
}

/**
 * The parsed JSON at a path as `{ value, problem }`: `value` is null with `problem` 'missing' when
 * there is no path or no file (a failed step leaves none), and null with `problem` 'unreadable'
 * when the file is not valid JSON (a step that died mid-write), so the summary can say which.
 */
function readJson(path) {
  if (path === undefined || !existsSync(path)) {
    return { value: null, problem: 'missing' };
  }
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')), problem: null };
  } catch {
    return { value: null, problem: 'unreadable' };
  }
}

/** Every file under a folder as a path relative to it, sorted. */
function listFiles(dir, base = dir) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...listFiles(path, base));
    } else {
      files.push(relative(base, path));
    }
  }
  return files;
}

/**
 * The Markdown summary. `report` is the exporter's account, or null with `reportProblem` saying
 * whether the file was 'missing' (the export did not finish) or 'unreadable' (it died mid-write).
 * `syncLog` is the text `aws s3 sync` printed or null when nothing was synced, `invalidation` the
 * CloudFront response or null, and `syncOutcome` and `invalidationOutcome` those steps' outcomes
 * when the workflow knows them; `outFiles` lists what was in the synced folder `outDir`, or null.
 * Pure, so the tests can render a fixture report and compare the text.
 */
export function renderReport({ report, reportProblem = null, trigger, syncLog, syncOutcome, invalidation, invalidationOutcome, outFiles, outDir, commit, node }) {
  const lines = ['## Export visitor stats', ''];
  lines.push(...runTable({ report, trigger, commit, node }), '');
  if (report === null) {
    lines.push(
      reportProblem === 'unreadable'
        ? '**The export left a report that is not valid JSON**, so there is no account of the run; it must have stopped mid-write. See the Export step in the log.'
        : '**The export did not finish**, so there is no account of the run; see the Export step in the log.',
    );
    return `${lines.join('\n')}\n`;
  }
  lines.push('### Log files read', '', ...prefixTable(report.prefixes), '');
  lines.push('### Rows', '', ...rowsTable(report.rows), '');
  lines.push('### Day files written', '', ...daysTable(report.files), '');
  lines.push(missingDaysLine(report.missingDays), '', indexLine(report.index), '');
  lines.push('### Upload', '', ...uploadLines({ syncLog, syncOutcome, invalidation, invalidationOutcome, outFiles, outDir }).flatMap((line) => [line, '']));
  lines.push('### Timing', '', ...timingTable(report));
  return `${lines.join('\n')}\n`;
}

function runTable({ report, trigger, commit, node }) {
  const rows = [['Trigger', trigger || 'not recorded']];
  if (report !== null) {
    const { window, timeZone } = report;
    rows.push(['Window', `${window.firstDay} to ${window.lastDay} (${plural(window.days, 'day')}, ${timeZone}), parsed from ${stamp(window.parsedFrom)}`]);
    rows.push(['Log bucket', code(report.bucket)]);
    rows.push(['Finished', stamp(report.generatedAt)]);
  }
  if (commit !== undefined && commit !== '') {
    rows.push(['Commit', code(commit.slice(0, 7))]);
  }
  if (node !== undefined) {
    rows.push(['Node', node]);
  }
  return table(['Run', 'Detail'], rows, ['left', 'left']);
}

function prefixTable(prefixes) {
  const columns = ['files', 'bytes', 'lines', 'comments', 'orphans', 'beforeWindow', 'rows'];
  const total = Object.fromEntries(columns.map((column) => [column, prefixes.reduce((sum, prefix) => sum + prefix[column], 0)]));
  const row = (label, counts) => [label, count(counts.files), bytes(counts.bytes), count(counts.lines), count(counts.comments), count(counts.orphans), count(counts.beforeWindow), count(counts.rows)];
  return table(
    ['Prefix', 'Files', 'Size (gz)', 'Lines', 'Comments', 'Orphans', 'Before window', 'Rows'],
    [...prefixes.map((prefix) => row(code(prefix.prefix), prefix)), row('**Total**', total)],
    ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  );
}

function rowsTable(rows) {
  const browsers = rows.total - rows.own - rows.scanners;
  return table(
    ['Rows in window', 'Owner (excluded)', 'Bot browsers', 'Real browsers', 'Sessions', 'Visits'],
    [[count(rows.total), count(rows.own), count(rows.scanners), count(browsers), count(rows.sessions), count(rows.visits)]],
    ['right', 'right', 'right', 'right', 'right', 'right'],
  );
}

function daysTable(files) {
  if (files.length === 0) {
    return ['No day file was written: no log line fell inside the window.'];
  }
  return [
    ...table(
      ['Day', 'Requests', 'Scanner requests', 'Pings', 'API', 'Visits', 'Visitors', 'File'],
      files.map((file) => [code(file.day), count(file.requests), count(file.scannerRequests), count(file.pings), count(file.apiRequests), count(file.visits), count(file.visitors), bytes(file.bytes)]),
      ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
    ),
    '',
    'Requests leave out the owner. Scanner requests are those from a bot browser string or answered with a 4xx, as the dashboard counts them; pings are beacon rows and API the Experience API rows behind the visits.',
  ];
}

function missingDaysLine(missingDays) {
  return missingDays.length === 0 ? 'Every day in the window had log lines.' : `Days in the window with no log lines (no file written): ${missingDays.map(code).join(', ')}.`;
}

function indexLine(index) {
  return index.days === 0 ? 'The index lists no days.' : `The index lists ${plural(index.days, 'day')}, ${code(index.firstDay)} to ${code(index.lastDay)}.`;
}

/**
 * The upload paragraph. A step's outcome, when known, decides the wording: a failed `aws` command
 * leaves an empty or partial file behind, so the files alone would call a failure a quiet success.
 * Without outcomes (a laptop run) the files are all there is.
 */
function uploadLines({ syncLog, syncOutcome, invalidation, invalidationOutcome, outFiles, outDir }) {
  if (syncOutcome === 'skipped' || (syncOutcome === undefined && syncLog === null)) {
    return ['Nothing was uploaded: the sync step did not run (a dry run without `STATS_DISTRIBUTION_ID`, or an earlier step failed).'];
  }
  const lines = [];
  const uploaded = uploadedFiles(syncLog ?? '', outDir);
  const listed = uploaded.length === 0 ? '' : ` Uploaded before it stopped: ${uploaded.map(code).join(', ')}.`;
  if (syncOutcome !== undefined && syncOutcome !== 'success') {
    lines.push(`**The sync step ended with ${syncOutcome}**; see the log.${listed}`);
  } else if (uploaded.length === 0) {
    lines.push('Every file in the bucket was already up to date; nothing was uploaded.');
  } else {
    lines.push(`Uploaded ${plural(uploaded.length, 'file')}: ${uploaded.map(code).join(', ')}.`);
  }
  if (outFiles !== null && (syncOutcome === undefined || syncOutcome === 'success')) {
    const unchanged = outFiles.length - uploaded.length;
    lines.push(`${plural(outFiles.length, 'file')} in the output folder, ${count(Math.max(0, unchanged))} already up to date.`);
  }
  if (invalidationOutcome !== undefined && invalidationOutcome !== 'success') {
    lines.push(invalidationOutcome === 'skipped' ? 'The invalidation step did not run.' : `**The invalidation step ended with ${invalidationOutcome}**; see the log.`);
  } else if (invalidation !== null && invalidation.Invalidation !== undefined) {
    const { Id, Status, CreateTime } = invalidation.Invalidation;
    lines.push(`Invalidation ${code(Id)} created at ${stamp(CreateTime)} for ${code('/data/*')}, status ${Status}.`);
  } else {
    lines.push('No invalidation was created.');
  }
  return lines;
}

/** The files the sync output says were uploaded, relative to the synced folder. */
function uploadedFiles(syncLog, outDir) {
  const prefix = outDir === undefined ? null : `${outDir.replace(/\/+$/, '')}/`;
  return syncLog
    .split('\n')
    .map((line) => /^upload: (\S+) to /.exec(line))
    .filter((match) => match !== null)
    .map((match) => (prefix !== null && match[1].startsWith(prefix) ? match[1].slice(prefix.length) : match[1]));
}

function timingTable(report) {
  const rows = report.prefixes.map((prefix) => [`Sync ${code(prefix.prefix)}`, duration(prefix.syncSeconds)]);
  rows.push(['Parse (all prefixes)', duration(report.prefixes.reduce((sum, prefix) => sum + prefix.parseSeconds, 0))]);
  rows.push(['Sessions, visits, and day files', duration(report.timing.build)]);
  rows.push(['**Exporter total**', duration(report.timing.total)]);
  return table(['Stage', 'Seconds'], rows, ['left', 'right']);
}

// ---------------------------------------------------------------------------------------------------
// Markdown and number formatting
// ---------------------------------------------------------------------------------------------------

/** A GitHub-flavored Markdown table; `aligns` is 'left' or 'right' per column. */
function table(header, rows, aligns) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const rule = aligns.map((align) => (align === 'right' ? '---:' : '---'));
  return [line(header), line(rule), ...rows.map(line)];
}

function code(value) {
  return `\`${value}\``;
}

function count(value) {
  return value.toLocaleString('en-US');
}

function plural(value, noun) {
  return `${count(value)} ${noun}${value === 1 ? '' : 's'}`;
}

function duration(value) {
  return value.toFixed(1);
}

/** Bytes as a short size: 912 B, 1.2 KB, 3.4 MB. */
function bytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** An ISO instant as `YYYY-MM-DD HH:MM UTC`. */
function stamp(iso) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
