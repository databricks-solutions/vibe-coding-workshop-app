import { STEP_ART } from '../art';
import { stepIndex, stepsOf } from '../engine/ideaContext';
import type { Idea, StepKey } from '../engine/types';
import type { ProgressStep } from './JourneyProgress';

/** The idea's steps as progress markers: done once approved, reachable up to the furthest step. */
export function ideaProgressSteps(idea: Idea, viewStep: StepKey | null): ProgressStep[] {
  const furthest = stepIndex(idea.step, idea.mode);
  return stepsOf(idea).map((s, i) => ({
    key: s.key,
    label: s.label,
    icon: STEP_ART[s.key].icon,
    state: s.key === viewStep ? 'current' : idea.approved.includes(s.key) ? 'done' : 'upcoming',
    prefilled: idea.prefilled?.includes(s.key),
    optional: s.optional,
    disabled: i > furthest,
  }));
}
