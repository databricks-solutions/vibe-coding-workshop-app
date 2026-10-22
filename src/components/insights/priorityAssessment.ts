import { alsoLeaves, caseFigures, chosenShape, placedLeaf, type Idea, type IdeaReviewStatus } from '../journeykit';
import type { BlueprintChoice } from './blueprint/types';
import type { DataSource } from './brief';
import type { AddOn } from './recipes';

export type PriorityBand = 'Low' | 'Medium' | 'High';
export type PriorityConfidence = 'Low' | 'Medium' | 'High';
export type PriorityQuadrant = 'Invest now' | 'Strategic bet' | 'Quick win' | 'Rework or park';

export interface PriorityFactor {
  label: string;
  weight: number;
  score: number | null;
  evidence?: string;
  action?: string;
}

export interface PriorityAssessment {
  ideaId: string;
  title: string;
  value: number;
  feasibility: number;
  valueRange: [number, number];
  feasibilityRange: [number, number];
  valueBand: PriorityBand;
  feasibilityBand: PriorityBand;
  confidence: PriorityConfidence;
  quadrant: PriorityQuadrant;
  provisional: boolean;
  valueEvidence: string[];
  feasibilityEvidence: string[];
  valueActions: string[];
  feasibilityActions: string[];
  valueFactors: PriorityFactor[];
  feasibilityFactors: PriorityFactor[];
  valueEvidenceWeight: number;
  feasibilityEvidenceWeight: number;
  status?: IdeaReviewStatus;
  industry?: string;
  owner?: string;
  annualValue?: number | null;
}

interface PriorityContext {
  dataSource?: DataSource | null;
  dataLocation?: string;
  blueprint?: BlueprintChoice | null;
  addOns?: AddOn[];
  status?: IdeaReviewStatus;
  industry?: string;
  owner?: string;
  annualValue?: number | null;
}

interface Term { label: string; weight: number; score?: number; evidence?: string; action?: string }

const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
const band = (n: number): PriorityBand => n >= 70 ? 'High' : n >= 40 ? 'Medium' : 'Low';

function weighted(terms: Term[]) {
  const known = terms.filter((t): t is Term & { score: number } => typeof t.score === 'number');
  const weight = known.reduce((n, t) => n + t.weight, 0);
  const score = weight ? known.reduce((n, t) => n + t.score * t.weight, 0) / weight : 50;
  const uncertainty = Math.round((100 - weight) * 0.28);
  return {
    score: clamp(score),
    range: [clamp(score - uncertainty), clamp(score + uncertainty)] as [number, number],
    weight,
    evidence: known.flatMap(t => t.evidence ? [t.evidence] : []),
    actions: terms.flatMap(t => t.action && typeof t.score !== 'number' || (t.action && (t.score ?? 100) < 65) ? [t.action!] : []),
    factors: terms.map(({ label, weight: factorWeight, score, evidence, action }) => ({
      label,
      weight: factorWeight,
      score: typeof score === 'number' ? clamp(score) : null,
      evidence,
      action,
    })),
  };
}

const dimension = (idea: Idea, key: 'value' | 'feasibility') =>
  idea.score?.breakdown?.find(d => d.key === key)?.score;

const effortScore = (effort?: string) => {
  const e = (effort ?? '').toLowerCase();
  if (e.startsWith('s') || e.includes('small') || e.includes('low')) return 88;
  if (e.startsWith('l') || e.includes('large') || e.includes('high')) return 38;
  return 65;
};

export function assessPriority(idea: Idea, context: PriorityContext = {}): PriorityAssessment {
  const figures = caseFigures(idea);
  const vp = idea.useCaseContext?.valueProfile ?? null;
  const vpMid = vp && typeof vp.typicalLow === 'number' && typeof vp.typicalHigh === 'number' && vp.typicalHigh > 0
    ? Math.round((vp.typicalLow + vp.typicalHigh) / 2)
    : null;
  const shape = chosenShape(idea);
  const people = new Set([...(placedLeaf(idea)?.personas ?? []), ...alsoLeaves(idea).flatMap(l => l.personas)]);
  const reviewerValue = dimension(idea, 'value');
  const reviewerFeasibility = dimension(idea, 'feasibility');

  const roi = figures?.scenarios.expected.ratio;
  const hardShare = figures && figures.value.expected > 0
    ? figures.hard / figures.value.expected
    : vp?.hardShare === 'mostly hard'
      ? 0.75
      : vp?.hardShare === 'mixed'
        ? 0.5
        : vp?.hardShare === 'mostly soft'
          ? 0.25
          : undefined;
  const profileValueScore = vpMid == null
    ? undefined
    : vpMid >= 2_000_000 ? 88 : vpMid >= 750_000 ? 76 : vpMid >= 250_000 ? 64 : 52;
  const valueTerms: Term[] = [
    {
      label: 'Return on investment',
      weight: 30,
      score: roi !== undefined
        ? (roi >= 5 ? 95 : roi >= 3 ? 82 : roi >= 1.5 ? 66 : roi >= 1 ? 48 : 25)
        : profileValueScore,
      evidence: roi !== undefined
        ? `Expected value is ${roi.toFixed(1)}× first-year cost.`
        : vpMid != null
          ? `Typical annual value is ~$${vpMid.toLocaleString()}/yr (${vp?.driverLabel || vp?.driver || 'value profile'}).`
          : undefined,
      action: roi === undefined && vpMid == null ? 'Complete the value inputs to estimate ROI and payback.' : roi !== undefined && roi < 1.5 ? 'Target a more valuable decision or reduce first-year cost.' : undefined,
    },
    {
      label: 'Hard-dollar impact',
      weight: 20,
      score: hardShare === undefined ? undefined : 35 + hardShare * 65,
      evidence: hardShare === undefined ? undefined : `${Math.round(hardShare * 100)}% of estimated value is hard-dollar impact.`,
      action: hardShare === undefined ? 'Identify a measurable hard-dollar outcome.' : hardShare < 0.4 ? 'Tie the outcome to avoided cost or incremental revenue where credible.' : undefined,
    },
    {
      label: 'Rollout scale',
      weight: 15,
      score: figures ? (figures.rollout ? 82 : 62) : (vp?.rolloutFull ? 74 : undefined),
      evidence: figures?.rollout
        ? `Rollout covers ${figures.rollout.units} ${figures.rollout.unit}.`
        : vp?.rolloutFull && vp?.rolloutUnit
          ? `Scales across ~${vp.rolloutFull} ${vp.rolloutUnit}.`
          : undefined,
      action: figures || vp?.rolloutFull ? undefined : 'Size the frequency and credible first rollout.',
    },
    {
      label: 'Cost of delay',
      weight: 15,
      score: figures ? (figures.costOfDelay > figures.ask.total ? 90 : 65) : (idea.brief && idea.brief.length > 200 ? 68 : undefined),
      evidence: figures
        ? `Waiting carries about $${Math.round(figures.costOfDelay).toLocaleString()} in delayed value.`
        : idea.brief && idea.brief.length > 200
          ? 'Initiative brief documents the business problem and decision scope.'
          : undefined,
      action: figures ? undefined : 'Estimate the cost of waiting or of one bad outcome.',
    },
    {
      label: 'People reached',
      weight: 10,
      score: people.size ? Math.min(95, 48 + people.size * 14) : undefined,
      evidence: people.size ? `${people.size} user role${people.size === 1 ? '' : 's'} benefit directly.` : undefined,
      action: people.size ? undefined : 'Name the people who make or act on the decision.',
    },
    {
      label: 'Quality review',
      weight: 10,
      score: reviewerValue,
      evidence: reviewerValue === undefined ? undefined : `Reviewer value evidence scored ${reviewerValue}/100.`,
      action: reviewerValue === undefined ? 'Get the idea quality score to validate the value story.' : undefined,
    },
  ];

  const bp = context.blueprint?.evidence;
  const coverage = bp && bp.totalQuestions ? bp.matchedQuestions / bp.totalQuestions : undefined;
  const needsCoverage = bp && bp.totalNeeds ? bp.coveredNeeds / bp.totalNeeds : undefined;
  const dataScore = context.dataSource === 'blueprint'
    ? bp ? (bp.fit === 'strong' ? 92 : bp.fit === 'partial' ? 68 : bp.fit === 'weak' ? 38 : 55) : undefined
    : context.dataSource === 'existing' ? (context.dataLocation?.trim() ? 88 : 58)
      : context.dataSource === 'upload' ? 62
        : context.dataSource === 'sample' ? 72
          : idea.catalogRef ? 70 : undefined;
  const roleComplexity = people.size ? clamp(100 - Math.max(0, people.size - 1) * 13) : undefined;
  const buildComplexity = shape
    ? clamp((effortScore(shape.effort) + (context.addOns?.includes('copilot') ? 40 : context.addOns?.includes('app_view') ? 58 : 90)) / 2)
    : (idea.brief && idea.brief.length > 250 ? 66 : undefined);
  const tableComplexity = bp
    ? bp.tableCount <= 10 ? 92 : bp.tableCount <= 25 ? 75 : bp.tableCount <= 50 ? 55 : 35
    : undefined;

  const feasibilityTerms: Term[] = [
    {
      label: 'Data readiness',
      weight: 25, score: dataScore,
      evidence: context.dataSource
        ? `Data path: ${context.dataSource}${context.dataLocation ? ` (${context.dataLocation})` : ''}.`
        : idea.catalogRef
          ? `Linked to catalog use case (${idea.catalogRef.industry}/${idea.catalogRef.useCase}).`
          : undefined,
      action: dataScore === undefined || dataScore < 65 ? 'Identify the actual catalog/schema or choose a proven industry model.' : undefined,
    },
    {
      label: 'Question coverage',
      weight: 20, score: coverage === undefined ? undefined : ((coverage * 0.65 + (needsCoverage ?? coverage) * 0.35) * 100),
      evidence: bp ? `${bp.matchedQuestions}/${bp.totalQuestions} questions and ${bp.coveredNeeds}/${bp.totalNeeds} needs are covered.` : undefined,
      action: bp?.gapCount ? `Resolve ${bp.gapCount} uncovered model need${bp.gapCount === 1 ? '' : 's'} or choose a closer model.` : coverage === undefined ? 'Confirm which KPIs answer the priority questions.' : undefined,
    },
    {
      label: 'Data complexity',
      weight: 15, score: tableComplexity,
      evidence: bp ? `${bp.tableCount} tables are needed by the selected areas.` : undefined,
      action: tableComplexity !== undefined && tableComplexity < 65 ? 'Reduce the first pilot to fewer sources, tables, or joins.' : undefined,
    },
    {
      label: 'Workflow alignment',
      weight: 15, score: roleComplexity,
      evidence: people.size ? `${people.size} roles need to align in the operating workflow.` : undefined,
      action: roleComplexity !== undefined && roleComplexity < 65 ? 'Start with one primary decision owner and one collaborating role.' : undefined,
    },
    {
      label: 'Build complexity',
      weight: 15, score: buildComplexity,
      evidence: shape
        ? `${shape.title} is a ${shape.effort || 'medium'}-effort ${shape.kind} build.`
        : buildComplexity !== undefined
          ? 'Structured one-pager brief ready for technical scoping.'
          : undefined,
      action: buildComplexity !== undefined && buildComplexity < 65 ? 'Stage delivery: prove Genie/dashboard first, then add App write-back or automation.' : undefined,
    },
    {
      label: 'Quality review',
      weight: 10, score: reviewerFeasibility,
      evidence: reviewerFeasibility === undefined ? undefined : `Reviewer feasibility evidence scored ${reviewerFeasibility}/100.`,
      action: reviewerFeasibility === undefined ? 'Score the brief to surface unresolved feasibility assumptions.' : undefined,
    },
  ];

  const v = weighted(valueTerms);
  const f = weighted(feasibilityTerms);
  const highValue = v.score >= 60;
  const highFeasibility = f.score >= 60;
  const quadrant: PriorityQuadrant = highValue
    ? (highFeasibility ? 'Invest now' : 'Strategic bet')
    : (highFeasibility ? 'Quick win' : 'Rework or park');
  const evidenceWeight = (v.weight + f.weight) / 2;
  const confidence: PriorityConfidence = evidenceWeight >= 80 ? 'High' : evidenceWeight >= 55 ? 'Medium' : 'Low';
  const annualValue = context.annualValue ?? figures?.value.expected ?? vpMid ?? null;

  return {
    ideaId: idea.id,
    title: idea.title,
    value: v.score,
    feasibility: f.score,
    valueRange: v.range,
    feasibilityRange: f.range,
    valueBand: band(v.score),
    feasibilityBand: band(f.score),
    confidence,
    quadrant,
    provisional: confidence !== 'High',
    valueEvidence: v.evidence.slice(0, 4),
    feasibilityEvidence: f.evidence.slice(0, 4),
    valueActions: [...new Set(v.actions)].slice(0, 3),
    feasibilityActions: [...new Set(f.actions)].slice(0, 3),
    valueFactors: v.factors,
    feasibilityFactors: f.factors,
    valueEvidenceWeight: v.weight,
    feasibilityEvidenceWeight: f.weight,
    status: context.status ?? idea.review?.status,
    industry: context.industry ?? idea.spark?.industry ?? idea.industry,
    owner: context.owner,
    annualValue,
  };
}

/**
 * Canonical portfolio coordinates use only evidence persisted on the idea.
 * Display-only metadata is allowed, but transient screen state (for example a
 * not-yet-saved blueprint selection) must not move an idea between maps.
 */
export function assessPortfolioPriority(
  idea: Idea,
  context: Pick<PriorityContext, 'status' | 'industry' | 'owner' | 'annualValue'> = {},
): PriorityAssessment {
  return assessPriority(idea, context);
}
