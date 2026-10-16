// Node unit test for the App gate-write merge base (app-save-drops-unseen-mcp-gates, D-12).
//
// Run: node --experimental-strip-types --test tests/frontend/gateBase.node.test.ts
//
// F1: the base updates on hydrate and on a successful write, and is NOT updated
// on a failed write (a failed write never reached the server, so the server's
// gates are still what the SPA last saw).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyGateBase,
  hydrateGateBase,
  gateBaseFields,
  applyGateWriteResult,
  type GateWrite,
} from '../../src/utils/gateBase.ts';

test('F1: hydrate sets the base to the server gates, sent sorted on the next write', () => {
  const base = hydrateGateBase('s1', ['use_case_selection', 'project_setup'], ['setup_lakebase']);
  const write: GateWrite = { completed_gates: ['activation_app_design'], skipped_gates: [] };

  assert.deepEqual(gateBaseFields(base, 's1', write), {
    base_completed_gates: ['project_setup', 'use_case_selection'],
    base_skipped_gates: ['setup_lakebase'],
  });
});

test('F1: hydrate tolerates absent gate lists', () => {
  const base = hydrateGateBase('s1', undefined, null);
  assert.deepEqual(gateBaseFields(base, 's1', { completed_gates: [], skipped_gates: [] }), {
    base_completed_gates: [],
    base_skipped_gates: [],
  });
});

test('F1: a successful write becomes the base', () => {
  const base = hydrateGateBase('s1', ['project_setup'], ['setup_lakebase']);
  const write: GateWrite = { completed_gates: ['project_setup', 'prd_generation'], skipped_gates: [] };

  const next = applyGateWriteResult(base, 's1', write, true);

  assert.deepEqual([...next.completed], ['project_setup', 'prd_generation']);
  assert.deepEqual([...next.skipped], []);
});

test('F1: a failed write leaves the base unchanged', () => {
  // TAMPER (T4): update the base regardless of `succeeded` -> this fails.
  const base = hydrateGateBase('s1', ['project_setup'], ['setup_lakebase']);
  const write: GateWrite = { completed_gates: ['prd_generation'], skipped_gates: [] };

  const next = applyGateWriteResult(base, 's1', write, false);

  assert.equal(next, base);
  assert.deepEqual(gateBaseFields(next, 's1', write), {
    base_completed_gates: ['project_setup'],
    base_skipped_gates: ['setup_lakebase'],
  });
});

test('a skipped-only write sends and updates only the skipped base', () => {
  const base = hydrateGateBase('s1', ['project_setup'], ['setup_lakebase']);
  const write: GateWrite = { skipped_gates: ['prd_generation'] };

  assert.deepEqual(gateBaseFields(base, 's1', write), { base_skipped_gates: ['setup_lakebase'] });

  const next = applyGateWriteResult(base, 's1', write, true);
  assert.deepEqual([...next.completed], ['project_setup']);
  assert.deepEqual([...next.skipped], ['prd_generation']);
});

test('a base for another session sends no base and ignores that session\'s results', () => {
  const base = hydrateGateBase('s1', ['project_setup'], []);
  const write: GateWrite = { completed_gates: ['prd_generation'], skipped_gates: [] };

  // No base => the server falls back to today's App-authoritative merge.
  assert.deepEqual(gateBaseFields(base, 's2', write), {});
  assert.deepEqual(gateBaseFields(emptyGateBase(), 's1', write), {});
  // A late result for s2 after switching to s1 does not touch s1's base.
  assert.equal(applyGateWriteResult(base, 's2', write, true), base);
});

test('a new session starts from an empty base', () => {
  const base = emptyGateBase('s3');
  assert.deepEqual(gateBaseFields(base, 's3', { completed_gates: ['project_setup'] }), {
    base_completed_gates: [],
  });
});
