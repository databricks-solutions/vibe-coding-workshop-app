import { useCallback, useRef, useState } from 'react';

export type WorkflowViewMode = 'technical' | 'insights';

/** The view named in the address bar, if any. */
function viewFromUrl(): WorkflowViewMode | null {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'insights' || v === 'technical' ? v : null;
}

/** Sessions started from the Insights view are set up on the Genie path with Genie Code. */
export function isInsightsSession(workshopLevel?: string | null, codingAssistant?: string | null) {
  return workshopLevel === 'genie-accelerator' && codingAssistant === 'genie-code';
}

/**
 * Presentation preference only; workshop progress always lives in the session.
 * Opening the page starts in Technical unless the link says `?view=`, or the
 * session that loads on open was started in Insights.
 */
export function useWorkflowViewMode() {
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

  /** Called once the first session has loaded; only an Insights session changes the view. */
  const adoptSessionView = useCallback((insights: boolean) => {
    if (decided.current) return;
    decided.current = true;
    if (!explicit && insights) setModeState('insights');
  }, [explicit]);

  return [mode, setMode, adoptSessionView] as const;
}
