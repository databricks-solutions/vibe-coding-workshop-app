import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourcePresentation } from '../../src/components/library/supportingResource.ts';

test('YouTube resources receive a safe thumbnail and video treatment', () => {
  const resource = resourcePresentation({
    url: 'https://www.youtube.com/watch?v=MUa5kbIV1Lc',
    label: 'Workshop walkthrough',
  });

  assert.equal(resource?.kind, 'youtube');
  assert.equal(resource?.title, 'Workshop walkthrough');
  assert.equal(resource?.thumbnailUrl, 'https://i.ytimg.com/vi/MUa5kbIV1Lc/hqdefault.jpg');
});

test('Google resources are classified without requiring remote metadata', () => {
  assert.equal(resourcePresentation({ url: 'https://docs.google.com/document/d/abc' })?.kind, 'google_doc');
  assert.equal(resourcePresentation({ url: 'https://docs.google.com/spreadsheets/d/abc' })?.kind, 'google_sheet');
  assert.equal(resourcePresentation({ url: 'https://docs.google.com/presentation/d/abc' })?.kind, 'google_slide');
});

test('unsafe or malformed links do not render', () => {
  assert.equal(resourcePresentation({ url: 'javascript:alert(1)' }), null);
  assert.equal(resourcePresentation({ url: 'http://example.com/video' }), null);
  assert.equal(resourcePresentation({ url: 'not a url' }), null);
});

test('reference contribution demonstrates the featured video capability', () => {
  const sample = readFileSync(
    new URL('../../contrib/usecases/sample/contributed_usecase_starter/usecase.yaml', import.meta.url),
    'utf-8',
  );
  assert.match(sample, /featured_resource:/);
  assert.match(sample, /youtube\.com\/watch/);
});
