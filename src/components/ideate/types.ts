export type IdeaStatus = 'exploring' | 'committed' | 'parked';

export type StepKey = 'spark' | 'map' | 'clarify' | 'shape' | 'impact' | 'brief';

export const STEPS: { key: StepKey; label: string; hint: string; optional?: boolean }[] = [
  { key: 'spark', label: 'Spark', hint: 'Did I get your idea right?' },
  { key: 'map', label: 'Industry Map', hint: 'Where your idea sits in the industry' },
  { key: 'clarify', label: 'Clarify', hint: 'A few quick questions' },
  { key: 'shape', label: 'Shape', hint: 'Three ways to deliver it' },
  { key: 'impact', label: 'Impact', hint: 'What could it be worth?', optional: true },
  { key: 'brief', label: 'Brief', hint: 'Your decision-ready one-pager' },
];

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
}

export interface IndustryLeaf {
  id: string;
  name: string;
  problem: string;
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
  rationale: string;
}

export interface ClarifyQuestion {
  id: string;
  dimension: string;
  question: string;
  options: string[];
  isFollowup?: boolean;
}

export type ShapeKind = 'copilot' | 'automation' | 'insight';

export interface ShapeOption {
  id: string;
  kind: ShapeKind;
  title: string;
  value: string;
  effort: string;
  riskiestAssumption: string;
  cheapTest: string;
  surfaces: string[];
}

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
}

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
  cost: CostProfile;
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
}

export interface CatalogRef {
  industry: string;
  industryLabel: string;
  useCase: string;
  useCaseLabel: string;
  version: number;
  submittedAt: string;
}

export interface Idea {
  id: string;
  seed: string;
  title: string;
  industry: string;
  status: IdeaStatus;
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
