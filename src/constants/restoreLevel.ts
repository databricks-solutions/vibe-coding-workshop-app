/**
 * Single source of truth for resolving the workshop level a resumed session
 * opens on. Lives in its own module (not App.tsx) so it is a pure, exported,
 * type-checked function shared by BOTH resume paths — loadSession and
 * getOrCreateDefaultSession — with the precedence living in exactly one place.
 */

import { DEFAULT_LEVEL_BY_ASSISTANT } from './codingAssistants';
import { normalizeLevel, WORKSHOP_LEVELS, type WorkshopLevel } from './workflowSections';

/** Minimal shape of the session-restore response this resolver reads. */
export interface RestoreLevelSource {
  workshop_level?: string | null;
  session_parameters?: Record<string, unknown> | null;
}

/**
 * Resolve the workshop level a coding assistant implies when the session never
 * persisted an explicit one — a LEGACY FALLBACK only. When the session's coding
 * assistant has a cold-start default (genie-code -> genie-accelerator) and the
 * user never explicitly picked a level (and there's no use-case lock), use that
 * default so the App rebuilds the same filtered outline the MCP walk uses.
 * Returns undefined when no override should apply.
 */
export function assistantDefaultLevel(
  sessionParams: Record<string, unknown>,
  lock: WorkshopLevel | null | undefined,
): WorkshopLevel | undefined {
  if (lock || sessionParams.level_explicitly_selected) return undefined;
  const assistant = sessionParams.coding_assistant as string | undefined;
  if (!assistant) return undefined;
  return DEFAULT_LEVEL_BY_ASSISTANT[assistant as keyof typeof DEFAULT_LEVEL_BY_ASSISTANT] as
    | WorkshopLevel
    | undefined;
}

/**
 * Single precedence resolver for the restored workshop level.
 *
 * Precedence:
 *   1. Use-case lock — highest; a locked use case dictates the level.
 *   2. A REAL persisted `workshop_level` — a value that is a direct key of
 *      WORKSHOP_LEVELS (so the bare legacy '300'/'200'/empty aliases, which are
 *      NOT keys, do not qualify). This now wins ABOVE the assistant default, so
 *      an MCP-stamped genie-accelerator session resumes on the genie outline
 *      instead of the assistant fallback.
 *   3. The corrected assistant legacy fallback (genie-code -> genie-accelerator),
 *      consulted only when there is no meaningful persisted level. This rescues
 *      pre-fix genie-code sessions still holding workshop_level='300'.
 *   4. The system default, 'end-to-end'.
 *
 * The existing 'skills-accelerator -> end-to-end when no lock' guard is
 * preserved: with no lock, a resolved skills-accelerator is downgraded.
 */
export function resolveRestoredLevel(
  response: RestoreLevelSource,
  lock: WorkshopLevel | null | undefined,
): WorkshopLevel {
  // (1) Use-case lock wins outright; the skills guard never applies when locked.
  if (lock) return lock;

  let resolved: WorkshopLevel;
  const rawLevel = response.workshop_level;
  // (2) A real persisted level is a direct WORKSHOP_LEVELS key. '300'/'200'/''
  // are only reachable through normalizeLevel's alias switch, never as keys, so
  // they intentionally fail this check and fall through to the fallback.
  if (rawLevel && rawLevel in WORKSHOP_LEVELS) {
    resolved = normalizeLevel(rawLevel);
  } else {
    // (3) corrected assistant legacy fallback, then (4) system default.
    resolved = assistantDefaultLevel(response.session_parameters || {}, lock)
      ?? normalizeLevel('end-to-end');
  }

  // Preserve the 'skills-accelerator -> end-to-end when no lock' guard. lock is
  // already falsy here (locked sessions returned above).
  return resolved === 'skills-accelerator' ? 'end-to-end' : resolved;
}
