// Node tests for where "Back to the idea" lands in the Insights flow, and for the words the
// area match must never give as a reason ("Your idea mentions inbound, gates, if").
//
// Run: node --experimental-strip-types --test tests/frontend/insightsNavigation.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewTarget, reviewsInInsights } from '../../src/components/insights/reviewTarget.ts';
import { INSIGHTS_STEPS, STEPS, stepsFor } from '../../src/components/journeykit/engine/types.ts';
import { layoutTrail } from '../../src/components/journeykit/stage/trailGeometry.ts';

test('Ideate and Insights walk the exact same 7-step trail including Questions for Genie', () => {
  const expected = ['spark', 'map', 'clarify', 'shape', 'questions', 'impact', 'brief'];
  assert.deepEqual(STEPS.map(s => s.key), expected);
  assert.deepEqual(INSIGHTS_STEPS.map(s => s.key), expected);
  assert.deepEqual(stepsFor('ideate').map(s => s.key), expected);
  assert.deepEqual(stepsFor('insights').map(s => s.key), expected);
});

test('Ideate-to-Insights handoff shows ClimbRoute on IdeaLockedScreen with Base Camp and 3 build stops ahead', () => {
  const locked = readFileSync(new URL('../../src/components/insights/screens/IdeaLockedScreen.tsx', import.meta.url), 'utf-8');
  assert.match(locked, /<ClimbRoute/);
  assert.match(locked, /steps=\{ideaLockedClimbSteps\(idea\)\}/);
  assert.match(locked, /campKey="brief"/);
  assert.match(locked, /analyze your data, build your solution, and deploy it/i);

  const progress = readFileSync(new URL('../../src/components/journeykit/stage/ideaProgress.ts', import.meta.url), 'utf-8');
  assert.match(progress, /Analyze your data/);
  assert.match(progress, /label: 'Build'/);
  assert.match(progress, /label: 'Deploy'/);
  assert.match(progress, /Next climb:/);

  const steps = STEPS.map(s => ({ key: s.key, label: s.label, icon: (() => null) as never, state: 'done' as const, optional: s.optional }));
  const frame = { base: 70, top: 32, left: 8, right: 90, rightWithBeyond: 70, beyondX: 88, dip: 14 };
  const active = layoutTrail(steps, frame, true, true);
  assert.equal(active.progressPts.length, active.main.length + 1);
  assert.deepEqual(active.progressPts.at(-1), active.beyond);
});

test('an Ideate idea built in Insights goes back inside the project, not to the Ideate one-pager', () => {
  assert.equal(reviewsInInsights({ mode: 'ideate', buildTarget: 'insights' }), true);
  assert.equal(reviewsInInsights({ mode: 'insights' }), true);
  assert.equal(reviewsInInsights({ mode: 'ideate', buildTarget: 'technical' }), false);
  assert.equal(reviewsInInsights({}), false);
});

test('the header bar asks the open project first and only falls back to Ideate when nobody took it', () => {
  const bar = readFileSync(new URL('../../src/components/journeykit/stage/BuildLinkBar.tsx', import.meta.url), 'utf-8');
  assert.match(bar, /reviewsInInsights\(idea\)/);
  assert.match(bar, /builtInInsights && reviewIdea\(\{ ideaId: idea\.id, to: 'idea' \}\)\) return;/);
  const flow = readFileSync(new URL('../../src/components/insights/InsightsFlow.tsx', import.meta.url), 'utf-8');
  assert.match(flow, /detail\.ideaId !== idea\.id\) return;\s*e\.preventDefault\(\);/);
  const handoff = readFileSync(new URL('../../src/components/journeykit/engine/handoff.ts', import.meta.url), 'utf-8');
  assert.match(handoff, /cancelable: true/);
});

test('a locked idea goes back to where its data was chosen', () => {
  assert.equal(reviewTarget('idea', '2026-10-19T16:00:00Z'), 'data');
});

test('update build still opens the locked idea summary', () => {
  assert.equal(reviewTarget('update', '2026-10-19T16:00:00Z'), 'locked');
});

test('an idea still being shaped opens its steps', () => {
  assert.equal(reviewTarget('idea', undefined), 'idea');
  assert.equal(reviewTarget('update', undefined), 'idea');
});

test('the listener in InsightsFlow uses reviewTarget', () => {
  const src = readFileSync(new URL('../../src/components/insights/InsightsFlow.tsx', import.meta.url), 'utf-8');
  assert.match(src, /setStage\(reviewTarget\(detail\.to, idea\.lockedAt\)\)/);
});

test('short function words are stop words for the area match', () => {
  const src = readFileSync(new URL('../../src/components/insights/blueprint/vocabulary.ts', import.meta.url), 'utf-8');
  const block = src.slice(src.indexOf('const STOP = ['), src.indexOf('];', src.indexOf('const STOP = [')));
  const stop = new Set([...block.matchAll(/'([^']+)'/g)].map(m => m[1]));
  for (const w of ['if', 'so', 'then', 'but', 'as', 'while']) assert.ok(stop.has(w), `${w} should be a stop word`);
});
