import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useIdeas } from './useIdeas';
import { buildContext, chosenShape, placedLeaf, stepIndex } from '../components/ideate/ideaContext';
import {
  STEPS,
  type Assumption,
  type ClarifyQuestion,
  type GapResult,
  type Idea,
  type IdeaStatus,
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
  };
  if (after('spark')) patch.spark = undefined;
  if (after('map')) patch.map = undefined;
  if (after('clarify')) Object.assign(patch, { questions: undefined, answers: {}, followupChecked: false });
  if (after('shape')) Object.assign(patch, { shapes: undefined, chosenShapeId: undefined });
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
      patch({ spark: { title: r.title, statement: r.statement, industry: r.industry }, title: r.title || current.title });
      mergeAssumptions('spark', r.assumptions);
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
    }
  }, [call, logDecision, mergeAssumptions, patch, streamBrief]);

  const approve = useCallback((step: StepKey) => {
    const current = ideaRef.current;
    if (!current) return;
    const nextIdx = Math.min(stepIndex(step) + 1, STEPS.length - 1);
    const next = STEPS[nextIdx].key;
    const label: Record<StepKey, string> = {
      spark: `Confirmed intent: "${current.spark?.statement ?? ''}"`,
      map: `Placed on industry map: ${placedLeaf(current)?.name ?? 'unplaced'}`,
      clarify: 'Answered clarifying questions',
      shape: `Chose shape: ${chosenShape(current)?.title ?? ''}`,
      brief: 'Approved the brief',
    };
    patch(i => ({
      approved: i.approved.includes(step) ? i.approved : [...i.approved, step],
      step: stepIndex(next) > stepIndex(i.step) ? next : i.step,
    }));
    logDecision(label[step]);
    if (step !== 'brief') setViewStep(next);
  }, [logDecision, patch]);

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
      approved: i.approved.filter(s => s !== 'shape' && s !== 'brief'),
      brief: undefined,
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
  };
}

export type IdeaFlow = ReturnType<typeof useIdeaFlow>;
