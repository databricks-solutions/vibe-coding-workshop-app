// Node render tests for the recommended Genie Accelerator card (genie-default-
// ontology PR 3, R5 "Option A"): selected / not selected, "Choose a different
// path" folded while Genie is selected and open otherwise, read-only, path
// lock, hidden in reverse, the two toggles living only in the card, and the
// same card wherever PathAndArchitecture renders.
//
// Run: node --experimental-strip-types --test tests/frontend/GenieRecommendedCard.node.test.ts
//
// No DOM: server-rendered. Effects (the outline step-count fetch and the
// defaults fetch) don't run, so the card shows the template defaults.

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
  ALL_AI_MODULES,
  ALL_MEDALLION_LAYERS,
} = await loadComponentModule<Harness>('tests/frontend/levelSelectorHarness.ts');

type SelectorProps = Parameters<typeof LevelSelectorContent>[0];

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

const card = (html: string) => {
  const m = html.match(/<div data-testid="genie-recommended-card"[\s\S]*?(?=<div class="flex gap-3 mb-4">|<button type="button"[^>]*data-testid="other-paths-toggle")/);
  assert.ok(m, 'the card renders');
  return m[0];
};
const chapterLine = (html: string) => html.match(/data-testid="genie-chapter-line">([^<]*)</)?.[1].replace(/&gt;/g, '>');
const cardButton = (html: string) => card(html).match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '';
const count = (html: string, s: string) => html.split(s).length - 1;

test('selected: highlighted, "✓ Selected", the other paths folded', () => {
  const html = render();
  assert.match(html, /data-testid="genie-recommended-card" data-selected="true"/);
  assert.match(card(html), /Recommended for this workshop/);
  assert.match(card(html), />Selected</);
  assert.match(cardButton(html), /aria-pressed="true"/);
  assert.match(html, /data-testid="other-paths-toggle"[^>]*>/);
  assert.match(html, /aria-expanded="false"[^>]*data-testid="other-paths-toggle"/);
  assert.match(html, /Choose a different path/);
  assert.match(html, /Apps · Lakehouse · AI &amp; Agents · other accelerators/);
  assert.doesNotMatch(html, /data-testid="other-paths"/, 'collapsed while Genie is selected');
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
  // Open the other paths: the Accelerators column no longer repeats Genie or its toggles.
  const other = render({ selectedLevel: 'agents-accelerator' });
  assert.equal(count(other, 'Include Genie Ontology'), 0, 'no toggles while another path is selected');
  assert.doesNotMatch(other.slice(other.indexOf('data-testid="other-paths"')), />Genie Accelerator</);
});

test('not selected: "★ Recommended", the other paths open, clicking selects Genie', () => {
  const html = render({ selectedLevel: 'lakehouse', includeGenieOntology: false });
  assert.match(html, /data-testid="genie-recommended-card" data-selected="false"/);
  assert.match(card(html), /Recommended for this workshop/);
  assert.doesNotMatch(card(html), />Selected</);
  assert.match(cardButton(html), /aria-pressed="false"/);
  assert.doesNotMatch(cardButton(html), /disabled/);
  assert.match(html, /aria-expanded="true"[^>]*data-testid="other-paths-toggle"/);
  assert.match(html, /data-testid="other-paths"/, 'expanded whenever another path is selected');
  assert.match(html, /For Application Developers/);
  // Shows what picking it gives: the facilitator's ontology default (template: on).
  assert.equal(chapterLine(html), 'Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App');
  for (const level of ['app-only', 'app-database', 'lakehouse-di', 'end-to-end', 'agents-accelerator', 'data-engineering-accelerator', 'skills-accelerator'] as const) {
    assert.match(render({ selectedLevel: level }), /data-testid="other-paths"/, `${level}: other paths open`);
  }
});

test('read-only: the card and its toggles render disabled', () => {
  const html = render({}, true);
  assert.match(cardButton(html), /disabled=""/);
  const boxes = card(html).match(/<input type="checkbox"[^>]*>/g) ?? [];
  assert.equal(boxes.length, 2);
  for (const box of boxes) assert.match(box, /disabled=""/);
  const other = render({ selectedLevel: 'lakehouse' }, true);
  assert.match(cardButton(other), /disabled=""/);
});

test('path lock: a started workflow on another path locks the card with the lock tooltip', () => {
  const html = render({ selectedLevel: 'lakehouse', completedSteps: new Set([1, 2, 3]), levelExplicitlySelected: true });
  assert.match(cardButton(html), /disabled=""/);
  assert.match(card(html), /Path is locked/);
  assert.match(card(html), /Start a new session to switch tracks\./);
  // The selected path is never locked (grandfather rule).
  const own = render({ completedSteps: new Set([1, 2, 3]) });
  assert.doesNotMatch(cardButton(own), /disabled/);
});

test('reverse direction: no card and no "Choose a different path"', () => {
  const html = render({ selectedLevel: 'reverse-lakehouse', direction: 'reverse' });
  assert.doesNotMatch(html, /genie-recommended-card/);
  assert.doesNotMatch(html, /Choose a different path/);
  assert.doesNotMatch(html, /Include Genie Ontology/);
  assert.match(html, /data-testid="other-paths"/, 'the reverse columns still show');
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
  const withCount = renderToStaticMarkup(createElement(GenieRecommendedCard, {
    selected: true,
    lockState: null,
    readOnly: false,
    includeLakehouse: false,
    includeGenieOntology: true,
    stepCount: 27,
    buildMinutes: minutes,
    onSelect: noop,
  }));
  assert.match(withCount, />27 steps · </);
  const source = readFileSync(new URL('../../src/components/LevelSelector.tsx', import.meta.url), 'utf-8');
  assert.match(source, /previewTrackOutline\('genie-accelerator', \{ flags: \{ includeLakehouse, includeGenieOntology \} \}\)/);
  assert.match(source, /\.then\(resp => resp\.outline\.length\)/);
});

test('the same card wherever PathAndArchitecture renders', () => {
  const html = renderToStaticMarkup(createElement(ReadOnlyProvider, { value: false }, createElement(PathAndArchitecture, {
    selectedLevel: 'genie-accelerator',
    onLevelChange: noop,
    completedSteps: new Set<number>(),
    forceExpanded: true,
    includeGenieOntology: true,
    onIncludeGenieOntologyChange: noop,
  })));
  assert.match(html, /data-testid="genie-recommended-card" data-selected="true"/);
  // WorkflowDiagram and the Config Test Scenario both render PathAndArchitecture.
  for (const file of ['src/components/WorkflowDiagram.tsx', 'src/components/config/TestScenarioConfig.tsx']) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf-8');
    assert.match(src, /<PathAndArchitecture\b/, file);
  }
});
