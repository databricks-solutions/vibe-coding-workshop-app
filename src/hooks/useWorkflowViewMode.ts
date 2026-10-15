import { useCallback, useRef, useState } from 'react';

export type WorkflowViewMode = 'technical' | 'insights';

/** The view named in the address bar, if any. */
function viewFromUrl(): WorkflowViewMode | null {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'insights' || v === 'technical' ? v : null;
}

/**
 * Whether a session opens in Insights (D-143): `?view=` wins, then the session's
 * stored `view` marker; a session with no marker opens in Technical. The track
 * and coding assistant play no part (every MCP session stores genie-code).
 */
export function isInsightsSession(
  storedView?: string | null,
  urlView: WorkflowViewMode | null = viewFromUrl(),
) {
  if (urlView) return urlView === 'insights';
  return storedView === 'insights';
}

/**
 * Presentation preference only; workshop progress always lives in the session.
 * Opening the page starts in Technical unless the link says `?view=`, or the
 * session that loads on open stores the Insights marker. `switchMode` is the
 * learner's own switch: it also hands the new view to `persistView` so the
 * session's marker follows it.
 */
export function useWorkflowViewMode(persistView?: (mode: WorkflowViewMode) => void) {
  const [explicit] = useState(viewFromUrl);
  const decided = useRef(false);
  const [mode, setModeState] = useState<WorkflowViewMode>(explicit ?? 'technical');

  const setMode = useCallback((next: WorkflowViewMode) => {
    decided.current = true;
    setModeState(next);
    // Keep ?view= in the address bar current so the link always reopens this view.
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== next) {
      url.searchParams.set('view', next);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);

  const switchMode = useCallback((next: WorkflowViewMode) => {
    setMode(next);
    persistView?.(next);
  }, [setMode, persistView]);

  /** Called once the first session has loaded; only an Insights session changes the view. */
  const adoptSessionView = useCallback((insights: boolean) => {
    if (decided.current) return;
    decided.current = true;
    if (!explicit && insights) setModeState('insights');
  }, [explicit]);

  return [mode, setMode, adoptSessionView, switchMode] as const;
}
