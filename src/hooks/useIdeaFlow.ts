import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useIdeas } from './useIdeas';
import { buildContext, caseFigures, chosenShape, placedLeaf, stepIndex } from '../components/ideate/ideaContext';
import { money, skippedImpact } from '../components/ideate/businessCase';
import {
  STEPS,
  type Assumption,
  type CaseSummary,
  type ClarifyQuestion,
  type GapResult,
  type Idea,
  type IdeaStatus,
  type Impact,
  type ImpactAnswer,
  type IndustryMap,
  type ShapeOption,
  type SparkResult,
  type StepKey,
} from '../components/ideate/types';

type WithAssumptions<T> = T & { assumptions?: string[] };

const stamp = () => new Date().toISOString();

/** Clears everything produced at or after `step`, so downstream steps rebuild from fresh context. */
function resetFrom(idea: Idea, step: StepKey): Partial<Idea> {
  const i = stepIndex(step);
  const after = (s: StepKey) => stepIndex(s) >= i;
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
  if (after('impact')) patch.impact = undefined;
  if (after('brief')) patch.brief = undefined;
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

  const call = useCallback(async <T,>(op: string, step: string, ctx: Record<string, unknown>, feedback?: string): Promise<T | null> => {
    setLoading(op);
    setError(null);
    try {
      return await apiClient.ideateStep<T>(step, ctx, feedback);
    } catch (e) {
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

  /** Generate (or regenerate with feedback) the output for a step. */
  const run = useCallback(async (step: StepKey, feedback?: string) => {
    const current = ideaRef.current;
    if (!current) return;
    if (feedback !== undefined) {
      patch(resetFrom(current, step));
      logDecision(`Asked for changes on ${STEPS[stepIndex(step)].label}: "${feedback}"`);
    }
    const ctx = buildContext({ ...current, ...(feedback !== undefined ? resetFrom(current, step) : {}) } as Idea);

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
    } else if (step === 'impact') {
      const r = await call<Omit<Impact, 'answers'>>('impact', 'impact', ctx, feedback);
      if (!r || ideaRef.current?.impact?.skipped) return;
      patch({ impact: { ...r, answers: {} }, summary: undefined });
    }
  }, [call, logDecision, mergeAssumptions, patch, streamBrief]);

  const markApproved = useCallback((step: StepKey, note: string) => {
    const next = STEPS[Math.min(stepIndex(step) + 1, STEPS.length - 1)].key;
    patch(i => ({
      approved: i.approved.includes(step) ? i.approved : [...i.approved, step],
      step: stepIndex(next) > stepIndex(i.step) ? next : i.step,
    }));
    logDecision(note);
    if (step !== 'brief') setViewStep(next);
  }, [logDecision, patch]);

  const approve = useCallback((step: StepKey) => {
    const current = ideaRef.current;
    if (!current) return;
    const figures = caseFigures(current);
    const label: Record<StepKey, string> = {
      spark: `Confirmed intent: "${current.spark?.statement ?? ''}"`,
      map: `Placed on industry map: ${placedLeaf(current)?.name ?? 'unplaced'}`,
      clarify: 'Answered clarifying questions',
      shape: `Chose shape: ${chosenShape(current)?.title ?? ''}`,
      impact: figures ? `Sized business impact: about ${money(figures.value.expected)} a year` : 'Skipped business impact',
      brief: 'Approved the brief',
    };
    markApproved(step, label[step]);
  }, [markApproved]);

  const answerImpact = useCallback((key: string, answer: ImpactAnswer) => {
    patch(i => (i.impact ? { impact: { ...i.impact, answers: { ...i.impact.answers, [key]: answer } }, summary: undefined } : {}));
  }, [patch]);

  const skipImpact = useCallback(() => {
    patch({ impact: skippedImpact(), summary: undefined });
    markApproved('impact', 'Skipped business impact');
  }, [markApproved, patch]);

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

  const challenge = useCallback(async (step: StepKey) => {
    const current = ideaRef.current;
    if (!current) return;
    setPushbacks(null);
    const ctx = { ...buildContext(current, step), currentStep: STEPS[stepIndex(step)].label };
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
      approved: i.approved.filter(s => s !== 'shape' && s !== 'impact' && s !== 'brief'),
      brief: undefined,
      impact: undefined,
      summary: undefined,
      gaps: undefined,
      step: 'shape',
      status: 'exploring',
    }));
    logDecision('Pivoted back to Shape');
    setViewStep('shape');
  }, [logDecision, patch]);

  return {
    idea,
    viewStep,
    setViewStep,
    loading,
    error,
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
    generateSummary,
  };
}

export type IdeaFlow = ReturnType<typeof useIdeaFlow>;
