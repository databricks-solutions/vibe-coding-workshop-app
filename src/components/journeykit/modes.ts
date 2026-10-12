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
    approveLabel: (step, prefilled) => (prefilled ? 'Looks right' : step === 'brief' ? 'Approve brief' : 'Looks good'),
    briefOutcomes: true,
    caseSource: 'Ideate',
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
  },
};

export const modeOf = (idea: { mode?: JourneyMode }): ModeConfig => MODE_CONFIG[idea.mode ?? 'ideate'];

export const ideaMinutes = (mode: JourneyMode, skip: StepKey[] = []) =>
  MODE_CONFIG[mode].steps.filter(s => !s.optional && !skip.includes(s.key)).reduce((n, s) => n + s.minutes, 0);
