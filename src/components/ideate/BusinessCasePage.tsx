import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { BusinessCaseView, useIdeaFlow } from '../journeykit';

export function BusinessCasePage({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { ideaId = '' } = useParams();
  const navigate = useNavigate();
  const flow = useIdeaFlow(ideaId);

  if (!flow.idea) return <Navigate to="/ideate" replace />;
  const back = () => navigate(`/ideate/${ideaId}`);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <BusinessCaseView
        flow={flow}
        leading={
          <>
            {onOpenMobileNav && (
              <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Link to={`/ideate/${ideaId}`} className="flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to brief</span>
            </Link>
          </>
        }
        onBackToFlow={back}
        onAddNumbers={back}
      />
    </div>
  );
}
