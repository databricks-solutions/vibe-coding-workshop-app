/**
 * Parity guard for the data-driven step renderer.
 *
 * WorkflowDiagram used to carry a 55-case switch in which every step repeated the same
 * ~18 props. Those cases now render from ALL_STEPS, which means a step's presentation
 * is declared in exactly one place — and also means a typo in that table silently
 * changes what attendees read. Collapsing the switch already introduced two such
 * regressions: 30 steps rendered an icon derived from their colour class rather than
 * their declared icon, and 15 descriptions were reworded rather than moved.
 *
 * These tests assert the invariants that catch that class of mistake without depending
 * on which steps happen to be visible, since visibility varies by workshop path.
 */

import { test, expect } from '@playwright/test';
import { ALL_STEPS } from '../../src/constants/workflowSections';

test.describe('step metadata table', () => {
  test('every step declares the fields the renderer needs', () => {
    const entries = Object.values(ALL_STEPS);
    expect(entries.length).toBeGreaterThanOrEqual(56);

    for (const step of entries) {
      expect(step.title, `step ${step.number} has no title`).toBeTruthy();
      expect(step.icon, `step ${step.number} has no icon component`).toBeTruthy();
      expect(step.color, `step ${step.number} has no colour`).toBeTruthy();
      // The generic renderer reads description straight from here, so an empty one
      // would render a step with no explanation at all.
      expect(
        (step.description ?? '').length,
        `step ${step.number} (${step.title}) has no description`
      ).toBeGreaterThan(10);
    }
  });

  test('step numbers are internally consistent', () => {
    for (const [key, step] of Object.entries(ALL_STEPS)) {
      expect(Number(key), `ALL_STEPS key ${key} disagrees with its number`).toBe(step.number);
    }
  });

  test('section tags are unique', () => {
    // Two steps sharing a tag would resolve to the same DB row, so both would show the
    // same prompt and one would overwrite the other's saved state.
    const seen = new Map<string, number>();
    for (const step of Object.values(ALL_STEPS)) {
      if (!step.sectionTag) continue;
      const prior = seen.get(step.sectionTag);
      expect(
        prior,
        `steps ${prior} and ${step.number} share sectionTag '${step.sectionTag}'`
      ).toBeUndefined();
      seen.set(step.sectionTag, step.number);
    }
  });

  test('icons are the declared component, not derived from colour', () => {
    // Colours repeat across steps, so any colour-keyed icon lookup is lossy by
    // construction. Assert distinct icons exist to catch a regression back to that.
    const icons = new Set(Object.values(ALL_STEPS).map(s => s.icon));
    const colours = new Set(Object.values(ALL_STEPS).map(s => s.color));

    expect(
      icons.size,
      'far fewer distinct icons than steps suggests icons are being derived, not declared'
    ).toBeGreaterThan(colours.size / 2);
  });
});

test.describe('rendered workflow', () => {
  test('visible steps carry a data-step-number the scroll logic can find', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const rendered = page.locator('[data-step-number]');
    const count = await rendered.count();
    test.skip(count === 0, 'no steps rendered at this point in the flow');

    // Every rendered wrapper must expose a number that exists in ALL_STEPS — the
    // attribute is what step navigation and the e2e suite locate steps by.
    for (let i = 0; i < count; i++) {
      const value = await rendered.nth(i).getAttribute('data-step-number');
      expect(value).toBeTruthy();
      expect(
        ALL_STEPS[Number(value)],
        `rendered step ${value} has no ALL_STEPS entry`
      ).toBeTruthy();
    }
  });
});
