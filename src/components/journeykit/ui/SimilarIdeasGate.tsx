import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Mail, Network, X } from 'lucide-react';
import type { SimilarIdeaMatch } from '../../../api/client';
import type { Idea } from '../engine/types';
import { SimilarIdeasComparison } from './SimilarIdeasComparison';
import type { ComparisonDraft } from './IdeaComparisonColumn';

const REASONS = [
  ['different_decision', 'Different users or decision'],
  ['different_data', 'Different data, geography, or business unit'],
  ['timeline_or_regulatory', 'Different timeline or regulatory need'],
  ['existing_cannot_absorb', 'The existing initiative cannot take this scope'],
  ['other', 'Other'],
] as const;

interface Props {
  matches: SimilarIdeaMatch[];
  mode: 'create' | 'submit';
  currentIdea?: Idea;
  currentDraft?: ComparisonDraft;
  onClose: () => void;
  onContinue: (reasonCode: string, reasonText?: string) => void;
}

/** Advisory related-work gate with one recommended path and an auditable exception. */
export function SimilarIdeasGate({ matches, mode, currentIdea, currentDraft, onClose, onContinue }: Props) {
  const [comparing, setComparing] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonText, setReasonText] = useState('');
  const closest = matches[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (comparing) {
    return (
      <SimilarIdeasComparison
        matches={matches}
        mode={mode}
        currentIdea={currentIdea}
        currentDraft={currentDraft}
        onBack={() => setComparing(false)}
        onClose={onClose}
        onContinue={onContinue}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="similar-ideas-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
          <X className="w-4 h-4" />
        </button>
        <header className="px-6 pt-6 pb-4 border-b border-border bg-primary/[0.04]">
          <p className="inline-flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wider text-primary">
            <Network className="w-3.5 h-3.5" /> Related work found
          </p>
          <h2 id="similar-ideas-title" className="text-ui-xl font-semibold text-foreground mt-1 pr-8">
            Check whether you should work together first
          </h2>
          <p className="text-ui-sm text-muted-foreground mt-1 max-w-xl">
            This is an explainable similarity check, not a duplicate verdict. The recommended path is to inspect the existing work and coordinate with its owner.
          </p>
        </header>

        <div className="p-6 space-y-3">
          {matches.map(match => {
            const mine = !!match.owner.isCurrentUser;
            const mail = `mailto:${encodeURIComponent(match.owner.email)}?subject=${encodeURIComponent(`Related idea: ${match.title}`)}&body=${encodeURIComponent(`Hi ${match.owner.displayName},\n\nI am shaping a related idea and would like to compare scope and explore working together.\n\nExisting idea: ${match.title}\n`)}`;
            return (
              <article key={match.id} className={`rounded-2xl border p-4 ${match.proximity === 'strong' ? 'border-amber-500/35 bg-amber-500/[0.05]' : 'border-border bg-background/50'}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-ui-md font-semibold text-foreground">{match.title}</h3>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-ui-2xs font-semibold text-amber-700 dark:text-amber-300">
                        {match.proximity === 'strong' ? 'High overlap' : 'Related'}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-ui-2xs text-muted-foreground">{match.status}</span>
                    </div>
                    <p className="text-ui-sm text-muted-foreground mt-1">
                      {mine ? 'Your existing idea' : `Submitted by ${match.owner.displayName}${match.owner.email ? ` · ${match.owner.email}` : ''}`}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {match.sharedSignals.map(signal => <li key={signal} className="text-ui-xs text-foreground/80">• {signal}</li>)}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => setComparing(true)} className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-ui-sm font-medium text-foreground hover:bg-secondary">
                      Compare
                    </button>
                    {!mine && match.owner.email && (
                      <a href={mail} className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90">
                        <Mail className="w-3.5 h-3.5" /> Contact owner
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!showReason ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3">
              <p className="flex-1 text-ui-sm text-muted-foreground">
                Recommended: {closest.owner.isCurrentUser ? 'continue your existing idea.' : `contact ${closest.owner.displayName} and align the scope.`}
              </p>
              <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary">
                Back and refine
              </button>
              <button onClick={() => setShowReason(true)} className="h-10 px-4 rounded-xl text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary">
                Continue independently
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3">
              <div>
                <p className="text-ui-sm font-semibold text-foreground">Why is separate work still needed?</p>
                <p className="text-ui-xs text-muted-foreground mt-0.5">
                  {mode === 'submit'
                    ? 'A separate approval request will be created. The reviewer will see this reason and the related ideas.'
                    : 'This reason is saved with your idea and will be visible if you submit it for review.'}
                </p>
              </div>
              <select autoFocus value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-ui-sm outline-none focus:border-primary/50">
                <option value="">Select a reason…</option>
                {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {reason === 'other' && (
                <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={2} placeholder="Briefly explain the distinct scope" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-ui-sm outline-none focus:border-primary/50" />
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowReason(false)} className="px-3 py-2 text-ui-sm text-muted-foreground hover:text-foreground">Back</button>
                <button
                  disabled={!reason || (reason === 'other' && !reasonText.trim())}
                  onClick={() => onContinue(reason, reasonText.trim() || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold disabled:opacity-40"
                >
                  {mode === 'submit' ? 'Submit as separate initiative' : 'Create separate idea'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
