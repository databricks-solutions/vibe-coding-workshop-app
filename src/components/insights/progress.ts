import { ClipboardList, Database, Lightbulb, Network } from 'lucide-react';
import { INSIGHTS_STEPS, STEP_ART, ideaProgressSteps, type Idea, type ProgressPhase, type StepKey, type StepState } from '../journeykit';

export type InsightsStage = 'start' | 'idea' | 'locked' | 'data' | 'blueprint' | 'source' | 'ready';

const D = 'done', C = 'current', U = 'upcoming';

/** Phase states per stage: [Idea, Data, Model, Plan]. */
const STATES: Record<InsightsStage, [StepState, StepState, StepState, StepState]> = {
  start: [C, U, U, U],
  idea: [C, U, U, U],
  locked: [D, U, U, U],
  data: [D, C, U, U],
  blueprint: [D, D, C, U],
  source: [D, D, C, U],
  ready: [D, D, D, C],
};

/** Idea · Data · (Model or Tables) · Plan, with the idea's seven steps expanded while shaping it. */
export function insightsPhases({ stage, idea, viewStep, blueprint, tables = false }: { stage: InsightsStage; idea?: Idea; viewStep?: StepKey | null; blueprint: boolean; tables?: boolean }): ProgressPhase[] {
  const [ideaState, dataState, modelState, planState] = STATES[stage];
  const preview = INSIGHTS_STEPS.map(s => ({ key: s.key, label: s.label, icon: STEP_ART[s.key].icon, state: U as StepState, optional: s.optional, disabled: true }));
  const steps = stage === 'idea' && idea ? ideaProgressSteps(idea, viewStep ?? null) : stage === 'start' ? preview : undefined;

  return [
    { key: 'idea', label: 'Idea', icon: Lightbulb, state: ideaState, steps },
    { key: 'data', label: 'Data', icon: Database, state: dataState },
    ...(blueprint || tables ? [{ key: 'model', label: blueprint ? 'Model' : 'Tables', icon: Network, state: modelState }] : []),
    { key: 'plan', label: 'Plan', icon: ClipboardList, state: planState },
  ];
}
