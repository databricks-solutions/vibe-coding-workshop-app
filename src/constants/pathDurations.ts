/**
 * Path Durations
 *
 * Single source of truth for the "Estimated Build Time" bar at the top of
 * the Workshop Path & Architecture card. Three layers:
 *
 *   1. PATH_DURATIONS    — per-level totals + per-chapter segment splits
 *   2. *_CHIP_DELTAS     — subtractive minute deltas applied when applicable
 *                          AI / medallion chips are OFF, attributed to the
 *                          right segment so the right colored slice shrinks
 *   3. Cumulative chain  — when the user is on the APP_CHAIN past the
 *                          Apps+Lakebase column, segments are unioned across
 *                          visited chain levels so progressively-built paths
 *                          reach the same 6:00 total as `end-to-end`.
 *
 * The bar groups WORKFLOW_SECTIONS into PERSONA BUCKETS that match the
 * COLUMN_PERSONAS row in LevelSelector.tsx (For App Devs / Data Eng / Data
 * Sci), so the bar reads as a calm visual summary of the column structure
 * directly below it.
 */

import {
  APP_CHAIN,
  getActiveChain,
  getApplicableAIModules,
  getApplicableMedallionLayers,
  type WorkshopLevel,
  type WorkflowDirection,
  type AIAgentModule,
  type MedallionLayer,
  type ChainContext,
} from './workflowSections';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SegmentKey =
  | 'define-usecase'
  | 'databricks-app'
  | 'lakebase'
  | 'lakehouse'
  | 'data-intelligence'
  | 'activation'
  | 'agents-on-apps'
  | 'mlflow-genai'
  | 'agent-skills'
  | 'iterate-enhance'
  | 'cleanup';

export type PersonaBucket =
  | 'foundation'
  | 'apps-lakebase'
  | 'lakehouse'
  | 'ai-agents'
  | 'activation'
  | 'tail';

// Maps each chapter section to its persona bucket. Mirrors the new 3-column
// persona structure in LevelSelector.tsx so the bar segments directly echo
// the column captions immediately below them.
export const SEGMENT_TO_BUCKET: Record<SegmentKey, PersonaBucket> = {
  'define-usecase':    'foundation',
  'databricks-app':    'apps-lakebase',
  'lakebase':          'apps-lakebase',
  'agents-on-apps':    'apps-lakebase',
  'lakehouse':         'lakehouse',
  'data-intelligence': 'ai-agents',
  'mlflow-genai':      'ai-agents',
  'agent-skills':      'ai-agents',
  'activation':        'activation',
  'iterate-enhance':   'tail',
  'cleanup':           'tail',
};

// Render order for buckets in the bar, left-to-right (forward direction).
// Reverse ETL reorders at render time (see PathDurationBar.tsx).
export const BUCKET_ORDER: PersonaBucket[] = [
  'foundation',
  'apps-lakebase',
  'lakehouse',
  'ai-agents',
  'activation',
  'tail',
];

export interface BucketStyle {
  fillClass: string;
  ringClass: string;
  dotClass: string;
  textClass: string;
  label: string;
}

// Tones intentionally match COLUMN_PERSONAS in LevelSelector.tsx so the bar
// visually rhymes with the persona caption row above the column grid.
export const BUCKET_PALETTE: Record<PersonaBucket, BucketStyle> = {
  'foundation':    { fillClass: 'bg-slate-400/55',   ringClass: 'ring-slate-400/30',   dotClass: 'bg-slate-400',   textClass: 'text-slate-300',   label: 'Foundation' },
  'apps-lakebase': { fillClass: 'bg-amber-400/85',   ringClass: 'ring-amber-400/30',   dotClass: 'bg-amber-400',   textClass: 'text-amber-300',   label: 'Apps and Lakebase' },
  'lakehouse':     { fillClass: 'bg-teal-400/85',    ringClass: 'ring-teal-400/30',    dotClass: 'bg-teal-400',    textClass: 'text-teal-300',    label: 'Lakehouse' },
  'ai-agents':     { fillClass: 'bg-cyan-400/85',    ringClass: 'ring-cyan-400/30',    dotClass: 'bg-cyan-400',    textClass: 'text-cyan-300',    label: 'AI and Agents' },
  'activation':    { fillClass: 'bg-emerald-400/85', ringClass: 'ring-emerald-400/30', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300', label: 'Activation' },
  'tail':          { fillClass: 'bg-slate-400/40',   ringClass: 'ring-slate-400/30',   dotClass: 'bg-slate-400',   textClass: 'text-slate-300',   label: 'Refinement + Cleanup' },
};

// One-line persona caption used in hover popovers, mirrors LevelSelector.tsx.
export const BUCKET_PERSONA_HINT: Partial<Record<PersonaBucket, string>> = {
  'apps-lakebase': 'For Application Developers',
  'lakehouse':     'For Data Engineering',
  'ai-agents':     'For Data Science',
};

export interface PathDuration {
  totalMinutes: number;
  segments: Partial<Record<SegmentKey, number>>;
}

// ---------------------------------------------------------------------------
// Per-level totals
//
// Spec (per product owner): the three persona buckets each clock at exactly
// 2h, so the complete forward workshop (Apps + Lakebase + Lakehouse + AI and
// Agents) reads as a clean 6h. Foundation (define-usecase) and Tail
// (iterate-enhance + cleanup) overhead is absorbed inside the buckets — the
// bar deliberately doesn't surface them as separate slivers anymore so users
// see "2h + 2h + 2h = 6h" without granular noise.
//
// Cumulative chain math: the APP_CHAIN aggregator below takes the per-segment
// max across visited levels, so climbing app-only → app-database → lakehouse
// → lakehouse-di lands on the same 6h total as `end-to-end`.
//
// Accelerators stay at 4h flat since they're scoped to a single domain
// workshop and operate outside the additive-chain model.
// ---------------------------------------------------------------------------

export const PATH_DURATIONS: Record<WorkshopLevel, PathDuration> = {
  // Forward main path — Foundation + Tail folded into the 2h-per-bucket spec.
  'app-only':                     { totalMinutes:  60, segments: { 'databricks-app':  60                                                                                              } },
  'app-database':                 { totalMinutes: 120, segments: { 'databricks-app':  60, 'lakebase':       60                                                                        } },
  'lakehouse':                    { totalMinutes: 120, segments: {                                          'lakehouse': 120                                                          } },
  'lakehouse-di':                 { totalMinutes: 240, segments: {                                          'lakehouse': 120, 'data-intelligence': 120                                } },
  'end-to-end':                   { totalMinutes: 360, segments: { 'databricks-app':  60, 'lakebase':       60, 'lakehouse': 120, 'data-intelligence': 120                            } },

  // Accelerators keep their 4h budget and Foundation/Tail trim, since they
  // run as standalone single-domain workshops outside the additive chain.
  'accelerator':                  { totalMinutes: 240, segments: { 'define-usecase':  10, 'lakehouse':     120, 'data-intelligence':  95,                                                                  'iterate-enhance': 10, 'cleanup': 5 } },
  'genie-accelerator':            { totalMinutes: 240, segments: { 'define-usecase':  10, 'lakehouse':      90, 'data-intelligence': 125,                                                                  'iterate-enhance': 10, 'cleanup': 5 } },
  'data-engineering-accelerator': { totalMinutes: 240, segments: { 'define-usecase':  10, 'lakehouse':     215,                                                                                            'iterate-enhance': 10, 'cleanup': 5 } },
  'skills-accelerator':           { totalMinutes: 240, segments: { 'define-usecase':  10, 'agent-skills':  215,                                                                                            'iterate-enhance': 10, 'cleanup': 5 } },
  'agents-accelerator':           { totalMinutes: 240, segments: { 'define-usecase':  10, 'databricks-app': 20, 'lakebase':           20, 'agents-on-apps': 110, 'mlflow-genai': 65,                       'iterate-enhance': 10, 'cleanup': 5 } },

  // Reverse direction mirrors forward bucket totals: each section = 2h,
  // capped at 6h for the full reverse-app flow.
  'reverse-lakehouse':            { totalMinutes: 120, segments: {                                          'lakehouse': 120                                                                              } },
  'reverse-lakehouse-di':         { totalMinutes: 240, segments: {                                          'lakehouse': 120, 'data-intelligence': 120                                                    } },
  'reverse-lakebase':             { totalMinutes: 300, segments: {                                          'lakehouse': 120, 'data-intelligence': 120, 'activation':  60                                  } },
  'reverse-app':                  { totalMinutes: 360, segments: { 'databricks-app':  30, 'lakebase':       30, 'lakehouse': 120, 'data-intelligence': 120, 'activation':  60                              } },
};

// ---------------------------------------------------------------------------
// Per-chip subtractive deltas. Only applied when the chip is OFF AND the
// chip is applicable on the current level (per workflowSections.ts helpers).
//
// User spec: each section = 2h; removing Silver+Gold takes ~2h off Lakehouse,
// leaving "just Bronze" as a thin foundational layer.  We model Bronze as the
// foundational anchor (no time delta — it's "free" within the bucket) and
// Silver/Gold as the two heavyweight halves (60 min each = 2h total drop when
// both are toggled off). The AI family mirrors this shape: Dashboard is the
// foundational read, Genie + Agent are the two heavyweight halves.
// ---------------------------------------------------------------------------

export const MEDALLION_CHIP_DELTAS: Record<MedallionLayer, { minutes: number; segment: SegmentKey }> = {
  bronze: { minutes:  0, segment: 'lakehouse' },
  silver: { minutes: 60, segment: 'lakehouse' },
  gold:   { minutes: 60, segment: 'lakehouse' },
};

export const AI_CHIP_DELTAS: Record<AIAgentModule, { minutes: number; segment: SegmentKey }> = {
  dashboard: { minutes:  0, segment: 'data-intelligence' },
  genie:     { minutes: 60, segment: 'data-intelligence' },
  agent:     { minutes: 60, segment: 'data-intelligence' },
};

// ---------------------------------------------------------------------------
// Scale + tick configuration
// ---------------------------------------------------------------------------

export const SCALE_DEFAULT_MINUTES = 360;        // 0–6h normal range
export const SCALE_EXTENDED_MINUTES = 480;       // 0–8h auto-extend if any total > 6h
export const TICK_HOURS_DEFAULT = [0, 2, 4, 6] as const;
export const TICK_HOURS_EXTENDED = [0, 2, 4, 6, 8] as const;

// ---------------------------------------------------------------------------
// Computed output (single source consumed by PathDurationBar)
// ---------------------------------------------------------------------------

export type Classification = 'quick' | 'half-day' | 'deep-dive' | 'full-day';

export interface ComputedBucket {
  id: PersonaBucket;
  minutes: number;
  sub: { segment: SegmentKey; minutes: number }[];
}

export interface ComputedBuildTime {
  total: number;
  buckets: ComputedBucket[];      // ordered, only those with minutes > 0
  classification: Classification;
  scaleMaxMinutes: number;
  ticks: readonly number[];
  isEverythingSelected: boolean;  // default end-to-end OR cumulative chain at lakehouse-di with all chips on
  levelLabelHint?: string;        // optional extra context, e.g. 'everything selected'
}

const APP_CHAIN_LEVELS: Set<WorkshopLevel> = new Set([
  'app-only',
  'app-database',
  'lakehouse',
  'lakehouse-di',
]);

/**
 * When a user is on the APP_CHAIN past app-database, the path content is
 * cumulative (Apps + Lakebase + Lakehouse [+ AI]). We union per-segment
 * minutes by *taking the max* across visited chain levels — this avoids
 * double-counting overlapping bookend segments like define-usecase.
 */
function aggregateChainSegments(
  chain: WorkshopLevel[],
  uptoIdx: number,
): Partial<Record<SegmentKey, number>> {
  const out: Partial<Record<SegmentKey, number>> = {};
  for (let i = 0; i <= uptoIdx; i++) {
    const segs = PATH_DURATIONS[chain[i]]?.segments ?? {};
    for (const k of Object.keys(segs) as SegmentKey[]) {
      const v = segs[k] ?? 0;
      if (v > (out[k] ?? 0)) out[k] = v;
    }
  }
  return out;
}

function classify(total: number): Classification {
  if (total <= 60) return 'quick';
  if (total <= 180) return 'half-day';
  if (total <= 300) return 'deep-dive';
  return 'full-day';
}

/**
 * Derives the display state for the bar from the current selector state.
 * Pure function — no side effects, safe inside useMemo.
 */
export function computeBuildTime(args: {
  level: WorkshopLevel;
  direction: WorkflowDirection;
  aiModules: Set<AIAgentModule>;
  medallionLayers: Set<MedallionLayer>;
  completedSteps: Set<number>;
  chainContext?: ChainContext;
}): ComputedBuildTime {
  const { level, aiModules, medallionLayers, completedSteps, chainContext } = args;

  // 1. Effective per-segment minutes — chain-aware. The explicit chainContext
  // (when provided) wins over step-based inference so additive climbs from
  // app-database → lakehouse keep aggregating Apps + Lakebase + Lakehouse.
  let segments: Partial<Record<SegmentKey, number>>;
  const chain = getActiveChain(level, completedSteps, chainContext);
  if (chain && APP_CHAIN_LEVELS.has(level)) {
    const idx = chain.indexOf(level);
    segments = idx >= 0 ? aggregateChainSegments(chain, idx) : { ...PATH_DURATIONS[level]?.segments };
  } else {
    segments = { ...(PATH_DURATIONS[level]?.segments ?? PATH_DURATIONS['end-to-end'].segments) };
  }

  // 2. Apply chip deltas — only for chips that are off AND applicable on level.
  const applicableMedallion = getApplicableMedallionLayers(level);
  for (const layer of ['bronze', 'silver', 'gold'] as MedallionLayer[]) {
    if (applicableMedallion.has(layer) && !medallionLayers.has(layer)) {
      const { minutes, segment } = MEDALLION_CHIP_DELTAS[layer];
      const cur = segments[segment] ?? 0;
      segments[segment] = Math.max(0, cur - minutes);
    }
  }
  const applicableAI = getApplicableAIModules(level);
  for (const mod of ['dashboard', 'genie', 'agent'] as AIAgentModule[]) {
    if (applicableAI.has(mod) && !aiModules.has(mod)) {
      const { minutes, segment } = AI_CHIP_DELTAS[mod];
      const cur = segments[segment] ?? 0;
      segments[segment] = Math.max(0, cur - minutes);
    }
  }

  // 3. Roll up into persona buckets (ordered).
  const bucketTotals = new Map<PersonaBucket, ComputedBucket>();
  for (const id of BUCKET_ORDER) {
    bucketTotals.set(id, { id, minutes: 0, sub: [] });
  }
  for (const k of Object.keys(segments) as SegmentKey[]) {
    const m = segments[k] ?? 0;
    if (m <= 0) continue;
    const bk = SEGMENT_TO_BUCKET[k];
    const bucket = bucketTotals.get(bk)!;
    bucket.minutes += m;
    bucket.sub.push({ segment: k, minutes: m });
  }

  const buckets = BUCKET_ORDER
    .map(id => bucketTotals.get(id)!)
    .filter(b => b.minutes > 0);

  // 4. Total + classification + scale.
  const total = buckets.reduce((sum, b) => sum + b.minutes, 0);
  const cls = classify(total);
  const scaleMaxMinutes = total > SCALE_DEFAULT_MINUTES ? SCALE_EXTENDED_MINUTES : SCALE_DEFAULT_MINUTES;
  const ticks = scaleMaxMinutes === SCALE_EXTENDED_MINUTES ? TICK_HOURS_EXTENDED : TICK_HOURS_DEFAULT;

  // 5. "Everything selected" detection. Either explicit end-to-end, or the
  // user has climbed the full APP_CHAIN to lakehouse-di with every chip on.
  // Standalone Lakehouse + AI (LAKEHOUSE_CHAIN) is NOT "everything" — it's
  // missing Apps + Lakebase, so it must not get the all-chapters badge.
  const allChipsOn =
    (applicableAI.size === 0 || ['dashboard', 'genie', 'agent'].every(m => !applicableAI.has(m as AIAgentModule) || aiModules.has(m as AIAgentModule))) &&
    (applicableMedallion.size === 0 || ['bronze', 'silver', 'gold'].every(l => !applicableMedallion.has(l as MedallionLayer) || medallionLayers.has(l as MedallionLayer)));
  const isEverythingSelected =
    level === 'end-to-end' ||
    (chain === APP_CHAIN && level === 'lakehouse-di' && allChipsOn) ||
    false;

  return {
    total,
    buckets,
    classification: cls,
    scaleMaxMinutes,
    ticks,
    isEverythingSelected,
    levelLabelHint: isEverythingSelected ? 'everything selected' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "6:00", "1:30", "0:45" — tabular-friendly H:MM. */
export function formatHM(min: number): string {
  const safe = Math.max(0, Math.round(min));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/** "6 hr", "1 hr 30 min", "45 min" — accessible aria-valuetext. */
export function formatLabelDuration(min: number): string {
  const safe = Math.max(0, Math.round(min));
  if (safe < 60) return `${safe} min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  'quick':     'Quick start',
  'half-day':  'Half day',
  'deep-dive': 'Deep dive',
  'full-day':  'Full day',
};

export const CLASSIFICATION_TONE: Record<Classification, { bg: string; border: string; text: string }> = {
  'quick':     { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  'half-day':  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  'deep-dive': { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400'    },
  'full-day':  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400'  },
};
