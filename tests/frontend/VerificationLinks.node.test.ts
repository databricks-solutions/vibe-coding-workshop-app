// Node unit test for VerificationLinks after its hooks were hoisted above the
// no-links early return (react-hooks/rules-of-hooks).
//
// Run: node --experimental-strip-types --test tests/frontend/VerificationLinks.node.test.ts
//
// No DOM: the component is server-rendered, so effects (the parameter fetch)
// never run. Link resolution is covered through the pure utils module, and the
// "one mount, sectionTag changes" case is driven by a render-phase update.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { STEP_VERIFICATION_LINKS } from '../../src/constants/verificationLinks.ts';
import { loadComponentModule } from './loadComponent.ts';

type VerificationLinksModule = typeof import('../../src/components/VerificationLinks.tsx');
type VerificationLinksUtils = typeof import('../../src/components/VerificationLinks.utils.ts');

const { VerificationLinks } = await loadComponentModule<VerificationLinksModule>(
  'src/components/VerificationLinks.tsx',
);
const { hasVerificationLinks, resolveVerificationLinks } = await loadComponentModule<VerificationLinksUtils>(
  'src/components/VerificationLinks.utils.ts',
);

const PARAMS: Record<string, string> = {
  workspace_url: 'https://example.cloud.databricks.com/',
  workspace_org_id: '1234',
  user_app_name: 'jane-app',
  app_name: 'workshop',
  lakebase_instance_name: 'lb one',
  lakebase_uc_catalog_name: 'lb_cat',
  lakehouse_default_catalog: 'main',
  chapter_3_lakehouse_catalog: 'src_cat',
  chapter_3_lakehouse_schema: 'src_schema',
  user_schema_prefix: 'jane_vibe_coding',
  created_by: 'jane@example.com',
};

test('empty-linkDefs branch: an unknown step renders nothing', () => {
  assert.equal(hasVerificationLinks('no_such_step'), false);
  for (const sessionId of [null, 's1']) {
    assert.equal(renderToStaticMarkup(createElement(VerificationLinks, { sectionTag: 'no_such_step', sessionId })), '');
  }
});

test('a step with links renders nothing before its parameters load', () => {
  for (const sessionId of [null, 's1']) {
    assert.equal(
      renderToStaticMarkup(createElement(VerificationLinks, { sectionTag: 'workspace_setup_deploy', sessionId })),
      '',
    );
  }
});

test('resolves every defined step link when all parameters are present', () => {
  for (const [tag, defs] of Object.entries(STEP_VERIFICATION_LINKS)) {
    const links = resolveVerificationLinks(tag, PARAMS);
    assert.deepEqual(links.map((l) => l.label), defs.map((d) => d.label), tag);
    for (const link of links) assert.doesNotMatch(link.url, /\{\w+\}/, `${tag}: ${link.url}`);
  }
});

test('workspace_url is normalized to one trailing slash and other values are URI-encoded', () => {
  const [link] = resolveVerificationLinks('workspace_setup_deploy', {
    ...PARAMS,
    workspace_url: 'https://example.cloud.databricks.com///',
    user_app_name: 'a b',
  });
  assert.equal(link.url, 'https://example.cloud.databricks.com/apps/a%20b?o=1234');
});

test('links with a missing parameter are dropped; an unknown step resolves to none', () => {
  const { user_app_name: _dropped, ...partial } = PARAMS;
  void _dropped;
  assert.deepEqual(resolveVerificationLinks('workspace_setup_deploy', partial), []);
  assert.deepEqual(resolveVerificationLinks('no_such_step', PARAMS), []);
});

test('one mount can move from a step without links to one with links', () => {
  // Calling the component as a function makes its hooks part of Harness, and
  // the render-phase update re-renders Harness with its hook state kept: the
  // second pass runs with a sectionTag that has links.
  function Harness() {
    const [pass, setPass] = useState(0);
    if (pass === 0) setPass(1);
    return VerificationLinks({ sectionTag: pass === 0 ? 'no_such_step' : 'workspace_setup_deploy', sessionId: 's1' });
  }
  assert.equal(renderToStaticMarkup(createElement(Harness)), '');
});
