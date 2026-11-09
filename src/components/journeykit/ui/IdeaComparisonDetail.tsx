import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import type { SimilarIdeaMatch } from '../../../api/client';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../../MarkdownContent.utils';
import { calculateIdeaScore } from '../../../constants/scoring';
import { caseFigures, chosenShape } from '../engine/ideaContext';
import { money } from '../engine/businessCase';
import type { Idea } from '../engine/types';
import { ClimbRoute } from '../stage/ClimbMap';
import { ideaProgressSteps, ideaTrail } from '../stage/ideaProgress';

export function IdeaComparisonDetail({ match, idea, onClose }: { match: SimilarIdeaMatch; idea: Idea; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const figures = caseFigures(idea);
  const score = calculateIdeaScore(idea);
  const shape = chosenShape(idea);

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="idea-detail-title" className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close details" className="absolute right-4 top-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="w-4 h-4" /></button>
        <header className="px-6 sm:px-8 pt-7 pb-5 border-b border-border bg-primary/[0.04]">
          <p className="text-ui-xs font-semibold uppercase tracking-wider text-primary">Related idea details</p>
          <h2 id="idea-detail-title" className="text-ui-2xl font-semibold text-foreground mt-1 pr-8">{idea.title}</h2>
          <p className="text-ui-sm text-muted-foreground mt-1">Submitted by {match.owner.displayName}{match.owner.email ? ` · ${match.owner.email}` : ''}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-ui-xs font-medium">{match.status}</span>
            {figures && <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-ui-xs font-semibold text-emerald-700 dark:text-emerald-300">{money(figures.value.expected)}/yr</span>}
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-ui-xs font-semibold text-primary">{score.total} points</span>
          </div>
        </header>
        <div className="p-6 sm:p-8 space-y-6">
          <section>
            <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Idea journey</p>
            <ClimbRoute steps={ideaProgressSteps(idea, idea.approved.includes(idea.step) ? null : idea.step)} {...ideaTrail(idea)} />
          </section>
          <section className="grid sm:grid-cols-2 gap-3">
            <Fact label="Problem" value={idea.spark?.statement || idea.seed} />
            <Fact label="Approach" value={shape ? `${shape.title} · ${shape.value}` : 'Not defined'} />
            <Fact label="Decision grain" value={idea.spark?.primaryEntity || 'Not defined'} />
            <Fact label="Decision cadence" value={shape?.cadence || 'Not defined'} />
          </section>
          {!!idea.workflow?.length && (
            <section>
              <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">User flow</p>
              <div className="flex flex-wrap gap-2">
                {idea.workflow.map((node, index) => (
                  <span key={node.id} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-ui-sm">
                    <strong>{node.actor}</strong><span className="text-muted-foreground">{node.action}</span>{index < idea.workflow!.length - 1 && <span>→</span>}
                  </span>
                ))}
              </div>
            </section>
          )}
          {!!idea.genieQuestions?.length && (
            <section>
              <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Questions for Genie</p>
              <ol className="grid sm:grid-cols-2 gap-2">
                {idea.genieQuestions.map((question, index) => <li key={question} className="rounded-xl bg-secondary/40 px-3 py-2 text-ui-sm"><span className="text-muted-foreground mr-2">{index + 1}.</span>{question}</li>)}
              </ol>
            </section>
          )}
          {idea.brief && (
            <section className="rounded-2xl border border-border bg-background/40 p-5">
              <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">One-pager</p>
              <div className="prose-sm max-w-none"><ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{idea.brief}</ReactMarkdown></div>
            </section>
          )}
          <div className="flex justify-end">
            <Link to={`/ideate/view/${encodeURIComponent(match.id)}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-ui-sm font-semibold text-primary-foreground">
              Open full idea <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/40 px-4 py-3"><p className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-ui-sm text-foreground mt-1">{value}</p></div>;
}
