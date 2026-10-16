// Node unit test for the SPA gate DUAL-WRITE derivation (Phase 3 T5 PR3a).
//
// Run: node --experimental-strip-types --test tests/frontend/stepNumbersToGates.node.test.ts
//
// No React/DOM/vitest — mirrors the mergeStatus.node.test.ts pattern, but imports
// the REAL ALL_STEPS (via workflowSections.ts) so it verifies stepNumbersToGates
// against the actual global number->sectionTag map the SPA writes with, not a
// stand-in. This is the helper the three write paths use to derive the COMPLETE
// gate set from the SAME numbers they persist as completed_steps/skipped_steps.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_STEPS,
  stepNumbersToGates,
  completedGatesToStepNumbers,
} from '../../src/constants/workflowSections.ts';

test('maps global step numbers to their ALL_STEPS sectionTags, in order', () => {
  // Globals 1..5 on the App path: usecase_selection..deploy_databricks_app.
  assert.deepEqual(stepNumbersToGates([1, 2, 3, 4, 5]), [
    'usecase_selection',
    'project_setup',
    'prd_generation',
    'cursor_copilot_ui_design',
    'deploy_databricks_app',
  ]);
  // High globals the dense-index read used to drop are mapped correctly too.
  assert.deepEqual(stepNumbersToGates([57, 58, 59]), [
    'semlayer_locate',
    'semlayer_profile',
    'semlayer_measures',
  ]);
});

test('COMPLETE set: derives a gate for every mapped number (no delta, no loss)', () => {
  // The guarantee: gates derived from the SAME set written as completed_steps.
  const completed = [1, 2, 3, 4, 5, 6];
  const gates = stepNumbersToGates(completed);
  assert.equal(gates.length, completed.length, 'every completed number yields a gate');
  // Round-trips back to the same numbers via the reverse bridge.
  assert.deepEqual(completedGatesToStepNumbers(gates).sort((a, b) => a - b), completed);
});

test('drops unmapped / retired numbers, never throws or mis-indexes', () => {
  // 70 was retired (use_case_selection), 999 never existed. Both drop cleanly.
  assert.deepEqual(stepNumbersToGates([2, 70, 999, 3]), ['project_setup', 'prd_generation']);
  assert.equal(70 in ALL_STEPS, false, 'step 70 is retired from ALL_STEPS');
  assert.deepEqual(stepNumbersToGates([]), []);
});
