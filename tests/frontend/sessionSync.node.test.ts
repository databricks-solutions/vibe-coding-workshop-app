// Node unit tests for session sync (one engine, two interfaces): how a stored
// session becomes UI state, and which parts of it a refresh may apply.
//
// Run: node --experimental-strip-types --test tests/frontend/sessionSync.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadComponentModule } from './loadComponent.ts';

type SyncModule = typeof import('../../src/utils/sessionSync.ts');
type ClientModule = typeof import('../../src/api/client.ts');

const sync = await loadComponentModule<SyncModule>('src/utils/sessionSync.ts');
const { apiClient } = await loadComponentModule<ClientModule>('src/api/client.ts');

type Resp = Parameters<SyncModule['sessionViewFrom']>[0];
const resp = (over: Partial<Resp> = {}, params: Record<string, unknown> = {}): Resp => ({
  success: true,
  session_id: 's',
  step_prompts: {},
  is_saved: false,
  message: '',
  workshop_level: 'lakehouse',
  completed_gates: [],
  skipped_gates: [],
  session_parameters: params as Record<string, string>,
  ...over,
});

test('chips come from the stored engine flags first', () => {
  const chips = sync.chipsFromParams({
    flags: { 'ai.genie': false, 'medallion.gold': false, includeLakehouse: false, includeGenieOntology: true },
    include_lakehouse: true, // stale snake key left by a path change
    include_genie_ontology: false,
  });
  assert.deepEqual([...chips.aiAgentsModules].sort(), ['agent', 'dashboard']);
  assert.deepEqual([...chips.medallionLayers].sort(), ['bronze', 'silver']);
  assert.equal(chips.includeLakehouse, false);
  assert.equal(chips.includeGenieOntology, true);
});

test('an absent ontology or Lakehouse is off', () => {
  const chips = sync.chipsFromParams({});
  assert.equal(chips.includeGenieOntology, false);
  assert.equal(chips.includeLakehouse, false);
});

test('without flags the legacy snake keys and all-on chips apply', () => {
  const chips = sync.chipsFromParams({ include_lakehouse: true, include_genie_ontology: true });
  assert.equal(chips.aiAgentsModules.size, 3);
  assert.equal(chips.medallionLayers.size, 3);
  assert.equal(chips.includeLakehouse, true);
  assert.equal(chips.includeGenieOntology, true);
});

test('medallion chips keep the Gold -> Silver -> Bronze cascade', () => {
  // Silver off drops Gold too; an empty set falls back to all-on (normalizeMedallionLayers).
  const chips = sync.chipsFromParams({ flags: { 'medallion.silver': false } });
  assert.deepEqual([...chips.medallionLayers], ['bronze']);
  assert.equal(sync.chipsFromParams({ flags: { 'medallion.bronze': false } }).medallionLayers.size, 3);
});

test('the stored chain context wins over the legacy derivation', () => {
  // A lakehouse session with no app steps derives 'lakehouse'; the stored 'app'
  // (an app climb picked before starting) is what GET /outline composes from.
  assert.equal(sync.chainFromParams({ chainContext: 'app' }, 'lakehouse', new Set()), 'app');
  assert.equal(sync.chainFromParams({}, 'lakehouse', new Set()), 'lakehouse');
  assert.equal(sync.chainFromParams({ chainContext: 'bogus' }, 'lakehouse', new Set([5])), 'app');
});

test('sessionViewFrom reads level, lock, steps, direction and assistant', () => {
  const view = sync.sessionViewFrom(resp(
    { workshop_level: 'app-database', completed_gates: ['project_setup'], industry: 'retail', use_case: 'x' },
    { direction: 'reverse', coding_assistant: 'genie-code', level_explicitly_selected: true },
  ));
  assert.equal(view.level, 'app-database');
  assert.equal(view.useCaseLockedLevel, null);
  assert.ok(view.completedSteps.has(1) && view.completedSteps.has(2));
  assert.equal(view.direction, 'reverse');
  assert.equal(view.codingAssistant, 'genie-code');
  assert.equal(view.levelExplicitlySelected, true);
  const locked = sync.sessionViewFrom(resp({ use_case: 'build_skill' }));
  assert.equal(locked.level, 'skills-accelerator');
  assert.equal(locked.useCaseLockedLevel, 'skills-accelerator');
});

test('changedGroups names exactly what Genie Code changed', () => {
  const base = sync.syncSnapshot(resp({ session_name: 'New Session' }, { flags: { 'ai.genie': true } }));
  assert.deepEqual(sync.changedGroups(base, base), []);
  assert.deepEqual(sync.changedGroups(null, base), sync.ALL_SYNC_GROUPS);
  const switched = sync.syncSnapshot(resp(
    { session_name: 'Genie Code Workshop', is_saved: true, workshop_level: 'genie-accelerator' },
    { flags: { 'ai.genie': true }, level_explicitly_selected: true },
  ));
  assert.deepEqual(sync.changedGroups(base, switched).sort(), ['name', 'track']);
  const progressed = sync.syncSnapshot(resp({ session_name: 'New Session', completed_gates: ['project_setup'] }, { flags: { 'ai.genie': true } }));
  assert.deepEqual(sync.changedGroups(base, progressed), ['progress']);
});

test('snapshots ignore gate and flag order', () => {
  const a = sync.syncSnapshot(resp({ completed_gates: ['a', 'b'] }, { flags: { x: true, y: false } }));
  const b = sync.syncSnapshot(resp({ completed_gates: ['b', 'a'] }, { flags: { y: false, x: true } }));
  assert.deepEqual(sync.changedGroups(a, b), []);
});

test('a refresh is dropped when a write was in flight or issued meanwhile', () => {
  const idle = { seq: 4, inflight: 0 };
  assert.equal(sync.canApplyRefresh('s', 's', idle, idle), true);
  assert.equal(sync.canApplyRefresh('s', 'other', idle, idle), false);
  assert.equal(sync.canApplyRefresh('s', 's', { seq: 4, inflight: 1 }, idle), false);
  assert.equal(sync.canApplyRefresh('s', 's', idle, { seq: 5, inflight: 0 }), false);
  assert.equal(sync.canApplyRefresh('s', 's', idle, { seq: 5, inflight: 1 }), false);
});

test('the API client counts session writes, in flight and issued', async () => {
  const realFetch = globalThis.fetch;
  let release: (() => void) | undefined;
  globalThis.fetch = (() => new Promise(resolve => {
    release = () => resolve(new Response('{"success":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
  })) as typeof fetch;
  try {
    const before = apiClient.sessionWriteState();
    const pending = apiClient.updateSessionMetadata({ session_id: 's', view: 'technical' });
    const during = apiClient.sessionWriteState();
    assert.equal(during.seq, before.seq + 1);
    assert.equal(during.inflight, before.inflight + 1);
    release?.();
    await pending;
    assert.equal(apiClient.sessionWriteState().inflight, before.inflight);
  } finally {
    globalThis.fetch = realFetch;
  }
});

const localFrom = (r: Resp, over: Partial<Parameters<SyncModule['groupsDifferingFromLocal']>[2]> = {}) => {
  const view = sync.sessionViewFrom(r);
  const p = (r.session_parameters ?? {}) as Record<string, string>;
  return {
    sessionName: r.session_name, sessionSaved: r.is_saved, sessionDescription: r.session_description,
    industry: r.industry ?? '', industryLabel: r.industry_label ?? '', useCase: r.use_case ?? '', useCaseLabel: r.use_case_label ?? '',
    customUseCaseLabel: p.custom_use_case_label ?? '', customDescription: p.custom_use_case_description ?? '', brandUrl: p.company_brand_url ?? '',
    level: view.level, useCaseLockedLevel: view.useCaseLockedLevel, levelExplicitlySelected: view.levelExplicitlySelected,
    direction: view.direction ?? 'forward', chainContext: view.chainContext,
    aiAgentsModules: view.aiAgentsModules, medallionLayers: view.medallionLayers,
    includeLakehouse: view.includeLakehouse, includeGenieOntology: view.includeGenieOntology,
    completedSteps: view.completedSteps, skippedSteps: view.skippedSteps,
    stepPrompts: r.step_prompts, codingAssistant: view.codingAssistant, prerequisitesCompleted: !!r.prerequisites_completed,
    ...over,
  };
};

test('the tab\'s own writes are not changes from Genie Code', () => {
  const before = resp({ session_name: 'New Session' });
  // The tab completed Set Up Project and saved a name: the server now says so, and so does the tab.
  const after = resp({ session_name: 'My demo', is_saved: true, completed_gates: ['project_setup'] });
  const changed = sync.changedGroups(sync.syncSnapshot(before), sync.syncSnapshot(after));
  assert.deepEqual(changed.sort(), ['name', 'progress']);
  assert.deepEqual(sync.groupsDifferingFromLocal(changed, after, localFrom(after)), []);
});

test('a change Genie Code made is kept', () => {
  const base = resp({ workshop_level: 'genie-accelerator' });
  const remote = resp({ workshop_level: 'app-database', session_name: 'Genie Code — Databricks Apps + Lakebase', is_saved: true }, { level_explicitly_selected: true });
  const changed = sync.changedGroups(sync.syncSnapshot(base), sync.syncSnapshot(remote));
  assert.deepEqual(sync.groupsDifferingFromLocal(changed, remote, localFrom(base)).sort(), ['name', 'track']);
});

test('a stale stored chain counts only on the lakehouse levels', () => {
  assert.equal(sync.chainFromParams({ chainContext: 'app' }, 'genie-accelerator', new Set([2])), null);
  assert.equal(sync.chainFromParams({ chainContext: 'lakehouse' }, 'app-database', new Set()), 'app');
  assert.equal(sync.chainFromParams({ chainContext: 'app' }, 'lakehouse-di', new Set()), 'app');
});
