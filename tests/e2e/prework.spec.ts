/**
 * Guards for the data pre-work section.
 *
 * Every downstream chapter builds on the dataset chosen here: today step 4 tells the
 * agent to use "static mock data arrays… hardcoded" and step 7 to invent its own seed
 * rows, so without this section the coding assistant decides what the data is. That
 * makes ORDERING the load-bearing property — pre-work has to come before anything that
 * consumes data, on every path, or an attendee builds first and chooses second.
 *
 * Pure data assertions, so no browser navigation or seeded database is needed.
 */

import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  ALL_STEPS,
  WORKFLOW_SECTIONS,
  getFilteredSections,
  type WorkshopLevel,
} from '../../src/constants/workflowSections';
import { CHAPTERS, STEP_SCORES } from '../../src/constants/scoring';
import { PATH_DURATIONS, SEGMENT_TO_BUCKET } from '../../src/constants/pathDurations';

const ALL_LEVELS: WorkshopLevel[] = [
  'app-only', 'app-database', 'lakehouse', 'lakehouse-di', 'end-to-end',
  'accelerator', 'genie-accelerator', 'data-engineering-accelerator',
  'skills-accelerator', 'agents-accelerator', 'reverse-lakehouse',
  'reverse-lakehouse-di', 'reverse-lakebase', 'reverse-app',
];

const PREWORK_STEPS = [57, 58, 59];

test.describe('pre-work section', () => {
  test('exists and owns exactly the pre-work steps', () => {
    const section = WORKFLOW_SECTIONS.find(s => s.id === 'pre-work');

    expect(section, 'pre-work section is missing').toBeTruthy();
    expect(section!.steps.map(s => s.number)).toEqual(PREWORK_STEPS);
  });

  test('every step declares the fields the renderer needs', () => {
    for (const n of PREWORK_STEPS) {
      const step = ALL_STEPS[n];
      expect(step, `step ${n} missing from ALL_STEPS`).toBeTruthy();
      expect(step.sectionTag, `step ${n} has no sectionTag`).toBeTruthy();
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.icon, `step ${n} has no icon`).toBeTruthy();
    }
  });

  test('appears on every workshop level', () => {
    // Data is not a Lakehouse-only concern: the app and Lakebase paths currently build on
    // invented mock rows, which is the same problem.
    for (const level of ALL_LEVELS) {
      const ids = getFilteredSections(level, []).map(s => s.id);
      expect(ids, `pre-work missing on ${level}`).toContain('pre-work');
    }
  });

  test('comes before anything that builds on the data', () => {
    const consumers = ['databricks-app', 'lakebase', 'lakehouse', 'data-intelligence'];

    for (const level of ALL_LEVELS) {
      const ids = getFilteredSections(level, []).map(s => s.id);
      const preIndex = ids.indexOf('pre-work');

      for (const consumer of consumers) {
        const consumerIndex = ids.indexOf(consumer);
        if (consumerIndex < 0) continue;
        expect(
          preIndex,
          `on ${level}, pre-work must precede ${consumer} or the attendee builds before choosing data`
        ).toBeLessThan(consumerIndex);
      }
    }
  });

  test('steps are scored and belong to a chapter', () => {
    for (const n of PREWORK_STEPS) {
      expect(STEP_SCORES[n], `step ${n} scores nothing`).toBeGreaterThan(0);
    }

    const chapter = Object.values(CHAPTERS).find(c => PREWORK_STEPS.every(n => c.steps.has(n)));
    expect(chapter, 'pre-work steps belong to no chapter, so they never fire a milestone').toBeTruthy();
  });

  test('every level budgets time for pre-work', () => {
    // A segment with no minutes renders as a zero-width band, which reads as missing.
    for (const level of ALL_LEVELS) {
      const segments = PATH_DURATIONS[level]?.segments ?? {};
      expect(segments['pre-work'], `no pre-work minutes on ${level}`).toBeGreaterThan(0);
    }
    expect(SEGMENT_TO_BUCKET['pre-work']).toBeTruthy();
  });

  test('declared totals match the sum of their segments', () => {
    // Guards the arithmetic after adding a segment to fourteen hand-maintained rows.
    for (const level of ALL_LEVELS) {
      const entry = PATH_DURATIONS[level];
      if (!entry) continue;
      const sum = Object.values(entry.segments).reduce((a, b) => a + (b ?? 0), 0);
      expect(entry.totalMinutes, `${level} total does not match its segments`).toBe(sum);
    }
  });

  test('every pre-work step has a case in the render switch', () => {
    /**
     * The bug this caught, in a real browser: renderSectionSteps is a switch ending in
     * `default: return null`, so a step that is in a section but missing a case renders
     * NOTHING. Steps 57-59 appeared in the sidebar and in the "0/17 done" count while
     * their cards silently did not exist — no error, no warning.
     *
     * Asserted against the source because the failure is a missing branch, which no
     * amount of config inspection reveals.
     */
    const source = readFileSync(
      new URL('../../src/components/WorkflowDiagram.tsx', import.meta.url),
      'utf8'
    );

    // Checked for EVERY step in EVERY section, not just the pre-work ones: the same
    // omission would silently hide any step added in future.
    const sectioned = new Set(
      WORKFLOW_SECTIONS.flatMap(s => s.steps.map(step => step.number))
    );
    const missing = [...sectioned]
      .filter(n => !new RegExp(`case ${n}:`).test(source))
      .sort((a, b) => a - b);

    expect(
      missing,
      `these steps are in a section but have no case in renderSectionSteps, so their ` +
      `cards never render: ${missing.join(', ')}`
    ).toEqual([]);
  });
});
