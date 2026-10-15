export interface BlueprintSource {
  repo: string;
  repoUrl: string;
  commitSha: string;
  shortSha: string;
  commitUrl: string;
  path: string;
  treeUrl: string;
  licenseUrl: string;
  noticeUrl: string;
  noticeText: string;
  galleryUrl: string;
  agentVersion: string;
  generatedAt: string;
  modelUrl?: string;
  readmeUrl?: string;
  dictionaryUrl?: string;
  installerUrl?: string;
}

export interface BlueprintIndustry {
  slug: string;
  label: string;
  section: string;
  version: string;
  flavour: string;
  counts: { areas: number; tables: number; columns: number; links: number; kpiSets: number };
}

export interface BlueprintCatalog {
  sections: { name: string; industries: string[] }[];
  industries: BlueprintIndustry[];
  live: boolean;
  source: BlueprintSource;
}

export interface BlueprintArea {
  name: string;
  label: string;
  division: string;
  description: string;
  standards: string[];
  subdomains: string[];
  tableIds: string[];
  kpiIds: string[];
  sensitiveCount: number;
  schemaUrl?: string;
  metricsUrl?: string;
  readmeUrl?: string;
}

export type TableKind = 'thing' | 'event' | 'lookup' | 'link';

export interface BlueprintColumn {
  n: string;
  l: string;
  t: string;
  s?: 1 | true;
  k?: 'pk' | 'fk';
}

export interface BlueprintTable {
  id: string;
  name: string;
  area: string;
  label: string;
  kind: TableKind;
  subdomain: string;
  purpose: string;
  keyColumns: string[];
  columns: BlueprintColumn[];
  linksTo: { to: string; via: string; reason: string }[];
  standard?: string;
}

export interface BlueprintKpi {
  id: string;
  area: string;
  table: string;
  label: string;
  description: string;
  measures: { name: string; label: string; comment: string; agg: string }[];
  slices: { name: string; label: string; comment: string; kind: 'time' | 'flag' | 'category' }[];
  sourceUrl: string;
}

export interface StarterQuestion {
  question: string;
  kpi: string;
  measure: string;
  slice: string;
  area: string;
}

export interface BlueprintDigest {
  slug: string;
  label: string;
  version: string;
  flavour: string;
  catalog: string;
  description: string;
  source: BlueprintSource;
  trust: {
    qualityScore: number | null;
    standards: string[];
    sensitiveFields: number;
    links: number;
    brokenLinks: number;
    siloedTables: number;
  };
  stats: { areas: number; tables: number; columns: number; links: number; kpiSets: number; measures: number };
  areas: BlueprintArea[];
  tables: BlueprintTable[];
  kpis: BlueprintKpi[];
  links: { a: string; b: string; n: number }[];
  starterQuestions: StarterQuestion[];
}

export type InstallState = 'not_installed' | 'installing' | 'installed' | 'failed' | 'unknown' | 'exists' | 'needs_genie_code' | 'busy';

export interface InstallStatus {
  state: InstallState;
  catalog: string;
  runId?: number | null;
  runUrl?: string | null;
  startedBy?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  error?: string | null;
  recent?: string[] | null;
  phase?: string | null;
  phaseLabel?: string | null;
  percent: number;
  phases?: { id: string; label: string }[];
  reason?: string;
  source?: BlueprintSource;
}

export interface InstalledModel {
  catalog: string;
  slug: string;
  flavour: string;
  owner: string;
  /** True once the install finished and recorded its provenance comment. */
  ready: boolean;
  sourcePath: string;
  shortSha: string;
  catalogUrl: string;
}

export interface Capabilities {
  canInstall: boolean;
  reason: string;
  installEnabled: boolean;
}

/** What the user picked in the explorer; persisted inside the brief. */
/** How an idea maps onto a model, from POST /blueprints/{slug}/fit. Every id is in the digest. */
export interface BlueprintFit {
  slug: string;
  needs: {
    need: string;
    grain: string;
    importance: 'must' | 'nice';
    areas: string[];
    tables: string[];
    /** Set when the model has nothing for this need. */
    gap: string;
  }[];
  /** `join` is a real cross-area link [from_table, to_table] tying the area to another chosen one. */
  areas: { name: string; role: 'core' | 'supporting'; why: string; join?: [string, string] }[];
  /** Areas from the quick pick the AI left out, with what their tables actually hold. */
  skipped?: { name: string; why: string }[];
  questions: { index: number; kpi: string | null }[];
  fit: 'strong' | 'partial' | 'weak';
  summary: string;
}

export interface BlueprintChoice {
  slug: string;
  label: string;
  version: string;
  flavour: string;
  catalog: string;
  commitSha: string;
  areas: string[];
  kpis: string[];
  evidence?: {
    fit: 'strong' | 'partial' | 'weak' | 'fallback' | 'unknown';
    matchedQuestions: number;
    totalQuestions: number;
    coveredNeeds: number;
    totalNeeds: number;
    gapCount: number;
    tableCount: number;
    modelQuality: number | null;
  };
}
