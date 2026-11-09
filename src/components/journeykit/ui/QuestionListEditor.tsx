import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, CornerDownLeft, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { VoiceTextarea } from './VoiceTextarea';
import type { QuestionDetail, QuestionKind, QuestionSource } from '../engine/types';

const KIND_BADGE: Record<QuestionKind, { label: string; className: string }> = {
  look_back: { label: 'Look back', className: 'bg-secondary text-muted-foreground' },
  track_live: { label: 'Track live', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  look_ahead: { label: 'Look ahead', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  what_to_do: { label: 'What to do', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const PLACEHOLDERS = [
  'Which stores missed their sales target last week?',
  'How many claims are still open past 30 days?',
  'What drove the jump in returns this month?',
  'Which customers are most likely to churn?',
];

function encouragement(n: number): string {
  if (n === 0) return 'Start with the one question you get asked most.';
  if (n === 1) return 'Nice. Two or three more makes it much smarter.';
  if (n === 2) return 'Good start. One more and you are in great shape.';
  if (n < 5) return 'Great set of questions.';
  if (n < 6) return 'Strong set. One more reaches the recommended set.';
  return 'Recommended set complete. Add another only if it covers a missing decision.';
}

const SOURCE_TAG: Partial<Record<QuestionSource, { label: string; icon: typeof Sparkles; className: string }>> = {
  use_case: { label: 'From use case', icon: BadgeCheck, className: 'text-primary' },
  ai: { label: 'Suggested', icon: Sparkles, className: 'text-amber-600 dark:text-amber-400' },
};

interface QuestionListEditorProps {
  questions: string[];
  onChange: (questions: string[]) => void;
  max: number;
  sources?: Record<string, QuestionSource>;
  /** Optional decision metadata per question (v2). */
  details?: Record<string, QuestionDetail>;
  /** One-tap additions shown under the list. */
  suggestions?: string[];
  /** Heading above the one-tap additions. */
  suggestionsLabel?: string;
  autoFocus?: boolean;
  validating?: Set<string>;
  onUseClearer?: (question: string, clearer: string) => void;
  onKindChange?: (question: string, kind: QuestionKind) => void;
}

/** Numbered, animated list of plain-English questions with voice input. */
export function QuestionListEditor({
  questions, onChange, max, sources = {}, details, suggestions = [], suggestionsLabel, autoFocus = false,
  validating = new Set(), onUseClearer, onKindChange,
}: QuestionListEditorProps) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(autoFocus || questions.length === 0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const full = questions.length >= max;
  const open = suggestions.filter(s => !questions.includes(s));

  useEffect(() => {
    if (draft) return;
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [draft]);

  const add = (text: string) => {
    const incoming = text
      .split('\n')
      .map(s => s.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
      .filter(q => !questions.includes(q));
    if (incoming.length === 0) return;
    onChange([...questions, ...incoming].slice(0, max));
  };

  const commitDraft = () => {
    if (!draft.trim() || full) return;
    add(draft);
    setDraft('');
    setAdding(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {questions.map((q, i) => {
            const tag = SOURCE_TAG[sources[q] ?? 'you'];
            const detail = details?.[q];
            const kindBadge = detail?.kind ? KIND_BADGE[detail.kind] : undefined;
            return (
              <motion.div
                key={q}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ duration: 0.25 }}
                className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${sources[q] === 'ai' ? 'border-amber-400/30 bg-amber-400/[0.04]' : 'border-border bg-card'}`}
              >
                <span className="flex items-center justify-center w-7 h-7 mt-0.5 rounded-full bg-primary/10 text-primary text-ui-sm font-semibold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-ui-md text-foreground">{q}</p>
                  {detail?.drivesAction && (
                    <p className="text-ui-xs text-muted-foreground mt-0.5 leading-snug">
                      <span className="text-foreground/75 font-medium">Drives action:</span> {detail.drivesAction}
                    </p>
                  )}
                  {validating.has(q) && (
                    <p className="flex items-center gap-1.5 text-ui-xs text-primary mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Validating category, action, and measures…
                    </p>
                  )}
                  {!validating.has(q) && detail?.validationMessage && (
                    <p className="text-ui-xs text-muted-foreground mt-1">{detail.validationMessage}</p>
                  )}
                  {!validating.has(q) && detail?.clearerQuestion && onUseClearer && (
                    <button onClick={() => onUseClearer(q, detail.clearerQuestion!)} className="mt-1 text-left text-ui-xs font-medium text-primary hover:underline">
                      Use clearer wording: “{detail.clearerQuestion}”
                    </button>
                  )}
                  {(!!detail?.metrics?.length || !!detail?.dimensions?.length) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {detail.metrics?.map(metric => (
                        <span key={`metric-${metric}`} className="rounded-full bg-teal-500/10 px-2 py-0.5 text-ui-2xs text-teal-700 dark:text-teal-300">
                          Measure · {metric}
                        </span>
                      ))}
                      {detail.dimensions?.map(dimension => (
                        <span key={`dimension-${dimension}`} className="rounded-full bg-secondary px-2 py-0.5 text-ui-2xs text-muted-foreground">
                          Grain · {dimension}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {kindBadge && (onKindChange ? (
                  <select
                    value={detail!.kind}
                    onChange={e => onKindChange(q, e.target.value as QuestionKind)}
                    aria-label={`Category for question ${i + 1}`}
                    className={`hidden sm:block rounded-full border-0 px-2 py-0.5 text-ui-2xs font-medium shrink-0 mt-1 outline-none ${kindBadge.className}`}
                  >
                    {Object.entries(KIND_BADGE).map(([kind, meta]) => <option key={kind} value={kind}>{meta.label}</option>)}
                  </select>
                ) : (
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-ui-2xs font-medium shrink-0 mt-1 ${kindBadge.className}`}>{kindBadge.label}</span>
                ))}
                {tag && (
                  <span className={`hidden sm:inline-flex items-center gap-1 text-ui-2xs font-medium shrink-0 mt-1.5 ${tag.className}`}>
                    <tag.icon className="w-3 h-3" /> {tag.label}
                  </span>
                )}
                <button
                  onClick={() => onChange(questions.filter(x => x !== q))}
                  className="p-1.5 rounded-lg text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary hover:text-foreground transition-all shrink-0"
                  aria-label={`Remove question ${i + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div className="flex flex-wrap items-center justify-between gap-2 pl-1">
          <p className="text-ui-sm text-muted-foreground">{encouragement(questions.length)}</p>
          <span className="text-ui-xs font-medium text-muted-foreground">{questions.length} selected · 3–6 recommended · {max} maximum</span>
        </div>
      </div>

      {adding && !full ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.03] p-3">
          <p className="text-ui-sm font-semibold text-foreground mb-2">Add your own question</p>
          <div
            onKeyDownCapture={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                commitDraft();
              }
            }}
            className="relative"
          >
            <VoiceTextarea
              ref={inputRef}
              value={draft}
              onChange={setDraft}
              size="lg"
              rows={2}
              autoFocus
              placeholder={`Ask it naturally, e.g. "${PLACEHOLDERS[placeholderIdx]}"`}
              className="rounded-2xl shadow-sm"
            />
            <button type="button" onClick={commitDraft} disabled={!draft.trim()} className="absolute right-16 bottom-3 flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-primary-foreground text-ui-sm font-semibold disabled:opacity-40 hover:opacity-90">
              Add question <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => { setAdding(false); setDraft(''); }} className="mt-2 px-2 py-1 text-ui-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : full ? (
        <p className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-ui-sm text-muted-foreground">
          Maximum of {max} questions reached. Remove one to add a different question.
        </p>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-primary/30 bg-primary/[0.04] text-ui-sm font-semibold text-primary hover:bg-primary/10">
          <Plus className="w-4 h-4" /> Add another question
        </button>
      )}

      {open.length > 0 && !full && (
        <div className="flex flex-col gap-1">
          {suggestionsLabel && <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground px-3 mb-0.5">{suggestionsLabel}</p>}
          {open.map(s => (
            <button
              key={s}
              onClick={() => add(s)}
              className="flex items-center gap-2 text-left px-3 py-2 rounded-xl text-ui-md text-foreground/90 hover:bg-secondary/50 transition-colors"
            >
              <Plus className="w-4 h-4 text-primary shrink-0" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
