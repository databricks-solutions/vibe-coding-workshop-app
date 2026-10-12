import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Menu } from 'lucide-react';
import { IdeaStepStage, IdeaTools, JourneyProgress, JourneyScreen, ideaProgressSteps, openBuildHref, useIdeaFlow, type StepKey } from '../journeykit';

interface IdeaFlowProps {
  onOpenMobileNav?: () => void;
}

export function IdeaFlow(props: IdeaFlowProps) {
  const { ideaId = '' } = useParams();
  return <IdeaFlowView key={ideaId} ideaId={ideaId} {...props} />;
}

function IdeaFlowView({ ideaId, onOpenMobileNav }: IdeaFlowProps & { ideaId: string }) {
  const flow = useIdeaFlow(ideaId);
  const { idea, viewStep } = flow;

  if (!idea) return <Navigate to="/ideate" replace />;
  if (idea.mode === 'insights') return <Navigate to={openBuildHref(idea) ?? '/?view=insights'} replace />;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <JourneyScreen
        sticky
        header={
          <div className="flex items-center gap-3">
            {onOpenMobileNav && (
              <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Link to="/ideate" className="flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">My ideas</span>
            </Link>
            <Lightbulb className="w-4 h-4 text-primary shrink-0" />
            <p className="flex-1 text-ui-base font-semibold text-foreground truncate">{idea.title}</p>
            <div className="flex items-center gap-2 shrink-0">
              <IdeaTools flow={flow} />
            </div>
          </div>
        }
        progress={<JourneyProgress steps={ideaProgressSteps(idea, viewStep)} onSelectStep={k => flow.setViewStep(k as StepKey)} />}
      >
        <IdeaStepStage flow={flow} />
      </JourneyScreen>
    </div>
  );
}
