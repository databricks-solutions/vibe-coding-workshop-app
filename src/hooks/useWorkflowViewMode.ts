import { useCallback, useState } from 'react';

export type WorkflowViewMode = 'technical' | 'insights';

const STORAGE_KEY = 'v2v.workflow.viewMode';

function readInitialMode(): WorkflowViewMode {
  const fromUrl = new URLSearchParams(window.location.search).get('view');
  if (fromUrl === 'insights' || fromUrl === 'technical') {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(STORAGE_KEY) === 'insights' ? 'insights' : 'technical';
}

/** Presentation preference only; workshop progress always lives in the session. */
export function useWorkflowViewMode() {
  const [mode, setModeState] = useState<WorkflowViewMode>(readInitialMode);
  const setMode = useCallback((next: WorkflowViewMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    // Keep ?view= in the address bar current so the link always reopens this view.
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== next) {
      url.searchParams.set('view', next);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);
  return [mode, setMode] as const;
}
