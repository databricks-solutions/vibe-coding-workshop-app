// Node render tests for the unified Workshop Path & Architecture selector:
// - Single unified 4-column view (no separate [Genie Accelerator] / [Other tracks] tab bar)
// - Genie Accelerator sits at the top of the right-hand Accelerators column with
//   its New + Recommended badges, chapter line, step count/build time, and
//   inline Include Genie Ontology / Include Lakehouse toggles when selected
// - When Genie Accelerator is selected in forward direction, the left 3 columns
//   swap to the "Your Genie Accelerator Path" stage strip (with dedicated
//   ServicePopover chips for Metric View, Synonyms, Genie Agent, Dashboard,
//   Domains, Pages, Routing, Synced Tables, App, Lakebase)
//
// Run: node --experimental-strip-types --test tests/frontend/GenieRecommendedCard.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type Harness = typeof import('./levelSelectorHarness.ts');
type ServiceDataMod = typeof import('../../src/components/ServicePopover.utils.ts');
type ChapterBlocksMod = typeof import('../../src/constants/chapterBlocks.ts');

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

const { serviceData } = await loadComponentModule<ServiceDataMod>('src/components/ServicePopover.utils.ts');
const { CHAPTER_BLOCKS, genieAcceleratorServices } = await loadComponentModule<ChapterBlocksMod>('src/constants/chapterBlocks.ts');

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
  const m = html.match(/<div data-testid="genie-recommended-card"[\s\S]*?(?=<div(?: class="[^"]*")?><button[^>]*><div class="flex items-center gap-2\.5"><svg[^>]*lucide-bot|$)/);
  assert.ok(m, 'the Genie Accelerator card renders in the Accelerators column');
  return m[0];
};
const chapterLine = (html: string) => html.match(/data-testid="genie-chapter-line">([^<]*)</)?.[1].replace(/&gt;/g, '>');
const cardButton = (html: string) => card(html).match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '';
const count = (html: string, s: string) => html.split(s).length - 1;

// --- Unified selector view -------------------------------------------------------

test('Genie selected: Genie card is selected with New + Recommended badges in Accelerators column, stage strip shows on left', () => {
  const html = render();
  assert.match(html, /data-testid="genie-recommended-card" data-selected="true"/);
  assert.match(card(html), /data-testid="genie-recommended-badge"/);
  assert.match(card(html), />Recommended</);
  assert.match(card(html), />New</);
  assert.match(cardButton(html), /aria-pressed="true"/);
  assert.doesNotMatch(html, /role="tablist"|track-tab-genie|track-tab-other/, 'the two-tab bar is removed');
  assert.match(html, /Your Genie Accelerator Path/, 'the Genie stage strip shows on the left');
  assert.match(html, /data-testid="see-other-tracks-btn"/, 'the prominent See other tracks button renders');
  assert.match(html, />See other tracks</);
  assert.match(html, />Agents Accelerator</, 'other accelerators remain visible in the right column');
});

test('the chapter line follows R7 and drops Ontology when unticked', () => {
  assert.equal(chapterLine(render()), 'Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App');
  assert.equal(chapterLine(render({ includeGenieOntology: false })), 'Metric View → Genie Agent → Dashboard → Lakebase sync → App');
  assert.equal(chapterLine(render({ includeLakehouse: true })), 'Lakehouse → Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App');
});

test('the two toggles render under Genie Accelerator only when Genie Accelerator is selected', () => {
  const html = render();
  assert.equal(count(html, 'Include Genie Ontology (Beta: needs Genie One Pages)'), 1);
  assert.equal(count(html, '>Include Lakehouse<'), 1);
  assert.match(card(html), /Include Genie Ontology \(Beta: needs Genie One Pages\)/);
  assert.match(card(html), />Include Lakehouse</);

  const other = render({ selectedLevel: 'end-to-end' });
  assert.equal(count(other, 'Include Genie Ontology'), 0, 'toggles collapse when another track is selected');
  assert.match(other, /data-testid="genie-recommended-card" data-selected="false"/, 'Genie Accelerator stays visible in Accelerators column');
  assert.match(other, /data-testid="genie-recommended-badge"/, 'Recommended badge stays visible when unselected');
});

test('Standard tracks view: 4 columns with persona captions + Genie Accelerator in Column 4 for non-Genie levels', () => {
  for (const level of ['app-only', 'app-database', 'lakehouse', 'lakehouse-di', 'end-to-end', 'agents-accelerator', 'data-engineering-accelerator', 'skills-accelerator'] as const) {
    const html = render({ selectedLevel: level });
    assert.match(html, /data-testid="other-paths"/, `${level}: unified grid shows`);
    assert.match(html, /For Application Developers/, `${level}: persona captions show`);
    assert.match(html, /data-testid="genie-recommended-card" data-selected="false"/, `${level}: Genie Accelerator sits in Column 4`);
  }
});

test('reverse direction: hides the Accelerators column (including Genie Accelerator)', () => {
  const html = render({ selectedLevel: 'reverse-lakehouse', direction: 'reverse' });
  assert.doesNotMatch(html, /genie-recommended-card/);
  assert.doesNotMatch(html, /Include Genie Ontology/);
  assert.match(html, /data-testid="other-paths"/, 'the reverse columns still show');
});

// --- Standalone GenieRecommendedCard & read-only / lock states -------------------

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

test('not selected: clickable with aria-pressed="false"', () => {
  const html = render({ selectedLevel: 'end-to-end' });
  assert.match(html, /data-selected="false"/);
  assert.match(html, /Recommended/);
  assert.match(cardButton(html), /aria-pressed="false"/);
  assert.doesNotMatch(cardButton(html), /disabled/);
});

test('read-only: the card and its toggles render disabled', () => {
  const html = render({}, true);
  assert.match(cardButton(html), /disabled=""/);
  const boxes = card(html).match(/<input type="checkbox"[^>]*>/g) ?? [];
  assert.equal(boxes.length, 2);
  for (const box of boxes) assert.match(box, /disabled=""/);
  assert.match(cardOnly({ readOnly: true }).match(/<button[^>]*aria-pressed[^>]*>/)?.[0] ?? '', /disabled=""/);
});

test('locked: the card renders disabled with the lock tooltip when started on another track', () => {
  const startedOther = render({ selectedLevel: 'lakehouse', completedSteps: new Set([1, 2, 3]) });
  assert.match(cardButton(startedOther), /disabled=""/);
  assert.match(card(startedOther), /Path is locked/);
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
  assert.match(cardOnly({ selected: true, stepCount: 27, buildMinutes: minutes }), />27 steps · </);
});

test('PathAndArchitecture renders one unified view with Build Forward / Reverse ETL and no track-tab split', () => {
  const html = renderPath({ selectedLevel: 'end-to-end', includeGenieOntology: false });
  assert.doesNotMatch(html, /role="tablist"/);
  assert.match(html, />Build Forward</);
  assert.match(html, />Reverse ETL</);
  assert.match(html, /data-testid="other-paths"/);
  assert.match(html, /data-testid="genie-recommended-card" data-selected="false"/);
  for (const file of ['src/components/WorkflowDiagram.tsx', 'src/components/config/TestScenarioConfig.tsx']) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf-8');
    assert.match(src, /<PathAndArchitecture\b/, file);
  }
});

// --- ServicePopover ("i" button) 2026 content & distinct chip mappings ------------

test('every CHAPTER_BLOCKS chip maps to a distinct, valid 2026 ServicePopover entry', () => {
  assert.equal(CHAPTER_BLOCKS['semantic-layer'].services[0].serviceKey, 'metricViews');
  assert.equal(CHAPTER_BLOCKS['semantic-layer'].services[1].serviceKey, 'metricViewSynonyms');
  assert.equal(CHAPTER_BLOCKS.ontology.services[0].serviceKey, 'discoverDomains');
  assert.equal(CHAPTER_BLOCKS.ontology.services[1].serviceKey, 'discoverPages');
  assert.equal(CHAPTER_BLOCKS.ontology.services[2].serviceKey, 'discoverRouting');

  const genieAiServices = genieAcceleratorServices(CHAPTER_BLOCKS['ai-agents']);
  assert.equal(genieAiServices.find(s => s.label === 'Genie')?.serviceKey, 'genieAgent');

  for (const [key, info] of Object.entries(serviceData)) {
    assert.ok(info.name.length > 0, `${key}: has name`);
    assert.ok(info.description.length > 30, `${key}: has thorough description`);
    assert.ok(info.benefits.length >= 4, `${key}: has >=4 benefits`);
    assert.ok(info.limitations.length >= 3, `${key}: has >=3 considerations/limitations`);
    assert.match(info.docUrl, /^https:\/\/docs\.databricks\.com\/aws\/en\//, `${key}: uses canonical 2026 /aws/en/ docs URL`);
    assert.doesNotMatch(info.docUrl, /\.html$/, `${key}: no legacy .html URL`);
  }
});
