import { useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, History, Lightbulb } from 'lucide-react';
import { useIdeas } from '../engine/useIdeas';
import { caseFigures } from '../engine/ideaContext';
import { money } from '../engine/businessCase';
import { needsBuildUpdate, reviewIdea, updateBuildHref } from '../engine/handoff';
import type { Idea } from '../engine/types';

/** Thin bar over the workflow that ties the project back to its idea, with a way to park the build. */
export function BuildLinkBar({ idea, readOnly }: { idea: Idea; readOnly?: boolean }) {
  const navigate = useNavigate();
  const { updateIdea } = useIdeas();
  const figures = caseFigures(idea);
  const parked = idea.buildStatus === 'later';
  const insights = idea.mode === 'insights';
  const changed = !readOnly && !parked && needsBuildUpdate(idea) && idea.approved.includes('brief');

  const later = () => {
    updateIdea(idea.id, { buildStatus: 'later', status: 'parked', decisions: [...idea.decisions, { at: new Date().toISOString(), text: 'Parked the build for later' }] });
    navigate('/ideate');
  };
  const resume = () => updateIdea(idea.id, { buildStatus: 'building', status: 'committed' });
  // Insights ideas are shaped inside the project, so the project shows them; Ideate ideas open in Ideate.
  const backToIdea = () => (insights ? reviewIdea({ ideaId: idea.id, to: 'idea' }) : navigate(`/ideate/${idea.id}`));
  const update = () => (insights ? reviewIdea({ ideaId: idea.id, to: 'update' }) : navigate(updateBuildHref(idea)));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 animate-fade-in">
      <Lightbulb className="w-4 h-4 text-primary shrink-0" />
      <p className="min-w-0 flex-1 text-ui-sm text-muted-foreground truncate">
        {parked ? 'Parked: ' : idea.lockedAt || idea.buildTarget ? 'Building ' : 'Shaping '}
        <span className="text-foreground font-medium">{idea.title}</span>
        {figures && figures.value.expected > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · ~{money(figures.value.expected)} a year</span>}
      </p>
      {changed && (
        <button onClick={update} title="Your approved answers changed. Carry them into the build." className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-ui-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20">
          <History className="w-3.5 h-3.5" /> Update build
        </button>
      )}
      <button onClick={backToIdea} title="See how the idea came about, and change any answer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to the idea
      </button>
      {!readOnly && (parked ? (
        <button onClick={resume} className="px-2.5 py-1 rounded-lg text-ui-xs font-medium text-primary hover:bg-primary/10">Resume building</button>
      ) : (
        <button onClick={later} title="Keep this project and come back to it from My ideas" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          <Archive className="w-3.5 h-3.5" /> Build later
        </button>
      ))}
    </div>
  );
}
