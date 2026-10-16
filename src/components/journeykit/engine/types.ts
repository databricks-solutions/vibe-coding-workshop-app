export type IdeaStatus = 'exploring' | 'committed' | 'parked';

export type IdeaReviewStatus = 'draft' | 'pending' | 'changes_requested' | 'rejected' | 'approved';
export type IdeaReviewAction = 'submitted' | 'approved' | 'changes_requested' | 'rejected' | 'reopened';

export interface IdeaReviewEvent {
  action: IdeaReviewAction;
  at: string;
  by?: string | null;
  note?: string | null;
  revision: number;
}

/** Canonical approval state. Catalog publication flags are intentionally separate. */
export interface IdeaReview {
  status: IdeaReviewStatus;
  revision: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewer?: string | null;
  note?: string | null;
  approvedRevision?: number | null;
  history: IdeaReviewEvent[];
}

/** `ideate` shapes an idea into a brief; `insights` shapes it and then builds a Genie on it. */
export type JourneyMode = 'ideate' | 'insights';

export type StepKey = 'spark' | 'map' | 'clarify' | 'shape' | 'questions' | 'impact' | 'brief';

export interface StepMeta {
  key: StepKey;
  label: string;
  hint: string;
  optional?: boolean;
  /** Rough time on this step, used for path estimates. */
  minutes: number;
}

export const STEPS: StepMeta[] = [
  { key: 'spark', label: 'Your idea', hint: 'Did I get your idea right?', minutes: 1 },
  { key: 'map', label: 'Where it fits', hint: 'Where your idea sits in the industry', minutes: 1 },
  { key: 'clarify', label: 'A few questions', hint: 'A few quick questions', minutes: 2 },
  { key: 'shape', label: 'Pick an approach', hint: 'Three ways to bring it to life', minutes: 2 },
  { key: 'impact', label: "What it's worth", hint: 'What could it be worth?', optional: true, minutes: 2 },
  { key: 'brief', label: 'Your brief', hint: 'Your decision-ready one-pager', minutes: 2 },
];

export const INSIGHTS_STEPS: StepMeta[] = [
  STEPS[0],
  STEPS[1],
  STEPS[2],
  { key: 'shape', label: 'Pick an approach', hint: 'Three ways people could get their answers', minutes: 2 },
  { key: 'questions', label: 'Questions for Genie', hint: 'What should people be able to ask?', minutes: 2 },
  STEPS[4],
  { key: 'brief', label: 'Your brief', hint: 'Lock in what you are about to build', minutes: 2 },
];

export const stepsFor = (mode: JourneyMode = 'ideate'): StepMeta[] => (mode === 'insights' ? INSIGHTS_STEPS : STEPS);

export type Dimension = 'functional' | 'nfr' | 'user' | 'business' | 'technical' | 'quality';

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'business', label: 'Business goal & metric' },
  { key: 'user', label: 'Users & scenarios' },
  { key: 'functional', label: 'Core features' },
  { key: 'technical', label: 'Data & integrations' },
  { key: 'nfr', label: 'Security & performance' },
  { key: 'quality', label: 'Testability' },
];

export interface SparkResult {
  title: string;
  statement: string;
  /** The most specific segment, e.g. "Airlines" rather than "Aviation". */
  industry: string;
  /** Closest industry key in the use case catalog, e.g. "travel". */
  catalogIndustry?: string | null;
  catalogIndustryLabel?: string;
  /** Only present when the user's industry was ambiguous. */
  industryAlternatives?: string[];
  /** Which money line moves and why, in the industry's terms. */
  valueHypothesis?: string;
  businessLine?: 'cost' | 'revenue' | 'risk' | 'capacity' | null;
}

export interface IndustryLeaf {
  id: string;
  name: string;
  problem: string;
  /** Where the money is for this capability, e.g. "Delay costs, often millions a year per hub". */
  valuePool?: string;
  personas: string[];
  surfaces: string[];
}

export interface IndustryBranch {
  id: string;
  name: string;
  leaves: IndustryLeaf[];
}

export interface IndustryMap {
  branches: IndustryBranch[];
  placedLeafId: string | null;
  adjacentLeafIds: string[];
  /** Extra spots the idea also covers, picked by the user (max MAX_ALSO_LEAVES). */
  alsoLeafIds?: string[];
  rationale: string;
}

export const MAX_ALSO_LEAVES = 3;

export interface ClarifyQuestion {
  id: string;
  dimension: string;
  question: string;
  /** What the answer decides, e.g. "Sizes the business case". */
  why?: string;
  options: string[];
  /** Index of the option the AI would bet on, or -1 when it has no signal. */
  recommended?: number;
  /** Pick all that apply; the answer is the picks joined with "; ". */
  multi?: boolean;
  /** Maximum selections for a multi question; absent means every option may be picked. */
  maxPicks?: number;
  isFollowup?: boolean;
}

export type ShapeKind = 'copilot' | 'automation' | 'insight' | 'ask' | 'monitor' | 'signal';

export interface ShapeOption {
  id: string;
  kind: ShapeKind;
  title: string;
  value: string;
  valueLever?: ImpactDriver | null;
  /** Relative size at full rollout compared with the other options. */
  valueSize?: '$' | '$$' | '$$$' | null;
  timeToValue?: string;
  hardShare?: 'mostly hard' | 'mixed' | 'mostly soft' | null;
  effort: string;
  riskiestAssumption: string;
  cheapTest: string;
  surfaces: string[];
  /** Where people ask their questions: inside the app, or in a Genie space next to the dashboard. */
  geniePlacement?: GeniePlacement;
  /** Two or three questions people could ask Genie in this approach. */
  askExamples?: string[];
  /** Set only when Genie is deliberately left out, with the reason. */
  noGenieWhy?: string;
  recommended?: boolean;
  recommendedWhy?: string;
}

export type GeniePlacement = 'in_app' | 'genie_space';

export interface Assumption {
  id: string;
  text: string;
  step: StepKey;
  status: 'open' | 'accepted' | 'question';
}

export interface GapResult {
  key: string;
  covered: boolean;
  gap: string;
}

export interface Decision {
  at: string;
  text: string;
}

export type ImpactDriver = 'time_saved' | 'cost_avoided' | 'revenue_uplift';
export type ImpactSource = 'you said' | 'assumed';

export interface ImpactOption {
  label: string;
  value: number;
}

export interface ImpactQuestion {
  /** Input key for the driver formula, e.g. "baseline_minutes". */
  key: string;
  question: string;
  unit: string;
  options: ImpactOption[];
  /** Used when the user picks "Not sure, estimate for me". */
  estimate: ImpactOption;
  why: string;
}

export interface ImpactAnswer extends ImpactOption {
  source: ImpactSource;
}

export interface ImpactInput {
  key: string;
  label: string;
  value: number;
  unit: string;
  why: string;
  /** Taken from a Clarify answer rather than estimated. */
  fromAnswer?: boolean;
}

/** An extra value lever on a different driver, with every input assumed. */
export interface SecondaryLever {
  driver: ImpactDriver;
  label: string;
  inputs: ImpactInput[];
}

/** What the idea scales by: the per-pilot numbers are multiplied up to `full` units. */
export interface Rollout {
  unit: string;
  pilot: number;
  full: number;
  why: string;
}

export const ROLLOUT_KEY = 'rollout_units';

export type Refresh = 'daily' | 'hourly' | 'frequent' | 'streaming';

export interface CostProfile {
  dataGbPerDay: number;
  refresh: Refresh;
  transforms: 'light' | 'medium' | 'heavy';
  users: number;
  hoursPerDay: number;
}

export interface Impact {
  skipped?: boolean;
  driver: ImpactDriver;
  /** Plain name of where the value comes from, e.g. "Faster swap decisions per event". */
  driverLabel: string;
  /** Who and where the numbers are sized for, e.g. "Crew schedulers at one hub". */
  scope: string;
  questions: ImpactQuestion[];
  answers: Record<string, ImpactAnswer>;
  /** Inputs the formula needs that were not worth asking about. */
  assumed: ImpactInput[];
  secondary?: SecondaryLever[];
  /** Secondary drivers the user turned off. */
  secondaryOff?: ImpactDriver[];
  rollout?: Rollout | null;
  /** Share of freed time that turns into value. Missing on ideas sized before soft dollars were discounted. */
  captureRate?: number | null;
  captureWhy?: string;
  cost: CostProfile;
  /** The model that answered was not the configured one. */
  fallbackModel?: string;
}

export interface CaseSummary {
  subtitle: string;
  problemToday: string;
  whoItsFor: string;
  metric: { label: string; today: string; target: string };
  whatWeBuild: string;
  workflowSteps: string[];
  stack: { data: string; shape: string; serve: string; use: string };
  risks: { risk: string; guard: string }[];
  nextSteps: string[];
  decision: string;
  valueStory?: string;
  costOfInaction?: string;
  pilotSuccess?: string;
  killCriterion?: string;
  sponsor?: string;
  unlocksNext?: string[];
}

export interface CatalogRef {
  industry: string;
  industryLabel: string;
  useCase: string;
  useCaseLabel: string;
  version: number;
  submittedAt: string;
}

/** An approved catalog use case an idea started from. */
export interface SourceUseCase {
  industry: string;
  industryLabel: string;
  useCase: string;
  label: string;
  certified: boolean;
  category: string;
}

/** What a catalog use case is typically worth at full rollout, from a past submission or the model. */
export interface ValueProfile {
  driver: ImpactDriver;
  driverLabel: string;
  valuePool: string;
  typicalLow: number;
  typicalHigh: number;
  rolloutUnit: string;
  rolloutFull: number | null;
  hardShare: 'mostly hard' | 'mixed' | 'mostly soft' | null;
  source?: 'submitted' | 'derived';
}

export interface UseCaseContext {
  summary: string;
  personas: { name: string; role: string }[];
  entities: string[];
  capabilities: string[];
  valueProfile?: ValueProfile | null;
}

export type QuestionSource = 'use_case' | 'ai' | 'you';

export interface QualityDimension {
  key: 'problem' | 'users' | 'value' | 'feasibility' | 'risks' | 'writing';
  label: string;
  score: number;
  why?: string;
  raise?: string;
  /** Held down because the step it depends on was skipped. */
  capped?: boolean;
}

/** Points owned by the server; the browser never writes these. */
export interface IdeaScore {
  journey: number;
  quality: number | null;
  outcome: number;
  total: number;
  tier: string;
  breakdown: QualityDimension[] | null;
  headline?: string | null;
  /** The idea revision the scorecard was written for. */
  revision?: number | null;
  scoredAt?: string | null;
  approvedInLibrary?: boolean;
}

/** Insights builds a Genie and dashboard on existing data; Technical builds apps, agents and pipelines. */
export type BuildTarget = 'insights' | 'technical';

export interface Idea {
  id: string;
  seed: string;
  title: string;
  industry: string;
  status: IdeaStatus;
  /** Missing means `ideate`. */
  mode?: JourneyMode;
  /** Insights project this idea belongs to; null until the project exists. */
  sessionId?: string | null;
  startPath?: 'approved' | 'own';
  sourceUseCase?: SourceUseCase;
  useCaseContext?: UseCaseContext;
  /** Steps seeded from the use case that the user has not confirmed yet. */
  prefilled?: StepKey[];
  genieQuestions?: string[];
  genieQuestionSources?: Record<string, QuestionSource>;
  /** Extra questions the AI suggested that the user can add with one tap. */
  genieAlternates?: string[];
  /** Set when an Insights idea is locked and handed to the build. */
  lockedAt?: string;
  /** Which workflow builds this idea; set when it is handed to a build. */
  buildTarget?: BuildTarget;
  /** `later` means the build is parked; the project stays linked. */
  buildStatus?: 'building' | 'later';
  /** Insights stage to open the build at; `studio` once this idea has set up its project. */
  buildStage?: 'data' | 'studio';
  /** Bumped each time an approved answer changes. */
  revision?: number;
  /** Owner/reviewer approval required before a revision may start or update a build. */
  review?: IdeaReview;
  /** The revision the linked build was last set up from. */
  builtRevision?: number;
  /** The step whose approved answer changed most recently, until the brief is approved again. */
  revisingFrom?: StepKey;
  /** A shipped, read-only example; never stored with the user's ideas. */
  sample?: boolean;
  /** When the business case 1-pager was first opened; its button stops inviting a click after that. */
  caseOpenedAt?: string;
  /** The AI helper was unavailable, so the user listed questions by hand. */
  classic?: boolean;
  /** Idea Points from the server, including the AI scorecard. */
  score?: IdeaScore;
  /** The trail intro was shown for this idea. */
  trailSeenAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Furthest step reached. */
  step: StepKey;
  approved: StepKey[];
  spark?: SparkResult;
  map?: IndustryMap;
  questions?: ClarifyQuestion[];
  answers: Record<string, string>;
  followupChecked?: boolean;
  shapes?: ShapeOption[];
  chosenShapeId?: string;
  impact?: Impact;
  brief?: string;
  summary?: CaseSummary;
  catalogRef?: CatalogRef;
  gaps?: GapResult[];
  assumptions: Assumption[];
  decisions: Decision[];
}

export const NOT_SURE = 'Not sure yet';
