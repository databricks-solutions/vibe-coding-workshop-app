// Library curation: contributed use cases and the focus-on-certified plan.
//
// Run: node --experimental-strip-types --test tests/frontend/libraryCuration.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contributorName, focusPlan, isContributed, isRepositoryManagedCollection, nameFromEmail } from '../../src/components/library/curation.ts';

const entry = (label: string, category: string | null, opts: { live?: boolean; cert?: boolean; order?: number; home?: boolean } = {}) => ({
  uc: { use_case_label: label, is_active: opts.live ?? true, is_certified: opts.cert ?? false },
  isHome: opts.home ?? true,
  category,
  displayOrder: opts.order ?? null,
});
const labels = (list: { uc: { use_case_label: string } }[]) => list.map(e => e.uc.use_case_label);

test('contributed covers contrib/ and every Ideate state, not seed or admin', () => {
  for (const s of ['contributed', 'ideate', 'ideate_pending', 'ideate_approved']) assert.equal(isContributed({ source: s } as never), true, s);
  for (const s of ['seed', 'admin']) assert.equal(isContributed({ source: s } as never), false, s);
});

test('only Partner & Community is repository-managed', () => {
  assert.equal(isRepositoryManagedCollection('community_contributions'), true);
  assert.equal(isRepositoryManagedCollection('retail'), false);
  assert.equal(isRepositoryManagedCollection('sample'), false);
});

test('contributor name comes from the contribution, else the email', () => {
  assert.equal(nameFromEmail('jane.doe@example.com'), 'Jane Doe');
  assert.equal(nameFromEmail('da86565d-d371-4a72-9cd0-8074a1a7cfec'), null);
  assert.equal(nameFromEmail(null), null);
  const contribution = { contributor: { display_name: 'Kubrick' } };
  assert.equal(contributorName({ source: 'contributed', created_by: 'x@y.com', contribution } as never), 'Kubrick');
  assert.equal(contributorName({ source: 'ideate', created_by: 'sam.lee@y.com' } as never), 'Sam Lee');
});

test('keeps every certified use case and hides the rest of its column', () => {
  const plan = focusPlan([
    entry('A', 'Ops', { cert: true }),
    entry('B', 'Ops'),
    entry('C', 'Ops', { live: false }),
    entry('D', 'Revenue', { cert: true }),
    entry('E', 'Revenue', { cert: true, live: false }),
  ]);
  assert.deepEqual(labels(plan.hide), ['B']);
  assert.deepEqual(labels(plan.show), ['E']);
  assert.equal(plan.keepCount, 3);
});

test('a column with nothing certified keeps its best live entry', () => {
  const plan = focusPlan([
    entry('Hidden first', 'Workforce', { live: false, order: 1 }),
    entry('Second', 'Workforce', { order: 2 }),
    entry('First live', 'Workforce', { order: 1 }),
  ]);
  const col = plan.columns[0];
  assert.equal(col.filled, true);
  assert.deepEqual(labels(col.keep), ['First live']);
  assert.deepEqual(labels(plan.hide), ['Second']);
  assert.deepEqual(plan.show, []);
});

test('a column with nothing live or certified stays hidden', () => {
  const plan = focusPlan([entry('Pending idea', 'Ideas', { live: false })]);
  assert.deepEqual(plan.show, []);
  assert.deepEqual(plan.hide, []);
  assert.equal(plan.keepCount, 0);
  assert.equal(plan.columns[0].filled, false);
});

test('cross-listed entries are left to their home collection', () => {
  const plan = focusPlan([entry('Home', 'Ops', { cert: true }), entry('Borrowed', 'Ops', { home: false })]);
  assert.deepEqual(labels(plan.hide), []);
  assert.equal(plan.keepCount, 1);
});
