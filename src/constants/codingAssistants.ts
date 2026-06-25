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
  | 'genie-code';

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
];

export const ASSISTANT_IDS: AssistantId[] = ASSISTANT_CATALOG.map(a => a.id);

export function isKnownAssistantId(id: string): id is AssistantId {
  return (ASSISTANT_IDS as string[]).includes(id);
}

/** Config entry as stored inside the coding_assistants_config JSON parameter. */
export interface CodingAssistantConfigEntry {
  id: AssistantId;
  recommended: boolean;
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
    if (typeof id !== 'string') continue;
    if (!isKnownAssistantId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    clean.push({ id, recommended: !!recommended });
  }
  return clean;
}

/**
 * Default config used as a seed fallback.
 * Order: Cursor, Genie Code, VS Code + Unity AI Gateway, CoDA (all recommended,
 * shown on the top row); then GitHub Copilot, VS Code (bottom row). This
 * mirrors the order admins see in the Workshop Parameters editor on a
 * fresh install. Genie Code is recommended and flagged "New" in the catalog.
 */
export const DEFAULT_CODING_ASSISTANTS_CONFIG: CodingAssistantConfigEntry[] = [
  { id: 'cursor', recommended: true },
  { id: 'genie-code', recommended: true },
  { id: 'ai-gateway', recommended: true },
  { id: 'coda', recommended: true },
  { id: 'copilot', recommended: false },
  { id: 'vscode', recommended: false },
];

/**
 * Per-assistant cold-start workshop level. Applied ONLY when the user picks
 * an assistant on a fresh session that hasn't had an explicit level chosen
 * yet. Saved sessions and explicit user selections are never overridden.
 *
 * Genie Code doesn't yet give the best experience on the full Apps + Lakebase
 * chapters end-to-end, so we default new Genie Code sessions to the 4h
 * Lakehouse + AI/Agents flow (`lakehouse-di`) which it can run cleanly. Other
 * assistants fall through to the system default (end-to-end).
 *
 * Stored as a string literal to keep this module free of cross-imports from
 * workflowSections.ts. Consumers narrow it via `WorkshopLevel` at the call
 * site.
 */
export const DEFAULT_LEVEL_BY_ASSISTANT: Partial<Record<AssistantId, string>> = {
  'genie-code': 'lakehouse-di',
};
