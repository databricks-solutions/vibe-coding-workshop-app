import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { getPreviousOutputsForStep } from '../../../utils/stepPreviousOutputs';
import type { DataSource } from '../brief';
import type { BlueprintChoice } from '../blueprint/types';
import { MOMENTS, dataSourceMoment, formatMinutes, momentsIn, tagForMoment, type ChapterId, type Moment } from '../journey';
import { addOnOf, useTagAvailability, type AddOn } from '../recipes';
import type { WorkspaceLinks } from '../types';
import { ChapterCelebration } from './ChapterCelebration';
import { ChapterRail } from './ChapterRail';
import { FinishScreen } from './FinishScreen';
import { GenieCompanion } from './GenieCompanion';
import { BlueprintInstallBody } from './BlueprintInstallBody';
import { MomentCard } from './MomentCard';
import { SchemaUploadBody } from './SchemaUploadBody';
import { SetupBody } from './SetupBody';

interface InsightsStudioProps {
  name: string;
  questions: string[];
  dataSource: DataSource;
  blueprint?: BlueprintChoice | null;
  /** The build's steps; the core Genie Accelerator list unless add-ons were chosen. */
  moments?: Moment[];
  addOns?: AddOn[];
  industry: string;
  useCase: string;
  sessionId: string | null;
  currentUser: string;
  codingAssistant: string | null;
  assistantName: string;
  links: WorkspaceLinks;
  readOnly: boolean;
  stepPrompts: Record<number, string>;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  onStepPromptGenerated: (step: number, text: string) => void;
  onCompletedStepsChange: (steps: Set<number>) => void;
  onSkippedStepsChange?: (steps: Set<number>) => void;
  onSwitchToTechnical: () => void;
}

const NO_GOLD_TARGET = { catalog: '', schema: '', prefix: '' };

export function InsightsStudio(props: InsightsStudioProps) {
  const {
    name, questions, dataSource, blueprint, moments = MOMENTS, addOns = [], industry, useCase, sessionId, currentUser, codingAssistant, assistantName,
    links, readOnly, stepPrompts, completedSteps, skippedSteps, onStepPromptGenerated, onCompletedStepsChange, onSkippedStepsChange, onSwitchToTechnical,
  } = props;
  const availability = useTagAvailability();

  const isDone = useCallback((step: number) => completedSteps.has(step) || skippedSteps.has(step), [completedSteps, skippedSteps]);
  const firstOpenIdx = moments.findIndex(m => !isDone(m.step));
  const allDone = firstOpenIdx === -1;
  const reachableUpTo = allDone ? moments.length - 1 : firstOpenIdx;

  const [activeStep, setActiveStep] = useState<number>(() => (allDone ? moments[moments.length - 1].step : moments[firstOpenIdx].step));
  const [showFinish, setShowFinish] = useState(allDone);
  const [celebrating, setCelebrating] = useState<ChapterId | null>(null);
  const [pendingFinish, setPendingFinish] = useState(false);
  const [schemaUploadReady, setSchemaUploadReady] = useState(() => !!stepPrompts[57]?.trim());
  const topRef = useRef<HTMLDivElement>(null);

  const foundIdx = moments.findIndex(m => m.step === activeStep);
  const activeIdx = foundIdx === -1 ? 0 : foundIdx;
  const moment = moments[activeIdx];
  const nextMoment = moments.slice(activeIdx + 1).find(m => !isDone(m.step));
  const prevMoment = activeIdx > 0 ? moments[activeIdx - 1] : undefined;
  const lockedBy = activeIdx > 0 && !isDone(moments[activeIdx - 1].step) ? moments[activeIdx - 1] : null;
  const minutesLeft = moments.filter(m => !isDone(m.step)).reduce((s, m) => s + m.minutes, 0);

  const goTo = useCallback((step: number) => {
    setActiveStep(step);
    setShowFinish(false);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const closeCelebration = useCallback(() => {
    setCelebrating(null);
    if (pendingFinish) {
      setPendingFinish(false);
      setShowFinish(true);
    }
  }, [pendingFinish]);

  /** Moves on once the current step counts as done, celebrating a finished chapter. */
  const advance = useCallback((doneAfter: (step: number) => boolean) => {
    const chapterComplete = momentsIn(moment.chapter, moments).every(m => doneAfter(m.step));
    const next = moments.find(m => !doneAfter(m.step));
    if (chapterComplete) setCelebrating(moment.chapter);
    if (next) goTo(next.step);
    else if (chapterComplete) setPendingFinish(true);
    else setShowFinish(true);
  }, [moment, moments, goTo]);

  const markDone = useCallback(() => {
    if (readOnly) return;
    if (isDone(moment.step)) {
      const next = moments.slice(activeIdx + 1).find(m => !isDone(m.step)) ?? moments[activeIdx + 1];
      if (next) goTo(next.step);
      else setShowFinish(true);
      return;
    }
    const nextSet = new Set(completedSteps);
    nextSet.add(moment.step);
    onCompletedStepsChange(nextSet);
    advance(step => nextSet.has(step) || skippedSteps.has(step));
  }, [readOnly, isDone, moment, moments, activeIdx, completedSteps, skippedSteps, onCompletedStepsChange, goTo, advance]);

  const skip = useCallback(() => {
    if (readOnly || !onSkippedStepsChange || !moment.optional || isDone(moment.step)) return;
    const nextSkipped = new Set(skippedSteps);
    nextSkipped.add(moment.step);
    onSkippedStepsChange(nextSkipped);
    advance(step => completedSteps.has(step) || nextSkipped.has(step));
  }, [readOnly, onSkippedStepsChange, moment, isDone, skippedSteps, completedSteps, advance]);

  const undo = useCallback(() => {
    if (readOnly) return;
    if (completedSteps.has(moment.step)) {
      const nextSet = new Set(completedSteps);
      nextSet.delete(moment.step);
      onCompletedStepsChange(nextSet);
    }
    if (skippedSteps.has(moment.step) && onSkippedStepsChange) {
      const nextSkipped = new Set(skippedSteps);
      nextSkipped.delete(moment.step);
      onSkippedStepsChange(nextSkipped);
    }
  }, [readOnly, completedSteps, skippedSteps, moment, onCompletedStepsChange, onSkippedStepsChange]);

  const previousOutputs = useMemo(() => {
    if (moment.tag === 'gaccel_dashboard' || moment.tag === 'insights_alerts') {
      return {
        ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
        ...(stepPrompts[60] ? { metric_view: stepPrompts[60] } : {}),
      };
    }
    if (!addOnOf(moment)) return undefined;
    return getPreviousOutputsForStep(moment.step, stepPrompts, { goldTableTarget: NO_GOLD_TARGET, workshopLevel: 'genie-accelerator' });
  }, [moment, stepPrompts]);

  if (showFinish) {
    return (
      <FinishScreen
        name={name}
        questions={questions}
        links={links}
        addOns={addOns}
        onRevisit={() => goTo(moments[0].step)}
        onSwitchToTechnical={onSwitchToTechnical}
      />
    );
  }

  const tag = tagForMoment(moment, dataSource);
  const isSetup = moment.kind === 'setup';
  const bp = dataSource === 'blueprint' ? blueprint ?? null : null;
  const isBlueprintStep = !!bp && moment.tag === 'semlayer_locate';
  const isSchemaUploadStep = dataSource === 'upload' && moment.tag === 'semlayer_locate';
  const relabel = <T extends typeof moment | null | undefined>(m: T): T => (
    m ? dataSourceMoment(m, dataSource, bp?.label) as T : m
  );
  const shownMoment = relabel(moment);
  const canSkip = !!moment.optional && !!onSkippedStepsChange;
  const unavailable = !!addOnOf(moment) && availability.loaded && availability.known && !availability.has(tag);

  return (
    <div ref={topRef} className="max-w-6xl mx-auto py-2 sm:py-4 space-y-6 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary">Insights</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground truncate">{name || 'Your Genie'}</h1>
        </div>
        <p className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {minutesLeft === 0 ? 'All done' : `About ${formatMinutes(minutesLeft)} left`}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur px-4 sm:px-5 py-4">
        <ChapterRail moments={moments} activeStep={moment.step} isDone={isDone} reachableUpTo={reachableUpTo} onSelect={goTo} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-3 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={moment.step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <MomentCard
                moment={shownMoment}
                moments={moments}
                tag={tag}
                isDone={isDone(moment.step)}
                isSkipped={!!moment.optional && skippedSteps.has(moment.step)}
                lockedBy={relabel(lockedBy)}
                assistantName={assistantName}
                assistantLink={links.home}
                industry={industry}
                useCase={useCase}
                sessionId={sessionId}
                savedPrompt={stepPrompts[moment.step]}
                previousOutputs={previousOutputs}
                readOnly={readOnly}
                unavailable={unavailable}
                onGenerated={onStepPromptGenerated}
                onDone={markDone}
                onUndo={undo}
                onSkip={canSkip ? skip : undefined}
                onBack={prevMoment ? () => goTo(prevMoment.step) : undefined}
                onGoTo={goTo}
                customBodyReady={!isSchemaUploadStep || schemaUploadReady}
                customDoneLabel={isSchemaUploadStep ? 'Instructions ready, next' : undefined}
                customBody={isSetup ? (
                  <SetupBody
                    codingAssistant={codingAssistant}
                    currentUser={currentUser}
                    isDone={isDone(moment.step)}
                    onDone={markDone}
                    onUndo={undo}
                    sessionId={sessionId}
                    useCaseLabel={name}
                  />
                ) : isSchemaUploadStep ? (
                  <SchemaUploadBody
                    sessionId={sessionId}
                    industry={industry}
                    useCase={useCase}
                    step={moment.step}
                    savedPrompt={stepPrompts[moment.step]}
                    previousStepComplete={!lockedBy}
                    readOnly={readOnly}
                    onGenerated={onStepPromptGenerated}
                    onReadyChange={setSchemaUploadReady}
                  />
                ) : isBlueprintStep && bp ? (
                  <BlueprintInstallBody
                    blueprint={bp}
                    questions={questions}
                    currentUser={currentUser}
                    links={links}
                    readOnly={readOnly}
                    onPromptReady={text => { if (!readOnly && text !== stepPrompts[moment.step]) onStepPromptGenerated(moment.step, text); }}
                  />
                ) : undefined}
              />
            </motion.div>
          </AnimatePresence>
          {nextMoment && nextMoment.step !== moment.step && (
            <p className="px-2 text-ui-sm text-muted-foreground">
              Up next: <span className="font-medium text-foreground/80">{relabel(nextMoment).title}</span>
              <span className="mx-1.5 opacity-50">·</span>{nextMoment.minutes} min
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <GenieCompanion moments={moments} name={name} questions={questions} isDone={isDone} isSkipped={step => skippedSteps.has(step) && !completedSteps.has(step)} genieLink={links.genie} />
        </aside>
      </div>

      <AnimatePresence>
        {celebrating && <ChapterCelebration chapterId={celebrating} onClose={closeCelebration} />}
      </AnimatePresence>
    </div>
  );
}
