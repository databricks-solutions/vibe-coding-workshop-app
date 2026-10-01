// Node unit test for gate-first COMPLETED hydration — the frontend half of
// Phase 3 T5 R4a required test 3 (MCP → SPA visibility WITHOUT the numbers).
//
// Run: node --experimental-strip-types --test tests/frontend/deriveCompletedStepNumbers.node.test.ts
//
// No React/DOM/vitest — mirrors deriveSkippedStepNumbers.node.test.ts. It imports
// the REAL workflowSections.ts bridge (completedGatesToStepNumbers over the actual
// ALL_STEPS global map), then models the App's completed-read strategy EXACTLY as
// deriveCompletedStepNumbers appears in App.tsx:
//
//   deriveCompletedStepNumbers — gates → global numbers via the REAL bridge, else
//                                fall back to the legacy numbers.
//
// R4a context: an MCP vibe_complete_step now persists ONLY completed_gates (the
// current_step/completed_steps number columns were retired). A gate-only session
// (completed_gates populated, completed_steps empty/absent — the R4a shape) must
// still hydrate the SPA step indicator to the correct GLOBAL step numbers purely
// from the gates. The backend half is tests/workshop/test_sync_bridge.py.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { completedGatesToStepNumbers } from '../../src/constants/workflowSections.ts';

interface CompletedReadResponse {
  completed_gates?: string[];
  completed_steps?: number[];
}

// Byte-identical to the body of deriveCompletedStepNumbers (App.tsx).
function deriveCompletedStepNumbers(response: CompletedReadResponse): number[] {
  const completedGates = response.completed_gates;
  if (completedGates && completedGates.length > 0) {
    return completedGatesToStepNumbers(completedGates);
  }
  return response.completed_steps || [];
}

test('MCP gate-only session (genie globals 57+): hydrates the correct global steps with NO completed_steps', () => {
  // Semantic-layer tags → globals 57/58/59. The MCP shape after R4a: gates set,
  // completed_steps absent (never written).
  const completedTags = ['semlayer_locate', 'semlayer_profile', 'semlayer_measures'];
  const expected = completedGatesToStepNumbers(completedTags); // [57, 58, 59]
  assert.deepEqual([...expected].sort((a, b) => a - b), [57, 58, 59]);

  const gateOnly: CompletedReadResponse = { completed_gates: completedTags };
  const derived = deriveCompletedStepNumbers(gateOnly);
  assert.deepEqual(
    [...derived].sort((a, b) => a - b),
    [57, 58, 59],
    'gate-only MCP session maps to the correct global steps',
  );
});

test('MCP gate-only session (end-to-end low globals): project_setup/prd map correctly', () => {
  const completedTags = ['project_setup', 'prd_generation'];
  const expected = completedGatesToStepNumbers(completedTags);
  assert.ok(expected.length === 2, 'both tags resolve to globals');

  const gateOnly: CompletedReadResponse = { completed_gates: completedTags, completed_steps: [] };
  const derived = deriveCompletedStepNumbers(gateOnly);
  assert.deepEqual(
    [...derived].sort((a, b) => a - b),
    [...expected].sort((a, b) => a - b),
    'gate-first read recovers the globals from gates alone (ignores empty completed_steps)',
  );
});

test('legacy web session (no gates): falls back to the stored completed_steps', () => {
  const legacy: CompletedReadResponse = { completed_gates: [], completed_steps: [2, 3] };
  assert.deepEqual(deriveCompletedStepNumbers(legacy).sort((a, b) => a - b), [2, 3]);

  const noGatesField: CompletedReadResponse = { completed_steps: [4] };
  assert.deepEqual(deriveCompletedStepNumbers(noGatesField), [4]);

  const empty: CompletedReadResponse = {};
  assert.deepEqual(deriveCompletedStepNumbers(empty), []);
});
