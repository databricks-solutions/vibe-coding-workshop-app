/**
 * Canonical Genie Code MCP connection copy (D4 §1.1 / D10 §2).
 *
 * The SPA "Connect to Genie Code" panel renders these strings. D10 §2 in
 * `docs/specs/mcp_design/mcp-workshop-facilitator-guide.md` must stay in lockstep —
 * `tests/e2e/connect-genie-code.spec.ts` asserts the facilitator guide contains
 * the same step text (markdown emphasis/backticks stripped).
 */

import { WORKSHOP_LEVELS } from './workflowSections';

/** The three connection steps from D10 §2 (learner path). */
export const GENIE_CODE_MCP_CONNECTION_STEPS = [
  'Open Genie Code in your workspace and switch to Agent mode.',
  'Open the MCP / custom-tools settings and Add a custom MCP server.',
  "Enter the app's MCP URL: https://<app-url>/mcp (the app URL + /mcp).",
] as const;

/** MCP prompt name from D2 §5 — first-run entry point after connecting. */
export const GENIE_ACCELERATOR_START_PROMPT = 'Start the Genie Accelerator';

/** MCP prompt name for any other track (`src/backend/mcp_server.py`, arg `track`). */
export const GENERIC_TRACK_START_PROMPT = 'Start a workshop track';

/**
 * The MCP start prompt for the session's track (D-59). The Genie Accelerator, an
 * unset level, or a level the SPA does not know keep the Genie Accelerator prompt;
 * any other track uses the generic prompt with its track id.
 */
export function startPromptForTrack(
  level: string | null | undefined,
): { prompt: string; track: string | null } {
  if (!level || level === 'genie-accelerator' || !Object.hasOwn(WORKSHOP_LEVELS, level)) {
    return { prompt: GENIE_ACCELERATOR_START_PROMPT, track: null };
  }
  return { prompt: GENERIC_TRACK_START_PROMPT, track: level };
}

/** Runtime MCP endpoint for the deployed app (window origin + /mcp). */
export function mcpUrlFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/mcp`;
}
