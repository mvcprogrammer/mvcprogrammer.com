#!/usr/bin/env node
// mvcprogrammer.com — tools/board-assign.mjs
// Assigns the board's owner to every item that has reached Ready and has no assignee yet. The
// board is a one-person backlog, so the owner is the default assignee of anything groomed; this
// script is the rule GitHub Projects does not offer (its built-in workflows cannot set assignees).
// Ready or later means Ready, In progress, In review, and Done: an item that moves through Ready
// between two nightly runs is still caught, and an item that already carries an assignee is left
// alone. Backlog items are untouched, because an ungroomed item is nobody's yet. No dependencies
// beyond Node 22+ and the gh CLI (project scope, plus Issues and Pull requests write on the repository).
//
//   node tools/board-assign.mjs --dry-run        # print the items, assign nothing
//   node tools/board-assign.mjs                  # assign the owner
//   node tools/board-assign.mjs --project 1 --owner mvcprogrammer

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** The statuses at or past Ready, the point from which an item is the owner's by default. */
export const ASSIGNED_STATUSES = ["Ready", "In progress", "In review", "Done"];

/**
 * Picks the items the owner should be assigned to: those whose status is in `statuses` and whose
 * issue or pull request has no assignee at all. An item with any assignee, even someone else, is
 * left as it is, so a deliberate hand-off is never undone.
 */
export function needsAssignee(items, statuses = ASSIGNED_STATUSES) {
  return items.filter((item) => {
    const content = item.content;
    if (!content?.id || !content.number) {
      return false;
    }
    if (!statuses.includes(item.status?.name)) {
      return false;
    }
    return (content.assignees?.nodes ?? []).length === 0;
  });
}

const sh = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const gh = (ghArgs) => sh("gh", ghArgs);
const graphql = (query, variables = {}) => {
  const flat = Object.entries(variables).flatMap(([k, v]) => ["-F", `${k}=${v}`]);
  return JSON.parse(gh(["api", "graphql", "-f", `query=${query}`, ...flat]));
};

/** Reads the owner's node ID and every item on the board with its status and assignees. */
function readBoard(owner, projectNumber) {
  const data = graphql(`query($owner: String!, $number: Int!) {
    user(login: $owner) {
      id
      projectV2(number: $number) { items(first: 100) { nodes {
        id
        status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
        content {
          ... on Issue { id number title assignees(first: 10) { nodes { login } } }
          ... on PullRequest { id number title assignees(first: 10) { nodes { login } } }
        }
      } } }
    }
  }`, { owner, number: projectNumber }).data.user;
  return { ownerId: data.id, items: data.projectV2.items.nodes };
}

const assign = (assignableId, assigneeId) => graphql(`mutation($assignable: ID!, $assignee: ID!) {
  addAssigneesToAssignable(input: { assignableId: $assignable, assigneeIds: [$assignee] }) { clientMutationId }
}`, { assignable: assignableId, assignee: assigneeId });

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i === -1 ? fallback : args[i + 1];
  };
  const dryRun = args.includes("--dry-run");
  const owner = option("--owner", "mvcprogrammer");
  const projectNumber = Number(option("--project", "1"));

  const { ownerId, items } = readBoard(owner, projectNumber);
  const pending = needsAssignee(items);
  if (pending.length === 0) {
    console.log(`Every item at Ready or later already has an assignee; nothing to assign.`);
  }
  for (const item of pending) {
    console.log(`${dryRun ? "would assign" : "assigning"} ${owner} to #${item.content.number} (${item.status.name}): ${item.content.title}`);
    if (!dryRun) {
      try {
        assign(item.content.id, ownerId);
      } catch (error) {
        const text = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
        if (/FORBIDDEN|Resource not accessible|403/.test(text)) {
          throw new Error(`The token cannot assign #${item.content.number}; it needs Issues: read and write (and Pull requests: read and write for pull requests).`, { cause: error });
        }
        throw error;
      }
    }
  }
  if (!dryRun && pending.length > 0) {
    console.log(`Assigned ${owner} to ${pending.length} item${pending.length === 1 ? "" : "s"}.`);
  }
}
