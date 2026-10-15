import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, History, RefreshCw, SkipForward } from 'lucide-react';
import { ExpandableErrorBanner } from '../../ExpandableErrorBanner';
import { STEP_ART } from '../art';
import { stepIndex, stepMeta, stepsOf } from '../engine/ideaContext';
import { canReach, hasOutput } from '../engine/reach';
import { hasBuild } from '../engine/handoff';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import type { StepKey } from '../engine/types';
import { modeOf } from '../modes';
import { BriefStep } from '../steps/BriefStep';
import { ClarifyStep } from '../steps/ClarifyStep';
import { ImpactStep } from '../steps/ImpactStep';
import { MapStep } from '../steps/MapStep';
import { QuestionsStep } from '../steps/QuestionsStep';
import { ShapeStep } from '../steps/ShapeStep';
import { SparkStep } from '../steps/SparkStep';
import { Thinking } from '../ui/Thinking';
import { JourneyThinkingArt } from '../ui/JourneyThinkingArt';
import { UseCaseBadge } from '../ui/UseCaseBadge';
import { GhostButton, Headline, PrimaryButton, SecondaryButton } from '../ui/primitives';
import { ActionBar, StepActions } from './ActionBar';
import { NextUpCard, WelcomeBack } from './NextUpCard';
import { TrailheadIntro } from './TrailheadIntro';

const STEP_VIEWS: Record<StepKey, (p: { flow: IdeaFlow }) => ReactNode> = {
  spark: SparkStep, map: MapStep, clarify: ClarifyStep, shape: ShapeStep, questions: QuestionsStep, impact: ImpactStep, brief: BriefStep,
};

const THINKING_HELPER: Record<StepKey, string> = {
  spark: 'Turning what you shared into one clear idea.',
  map: 'Finding the main area and the related opportunities.',
  clarify: 'Using what you already shared, so you only answer what matters.',
  shape: 'Balancing what it builds, the effort, and the value it could create.',
  questions: 'Turning your goals into questions your Genie should answer well.',
  impact: 'Turning rough inputs into a practical value range.',
  brief: 'Bringing your decisions together into a page you can share.',
};

interface IdeaStepStageProps {
  flow: IdeaFlow;
  /** Rendered instead of the error when the AI helper is not available at all. */
  unavailable?: ReactNode;
  /** Back from the first step, e.g. to the Start screen. */
  onBackFromFirst?: () => void;
  onChangeUseCase?: () => void;
}

/** Renders the current idea step the same way in every flow: header, body, and the approve gate. */
export function IdeaStepStage({ flow, unavailable, onBackFromFirst, onChangeUseCase }: IdeaStepStageProps) {
  const { idea, viewStep, loading, error } = flow;
  const autoRan = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  const [lastStep, setLastStep] = useState(viewStep);
  const [direction, setDirection] = useState(1);
  const mode = idea?.mode;
  if (viewStep !== lastStep) {
    setDirection(stepIndex(viewStep, mode) > stepIndex(lastStep, mode) ? 1 : -1);
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

  useEffect(() => {
    document.querySelector('main .overflow-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [viewStep]);

  if (!idea) return null;

  if (!idea.trailSeenAt && idea.approved.length === 0 && !flow.readOnly && !idea.sample) {
    return <TrailheadIntro idea={idea} onStart={() => flow.patch({ trailSeenAt: new Date().toISOString() })} />;
  }

  const config = modeOf(idea);
  const steps = stepsOf(idea);
  const index = stepIndex(viewStep, idea.mode);
  const meta = stepMeta(idea, viewStep);
  const approved = idea.approved.includes(viewStep);
  const prefilled = !!idea.prefilled?.includes(viewStep);
  const streamingBrief = viewStep === 'brief' && loading === 'brief';
  const stepLoading = loading === viewStep && !streamingBrief;
  const showContent = hasOutput(idea, viewStep) || streamingBrief || (viewStep === 'brief' && !!flow.briefDraft);

  const canApprove = (() => {
    switch (viewStep) {
      case 'spark': return !!idea.spark?.statement.trim();
      case 'map': return !!idea.map?.placedLeafId;
      case 'clarify': return !!idea.questions?.length && idea.questions.every(q => idea.answers[q.id]) && loading !== 'followup';
      case 'shape': return !!idea.chosenShapeId;
      case 'questions': return !!idea.genieQuestions?.length;
      case 'impact': return !!idea.impact && (!!idea.impact.skipped || idea.impact.questions.every(q => idea.impact!.answers[q.key]));
      case 'brief': return !!idea.brief && !streamingBrief && !approved;
    }
  })();

  const next = steps[Math.min(index + 1, steps.length - 1)].key;
  const onContinue = viewStep !== 'brief' && stepIndex(idea.step, idea.mode) > index ? () => flow.setViewStep(next) : undefined;
  const onBack = index > 0 ? () => flow.setViewStep(steps[index - 1].key) : onBackFromFirst;
  const prevLabel = index > 0 ? steps[index - 1].label : 'Start';
  const backLabel = `Back: ${prevLabel}`;
  const nextStep = index < steps.length - 1 ? steps[index + 1] : null;
  const nextUnlocked = !!nextStep && (flow.readOnly || stepIndex(idea.step, idea.mode) > index);
  const revising = idea.revisingFrom && !idea.approved.includes('brief') ? stepMeta(idea, idea.revisingFrom) : null;

  const retry = () => {
    flow.clearError();
    autoRan.current = null;
    if (hasOutput(idea, viewStep) && viewStep !== 'brief') return;
    flow.run(viewStep);
  };

  const StepView = STEP_VIEWS[viewStep];
  const canSkip = viewStep === 'impact' && canReach(idea, 'impact') && !approved && !idea.impact?.skipped;
  const subtitle = viewStep === 'clarify' && idea.sourceUseCase
    ? 'Only what your use case did not already answer. Pick answers, no essays needed.'
    : config.promise[viewStep];

  return (
    <div className="space-y-6">
      {(onBack || nextUnlocked) && (
        <nav className="flex items-center gap-2" aria-label="Steps">
          {onBack && (
            <SecondaryButton onClick={onBack} className="min-w-0 max-w-[48%]" title={index > 0 ? `Go back to step ${index}: ${prevLabel}` : 'Go back to start'}>
              <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="truncate">{prevLabel}</span>
            </SecondaryButton>
          )}
          {nextUnlocked && nextStep && (
            <SecondaryButton onClick={() => flow.setViewStep(nextStep.key)} className="ml-auto min-w-0 max-w-[48%]" title={`Go to step ${index + 2}: ${nextStep.label}`}>
              <span className="truncate">{nextStep.label}</span> <ArrowRight className="w-4 h-4 shrink-0" />
            </SecondaryButton>
          )}
        </nav>
      )}
      {!flow.readOnly && <WelcomeBack idea={idea} />}
      <Headline
        art={STEP_ART[viewStep].image}
        eyebrow={`${config.phaseLabel} · Step ${index + 1} of ${steps.length}${meta.optional ? ' · Optional' : ''}`}
        title={meta.hint}
        subtitle={subtitle}
      />

      {prefilled && idea.sourceUseCase && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 animate-fade-in">
          <span className="text-ui-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pre-filled from</span>
          <UseCaseBadge uc={idea.sourceUseCase} />
          <span className="text-ui-sm text-muted-foreground">Check it looks right, then confirm.</span>
          {onChangeUseCase && (
            <button onClick={onChangeUseCase} className="ml-auto text-ui-sm font-medium text-primary hover:underline">Change use case</button>
          )}
        </div>
      )}

      {revising && !flow.readOnly && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 animate-fade-in" role="status">
          <History className="w-4 h-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-ui-sm text-muted-foreground">
            <span className="font-medium text-foreground">You changed {revising.label.toLowerCase()}.</span>{' '}
            Check each step after it, then approve the brief again.
            {hasBuild(idea) && ' Your build keeps working on the previous version until you choose Update build.'}
          </p>
        </div>
      )}

      {error && (flow.aiUnavailable && unavailable ? unavailable : (
        <div className="space-y-2">
          <ExpandableErrorBanner error={error} summary="Something went wrong talking to the AI." />
          <GhostButton onClick={retry} className="text-primary hover:!text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </GhostButton>
        </div>
      ))}

      {!canReach(idea, viewStep) && !hasOutput(idea, viewStep) ? (
        <p className="text-ui-base text-muted-foreground">Confirm the previous step first.</p>
      ) : stepLoading || (!showContent && !error) ? (
        <Thinking
          label={config.thinking[viewStep]}
          art={<JourneyThinkingArt step={viewStep} />}
          helper={THINKING_HELPER[viewStep]}
        />
      ) : showContent ? (
        <motion.div
          key={`${viewStep}-view`}
          initial={reduceMotion ? false : { opacity: 0, x: 16 * direction }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <StepView flow={flow} />
          {flow.readOnly ? (
            <ActionBar
              onBack={onBack}
              backLabel={backLabel}
              primary={index < steps.length - 1 && (
                <PrimaryButton size="lg" onClick={() => flow.setViewStep(next)}>
                  Next: {steps[index + 1].label} <ArrowRight className="w-4 h-4" />
                </PrimaryButton>
              )}
            />
          ) : !(viewStep === 'brief' && approved) && <StepActions
            canApprove={canApprove}
            approveLabel={approved && viewStep === 'brief' ? 'Approved' : config.approveLabel(viewStep, prefilled)}
            onApprove={() => flow.approve(viewStep)}
            onChange={fb => flow.run(viewStep, fb)}
            onChallenge={() => flow.challenge(viewStep)}
            challengeLabel={viewStep === 'impact' ? 'Pressure-test the numbers' : undefined}
            challenging={loading === 'challenge'}
            pushbacks={flow.pushbacks}
            onDismissPushbacks={flow.clearPushbacks}
            busy={!!loading && loading !== 'challenge'}
            approved={approved}
            onContinue={onContinue}
            continueLabel={nextStep ? `Next: ${nextStep.label}` : undefined}
            onBack={onBack}
            backLabel={backLabel}
            showKeyHint={idea.approved.length === 0}
            extra={canSkip && (
              <GhostButton onClick={flow.skipImpact}>
                Skip this step <SkipForward className="w-3.5 h-3.5" />
              </GhostButton>
            )}
          />}
          {!flow.readOnly && !loading && !(viewStep === 'brief' && approved) && (
            <div className="mt-6"><NextUpCard idea={idea} viewStep={viewStep} onGo={flow.setViewStep} /></div>
          )}
        </motion.div>
      ) : null}
    </div>
  );
}
