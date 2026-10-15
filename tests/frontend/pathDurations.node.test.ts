// Node unit test for the Genie Accelerator build-time bar (genie-default-ontology
// PR 1, R7): Genie Ontology now sits in the AI and Agents chapter, right after the
// Genie Agent and before Activation, so its 25 minutes join the AI and Agents bucket.
// Ontology off, the bar is what it was before the move.
//
// Run: node --experimental-strip-types --test tests/frontend/pathDurations.node.test.ts
//
// Loaded through Vite's module runner because pathDurations.ts uses extensionless imports.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadComponentModule } from './loadComponent.ts';

type DurationsModule = typeof import('../../src/constants/pathDurations.ts');

const { computeBuildTime } = await loadComponentModule<DurationsModule>('src/constants/pathDurations.ts');

function genieBar(includeGenieOntology: boolean, includeLakehouse: boolean) {
  const { total, buckets } = computeBuildTime({
    level: 'genie-accelerator',
    direction: 'forward',
    aiModules: new Set(['dashboard', 'genie', 'agent']),
    medallionLayers: new Set(['bronze', 'silver', 'gold']),
    completedSteps: new Set<number>(),
    includeLakehouse,
    includeGenieOntology,
  });
  return { total, buckets: buckets.map(({ id, minutes, sub }) => ({ id, minutes, sub })) };
}

const FOUNDATION = { id: 'foundation', minutes: 10, sub: [{ segment: 'define-usecase', minutes: 10 }] };
const LAKEHOUSE = { id: 'lakehouse', minutes: 90, sub: [{ segment: 'lakehouse', minutes: 90 }] };
const ACTIVATION = { id: 'activation', minutes: 60, sub: [{ segment: 'genie-activate', minutes: 60 }] };
const TAIL = {
  id: 'tail',
  minutes: 15,
  sub: [
    { segment: 'iterate-enhance', minutes: 10 },
    { segment: 'cleanup', minutes: 5 },
  ],
};

test('ontology on: its minutes follow the Genie Agent in the AI and Agents bucket', () => {
  const aiAgents = {
    id: 'ai-agents',
    minutes: 115,
    sub: [
      { segment: 'semantic-layer', minutes: 45 },
      { segment: 'genie-agent', minutes: 45 },
      { segment: 'genie-ontology', minutes: 25 },
    ],
  };
  assert.deepEqual(genieBar(true, false), { total: 200, buckets: [FOUNDATION, aiAgents, ACTIVATION, TAIL] });
  assert.deepEqual(genieBar(true, true), { total: 290, buckets: [FOUNDATION, LAKEHOUSE, aiAgents, ACTIVATION, TAIL] });
});

test('ontology off: the bar is unchanged (no ontology segment anywhere)', () => {
  const aiAgents = {
    id: 'ai-agents',
    minutes: 90,
    sub: [
      { segment: 'semantic-layer', minutes: 45 },
      { segment: 'genie-agent', minutes: 45 },
    ],
  };
  assert.deepEqual(genieBar(false, false), { total: 175, buckets: [FOUNDATION, aiAgents, ACTIVATION, TAIL] });
  assert.deepEqual(genieBar(false, true), { total: 265, buckets: [FOUNDATION, LAKEHOUSE, aiAgents, ACTIVATION, TAIL] });
});
