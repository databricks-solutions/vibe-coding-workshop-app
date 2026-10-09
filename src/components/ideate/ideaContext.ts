import { DIMENSIONS, NOT_SURE, STEPS, type Dimension, type Idea, type StepKey } from './types';

export const stepIndex = (s: StepKey) => STEPS.findIndex(x => x.key === s);

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
    rawIdea: idea.seed,
    industry: idea.spark?.industry || idea.industry || undefined,
  };
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
  if (ok('brief') && idea.brief) ctx.brief = idea.brief;
  const accepted = idea.assumptions.filter(a => a.status === 'accepted').map(a => a.text);
  const openQs = idea.assumptions.filter(a => a.status === 'question').map(a => a.text);
  if (accepted.length) ctx.acceptedAssumptions = accepted;
  if (openQs.length) ctx.openQuestions = openQs;
  return ctx;
}

/** 0..1 coverage per AI-DLC completeness dimension, derived from what exists so far. */
export function clarityByDimension(idea: Idea): Record<Dimension, number> {
  const real = (dim: string) => answeredPairs(idea).some(a => a.dimension === dim && a.answer !== NOT_SURE);
  const has = (s: StepKey) => idea.approved.includes(s);
  const brief = !!idea.brief;
  const scores: Record<Dimension, number> = {
    business: (has('spark') ? 0.34 : 0) + (real('business') ? 0.33 : 0) + (brief ? 0.33 : 0),
    user: (has('map') ? 0.34 : 0) + (real('user') ? 0.33 : 0) + (brief ? 0.33 : 0),
    functional: (has('spark') ? 0.25 : 0) + (has('shape') ? 0.5 : 0) + (brief ? 0.25 : 0),
    technical: (has('map') ? 0.5 : 0) + (has('shape') ? 0.25 : 0) + (brief ? 0.25 : 0),
    nfr: brief ? 0.5 : 0,
    quality: brief ? 0.6 : 0,
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
