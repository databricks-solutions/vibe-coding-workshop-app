export type IdeaStatus = 'exploring' | 'committed' | 'parked';

export type StepKey = 'spark' | 'map' | 'clarify' | 'shape' | 'brief';

export const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'spark', label: 'Spark', hint: 'Did I get your idea right?' },
  { key: 'map', label: 'Industry Map', hint: 'Where your idea sits in the industry' },
  { key: 'clarify', label: 'Clarify', hint: 'A few quick questions' },
  { key: 'shape', label: 'Shape', hint: 'Three ways to deliver it' },
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
  industry: string;
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
  brief?: string;
  gaps?: GapResult[];
  assumptions: Assumption[];
  decisions: Decision[];
}

export const NOT_SURE = 'Not sure yet';
