// Node tests for BundleUpdateNotice: an open SPA learns when a rolling deploy
// has published a new hashed bundle. The bundle helpers are module-private
// (exporting non-components from a .tsx trips react-refresh/only-export-components),
// so this reads the source and evaluates its own expressions, the way
// genieDefaultSession.node.test.ts checks App.tsx.
//
// Run: node --experimental-strip-types --test tests/frontend/BundleUpdateNotice.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../src/components/BundleUpdateNotice.tsx', import.meta.url), 'utf-8');

/** The expression after `const <name> = (<params>) =>`, up to its closing `;`. */
function arrowBody(name: string): string {
  const m = SRC.match(new RegExp(`const ${name} = \\([^)]*\\) =>\\s*([\\s\\S]*?);\\n`));
  assert.ok(m, `BundleUpdateNotice.tsx defines ${name}`);
  return m[1];
}

type Script = { src: string };
const ORIGIN = 'https://app.example/';

const loadedBundle = new Function('document', 'location', `return (${arrowBody('loadedBundle')});`) as
  (document: { scripts: Script[] }, location: { href: string }) => string | null;
const bundleFromHtml = new Function('html', `return (${arrowBody('bundleFromHtml')});`) as
  (html: string) => string | null;

/** Evaluates the component's own "is this a different bundle?" condition. */
function isNewBundle(): (alive: boolean, next: string | null, current: string) => unknown {
  const m = SRC.match(/if \((alive && next && [^)]*\)[^)]*)\) setAvailable\(true\);/);
  assert.ok(m, 'check() sets the notice behind one condition');
  const fn = new Function('alive', 'next', 'current', 'location', `return (${m[1]});`);
  return (alive, next, current) => fn(alive, next, current, { href: ORIGIN });
}

const PAGE = (src: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script></head><body></body></html>`;

// ---------------------------------------------------------------------------
// Bundle detection
// ---------------------------------------------------------------------------

test('the fetched page yields its hashed /assets/index-<hash>.js bundle', () => {
  assert.equal(bundleFromHtml(PAGE('/assets/index-Bx3_k9-Q.js')), '/assets/index-Bx3_k9-Q.js');
  assert.equal(bundleFromHtml(`<script src='/assets/index-abc123.js'></script>`), '/assets/index-abc123.js');
});

test('a Vite dev page has no hashed bundle: null', () => {
  assert.equal(bundleFromHtml(PAGE('/src/main.tsx')), null);
  assert.equal(bundleFromHtml(PAGE('/assets/index.js')), null);
  assert.equal(bundleFromHtml('<html></html>'), null);
});

test('the loaded bundle is read from the page scripts; none in dev mode, and the component stops', () => {
  const doc = (srcs: string[]) => ({ scripts: srcs.map(src => ({ src })) });
  assert.equal(loadedBundle(doc(['https://app.example/assets/index-Bx3_k9-Q.js']), { href: ORIGIN }), '/assets/index-Bx3_k9-Q.js');
  assert.equal(loadedBundle(doc(['', '/assets/vendor-1.js', '/assets/index-abc.js']), { href: ORIGIN }), '/assets/index-abc.js');
  assert.equal(loadedBundle(doc(['/@vite/client', '/src/main.tsx']), { href: ORIGIN }), null);
  assert.match(SRC, /const current = loadedBundle\(\);\s*if \(!current\) return;/);
});

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

test('it polls every 45 seconds', () => {
  assert.match(SRC, /window\.setInterval\(check, 45_000\);/);
});

test('the check fetches the root with a _bundle_check cache-buster and no-store', () => {
  assert.match(SRC, /fetch\(`\/\?_bundle_check=\$\{Date\.now\(\)\}`, \{ cache: 'no-store', credentials: 'same-origin' \}\)/);
});

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

test('the same bundle shows no notice', () => {
  const differs = isNewBundle();
  assert.ok(!differs(true, '/assets/index-abc.js', '/assets/index-abc.js'));
  assert.ok(!differs(true, 'https://app.example/assets/index-abc.js', '/assets/index-abc.js'), 'compared by pathname');
});

test('a different bundle shows the notice', () => {
  assert.ok(isNewBundle()(true, '/assets/index-def.js', '/assets/index-abc.js'));
});

test('no notice without a bundle in the response or after unmount', () => {
  const differs = isNewBundle();
  assert.ok(!differs(true, null, '/assets/index-abc.js'));
  assert.ok(!differs(false, '/assets/index-def.js', '/assets/index-abc.js'));
});
