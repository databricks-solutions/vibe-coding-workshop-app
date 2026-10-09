// Node unit test for the per-track MCP start prompt the "Connect to Genie Code"
// panel names (P4.5, D-59).
//
// Run: node --experimental-strip-types --test tests/frontend/startPromptForTrack.node.test.ts
//
// Loaded through Vite's module runner because genieCodeMcpConnection.ts uses
// extensionless imports. Every track id comes from the backend manifest, so a
// track the MCP server knows but the SPA mishandles fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadComponentModule } from './loadComponent.ts';

type ConnectionModule = typeof import('../../src/constants/genieCodeMcpConnection.ts');

const { startPromptForTrack, GENIE_ACCELERATOR_START_PROMPT, GENERIC_TRACK_START_PROMPT } =
  await loadComponentModule<ConnectionModule>('src/constants/genieCodeMcpConnection.ts');

const manifest = JSON.parse(
  readFileSync(new URL('../../src/backend/workshop/manifest.json', import.meta.url), 'utf-8'),
) as { tracks: Record<string, unknown> };
const TRACK_IDS = Object.keys(manifest.tracks);

test('genie-accelerator keeps the Genie Accelerator prompt', () => {
  assert.deepEqual(startPromptForTrack('genie-accelerator'), {
    prompt: GENIE_ACCELERATOR_START_PROMPT,
    track: null,
  });
});

test('an unset level falls back to the Genie Accelerator prompt', () => {
  for (const level of ['', undefined, null]) {
    assert.deepEqual(startPromptForTrack(level), {
      prompt: GENIE_ACCELERATOR_START_PROMPT,
      track: null,
    });
  }
});

test('a level the SPA does not know falls back to the Genie Accelerator prompt', () => {
  assert.deepEqual(startPromptForTrack('no-such-track'), {
    prompt: GENIE_ACCELERATOR_START_PROMPT,
    track: null,
  });
});

test('lakehouse names the generic prompt with its track id', () => {
  assert.deepEqual(startPromptForTrack('lakehouse'), {
    prompt: GENERIC_TRACK_START_PROMPT,
    track: 'lakehouse',
  });
});

test('every manifest track other than genie-accelerator names the generic prompt', () => {
  assert.ok(TRACK_IDS.includes('genie-accelerator'));
  const others = TRACK_IDS.filter((id) => id !== 'genie-accelerator');
  assert.ok(others.length > 0);
  for (const id of others) {
    assert.deepEqual(startPromptForTrack(id), { prompt: GENERIC_TRACK_START_PROMPT, track: id }, id);
  }
});
