// Track-rule parity dumper (session linking: one engine, two interfaces).
//
// Run: node --experimental-strip-types tests/frontend/trackRulesDump.node.mts
//
// Emits the REAL src/constants/trackNames.ts names and the workflowSections.ts
// chain helpers, evaluated over every level and a few completed-step sets, as
// JSON on stdout. tests/workshop/test_track_switch_parity.py compares them with
// the Python ports in src/backend/workshop/track_switch.py and track_names.py,
// so the MCP track switch and the web track picker cannot drift apart.

import { loadComponentModule } from './loadComponent.ts';

type Sections = typeof import('../../src/constants/workflowSections.ts');
type Names = typeof import('../../src/constants/trackNames.ts');
const sections = await loadComponentModule<Sections>('src/constants/workflowSections.ts');
const { TRACK_DISPLAY_NAMES } = await loadComponentModule<Names>('src/constants/trackNames.ts');

const levels = Object.keys(sections.WORKSHOP_LEVELS) as Array<keyof typeof sections.WORKSHOP_LEVELS>;
const chains = [null, 'app', 'lakehouse', 'reverse'] as const;
// Not started, started, started with an Apps+Lakebase step, started deep in Lakehouse.
const stepSets: number[][] = [[], [1], [1, 2], [1, 2, 5], [1, 2, 3, 10, 12]];

const cases: unknown[] = [];
for (const level of levels) {
  for (const steps of stepSets) {
    const done = new Set(steps);
    for (const chain of chains) {
      cases.push({
        level,
        steps,
        chain,
        activeChain: sections.getActiveChain(level, done, chain),
      });
    }
    cases.push({ level, steps, derived: sections.deriveInitialChainContext(level, done) });
  }
  for (const next of levels) {
    for (const chain of chains) {
      cases.push({ prevLevel: level, nextLevel: next, chain, computed: sections.computeChainContext(chain, level, next) });
    }
    cases.push({ from: level, to: next, forward: sections.isForwardProgression(level, next) });
  }
}

process.stdout.write(
  JSON.stringify({
    levels,
    names: TRACK_DISPLAY_NAMES,
    useCaseLock: sections.USE_CASE_LEVEL_LOCK,
    progressionChains: sections.PROGRESSION_CHAINS,
    cases,
  }),
);
