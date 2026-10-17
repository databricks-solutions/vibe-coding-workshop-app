// Node render tests for the Genie Code on-ramp (D4 §1.1) and its start line
// (session linking): it lives in the Genie Code detail panel of Choose Your
// Coding Assistant, names the session's track and id, and the Set Up Project
// step repeats the line for Genie Code.
//
// Run: node --experimental-strip-types --test tests/frontend/ConnectToGenieCodePanel.node.test.ts
//
// No DOM: components are server-rendered. WorkflowDiagram is too large to render
// here, so its call sites are checked statically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type PanelModule = typeof import('../../src/components/ConnectToGenieCodePanel.tsx');
type SelectorModule = typeof import('../../src/components/CodingAssistantSelector.tsx');
type SetupModule = typeof import('../../src/components/SetUpProjectStep.tsx');

const { ConnectToGenieCodePanel } = await loadComponentModule<PanelModule>('src/components/ConnectToGenieCodePanel.tsx');
const { CodingAssistantSelector } = await loadComponentModule<SelectorModule>('src/components/CodingAssistantSelector.tsx');
const { SetUpProjectStep } = await loadComponentModule<SetupModule>('src/components/SetUpProjectStep.tsx');

const SID = '0f8e2c1a-1111-4222-8333-944455556666';
const noop = () => {};

test('the panel names the session track and id, never the retired prompt', () => {
  const html = renderToStaticMarkup(createElement(ConnectToGenieCodePanel, { workshopLevel: 'lakehouse-di', sessionId: SID }));
  assert.match(html, /data-testid="start-line"/);
  assert.match(html, new RegExp(`Start a workshop track: Lakehouse \\+ AI and Agents \\(session ${SID}\\)`));
  assert.doesNotMatch(html, /Start the Genie Accelerator/);
  assert.match(html, /data-testid="mcp-url"/);
});

const selector = (selectedAssistant: string, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CodingAssistantSelector, {
    selectedAssistant,
    onSelect: noop,
    onConfirm: noop,
    forceExpanded: true,
    workshopLevel: 'genie-accelerator',
    sessionId: SID,
    ...extra,
  }));

test('the on-ramp shows only with Genie Code selected', () => {
  assert.match(selector('genie-code'), /data-testid="connect-to-genie-code"/);
  for (const other of ['cursor', 'claude-code', 'ai-gateway']) {
    assert.doesNotMatch(selector(other), /connect-to-genie-code/, other);
  }
});

test('collapsed with Genie Code, the MCP URL chip stays reachable', () => {
  const collapsed = selector('genie-code', { forceExpanded: false, forceCollapsed: true, isLocked: true });
  assert.match(collapsed, /data-testid="mcp-url-chip"/);
  assert.doesNotMatch(selector('cursor', { forceExpanded: false, forceCollapsed: true }), /mcp-url-chip/);
});

const setup = (codingAssistant: string) =>
  renderToStaticMarkup(createElement(SetUpProjectStep, {
    isComplete: false,
    onMarkComplete: noop,
    isExpanded: true,
    onToggleExpand: noop,
    isPreviousStepComplete: true,
    sessionId: SID,
    codingAssistant,
    workshopLevel: 'app-database',
  }));

test('Set Up Project repeats the start line for Genie Code only', () => {
  const genie = setup('genie-code');
  assert.match(genie, /data-testid="genie-code-start-note"/);
  assert.match(genie, new RegExp(`Start a workshop track: Databricks Apps \\+ Lakebase \\(session ${SID}\\)`));
  assert.doesNotMatch(setup('cursor'), /genie-code-start-note/);
});

test('Copy & Paste Prompts Mode renders only the two mode cards with no MCP setup or redundant step boxes underneath', () => {
  const g = globalThis as unknown as { window?: unknown };
  const realWindow = g.window;
  try {
    g.window = {
      location: { origin: 'https://app.example' },
      localStorage: {
        getItem: (k: string) => (k === 'vibe.genieCode.mode' ? 'copy-paste' : null),
        setItem: () => {},
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const html = renderToStaticMarkup(createElement(ConnectToGenieCodePanel, { workshopLevel: 'genie-accelerator', sessionId: SID }));
    assert.doesNotMatch(html, /How Copy &amp; Paste Mode works|How Copy & Paste Mode works/);
    assert.doesNotMatch(html, /Want hands-free mode instead/i);
    assert.doesNotMatch(html, /data-testid="mcp-url"/);
    assert.doesNotMatch(html, /data-testid="start-line"/);
  } finally {
    g.window = realWindow;
  }
});

test('WorkflowDiagram no longer shows the panel for every assistant, and passes the session', () => {
  const source = readFileSync(new URL('../../src/components/WorkflowDiagram.tsx', import.meta.url), 'utf-8');
  assert.doesNotMatch(source, /<ConnectToGenieCodePanel\b/);
  const selectorCall = source.match(/<CodingAssistantSelector\b[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(selectorCall, /workshopLevel=\{workshopLevel\}/);
  assert.match(selectorCall, /sessionId=\{sessionId\}/);
  const setupCall = source.match(/<SetUpProjectStep\b[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(setupCall, /workshopLevel=\{workshopLevel\}/);
});
