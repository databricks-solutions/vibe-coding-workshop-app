// Node tests for AI-DLC asset pack generation, zip binary integrity, NFR clarity scoring,
// matchingContext / buildDescription enrichment, and composeBrief/parseBrief backwards-compatibility.
//
// Run: node --experimental-strip-types --test tests/frontend/dlcAssets.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import type { Idea } from '../../src/components/journeykit/engine/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

async function load<T>(srcPath: string): Promise<T> {
  const { module } = await runnerImport<T>(`${ROOT}${srcPath}`, {
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'stub-css',
      enforce: 'pre',
      resolveId: id => (id.endsWith('.css') ? '\0stub-css' : null),
      load: id => (id === '\0stub-css' ? 'export default ""' : null),
    }],
  });
  return module;
}

type DlcAssetsModule = typeof import('../../src/components/journeykit/engine/dlcAssets.ts');
type ZipModule = typeof import('../../src/components/journeykit/engine/zip.ts');
type IdeaContextModule = typeof import('../../src/components/journeykit/engine/ideaContext.ts');
type HandoffModule = typeof import('../../src/components/journeykit/engine/handoff.ts');
type BriefModule = typeof import('../../src/components/insights/brief.ts');

const { buildDlcAssets, buildStakeholderReviewRequest, collectConstraints, collectAffectedSystems } =
  await load<DlcAssetsModule>('src/components/journeykit/engine/dlcAssets.ts');
const { buildZipBytes } = await load<ZipModule>('src/components/journeykit/engine/zip.ts');
const { clarityByDimension, matchingContext } = await load<IdeaContextModule>('src/components/journeykit/engine/ideaContext.ts');
const { buildDescription } = await load<HandoffModule>('src/components/journeykit/engine/handoff.ts');
const { composeBrief, parseBrief } = await load<BriefModule>('src/components/insights/brief.ts');

const sampleIdea: Idea = {
  id: 'idea-dlc-1',
  seed: 'Customers phone the contact center to ask where their claim is.',
  title: 'Claims Status Self-Service',
  industry: 'Property & Casualty Insurance',
  status: 'committed',
  mode: 'insights',
  revision: 2,
  review: { status: 'draft', revision: 2, history: [] },
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:30:00Z',
  step: 'brief',
  approved: ['spark', 'map', 'clarify', 'shape', 'questions', 'brief'],
  spark: {
    title: 'Claims Status Self-Service',
    statement: 'Policyholders check live claim status and next expected date in the portal.',
    industry: 'Property & Casualty Insurance',
    primaryEntity: 'claim / policyholder / day',
    affectedSystems: ['claims-core API', 'Customer portal'],
    constraints: ['No new PII in portal session', 'Existing SSO auth only'],
    openQuestions: ['Do third-party loss adjusters need access?'],
  },
  map: {
    branches: [{
      id: 'service',
      name: 'Claims Service',
      leaves: [{
        id: 'status-portal',
        name: 'Self-service claim tracker',
        problem: 'Status-only calls consume handler capacity',
        personas: ['Claims handler', 'Policyholder'],
        surfaces: ['Genie', 'Dashboard'],
      }],
    }],
    placedLeafId: 'status-portal',
    adjacentLeafIds: [],
    rationale: 'Directly eliminates status-only contact center calls.',
  },
  questions: [
    { id: 'q-biz', dimension: 'business', question: 'What is the primary metric?', options: ['Status call volume'] },
    { id: 'q-scope', dimension: 'scope', question: 'What should v1 NOT do?', options: ['Automated payouts'], multi: true },
    { id: 'q-nfr', dimension: 'nfr', question: 'Which guardrails apply?', options: ['Certified data only'], multi: true },
  ],
  answers: {
    'q-biz': 'Status call volume',
    'q-scope': 'Automated payouts',
    'q-nfr': 'Certified data only',
  },
  shapes: [{
    id: 'copilot-1',
    kind: 'copilot',
    title: 'Handler & Portal Copilot',
    value: 'Cuts status-only calls by 35%.',
    effort: 'M',
    riskiestAssumption: 'Claim status codes map cleanly to plain English.',
    cheapTest: 'Validate mapping on 50 historical claims.',
    surfaces: ['App', 'Genie', 'Dashboard'],
    policyConflicts: ['Ensure portal never caches raw claim notes'],
  }],
  chosenShapeId: 'copilot-1',
  genieQuestions: [
    'Which claim types drive the most status-only calls this week?',
    'Which open claims are past SLA right now?',
  ],
  genieQuestionSources: {
    'Which claim types drive the most status-only calls this week?': 'ai',
    'Which open claims are past SLA right now?': 'you',
  },
  questionDetails: {
    'Which claim types drive the most status-only calls this week?': {
      kind: 'look_back',
      drivesAction: 'Prioritize top call drivers in portal',
      metrics: ['Status call count'],
      dimensions: ['Claim type', 'Week'],
    },
  },
  summary: {
    subtitle: 'Cut status-only calls.',
    problemToday: 'Handlers spend a third of call time on status checks.',
    whoItsFor: 'Claims handlers and policyholders',
    metric: { label: 'Status call volume', today: '1,200/wk', target: '750/wk' },
    whatWeBuild: 'Genie + Dashboard + App',
    workflowSteps: ['Check claim', 'View next step'],
    stack: { data: 'claims_gold', shape: 'metric view', serve: 'Genie', use: 'App' },
    risks: [{ risk: 'Stale status', guard: 'Refresh hourly' }],
    nextSteps: ['Run pilot'],
    decision: 'Approve 6-week pilot',
    pilotSuccess: 'Status calls down 25% in 6 weeks',
    killCriterion: 'Stop if accuracy < 90% on 50 claims',
  },
  brief: '## Headline\nSelf-service claims.\n\n## Test Scenarios\n1. **Happy path**: Given an open claim, when policyholder checks status, then next step displays.',
  assumptions: [
    { id: 'a1', text: 'Existing SSO token carries policy ID.', step: 'spark', status: 'accepted' },
    { id: 'a2', text: 'Claims-core API supports 50 rps.', step: 'shape', status: 'open' },
  ],
  decisions: [],
};

test('buildDlcAssets produces the 4 AI-DLC files with intent, constraints, conflicts, and locked evals', () => {
  assert.deepEqual(collectConstraints(sampleIdea), [
    'No new PII in portal session',
    'Existing SSO auth only',
    'Certified data only',
  ]);
  assert.deepEqual(collectAffectedSystems(sampleIdea), ['claims-core API', 'Customer portal']);

  const assets = buildDlcAssets(sampleIdea);
  assert.deepEqual(assets.map(a => a.name), ['intent.md', 'spec.md', 'AGENTS.md', 'evals.json']);

  const [intent, spec, agents, evalsRaw] = assets.map(a => a.content);
  assert.match(intent, /# Intent: Claims Status Self-Service/);
  assert.match(intent, /claims-core API, Customer portal/);
  assert.match(intent, /No new PII in portal session/);
  assert.match(intent, /Do third-party loss adjusters need access\?/);

  assert.match(spec, /\[Policy conflict\] Ensure portal never caches raw claim notes/);
  assert.match(spec, /Automated payouts/);
  assert.match(spec, /Status calls down 25% in 6 weeks/);
  assert.match(spec, /Stop if accuracy < 90% on 50 claims/);

  assert.match(agents, /Do NOT delete, weaken, or rewrite questions or scenarios in `evals\.json`/);
  assert.match(agents, /Existing SSO auth only/);

  const evals = JSON.parse(evalsRaw);
  assert.equal(evals.genieBenchmarks.length, 2);
  assert.equal(evals.genieBenchmarks[0].requiredMetrics[0], 'Status call count');
  assert.equal(evals.testScenarios.length, 1);
  assert.equal(evals.testScenarios[0].name, 'Happy path');
});

test('buildZipBytes emits valid PKZIP local headers, central directory, and EOCD', () => {
  const assets = buildDlcAssets(sampleIdea);
  const bytes = buildZipBytes(assets.map(a => ({ name: `claims/${a.name}`, content: a.content })));
  // Starts with PK\x03\x04 local file header signature
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  // Ends with PK\x05\x06 EOCD signature (no archive comment)
  const eocdOffset = bytes.length - 22;
  assert.equal(bytes[eocdOffset], 0x50);
  assert.equal(bytes[eocdOffset + 1], 0x4b);
  assert.equal(bytes[eocdOffset + 2], 0x05);
  assert.equal(bytes[eocdOffset + 3], 0x06);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint16(eocdOffset + 8, true), 4);
  assert.equal(view.getUint16(eocdOffset + 10, true), 4);
});

test('NFR clarity, matchingContext, buildDescription, and composeBrief/parseBrief carry constraints cleanly', () => {
  const clarity = clarityByDimension(sampleIdea);
  assert.equal(clarity.nfr, 1);

  const matchText = matchingContext(sampleIdea);
  assert.match(matchText, /Affected systems: claims-core API, Customer portal/);
  assert.match(matchText, /Constraints: No new PII in portal session; Existing SSO auth only/);
  assert.match(matchText, /Out of scope: Automated payouts/);

  const techDesc = buildDescription(sampleIdea);
  assert.match(techDesc, /## Constraints & Guardrails/);
  assert.match(techDesc, /## Locked Eval Questions/);

  const briefText = composeBrief({
    name: 'Claims Status',
    industryLabel: 'Insurance',
    questions: sampleIdea.genieQuestions!,
    dataSource: 'existing',
    dataLocation: 'claims_prod.gold',
    idea: {
      headline: sampleIdea.title,
      problem: sampleIdea.spark?.statement,
      constraints: collectConstraints(sampleIdea),
      affectedSystems: collectAffectedSystems(sampleIdea),
      notDoing: ['Automated payouts'],
      decisionGrain: sampleIdea.spark?.primaryEntity,
      pilotSuccess: sampleIdea.summary?.pilotSuccess,
      killCriterion: sampleIdea.summary?.killCriterion,
    },
  });
  assert.match(briefText, /^Constraints: No new PII in portal session; Existing SSO auth only; Certified data only$/m);
  assert.match(briefText, /^First version will not: Automated payouts$/m);
  const parsed = parseBrief(briefText);
  assert.equal(parsed.ideaHeadline, 'Claims Status Self-Service');
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.dataLocation, 'claims_prod.gold');

  const reviewReq = buildStakeholderReviewRequest(sampleIdea);
  assert.match(reviewReq, /Three quick questions:/);
  assert.match(reviewReq, /No new PII in portal session/);
});
