import { computeCase, figuresAsContext, hasNumbers } from './businessCase';
import { DIMENSIONS, NOT_SURE, stepsFor, type Dimension, type Idea, type JourneyMode, type StepKey } from './types';

export const stepIndex = (s: StepKey, mode?: JourneyMode) => stepsFor(mode).findIndex(x => x.key === s);

export const stepsOf = (idea: Pick<Idea, 'mode'>) => stepsFor(idea.mode);

export const stepMeta = (idea: Pick<Idea, 'mode'>, s: StepKey) => stepsOf(idea).find(x => x.key === s) ?? stepsOf(idea)[0];

/** The step after `s` in this idea's journey (the last step maps to itself). */
export function nextStep(idea: Pick<Idea, 'mode'>, s: StepKey): StepKey {
  const steps = stepsOf(idea);
  return steps[Math.min(stepIndex(s, idea.mode) + 1, steps.length - 1)].key;
}

/** Answer given to the first Clarify question on `dimension`, ignoring "Not sure yet". */
export function answerFor(idea: Idea, dimension: string) {
  return answeredPairs(idea).find(a => a.dimension === dimension && a.answer !== NOT_SURE)?.answer;
}

/** Business case figures, or null when the Impact step was skipped or not done yet. */
export function caseFigures(idea: Idea) {
  return hasNumbers(idea.impact) ? computeCase(idea.impact, chosenShape(idea)) : null;
}

export function placedLeaf(idea: Idea) {
  const map = idea.map;
  if (!map) return null;
  for (const b of map.branches) {
    const leaf = b.leaves.find(l => l.id === map.placedLeafId);
    if (leaf) return { branch: b.name, ...leaf };
  }
  return null;
}

export function chosenShape(idea: Idea) {
  return idea.shapes?.find(s => s.id === idea.chosenShapeId) ?? null;
}

export function answeredPairs(idea: Idea) {
  return (idea.questions ?? [])
    .filter(q => idea.answers[q.id])
    .map(q => ({ dimension: q.dimension, question: q.question, answer: idea.answers[q.id] }));
}

/**
 * Context memory: only what the human has approved flows into the next step.
 * `includeDraftsFor` adds the unapproved output of a single step (used for the
 * follow-up sweep and for "Challenge me" on the step being viewed).
 */
export function buildContext(idea: Idea, includeDraftsFor?: StepKey): Record<string, unknown> {
  const ok = (s: StepKey) => idea.approved.includes(s) || s === includeDraftsFor;
  const leaf = placedLeaf(idea);
  const shape = chosenShape(idea);
  const ctx: Record<string, unknown> = {
    mode: idea.mode ?? 'ideate',
    rawIdea: idea.seed,
    industry: idea.spark?.industry || idea.industry || undefined,
  };
  if (idea.sourceUseCase) {
    ctx.approvedUseCase = { label: idea.sourceUseCase.label, industry: idea.sourceUseCase.industryLabel, ...idea.useCaseContext };
  }
  if (ok('spark') && idea.spark) ctx.confirmedIntent = idea.spark;
  if (ok('map') && leaf) {
    const adjacent = idea.map!.branches.flatMap(b => b.leaves).filter(l => idea.map!.adjacentLeafIds.includes(l.id)).map(l => l.name);
    ctx.industryPlacement = { branch: leaf.branch, capability: leaf.name, problem: leaf.problem, personas: leaf.personas, surfaces: leaf.surfaces, alsoTouches: adjacent };
  }
  if (ok('clarify')) ctx.answers = answeredPairs(idea);
  if (ok('shape') && shape) {
    ctx.chosenShape = shape;
    ctx.rejectedShapes = (idea.shapes ?? []).filter(s => s.id !== shape.id).map(s => s.title);
  }
  if (ok('questions') && idea.genieQuestions?.length) ctx.genieQuestions = idea.genieQuestions;
  else if (idea.genieQuestions?.length) ctx.providedQuestions = idea.genieQuestions;
  const figures = ok('impact') ? caseFigures(idea) : null;
  if (figures) ctx.businessImpact = { scope: idea.impact!.scope, ...figuresAsContext(figures) };
  if (ok('brief') && idea.brief) ctx.brief = idea.brief;
  const accepted = idea.assumptions.filter(a => a.status === 'accepted').map(a => a.text);
  const openQs = idea.assumptions.filter(a => a.status === 'question').map(a => a.text);
  if (accepted.length) ctx.acceptedAssumptions = accepted;
  if (openQs.length) ctx.openQuestions = openQs;
  return ctx;
}

const MATCHING_BRIEF_CHARS = 6000;

/** Plain-text description of the idea for matching it to data: what it is, who uses it, what it decides. */
export function matchingContext(idea: Idea | null | undefined): string {
  if (!idea) return '';
  const uc = idea.useCaseContext;
  const shape = chosenShape(idea);
  return [
    idea.title,
    idea.spark?.industry && `Industry: ${idea.spark.industry}`,
    idea.spark?.statement ?? idea.seed,
    idea.sourceUseCase && `Use case: ${idea.sourceUseCase.label}`,
    uc?.summary,
    uc?.personas?.length && `Personas: ${uc.personas.map(p => `${p.name} (${p.role})`).join(', ')}`,
    uc?.entities?.length && `Data it uses: ${uc.entities.join(', ')}`,
    ...answeredPairs(idea).filter(a => a.answer !== NOT_SURE).map(a => `${a.question} ${a.answer}`),
    shape && `Chosen approach: ${shape.title}. ${shape.value}`,
    idea.brief?.slice(0, MATCHING_BRIEF_CHARS),
  ].filter(Boolean).join('\n');
}

/** 0..1 coverage per AI-DLC completeness dimension, derived from what exists so far. */
export function clarityByDimension(idea: Idea): Record<Dimension, number> {
  const real = (dim: string) => answeredPairs(idea).some(a => a.dimension === dim && a.answer !== NOT_SURE);
  const has = (s: StepKey) => idea.approved.includes(s);
  const brief = !!idea.brief;
  const sized = has('impact') && hasNumbers(idea.impact);
  // Genie questions double as the benchmark set, so they count toward scope and testability.
  const asked = has('questions');
  const scores: Record<Dimension, number> = {
    business: (has('spark') ? 0.25 : 0) + (real('business') ? 0.25 : 0) + (sized ? 0.25 : 0) + (brief ? 0.25 : 0),
    user: (has('map') ? 0.34 : 0) + (real('user') ? 0.33 : 0) + (brief ? 0.33 : 0),
    functional: (has('spark') ? 0.25 : 0) + (has('shape') ? 0.5 : 0) + (asked ? 0.15 : 0) + (brief ? 0.25 : 0),
    technical: (has('map') ? 0.5 : 0) + (has('shape') ? 0.25 : 0) + (brief ? 0.25 : 0),
    nfr: brief ? 0.5 : 0,
    quality: (asked ? 0.3 : 0) + (brief ? 0.6 : 0),
  };
  for (const g of idea.gaps ?? []) {
    const k = g.key as Dimension;
    if (k in scores) scores[k] = g.covered ? 1 : Math.min(scores[k], 0.6);
  }
  for (const d of DIMENSIONS) scores[d.key] = Math.min(1, scores[d.key]);
  return scores;
}

export function overallClarity(idea: Idea) {
  const s = clarityByDimension(idea);
  const vals = Object.values(s);
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
}

export function briefAsMarkdown(idea: Idea) {
  const parts = [`# ${idea.title}`, '', idea.brief ?? ''];
  const accepted = idea.assumptions.filter(a => a.status === 'accepted');
  if (accepted.length) {
    parts.push('', '## Accepted Assumptions', ...accepted.map(a => `- ${a.text}`));
  }
  if (idea.decisions.length) {
    parts.push('', '## Decision Log', ...idea.decisions.map(d => `- ${new Date(d.at).toLocaleString()}: ${d.text}`));
  }
  return parts.join('\n');
}
