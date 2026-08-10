/**
 * Guards for the coherence gate on step 15.
 *
 * The gate's entire value comes from WHERE it sits. Solution Builder reviews coherence
 * ("data schema -> pipeline -> dashboard -> agent queries must align") *before* building,
 * because every break found afterwards is an empty widget or a question Genie cannot
 * answer, discovered once the pipeline already exists.
 *
 * So step 15 must lead the data-intelligence section on every path that contains it. That
 * is not obvious from the config: getFilteredSections reorders steps per level (the
 * reverse-* paths swap 16 and 17) and filters them (genie-accelerator drops several), so
 * ordering is asserted against the resolved sections rather than the declaration.
 *
 * Pure data assertions, so no browser navigation or seeded database is needed.
 */

import { test, expect } from '@playwright/test';
import {
  ALL_STEPS,
  WORKFLOW_SECTIONS,
  getFilteredSections,
  type WorkshopLevel,
} from '../../src/constants/workflowSections';

const ALL_LEVELS: WorkshopLevel[] = [
  'app-only', 'app-database', 'lakehouse', 'lakehouse-di', 'end-to-end',
  'accelerator', 'genie-accelerator', 'data-engineering-accelerator',
  'skills-accelerator', 'agents-accelerator', 'reverse-lakehouse',
  'reverse-lakehouse-di', 'reverse-lakebase', 'reverse-app',
];

const GATE = 15;
// The build steps whose artefacts the trace has to hold up for. If the gate came after
// any of these, the attendee would find a broken link only after building on it.
const BUILDS_ON_THE_TRACE = [16, 17, 18, 19, 24, 25];

test.describe('the coherence gate', () => {
  test('step 15 exists and is the use-case plan', () => {
    expect(ALL_STEPS[GATE]).toBeTruthy();
    expect(ALL_STEPS[GATE].sectionTag).toBe('usecase_plan');
  });

  test('leads the data-intelligence section as declared', () => {
    const section = WORKFLOW_SECTIONS.find(s => s.id === 'data-intelligence');
    expect(section, 'data-intelligence section is missing').toBeTruthy();
    expect(
      section!.steps[0].number,
      'step 15 no longer leads data-intelligence, so the gate now happens after a build step'
    ).toBe(GATE);
  });

  test('precedes every step that builds on the trace, on every level', () => {
    for (const level of ALL_LEVELS) {
      const sections = getFilteredSections(level);

      // Flatten to the order an attendee actually walks.
      const walk: number[] = [];
      for (const section of sections) {
        for (const step of section.steps) walk.push(step.number);
      }

      if (!walk.includes(GATE)) {
        // A level without the gate must also have none of the steps that depend on it —
        // otherwise dashboards and Genie get built with no coherence check at all.
        const orphans = BUILDS_ON_THE_TRACE.filter(n => walk.includes(n));
        expect(
          orphans,
          `${level} builds ${orphans.join(', ')} but never reaches the coherence gate`
        ).toEqual([]);
        continue;
      }

      const gateAt = walk.indexOf(GATE);
      for (const build of BUILDS_ON_THE_TRACE) {
        const at = walk.indexOf(build);
        if (at === -1) continue;
        expect(
          at,
          `${level}: step ${build} comes before the coherence gate (positions ` +
          `${at} vs ${gateAt}), so the trace is checked after it was needed`
        ).toBeGreaterThan(gateAt);
      }
    }
  });

  test('the gate comes after the data it reasons about', () => {
    // The trace names a column, so the data has to exist first. Pre-work (57-59) commits
    // the model and provisions the dataset; the gate reads {fact_grain} and {entities}
    // from it, which resolve to nothing if it has not happened.
    for (const level of ALL_LEVELS) {
      const walk: number[] = [];
      for (const section of getFilteredSections(level)) {
        for (const step of section.steps) walk.push(step.number);
      }
      if (!walk.includes(GATE)) continue;

      const modelAt = walk.indexOf(58);
      if (modelAt === -1) continue;
      expect(
        walk.indexOf(GATE),
        `${level}: the coherence gate runs before the data model is committed, so its ` +
        `{fact_grain} and {entities} tokens have nothing to substitute`
      ).toBeGreaterThan(modelAt);
    }
  });
});
