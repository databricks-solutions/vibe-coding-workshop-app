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
  { id: 'ai-gateway', name: 'VS Code + Databricks AI Gateway' },
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
 * Order: Cursor, CoDA, VS Code + AI Gateway (all recommended); then GitHub
 * Copilot, VS Code, Genie Code. This mirrors the order admins see in the
 * Workshop Parameters editor on a fresh install.
 */
export const DEFAULT_CODING_ASSISTANTS_CONFIG: CodingAssistantConfigEntry[] = [
  { id: 'cursor', recommended: true },
  { id: 'coda', recommended: true },
  { id: 'ai-gateway', recommended: true },
  { id: 'genie-code', recommended: false },
  { id: 'copilot', recommended: false },
  { id: 'vscode', recommended: false },
];
