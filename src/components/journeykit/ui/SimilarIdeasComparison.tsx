import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Loader2, Mail, Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import { apiClient, type IdeaComparisonResult, type SimilarIdeaMatch } from '../../../api/client';
import { normalizeIdea } from '../engine/useIdeas';
import type { Idea } from '../engine/types';
import { ComparisonRowLabels, IdeaComparisonColumn, type ComparisonDraft } from './IdeaComparisonColumn';
import { IdeaComparisonDetail } from './IdeaComparisonDetail';

const REASONS = [
  ['different_decision', 'Different users or decision'],
  ['different_data', 'Different data, geography, or business unit'],
  ['timeline_or_regulatory', 'Different timeline or regulatory need'],
  ['existing_cannot_absorb', 'The existing initiative cannot take this scope'],
  ['other', 'Other'],
] as const;

export function SimilarIdeasComparison({
  matches,
  mode,
  currentIdea,
  currentDraft,
  onBack,
  onClose,
  onContinue,
}: {
  matches: SimilarIdeaMatch[];
  mode: 'create' | 'submit';
  currentIdea?: Idea;
  currentDraft?: ComparisonDraft;
  onBack: () => void;
  onClose: () => void;
  onContinue: (reasonCode: string, reasonText?: string) => void;
}) {
  const [fullScreen, setFullScreen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [details, setDetails] = useState<Record<string, Idea | null | undefined>>({});
  const [detailMatch, setDetailMatch] = useState<SimilarIdeaMatch | null>(null);
  const [nba, setNba] = useState<IdeaComparisonResult | null>(null);
  const [loadingNba, setLoadingNba] = useState(true);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonText, setReasonText] = useState('');

  useEffect(() => {
    let alive = true;
    apiClient.compareSimilarIdeas({
      ...(currentIdea ? { idea_id: currentIdea.id, idea: currentIdea as unknown as Record<string, unknown> } : {}),
      ...(!currentIdea && currentDraft ? { text: currentDraft.text, title: currentDraft.text.slice(0, 120), industry: currentDraft.industry } : {}),
      match_ids: matches.map(m => m.id),
    }).then(result => alive && setNba(result)).catch(() => alive && setNba(null)).finally(() => alive && setLoadingNba(false));
    return () => { alive = false; };
  }, [currentDraft, currentIdea, matches]);

  useEffect(() => {
    let alive = true;
    for (const match of matches) {
      apiClient.ideaGet(match.id)
        .then(result => {
          const idea = normalizeIdea(result.idea);
          if (alive) setDetails(current => ({ ...current, [match.id]: idea }));
        })
        .catch(() => alive && setDetails(current => ({ ...current, [match.id]: null })));
    }
    return () => { alive = false; };
  }, [matches]);

  const visible = showMore ? matches : matches.slice(0, 1);
  const primary = matches[0];
  const primaryComparison = nba?.comparisons.find(c => c.id === primary.id);
  const recommended = matches.find(m => m.id === nba?.recommendedMatchId) ?? primary;
  const actionLabel = nba?.nextBestAction === 'join_existing'
    ? 'Continue existing idea'
    : nba?.nextBestAction === 'differentiate_scope'
      ? 'Differentiate the scope'
      : nba?.nextBestAction === 'continue_separately'
        ? 'Continue separately'
        : `Contact ${recommended.owner.displayName}`;
  const currentOwner = { displayName: 'You', isCurrentUser: true };
  const shell = fullScreen
    ? 'fixed inset-0 rounded-none'
    : 'relative w-full max-w-[88rem] max-h-[92vh] rounded-3xl';
  const missing = useMemo(() => nba?.missingEvidence ?? [], [nba]);

  return createPortal(
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="compare-ideas-title" className={`${shell} flex flex-col overflow-hidden border border-border bg-card shadow-2xl`} onMouseDown={e => e.stopPropagation()}>
        <header className="shrink-0 px-4 sm:px-6 py-3 border-b border-border bg-card/95">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 p-2 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary"><ArrowLeft className="w-4 h-4" /> Recommendation</button>
            <div className="min-w-0 flex-1">
              <p className="text-ui-2xs font-semibold uppercase tracking-wider text-primary">Compare related ideas</p>
              <h2 id="compare-ideas-title" className="text-ui-lg font-semibold text-foreground truncate">Main metrics, users, and flow</h2>
            </div>
            <button onClick={() => setFullScreen(value => !value)} className="inline-flex items-center gap-1.5 p-2 rounded-lg text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary">
              {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />} <span className="hidden sm:inline">{fullScreen ? 'Exit full screen' : 'Full screen'}</span>
            </button>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
            <div className="flex items-start gap-3">
              {loadingNba ? <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 mt-0.5 text-primary" />}
              <div className="flex-1 min-w-0">
                <p className="text-ui-2xs font-semibold uppercase tracking-wider text-primary">AI next-best action · verify before deciding</p>
                <p className="text-ui-md font-semibold text-foreground mt-1">{loadingNba ? 'Analyzing all related ideas together…' : nba?.recommendation || `Review ${primary.owner.displayName}'s related initiative first.`}</p>
                <p className="text-ui-sm text-muted-foreground mt-1">{nba?.rationale || primary.sharedSignals.join(' · ')}</p>
                {!!missing.length && <p className="text-ui-xs text-muted-foreground mt-2">Clarify: {missing.join(' · ')}</p>}
              </div>
              {nba?.fallback && <span className="rounded-full bg-secondary px-2 py-0.5 text-ui-2xs text-muted-foreground">Evidence fallback</span>}
            </div>
          </section>

          <section className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <div className="flex min-w-max">
                <ComparisonRowLabels />
                <IdeaComparisonColumn label="Your proposed idea" idea={currentIdea} draft={currentDraft} owner={currentOwner} status={mode === 'submit' ? 'Ready to submit' : 'Draft'} />
                {visible.map((match, index) => (
                  <IdeaComparisonColumn
                    key={match.id}
                    label={index === 0 ? 'Related idea' : `Related idea ${index + 1}`}
                    idea={details[match.id]}
                    draft={{ text: match.title, industry: match.industry }}
                    owner={match.owner}
                    status={match.status}
                    primary={index === 0}
                    onDetails={details[match.id] ? () => setDetailMatch(match) : undefined}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            {matches.length > 1 && (
              <button onClick={() => setShowMore(value => !value)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary">
                {showMore ? 'Show fewer ideas' : `Show ${matches.length - 1} more related idea${matches.length - 1 === 1 ? '' : 's'}`}
              </button>
            )}
            {primaryComparison && (
              <p className="text-ui-xs text-muted-foreground">
                {primaryComparison.overlap.slice(0, 2).join(' · ')}
                {!!primaryComparison.differences.length && ` · Different: ${primaryComparison.differences[0]}`}
              </p>
            )}
          </div>

          {showReason && (
            <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3">
              <p className="text-ui-sm font-semibold text-foreground">Why is separate work still needed?</p>
              <p className="text-ui-xs text-muted-foreground">{mode === 'submit' ? 'The reviewer will see this reason and the related ideas.' : 'This reason is saved with your idea.'}</p>
              <select autoFocus value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-ui-sm outline-none focus:border-primary/50">
                <option value="">Select a reason…</option>
                {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {reason === 'other' && <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={2} placeholder="Briefly explain the distinct scope" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-ui-sm outline-none focus:border-primary/50" />}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowReason(false)} className="px-3 py-2 text-ui-sm text-muted-foreground">Cancel</button>
                <button disabled={!reason || (reason === 'other' && !reasonText.trim())} onClick={() => onContinue(reason, reasonText.trim() || undefined)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold disabled:opacity-40">
                  {mode === 'submit' ? 'Submit separately' : 'Create separate idea'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}
        </div>

        {!showReason && (
          <footer className="shrink-0 border-t border-border bg-card/95 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
            <p className="flex-1 text-ui-sm text-muted-foreground">Recommended: {nba?.recommendation || `coordinate with ${recommended.owner.displayName}.`}</p>
            <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary">Back and refine</button>
            {recommended.owner.isCurrentUser ? (
              <a href={`/ideate/${encodeURIComponent(recommended.id)}`} className="h-10 inline-flex items-center px-4 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold">{actionLabel}</a>
            ) : recommended.owner.email ? (
              <a href={`mailto:${encodeURIComponent(recommended.owner.email)}?subject=${encodeURIComponent(`Related idea: ${recommended.title}`)}`} className="h-10 inline-flex items-center gap-1.5 px-4 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold"><Mail className="w-4 h-4" /> {actionLabel}</a>
            ) : null}
            <button onClick={() => setShowReason(true)} className="h-10 px-3 text-ui-sm font-medium text-muted-foreground hover:text-foreground">Continue independently</button>
          </footer>
        )}
      </div>
      {detailMatch && details[detailMatch.id] && <IdeaComparisonDetail match={detailMatch} idea={details[detailMatch.id]!} onClose={() => setDetailMatch(null)} />}
    </div>,
    document.body,
  );
}
