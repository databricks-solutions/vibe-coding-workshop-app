import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Circle, Copy, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { MOMENTS } from '../journey';
import { ProgressRing } from '../ui';

const GENIE_CREATED_STEP = 62;
const GENIE_TUNED_STEP = 66;

interface GenieCompanionProps {
  name: string;
  questions: string[];
  isDone: (step: number) => boolean;
  genieLink?: string;
}

type QuestionState = 'waiting' | 'learning' | 'ready';

function statusLine(done: number, genieCreated: boolean, tuned: boolean): string {
  if (done === 0) return 'Waiting to get started';
  if (tuned) return done === MOMENTS.length ? 'Live and ready to share' : 'Answering your questions';
  if (genieCreated) return 'Learning to answer';
  return 'Learning your business';
}

function QuestionRow({ q, state }: { q: string; state: QuestionState }) {
  const { copied, handleCopy } = useCopyToClipboard();
  return (
    <li className="group flex items-start gap-2.5 py-2">
      <span className="mt-0.5 shrink-0">
        {state === 'ready' ? (
          <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-emerald-500 text-white"><Check className="w-3 h-3" strokeWidth={3.5} /></span>
        ) : state === 'learning' ? (
          <Loader2 className="w-[18px] h-[18px] text-primary animate-spin [animation-duration:2.4s]" />
        ) : (
          <Circle className="w-[18px] h-[18px] text-border" />
        )}
      </span>
      <p className={`flex-1 text-ui-sm leading-snug ${state === 'waiting' ? 'text-muted-foreground' : 'text-foreground'}`}>{q}</p>
      {state !== 'waiting' && (
        <button
          onClick={() => handleCopy(q)}
          title="Copy, then ask it in your Genie"
          className="p-1 rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground hover:bg-secondary transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </li>
  );
}

export function GenieCompanion({ name, questions, isDone, genieLink }: GenieCompanionProps) {
  const [showAll, setShowAll] = useState(false);
  const doneMoments = MOMENTS.filter(m => isDone(m.step));
  const pct = doneMoments.length / MOMENTS.length;
  const genieCreated = isDone(GENIE_CREATED_STEP);
  const tuned = isDone(GENIE_TUNED_STEP);
  const qState: QuestionState = tuned ? 'ready' : genieCreated ? 'learning' : 'waiting';
  const unlocks = [...doneMoments].reverse();
  const visibleUnlocks = showAll ? unlocks : unlocks.slice(0, 4);

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-primary/[0.07] to-transparent">
        <ProgressRing value={pct} size={60}>
          <span className="text-ui-sm font-semibold tabular-nums text-foreground">{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-ui-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3 h-3 text-primary" /> Your Genie
          </p>
          <p className="text-ui-lg font-semibold text-foreground truncate">{name || 'Untitled Genie'}</p>
          <p className="text-ui-sm text-muted-foreground">{statusLine(doneMoments.length, genieCreated, tuned)}</p>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="px-5 pt-4 pb-2 border-t border-border">
          <p className="text-ui-sm font-semibold text-foreground">Can it answer yet?</p>
          <ul className="divide-y divide-border/50">
            {questions.map(q => <QuestionRow key={q} q={q} state={qState} />)}
          </ul>
          {genieCreated && (
            <p className="text-ui-xs text-muted-foreground pb-2">
              {tuned ? 'Copy any question and try it in your Genie.' : 'Your Genie exists. Try a question, it gets sharper as you go.'}
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-4 border-t border-border">
        <p className="text-ui-sm font-semibold text-foreground mb-2">It now…</p>
        {unlocks.length === 0 ? (
          <p className="text-ui-sm text-muted-foreground">Finish your first step to see what it can do.</p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {visibleUnlocks.map(m => (
                <motion.li
                  key={m.step}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 text-ui-sm text-foreground/90"
                >
                  <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" strokeWidth={3} />
                  {m.unlock}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {unlocks.length > 4 && (
          <button onClick={() => setShowAll(s => !s)} className="mt-2 text-ui-xs font-medium text-muted-foreground hover:text-foreground">
            {showAll ? 'Show less' : `Show all ${unlocks.length}`}
          </button>
        )}
      </div>

      {genieCreated && genieLink && (
        <a
          href={genieLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-5 py-3.5 border-t border-border text-ui-sm font-medium text-primary hover:bg-primary/[0.05] transition-colors"
        >
          Open your Genie <ArrowUpRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
