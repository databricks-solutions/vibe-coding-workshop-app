/**
 * Shared catalog of coding assistant IDs and display names.
 *
 * Single source of truth used by:
 * - CodingAssistantSelector (runtime UI on the workflow page)
 * - CodingAssistantsConfigEditor (admin editor on the Workshop Parameters page)
 *
 * The rich per-assistant metadata (icons, colors, taglines, etc.) still lives
 * in CodingAssistantSelector. This module exposes only what the admin editor
 * needs so the two surfaces can never drift on ids or names.
 */

export type AssistantId =
  | 'cursor'
  | 'copilot'
  | 'vscode'
  | 'ai-gateway'
  | 'coda'
  | 'genie-code'
  | 'omnigent';

export interface AssistantCatalogEntry {
  id: AssistantId;
  name: string;
}

export const ASSISTANT_CATALOG: AssistantCatalogEntry[] = [
  { id: 'cursor', name: 'Cursor' },
  { id: 'copilot', name: 'GitHub Copilot' },
  { id: 'vscode', name: 'VS Code' },
  { id: 'ai-gateway', name: 'VS Code + Unity AI Gateway' },
  { id: 'coda', name: 'CoDA' },
  { id: 'genie-code', name: 'Genie Code' },
  { id: 'omnigent', name: 'Omnigent' },
];

export const ASSISTANT_IDS: AssistantId[] = ASSISTANT_CATALOG.map(a => a.id);

export function isKnownAssistantId(id: string): id is AssistantId {
  return (ASSISTANT_IDS as string[]).includes(id);
}

/** Config entry as stored inside the coding_assistants_config JSON parameter. */
export interface CodingAssistantConfigEntry {
  id: AssistantId;
  recommended: boolean;
  /** Optional per-assistant default workshop path (e.g., 'genie-accelerator' for Genie Code, 'end-to-end' for others). */
  defaultTrack?: string;
}

/**
 * Parse the workshop parameter JSON string into a clean, deduped,
 * catalog-filtered array. Returns `null` when the input is missing/malformed
 * so callers can apply their fallback.
 */
export function parseCodingAssistantsConfig(
  raw: string | null | undefined,
): CodingAssistantConfigEntry[] | null {
  if (!raw || typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const seen = new Set<string>();
  const clean: CodingAssistantConfigEntry[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { id?: unknown }).id;
    const recommended = (entry as { recommended?: unknown }).recommended;
    const defaultTrack = (entry as { defaultTrack?: unknown }).defaultTrack;
    if (typeof id !== 'string') continue;
    if (!isKnownAssistantId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    clean.push({
      id,
      recommended: !!recommended,
      ...(typeof defaultTrack === 'string' && defaultTrack.trim()
        ? { defaultTrack: defaultTrack.trim() }
        : {}),
    });
  }
  return clean;
}

/**
 * Default config used as a seed fallback.
 * Order: Cursor, Genie Code, VS Code + Unity AI Gateway, CoDA (all recommended,
 * shown on the top row); then Omnigent, GitHub Copilot, VS Code (bottom row).
 * This mirrors the order admins see in the Workshop Parameters editor on a
 * fresh install. Genie Code is recommended and flagged "New" in the catalog;
 * Omnigent leads the bottom row and is flagged "Beta".
 */
export const DEFAULT_CODING_ASSISTANTS_CONFIG: CodingAssistantConfigEntry[] = [
  { id: 'cursor', recommended: true, defaultTrack: 'end-to-end' },
  { id: 'genie-code', recommended: true, defaultTrack: 'genie-accelerator' },
  { id: 'ai-gateway', recommended: true, defaultTrack: 'end-to-end' },
  { id: 'coda', recommended: true, defaultTrack: 'end-to-end' },
  { id: 'omnigent', recommended: false, defaultTrack: 'end-to-end' },
  { id: 'copilot', recommended: false, defaultTrack: 'end-to-end' },
  { id: 'vscode', recommended: false, defaultTrack: 'end-to-end' },
];

/**
 * Per-assistant cold-start workshop level.
 *
 * Applied when the user picks an assistant on a fresh session (and when a
 * resumed session has no meaningful persisted `workshop_level` — see
 * `resolveRestoredLevel` in constants/restoreLevel.ts). A real persisted
 * `workshop_level` now
 * wins ABOVE this map on resume; saved explicit selections and use-case locks
 * still win over everything.
 *
 * MCP is exclusively the Genie Code client and walks the `genie-accelerator`
 * track, so Genie Code's cold-start default is `genie-accelerator` — the track
 * whose outline actually contains the genie gates. (It used to be
 * `lakehouse-di`, whose outline strips the genie sections; a resumed genie-code
 * session then mapped its genie gates to absent steps and collapsed to 0/28.)
 * This value also rescues pre-fix genie-code sessions still holding the bare
 * legacy `workshop_level='300'`, which does not normalize to a real track.
 * Other assistants fall through to the system default (end-to-end).
 *
 * Stored as a string literal to keep this module free of cross-imports from
 * workflowSections.ts. Consumers narrow it via `WorkshopLevel` at the call
 * site.
 */
export const DEFAULT_LEVEL_BY_ASSISTANT: Partial<Record<AssistantId, string>> = {
  'genie-code': 'genie-accelerator',
};

/**
 * Resolve the default workshop track for a given coding assistant.
 *
 * Precedence:
 *   1. Explicit `defaultTrack` configured for `assistantId` in `coding_assistants_config`
 *   2. For `'genie-code'`: `defaults.genieCodeDefaultTrack` (or `DEFAULT_LEVEL_BY_ASSISTANT['genie-code']` = `'genie-accelerator'`)
 *   3. Any other entry in `DEFAULT_LEVEL_BY_ASSISTANT`
 *   4. `defaults.defaultTrack` (which defaults to `'end-to-end'` for all other assistants)
 */
export function resolveDefaultTrackForAssistant(
  assistantId: string | null | undefined,
  defaults?: { defaultTrack?: string; genieCodeDefaultTrack?: string } | null,
  assistantsConfig?: CodingAssistantConfigEntry[] | null,
): string {
  if (assistantId && assistantsConfig) {
    const entry = assistantsConfig.find(a => a.id === assistantId);
    if (entry?.defaultTrack) return entry.defaultTrack;
  }
  if (assistantId === 'genie-code') {
    return defaults?.genieCodeDefaultTrack || DEFAULT_LEVEL_BY_ASSISTANT['genie-code'] || 'genie-accelerator';
  }
  if (assistantId && assistantId in DEFAULT_LEVEL_BY_ASSISTANT) {
    const mapped = DEFAULT_LEVEL_BY_ASSISTANT[assistantId as AssistantId];
    if (mapped) return mapped;
  }
  return defaults?.defaultTrack || 'end-to-end';
}
