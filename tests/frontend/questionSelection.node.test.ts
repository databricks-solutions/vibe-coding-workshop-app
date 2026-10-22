import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MULTI_SEPARATOR, NOT_SURE_PICK, restoreQuestionSelection } from '../../src/components/journeykit/ui/questionSelection.ts';

const options = ['Gate agent', 'Dispatcher', 'Station manager'];

test('restores a predefined answer as selected', () => {
  assert.deepEqual(
    restoreQuestionSelection('Dispatcher', options, false, ['Not sure yet']),
    { picks: ['Dispatcher'], custom: [] },
  );
});

test('restores a custom answer instead of falling back to the recommendation', () => {
  assert.deepEqual(
    restoreQuestionSelection('Network operations controller', options, false, ['Not sure yet']),
    {
      picks: ['Network operations controller'],
      custom: ['Network operations controller'],
    },
  );
});

test('restores mixed predefined and custom multi-select answers', () => {
  const selected = ['Gate agent', 'Crew scheduling', 'Dispatcher'].join(MULTI_SEPARATOR);
  assert.deepEqual(
    restoreQuestionSelection(selected, options, true, ['Not sure yet']),
    {
      picks: ['Gate agent', 'Crew scheduling', 'Dispatcher'],
      custom: ['Crew scheduling'],
    },
  );
});

test('restores not-sure without treating it as custom text', () => {
  assert.deepEqual(
    restoreQuestionSelection('Not sure yet', options, false, ['Not sure yet']),
    { picks: [NOT_SURE_PICK], custom: [] },
  );
});
