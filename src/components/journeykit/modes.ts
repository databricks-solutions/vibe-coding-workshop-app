import { BarChart3, BellRing, Bot, LayoutDashboard, MessagesSquare, UserRoundCog } from 'lucide-react';
import { STEP_ART } from './art';
import { stepsFor, type JourneyMode, type ShapeKind, type StepKey, type StepMeta } from './engine/types';

export interface ShapeKindMeta {
  label: string;
  icon: typeof Bot;
  tint: string;
}

export const SHAPE_KINDS: Record<ShapeKind, ShapeKindMeta> = {
  copilot: { label: 'Copilot', icon: UserRoundCog, tint: 'text-sky-400 bg-sky-500/10' },
  automation: { label: 'Automation', icon: Bot, tint: 'text-violet-400 bg-violet-500/10' },
  insight: { label: 'Insight', icon: BarChart3, tint: 'text-emerald-400 bg-emerald-500/10' },
  ask: { label: 'Ask Genie anything', icon: MessagesSquare, tint: 'text-sky-400 bg-sky-500/10' },
  monitor: { label: 'KPI scorecard', icon: LayoutDashboard, tint: 'text-emerald-400 bg-emerald-500/10' },
  signal: { label: 'Proactive signals', icon: BellRing, tint: 'text-amber-400 bg-amber-500/10' },
};

export interface ModeConfig {
  mode: JourneyMode;
  steps: StepMeta[];
  /** Eyebrow shown above every step title. */
  phaseLabel: string;
  thinking: Record<StepKey, string>;
  promise: Record<StepKey, string>;
  approveLabel: (step: StepKey, prefilled: boolean) => string;
  /** Show Commit / Park / Pivot / Submit under the brief. */
  briefOutcomes: boolean;
  /** Where the business case says it was shaped. */
  caseSource: string;
  trail: TrailConfig;
}

/** How the journey reads as a climb. Ideate tops out at the brief; Insights camps there and summits at the Genie build. */
export interface TrailConfig {
  /** What the brief waypoint is on this trail. */
  briefMarker: 'summit' | 'camp';
  /** A further peak after the brief, drawn faintly until the build starts. */
  beyond?: { label: string; hint: string };
  /** Copy for the trailhead: what the summit is. */
  summitLine: string;
  /** Title of the milestone when the brief is approved. */
  briefMilestone: string;
  /** Close button on that milestone. */
  briefMilestoneClose: string;
}

const THINKING: Record<StepKey, string> = {
  spark: 'Making sense of your idea',
  map: 'Mapping your industry',
  clarify: 'Thinking of the right questions',
  shape: 'Sketching three different approaches',
  questions: 'Drafting questions people will ask',
  impact: 'Working out what it could be worth',
  brief: 'Writing your brief',
};

const PROMISE = Object.fromEntries(Object.entries(STEP_ART).map(([k, v]) => [k, v.promise])) as Record<StepKey, string>;

export const MODE_CONFIG: Record<JourneyMode, ModeConfig> = {
  ideate: {
    mode: 'ideate',
    steps: stepsFor('ideate'),
    phaseLabel: 'Shape your idea',
    thinking: THINKING,
    promise: PROMISE,
    approveLabel: (step, prefilled) => (prefilled ? 'Looks right' : step === 'brief' ? 'Approve brief' : step === 'questions' ? 'Use these questions' : 'Looks good'),
    briefOutcomes: true,
    caseSource: 'Ideate',
    trail: {
      briefMarker: 'summit',
      summitLine: 'Your brief is the summit.',
      briefMilestone: 'Summit reached',
      briefMilestoneClose: 'See what to do next',
    },
  },
  insights: {
    mode: 'insights',
    steps: stepsFor('insights'),
    phaseLabel: 'Shape your idea',
    thinking: { ...THINKING, shape: 'Sketching three ways people could get answers', brief: 'Writing the brief your Genie is built from' },
    promise: {
      ...PROMISE,
      shape: 'Each one is a Genie and a dashboard, used a different way',
      brief: 'Check it, then lock it in and pick your data',
    },
    approveLabel: (step, prefilled) => (prefilled ? 'Looks right' : step === 'brief' ? 'Lock it in' : step === 'questions' ? 'Use these questions' : 'Looks good'),
    briefOutcomes: false,
    caseSource: 'Insights',
    trail: {
      briefMarker: 'camp',
      beyond: { label: 'Genie build', hint: 'Pick data, then set up your Genie space' },
      summitLine: 'Your brief is base camp. Your Genie is the summit.',
      briefMilestone: 'Base camp reached',
      briefMilestoneClose: 'Continue to the build',
    },
  },
};

export const modeOf = (idea: { mode?: JourneyMode }): ModeConfig => MODE_CONFIG[idea.mode ?? 'ideate'];

export const ideaMinutes = (mode: JourneyMode, skip: StepKey[] = []) =>
  MODE_CONFIG[mode].steps.filter(s => !s.optional && !skip.includes(s.key)).reduce((n, s) => n + s.minutes, 0);
