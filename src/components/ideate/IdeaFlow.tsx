import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Menu, RefreshCw, SkipForward } from 'lucide-react';
import { useIdeaFlow } from '../../hooks/useIdeaFlow';
import { ExpandableErrorBanner } from '../ExpandableErrorBanner';
import { AssumptionsDrawer } from './AssumptionsDrawer';
import { ClarityRing } from './ClarityRing';
import { IdeaStepper } from './IdeaStepper';
import { StepFooter, Thinking } from './StepFooter';
import { StepIntro } from './StepIntro';
import { STEP_ART } from './art';
import { motion, useReducedMotion } from 'framer-motion';
import { stepIndex } from './ideaContext';
import { STEPS, type Idea, type StepKey } from './types';
import { SparkStep } from './steps/SparkStep';
import { MapStep } from './steps/MapStep';
import { ClarifyStep } from './steps/ClarifyStep';
import { ShapeStep } from './steps/ShapeStep';
import { ImpactStep } from './steps/ImpactStep';
import { BriefStep } from './steps/BriefStep';

const THINKING: Record<StepKey, string> = {
  spark: 'Making sense of your idea',
  map: 'Mapping your industry',
  clarify: 'Thinking of the right questions',
  shape: 'Sketching three different approaches',
  impact: 'Working out what it could be worth',
  brief: 'Writing your brief',
};

function hasOutput(idea: Idea, step: StepKey) {
  switch (step) {
    case 'spark': return !!idea.spark;
    case 'map': return !!idea.map;
    case 'clarify': return !!idea.questions?.length;
    case 'shape': return !!idea.shapes?.length;
    case 'impact': return !!idea.impact;
    case 'brief': return !!idea.brief;
  }
}

function canReach(idea: Idea, step: StepKey) {
  const i = stepIndex(step);
  return i === 0 || idea.approved.includes(STEPS[i - 1].key);
}

interface IdeaFlowProps {
  onOpenMobileNav?: () => void;
}

export function IdeaFlow(props: IdeaFlowProps) {
  const { ideaId = '' } = useParams();
  return <IdeaFlowView key={ideaId} ideaId={ideaId} {...props} />;
}

function IdeaFlowView({ ideaId, onOpenMobileNav }: IdeaFlowProps & { ideaId: string }) {
  const flow = useIdeaFlow(ideaId);
  const { idea, viewStep, loading, error } = flow;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const autoRan = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  const [lastStep, setLastStep] = useState(viewStep);
  const [direction, setDirection] = useState(1);
  if (viewStep !== lastStep) {
    setDirection(stepIndex(viewStep) > stepIndex(lastStep) ? 1 : -1);
    setLastStep(viewStep);
  }

  const missing = !!idea && !hasOutput(idea, viewStep) && canReach(idea, viewStep);

  useEffect(() => {
    if (!idea || !missing || loading || error) return;
    const key = `${idea.id}:${viewStep}`;
    if (autoRan.current === key) return;
    autoRan.current = key;
    flow.run(viewStep);
  }, [idea, missing, loading, error, viewStep, flow]);

  useEffect(() => {
    if (idea && hasOutput(idea, viewStep)) autoRan.current = null;
  }, [idea, viewStep]);

  if (!idea) return <Navigate to="/ideate" replace />;

  const openAssumptions = idea.assumptions.filter(a => a.status === 'open').length;
  const approved = idea.approved.includes(viewStep);
  const streamingBrief = viewStep === 'brief' && loading === 'brief';
  const stepLoading = loading === viewStep && !streamingBrief;
  const showContent = hasOutput(idea, viewStep) || streamingBrief || (viewStep === 'brief' && !!flow.briefDraft);

  const canApprove = (() => {
    switch (viewStep) {
      case 'spark': return !!idea.spark?.statement.trim();
      case 'map': return !!idea.map?.placedLeafId;
      case 'clarify': return !!idea.questions?.length && idea.questions.every(q => idea.answers[q.id]) && loading !== 'followup';
      case 'shape': return !!idea.chosenShapeId;
      case 'impact': return !!idea.impact && (!!idea.impact.skipped || idea.impact.questions.every(q => idea.impact!.answers[q.key]));
      case 'brief': return !!idea.brief && !streamingBrief && !approved;
    }
  })();

  const nextStep = STEPS[Math.min(stepIndex(viewStep) + 1, STEPS.length - 1)].key;
  const onContinue = viewStep !== 'brief' && stepIndex(idea.step) > stepIndex(viewStep) ? () => flow.setViewStep(nextStep) : undefined;

  const retry = () => {
    flow.clearError();
    autoRan.current = null;
    if (hasOutput(idea, viewStep) && viewStep !== 'brief') return;
    flow.run(viewStep);
  };

  const StepView = { spark: SparkStep, map: MapStep, clarify: ClarifyStep, shape: ShapeStep, impact: ImpactStep, brief: BriefStep }[viewStep];
  const canSkip = viewStep === 'impact' && canReach(idea, 'impact') && !approved && !idea.impact?.skipped;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
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
          {openAssumptions > 0 && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-ui-xs font-semibold hover:bg-amber-500/20 animate-scale-in"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {openAssumptions} assumption{openAssumptions === 1 ? '' : 's'}
            </button>
          )}
          <ClarityRing idea={idea} size={38} />
        </div>
        <div className="max-w-5xl mx-auto px-5 pb-3">
          <IdeaStepper idea={idea} viewStep={viewStep} onSelect={flow.setViewStep} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="relative">
          <StepIntro step={viewStep} />
          {canSkip && (
            <button
              onClick={flow.skipImpact}
              className="absolute top-0 right-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              Skip this step <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 space-y-2">
            <ExpandableErrorBanner error={error} summary="Something went wrong talking to the AI." />
            <button onClick={retry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-primary hover:bg-primary/10">
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </button>
          </div>
        )}

        {!canReach(idea, viewStep) && !hasOutput(idea, viewStep) ? (
          <p className="text-ui-base text-muted-foreground">Approve the previous step first.</p>
        ) : stepLoading || (!showContent && !error) ? (
          <Thinking label={THINKING[viewStep]} image={STEP_ART[viewStep].image} />
        ) : showContent ? (
          <motion.div
            key={`${viewStep}-view`}
            initial={reduceMotion ? false : { opacity: 0, x: 16 * direction }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <StepView flow={flow} />
            <StepFooter
              canApprove={canApprove}
              approveLabel={viewStep === 'brief' ? (approved ? 'Approved' : 'Approve brief') : 'Looks good'}
              onApprove={() => flow.approve(viewStep)}
              onChange={fb => flow.run(viewStep, fb)}
              onChallenge={() => flow.challenge(viewStep)}
              challenging={loading === 'challenge'}
              pushbacks={flow.pushbacks}
              onDismissPushbacks={flow.clearPushbacks}
              busy={!!loading && loading !== 'challenge'}
              approved={approved}
              onContinue={onContinue}
              showKeyHint={idea.approved.length === 0}
            />
          </motion.div>
        ) : null}
      </div>

      <AssumptionsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assumptions={idea.assumptions}
        onSet={flow.setAssumption}
      />
    </div>
  );
}
