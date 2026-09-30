// Pure status-projection helpers for the read path (Phase 3 T5 PR2, Work B).
//
// NO React / DOM / workflowSections imports — this module is unit-testable in
// isolation via `node --experimental-strip-types` (mirrors the retired
// parity-oracle pattern; there is no JS unit runner in this repo).
//
// GET /api/track/{track}/outline returns per-step `status`
// ('done' | 'current' | 'locked' | 'skipped'). The sidebar/step surfaces render
// done-ness from a Set<number> of GLOBAL step numbers (ALL_STEPS). These helpers
// project the endpoint's `status: 'done'` onto that Set and overlay the local
// optimistic completions so a just-completed step never flickers back to
// not-done across the persist -> refetch window.

export type OutlineStatus = 'done' | 'current' | 'locked' | 'skipped';

export interface OutlineStatusItem {
  sectionTag: string;
  status: OutlineStatus;
}

/**
 * NAIVE endpoint-only projection (NO overlay). Maps every `status: 'done'` item
 * to its global step number via `tagToStepNumber`, dropping tags absent from the
 * map. This is the projection that FLICKERS: during the persist -> refetch
 * window a just-completed step is still 'current'/'locked' on the endpoint, so
 * it renders not-done. Exposed on its own so the flicker is reproducible in a
 * test and so the overlay's convergence can be asserted against it.
 */
export function projectEndpointDone(
  outline: readonly OutlineStatusItem[],
  tagToStepNumber: Readonly<Record<string, number>>,
): Set<number> {
  const done = new Set<number>();
  for (const item of outline) {
    if (item.status !== 'done') continue;
    const n = tagToStepNumber[item.sectionTag];
    if (n != null) done.add(n);
  }
  return done;
}

/**
 * Endpoint-truth-plus-local-optimistic overlay (guardrail #4). Union of the
 * endpoint's done-set and the local optimistic completions: endpoint status is
 * the truth, but a step in the local optimistic done-set ALSO renders done so
 * the checkmark never flickers off while a persist/refetch is in flight.
 *
 * Convergence, not masking: the union only ADDS local numbers on top of the
 * endpoint projection. Once the refetch lands and the endpoint reports the step
 * as `done`, the local number is already in the endpoint set, so the merged set
 * equals the endpoint projection — the overlay pins nothing stale and cannot
 * hide an endpoint that legitimately drops a step.
 */
export function mergeStatus(
  localOptimistic: Iterable<number>,
  outline: readonly OutlineStatusItem[],
  tagToStepNumber: Readonly<Record<string, number>>,
): Set<number> {
  const merged = projectEndpointDone(outline, tagToStepNumber);
  for (const n of localOptimistic) merged.add(n);
  return merged;
}
