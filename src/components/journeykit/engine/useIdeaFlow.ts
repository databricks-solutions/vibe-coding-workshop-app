import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/client';
import { useIdeas } from './useIdeas';
import { buildContext, caseFigures, chosenShape, nextStep, placedLeaf, stepIndex, stepMeta } from './ideaContext';
import { money, skippedImpact } from './businessCase';
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
  return patch;
}

export function useIdeaFlow(ideaId: string) {
  const { ideas, updateIdea } = useIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  const ideaRef = useRef(idea);
  ideaRef.current = idea;

  const [viewStep, setViewStep] = useState<StepKey>(idea?.step ?? 'spark');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [briefDraft, setBriefDraft] = useState('');
  const [pushbacks, setPushbacks] = useState<string[] | null>(null);
  const briefCtrl = useRef<AbortController | null>(null);

  useEffect(() => () => briefCtrl.current?.abort(), []);
  useEffect(() => setPushbacks(null), [viewStep]);

  const patch = useCallback((p: Partial<Idea> | ((i: Idea) => Partial<Idea>)) => updateIdea(ideaId, p), [ideaId, updateIdea]);

  const logDecision = useCallback((text: string) => {
    patch(i => ({ decisions: [...i.decisions, { at: stamp(), text }] }));
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

  const call = useCallback(async <T,>(op: string, step: string, ctx: Record<string, unknown>, feedback?: string): Promise<T | null> => {
    setLoading(op);
    setError(null);
    try {
      const r = await apiClient.ideateStepWithModel<T>(step, ctx, feedback);
      setAiUnavailable(false);
      lastFallback.current = r.fallback ? r.model : null;
      setFallbackModel(lastFallback.current);
      return r.data;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === undefined || UNAVAILABLE.has(status)) setAiUnavailable(true);
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(null);
    }
  }, []);

  const streamBrief = useCallback((feedback?: string) => {
    const current = ideaRef.current;
    if (!current) return;
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
  }, [patch]);

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
    if (!current) return;
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
      patch({ map: { branches: r.branches, placedLeafId: r.placedLeafId, adjacentLeafIds: r.adjacentLeafIds, rationale: r.rationale } });
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
  }, [call, logDecision, mergeAssumptions, mergeQuestions, patch, streamBrief]);

  // A use case's map is drafted in the background so it is ready by the time the user confirms step 1.
  const prefetched = useRef(false);
  useEffect(() => {
    if (!idea || prefetched.current || !idea.prefilled?.includes('map') || idea.map || !idea.spark) return;
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
  }, [idea, mergeAssumptions, patch]);

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
    let current = ideaRef.current;
    if (!current) return;
    if (step === 'impact' && current.impact && !current.impact.skipped) {
      const answers = { ...current.impact.answers };
      for (const q of current.impact.questions) answers[q.key] ??= { ...q.estimate, source: 'assumed' };
      current = { ...current, impact: { ...current.impact, answers } };
      patch({ impact: current.impact, summary: undefined });
    }
    const figures = caseFigures(current);
    const n = current.genieQuestions?.length ?? 0;
    const label: Record<StepKey, string> = {
      spark: `Confirmed intent: "${current.spark?.statement ?? ''}"`,
      map: `Placed on industry map: ${placedLeaf(current)?.name ?? 'unplaced'}`,
      clarify: 'Answered clarifying questions',
      shape: `Chose approach: ${chosenShape(current)?.title ?? ''}`,
      questions: `Chose ${n} question${n === 1 ? '' : 's'} for Genie`,
      impact: figures ? `Sized business impact: about ${money(figures.value.expected)} a year` : 'Skipped business impact',
      brief: current.mode === 'insights' ? 'Locked the idea for building' : 'Approved the brief',
    };
    markApproved(step, label[step]);
    if (step === 'brief' && (current.mode === 'insights' || current.buildTarget === 'insights')) patch({ lockedAt: stamp() });
  }, [markApproved, patch]);

  const answerImpact = useCallback((key: string, answer: ImpactAnswer) => {
    patch(i => (i.impact ? { impact: { ...i.impact, answers: { ...i.impact.answers, [key]: answer } }, summary: undefined } : {}));
  }, [patch]);

  const skipImpact = useCallback(() => {
    patch({ impact: skippedImpact(), summary: undefined });
    markApproved('impact', 'Skipped business impact');
  }, [markApproved, patch]);

  /** Turn a secondary lever on or off without re-asking anything. */
  const toggleLever = useCallback((driver: ImpactDriver) => {
    patch(i => {
      if (!i.impact) return {};
      const off = i.impact.secondaryOff ?? [];
      return { impact: { ...i.impact, secondaryOff: off.includes(driver) ? off.filter(d => d !== driver) : [...off, driver] }, summary: undefined };
    });
  }, [patch]);

  /** Re-size the numbers from the latest answers, keeping the brief. */
  const refreshImpact = useCallback(async () => {
    const current = ideaRef.current;
    if (!current) return;
    const r = await call<Omit<Impact, 'answers'>>('impact', 'impact', buildContext({ ...current, impact: undefined }));
    if (!r) return;
    patch(i => ({ impact: { ...r, answers: {}, fallbackModel: lastFallback.current ?? undefined }, summary: undefined, approved: i.approved.filter(s => s !== 'impact') }));
    logDecision('Refreshed the business impact numbers');
    setViewStep('impact');
  }, [call, logDecision, patch]);

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
    patch(i => ({ answers: { ...i.answers, [questionId]: value } }));
    const current = ideaRef.current;
    if (!current?.questions) return;
    const answers = { ...current.answers, [questionId]: value };
    const allDone = current.questions.every(q => answers[q.id]);
    if (allDone && !current.followupChecked) {
      patch({ followupChecked: true });
      const r = await call<{ followup: ClarifyQuestion | null }>('followup', 'followup', buildContext({ ...current, answers }, 'clarify'));
      if (r?.followup) patch(i => ({ questions: [...(i.questions ?? []), r.followup!] }));
    }
  }, [call, patch]);

  const setGenieQuestions = useCallback((list: string[]) => {
    patch(i => ({
      genieQuestions: list,
      genieQuestionSources: Object.fromEntries(list.map(q => [q, i.genieQuestionSources?.[q] ?? (i.genieAlternates?.includes(q) ? 'ai' : 'you')])),
    }));
  }, [patch]);

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
    patch,
    run,
    approve,
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
