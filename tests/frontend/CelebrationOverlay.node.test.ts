// Node unit test: CelebrationOverlay's confetti is randomized once per mount,
// not on every render (react-hooks/purity).
//
// Run: node --experimental-strip-types --test tests/frontend/CelebrationOverlay.node.test.ts
//
// No DOM. Harness calls ConfettiBurst as a function so its hooks belong to
// Harness, then a render-phase update re-renders Harness with that hook state
// kept: two renders of one mount. Each pass's particle elements are rendered to
// markup separately, so randomness in ConfettiParticle's render shows up too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type CelebrationOverlayModule = typeof import('../../src/components/CelebrationOverlay.tsx');

const { ConfettiBurst } = await loadComponentModule<CelebrationOverlayModule>(
  'src/components/CelebrationOverlay.tsx',
);

function renderTwiceInOneMount(props: Parameters<typeof ConfettiBurst>[0]): [string, string] {
  const passes: ReactNode[] = [];
  function Harness() {
    const [pass, setPass] = useState(0);
    passes.push(ConfettiBurst(props));
    if (pass === 0) setPass(1);
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  assert.equal(passes.length, 2, 'Harness should render exactly twice');
  return [renderToStaticMarkup(passes[0]), renderToStaticMarkup(passes[1])];
}

test('particle positions and rotations are stable across re-renders', () => {
  const [first, second] = renderTwiceInOneMount({ count: 35, centerX: 50, centerY: 45, spread: 40 });
  assert.match(first, /rotate\([\d.]+deg\)/);
  assert.equal((first.match(/animate-celebration-confetti/g) ?? []).length, 35);
  assert.equal(second, first);
});

test('separate mounts still get their own random layout', () => {
  const a = renderToStaticMarkup(createElement(ConfettiBurst, { count: 35 }));
  const b = renderToStaticMarkup(createElement(ConfettiBurst, { count: 35 }));
  assert.notEqual(a, b);
});
