/**
 * Canonical Genie Code MCP connection copy (D4 §1.1 / D10 §2).
 *
 * The SPA "Connect to Genie Code" panel renders these strings. D10 §2 in
 * `docs/specs/mcp_design/mcp-workshop-facilitator-guide.md` must stay in lockstep —
 * `tests/e2e/connect-genie-code.spec.ts` asserts the facilitator guide contains
 * the same step text (markdown emphasis/backticks stripped).
 */

/** The three connection steps from D10 §2 (learner path). */
export const GENIE_CODE_MCP_CONNECTION_STEPS = [
  'Open Genie Code in your workspace and switch to Agent mode.',
  'Open the MCP / custom-tools settings and Add a custom MCP server.',
  "Enter the app's MCP URL: https://<app-url>/mcp (the app URL + /mcp).",
] as const;

/** MCP prompt name from D2 §5 — first-run entry point after connecting. */
export const GENIE_ACCELERATOR_START_PROMPT = 'Start the Genie Accelerator';

/** Runtime MCP endpoint for the deployed app (window origin + /mcp). */
export function mcpUrlFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/mcp`;
}
