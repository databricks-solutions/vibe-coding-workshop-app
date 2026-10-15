import { Component, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { IdeasHome } from './IdeasHome';
import { IdeaFlow } from './IdeaFlow';
import { BusinessCasePage } from './BusinessCasePage';

interface IdeateAppProps {
  onOpenMobileNav?: () => void;
}

/** Keeps any Ideate failure contained to the Ideate pane; the rest of the app keeps working. */
class IdeateErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Ideate] crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-ui-lg font-semibold text-foreground">Ideate hit a snag</p>
          <p className="text-ui-sm text-muted-foreground">Ideate is in beta. Your saved ideas are safe in this browser, and the rest of the app is unaffected.</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.assign('/ideate'); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-ui-sm font-medium"
          >
            Back to My Ideas
          </button>
        </div>
      </div>
    );
  }
}

export default function IdeateApp({ onOpenMobileNav }: IdeateAppProps) {
  return (
    <IdeateErrorBoundary>
      <Routes>
        <Route index element={<IdeasHome onOpenMobileNav={onOpenMobileNav} />} />
        <Route path=":ideaId" element={<IdeaFlow onOpenMobileNav={onOpenMobileNav} />} />
        <Route path=":ideaId/business-case" element={<BusinessCasePage onOpenMobileNav={onOpenMobileNav} />} />
        <Route path="*" element={<Navigate to="/ideate" replace />} />
      </Routes>
    </IdeateErrorBoundary>
  );
}
