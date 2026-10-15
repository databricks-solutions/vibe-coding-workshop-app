import { useNavigate } from 'react-router-dom';
import { CopyPlus, Eye } from 'lucide-react';
import { useIdeas } from '../engine/useIdeas';
import type { Idea } from '../engine/types';
import { IndustryBadge } from './IndustryBadge';

/** Saves a copy of a sample to My ideas, every step still approved, and opens it. */
function useMakeItMine(idea: Idea) {
  const { adoptIdea } = useIdeas();
  const navigate = useNavigate();
  return () => navigate(`/ideate/${adoptIdea(idea, `Copied from the ${idea.industry} sample`)}`);
}

export function MakeItMineButton({ idea, size = 'md' }: { idea: Idea; size?: 'sm' | 'md' }) {
  const makeItMine = useMakeItMine(idea);
  return (
    <button
      onClick={makeItMine}
      title="Save an editable copy to My ideas"
      className={`inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-95 transition-all shrink-0 ${size === 'sm' ? 'px-3 py-1.5 text-ui-xs' : 'px-4 py-2 text-ui-sm'}`}
    >
      <CopyPlus className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> Make it mine
    </button>
  );
}

/** Tells the reader they are walking through a finished example, and how to start from it. */
export function SampleBanner({ idea }: { idea: Idea }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3 animate-fade-in" role="note">
      <Eye className="w-4 h-4 text-primary shrink-0" aria-hidden />
      <IndustryBadge industry={idea.industry} catalogKey={idea.sourceUseCase?.industry} />
      <p className="flex-1 min-w-[12rem] text-ui-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sample, read only.</span>{' '}
        Every step is filled in and approved. Step through it, then make it yours to change anything.
      </p>
      <MakeItMineButton idea={idea} />
    </div>
  );
}
