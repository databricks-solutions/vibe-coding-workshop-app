/**
 * Canonical Genie Code MCP connection copy (D4 §1.1 / D10 §2).
 *
 * The SPA "Connect to Genie Code" panel renders these strings. D10 §2 in
 * `docs/specs/mcp_design/mcp-workshop-facilitator-guide.md` must stay in lockstep —
 * `tests/e2e/connect-genie-code.spec.ts` asserts the facilitator guide contains
 * the same step text (markdown emphasis/backticks stripped).
 */

import { useEffect, useState } from 'react';
import type { WorkshopLevel } from './workflowSections';
import { TRACK_DISPLAY_NAMES } from './trackNames';

export type GenieCodeMode = 'mcp' | 'copy-paste';

const MODE_STORAGE_KEY = 'vibe.genieCode.mode';
const MODE_EVENT_NAME = 'vibe:genie-code-mode-change';

export function useGenieCodeMode(): [GenieCodeMode, (next: GenieCodeMode) => void] {
  const [mode, setModeState] = useState<GenieCodeMode>(() => {
    if (typeof window === 'undefined') return 'mcp';
    try {
      const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
      return saved === 'copy-paste' ? 'copy-paste' : 'mcp';
    } catch {
      return 'mcp';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<GenieCodeMode>).detail;
      if (detail === 'mcp' || detail === 'copy-paste') {
        setModeState(detail);
      }
    };
    window.addEventListener(MODE_EVENT_NAME, onSync);
    return () => window.removeEventListener(MODE_EVENT_NAME, onSync);
  }, []);

  const setMode = (next: GenieCodeMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent<GenieCodeMode>(MODE_EVENT_NAME, { detail: next }));
    }
  };

  return [mode, setMode];
}

/** The three connection steps from D10 §2 (learner path). */
export const GENIE_CODE_MCP_CONNECTION_STEPS = [
  'Open Genie Code in your workspace and switch to Agent mode.',
  'Open the MCP / custom-tools settings and Add a custom MCP server.',
  "Enter the app's MCP URL: https://<app-url>/mcp (the app URL + /mcp).",
] as const;

/**
 * The MCP prompt every start line names (`src/backend/mcp_server.py`, args `track`
 * and `session_id`). The server matches the track by id or by name, so the line
 * uses the name a learner reads. "Start the Genie Accelerator" stays a server
 * prompt for anyone who already uses it, but the UI no longer shows it.
 */
export const GENERIC_TRACK_START_PROMPT = 'Start a workshop track';

/**
 * What the learner says in Genie Code to continue THIS web session there:
 * "Start a workshop track: Genie Accelerator (session <id>)". Without a session
 * id (none loaded yet) it starts a new one.
 */
export function startLineForSession(
  level: string | null | undefined,
  sessionId: string | null | undefined,
): string {
  const track = level && Object.hasOwn(TRACK_DISPLAY_NAMES, level)
    ? TRACK_DISPLAY_NAMES[level as WorkshopLevel]
    : TRACK_DISPLAY_NAMES['genie-accelerator'];
  const session = sessionId ? ` (session ${sessionId})` : '';
  return `${GENERIC_TRACK_START_PROMPT}: ${track}${session}`;
}

/** Runtime MCP endpoint for the deployed app (window origin + /mcp). */
export function mcpUrlFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/mcp`;
}
