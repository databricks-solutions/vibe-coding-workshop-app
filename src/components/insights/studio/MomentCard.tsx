import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, Eye, Lock, RotateCcw, SkipForward, Undo2, Wand2 } from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { chapterOf, momentsIn, type Moment } from '../journey';
import { useMomentPrompt } from '../useMomentPrompt';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../journeykit';
import { UnderTheHood } from './UnderTheHood';

const WRITING_HINTS = [
  'Reading your questions',
  'Matching them to your data',
  'Adding guardrails so nothing changes without you',
  'Putting it in plain steps',
];

export interface MomentCardProps {
  moment: Moment;
  /** The build's steps, for the position within the chapter. */
  moments?: Moment[];
  tag: string;
  isDone: boolean;
  isSkipped?: boolean;
  lockedBy: Moment | null;
  assistantName: string;
  assistantLink?: string;
  industry: string;
  useCase: string;
  sessionId: string | null;
  savedPrompt?: string;
  previousOutputs?: Record<string, string>;
  readOnly: boolean;
  /** The step's prompt is missing or switched off, so it cannot be prepared right now. */
  unavailable?: boolean;
  onGenerated: (step: number, text: string) => void;
  onDone: () => void;
  onUndo: () => void;
  /** Offered on add-on steps, which the build can do without. */
  onSkip?: () => void;
  onBack?: () => void;
  onGoTo: (step: number) => void;
  /** Replaces the prompt action area (used by the setup moment). */
  customBody?: ReactNode;
}

export function MomentHeader({ moment, moments }: { moment: Moment; moments?: Moment[] }) {
  const chapter = chapterOf(moment.chapter);
  const siblings = momentsIn(moment.chapter, moments);
  const pos = siblings.findIndex(m => m.step === moment.step) + 1;
  const Icon = moment.icon;
  return (
    <header className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </span>
        <p className="text-ui-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{chapter.title}</span>
          <span className="mx-1.5 opacity-50">·</span>
          {pos} of {siblings.length}
          <span className="mx-1.5 opacity-50">·</span>
          about {moment.minutes} min
        </p>
      </div>
      <h2 className="mt-5 text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-foreground leading-tight">{moment.title}</h2>
      <p className="mt-2.5 text-ui-lg text-muted-foreground leading-relaxed max-w-2xl">{moment.sentence}</p>
    </header>
  );
}

export function WhatYoullSee({ text }: { text: string }) {
  return (
    <div className="mx-6 sm:mx-8 mb-6 flex items-start gap-3 rounded-2xl bg-secondary/40 px-4 py-3.5">
      <Eye className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <p className="text-ui-md text-foreground/90"><span className="font-medium">What you'll see: </span>{text}</p>
    </div>
  );
}

export function MomentFooter({ isDone, isSkipped, canFinish, readOnly, onDone, onUndo, onSkip, onBack, doneLabel = 'It worked, next' }: {
  isDone: boolean; isSkipped?: boolean; canFinish: boolean; readOnly: boolean; onDone: () => void; onUndo: () => void; onSkip?: () => void; onBack?: () => void; doneLabel?: string;
}) {
  return (
    <footer className="flex items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-border bg-secondary/20">
      <div>{onBack && <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>}</div>
      {readOnly ? (
        isDone ? <DoneBadge skipped={isSkipped} /> : <span className="text-ui-sm text-muted-foreground">Not done yet</span>
      ) : isDone ? (
        <div className="flex items-center gap-2">
          <GhostButton onClick={onUndo}><Undo2 className="w-3.5 h-3.5" /> {isSkipped ? 'Do this step' : 'Mark as not done'}</GhostButton>
          <PrimaryButton onClick={onDone}>Next <ArrowRight className="w-4 h-4" /></PrimaryButton>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {onSkip && <GhostButton onClick={onSkip} title="You can come back to it later"><SkipForward className="w-3.5 h-3.5" /> Skip for now</GhostButton>}
          <PrimaryButton onClick={onDone} disabled={!canFinish} title={canFinish ? undefined : 'Prepare and copy your instructions first'}>
            <Check className="w-4 h-4" /> {doneLabel}
          </PrimaryButton>
        </div>
      )}
    </footer>
  );
}

function DoneBadge({ skipped }: { skipped?: boolean }) {
  if (skipped) {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary text-muted-foreground text-ui-sm font-semibold">
        <SkipForward className="w-3.5 h-3.5" /> Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500/10 text-emerald-500 text-ui-sm font-semibold">
      <Check className="w-3.5 h-3.5" strokeWidth={3} /> Done
    </span>
  );
}

export function MomentCard(props: MomentCardProps) {
  const {
    moment, moments, tag, isDone, isSkipped, lockedBy, assistantName, assistantLink, industry, useCase, sessionId,
    savedPrompt, previousOutputs, readOnly, unavailable, onGenerated, onDone, onUndo, onSkip, onBack, onGoTo, customBody,
  } = props;
  const prompt = useMomentPrompt({ step: moment.step, tag, industry, useCase, sessionId, savedPrompt, previousOutputs, onGenerated });
  const { copied, handleCopy } = useCopyToClipboard();
  const [copiedOnce, setCopiedOnce] = useState(false);
  const [hint, setHint] = useState(0);
  const isCustom = !!customBody;

  useEffect(() => {
    if (prompt.status !== 'streaming') return;
    const t = setInterval(() => setHint(h => Math.min(h + 1, WRITING_HINTS.length - 1)), 2600);
    return () => clearInterval(t);
  }, [prompt.status]);

  const startGenerate = () => {
    setHint(0);
    setCopiedOnce(false);
    prompt.generate();
  };

  const copy = async () => {
    if (await handleCopy(prompt.text)) setCopiedOnce(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (readOnly) return;
      if (isDone || isCustom || (prompt.status === 'ready' && copiedOnce)) {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDone, isCustom, prompt.status, copiedOnce, onDone, readOnly]);

  const canFinish = isDone || prompt.status === 'ready';

  let body: ReactNode;
  if (customBody) {
    body = customBody;
  } else if (isSkipped && !prompt.text) {
    body = (
      <p className="rounded-2xl border border-dashed border-border p-5 text-ui-md text-muted-foreground">
        You skipped this step. The rest of the build works without it, and you can come back any time.
      </p>
    );
  } else if (unavailable && prompt.status !== 'ready') {
    body = (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-dashed border-border p-5">
        <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
        <p className="flex-1 text-ui-md text-muted-foreground">
          This step is not available in this workspace yet. Skip it for now; everything else still works.
        </p>
      </div>
    );
  } else if (lockedBy && !isDone && prompt.status !== 'ready') {
    body = (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-dashed border-border p-5">
        <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
        <p className="flex-1 text-ui-md text-muted-foreground">
          This builds on <span className="font-medium text-foreground">{lockedBy.title}</span>. Finish that first and this one unlocks.
        </p>
        <SecondaryButton onClick={() => onGoTo(lockedBy.step)}>Take me there</SecondaryButton>
      </div>
    );
  } else if (prompt.status === 'streaming') {
    body = (
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '250%' }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-4">
          <span className="relative flex w-10 h-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wand2 className="w-5 h-5 animate-pulse" />
          </span>
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={hint}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-ui-md font-medium text-foreground"
              >
                {prompt.retrying ? 'Taking a little longer than usual, still on it' : WRITING_HINTS[hint]}…
              </motion.p>
            </AnimatePresence>
            <p className="text-ui-sm text-muted-foreground tabular-nums">
              {prompt.text.length > 0 ? `${prompt.text.length.toLocaleString()} characters written` : 'Starting up'}
            </p>
          </div>
          <GhostButton onClick={prompt.cancel}>Cancel</GhostButton>
        </div>
      </div>
    );
  } else if (prompt.status === 'ready') {
    body = (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5 space-y-5">
        <div className="flex items-center gap-2 text-ui-md font-medium text-emerald-500">
          <Check className="w-4 h-4" strokeWidth={3} /> Your instructions are ready
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <PrimaryButton size="lg" onClick={copy} className={copied ? '!bg-emerald-600' : ''}>
            {copied ? <><Check className="w-4 h-4" strokeWidth={3} /> Copied</> : <><Copy className="w-4 h-4" /> Copy instructions</>}
          </PrimaryButton>
          {assistantLink && (
            <a href={assistantLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-12 px-5 rounded-xl border border-border bg-card text-ui-md font-medium text-foreground hover:bg-secondary/60 transition-colors">
              Open {assistantName} <ArrowRight className="w-4 h-4 -rotate-45" />
            </a>
          )}
          {!readOnly && (
            <GhostButton onClick={startGenerate} title="Write a fresh version">
              <RotateCcw className="w-3.5 h-3.5" /> Rewrite
            </GhostButton>
          )}
        </div>
        <ol className="grid sm:grid-cols-3 gap-3">
          {[
            `Open ${assistantName} in Agent mode`,
            'Paste and press Enter',
            'Answer its questions. It checks with you before creating anything.',
          ].map((t, i) => (
            <li key={t} className={`flex items-start gap-2.5 text-ui-sm transition-colors ${copiedOnce || i === 0 ? 'text-foreground/90' : 'text-muted-foreground'}`}>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-card border border-border text-ui-xs font-semibold shrink-0">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      </div>
    );
  } else if (prompt.status === 'error') {
    body = (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-5">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <p className="flex-1 text-ui-md text-foreground/90">{prompt.error || 'Something went wrong.'}</p>
        <SecondaryButton onClick={startGenerate}>Try again</SecondaryButton>
      </div>
    );
  } else {
    body = readOnly ? (
      <p className="rounded-2xl border border-dashed border-border p-5 text-ui-md text-muted-foreground">No instructions were prepared for this step yet.</p>
    ) : (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <PrimaryButton size="lg" onClick={startGenerate}>
          <Wand2 className="w-4 h-4" /> Prepare my instructions
        </PrimaryButton>
        <p className="text-ui-sm text-muted-foreground">Takes about 20 seconds. Written around your questions.</p>
      </div>
    );
  }

  return (
    <article className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <MomentHeader moment={moment} moments={moments} />
      <div className="px-6 sm:px-8 pb-6">{body}</div>
      <WhatYoullSee text={moment.whatYoullSee} />
      {!customBody && (
        <UnderTheHood tag={tag} skill={moment.skill} industry={industry} useCase={useCase} sessionId={sessionId} prompt={prompt.status === 'streaming' ? '' : prompt.text} />
      )}
      <MomentFooter
        isDone={isDone}
        isSkipped={isSkipped}
        canFinish={customBody ? true : canFinish && !unavailable}
        readOnly={readOnly}
        onDone={onDone}
        onUndo={onUndo}
        onSkip={onSkip}
        onBack={onBack}
        doneLabel={customBody ? 'It\'s set up, next' : undefined}
      />
    </article>
  );
}
