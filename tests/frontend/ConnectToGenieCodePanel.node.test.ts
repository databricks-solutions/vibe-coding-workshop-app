// Node render test for the "Connect to Genie Code" panel's start prompt (P4.5,
// D-59): the panel names the prompt for the session's track, and the one call
// site in WorkflowDiagram.tsx passes the session's workshopLevel to it.
//
// Run: node --experimental-strip-types --test tests/frontend/ConnectToGenieCodePanel.node.test.ts
//
// No DOM: the panel is server-rendered. WorkflowDiagram is too large to render
// here, so its call site is checked statically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type PanelModule = typeof import('../../src/components/ConnectToGenieCodePanel.tsx');

const { ConnectToGenieCodePanel } = await loadComponentModule<PanelModule>(
  'src/components/ConnectToGenieCodePanel.tsx',
);

const render = (workshopLevel?: string) =>
  renderToStaticMarkup(createElement(ConnectToGenieCodePanel, { workshopLevel }));

test('lakehouse: the panel names the generic prompt and the track id', () => {
  const html = render('lakehouse');
  assert.match(html, /Start a workshop track/);
  assert.match(html, /<code data-testid="start-prompt-track"[^>]*>lakehouse<\/code>/);
  assert.doesNotMatch(html, /Start the Genie Accelerator/);
});

test('genie-accelerator: the panel names the Genie Accelerator prompt, no track', () => {
  const html = render('genie-accelerator');
  assert.match(html, /Start the Genie Accelerator/);
  assert.doesNotMatch(html, /Start a workshop track/);
  assert.doesNotMatch(html, /start-prompt-track/);
});

test('no level: the panel names the Genie Accelerator prompt', () => {
  const html = render();
  assert.match(html, /Start the Genie Accelerator/);
  assert.doesNotMatch(html, /start-prompt-track/);
});

test('WorkflowDiagram passes the session workshopLevel to the panel', () => {
  const source = readFileSync(
    new URL('../../src/components/WorkflowDiagram.tsx', import.meta.url),
    'utf-8',
  );
  const calls = source.match(/<ConnectToGenieCodePanel\b[^>]*\/>/g) ?? [];
  assert.equal(calls.length, 1, 'exactly one ConnectToGenieCodePanel call site');
  assert.match(calls[0], /\bworkshopLevel=\{workshopLevel\}/);
});
