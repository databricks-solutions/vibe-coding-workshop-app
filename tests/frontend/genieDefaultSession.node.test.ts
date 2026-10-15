// Node tests for genie-default-ontology PR 3 (web UI): new sessions start on the
// facilitator's default track with its ontology default, persisted at creation
// so a reload shows the same thing (R2/R3); an assistant pick doesn't move a new
// session off it (F-Q8); a failed config fetch falls back to Genie Accelerator
// with ontology on; and the session's stored `view` marker decides which view
// it reopens in (D-143).
//
// Run: node --experimental-strip-types --test tests/frontend/genieDefaultSession.node.test.ts
//
// App.tsx is too large to load here, so its wiring is checked statically, the
// way ConnectToGenieCodePanel.node.test.ts checks WorkflowDiagram.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type ClientModule = typeof import('../../src/api/client.ts');
type ViewModule = typeof import('../../src/hooks/useWorkflowViewMode.ts');
type RestoreModule = typeof import('../../src/constants/restoreLevel.ts');

const client = await loadComponentModule<ClientModule>('src/api/client.ts');
const view = await loadComponentModule<ViewModule>('src/hooks/useWorkflowViewMode.ts');
const { resolveRestoredLevel } = await loadComponentModule<RestoreModule>('src/constants/restoreLevel.ts');

const APP = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf-8');

/** The body of `const <name> = ...` in App.tsx, up to the next top-level handler. */
function appBlock(name: string): string {
  const start = APP.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `App.tsx defines ${name}`);
  const next = APP.indexOf('\n  const ', start + 1);
  return APP.slice(start, next === -1 ? undefined : next);
}

/** The brace-balanced body that follows `head` in `source` (head ends with `{`). */
function bracedBody(source: string, head: string): string {
  const start = source.indexOf(head);
  assert.ok(start >= 0, `found ${head}`);
  let depth = 0;
  for (let i = start + head.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start + head.length, i);
  }
  throw new Error(`unbalanced braces after ${head}`);
}

const ALL_ON_FLAGS = {
  includeLakehouse: false,
  includeGenieOntology: true,
  'ai.genie': true,
  'ai.agent': true,
  'ai.dashboard': true,
  'medallion.bronze': true,
  'medallion.silver': true,
  'medallion.gold': true,
};

// ---------------------------------------------------------------------------
// Workshop defaults and the config-fetch fallback
// ---------------------------------------------------------------------------

async function withFetch<T>(impl: typeof fetch, run: (warnings: unknown[][]) => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  const warnings: unknown[][] = [];
  globalThis.fetch = impl;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    return await run(warnings);
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
}

test('defaults come from GET /config/workshop-defaults', async () => {
  const calls: string[] = [];
  await withFetch((async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ defaultTrack: 'genie-accelerator', includeGenieOntology: false }), { status: 200 });
  }) as typeof fetch, async (warnings) => {
    const api = new client.ApiClient();
    assert.deepEqual(await api.getWorkshopDefaults(), { defaultTrack: 'genie-accelerator', includeGenieOntology: false });
    assert.deepEqual(await api.getWorkshopDefaults(), { defaultTrack: 'genie-accelerator', includeGenieOntology: false });
    assert.deepEqual(calls, ['/api/config/workshop-defaults'], 'fetched once per page');
    assert.equal(warnings.length, 0);
  });
});

test('a failed config fetch falls back to Genie Accelerator with ontology on, logged once', async () => {
  let calls = 0;
  await withFetch((async () => {
    calls++;
    return new Response('boom', { status: 500, statusText: 'Internal Server Error' });
  }) as typeof fetch, async (warnings) => {
    const api = new client.ApiClient();
    assert.deepEqual(await api.getWorkshopDefaults(), { defaultTrack: 'genie-accelerator', includeGenieOntology: true });
    assert.deepEqual(await api.getWorkshopDefaults(), { defaultTrack: 'genie-accelerator', includeGenieOntology: true });
    assert.equal(calls, 1);
    assert.equal(warnings.length, 1, 'one console log for the failure');
  });
});

test('a network error falls back the same way', async () => {
  await withFetch((async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch, async (warnings) => {
    const api = new client.ApiClient();
    assert.deepEqual(await api.getWorkshopDefaults(), client.FALLBACK_WORKSHOP_DEFAULTS);
    assert.equal(warnings.length, 1);
  });
});

test('the fallback is the app.yaml.template default: Genie Accelerator, ontology on', () => {
  assert.deepEqual(client.FALLBACK_WORKSHOP_DEFAULTS, { defaultTrack: 'genie-accelerator', includeGenieOntology: true });
  const template = readFileSync(new URL('../../app.yaml.template', import.meta.url), 'utf-8');
  assert.match(template, /VIBE_DEFAULT_GENIE_ONTOLOGY[\s\S]{0,80}value:\s*"true"/);
});

// ---------------------------------------------------------------------------
// New-session defaults (R2/R3)
// ---------------------------------------------------------------------------

test('a new session persists track, ontology, the full flags and view "technical" at creation', () => {
  const req = client.newSessionMetadata('s-1', client.FALLBACK_WORKSHOP_DEFAULTS, ALL_ON_FLAGS);
  assert.deepEqual(req, {
    session_id: 's-1',
    workshop_level: 'genie-accelerator',
    include_genie_ontology: true,
    flags: ALL_ON_FLAGS,
    view: 'technical',
  });
  // Not an explicit level pick: path-lock semantics are unchanged.
  assert.ok(!('level_explicitly_selected' in req));
  // Only view / include_genie_ontology / flags; the server mirrors the camelCase key.
  assert.ok(!('includeGenieOntology' in req));
});

test('the facilitator switch "false" gives a new session ontology off', () => {
  const req = client.newSessionMetadata('s-2', { defaultTrack: 'genie-accelerator', includeGenieOntology: false }, { ...ALL_ON_FLAGS, includeGenieOntology: false });
  assert.equal(req.include_genie_ontology, false);
  assert.equal(req.flags?.includeGenieOntology, false);
});

test('reload: what a new session persisted hydrates back to Genie Accelerator with ontology on', () => {
  // App.tsx persists the request newSessionMetadata builds, with the engine flags.
  const apply = appBlock('applyNewSessionDefaults');
  assert.match(apply, /apiClient\.updateSessionMetadata\(newSessionMetadata\(/);
  assert.match(apply, /engineFlagsFrom\(new Set\(ALL_AI_MODULES\), new Set\(ALL_MEDALLION_LAYERS\), false, ontology\)/,
    'the creation write carries the complete engine flags (GET /outline reads only flags)');
  assert.doesNotMatch(apply, /level_explicitly_selected/);
  const req = client.newSessionMetadata('s-3', client.FALLBACK_WORKSHOP_DEFAULTS, ALL_ON_FLAGS);
  assert.ok(req.flags, 'flags are persisted at creation');

  // The stored row as the backend returns it on reload (update-metadata patches
  // these keys into session_parameters; the server mirrors the ontology value).
  const reloaded = {
    workshop_level: req.workshop_level,
    session_parameters: {
      include_genie_ontology: req.include_genie_ontology,
      flags: req.flags,
      includeGenieOntology: req.include_genie_ontology,
      view: req.view,
    } as Record<string, unknown>,
  };
  assert.equal(resolveRestoredLevel(reloaded, null), 'genie-accelerator');
  assert.equal(!!reloaded.session_parameters.include_genie_ontology, true, 'the UI hydrates the toggle from the snake key');
  assert.equal((reloaded.session_parameters.flags as Record<string, boolean>).includeGenieOntology, true, 'the engine outline reads flags');
  assert.equal(view.isInsightsSession(reloaded.session_parameters.view as string, null), false);
});

test('createNewSession applies the defaults instead of the old end-to-end reset', () => {
  const create = appBlock('createNewSession');
  assert.match(create, /apiClient\.getWorkshopDefaults\(\)/);
  assert.match(create, /applyNewSessionDefaults\(response\.session_id, defaults, view\)/);
  assert.doesNotMatch(create, /setWorkshopLevel\('end-to-end'\)/);
  assert.doesNotMatch(create, /setIncludeGenieOntology\(false\)/);
});

test('a first-time default session (nothing stored) takes the defaults; one with stored state does not', () => {
  const pristine = { success: true, session_id: 'd', is_saved: false, step_prompts: {}, message: 'New session created', workshop_level: '300' };
  assert.equal(client.isPristineSession(pristine), true);
  assert.equal(client.isPristineSession({ ...pristine, session_parameters: { coding_assistant: 'cursor' } }), false);
  assert.equal(client.isPristineSession({ ...pristine, completed_gates: ['use_case_selection'] }), false);
  assert.equal(client.isPristineSession({ ...pristine, use_case: 'x' }), false);
  assert.equal(client.isPristineSession({ ...pristine, is_saved: true }), false);
  assert.equal(client.isPristineSession({ ...pristine, step_prompts: { 1: 'brief' } }), false);
  assert.match(appBlock('getOrCreateDefaultSession'), /if \(isPristineSession\(response\)\) \{\s*applyNewSessionDefaults\(/);
});

test('a failed default-session fetch lands on Genie Accelerator with ontology and lakehouse off, and writes nothing', () => {
  const failed = bracedBody(appBlock('getOrCreateDefaultSession'), '} catch (err) {');
  // D-165: the level the fallback defaults give, ontology off (not the fallback's
  // ontology: a later progress save stores only the level, which reloads off).
  assert.match(failed, /applyNewSessionState\(newSessionLevel\(FALLBACK_WORKSHOP_DEFAULTS\), false\);/);
  assert.equal(client.FALLBACK_WORKSHOP_DEFAULTS.defaultTrack, 'genie-accelerator');
  assert.match(appBlock('newSessionLevel'), /defaults\.defaultTrack in WORKSHOP_LEVELS \? defaults\.defaultTrack as WorkshopLevel : 'genie-accelerator'/);
  assert.doesNotMatch(failed, /setWorkshopLevel|setIncludeGenieOntology|includeGenieOntology/, 'only the shared helper sets the level and ontology');
  // The backend is unreachable and the local id is unsaved by design: no write, no outline fetch.
  assert.doesNotMatch(failed, /apiClient\.|updateSessionMetadata|fetchOutline|applyNewSessionDefaults/);

  // The helper is state only, and the success path sets its state through it too.
  const state = bracedBody(appBlock('applyNewSessionState'), '(level: WorkshopLevel, ontology: boolean) => {');
  assert.equal(state.trim().split(/\s*\n\s*/).join(' '),
    'setWorkshopLevel(level); setIncludeLakehouse(false); setIncludeGenieOntology(ontology);');
  assert.match(appBlock('applyNewSessionDefaults'), /applyNewSessionState\(level, ontology\);/);
});

test('a resumed session without stored ontology still hydrates off (absent = off)', () => {
  const block = appBlock('loadSession');
  assert.match(block, /setIncludeGenieOntology\(!!sessionParams\.include_genie_ontology\)/);
  assert.doesNotMatch(block, /applyNewSessionDefaults/);
});

test('switching into Genie Accelerator resets ontology to the facilitator default, other paths to off', () => {
  const block = appBlock('handleWorkshopLevelChange');
  assert.match(block, /const entryOntology = level === 'genie-accelerator' && workshopDefaults\.includeGenieOntology;/);
  assert.match(block, /setIncludeGenieOntology\(entryOntology\)/);
  assert.match(block, /const nextOnto = levelChanged \? entryOntology : includeGenieOntology;/);
  assert.doesNotMatch(block, /setIncludeGenieOntology\(false\)/);
});

// ---------------------------------------------------------------------------
// Assistant-pick guard (F-Q8)
// ---------------------------------------------------------------------------

/** Evaluates App.tsx's own shouldApplyAssistantDefault expression. */
function assistantGuard(): (explicit: boolean, level: string, assistantDefault: string | undefined) => boolean {
  const block = appBlock('handleCodingAssistantChange');
  const m = block.match(/const shouldApplyAssistantDefault =([\s\S]*?);/);
  assert.ok(m, 'handleCodingAssistantChange computes shouldApplyAssistantDefault');
  return new Function('levelExplicitlySelected', 'workshopLevel', 'assistantDefault', `return (${m[1]});`) as never;
}

test('picking an assistant on a new Genie Accelerator session keeps it there', () => {
  const guard = assistantGuard();
  assert.equal(guard(false, 'genie-accelerator', undefined), false, 'Cursor (no assistant default)');
  assert.equal(guard(false, 'genie-accelerator', 'genie-accelerator'), false, 'Genie Code');
  // Any future assistant default can't move the new-session default either.
  assert.equal(guard(false, 'genie-accelerator', 'lakehouse'), false);
});

test('only shouldApplyAssistantDefault lets an assistant pick move the level', () => {
  const block = appBlock('handleCodingAssistantChange');
  const guarded = bracedBody(block, 'if (shouldApplyAssistantDefault) {');
  assert.match(guarded, /setWorkshopLevel\(nextLevel\);/);
  assert.match(guarded, /workshop_level: nextLevel,/);
  const unguarded = block.replace(guarded, '');
  assert.doesNotMatch(unguarded, /setWorkshopLevel|workshop_level/, 'no level change outside the guard');
});

test('the assistant fallback still applies to a legacy end-to-end session never explicitly placed', () => {
  const guard = assistantGuard();
  assert.equal(guard(false, 'end-to-end', 'genie-accelerator'), true);
  assert.equal(guard(true, 'end-to-end', 'genie-accelerator'), false, 'an explicit pick wins');
  assert.equal(guard(false, 'end-to-end', undefined), false);
});

// ---------------------------------------------------------------------------
// D-143: the view marker
// ---------------------------------------------------------------------------

test('marker "insights" reopens in Insights', () => {
  assert.equal(view.isInsightsSession('insights', null), true);
});

test('technical-reopen: a genie-code Genie Accelerator session stored as "technical" reopens in Technical', () => {
  const sessionParams = { view: 'technical', coding_assistant: 'genie-code', workshop_level: 'genie-accelerator' };
  assert.equal(view.isInsightsSession(sessionParams.view, null), false);
  // Both resume paths read the marker, not the level and assistant.
  const calls = APP.match(/adoptSessionView\([^;]*\);/g) ?? [];
  assert.equal(calls.length, 2, 'two resume paths adopt the session view');
  for (const call of calls) assert.equal(call, 'adoptSessionView(isInsightsSession(sessionParams.view));');
});

test('no marker + genie-accelerator + genie-code (the legacy MCP shape) opens in Technical', () => {
  assert.equal(view.isInsightsSession(undefined, null), false);
  assert.equal(view.isInsightsSession(null, null), false);
  assert.equal(view.isInsightsSession.length <= 2, true, 'no level / assistant parameters');
});

test('?view= overrides all three', () => {
  for (const stored of ['insights', 'technical', undefined]) {
    assert.equal(view.isInsightsSession(stored, 'insights'), true, `?view=insights over ${stored}`);
    assert.equal(view.isInsightsSession(stored, 'technical'), false, `?view=technical over ${stored}`);
  }
});

test('the Insights setup writes view "insights" and keeps forcing ontology off', () => {
  const block = appBlock('handleInsightsStart');
  assert.match(block, /view: 'insights',/);
  assert.match(block, /include_genie_ontology: false,/);
  assert.doesNotMatch(block, /includeGenieOntology:/, 'no top-level camelCase key');
});

test('a view switch persists the marker', () => {
  const persisted: string[] = [];
  const g = globalThis as unknown as { window?: unknown };
  const realWindow = g.window;
  const history = { state: null, replaceState: () => {} };
  g.window = { location: { search: '', href: 'https://app.example/?sessionId=s' }, history };
  try {
    let switchMode: ((m: 'technical' | 'insights') => void) | undefined;
    function Harness() {
      switchMode = view.useWorkflowViewMode(m => persisted.push(m))[3];
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    assert.ok(switchMode);
    switchMode('insights');
    switchMode('technical');
  } finally {
    g.window = realWindow;
  }
  assert.deepEqual(persisted, ['insights', 'technical']);

  // App wires the learner's switches (header toggle, Insights' "switch to
  // Technical") to switchViewMode, which stores the marker on the session.
  assert.match(APP, /<ViewModeToggle mode=\{viewMode\} onChange=\{switchViewMode\} \/>/);
  assert.match(APP, /onSwitchToTechnical=\{\(\) => switchViewMode\('technical'\)\}/);
  const persist = appBlock('persistView');
  assert.match(persist, /if \(readOnly \|\| !sessionId\) return;/);
  assert.match(persist, /apiClient\.updateSessionMetadata\(\{ session_id: sessionId, view \}\)/);
});
