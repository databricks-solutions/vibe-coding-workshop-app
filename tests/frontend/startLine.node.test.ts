// Node unit test for the Genie Code start line (session linking): the line a
// learner says in Genie Code to continue THIS web session there.
//
// Run: node --experimental-strip-types --test tests/frontend/startLine.node.test.ts
//
// Loaded through Vite's module runner because genieCodeMcpConnection.ts uses
// extensionless imports. Every track id comes from the backend manifest, so a
// track the MCP server knows but the SPA cannot name fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadComponentModule } from './loadComponent.ts';

type ConnectionModule = typeof import('../../src/constants/genieCodeMcpConnection.ts');
type NamesModule = typeof import('../../src/constants/trackNames.ts');

const { startLineForSession, GENERIC_TRACK_START_PROMPT } =
  await loadComponentModule<ConnectionModule>('src/constants/genieCodeMcpConnection.ts');
const { TRACK_DISPLAY_NAMES } = await loadComponentModule<NamesModule>('src/constants/trackNames.ts');

const manifest = JSON.parse(
  readFileSync(new URL('../../src/backend/workshop/manifest.json', import.meta.url), 'utf-8'),
) as { tracks: Record<string, unknown> };
const TRACK_IDS = Object.keys(manifest.tracks);
const SID = '0f8e2c1a-1111-4222-8333-944455556666';

test('every manifest track has a display name and a start line', () => {
  for (const id of TRACK_IDS) {
    const name = (TRACK_DISPLAY_NAMES as Record<string, string>)[id];
    assert.ok(name, id);
    assert.equal(startLineForSession(id, SID), `${GENERIC_TRACK_START_PROMPT}: ${name} (session ${SID})`, id);
  }
});

test('the line names the track a learner reads, not its id', () => {
  assert.equal(
    startLineForSession('app-database', SID),
    `Start a workshop track: Databricks Apps + Lakebase (session ${SID})`,
  );
  assert.equal(startLineForSession('genie-accelerator', SID), `Start a workshop track: Genie Accelerator (session ${SID})`);
});

test('the UI never names the retired Genie Accelerator prompt', () => {
  for (const id of TRACK_IDS) assert.doesNotMatch(startLineForSession(id, SID), /Start the Genie Accelerator/);
});

test('no session yet: the line starts a new one', () => {
  assert.equal(startLineForSession('lakehouse', null), 'Start a workshop track: Lakehouse');
});

test('an unset or unknown level names the recommended track', () => {
  for (const level of ['', undefined, null, 'no-such-track']) {
    assert.equal(startLineForSession(level, SID), `Start a workshop track: Genie Accelerator (session ${SID})`);
  }
});
