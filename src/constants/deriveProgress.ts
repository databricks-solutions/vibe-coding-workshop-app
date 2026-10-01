// Gate-first session-progress hydration (extracted from App.tsx in Phase 3
// T5 R4b, no behaviour change). Engine/MCP/web sessions all record progress as
// sectionTag-keyed gates — the cross-surface source of truth — which map to the
// App's fixed global ALL_STEPS numbers via completedGatesToStepNumbers. Gates
// are the ONLY source (R4b): the legacy numeric fallback is gone, so a session
// started on any surface resumes on the correct step purely from its gates.

import { completedGatesToStepNumbers } from './workflowSections.ts';

// Derive completed step NUMBERS (global ALL_STEPS numbering) from a loaded
// session's completed gate set.
export function deriveCompletedStepNumbers(
  completedGates: string[] | undefined,
): number[] {
  return completedGatesToStepNumbers(completedGates || []);
}

// Derive skipped step NUMBERS gate-first — the exact skipped-side mirror of
// deriveCompletedStepNumbers. Reuses the SAME bridge (it maps ANY sectionTag
// list to the App's fixed global numbers, so no skipped-specific bridge is
// needed).
export function deriveSkippedStepNumbers(
  skippedGates: string[] | undefined,
): number[] {
  return completedGatesToStepNumbers(skippedGates || []);
}
