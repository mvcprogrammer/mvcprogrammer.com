#!/usr/bin/env node
// mvcprogrammer.com — tools/burndown.mjs
// Draws the burndown of one sprint from the project board and reports hours per point. Reads the
// board with the gh CLI (project scope), takes every item in the sprint, sums their Estimate
// (story points, set before the work), and plots two lines over the sprint's days: the ideal line
// from the full total on the first day to zero on the last, and the actual line, the points of the
// items not yet Completed at the end of each day. Hours per point is the sum of Actual hours over
// the sum of points of the completed items that have both; the hours are git's floor (see
// tools/board-backfill.mjs and docs/BURNDOWN.md). The chart is an SVG with no script and no
// external font, so it renders in the README on GitHub in light and dark mode alike.
//
//   node tools/burndown.mjs                       # the sprint that contains today, else the latest
//   node tools/burndown.mjs --sprint "Sprint 1"   # a named sprint
//   node tools/burndown.mjs --out docs/images     # where the SVG goes (default)

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const owner = option("--owner", "mvcprogrammer");
const projectNumber = Number(option("--project", "1"));
const wanted = option("--sprint", null);
const outDir = resolve(fileURLToPath(new URL("..", import.meta.url)), option("--out", "docs/images"));

const gh = (ghArgs) => execFileSync("gh", ghArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const board = JSON.parse(gh(["api", "graphql", "-F", `owner=${owner}`, "-F", `number=${projectNumber}`, "-f", `query=query($owner: String!, $number: Int!) {
  user(login: $owner) { projectV2(number: $number) {
    title
    items(first: 100) { nodes {
      content { ... on Issue { number title } }
      status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      sprint: fieldValueByName(name: "Sprint") { ... on ProjectV2ItemFieldIterationValue { title startDate duration } }
      estimate: fieldValueByName(name: "Estimate") { ... on ProjectV2ItemFieldNumberValue { number } }
      completed: fieldValueByName(name: "Completed") { ... on ProjectV2ItemFieldDateValue { date } }
      hours: fieldValueByName(name: "Actual hours") { ... on ProjectV2ItemFieldNumberValue { number } }
    } }
  } }
}`])).data.user.projectV2;

const items = board.items.nodes
  .filter((n) => n.content?.number && n.sprint?.title)
  .map((n) => ({
    number: n.content.number,
    title: n.content.title,
    status: n.status?.name ?? "",
    sprint: n.sprint.title,
    start: n.sprint.startDate,
    days: n.sprint.duration,
    points: n.estimate?.number ?? 0,
    completed: n.completed?.date ?? null,
    hours: n.hours?.number ?? null,
  }));

// ---------------------------------------------------------------- Pick the sprint

const today = new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const sprints = [...new Map(items.map((i) => [i.sprint, { title: i.sprint, start: i.start, days: i.days }])).values()]
  .sort((a, b) => a.start.localeCompare(b.start));
const sprint = wanted
  ? sprints.find((s) => s.title === wanted)
  : sprints.find((s) => s.start <= today && today < addDays(s.start, s.days)) ?? sprints.at(-1);
if (!sprint) {
  console.error(wanted ? `No items in "${wanted}"` : "No sprint has items");
  process.exit(1);
}
const end = addDays(sprint.start, sprint.days - 1);
const inSprint = items.filter((i) => i.sprint === sprint.title);
const total = inSprint.reduce((sum, i) => sum + i.points, 0);

// ---------------------------------------------------------------- Lines

const dates = Array.from({ length: sprint.days }, (_, i) => addDays(sprint.start, i));
const remainingOn = (date) =>
  inSprint.filter((i) => !(i.status === "Done" && i.completed && i.completed <= date)).reduce((sum, i) => sum + i.points, 0);
const actual = dates.filter((d) => d <= today).map((d) => ({ date: d, remaining: remainingOn(d) }));
const ideal = dates.map((d, i) => ({ date: d, remaining: total * (1 - i / (sprint.days - 1)) }));

const withHours = inSprint.filter((i) => i.status === "Done" && i.hours != null && i.points > 0);
const hoursSum = withHours.reduce((s, i) => s + i.hours, 0);
const pointsWithHours = withHours.reduce((s, i) => s + i.points, 0);
const hoursPerPoint = pointsWithHours ? hoursSum / pointsWithHours : null;

// ---------------------------------------------------------------- SVG

const W = 880;
const H = 440;
const M = { top: 56, right: 28, bottom: 64, left: 56 };
const plotW = W - M.left - M.right;
const plotH = H - M.top - M.bottom;
const x = (i) => M.left + (plotW * i) / (sprint.days - 1);
const yMax = Math.max(total, 1);
const y = (v) => M.top + plotH - (plotH * v) / yMax;
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const path = (points) => points.map((p, i) => `${i ? "L" : "M"}${x(dates.indexOf(p.date)).toFixed(1)},${y(p.remaining).toFixed(1)}`).join(" ");
const ticksY = [...new Set([0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round((3 * yMax) / 4), yMax])];
const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()}`;
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const doneCount = inSprint.filter((i) => i.status === "Done").length;
const subtitle = `${sprint.start} to ${end} · ${inSprint.length} items, ${fmt(total)} points · ${doneCount} done` +
  (hoursPerPoint != null ? ` · ${hoursPerPoint.toFixed(2)} h/point from git` : "");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">${esc(board.title)} ${esc(sprint.title)} burndown</title>
  <desc id="d">Story points remaining per day against the ideal line. ${esc(subtitle)}</desc>
  <style>
    .bg { fill: #ffffff; }
    text { font: 13px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; fill: #57606a; }
    .title { font-size: 18px; font-weight: 600; fill: #24292f; }
    .grid { stroke: #d0d7de; stroke-width: 1; }
    .axis { stroke: #8c959f; stroke-width: 1; }
    .ideal { fill: none; stroke: #8c959f; stroke-width: 2; stroke-dasharray: 6 5; }
    .actual { fill: none; stroke: #1f6feb; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
    .dot { fill: #1f6feb; }
    .today { stroke: #cf222e; stroke-width: 1; stroke-dasharray: 3 4; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: #0d1117; } text { fill: #8b949e; } .title { fill: #e6edf3; } .grid { stroke: #30363d; } .axis { stroke: #484f58; }
      .ideal { stroke: #6e7681; } .actual { stroke: #58a6ff; } .dot { fill: #58a6ff; } .today { stroke: #f85149; }
    }
  </style>
  <rect class="bg" width="${W}" height="${H}" rx="8"/>
  <text class="title" x="${M.left}" y="26">${esc(sprint.title)} burndown</text>
  <text x="${M.left}" y="44">${esc(subtitle)}</text>
  ${ticksY.map((v) => `<line class="grid" x1="${M.left}" x2="${W - M.right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${M.left - 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join("\n  ")}
  <line class="axis" x1="${M.left}" x2="${M.left}" y1="${M.top}" y2="${M.top + plotH}"/>
  <line class="axis" x1="${M.left}" x2="${W - M.right}" y1="${M.top + plotH}" y2="${M.top + plotH}"/>
  ${dates.map((d, i) => `<text x="${x(i).toFixed(1)}" y="${M.top + plotH + 20}" text-anchor="middle">${dayLabel(d)}</text>`).join("\n  ")}
  <path class="ideal" d="${path(ideal)}"/>
  ${actual.length ? `<path class="actual" d="${path(actual)}"/>` : ""}
  ${actual.map((p) => `<circle class="dot" cx="${x(dates.indexOf(p.date)).toFixed(1)}" cy="${y(p.remaining).toFixed(1)}" r="4"><title>${p.date}: ${fmt(p.remaining)} points remaining</title></circle>`).join("\n  ")}
  ${dates.includes(today) ? `<line class="today" x1="${x(dates.indexOf(today)).toFixed(1)}" x2="${x(dates.indexOf(today)).toFixed(1)}" y1="${M.top}" y2="${M.top + plotH}"/>` : ""}
  <text x="${W - M.right}" y="${H - 14}" text-anchor="end">points remaining · dashed: ideal · solid: actual</text>
</svg>
`;

mkdirSync(outDir, { recursive: true });
const file = join(outDir, `burndown-${sprint.title.toLowerCase().replace(/\s+/g, "-")}.svg`);
writeFileSync(file, svg);

// ---------------------------------------------------------------- Report

console.log(`${sprint.title}: ${sprint.start} to ${end}, ${inSprint.length} items, ${fmt(total)} points, ${doneCount} done`);
console.log("day         ideal   actual");
for (const p of ideal) {
  const a = actual.find((q) => q.date === p.date);
  console.log(`${p.date}  ${fmt(p.remaining).padStart(5)}   ${a ? fmt(a.remaining).padStart(5) : "    -"}`);
}
console.log("\nitem   points  hours  completed   title");
for (const i of inSprint.sort((a, b) => a.number - b.number)) {
  console.log(`#${String(i.number).padEnd(5)} ${String(fmt(i.points)).padStart(5)}  ${String(i.hours ?? "-").padStart(5)}  ${i.completed ?? "-"}  ${i.title.slice(0, 60)}`);
}
console.log(hoursPerPoint != null
  ? `\nhours per point: ${hoursPerPoint.toFixed(2)} (${fmt(hoursSum)} h over ${fmt(pointsWithHours)} points on ${withHours.length} completed items with both)`
  : "\nhours per point: no completed item has both points and hours yet");
console.log(`wrote ${file}`);
