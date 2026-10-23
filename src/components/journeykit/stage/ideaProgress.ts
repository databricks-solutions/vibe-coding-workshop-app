import { Database, Hammer, Rocket } from 'lucide-react';
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

/** Generic build stages that follow Base Camp ("Your brief") once ideation is complete. */
export const BUILD_CLIMB_STEPS: { key: string; label: string; icon: typeof Database; detail: string; minutes: number }[] = [
  {
    key: 'build_data',
    label: 'Analyze your data',
    icon: Database,
    detail: 'Connect, explore, and understand your data. Surface insights that inform your solution and set you up for a strong build.',
    minutes: 5,
  },
  {
    key: 'build_solution',
    label: 'Build',
    icon: Hammer,
    detail: 'Create your governed metrics, Genie space, dashboard, and app or agent chapters.',
    minutes: 25,
  },
  {
    key: 'build_deploy',
    label: 'Deploy',
    icon: Rocket,
    detail: 'Test against your benchmark questions, verify end-to-end, and publish the live solution for your team.',
    minutes: 10,
  },
];

/**
 * Full 10-stop route shown after ideation completes (Base Camp reached):
 * Steps 1-7 are the ideation climb to Base Camp ("Your brief", marked current so "You are here" and the
 * solid green line stop at Base Camp), followed by the 3 upcoming build stages climbing to the summit.
 */
export function ideaLockedClimbSteps(idea: Idea): ProgressStep[] {
  const inStudio = idea.buildStage === 'studio';
  const ideaSteps = ideaProgressSteps(idea, inStudio ? null : 'brief').map(s =>
    s.key === 'brief' && !inStudio
      ? { ...s, state: 'current' as const }
      : s,
  );
  const buildSteps: ProgressStep[] = BUILD_CLIMB_STEPS.map((b, i) => ({
    key: b.key,
    label: b.label,
    icon: b.icon,
    state: inStudio && i === 0 ? 'done' : inStudio && i === 1 ? 'current' : 'upcoming',
    disabled: true,
    detail: b.detail,
    minutes: b.minutes,
  }));
  return [...ideaSteps, ...buildSteps];
}

/** How this idea's trail ends: during ideation, a blurred next peak hints at the build; once locked, the build climb unfolds. */
export function ideaTrail(idea: Idea): { briefMarker: 'summit' | 'camp'; beyond?: TrailBeyond; teaserPeak?: { label: string; sublabel: string } } {
  const t = modeOf(idea).trail;
  if (!idea.lockedAt) {
    return {
      briefMarker: 'summit',
      teaserPeak: t.beyond ? { label: `Next climb: ${t.beyond.hint}`, sublabel: 'Unlocks after your brief' } : undefined,
    };
  }
  const state = idea.buildStage === 'studio' ? 'done' : 'upcoming';
  return {
    briefMarker: 'camp',
    beyond: t.beyond ? { label: t.beyond.label, state, detail: `${t.beyond.hint}.` } : undefined,
  };
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
