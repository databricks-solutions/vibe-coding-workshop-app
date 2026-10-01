// Node unit test for gate-first COMPLETED hydration — Phase 3 T5 R4b.
//
// Run: node --experimental-strip-types --test tests/frontend/deriveCompletedStepNumbers.node.test.ts
//
// No React/DOM/vitest. It imports the REAL function under test
// (src/constants/deriveProgress.ts), which was extracted out of App.tsx in R4b
// (no behaviour change) precisely so these tests exercise the production code
// instead of a hand-copied model. deriveCompletedStepNumbers is gates-only: it
// maps completed_gates -> global numbers via the REAL workflowSections bridge
// and has NO numeric fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveCompletedStepNumbers } from '../../src/constants/deriveProgress.ts';
import { completedGatesToStepNumbers } from '../../src/constants/workflowSections.ts';

test('MCP gate-only session (genie globals 57+): hydrates the correct global steps', () => {
  const completedTags = ['semlayer_locate', 'semlayer_profile', 'semlayer_measures'];
  const expected = completedGatesToStepNumbers(completedTags); // [57, 58, 59]
  assert.deepEqual([...expected].sort((a, b) => a - b), [57, 58, 59]);

  const derived = deriveCompletedStepNumbers(completedTags);
  assert.deepEqual(
    [...derived].sort((a, b) => a - b),
    [57, 58, 59],
    'gate-only session maps to the correct global steps',
  );
});

test('end-to-end low globals: project_setup/prd map correctly from gates', () => {
  const completedTags = ['project_setup', 'prd_generation'];
  const expected = completedGatesToStepNumbers(completedTags);
  assert.ok(expected.length === 2, 'both tags resolve to globals');
  assert.deepEqual(
    [...deriveCompletedStepNumbers(completedTags)].sort((a, b) => a - b),
    [...expected].sort((a, b) => a - b),
  );
});

test('empty / absent gates hydrate to no completions', () => {
  assert.deepEqual(deriveCompletedStepNumbers([]), []);
  assert.deepEqual(deriveCompletedStepNumbers(undefined), []);
});

test('TAMPER: no numeric fallback — a legacy numbers argument is ignored', () => {
  // The retired behaviour fell back to a `completed_steps` number array when gates
  // were empty. deriveCompletedStepNumbers is now gates-only (single arg). View it
  // through a 2-arg type and pass stale legacy numbers alongside EMPTY gates: a
  // gates-only function MUST ignore them and return []. If a numeric fallback is
  // re-added to the real function, it returns [2, 3] and this assertion fails.
  const asTwoArg = deriveCompletedStepNumbers as unknown as (
    gates: string[] | undefined,
    legacyNumbers?: number[],
  ) => number[];
  assert.deepEqual(
    asTwoArg([], [2, 3]),
    [],
    'empty gates must yield [] even when legacy numbers are present (no fallback)',
  );
});
