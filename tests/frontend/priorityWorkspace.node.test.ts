import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf-8');

test('attendee and review maps use the same canonical portfolio assessment', () => {
  const insights = read('../../src/components/insights/InsightsFlow.tsx');
  const review = read('../../src/components/library/ReviewQueue.tsx');

  assert.match(insights, /assessPortfolioPriority\(idea\)/);
  assert.match(insights, /assessPortfolioPriority\(other\)/);
  assert.match(review, /assessPortfolioPriority\(idea,/);
  assert.doesNotMatch(insights, /assessPriority\(idea,\s*\{\s*dataSource/);
});

test('priority points support keyboard selection and full-screen expansion', () => {
  const matrix = read('../../src/components/insights/priority/PriorityMatrix.tsx');

  assert.match(matrix, /tabIndex=\{onSelectIdea \? 0 : undefined\}/);
  assert.match(matrix, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(matrix, /createPortal\(/);
  assert.match(matrix, /How to read/);
  assert.match(matrix, /Show labels/);
});

test('review selection is reflected in the URL and full-use-case action', () => {
  const review = read('../../src/components/library/ReviewQueue.tsx');

  assert.match(review, /next\.set\('id', ideaId\)/);
  assert.match(review, /setSearchParams\(next, \{ replace: true \}\)/);
  assert.match(review, /onOpenIdea=\{handleOpenIdea\}/);
});

test('score details expose weighted factors and missing evidence', () => {
  const assessment = read('../../src/components/insights/priorityAssessment.ts');
  const details = read('../../src/components/insights/priority/PriorityScoreDetails.tsx');

  for (const factor of ['Return on investment', 'Hard-dollar impact', 'Data readiness', 'Build complexity']) {
    assert.ok(assessment.includes(`label: '${factor}'`), `${factor} should be part of the calculation`);
  }
  assert.match(details, /How this is calculated/);
  assert.match(details, /Best next move/);
  assert.match(details, /Missing/);
});
