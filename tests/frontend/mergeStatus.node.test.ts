// Node unit test for the pure status-projection overlay (Phase 3 T5 PR2, Work B).
//
// Run: node --experimental-strip-types --test tests/frontend/mergeStatus.node.test.ts
//
// No React/DOM/vitest — mirrors the retired parity-oracle `node` pattern. The
// first test REPRODUCES the flicker (naive endpoint-only projection renders a
// just-completed step not-done) and proves the overlay fixes it; the rest cover
// endpoint-ahead, steady-state agreement, and convergence (merged == endpoint
// once the refetch lands).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeStatus,
  projectEndpointDone,
  type OutlineStatusItem,
} from '../../src/constants/mergeStatus.ts';

// A tiny stand-in for ALL_STEPS' SECTION_TAG_TO_STEP_NUMBER. Keeping it local
// keeps this test free of the workflowSections module (pure-helper contract).
const TAG_TO_NUMBER: Record<string, number> = {
  define_intent: 1,
  project_setup: 2,
  prd_generation: 3,
  build_app: 4,
  deploy_app: 5,
};

test('REPRODUCE-THEN-FIX: overlay keeps a just-completed step done while the endpoint lags', () => {
  // The persist->refetch window: the user just completed step 3 (project_setup
  // is done, prd_generation optimistically checked locally), but the endpoint
  // snapshot taken before/during persist still shows prd_generation as
  // 'current' (not yet 'done').
  const laggingOutline: OutlineStatusItem[] = [
    { sectionTag: 'define_intent', status: 'done' },
    { sectionTag: 'project_setup', status: 'done' },
    { sectionTag: 'prd_generation', status: 'current' }, // endpoint hasn't caught up
    { sectionTag: 'build_app', status: 'locked' },
    { sectionTag: 'deploy_app', status: 'locked' },
  ];
  const localOptimistic = [1, 2, 3]; // 3 = prd_generation, just completed

  // The FLICKER: a naive endpoint-only projection renders step 3 NOT done.
  const naive = projectEndpointDone(laggingOutline, TAG_TO_NUMBER);
  assert.equal(naive.has(3), false, 'naive projection reproduces the flicker (step 3 not-done)');

  // The FIX: the overlay renders step 3 done throughout the window.
  const merged = mergeStatus(localOptimistic, laggingOutline, TAG_TO_NUMBER);
  assert.equal(merged.has(3), true, 'overlay keeps the just-completed step done');
  // ...and it did not lose the endpoint-confirmed steps either.
  assert.equal(merged.has(1), true);
  assert.equal(merged.has(2), true);
});

test('endpoint-ahead: an endpoint-done step renders done even when absent from the local set', () => {
  // Cross-surface (e.g. MCP) completion: endpoint reports build_app done, but
  // the local optimistic set never marked it.
  const outline: OutlineStatusItem[] = [
    { sectionTag: 'define_intent', status: 'done' },
    { sectionTag: 'project_setup', status: 'done' },
    { sectionTag: 'prd_generation', status: 'done' },
    { sectionTag: 'build_app', status: 'done' },
    { sectionTag: 'deploy_app', status: 'current' },
  ];
  const localOptimistic = [1]; // only define_intent tracked locally

  const merged = mergeStatus(localOptimistic, outline, TAG_TO_NUMBER);
  assert.equal(merged.has(4), true, 'endpoint-done build_app shows done from endpoint truth');
  assert.equal(merged.has(1), true, 'local optimistic step still shown');
});

test('steady-state: when local and endpoint agree, merged equals the endpoint projection', () => {
  const outline: OutlineStatusItem[] = [
    { sectionTag: 'define_intent', status: 'done' },
    { sectionTag: 'project_setup', status: 'done' },
    { sectionTag: 'prd_generation', status: 'current' },
    { sectionTag: 'build_app', status: 'locked' },
    { sectionTag: 'deploy_app', status: 'locked' },
  ];
  const localOptimistic = [1, 2];

  const endpoint = projectEndpointDone(outline, TAG_TO_NUMBER);
  const merged = mergeStatus(localOptimistic, outline, TAG_TO_NUMBER);
  assert.deepEqual([...merged].sort(), [...endpoint].sort(), 'no divergence in steady state');
});

test('CONVERGENCE (not masking): once the refetch lands, merged == endpoint', () => {
  // The endpoint has caught up — prd_generation is now 'done'. The local
  // optimistic set still holds {1,2,3}. The overlay must add NOTHING beyond the
  // endpoint set: the merged set equals the endpoint projection, proving the
  // overlay converges to endpoint truth rather than pinning a stale local value.
  const convergedOutline: OutlineStatusItem[] = [
    { sectionTag: 'define_intent', status: 'done' },
    { sectionTag: 'project_setup', status: 'done' },
    { sectionTag: 'prd_generation', status: 'done' }, // endpoint caught up
    { sectionTag: 'build_app', status: 'current' },
    { sectionTag: 'deploy_app', status: 'locked' },
  ];
  const localOptimistic = [1, 2, 3];

  const endpoint = projectEndpointDone(convergedOutline, TAG_TO_NUMBER);
  const merged = mergeStatus(localOptimistic, convergedOutline, TAG_TO_NUMBER);
  assert.deepEqual([...merged].sort(), [...endpoint].sort(), 'overlay converges to endpoint truth');
});

test('unmapped tags are dropped, never mis-indexed', () => {
  const outline: OutlineStatusItem[] = [
    { sectionTag: 'define_intent', status: 'done' },
    { sectionTag: 'ghost_tag_not_in_map', status: 'done' },
  ];
  const merged = mergeStatus([], outline, TAG_TO_NUMBER);
  assert.deepEqual([...merged], [1], 'only the mapped done tag survives');
});
