import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/client';
import { useIdeas } from './useIdeas';
import { alsoLeaves, buildContext, caseFigures, chosenShape, nextStep, placedLeaf, stepIndex, stepMeta } from './ideaContext';
import { money, skippedImpact } from './businessCase';
import { sampleById } from '../samples';
import type {
  Assumption,
  CaseSummary,
  ClarifyQuestion,
  GapResult,
  Idea,
  IdeaStatus,
  Impact,
  ImpactAnswer,
  ImpactDriver,
  IndustryMap,
  QuestionSource,
  ShapeOption,
  SparkResult,
  StepKey,
} from './types';

type WithAssumptions<T> = T & { assumptions?: string[] };

export const MAX_GENIE_QUESTIONS = 6;

const stamp = () => new Date().toISOString();

/** Status codes that mean the AI helper is not there at all, rather than a one-off failure. */
const UNAVAILABLE = new Set([404, 503]);

function reopenReview(idea: Idea, revision: number) {
  const review = idea.review;
  if (!review || review.status === 'draft') return review;
  const at = stamp();
  return {
    ...review,
    status: 'draft' as const,
    revision,
    history: [...review.history, { action: 'reopened' as const, at, revision, note: 'Idea changed after review' }],
  };
}

/** Clears everything produced at or after `step`, so downstream steps rebuild from fresh context. */
function resetFrom(idea: Idea, step: StepKey): Partial<Idea> {
  const i = stepIndex(step, idea.mode);
  const after = (s: StepKey) => stepIndex(s, idea.mode) >= i;
  const patch: Partial<Idea> = {
    step,
    approved: idea.approved.filter(s => !after(s)),
    assumptions: idea.assumptions.filter(a => !after(a.step)),
    gaps: undefined,
    summary: undefined,
  };
  if (after('spark')) patch.spark = undefined;
  if (after('map')) patch.map = undefined;
  if (after('clarify')) Object.assign(patch, { questions: undefined, answers: {}, followupChecked: false });
  if (after('shape')) Object.assign(patch, { shapes: undefined, chosenShapeId: undefined });
  if (after('questions') && idea.genieQuestions) {
    // Questions from the approved use case are the user's starting point, so they survive a reset.
    const kept = idea.genieQuestions.filter(q => idea.genieQuestionSources?.[q] === 'use_case');
    Object.assign(patch, { genieQuestions: kept.length ? kept : undefined, genieQuestionSources: Object.fromEntries(kept.map(q => [q, 'use_case'])) });
  }
  if (after('impact')) patch.impact = undefined;
  if (after('brief')) Object.assign(patch, { brief: undefined, lockedAt: undefined });
  if (idea.approved.some(after)) {
    const revision = (idea.revision ?? 0) + 1;
    Object.assign(patch, { revision, revisingFrom: step, review: reopenReview(idea, revision) });
  }
  return patch;
}

/**
 * Changing an approved answer reopens that step and everything after it, but keeps
 * their content so the user re-confirms rather than starts over. The brief is
 * redrafted from the new answers; any build keeps running until it is updated.
 */
function reopenFrom(idea: Idea, step: StepKey): Partial<Idea> {
  const i = stepIndex(step, idea.mode);
  const revision = (idea.revision ?? 0) + 1;
  return {
    approved: idea.approved.filter(s => stepIndex(s, idea.mode) < i),
    brief: step === 'brief' ? idea.brief : undefined,
    gaps: undefined,
    summary: undefined,
    lockedAt: undefined,
    revision,
    revisingFrom: step,
    review: reopenReview(idea, revision),
  };
}

export function useIdeaFlow(ideaId: string) {
  const { ideas, updateIdea } = useIdeas();
  const sample = sampleById(ideaId);
  const idea = sample ?? ideas.find(i => i.id === ideaId);
  const readOnly = !!sample;
  const ideaRef = useRef(idea);
  ideaRef.current = idea;

  // A sample is a walkthrough, so it opens at the start rather than where it ended.
  const [viewStep, setViewStep] = useState<StepKey>(readOnly ? 'spark' : idea?.step ?? 'spark');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [briefDraft, setBriefDraft] = useState('');
  const [pushbacks, setPushbacks] = useState<string[] | null>(null);
  const briefCtrl = useRef<AbortController | null>(null);

  useEffect(() => () => briefCtrl.current?.abort(), []);
  useEffect(() => setPushbacks(null), [viewStep]);

  const patch = useCallback((p: Partial<Idea> | ((i: Idea) => Partial<Idea>)) => {
    if (!readOnly) updateIdea(ideaId, p);
  }, [ideaId, readOnly, updateIdea]);

  const logDecision = useCallback((text: string) => {
    patch(i => ({ decisions: [...i.decisions, { at: stamp(), text }] }));
  }, [patch]);

  /** Edits a step's answer; if that step was approved, reopens it and the steps after it. */
  const revise = useCallback((step: StepKey, p: Partial<Idea> | ((i: Idea) => Partial<Idea>), note?: string) => {
    patch(i => {
      const changes = typeof p === 'function' ? p(i) : p;
      if (!i.approved.includes(step)) return changes;
      const text = note ?? `Changed ${stepMeta(i, step).label}`;
      return { ...changes, ...reopenFrom(i, step), decisions: [...i.decisions, { at: stamp(), text }] };
    });
  }, [patch]);

  const mergeAssumptions = useCallback((step: StepKey, texts: string[] = []) => {
    patch(i => {
      const kept = i.assumptions.filter(a => a.step !== step || a.status !== 'open');
      const fresh: Assumption[] = texts
        .filter(t => !kept.some(k => k.text === t))
        .map((text, n) => ({ id: `${step}-${Date.now()}-${n}`, text, step, status: 'open' }));
      return { assumptions: [...kept, ...fresh] };
    });
  }, [patch]);

  const [fallbackModel, setFallbackModel] = useState<string | null>(null);
  const lastFallback = useRef<string | null>(null);
  // Only the newest request per AI step may write its answer; older ones are cancelled.
  const inflight = useRef<Record<string, { seq: number; ctrl: AbortController }>>({});
  useEffect(() => () => Object.values(inflight.current).forEach(r => r.ctrl.abort()), []);

  const call = useCallback(async <T,>(op: string, step: string, ctx: Record<string, unknown>, feedback?: string): Promise<T | null> => {
    if (readOnly) return null;
    const prev = inflight.current[step];
    prev?.ctrl.abort();
    const mine = { seq: (prev?.seq ?? 0) + 1, ctrl: new AbortController() };
    inflight.current[step] = mine;
    const current = () => inflight.current[step] === mine;
    setLoading(op);
    setError(null);
    try {
      const r = await apiClient.ideateStepWithModel<T>(step, ctx, feedback, mine.ctrl.signal);
      if (!current()) return null;
      setAiUnavailable(false);
      lastFallback.current = r.fallback ? r.model : null;
      setFallbackModel(lastFallback.current);
      return r.data;
    } catch (e) {
      if (!current() || (e as Error).name === 'AbortError') return null;
      const status = (e as { status?: number }).status;
      if (status === undefined || UNAVAILABLE.has(status)) setAiUnavailable(true);
      setError((e as Error).message);
      return null;
    } finally {
      if (current()) setLoading(null);
    }
  }, [readOnly]);

  const streamBrief = useCallback((feedback?: string) => {
    const current = ideaRef.current;
    if (!current || readOnly) return;
    briefCtrl.current?.abort();
    setError(null);
    setLoading('brief');
    setBriefDraft('');
    let text = '';
    const priorBrief = feedback ? current.brief : undefined;
    briefCtrl.current = apiClient.ideateBriefStream(
      { idea: buildContext(current), feedback, current_brief: priorBrief },
      chunk => { text += chunk; setBriefDraft(text); },
      () => { setLoading(null); if (text) patch({ brief: text, gaps: undefined }); },
      err => { setLoading(null); setError(err); if (text) patch({ brief: text }); },
    );
  }, [patch, readOnly]);

  const mergeQuestions = useCallback((incoming: string[], source: QuestionSource) => {
    patch(i => {
      const list = [...(i.genieQuestions ?? [])];
      const sources = { ...(i.genieQuestionSources ?? {}) };
      for (const q of incoming) {
        const t = q.trim();
        if (!t || list.includes(t) || list.length >= MAX_GENIE_QUESTIONS) continue;
        list.push(t);
        sources[t] = source;
      }
      return { genieQuestions: list, genieQuestionSources: sources };
    });
  }, [patch]);

  /** Generate (or regenerate with feedback) the output for a step. */
  const run = useCallback(async (step: StepKey, feedback?: string) => {
    const current = ideaRef.current;
    if (!current || readOnly) return;
    if (feedback !== undefined) {
      patch(resetFrom(current, step));
      logDecision(`Asked for changes on ${stepMeta(current, step).label}: "${feedback}"`);
    }
    const base = { ...current, ...(feedback !== undefined ? resetFrom(current, step) : {}) } as Idea;
    const ctx = buildContext(base);

    if (step === 'brief') return streamBrief(feedback);

    if (step === 'spark') {
      const r = await call<WithAssumptions<SparkResult>>('spark', 'spark', ctx, feedback);
      if (!r) return;
      const { assumptions, ...spark } = r;
      patch({ spark, title: r.title || current.title });
      mergeAssumptions('spark', assumptions);
    } else if (step === 'map') {
      const r = await call<WithAssumptions<IndustryMap>>('map', 'map', ctx, feedback);
      if (!r) return;
      const ids = new Set(r.branches.flatMap(b => b.leaves.map(l => l.id)));
      const alsoLeafIds = (current.map?.alsoLeafIds ?? []).filter(id => ids.has(id) && id !== r.placedLeafId);
      patch({ map: { branches: r.branches, placedLeafId: r.placedLeafId, adjacentLeafIds: r.adjacentLeafIds, alsoLeafIds, rationale: r.rationale } });
      mergeAssumptions('map', r.assumptions);
    } else if (step === 'clarify') {
      const r = await call<{ questions: ClarifyQuestion[] }>('clarify', 'clarify', ctx, feedback);
      if (!r) return;
      patch({ questions: r.questions, answers: {}, followupChecked: false });
    } else if (step === 'shape') {
      const r = await call<WithAssumptions<{ options: ShapeOption[] }>>('shape', 'shape', ctx, feedback);
      if (!r) return;
      patch({ shapes: r.options, chosenShapeId: undefined });
      mergeAssumptions('shape', r.assumptions);
    } else if (step === 'questions') {
      const r = await call<{ questions: string[]; alternates?: string[] }>('questions', 'questions', { ...ctx, providedQuestions: base.genieQuestions ?? [] }, feedback);
      if (!r) return;
      mergeQuestions(r.questions, 'ai');
      patch({ genieAlternates: r.alternates ?? [] });
    } else if (step === 'impact') {
      const r = await call<Omit<Impact, 'answers'>>('impact', 'impact', ctx, feedback);
      if (!r || ideaRef.current?.impact?.skipped) return;
      patch({ impact: { ...r, answers: {}, fallbackModel: lastFallback.current ?? undefined }, summary: undefined });
    }
  }, [call, logDecision, mergeAssumptions, mergeQuestions, patch, readOnly, streamBrief]);

  // A use case's map is drafted in the background so it is ready by the time the user confirms step 1.
  const prefetched = useRef(false);
  useEffect(() => {
    if (!idea || readOnly || prefetched.current || !idea.prefilled?.includes('map') || idea.map || !idea.spark) return;
    prefetched.current = true;
    const current = idea;
    (async () => {
      try {
        const r = await apiClient.ideateStep<WithAssumptions<IndustryMap>>('map', buildContext(current, 'spark'));
        if (ideaRef.current?.map) return;
        patch({ map: { branches: r.branches, placedLeafId: r.placedLeafId, adjacentLeafIds: r.adjacentLeafIds, rationale: r.rationale } });
        mergeAssumptions('map', r.assumptions);
      } catch {
        // The Map step runs normally when the user reaches it.
      }
    })();
  }, [idea, mergeAssumptions, patch, readOnly]);

  const markApproved = useCallback((step: StepKey, note: string) => {
    const current = ideaRef.current;
    if (!current) return;
    const next = nextStep(current, step);
    patch(i => ({
      approved: i.approved.includes(step) ? i.approved : [...i.approved, step],
      prefilled: i.prefilled?.filter(s => s !== step),
      step: stepIndex(next, i.mode) > stepIndex(i.step, i.mode) ? next : i.step,
    }));
    logDecision(note);
    if (step !== 'brief') setViewStep(next);
  }, [logDecision, patch]);

  const approve = useCallback((step: StepKey) => {
    const current = ideaRef.current;
    if (!current) return;
    const figures = caseFigures(current);
    const n = current.genieQuestions?.length ?? 0;
    const label: Record<StepKey, string> = {
      spark: `Confirmed intent: "${current.spark?.statement ?? ''}"`,
      map: `Placed on industry map: ${placedLeaf(current)?.name ?? 'unplaced'}${alsoLeaves(current).length ? ` + ${alsoLeaves(current).length} more` : ''}`,
      clarify: 'Answered clarifying questions',
      shape: `Chose approach: ${chosenShape(current)?.title ?? ''}`,
      questions: `Chose ${n} question${n === 1 ? '' : 's'} for Genie`,
      impact: figures ? `Sized business impact: about ${money(figures.value.expected)} a year` : 'Skipped business impact',
      brief: current.mode === 'insights' ? 'Locked the idea for building' : 'Approved the brief',
    };
    markApproved(step, label[step]);
    if (step === 'brief') patch({ revisingFrom: undefined });
    if (step === 'brief' && (current.mode === 'insights' || current.buildTarget === 'insights')) patch({ lockedAt: stamp() });
  }, [markApproved, patch]);

  const answerImpact = useCallback((key: string, answer: ImpactAnswer) => {
    const current = ideaRef.current?.impact?.answers[key];
    if (current && JSON.stringify(current) === JSON.stringify(answer)) return;
    revise('impact', i => (i.impact ? { impact: { ...i.impact, answers: { ...i.impact.answers, [key]: answer } }, summary: undefined } : {}), 'Changed a business impact answer');
  }, [revise]);

  const skipImpact = useCallback(() => {
    patch({ impact: skippedImpact(), summary: undefined });
    markApproved('impact', 'Skipped business impact');
  }, [markApproved, patch]);

  /** Turn a secondary lever on or off without re-asking anything. */
  const toggleLever = useCallback((driver: ImpactDriver) => {
    revise('impact', i => {
      if (!i.impact) return {};
      const off = i.impact.secondaryOff ?? [];
      return { impact: { ...i.impact, secondaryOff: off.includes(driver) ? off.filter(d => d !== driver) : [...off, driver] }, summary: undefined };
    }, 'Changed which value levers count');
  }, [revise]);

  /** Re-size the numbers from the latest answers, keeping the brief. */
  const refreshImpact = useCallback(async () => {
    const current = ideaRef.current;
    if (!current) return;
    const r = await call<Omit<Impact, 'answers'>>('impact', 'impact', buildContext({ ...current, impact: undefined }));
    if (!r) return;
    revise('impact', i => ({ impact: { ...r, answers: {}, fallbackModel: lastFallback.current ?? undefined }, summary: undefined, approved: i.approved.filter(s => s !== 'impact') }), 'Refreshed the business impact numbers');
    setViewStep('impact');
  }, [call, revise]);

  /** Bring a skipped Impact step back; the flow regenerates its questions. Leaves the brief alone. */
  const addImpact = useCallback(() => {
    patch(i => ({ impact: undefined, summary: undefined, approved: i.approved.filter(s => s !== 'impact') }));
    logDecision('Added business impact numbers');
  }, [logDecision, patch]);

  const generateSummary = useCallback(async () => {
    const current = ideaRef.current;
    if (!current) return;
    const r = await call<CaseSummary>('summary', 'summary', buildContext(current, 'brief'));
    if (r) patch({ summary: r });
  }, [call, patch]);

  const answer = useCallback(async (questionId: string, value: string) => {
    if (ideaRef.current?.answers[questionId] === value) return;
    revise('clarify', i => ({ answers: { ...i.answers, [questionId]: value } }), 'Changed a clarifying answer');
    const current = ideaRef.current;
    if (!current?.questions) return;
    const answers = { ...current.answers, [questionId]: value };
    const allDone = current.questions.every(q => answers[q.id]);
    if (allDone && !current.followupChecked) {
      patch({ followupChecked: true });
      const r = await call<{ followup: ClarifyQuestion | null }>('followup', 'followup', buildContext({ ...current, answers }, 'clarify'));
      if (r?.followup) patch(i => ({ questions: [...(i.questions ?? []), r.followup!] }));
    }
  }, [call, patch, revise]);

  const setGenieQuestions = useCallback((list: string[]) => {
    revise('questions', i => ({
      genieQuestions: list,
      genieQuestionSources: Object.fromEntries(list.map(q => [q, i.genieQuestionSources?.[q] ?? (i.genieAlternates?.includes(q) ? 'ai' : 'you')])),
    }), 'Changed the questions for Genie');
  }, [revise]);

  const chooseShape = useCallback((id: string) => {
    const current = ideaRef.current;
    if (!current || current.chosenShapeId === id) return;
    const title = current.shapes?.find(s => s.id === id)?.title ?? 'another approach';
    revise('shape', { chosenShapeId: id }, `Switched approach to ${title}`);
  }, [revise]);

  const challenge = useCallback(async (step: StepKey) => {
    const current = ideaRef.current;
    if (!current) return;
    setPushbacks(null);
    const ctx = { ...buildContext(current, step), currentStep: stepMeta(current, step).label };
    const r = await call<{ pushbacks: string[] }>('challenge', 'challenge', ctx);
    if (r) setPushbacks(r.pushbacks);
  }, [call]);

  const findGaps = useCallback(async () => {
    const current = ideaRef.current;
    if (!current?.brief) return;
    const r = await call<{ dimensions: GapResult[] }>('gaps', 'gaps', buildContext(current, 'brief'));
    if (r) patch({ gaps: r.dimensions });
  }, [call, patch]);

  const setAssumption = useCallback((id: string, status: Assumption['status']) => {
    patch(i => ({ assumptions: i.assumptions.map(a => (a.id === id ? { ...a, status } : a)) }));
  }, [patch]);

  const setStatus = useCallback((status: IdeaStatus, note: string) => {
    patch({ status });
    logDecision(note);
  }, [logDecision, patch]);

  const pivot = useCallback(() => {
    patch(i => ({
      ...resetFrom(i, 'shape'),
      shapes: i.shapes,
      chosenShapeId: i.chosenShapeId,
      status: 'exploring',
    }));
    logDecision('Pivoted back to the approach');
    setViewStep('shape');
  }, [logDecision, patch]);

  return {
    idea,
    viewStep,
    setViewStep,
    loading,
    error,
    aiUnavailable,
    fallbackModel,
    clearError: () => setError(null),
    briefDraft,
    pushbacks,
    clearPushbacks: () => setPushbacks(null),
    readOnly,
    patch,
    revise,
    run,
    approve,
    chooseShape,
    answer,
    challenge,
    findGaps,
    setAssumption,
    setStatus,
    pivot,
    logDecision,
    answerImpact,
    skipImpact,
    addImpact,
    refreshImpact,
    toggleLever,
    generateSummary,
    setGenieQuestions,
    mergeQuestions,
  };
}

export type IdeaFlow = ReturnType<typeof useIdeaFlow>;
