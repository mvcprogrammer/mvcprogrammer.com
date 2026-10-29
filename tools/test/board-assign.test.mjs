// mvcprogrammer.com — tools/test/board-assign.test.mjs
// Tests for the default-assignee rule: which board items get the owner and which are left alone.
//
//   node --test 'tools/test/*.test.mjs'
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ASSIGNED_STATUSES, needsAssignee } from '../board-assign.mjs';

/** A board item with the given status and assignee logins; `content` is omitted for a draft item. */
function item(number, status, assignees = [], { draft = false } = {}) {
  return {
    id: `PVTI_${number}`,
    status: status === null ? null : { name: status },
    content: draft ? null : { id: `I_${number}`, number, title: `Item ${number}`, assignees: { nodes: assignees.map((login) => ({ login })) } },
  };
}

test('Ready, In progress, In review, and Done items with no assignee are picked', () => {
  const items = [item(1, 'Ready'), item(2, 'In progress'), item(3, 'In review'), item(4, 'Done')];
  assert.deepEqual(needsAssignee(items).map((i) => i.content.number), [1, 2, 3, 4]);
});

test('Backlog items and items with no status are left alone', () => {
  const items = [item(1, 'Backlog'), item(2, null), item(3, 'Ready')];
  assert.deepEqual(needsAssignee(items).map((i) => i.content.number), [3]);
});

test('an item that already has an assignee, the owner or anyone else, is left alone', () => {
  const items = [item(1, 'Ready', ['mvcprogrammer']), item(2, 'Done', ['someone-else']), item(3, 'Ready')];
  assert.deepEqual(needsAssignee(items).map((i) => i.content.number), [3]);
});

test('draft items, which have no issue or pull request to assign, are skipped', () => {
  const items = [item(1, 'Ready', [], { draft: true }), item(2, 'Ready')];
  assert.deepEqual(needsAssignee(items).map((i) => i.content.number), [2]);
});

test('an empty board yields nothing', () => {
  assert.deepEqual(needsAssignee([]), []);
});

test('the status list can be narrowed', () => {
  const items = [item(1, 'Ready'), item(2, 'Done')];
  assert.deepEqual(needsAssignee(items, ['Done']).map((i) => i.content.number), [2]);
  assert.deepEqual(ASSIGNED_STATUSES, ['Ready', 'In progress', 'In review', 'Done']);
});
