import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ExternalLink, Eye, Lightbulb, Loader2, Lock, Menu, Mountain, Pencil } from 'lucide-react';
import { apiClient } from '../../api/client';
import { calculateIdeaScore } from '../../constants/scoring';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../MarkdownContent.utils';
import {
  ClimbRoute, IndustryBadge, MakeItMineButton, Scorecard, TierBadge, caseFigures, ideaProgressSteps, ideaTrail, money, normalizeIdea, stepMeta,
  type Idea,
} from '../journeykit';

type Loaded = { idea: Idea; owner: { displayName: string; avatar: string }; isOwner: boolean };

/** Anyone's idea, read only: where they are on the climb, the scorecard, and the brief. */
export function IdeaViewer({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { ideaId = '' } = useParams();
  return <IdeaView key={ideaId} ideaId={ideaId} onOpenMobileNav={onOpenMobileNav} />;
}

function IdeaView({ ideaId, onOpenMobileNav }: { ideaId: string; onOpenMobileNav?: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiClient.ideaGet(ideaId)
      .then(r => {
        const idea = normalizeIdea(r.idea);
        if (!live) return;
        if (!idea) setError("This idea isn't available.");
        else setData({ idea, owner: r.owner, isOwner: r.isOwner });
      })
      .catch((e: Error) => live && setError(e.message || "This idea isn't available."));
    return () => { live = false; };
  }, [ideaId]);

  const header = (
    <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 sm:px-6 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        {onOpenMobileNav && (
          <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Link to="/leaderboard?tab=insights" className="flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Leaderboard
        </Link>
        <span className="ml-auto inline-flex items-center gap-1.5 text-ui-xs text-muted-foreground"><Eye className="w-3.5 h-3.5" /> Read only</span>
      </div>
    </div>
  );

  if (error || !data) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-background">
        {header}
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          {error ? (
            <>
              <Lock className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-ui-lg font-semibold text-foreground">{error}</p>
              <Link to="/leaderboard?tab=insights" className="mt-4 text-ui-sm font-medium text-primary hover:underline">Back to the leaderboard</Link>
            </>
          ) : (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
        </div>
      </div>
    );
  }

  const { idea, owner, isOwner } = data;
  const score = calculateIdeaScore(idea);
  const figures = caseFigures(idea);
  const insights = idea.mode === 'insights';
  const editHref = insights ? (idea.sessionId ? `/?sessionId=${encodeURIComponent(idea.sessionId)}&view=insights` : null) : `/ideate/${encodeURIComponent(idea.id)}`;
  const buildHref = insights && idea.sessionId && !isOwner ? `/?sessionId=${encodeURIComponent(idea.sessionId)}&view=insights` : null;
  const atStep = idea.approved.includes('brief') ? (insights ? (idea.buildStage === 'studio' ? 'Genie built' : 'At base camp') : 'Summit reached') : `At ${stepMeta(idea, idea.step).label}`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      {header}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-ui-sm text-muted-foreground">
            <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-lg">{owner.avatar}</span>
            <span className="font-medium text-foreground">{owner.displayName}</span>
            {isOwner && <span className="text-primary text-ui-xs font-medium">(you)</span>}
            <span className="text-muted-foreground/50">•</span>
            <span className="inline-flex items-center gap-1">
              {insights ? <Mountain className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
              {insights ? 'Insights build' : 'Ideate'}
            </span>
          </div>
          <h1 className="text-ui-3xl font-semibold tracking-tight text-foreground">{idea.title}</h1>
          {idea.spark?.statement && <p className="text-ui-base text-muted-foreground">{idea.spark.statement}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <IndustryBadge industry={idea.spark?.industry || idea.industry} catalogKey={idea.spark?.catalogIndustry ?? idea.sourceUseCase?.industry} size="sm" />
            <TierBadge total={score.total} />
            <span className="text-ui-sm font-semibold tabular-nums text-foreground">{score.total.toLocaleString()} pts</span>
            {figures && figures.value.expected > 0 && (
              <span className="text-ui-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{money(figures.value.expected)}/yr</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {isOwner && editHref && (
              <Link to={editHref} className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-ui-sm font-semibold hover:opacity-90">
                <Pencil className="w-4 h-4" /> Open in editor
              </Link>
            )}
            {!isOwner && idea.brief && <MakeItMineButton idea={idea} />}
            {buildHref && (
              <a href={buildHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-ui-sm font-medium text-foreground hover:bg-secondary">
                <ExternalLink className="w-4 h-4" /> View the build
              </a>
            )}
          </div>
        </section>

        <section aria-label="Where they are">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">The climb</p>
            <p className="text-ui-xs text-muted-foreground">{atStep}</p>
          </div>
          <ClimbRoute steps={ideaProgressSteps(idea, idea.approved.includes(idea.step) ? null : idea.step)} {...ideaTrail(idea)} />
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6" aria-label="Scorecard">
          {score.quality != null ? (
            <Scorecard idea={idea} />
          ) : (
            <div className="flex items-start gap-3 text-ui-sm text-muted-foreground">
              <Lock className="w-4 h-4 mt-0.5" />
              {idea.brief ? 'Not scored yet. The quality score appears once the owner opens their scorecard.' : 'The scorecard unlocks once the brief is written.'}
            </div>
          )}
        </section>

        {idea.brief && (
          <section className="rounded-3xl border border-border bg-card p-5 sm:p-8" aria-label="Brief">
            <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">The brief</p>
            <div className="prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{idea.brief}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
