/**
 * Constants for coding-assistant prompt forks.
 *
 * A "fork" is an optional per-assistant override of a section input prompt's
 * forkable fields (input_template, system_prompt, bypass_llm). Fork rows are
 * created explicitly by an admin via the Configuration UI; no fork row exists
 * until that happens. At runtime, if no fork row matches the session's
 * coding_assistant, the Default row wins.
 *
 * Only 'genie-code' and 'coda' are fork targets. All other assistant ids
 * (cursor, vscode, ai-gateway, copilot) fall back to the Default prompt.
 */

import type { AssistantId } from './codingAssistants';

/** Sentinel value stored in section_input_prompts.coding_assistant for the shared/default row. */
export const DEFAULT_ASSISTANT_KEY = '__default__' as const;

/** Assistant ids that can receive their own prompt fork. */
export const FORKABLE_ASSISTANTS = [
  { id: 'genie-code', label: 'Genie Code' },
  { id: 'coda', label: 'CoDA' },
] as const;

export type ForkableAssistantId = (typeof FORKABLE_ASSISTANTS)[number]['id'];

/** Assistants that resolve to the Default prompt when no matching fork exists. */
export const DEFAULT_GROUP: ReadonlySet<AssistantId> = new Set<AssistantId>([
  'cursor',
  'vscode',
  'ai-gateway',
  'copilot',
]);

export function isForkableAssistantId(id: string): id is ForkableAssistantId {
  return FORKABLE_ASSISTANTS.some(a => a.id === id);
}

/**
 * Resolve an assistant id to the coding_assistant key used for DB lookups.
 * Non-forkable assistants collapse to DEFAULT_ASSISTANT_KEY.
 */
export function toCodingAssistantKey(id: string | null | undefined): string {
  if (!id) return DEFAULT_ASSISTANT_KEY;
  return isForkableAssistantId(id) ? id : DEFAULT_ASSISTANT_KEY;
}

/** Human-readable label for an assistant key (including the default sentinel). */
export function labelForAssistantKey(key: string): string {
  if (key === DEFAULT_ASSISTANT_KEY) return 'Default';
  const match = FORKABLE_ASSISTANTS.find(a => a.id === key);
  return match ? match.label : key;
}
