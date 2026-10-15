import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, CornerDownLeft, Plus, Sparkles, X } from 'lucide-react';
import { VoiceTextarea } from './VoiceTextarea';
import type { QuestionSource } from '../engine/types';

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
  return 'Perfect. That is plenty to build on.';
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
  /** One-tap additions shown under the list. */
  suggestions?: string[];
  /** Heading above the one-tap additions. */
  suggestionsLabel?: string;
  autoFocus?: boolean;
}

/** Numbered, animated list of plain-English questions with voice input. */
export function QuestionListEditor({ questions, onChange, max, sources = {}, suggestions = [], suggestionsLabel, autoFocus = false }: QuestionListEditorProps) {
  const [draft, setDraft] = useState('');
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
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {questions.map((q, i) => {
            const tag = SOURCE_TAG[sources[q] ?? 'you'];
            return (
              <motion.div
                key={q}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ duration: 0.25 }}
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${sources[q] === 'ai' ? 'border-amber-400/30 bg-amber-400/[0.04]' : 'border-border bg-card'}`}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-ui-sm font-semibold shrink-0">{i + 1}</span>
                <p className="flex-1 text-ui-md text-foreground">{q}</p>
                {tag && (
                  <span className={`hidden sm:inline-flex items-center gap-1 text-ui-2xs font-medium ${tag.className}`}>
                    <tag.icon className="w-3 h-3" /> {tag.label}
                  </span>
                )}
                <button
                  onClick={() => onChange(questions.filter(x => x !== q))}
                  className="p-1.5 rounded-lg text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                  aria-label={`Remove question ${i + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <p className="text-ui-sm text-muted-foreground pl-1">{encouragement(questions.length)}</p>
      </div>

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
          autoFocus={autoFocus}
          placeholder={full ? 'That is plenty to start with' : `Add a question, e.g. "${PLACEHOLDERS[placeholderIdx]}"`}
          className="rounded-2xl shadow-sm"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={!draft.trim() || full}
          className="absolute right-16 bottom-3 flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-primary-foreground text-ui-sm font-semibold transition-all disabled:opacity-0 disabled:pointer-events-none hover:opacity-90"
        >
          Add <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </div>

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
