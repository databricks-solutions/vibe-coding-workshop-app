// Node unit test for gate-first SKIPPED hydration — Phase 3 T5 R4b.
//
// Run: node --experimental-strip-types --test tests/frontend/deriveSkippedStepNumbers.node.test.ts
//
// No React/DOM/vitest. It imports the REAL function under test
// (src/constants/deriveProgress.ts), extracted out of App.tsx in R4b (no
// behaviour change). deriveSkippedStepNumbers is the skipped-side mirror of
// deriveCompletedStepNumbers: gates-only, mapping skipped_gates -> global numbers
// via the REAL workflowSections bridge, with NO numeric fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveSkippedStepNumbers } from '../../src/constants/deriveProgress.ts';
import { completedGatesToStepNumbers } from '../../src/constants/workflowSections.ts';

test('genie-accelerator (globals 57+): skipped gates hydrate to the right numbers', () => {
  const skippedTags = ['semlayer_locate', 'semlayer_profile', 'semlayer_measures'];
  const expected = completedGatesToStepNumbers(skippedTags); // [57, 58, 59]
  assert.deepEqual([...expected].sort((a, b) => a - b), [57, 58, 59]);

  assert.deepEqual(
    [...deriveSkippedStepNumbers(skippedTags)].sort((a, b) => a - b),
    [57, 58, 59],
  );
});

test('end-to-end: skipped gates map to the correct global numbers', () => {
  const skippedTags = ['project_setup', 'cursor_copilot_ui_design']; // [2, 4]
  const expected = completedGatesToStepNumbers(skippedTags);
  assert.deepEqual(
    [...deriveSkippedStepNumbers(skippedTags)].sort((a, b) => a - b),
    [...expected].sort((a, b) => a - b),
  );
});

test('empty / absent skipped gates hydrate to no skips', () => {
  assert.deepEqual(deriveSkippedStepNumbers([]), []);
  assert.deepEqual(deriveSkippedStepNumbers(undefined), []);
});

test('TAMPER: no numeric fallback — a legacy skipped-numbers argument is ignored', () => {
  // Gates-only (single arg): a stale legacy skipped_steps array passed alongside
  // EMPTY gates MUST be ignored. Re-add a numeric fallback and this fails.
  const asTwoArg = deriveSkippedStepNumbers as unknown as (
    gates: string[] | undefined,
    legacyNumbers?: number[],
  ) => number[];
  assert.deepEqual(
    asTwoArg([], [2, 3]),
    [],
    'empty gates must yield [] even when legacy numbers are present (no fallback)',
  );
});
