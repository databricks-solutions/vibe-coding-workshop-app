import { Check } from 'lucide-react';
import { StepSegment } from '../../journeykit';
import { CHAPTERS, MOMENTS, momentsIn, type Moment } from '../journey';

interface ChapterRailProps {
  moments?: Moment[];
  activeStep: number;
  isDone: (step: number) => boolean;
  reachableUpTo: number;
  onSelect: (step: number) => void;
}

export function ChapterRail({ moments: all = MOMENTS, activeStep, isDone, reachableUpTo, onSelect }: ChapterRailProps) {
  const activeChapter = all.find(m => m.step === activeStep)?.chapter;

  return (
    <nav aria-label="Chapters" className="grid grid-cols-4 gap-2 sm:gap-4">
      {CHAPTERS.map((chapter, ci) => {
        const moments = momentsIn(chapter.id, all);
        const doneCount = moments.filter(m => isDone(m.step)).length;
        const complete = doneCount === moments.length;
        const active = chapter.id === activeChapter;
        const firstOpen = moments.find(m => !isDone(m.step)) ?? moments[0];
        const firstIdx = all.findIndex(m => m.step === firstOpen.step);
        const reachable = firstIdx <= reachableUpTo;
        return (
          <div key={chapter.id} className="min-w-0">
            <button
              disabled={!reachable}
              onClick={() => onSelect(firstOpen.step)}
              className={`w-full text-left group disabled:cursor-not-allowed ${active ? '' : 'opacity-80 hover:opacity-100'}`}
            >
              <p className={`flex items-center gap-1.5 text-ui-xs font-medium uppercase tracking-wider ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                {complete ? (
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white"><Check className="w-2.5 h-2.5" strokeWidth={3.5} /></span>
                ) : null}
                <span className="hidden sm:inline">Chapter</span> {ci + 1}
              </p>
              <p className={`mt-0.5 text-ui-md font-semibold truncate ${active ? 'text-foreground' : 'text-muted-foreground'} ${active ? '' : 'hidden sm:block'}`}>
                {chapter.title}
              </p>
            </button>
            <div className="flex gap-1 mt-2.5">
              {moments.map(m => {
                const idx = all.findIndex(x => x.step === m.step);
                const done = isDone(m.step);
                const current = m.step === activeStep;
                return (
                  <button
                    key={m.step}
                    title={m.title}
                    aria-label={`${m.title}${done ? ' (done)' : ''}`}
                    aria-current={current ? 'step' : undefined}
                    disabled={idx > reachableUpTo}
                    onClick={() => onSelect(m.step)}
                    className="flex-1 py-1.5 group/seg disabled:cursor-not-allowed"
                  >
                    <StepSegment state={done ? 'done' : current ? 'current' : 'upcoming'} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
