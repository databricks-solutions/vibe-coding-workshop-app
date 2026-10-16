/**
 * Session sync (one engine, two interfaces): what the web UI shows, read from a
 * stored session, and which parts of it changed on the server.
 *
 * Both load paths and the background refresh build the UI state with
 * `sessionViewFrom`, so a session opened, reloaded or changed from Genie Code
 * looks the same. `changedGroups` compares two load responses group by group, so
 * a refresh only touches what Genie Code (or another tab) actually changed.
 */

import type { SessionLoadResponse } from '../api/client';
import { deriveCompletedStepNumbers, deriveSkippedStepNumbers } from '../constants/deriveProgress';
import { resolveRestoredLevel } from '../constants/restoreLevel';
import {
  ALL_AI_MODULES,
  ALL_MEDALLION_LAYERS,
  USE_CASE_LEVEL_LOCK,
  deriveInitialChainContext,
  normalizeMedallionLayers,
  type AIAgentModule,
  type ChainContext,
  type MedallionLayer,
  type WorkflowDirection,
  type WorkshopLevel,
} from '../constants/workflowSections';

type Params = Record<string, unknown>;

const CHAIN_CONTEXTS: ReadonlySet<string> = new Set(['app', 'lakehouse', 'reverse']);

function paramsOf(resp: SessionLoadResponse): Params {
  return (resp.session_parameters ?? {}) as Params;
}

function flagsOf(params: Params): Record<string, unknown> {
  const flags = params.flags;
  return flags && typeof flags === 'object' ? flags as Record<string, unknown> : {};
}

/** The stored engine flag when it is a boolean, else the legacy snake key. */
function flagOr(flags: Record<string, unknown>, key: string, legacy: unknown): boolean {
  return typeof flags[key] === 'boolean' ? flags[key] as boolean : !!legacy;
}

/**
 * The composition chips as stored. `flags` is what GET /outline composes from, so
 * it wins; the snake keys are the fallback for sessions saved before flags existed.
 * A module or layer with no stored flag is on (the inclusive default).
 */
export function chipsFromParams(params: Params): {
  aiAgentsModules: Set<AIAgentModule>;
  medallionLayers: Set<MedallionLayer>;
  includeLakehouse: boolean;
  includeGenieOntology: boolean;
} {
  const flags = flagsOf(params);
  return {
    aiAgentsModules: new Set(ALL_AI_MODULES.filter(m => flags[`ai.${m}`] !== false)),
    medallionLayers: normalizeMedallionLayers(new Set(ALL_MEDALLION_LAYERS.filter(l => flags[`medallion.${l}`] !== false))),
    includeLakehouse: flagOr(flags, 'includeLakehouse', params.include_lakehouse),
    includeGenieOntology: flagOr(flags, 'includeGenieOntology', params.include_genie_ontology),
  };
}

/** The stored chain context (what GET /outline composes with), else the legacy derivation. */
export function chainFromParams(params: Params, level: WorkshopLevel, completed: Set<number>): ChainContext {
  const stored = params.chainContext;
  if (typeof stored === 'string' && CHAIN_CONTEXTS.has(stored)) return stored as ChainContext;
  return deriveInitialChainContext(level, completed);
}

/** Everything the web UI hydrates from one stored session. */
export interface SessionView {
  level: WorkshopLevel;
  useCaseLockedLevel: WorkshopLevel | null;
  chainContext: ChainContext;
  direction: WorkflowDirection | null;
  levelExplicitlySelected: boolean;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  aiAgentsModules: Set<AIAgentModule>;
  medallionLayers: Set<MedallionLayer>;
  includeLakehouse: boolean;
  includeGenieOntology: boolean;
  codingAssistant: string | null;
}

export function sessionViewFrom(resp: SessionLoadResponse): SessionView {
  const params = paramsOf(resp);
  const lock = USE_CASE_LEVEL_LOCK[resp.use_case || ''] ?? null;
  const level = resolveRestoredLevel(resp, lock);
  const completed = new Set(deriveCompletedStepNumbers(resp.completed_gates));
  // Intent is defined when industry + use case are selected: step 1 is done.
  if (resp.industry && resp.use_case) completed.add(1);
  const direction = params.direction === 'reverse' || params.direction === 'forward'
    ? params.direction as WorkflowDirection
    : null;
  return {
    level,
    useCaseLockedLevel: lock,
    chainContext: chainFromParams(params, level, completed),
    direction,
    levelExplicitlySelected: !!params.level_explicitly_selected,
    completedSteps: completed,
    skippedSteps: new Set(deriveSkippedStepNumbers(resp.skipped_gates)),
    ...chipsFromParams(params),
    codingAssistant: typeof params.coding_assistant === 'string' && params.coding_assistant ? params.coding_assistant : null,
  };
}

/** The parts of a session the refresh can apply independently. */
export type SyncGroup = 'name' | 'intent' | 'track' | 'composition' | 'progress' | 'prompts' | 'assistant' | 'prereq';

const sorted = (values: string[] | undefined) => [...(values ?? [])].sort();

/** One stable string per group, so two responses compare group by group. */
export function syncSnapshot(resp: SessionLoadResponse): Record<SyncGroup, string> {
  const p = paramsOf(resp);
  const json = (value: unknown) => JSON.stringify(value ?? null);
  const flags = flagsOf(p);
  const sortedFlags = Object.fromEntries(Object.keys(flags).sort().map(k => [k, flags[k]]));
  return {
    name: json([resp.session_name, resp.is_saved, resp.session_description]),
    intent: json([
      resp.industry, resp.industry_label, resp.use_case, resp.use_case_label,
      p.custom_use_case_label, p.custom_use_case_description, p.company_brand_url,
    ]),
    track: json([resp.workshop_level, resp.use_case, p.level_explicitly_selected]),
    composition: json([p.direction, p.chainContext, sortedFlags, p.include_lakehouse, p.include_genie_ontology]),
    progress: json([sorted(resp.completed_gates), sorted(resp.skipped_gates), !!(resp.industry && resp.use_case)]),
    prompts: json(Object.keys(resp.step_prompts ?? {}).sort().map(k => [k, (resp.step_prompts as Record<string, string>)[k]])),
    assistant: json(p.coding_assistant),
    prereq: json(!!resp.prerequisites_completed),
  };
}

export const ALL_SYNC_GROUPS: SyncGroup[] = ['name', 'intent', 'track', 'composition', 'progress', 'prompts', 'assistant', 'prereq'];

/** The groups whose stored value differs between two snapshots (all of them with no base). */
export function changedGroups(
  base: Record<SyncGroup, string> | null,
  next: Record<SyncGroup, string>,
): SyncGroup[] {
  if (!base) return [...ALL_SYNC_GROUPS];
  return ALL_SYNC_GROUPS.filter(group => base[group] !== next[group]);
}

/**
 * Whether a background refresh may apply its response: the session is still the
 * one asked for, and no session write was in flight or issued meanwhile (that
 * write's own refresh supersedes this one; applying it could undo the write).
 */
export function canApplyRefresh(
  requestedId: string,
  currentId: string | null,
  before: { seq: number; inflight: number },
  after: { seq: number; inflight: number },
): boolean {
  return requestedId === currentId && before.inflight === 0 && after.inflight === 0 && before.seq === after.seq;
}
