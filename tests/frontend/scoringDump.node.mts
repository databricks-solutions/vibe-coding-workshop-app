// Scoring parity dumper (Phase 3 T5 PR3c).
//
// Run: node --experimental-strip-types tests/frontend/scoringDump.node.mts
//
// Emits the REAL src/constants/scoring.ts STEP_SCORES and CHAPTERS as JSON on
// stdout so the Python BE<->FE parity test (tests/workshop/
// test_completion_keying_aggregations.py) can assert they equal the backend's
// lakebase.STEP_SCORES / CHAPTERS key-for-key and value-for-value. Mirrors the
// mergeStatus/stepNumbersToGates .node pattern — no vitest, imports the actual
// TS source (not a stand-in) so drift between the two copies is caught.

import { STEP_SCORES, CHAPTERS } from '../../src/constants/scoring.ts';

const chapters: Record<string, { steps: number[]; display: string }> = {};
for (const [name, info] of Object.entries(CHAPTERS)) {
  chapters[name] = {
    steps: Array.from(info.steps).sort((a, b) => a - b),
    display: info.display,
  };
}

process.stdout.write(
  JSON.stringify({ step_scores: STEP_SCORES, chapters }),
);
