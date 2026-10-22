import { ideaStepAvailable, ideaStepPoints } from '../../../constants/scoring';
import { STEP_ART } from '../art';
import { stepIndex, stepsOf } from '../engine/ideaContext';
import { stepsFor, type Idea, type JourneyMode, type StepKey } from '../engine/types';
import { MODE_CONFIG, modeOf } from '../modes';
import type { ProgressStep } from './JourneyProgress';
import type { TrailBeyond } from './SummitTrail';

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
    points: { earned: ideaStepPoints(idea, s.key), available: ideaStepAvailable(idea, s.key) },
    detail: s.detail,
    minutes: s.minutes,
  }));
}

/** How this idea's trail ends, from its mode: the brief is the summit, or base camp before the build. */
export function ideaTrail(idea: Idea): { briefMarker: 'summit' | 'camp'; beyond?: TrailBeyond } {
  const t = modeOf(idea).trail;
  if (!t.beyond) return { briefMarker: t.briefMarker };
  const state = idea.buildStage === 'studio' ? 'done' : idea.lockedAt ? 'current' : 'upcoming';
  return { briefMarker: t.briefMarker, beyond: { label: t.beyond.label, state, detail: `${t.beyond.hint}. This is where your Genie gets built.` } };
}

/** The trailhead intro shows once, before the first step, for someone working on their own idea. */
export const showsTrailhead = (idea: Idea, readOnly: boolean) =>
  !idea.trailSeenAt && idea.approved.length === 0 && !readOnly && !idea.sample;

/** Stops left to the top of this idea's trail, counting only required steps. */
export function stopsToSummit(idea: Idea): number {
  return stepsOf(idea).filter(s => !s.optional && !idea.approved.includes(s.key)).length;
}

/** A read-only trail from an idea's summary (the leaderboard has no full idea). */
export function trailFromSummary(s: { mode: JourneyMode; approved: string[]; step: string; locked?: boolean; built?: boolean }) {
  const steps: ProgressStep[] = stepsFor(s.mode).map(m => ({
    key: m.key,
    label: m.label,
    icon: STEP_ART[m.key].icon,
    state: s.approved.includes(m.key) ? 'done' : m.key === s.step ? 'current' : 'upcoming',
    optional: m.optional,
    disabled: true,
  }));
  const t = MODE_CONFIG[s.mode].trail;
  const beyond: TrailBeyond | undefined = t.beyond ? { label: t.beyond.label, state: s.built ? 'done' : s.locked ? 'current' : 'upcoming' } : undefined;
  return { steps, briefMarker: t.briefMarker, beyond };
}
