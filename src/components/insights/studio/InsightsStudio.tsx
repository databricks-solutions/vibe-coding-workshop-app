import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { DataSource } from '../brief';
import type { BlueprintChoice } from '../blueprint/types';
import { MOMENTS, blueprintMoment, formatMinutes, momentsIn, tagForMoment, type ChapterId } from '../journey';
import type { WorkspaceLinks } from '../types';
import { ChapterCelebration } from './ChapterCelebration';
import { ChapterRail } from './ChapterRail';
import { FinishScreen } from './FinishScreen';
import { GenieCompanion } from './GenieCompanion';
import { BlueprintInstallBody } from './BlueprintInstallBody';
import { MomentCard } from './MomentCard';
import { SetupBody } from './SetupBody';

interface InsightsStudioProps {
  name: string;
  questions: string[];
  dataSource: DataSource;
  blueprint?: BlueprintChoice | null;
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
  onSwitchToTechnical: () => void;
}

export function InsightsStudio(props: InsightsStudioProps) {
  const {
    name, questions, dataSource, blueprint, industry, useCase, sessionId, currentUser, codingAssistant, assistantName,
    links, readOnly, stepPrompts, completedSteps, skippedSteps, onStepPromptGenerated, onCompletedStepsChange, onSwitchToTechnical,
  } = props;

  const isDone = useCallback((step: number) => completedSteps.has(step) || skippedSteps.has(step), [completedSteps, skippedSteps]);
  const firstOpenIdx = MOMENTS.findIndex(m => !isDone(m.step));
  const allDone = firstOpenIdx === -1;
  const reachableUpTo = allDone ? MOMENTS.length - 1 : firstOpenIdx;

  const [activeStep, setActiveStep] = useState<number>(() => (allDone ? MOMENTS[MOMENTS.length - 1].step : MOMENTS[firstOpenIdx].step));
  const [showFinish, setShowFinish] = useState(allDone);
  const [celebrating, setCelebrating] = useState<ChapterId | null>(null);
  const [pendingFinish, setPendingFinish] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const activeIdx = MOMENTS.findIndex(m => m.step === activeStep);
  const moment = MOMENTS[activeIdx];
  const nextMoment = MOMENTS.slice(activeIdx + 1).find(m => !isDone(m.step));
  const prevMoment = activeIdx > 0 ? MOMENTS[activeIdx - 1] : undefined;
  const lockedBy = activeIdx > 0 && !isDone(MOMENTS[activeIdx - 1].step) ? MOMENTS[activeIdx - 1] : null;
  const minutesLeft = MOMENTS.filter(m => !isDone(m.step)).reduce((s, m) => s + m.minutes, 0);

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

  const markDone = useCallback(() => {
    if (readOnly) return;
    if (isDone(moment.step)) {
      const next = MOMENTS.slice(activeIdx + 1).find(m => !isDone(m.step)) ?? MOMENTS[activeIdx + 1];
      if (next) goTo(next.step);
      else setShowFinish(true);
      return;
    }
    const nextSet = new Set(completedSteps);
    nextSet.add(moment.step);
    onCompletedStepsChange(nextSet);

    const doneAfter = (step: number) => nextSet.has(step) || skippedSteps.has(step);
    const chapterComplete = momentsIn(moment.chapter).every(m => doneAfter(m.step));
    const next = MOMENTS.find(m => !doneAfter(m.step));
    if (chapterComplete) setCelebrating(moment.chapter);
    if (next) goTo(next.step);
    else if (chapterComplete) setPendingFinish(true);
    else setShowFinish(true);
  }, [readOnly, isDone, moment, activeIdx, completedSteps, skippedSteps, onCompletedStepsChange, goTo]);

  const undo = useCallback(() => {
    if (readOnly) return;
    const nextSet = new Set(completedSteps);
    nextSet.delete(moment.step);
    onCompletedStepsChange(nextSet);
  }, [readOnly, completedSteps, moment, onCompletedStepsChange]);

  const previousOutputs = useMemo(() => {
    if (moment.tag !== 'gaccel_dashboard') return undefined;
    return {
      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
      ...(stepPrompts[60] ? { metric_view: stepPrompts[60] } : {}),
    };
  }, [moment.tag, stepPrompts]);

  if (showFinish) {
    return (
      <FinishScreen
        name={name}
        questions={questions}
        links={links}
        onRevisit={() => goTo(MOMENTS[0].step)}
        onSwitchToTechnical={onSwitchToTechnical}
      />
    );
  }

  const tag = tagForMoment(moment, dataSource);
  const isSetup = moment.kind === 'setup';
  const bp = dataSource === 'blueprint' ? blueprint ?? null : null;
  const isBlueprintStep = !!bp && moment.tag === 'semlayer_locate';
  const relabel = <T extends typeof moment | null | undefined>(m: T): T => (bp && m ? blueprintMoment(m, bp.label) as T : m);
  const shownMoment = relabel(moment);

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
        <ChapterRail activeStep={activeStep} isDone={isDone} reachableUpTo={reachableUpTo} onSelect={goTo} />
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
                tag={tag}
                isDone={isDone(moment.step)}
                lockedBy={relabel(lockedBy)}
                assistantName={assistantName}
                assistantLink={links.home}
                industry={industry}
                useCase={useCase}
                sessionId={sessionId}
                savedPrompt={stepPrompts[moment.step]}
                previousOutputs={previousOutputs}
                readOnly={readOnly}
                onGenerated={onStepPromptGenerated}
                onDone={markDone}
                onUndo={undo}
                onBack={prevMoment ? () => goTo(prevMoment.step) : undefined}
                onGoTo={goTo}
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
          <GenieCompanion name={name} questions={questions} isDone={isDone} genieLink={links.genie} />
        </aside>
      </div>

      <AnimatePresence>
        {celebrating && <ChapterCelebration chapterId={celebrating} onClose={closeCelebration} />}
      </AnimatePresence>
    </div>
  );
}
