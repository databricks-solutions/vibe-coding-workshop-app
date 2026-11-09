import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Analytics owns vertical scrolling inside the fixed-height app shell', () => {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf-8');
  const analytics = readFileSync(new URL('../../src/components/AnalyticsDashboard.tsx', import.meta.url), 'utf-8');

  assert.match(app, /<main className="flex-1 flex flex-col overflow-hidden">/);
  assert.match(analytics, /className="h-full min-h-0 overflow-y-auto bg-background"/);
  assert.doesNotMatch(analytics, /className="min-h-screen bg-background"/);
});
