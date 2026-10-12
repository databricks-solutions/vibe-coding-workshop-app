import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Lightbulb, PenLine } from 'lucide-react';
import {
  ART, DURATION, EASE, FadeIn, Headline, MAX_GENIE_QUESTIONS, PathCard, PrimaryButton, VoiceTextarea, ideaMinutes,
} from '../../journeykit';
import { INDUSTRY_IDEAS } from '../journey';
import { UseCasePicker } from '../usecases/UseCasePicker';
import type { ApprovedUseCase, UseCasePreview } from '../usecases/useCaseApi';

export type StartPath = 'approved' | 'own';

const IDEA_EXAMPLES: Record<string, string> = {
  retail: 'Store managers keep asking which promotions actually lifted sales, and it takes a week to pull the numbers.',
  financial_services: 'Relationship managers want to know which clients are drifting away before they move their money.',
  healthcare: 'Clinic leads want to see where appointment no-shows are rising and why, without waiting on a report.',
  manufacturing: 'Plant managers want to spot which lines are losing the most time to unplanned stops this month.',
  media_telecom: 'The retention team wants to know which subscribers are likely to cancel and what would keep them.',
  travel_hospitality: 'Revenue managers want a quick read on which routes or properties are under-booked for next month.',
};

const PATHS = {
  approved: {
    icon: BadgeCheck,
    title: 'Start from an approved use case',
    body: 'Pick a use case your workshop team has approved. Your idea and its questions start filled in; you check each step.',
    tag: 'Fastest',
    other: 'Or bring your own idea instead',
  },
  own: {
    icon: PenLine,
    title: 'Bring your own idea',
    body: 'Describe a problem in a sentence or two. We will shape it with you, one short step at a time.',
    tag: 'Most flexible',
    other: 'Or start from an approved use case instead',
  },
} as const;

interface StartScreenProps {
  industryId: string;
  onIndustryChange: (id: string) => void;
  replacingExisting: boolean;
  onApproved: (uc: ApprovedUseCase, questions: string[], preview: UseCasePreview) => void;
  onOwn: (text: string) => void;
}

export function StartScreen({ industryId, onIndustryChange, replacingExisting, onApproved, onOwn }: StartScreenProps) {
  const [path, setPath] = useState<StartPath | null>(null);
  const [text, setText] = useState('');
  const example = IDEA_EXAMPLES[industryId];
  const minutes = { approved: ideaMinutes('insights', ['spark', 'map']), own: ideaMinutes('insights') };
  const canShape = text.trim().length >= 12;

  return (
    <>
      <FadeIn>
        <Headline
          art={ART.hero}
          eyebrow="Insights"
          title="What do you want to build?"
          subtitle="First we shape your idea in a few short steps. Then you pick your data and build a Genie your team can chat with, plus a dashboard to match."
        />
      </FadeIn>

      <AnimatePresence mode="wait" initial={false}>
        {!path ? (
          <motion.div
            key="choose"
            role="radiogroup"
            aria-label="How do you want to start?"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="grid sm:grid-cols-2 gap-4"
          >
            {(['approved', 'own'] as const).map(id => (
              <PathCard
                key={id}
                {...PATHS[id]}
                meta={[`About ${minutes[id]} min`, ...(id === 'approved' ? ['2 steps pre-filled'] : [])]}
                selected={false}
                onSelect={() => setPath(id)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-2.5">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
                  {(() => { const Icon = PATHS[path].icon; return <Icon className="w-[18px] h-[18px]" />; })()}
                </span>
                <span className="text-ui-lg font-semibold text-foreground">{PATHS[path].title}</span>
              </span>
              <button onClick={() => setPath(path === 'approved' ? 'own' : 'approved')} className="text-ui-sm font-medium text-primary hover:underline">
                {PATHS[path].other}
              </button>
            </div>

            {path === 'approved' ? (
              <div className="space-y-2">
                <p className="text-ui-md text-muted-foreground">See who it serves, the data it covers and the questions it was built to answer. Tick the questions you want to keep.</p>
                <UseCasePicker
                  insightsIndustryId={industryId}
                  selected={null}
                  room={MAX_GENIE_QUESTIONS}
                  applyLabel="Start from this use case"
                  onApply={onApproved}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <VoiceTextarea
                  value={text}
                  onChange={setText}
                  size="lg"
                  rows={3}
                  autoFocus
                  placeholder={example ?? 'Who keeps asking for what, and why is it hard to answer today?'}
                  className="rounded-2xl shadow-sm"
                />
                <div className="rounded-2xl bg-secondary/30 border border-border/60 p-4 space-y-3">
                  <p className="flex items-center gap-2 text-ui-md font-medium text-foreground">
                    <Lightbulb className="w-4 h-4 text-amber-400" /> Need a nudge? Pick your industry
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
                  {example && example !== text && (
                    <button onClick={() => setText(example)} className="block text-left text-ui-sm text-muted-foreground hover:text-foreground transition-colors">
                      Try: <span className="italic">"{example}"</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <p className="text-ui-sm text-muted-foreground">
                    {replacingExisting ? 'This replaces the idea saved in your current project.' : 'A sentence or two is plenty. You can refine it next.'}
                  </p>
                  <PrimaryButton size="lg" disabled={!canShape} onClick={() => onOwn(text.trim())}>
                    Start shaping it <ArrowRight className="w-4 h-4" />
                  </PrimaryButton>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
