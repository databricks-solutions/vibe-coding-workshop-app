import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CornerDownLeft, Lightbulb, PenLine, Plus, Route, X } from 'lucide-react';
import { openPathComparison } from '../pathEvents';
import { CertifiedBadge } from '../../CertifiedBadge';
import { VoiceTextarea } from '../../ideate/VoiceTextarea';
import { BlueprintSuggestions } from '../blueprint/BlueprintSuggestions';
import { UseCasePicker } from '../usecases/UseCasePicker';
import type { ApprovedUseCase } from '../usecases/useCaseApi';
import { INDUSTRY_IDEAS, QUESTION_PLACEHOLDERS } from '../journey';
import { FadeIn, GhostButton, Headline, OnboardingProgress, PrimaryButton } from '../ui';

const MAX_QUESTIONS = 6;

interface AskScreenProps {
  questions: string[];
  onQuestionsChange: (q: string[]) => void;
  industryId: string;
  onIndustryChange: (id: string) => void;
  onNext: () => void;
  replacingExisting: boolean;
  useCase: ApprovedUseCase | null;
  onUseCaseApply: (uc: ApprovedUseCase, questions: string[]) => void;
  onUseCaseClear: () => void;
}

type AskMode = 'write' | 'approved';

function encouragement(n: number): string {
  if (n === 0) return 'Start with the one question you get asked most.';
  if (n === 1) return 'Nice. Two or three more makes it much smarter.';
  if (n === 2) return 'Good start. One more and you are in great shape.';
  if (n < 5) return 'Great set of questions.';
  return 'Perfect. That is plenty to build on.';
}

export function AskScreen({ questions, onQuestionsChange, industryId, onIndustryChange, onNext, replacingExisting, useCase, onUseCaseApply, onUseCaseClear }: AskScreenProps) {
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<AskMode>('write');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const full = questions.length >= MAX_QUESTIONS;
  const industry = INDUSTRY_IDEAS.find(i => i.id === industryId);
  const suggestions = (industry?.questions ?? []).filter(q => !questions.includes(q));

  useEffect(() => {
    if (draft) return;
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % QUESTION_PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [draft]);

  const add = (text: string) => {
    const incoming = text
      .split('\n')
      .map(s => s.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
      .filter(q => !questions.includes(q));
    if (incoming.length === 0) return;
    onQuestionsChange([...questions, ...incoming].slice(0, MAX_QUESTIONS));
  };

  const commitDraft = () => {
    if (!draft.trim() || full) return;
    add(draft);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto px-1 py-6 sm:py-10 space-y-8">
      <FadeIn className="flex items-center justify-between">
        <OnboardingProgress index={0} />
        <button onClick={openPathComparison} className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground hover:text-foreground transition-colors">
          <Route className="w-4 h-4" /> <span className="hidden sm:inline">Insights or Technical?</span> Compare paths
        </button>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Headline
          eyebrow="Insights"
          title="What do you want to know?"
          subtitle="Write the questions you wish you could just ask your data. We'll turn them into a Genie your team can chat with, plus a dashboard to match."
        />
      </FadeIn>

      <FadeIn delay={0.08}>
        <div role="tablist" aria-label="How to start" className="inline-flex p-1 rounded-xl bg-secondary/50 border border-border/60">
          {([
            { id: 'write', label: 'Write my own', icon: PenLine },
            { id: 'approved', label: 'Start from an approved use case', icon: BadgeCheck },
          ] as const).map(opt => {
            const on = mode === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={on}
                onClick={() => setMode(opt.id)}
                className={`flex items-center gap-2 h-9 px-3.5 rounded-lg border text-ui-sm font-medium transition-all ${on ? 'bg-card text-foreground shadow-sm border-border/70' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className={`w-4 h-4 ${on && opt.id === 'approved' ? 'text-primary' : ''}`} />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.id === 'write' ? 'Write' : 'Approved'}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {mode === 'approved' && (
        <FadeIn className="space-y-2">
          <p className="text-ui-md text-muted-foreground">Start from a sample or a use case your workshop team has approved. See who it serves, the data it covers and the questions it was built to answer.</p>
          <UseCasePicker
            insightsIndustryId={industryId}
            selected={useCase}
            room={MAX_QUESTIONS - questions.length}
            onApply={(uc, qs) => { onUseCaseApply(uc, qs); setMode('write'); }}
          />
        </FadeIn>
      )}

      <FadeIn delay={0.1} className="space-y-4">
        {useCase && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.05] px-4 py-3">
            {useCase.certified ? <CertifiedBadge size="sm" /> : <BadgeCheck className="w-5 h-5 text-primary shrink-0" />}
            <p className="flex-1 min-w-0 text-ui-md text-foreground">
              Based on the approved use case <span className="font-semibold">{useCase.label}</span>
              <span className="text-muted-foreground"> · {useCase.industryLabel}</span>
            </p>
            <button onClick={() => setMode('approved')} className="text-ui-sm font-medium text-primary hover:underline shrink-0">Change</button>
            <button onClick={onUseCaseClear} aria-label="Unlink approved use case" className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div
          hidden={mode !== 'write'}
          onKeyDownCapture={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
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
            placeholder={full ? 'That is plenty to start with' : QUESTION_PLACEHOLDERS[placeholderIdx]}
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

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {questions.map((q, i) => (
              <motion.div
                key={q}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ duration: 0.25 }}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-ui-sm font-semibold shrink-0">{i + 1}</span>
                <p className="flex-1 text-ui-md text-foreground">{q}</p>
                <button
                  onClick={() => onQuestionsChange(questions.filter(x => x !== q))}
                  className="p-1.5 rounded-lg text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                  aria-label={`Remove question ${i + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {(mode === 'write' || questions.length > 0) && <p className="text-ui-sm text-muted-foreground pl-1">{encouragement(questions.length)}</p>}
        </div>
      </FadeIn>

      {mode === 'write' && <FadeIn delay={0.15} className="rounded-2xl bg-secondary/30 border border-border/60 p-4 sm:p-5 space-y-3">
        <p className="flex items-center gap-2 text-ui-md font-medium text-foreground">
          <Lightbulb className="w-4 h-4 text-amber-400" /> Need ideas? Pick your industry
        </p>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_IDEAS.map(ind => (
            <button
              key={ind.id}
              onClick={() => onIndustryChange(industryId === ind.id ? '' : ind.id)}
              className={`h-8 px-3 rounded-full text-ui-sm font-medium border transition-all ${
                industryId === ind.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {industry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-1.5 overflow-hidden"
            >
              {suggestions.map(s => (
                <button
                  key={s}
                  disabled={full}
                  onClick={() => add(s)}
                  className="flex items-center gap-2 text-left px-3 py-2 rounded-xl text-ui-md text-foreground/90 hover:bg-card transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 text-primary shrink-0" /> {s}
                </button>
              ))}
              <BlueprintSuggestions industryId={industry.id} exclude={questions} disabled={full} onAdd={add} />
            </motion.div>
          )}
        </AnimatePresence>
      </FadeIn>}

      <FadeIn delay={0.2} className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <p className="text-ui-sm text-muted-foreground">
          {replacingExisting ? 'This replaces the idea saved in your current project.' : 'You can change these later.'}
        </p>
        <div className="flex items-center gap-2">
          {draft.trim() && !full && <GhostButton onClick={commitDraft}>Add this one</GhostButton>}
          <PrimaryButton size="lg" disabled={questions.length === 0} onClick={onNext}>
            Next: your data <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>
      </FadeIn>
    </div>
  );
}
