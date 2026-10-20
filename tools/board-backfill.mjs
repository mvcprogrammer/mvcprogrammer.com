#!/usr/bin/env node
// mvcprogrammer.com — tools/board-backfill.mjs
// Fills the Started, Completed, and Actual hours fields of the project board from git, so the
// burndown (tools/burndown.mjs) rests on evidence rather than memory. For every Done item it
// collects the commits that did the work, from two sources:
//   - commit hashes written in the issue body ("mvcprogrammer.com ff2815e, 7f7a555; mvcprogrammer dd54882"),
//     looked up in this repository and, after a repository name, in a sibling clone;
//   - every commit on the branch of a merged pull request whose title or body closes or references
//     the issue with a keyword ("Closes #N", "Fixes #N", "Resolves #N", "Refs #N"); a bare mention in
//     prose does not count, or a pull request that talks about several issues would be charged to all.
// Started is the earliest author date, Completed the merge time of the last pull request or the
// latest commit, and Actual hours come from the commit times alone: commits closer together than
// SESSION_GAP hours belong to one working session, each session counts from FIRST_COMMIT_ALLOWANCE
// hours before its first commit to its last commit. Git cannot see the work before a first commit
// or between sessions, so the figure is a floor; docs/BURNDOWN.md says so. Items whose body says the
// work was not in git keep their Completed date and get no hours. No dependencies beyond Node 22+
// and the gh CLI (project scope).
//
//   node tools/board-backfill.mjs --dry-run        # print the table, write nothing
//   node tools/board-backfill.mjs                  # write the three fields
//   node tools/board-backfill.mjs --profile-repo ../mvcprogrammer --project 1 --owner mvcprogrammer

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FIRST_COMMIT_ALLOWANCE_HOURS = 0.5;
const SESSION_GAP_HOURS = 2;
const PROJECT_ID = "PVT_kwHOAqtdss4Bnur7";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const dryRun = args.includes("--dry-run");
const owner = option("--owner", "mvcprogrammer");
const projectNumber = Number(option("--project", "1"));
const siteRepo = fileURLToPath(new URL("..", import.meta.url));
const profileRepo = resolve(siteRepo, option("--profile-repo", "../mvcprogrammer"));
const repos = { "mvcprogrammer.com": siteRepo, mvcprogrammer: profileRepo };

const sh = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const gh = (ghArgs) => sh("gh", ghArgs);
const graphql = (query, variables = {}) => {
  const flat = Object.entries(variables).flatMap(([k, v]) => ["-F", `${k}=${v}`]);
  return JSON.parse(gh(["api", "graphql", "-f", `query=${query}`, ...flat]));
};

// ---------------------------------------------------------------- Board

const fieldsAndItems = graphql(`query($owner: String!, $number: Int!) {
  user(login: $owner) { projectV2(number: $number) {
    fields(first: 40) { nodes { ... on ProjectV2Field { id name dataType } ... on ProjectV2SingleSelectField { id name } } }
    items(first: 100) { nodes {
      id
      content { ... on Issue { number title body closedAt } }
      status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      estimate: fieldValueByName(name: "Estimate") { ... on ProjectV2ItemFieldNumberValue { number } }
      completed: fieldValueByName(name: "Completed") { ... on ProjectV2ItemFieldDateValue { date } }
    } }
  } }
}`, { owner, number: projectNumber }).data.user.projectV2;

const fieldId = (name) => {
  const field = fieldsAndItems.fields.nodes.find((f) => f.name === name);
  if (!field) throw new Error(`The board has no "${name}" field`);
  return field.id;
};
const FIELD = { started: fieldId("Started"), completed: fieldId("Completed"), hours: fieldId("Actual hours") };

const items = fieldsAndItems.items.nodes
  .filter((n) => n.content?.number && n.status?.name === "Done")
  .map((n) => ({
    itemId: n.id,
    number: n.content.number,
    title: n.content.title,
    body: n.content.body ?? "",
    closedAt: n.content.closedAt,
    estimate: n.estimate?.number ?? null,
    completed: n.completed?.date ?? null,
  }))
  .sort((a, b) => a.number - b.number);

// ---------------------------------------------------------------- Pull requests

const pulls = JSON.parse(gh(["pr", "list", "--state", "merged", "--limit", "200", "--json", "number,body,title,mergedAt,mergeCommit"]));
const pullsFor = (issueNumber) => {
  const ref = new RegExp(`\\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|references?|part of)\\s*:?\\s*#${issueNumber}(?![0-9])`, "i");
  return pulls.filter((p) => ref.test(p.body ?? "") || ref.test(p.title ?? ""));
};

// ---------------------------------------------------------------- Commits

const authorDate = (repo, sha) => new Date(sh("git", ["log", "-1", "--format=%aI", sha], repo).trim());
const branchCommits = (mergeSha) =>
  sh("git", ["log", "--format=%aI", `${mergeSha}^1..${mergeSha}^2`], siteRepo)
    .trim().split("\n").filter(Boolean).map((d) => new Date(d));

/** "mvcprogrammer.com ff2815e, 7f7a555; mvcprogrammer dd54882" -> commit dates from the named clones. */
const bodyCommits = (body) => {
  const dates = [];
  for (const segment of body.split(/[;\n]/)) {
    const match = segment.trim().match(/^(mvcprogrammer(?:\.com)?)\s+([0-9a-f]{7,40}(?:\s*,\s*[0-9a-f]{7,40})*)/);
    if (!match) continue;
    const repo = repos[match[1]];
    if (!existsSync(repo)) throw new Error(`Clone not found for ${match[1]}: ${repo}`);
    for (const sha of match[2].split(/\s*,\s*/)) dates.push(authorDate(repo, sha));
  }
  return dates;
};

const notInGit = (body) => /not in git/i.test(body);

/** Session-based hours from commit instants; see the header comment. */
const hoursFrom = (dates) => {
  const times = [...dates].map((d) => d.getTime()).sort((a, b) => a - b);
  if (times.length === 0) return null;
  let hours = 0;
  let sessionStart = times[0];
  let last = times[0];
  for (const t of times.slice(1)) {
    if (t - last > SESSION_GAP_HOURS * 3_600_000) {
      hours += (last - sessionStart) / 3_600_000 + FIRST_COMMIT_ALLOWANCE_HOURS;
      sessionStart = t;
    }
    last = t;
  }
  hours += (last - sessionStart) / 3_600_000 + FIRST_COMMIT_ALLOWANCE_HOURS;
  return Math.round(hours * 4) / 4;
};

// Board dates are calendar days where the work happened (Eastern), not UTC: a commit at 22:13 on
// the 19th is the 19th, even though GitHub records its merge at 03:09Z on the 20th.
const TIME_ZONE = "America/New_York";
const isoDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// ---------------------------------------------------------------- Evidence per item

const rows = items.map((item) => {
  if (/^Epic/.test(item.title)) {
    return { ...item, note: "epic: dates from its slices, no hours (the slices carry them)", dates: [], merges: [] };
  }
  const dates = bodyCommits(item.body);
  const merges = [];
  for (const pr of pullsFor(item.number)) {
    if (!pr.mergeCommit?.oid) continue;
    dates.push(...branchCommits(pr.mergeCommit.oid));
    merges.push(new Date(pr.mergedAt));
  }
  if (dates.length === 0) {
    // Console or browser work: the board's Completed stands if it was set, else the day GitHub closed the issue.
    const completed = item.completed ?? (item.closedAt ? isoDate(new Date(item.closedAt)) : null);
    return { ...item, completed, note: notInGit(item.body) ? "console work, not in git: Completed kept, no hours" : "no commits found", dates, merges };
  }
  return { ...item, dates, merges, note: "" };
});

// Epic dates from the slices listed in its body (- [x] #25 ...).
for (const row of rows) {
  if (!/^Epic/.test(row.title)) continue;
  const sliceNumbers = [...row.body.matchAll(/- \[[ x]\] #(\d+)/g)].map((m) => Number(m[1]));
  const slices = rows.filter((r) => sliceNumbers.includes(r.number) && r.dates.length);
  row.dates = slices.flatMap((s) => s.dates);
  row.merges = slices.flatMap((s) => s.merges);
  row.epic = true;
}

const planned = rows.map((row) => {
  const started = row.dates.length ? isoDate(new Date(Math.min(...row.dates.map((d) => d.getTime())))) : row.completed;
  const completed = row.merges.length
    ? isoDate(new Date(Math.max(...row.merges.map((d) => d.getTime()))))
    : row.dates.length ? isoDate(new Date(Math.max(...row.dates.map((d) => d.getTime())))) : row.completed;
  const hours = row.epic || !row.dates.length ? null : hoursFrom(row.dates);
  return { ...row, started, completedNew: completed, hours };
});

// ---------------------------------------------------------------- Report and write

console.log("item  points  started     completed   hours  commits  note");
for (const r of planned) {
  console.log(
    `#${String(r.number).padEnd(4)} ${String(r.estimate ?? "-").padStart(5)}  ${r.started ?? "-"}  ${r.completedNew ?? "-"}  ${String(r.hours ?? "-").padStart(5)}  ${String(r.dates.length).padStart(7)}  ${r.note}`,
  );
}

if (dryRun) {
  console.log("\ndry run: nothing written");
  process.exit(0);
}

const setDate = (itemId, field, date) => graphql(`mutation($project: ID!, $item: ID!, $field: ID!, $date: Date!) {
  updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field, value: { date: $date } }) { projectV2Item { id } }
}`, { project: PROJECT_ID, item: itemId, field, date });
// gh -F sends a decimal as a string, which GraphQL will not coerce to Float, so the number is inlined.
const setNumber = (itemId, field, number) => graphql(`mutation($project: ID!, $item: ID!, $field: ID!) {
  updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field, value: { number: ${Number(number)} } }) { projectV2Item { id } }
}`, { project: PROJECT_ID, item: itemId, field });

const clearField = (itemId, field) => graphql(`mutation($project: ID!, $item: ID!, $field: ID!) {
  clearProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field }) { projectV2Item { id } }
}`, { project: PROJECT_ID, item: itemId, field });

let written = 0;
for (const r of planned) {
  if (r.started) setDate(r.itemId, FIELD.started, r.started);
  if (r.completedNew) setDate(r.itemId, FIELD.completed, r.completedNew);
  // An item without git evidence gets its hours cleared, so a value a looser run once wrote cannot linger.
  if (r.hours != null) setNumber(r.itemId, FIELD.hours, r.hours);
  else clearField(r.itemId, FIELD.hours);
  written++;
}
console.log(`\nwrote ${written} items`);
