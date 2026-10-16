// Node render tests for the track picker's two tabs (Mock B) and the recommended
// Genie Accelerator card (R5 "Option A"): the Genie tab shows the card and its
// stage strip, the Other tracks tab shows today's columns and the direction
// toggle; the Genie tab follows the picker's lock rule, Reverse ETL and
// read-only; the two toggles live only in the card; the same card wherever
// PathAndArchitecture renders.
//
// Run: node --experimental-strip-types --test tests/frontend/GenieRecommendedCard.node.test.ts
//
// No DOM: server-rendered, so effects don't run (the card shows the template
// defaults) and clicks are covered by tests/e2e/connect-genie-code.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type Harness = typeof import('./levelSelectorHarness.ts');

const {
  LevelSelectorContent,
  GenieRecommendedCard,
  PathAndArchitecture,
  ReadOnlyProvider,
  computeBuildTime,
  formatHM,
  trackTabForLevel,
  ALL_AI_MODULES,
  ALL_MEDALLION_LAYERS,
} = await loadComponentModule<Harness>('tests/frontend/levelSelectorHarness.ts');

type SelectorProps = Parameters<typeof LevelSelectorContent>[0];
type PathProps = Parameters<typeof PathAndArchitecture>[0];

const noop = () => {};

function render(props: Partial<SelectorProps> = {}, readOnly = false) {
  const el = createElement(LevelSelectorContent, {
    selectedLevel: 'genie-accelerator',
    onLevelChange: noop,
    completedSteps: new Set<number>(),
    direction: 'forward',
    includeLakehouse: false,
    onIncludeLakehouseChange: noop,
    includeGenieOntology: true,
    onIncludeGenieOntologyChange: noop,
    ...props,
  } as SelectorProps);
  return renderToStaticMarkup(createElement(ReadOnlyProvider, { value: readOnly }, el));
}

function renderPath(props: Partial<PathProps> = {}, readOnly = false) {
  const el = createElement(PathAndArchitecture, {
    selectedLevel: 'genie-accelerator',
    onLevelChange: noop,
    completedSteps: new Set<number>(),
    forceExpanded: true,
    includeGenieOntology: true,
    onIncludeGenieOntologyChange: noop,
    ...props,
  } as PathProps);
  return renderToStaticMarkup(createElement(ReadOnlyProvider, { value: readOnly }, el));
}

const card = (html: string) => {
  const m = html.match(/<div data-testid="genie-recommended-card"[\s\S]*?(?=<div class="flex gap-3 mb-4">|$)/);
  assert.ok(m, 'the card renders');
  return m[0];
};
const chapterLine = (html: string) => html.match(/data-testid="genie-chapter-line">([^<]*)</)?.[1].replace(/&gt;/g, '>');
const cardButton = (html: string) => card(html).match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '';
const count = (html: string, s: string) => html.split(s).length - 1;
const tab = (html: string, which: 'genie' | 'other') =>
  html.match(new RegExp(`<button[^>]*data-testid="track-tab-${which}"[^>]*>`))?.[0] ?? '';

// --- the Genie view ---------------------------------------------------------------

test('Genie view: the card is selected, "Recommended track", no fold, the stage strip shows', () => {
  const html = render();
  assert.match(html, /data-testid="genie-recommended-card" data-selected="true"/);
  assert.match(card(html), /Recommended track/);
  assert.doesNotMatch(html, /Recommended for this workshop/);
  assert.match(card(html), />Selected</);
  assert.match(cardButton(html), /aria-pressed="true"/);
  assert.doesNotMatch(html, /other-paths-toggle|Choose a different path/, 'the fold is gone');
  assert.doesNotMatch(html, /data-testid="other-paths"/, 'the columns are on the Other tracks tab');
  assert.match(html, /Your Genie Accelerator Path/, 'the Genie stage strip shows');
});

test('the chapter line follows R7 and drops Ontology when unticked', () => {
  assert.equal(chapterLine(render()), 'Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App');
  assert.equal(chapterLine(render({ includeGenieOntology: false })), 'Metric View → Genie Agent → Dashboard → Lakebase sync → App');
  assert.equal(chapterLine(render({ includeLakehouse: true })), 'Lakehouse → Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App');
});

test('the two toggles live only in the card', () => {
  const html = render();
  assert.equal(count(html, 'Include Genie Ontology (Beta: needs Genie One Pages)'), 1);
  assert.equal(count(html, '>Include Lakehouse<'), 1);
  assert.match(card(html), /Include Genie Ontology \(Beta: needs Genie One Pages\)/);
  assert.match(card(html), />Include Lakehouse</);
  const other = render({ selectedLevel: 'agents-accelerator' });
  assert.equal(count(other, 'Include Genie Ontology'), 0, 'no toggles on the Other tracks view');
  assert.doesNotMatch(other.slice(other.indexOf('data-testid="other-paths"')), />Genie Accelerator</);
});

// --- the Other tracks view --------------------------------------------------------

test('Other tracks view: today\'s columns, no card, for every non-Genie level', () => {
  for (const level of ['app-only', 'app-database', 'lakehouse', 'lakehouse-di', 'end-to-end', 'agents-accelerator', 'data-engineering-accelerator', 'skills-accelerator'] as const) {
    const html = render({ selectedLevel: level });
    assert.match(html, /data-testid="other-paths"/, `${level}: columns show`);
    assert.doesNotMatch(html, /genie-recommended-card/, `${level}: no card`);
  }
  assert.match(render({ selectedLevel: 'lakehouse' }), /For Application Developers/);
  // The Other tracks tab can show while Genie is still the track (view="other").
  const browsing = render({ view: 'other' });
  assert.match(browsing, /data-testid="other-paths"/);
  assert.doesNotMatch(browsing, /genie-recommended-card/);
});

test('reverse direction: always the Other tracks view, no card', () => {
  const html = render({ selectedLevel: 'reverse-lakehouse', direction: 'reverse', view: 'genie' });
  assert.doesNotMatch(html, /genie-recommended-card/);
  assert.doesNotMatch(html, /Include Genie Ontology/);
  assert.match(html, /data-testid="other-paths"/, 'the reverse columns still show');
});

// --- the card on its own ------------------------------------------------------------

const cardOnly = (props: Partial<Parameters<typeof GenieRecommendedCard>[0]> = {}) =>
  renderToStaticMarkup(createElement(GenieRecommendedCard, {
    selected: false,
    lockState: null,
    readOnly: false,
    includeLakehouse: false,
    includeGenieOntology: true,
    stepCount: null,
    buildMinutes: 200,
    onSelect: noop,
    ...props,
  }));

test('not selected: "Recommended track" without "✓ Selected", clickable', () => {
  const html = cardOnly();
  assert.match(html, /data-selected="false"/);
  assert.match(html, /Recommended track/);
  assert.doesNotMatch(html, />Selected</);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html.match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '', /disabled/);
});

test('read-only: the card and its toggles render disabled', () => {
  const html = render({}, true);
  assert.match(cardButton(html), /disabled=""/);
  const boxes = card(html).match(/<input type="checkbox"[^>]*>/g) ?? [];
  assert.equal(boxes.length, 2);
  for (const box of boxes) assert.match(box, /disabled=""/);
  assert.match(cardOnly({ readOnly: true }).match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '', /disabled=""/);
});

test('locked: the card renders disabled with the lock tooltip', () => {
  const html = cardOnly({ lockState: { reason: 'workflow-started' } });
  assert.match(html.match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '', /disabled=""/);
  assert.match(html, /Path is locked/);
  assert.match(html, /Start a new session to switch tracks\./);
});

test('step count and build time come from the outline and computeBuildTime', () => {
  const minutes = computeBuildTime({
    level: 'genie-accelerator',
    direction: 'forward',
    aiModules: new Set(ALL_AI_MODULES),
    medallionLayers: new Set(ALL_MEDALLION_LAYERS),
    completedSteps: new Set<number>(),
    includeLakehouse: false,
    includeGenieOntology: true,
  }).total;
  const html = render();
  assert.match(html, new RegExp(`est\\. ${formatHM(minutes)} build time`));
  // Off drops the ontology's 25 minutes.
  const off = computeBuildTime({
    level: 'genie-accelerator',
    direction: 'forward',
    aiModules: new Set(ALL_AI_MODULES),
    medallionLayers: new Set(ALL_MEDALLION_LAYERS),
    completedSteps: new Set<number>(),
    includeLakehouse: false,
    includeGenieOntology: false,
  }).total;
  assert.equal(minutes - off, 25);
  assert.match(render({ includeGenieOntology: false }), new RegExp(`est\\. ${formatHM(off)} build time`));
  // Until the outline answers there's no step count; then it shows the outline's length.
  assert.doesNotMatch(html, / steps · /);
  assert.match(cardOnly({ selected: true, stepCount: 27, buildMinutes: minutes }), />27 steps · </);
  const source = readFileSync(new URL('../../src/components/LevelSelector.tsx', import.meta.url), 'utf-8');
  assert.match(source, /previewTrackOutline\('genie-accelerator', \{ flags: \{ includeLakehouse, includeGenieOntology \} \}\)/);
  assert.match(source, /\.then\(resp => resp\.outline\.length\)/);
});

// --- the tabs in PathAndArchitecture ------------------------------------------------

test('trackTabForLevel: Genie tab for the Genie Accelerator, Other tracks otherwise and in reverse', () => {
  assert.equal(trackTabForLevel('genie-accelerator', 'forward'), 'genie');
  assert.equal(trackTabForLevel('genie-accelerator', 'reverse'), 'other');
  for (const level of ['app-only', 'lakehouse', 'end-to-end', 'agents-accelerator', 'reverse-app'] as const) {
    assert.equal(trackTabForLevel(level, 'forward'), 'other', level);
  }
});

test('Genie level: the Genie tab is selected, the direction toggle stays on Other tracks', () => {
  const html = renderPath();
  assert.match(html, /role="tablist"/);
  assert.match(tab(html, 'genie'), /aria-selected="true"/);
  assert.match(tab(html, 'other'), /aria-selected="false"/);
  assert.match(html, /data-testid="genie-recommended-card" data-selected="true"/);
  assert.doesNotMatch(html, />Reverse ETL</, 'no direction toggle on the Genie tab');
  assert.doesNotMatch(html, /current-track-note/);
});

test('another level: the Other tracks tab with the direction toggle and the columns', () => {
  const html = renderPath({ selectedLevel: 'lakehouse', includeGenieOntology: false });
  assert.match(tab(html, 'other'), /aria-selected="true"/);
  assert.match(html, />Build Forward</);
  assert.match(html, />Reverse ETL</);
  assert.match(html, /data-testid="other-paths"/);
  assert.doesNotMatch(html, /genie-recommended-card/);
  assert.match(tab(html, 'genie'), /aria-disabled="false"/, 'one click back to the Genie Accelerator');
});

test('Reverse ETL disables the Genie tab and says why', () => {
  const html = renderPath({ selectedLevel: 'reverse-lakehouse', direction: 'reverse' });
  assert.match(tab(html, 'genie'), /aria-disabled="true"/);
  assert.match(html, /Switch to Build Forward \(under Other tracks\) to use the Genie Accelerator\./);
  assert.match(tab(html, 'other'), /aria-selected="true"/);
});

test('the Genie tab follows the picker lock: started on another track, or another assistant', () => {
  const started = renderPath({ selectedLevel: 'lakehouse', completedSteps: new Set([1, 2, 3]) });
  assert.match(tab(started, 'genie'), /aria-disabled="true"/);
  assert.match(started, /Path is locked/);
  const assistant = renderPath({ selectedLevel: 'lakehouse', disabledWorkshopLevels: new Set(['genie-accelerator']) });
  assert.match(tab(assistant, 'genie'), /aria-disabled="true"/);
  assert.match(assistant, /Not available with this assistant/);
  // The current track is never locked (grandfather rule).
  const own = renderPath({ completedSteps: new Set([1, 2, 3]) });
  assert.match(tab(own, 'genie'), /aria-disabled="false"/);
});

test('read-only: the Genie tab cannot switch tracks, but shows a Genie session', () => {
  assert.match(tab(renderPath({ selectedLevel: 'lakehouse' }, true), 'genie'), /aria-disabled="true"/);
  assert.match(tab(renderPath({}, true), 'genie'), /aria-disabled="false"/);
});

test('the same tabs and card wherever PathAndArchitecture renders', () => {
  assert.match(renderPath(), /data-testid="genie-recommended-card" data-selected="true"/);
  // WorkflowDiagram and the Config Test Scenario both render PathAndArchitecture.
  for (const file of ['src/components/WorkflowDiagram.tsx', 'src/components/config/TestScenarioConfig.tsx']) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf-8');
    assert.match(src, /<PathAndArchitecture\b/, file);
  }
});
