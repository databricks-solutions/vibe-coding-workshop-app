// Node unit test for gate-first SKIPPED hydration (Phase 3 T5 PR3b′, closes R2).
//
// Run: node --experimental-strip-types --test tests/frontend/deriveSkippedStepNumbers.node.test.ts
//
// No React/DOM/vitest — mirrors stepNumbersToGates.node.test.ts / mergeStatus.node.test.ts.
// It imports the REAL workflowSections.ts bridge (completedGatesToStepNumbers over
// the actual ALL_STEPS global map), then models the App's two skipped-read
// strategies EXACTLY as they appear at the load sites (App.tsx:476, :633):
//
//   rawSkippedRead      — the OLD read: `response.skipped_steps || []`
//                         (ignores skipped_gates entirely).
//   gateFirstSkippedRead — the NEW read: byte-identical to the body of
//                         deriveSkippedStepNumbers (gates → numbers via the REAL
//                         bridge, else fall back to the legacy numbers).
//
// TAMPER STORY (both directions):
//  • FAIL-BEFORE: a session hydrated SKIPPED-ONLY-VIA-GATES (skipped_gates
//    populated, skipped_steps empty/null — the shape PR3a's dual-write produces
//    for engine/MCP-origin sessions, and the shape after the eventual
//    skipped_steps column drop) fed through the OLD rawSkippedRead yields an
//    EMPTY skipped Set, because the gates are never read back. Skipped steps
//    silently render as not-skipped → progress lost. That divergence is the R2
//    defect this PR closes.
//  • PASS-AFTER: the SAME gate-only session fed through gateFirstSkippedRead
//    recovers the exact global-number Set — identical to the number-populated
//    equivalent — by mapping skipped_gates through the real bridge.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { completedGatesToStepNumbers } from '../../src/constants/workflowSections.ts';

// Minimal shape of the load response fields the skipped read touches.
interface SkippedReadResponse {
  skipped_gates?: string[];
  skipped_steps?: number[];
}

// The OLD read, verbatim from App.tsx:476 / :633 before PR3b′.
function rawSkippedRead(response: SkippedReadResponse): number[] {
  return response.skipped_steps || [];
}

// The NEW read: byte-identical to the body of deriveSkippedStepNumbers (App.tsx),
// delegating to the REAL bridge over ALL_STEPS.
function gateFirstSkippedRead(response: SkippedReadResponse): number[] {
  if (response.skipped_gates && response.skipped_gates.length > 0) {
    return completedGatesToStepNumbers(response.skipped_gates);
  }
  return response.skipped_steps || [];
}

// The App builds the skipped Set as `setSkippedSteps(new Set(array))`.

test('genie-accelerator (globals 57+): gate-only session hydrates the same skipped Set as the number equivalent', () => {
  // Semantic-layer tags whose global numbers are 57/58/59 — the high globals the
  // legacy dense-index read cannot line up (exactly why the App must map gates).
  const skippedTags = ['semlayer_locate', 'semlayer_profile', 'semlayer_measures'];
  const expectedNumbers = completedGatesToStepNumbers(skippedTags); // [57, 58, 59]
  assert.deepEqual([...expectedNumbers].sort((a, b) => a - b), [57, 58, 59]);

  const numberPopulated: SkippedReadResponse = { skipped_gates: [], skipped_steps: expectedNumbers };
  const gateOnly: SkippedReadResponse = { skipped_gates: skippedTags, skipped_steps: [] };

  // Control: number-populated session hydrates the expected set under both reads.
  const numberSet = new Set(rawSkippedRead(numberPopulated));
  assert.deepEqual([...numberSet].sort((a, b) => a - b), [57, 58, 59]);

  // PASS-AFTER: gate-first read recovers the identical set from gates alone.
  const gateFirstSet = new Set(gateFirstSkippedRead(gateOnly));
  assert.deepEqual(
    [...gateFirstSet].sort((a, b) => a - b),
    [...numberSet].sort((a, b) => a - b),
    'gate-first read recovers the number-populated skipped set',
  );

  // FAIL-BEFORE: the OLD raw read ignores skipped_gates → empty set ≠ number set.
  const rawSet = new Set(rawSkippedRead(gateOnly));
  assert.equal(rawSet.size, 0, 'raw read drops gate-only skips (the R2 regression)');
  assert.notDeepEqual(
    [...rawSet].sort((a, b) => a - b),
    [...numberSet].sort((a, b) => a - b),
    'raw read diverges from the number-populated equivalent (fail-before)',
  );
});

test('end-to-end: gate-only session hydrates the same skipped Set as the number equivalent', () => {
  // App-path tags with low globals: project_setup=2, cursor_copilot_ui_design=4.
  const skippedTags = ['project_setup', 'cursor_copilot_ui_design'];
  const expectedNumbers = completedGatesToStepNumbers(skippedTags); // [2, 4]
  assert.deepEqual([...expectedNumbers].sort((a, b) => a - b), [2, 4]);

  const numberPopulated: SkippedReadResponse = { skipped_gates: [], skipped_steps: expectedNumbers };
  const gateOnly: SkippedReadResponse = { skipped_gates: skippedTags, skipped_steps: [] };

  const numberSet = new Set(rawSkippedRead(numberPopulated));

  // PASS-AFTER: gate-first read recovers the identical set.
  const gateFirstSet = new Set(gateFirstSkippedRead(gateOnly));
  assert.deepEqual(
    [...gateFirstSet].sort((a, b) => a - b),
    [...numberSet].sort((a, b) => a - b),
    'gate-first read recovers the number-populated skipped set',
  );

  // FAIL-BEFORE: raw read yields the empty set for a gate-only session.
  const rawSet = new Set(rawSkippedRead(gateOnly));
  assert.equal(rawSet.size, 0, 'raw read drops gate-only skips (fail-before)');
  assert.notDeepEqual(
    [...rawSet].sort((a, b) => a - b),
    [...numberSet].sort((a, b) => a - b),
    'raw read diverges from the number-populated equivalent (fail-before)',
  );
});

test('legacy web session (no gates): gate-first read falls back to the stored skipped_steps', () => {
  // Symmetric to deriveCompletedStepNumbers: absent/empty gates → legacy numbers.
  const legacy: SkippedReadResponse = { skipped_gates: [], skipped_steps: [2, 3] };
  assert.deepEqual(gateFirstSkippedRead(legacy).sort((a, b) => a - b), [2, 3]);

  const noGatesField: SkippedReadResponse = { skipped_steps: [4] };
  assert.deepEqual(gateFirstSkippedRead(noGatesField), [4]);

  const empty: SkippedReadResponse = {};
  assert.deepEqual(gateFirstSkippedRead(empty), []);
});
