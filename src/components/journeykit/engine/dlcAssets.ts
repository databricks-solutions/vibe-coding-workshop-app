import { money, units } from './businessCase';
import { alsoLeaves, answerFor, caseFigures, chosenShape, placedLeaf } from './ideaContext';
import { buildLines, shapeBuild } from './surfaces';
import { NOT_SURE, type Idea } from './types';

export type DlcAssetKey = 'intent.md' | 'spec.md' | 'AGENTS.md' | 'evals.json';

export interface DlcAssetFile {
  name: DlcAssetKey;
  label: string;
  summary: string;
  content: string;
}

function splitListAnswer(raw?: string): string[] {
  if (!raw || raw === NOT_SURE) return [];
  return raw.split(';').map(s => s.trim()).filter(Boolean);
}

export function collectConstraints(idea: Idea): string[] {
  const raw = [
    ...(idea.spark?.constraints ?? []),
    ...splitListAnswer(answerFor(idea, 'nfr')),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function collectAffectedSystems(idea: Idea): string[] {
  const raw = [
    ...(idea.spark?.affectedSystems ?? []),
    ...(idea.useCaseContext?.entities ?? []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function collectOpenQuestions(idea: Idea): string[] {
  const raw = [
    ...(idea.spark?.openQuestions ?? []),
    ...idea.assumptions.filter(a => a.status === 'question').map(a => a.text),
    ...idea.assumptions.filter(a => a.status === 'open').map(a => `[Unsettled assumption] ${a.text}`),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function extractBriefScenarios(brief?: string): { name: string; text: string }[] {
  if (!brief) return [];
  const section = brief.split(/(?=^##\s)/m).find(s => /^##\s+Test Scenarios\b/i.test(s));
  if (!section) return [];
  return section
    .split('\n')
    .slice(1)
    .map(l => l.trim())
    .filter(l => /^(?:[-*]|\d+[.)])\s+/.test(l) || /^\*\*/.test(l))
    .map((line, idx) => {
      const cleaned = line.replace(/^(?:[-*]|\d+[.)])\s*/, '').trim();
      const bold = cleaned.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
      return {
        name: bold ? bold[1].trim() : `Scenario ${idx + 1}`,
        text: bold ? (bold[2] || bold[1]).trim() : cleaned,
      };
    })
    .filter(s => s.text.length > 0);
}

function setupDataLines(idea: Idea): string[] {
  const draft = idea.setupDraft;
  if (!draft) return [];
  const lines: string[] = [];
  if (draft.dataSource) lines.push(`- Data mode: ${draft.dataSource}`);
  if (draft.dataLocation) lines.push(`- Catalog / schema location: ${draft.dataLocation}`);
  lines.push(`- Certified assets only: ${draft.includeUncertified ? 'No (includes uncertified)' : 'Yes'}`);
  return lines;
}

export function generateIntentMd(idea: Idea): string {
  const leaf = placedLeaf(idea);
  const also = alsoLeaves(idea);
  const personas = [...new Set([
    ...(leaf?.personas ?? []),
    ...also.flatMap(l => l.personas),
    ...(idea.useCaseContext?.personas.map(p => `${p.name} (${p.role})`) ?? []),
  ])];
  const systems = collectAffectedSystems(idea);
  const constraints = collectConstraints(idea);
  const openQuestions = collectOpenQuestions(idea);
  const accepted = idea.assumptions.filter(a => a.status === 'accepted').map(a => a.text);
  const metric = answerFor(idea, 'business');
  const status = idea.review?.status ?? 'draft';

  const lines: string[] = [
    `# Intent: ${idea.title}`,
    `Idea ID: ${idea.id} · Revision: ${idea.revision ?? 1} · Status: ${status}${idea.spark?.industry ? ` · Industry: ${idea.spark.industry}` : ''}`,
    '',
    '## Problem',
    idea.spark?.statement || idea.seed,
    ...(idea.spark?.valueHypothesis ? ['', `Value hypothesis: ${idea.spark.valueHypothesis}`] : []),
    '',
    '## Proposed outcome',
    ...(metric ? [`- Success metric: ${metric}`] : []),
    ...(idea.spark?.primaryEntity ? [`- Decision grain: ${idea.spark.primaryEntity}`] : []),
    ...(idea.summary?.pilotSuccess ? [`- Pilot success target: ${idea.summary.pilotSuccess}`] : []),
    ...(!metric && !idea.spark?.primaryEntity && !idea.summary?.pilotSuccess ? ['- Deliver measurable operational impact in the pilot scope before full rollout.'] : []),
    '',
    '## Affected users and systems',
    ...(personas.length ? [`- Users: ${personas.join(', ')}`] : ['- Users: Not specified']),
    ...(systems.length ? [`- Systems & data: ${systems.join(', ')}`] : ['- Systems & data: To be confirmed during data scan']),
    ...(leaf ? [`- Primary capability: ${leaf.branch} -> ${leaf.name}`] : []),
    '',
    '## Constraints',
    ...(constraints.length ? constraints.map(c => `- ${c}`) : ['- Enforce governed data access and confirm PII/auth boundaries before build.']),
    ...(accepted.length ? ['', '## Accepted assumptions', ...accepted.map(a => `- ${a}`)] : []),
    '',
    '## Open questions',
    ...(openQuestions.length ? openQuestions.map(q => `- ${q}`) : ['- None remaining.']),
  ];
  return lines.join('\n');
}

export function generateSpecMd(idea: Idea): string {
  const shape = chosenShape(idea);
  const figures = caseFigures(idea);
  const constraints = collectConstraints(idea);
  const notDoing = splitListAnswer(answerFor(idea, 'scope'));
  const systems = collectAffectedSystems(idea);
  const openAssumptions = idea.assumptions.filter(a => a.status !== 'accepted').map(a => a.text);
  const conflicts = shape?.policyConflicts ?? [];
  const dataLines = setupDataLines(idea);
  const activeDetails = (idea.genieQuestions ?? []).flatMap(q => (idea.questionDetails?.[q] ? [{ q, detail: idea.questionDetails[q] }] : []));
  const metrics = [...new Set(activeDetails.flatMap(d => d.detail.metrics ?? []))];
  const dimensions = [...new Set(activeDetails.flatMap(d => d.detail.dimensions ?? []))];
  const buildInfo = shape ? shapeBuild(shape) : null;

  const lines: string[] = [
    `# Spec: ${idea.title}`,
    `Source Intent: intent.md (Idea ID ${idea.id}, rev ${idea.revision ?? 1})`,
    '',
    '## Flagged concerns & policy conflicts',
    ...(conflicts.length
      ? conflicts.map(c => `- [Policy conflict] ${c}`)
      : ['- No policy conflicts flagged on the chosen approach.']),
    ...(openAssumptions.length
      ? openAssumptions.map(a => `- [Open assumption] ${a}`)
      : []),
    '',
    '## Chosen approach & surfaces',
    ...(shape ? [
      `- Approach: **${shape.title}** (${shape.kind}) — ${shape.value}`,
      ...(shape.decisionStyle || shape.cadence
        ? [`- Decision mode: ${[shape.decisionStyle, shape.cadence].filter(Boolean).join(' · ')}`]
        : []),
      ...buildLines(shape).map(l => `- ${l}`),
      ...(buildInfo ? [`- Surfaces: ${buildInfo.surfaces.join(', ')}`] : []),
      ...(shape.riskiestAssumption ? [`- Riskiest assumption: ${shape.riskiestAssumption}`] : []),
      ...(shape.cheapTest ? [`- Cheap first test: ${shape.cheapTest}`] : []),
    ] : ['- Approach not selected yet.']),
    '',
    '## Functional scope',
    '**In scope:**',
    `- Solve: ${idea.spark?.statement || idea.seed}`,
    ...(idea.genieQuestions?.length ? [`- Answer and benchmark the ${idea.genieQuestions.length} locked Genie questions in evals.json.`] : []),
    '',
    '**Out of scope (v1):**',
    ...(notDoing.length ? notDoing.map(n => `- ${n}`) : ['- Anything outside the pilot scope until pilot success criteria are met.']),
    '',
    '**Hard constraints:**',
    ...(constraints.length ? constraints.map(c => `- ${c}`) : ['- Follow workspace Unity Catalog governance and existing authentication.']),
    '',
    '## Data & governed metrics',
    ...(systems.length ? [`- Systems & entities: ${systems.join(', ')}`] : []),
    ...(metrics.length ? [`- Required metrics: ${metrics.join(', ')}`] : []),
    ...(dimensions.length ? [`- Required dimensions / grain: ${dimensions.join(', ')}`] : []),
    ...(dataLines.length ? dataLines : ['- Data source will be confirmed on the Build Data step.']),
    '',
    '## Success metric, pilot & kill criteria',
    ...(answerFor(idea, 'business') ? [`- Target KPI: ${answerFor(idea, 'business')}`] : []),
    ...(figures ? [`- Directional annual value: ~${money(figures.value.expected)}/yr (${money(figures.hard)} hard, ${money(figures.soft)} soft)${figures.rollout ? ` across ${units(figures.rollout.units, figures.rollout.unit)}` : ''}`] : []),
    ...(idea.summary?.pilotSuccess ? [`- Pilot success: ${idea.summary.pilotSuccess}`] : []),
    ...(idea.summary?.killCriterion ? [`- Stop / kill criterion: ${idea.summary.killCriterion}`] : []),
    ...(idea.summary?.keyResults?.length
      ? ['', '**Key Results:**', ...idea.summary.keyResults.map(kr => `- ${kr.kr}: ${kr.target}`)]
      : []),
  ];
  return lines.join('\n');
}

export function generateAgentsMd(idea: Idea): string {
  const shape = chosenShape(idea);
  const constraints = collectConstraints(idea);
  const notDoing = splitListAnswer(answerFor(idea, 'scope'));
  const surfaces = shape ? shapeBuild(shape).surfaces : ['Genie', 'Dashboard'];
  const evalCount = idea.genieQuestions?.length ?? 0;

  const lines: string[] = [
    `# AGENTS.md — ${idea.title}`,
    '',
    'Project guardrails derived from `intent.md` and `spec.md` (Idea ID `' + idea.id + '`, rev `' + (idea.revision ?? 1) + '`).',
    '',
    '## Intent & Scope',
    `- Goal: ${idea.spark?.statement || idea.seed}`,
    ...(idea.spark?.primaryEntity ? [`- Decision grain: ${idea.spark.primaryEntity}`] : []),
    `- Target surfaces: ${surfaces.join(', ')}`,
    ...(notDoing.length ? [`- Out of scope for v1: ${notDoing.join('; ')}`] : []),
    '',
    '## Hard Constraints (Always Enforce)',
    ...(constraints.length ? constraints.map(c => `- ${c}`) : ['- Only read governed/certified Unity Catalog assets unless explicitly approved otherwise.']),
    ...(shape?.policyConflicts?.length
      ? shape.policyConflicts.map(c => `- Resolve before shipping: ${c}`)
      : []),
    '',
    '## Verifying Your Work (Eval Lock)',
    `- \`evals.json\` defines ${evalCount} benchmark question${evalCount === 1 ? '' : 's'} and scenario checks that represent "done".`,
    '- Do NOT delete, weaken, or rewrite questions or scenarios in `evals.json` to make a check pass. Fix the underlying data model, metric view, or app logic instead.',
    ...(idea.summary?.pilotSuccess ? [`- Pilot bar: ${idea.summary.pilotSuccess}`] : []),
    ...(idea.summary?.killCriterion ? [`- Stop / rollback trigger: ${idea.summary.killCriterion}`] : []),
    '',
    '## Things to Avoid',
    '- Never invent table names, column names, or business metrics not verified in Unity Catalog or `spec.md`.',
    '- Never print or log raw PII or bypass existing workspace authentication.',
  ];
  return lines.join('\n');
}

export function generateEvalsJson(idea: Idea): string {
  const questions = (idea.genieQuestions ?? []).map((q, index) => {
    const detail = idea.questionDetails?.[q];
    return {
      id: `eval-q-${index + 1}`,
      question: q,
      source: idea.genieQuestionSources?.[q] ?? 'you',
      kind: detail?.kind ?? null,
      drivesAction: detail?.drivesAction ?? null,
      requiredMetrics: detail?.metrics ?? [],
      requiredDimensions: detail?.dimensions ?? [],
    };
  });
  const scenarios = extractBriefScenarios(idea.brief);
  const payload = {
    schemaVersion: '1.0',
    ideaId: idea.id,
    revision: idea.revision ?? 1,
    title: idea.title,
    decisionGrain: idea.spark?.primaryEntity ?? null,
    constraints: collectConstraints(idea),
    pilotSuccess: idea.summary?.pilotSuccess ?? null,
    killCriterion: idea.summary?.killCriterion ?? null,
    genieBenchmarks: questions,
    testScenarios: scenarios,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildDlcAssets(idea: Idea): DlcAssetFile[] {
  return [
    {
      name: 'intent.md',
      label: 'intent.md',
      summary: 'Problem, proposed outcome, affected users & systems, hard constraints, and open questions.',
      content: generateIntentMd(idea),
    },
    {
      name: 'spec.md',
      label: 'spec.md',
      summary: 'Flagged policy concerns, scope boundaries, chosen surfaces, data & metrics, and pilot criteria.',
      content: generateSpecMd(idea),
    },
    {
      name: 'AGENTS.md',
      label: 'AGENTS.md',
      summary: 'Concise coding-agent manual encoding hard constraints and locking evals.json.',
      content: generateAgentsMd(idea),
    },
    {
      name: 'evals.json',
      label: 'evals.json',
      summary: 'Machine-readable Genie benchmark questions and test scenarios.',
      content: generateEvalsJson(idea),
    },
  ];
}

/** Short async feedback prompt users can paste into Slack/email/Teams to get actionable colleague input. */
export function buildStakeholderReviewRequest(idea: Idea): string {
  const shape = chosenShape(idea);
  const constraints = collectConstraints(idea);
  const metric = answerFor(idea, 'business');
  return [
    `Quick sanity check on "${idea.title}" (2 min):`,
    '',
    `Problem: ${idea.spark?.statement || idea.seed}`,
    ...(metric ? [`Success metric: ${metric}`] : []),
    ...(shape ? [`Approach: ${shape.title} (${shape.kind})`] : []),
    ...(constraints.length ? [`Constraints: ${constraints.join('; ')}`] : ['Constraints: (none added yet — what should we restrict?)']),
    ...(idea.summary?.pilotSuccess ? [`Pilot bar: ${idea.summary.pilotSuccess}`] : []),
    ...(idea.summary?.killCriterion ? [`Stop if: ${idea.summary.killCriterion}`] : []),
    '',
    'Three quick questions:',
    '1. What constraint (PII, auth, compliance, approval) is missing or wrong?',
    '2. Which assumption or scope boundary looks risky?',
    '3. Would you approve this pilot as framed, or what needs to change?',
  ].join('\n');
}
