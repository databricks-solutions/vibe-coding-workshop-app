// Node unit test for WorkflowStep restoring the target session's stored prompt
// after an in-page session switch (My Saved Sessions → another session).
//
// Run: node --experimental-strip-types --test tests/frontend/WorkflowStep.node.test.ts
//
// No DOM: the component is server-rendered, so effects and streaming never
// run. One mount receiving new props is driven by render-phase updates (see
// renderSequence); the asserted markup is the settled final render.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadComponentModule } from './loadComponent.ts';

type WorkflowStepModule = typeof import('../../src/components/WorkflowStep.tsx');
type StepProps = ComponentProps<WorkflowStepModule['WorkflowStep']>;

const { WorkflowStep } = await loadComponentModule<WorkflowStepModule>('src/components/WorkflowStep.tsx');

const BASE: StepProps = {
  icon: null,
  title: 'Step',
  description: 'A step',
  color: 'blue',
  sectionTag: 'no_such_step',
};

const A: StepProps = { ...BASE, sessionId: 'session-a', industry: 'retail', useCase: 'churn', initialPrompt: 'alphaprompt' };
const B: StepProps = { ...BASE, sessionId: 'session-b', industry: 'banking', useCase: 'fraud', initialPrompt: 'bravoprompt' };

// Renders one WorkflowStep mount through each props object in turn. Calling the
// component as a function makes its hooks part of Harness, and the render-phase
// update re-renders Harness with its hook state kept. Each props object is held
// for two passes so its own render-phase updates settle before the next one.
function renderSequence(steps: StepProps[]): string {
  function Harness() {
    const [pass, setPass] = useState(0);
    if (pass < 2 * steps.length - 1) setPass(pass + 1);
    return WorkflowStep(steps[Math.min(Math.floor(pass / 2), steps.length - 1)]);
  }
  return renderToStaticMarkup(createElement(Harness));
}

test('mounting with a stored prompt shows it', () => {
  const html = renderSequence([A]);
  assert.match(html, /alphaprompt/);
});

test('W1: switching to a session with another industry and use case shows its prompt', () => {
  const html = renderSequence([A, B]);
  assert.match(html, /bravoprompt/);
  assert.doesNotMatch(html, /alphaprompt/);
});

test('W2: switching between sessions with the same industry and use case shows the target prompt', () => {
  const sameScope: StepProps = { ...A, sessionId: 'session-b', initialPrompt: 'bravoprompt' };
  const html = renderSequence([A, sameScope]);
  assert.match(html, /bravoprompt/);
  assert.doesNotMatch(html, /alphaprompt/);
});

test('W3: switching to a session with no stored prompt clears the content', () => {
  const html = renderSequence([A, { ...B, initialPrompt: undefined }]);
  assert.doesNotMatch(html, /alphaprompt/);
  assert.doesNotMatch(html, /Generated Prompt/);
});

test('W4: shown content is not clobbered without a session change', () => {
  // Without a DOM nothing can stream, so the shown content comes from the
  // first restore. A later same-session initialPrompt (e.g. the periodic
  // streaming save echoing a partial buffer back) must not overwrite it, and
  // plain rerenders with identical props leave it in place.
  const echoed: StepProps = { ...A, initialPrompt: 'partialecho' };
  const html = renderSequence([A, A, echoed, echoed]);
  assert.match(html, /alphaprompt/);
  assert.doesNotMatch(html, /partialecho/);
  assert.match(renderSequence([A, A, A]), /alphaprompt/);
});

test('W5: a same-session initialPrompt update restores only into empty content', () => {
  const html = renderSequence([{ ...A, initialPrompt: undefined }, A]);
  assert.match(html, /alphaprompt/);
  const kept = renderSequence([A, { ...A, initialPrompt: 'savedlater' }]);
  assert.match(kept, /alphaprompt/);
  assert.doesNotMatch(kept, /savedlater/);
});

test('W6: switching to a session whose stored prompt equals the current one still shows it', () => {
  const html = renderSequence([A, { ...B, initialPrompt: 'alphaprompt' }]);
  assert.match(html, /alphaprompt/);
});
