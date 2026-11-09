import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Check, ExternalLink, History, Mail, Network, RotateCcw, ShieldCheck, Target, UserRound, X } from 'lucide-react';
import type { IdeaReviewDecision, IdeaReviewDetail, SimilarIdeaMatch } from '../../api/client';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../MarkdownContent.utils';
import { CaseDocument } from '../journeykit/ui/BusinessCase';
import { ClimbRoute } from '../journeykit/stage/ClimbMap';
import { ideaProgressSteps, ideaTrail } from '../journeykit/stage/ideaProgress';
import { caseFigures, chosenShape } from '../journeykit/engine/ideaContext';
import { money } from '../journeykit/engine/businessCase';
import { normalizeIdea } from '../journeykit/engine/useIdeas';
import { Avatar } from '../library/ui';

interface Props {
  detail: IdeaReviewDetail;
  onClose: () => void;
  onDecision: (action: IdeaReviewDecision, note: string) => Promise<void> | void;
  acting?: IdeaReviewDecision | null;
}

const REASON_LABEL: Record<string, string> = {
  different_decision: 'Different users or decision',
  different_data: 'Different data, geography, or business unit',
  timeline_or_regulatory: 'Different timeline or regulatory need',
  existing_cannot_absorb: 'Existing initiative cannot take this scope',
  other: 'Other distinct scope',
};

function recommendation(overlaps: SimilarIdeaMatch[]) {
  const strong = overlaps.find(m => m.proximity === 'strong');
  if (!strong) return {
    title: overlaps.length ? 'Clarify differentiation' : 'Proceed to approval review',
    body: overlaps.length ? 'Related work exists. Confirm the scope is distinct before approving.' : 'No material overlap was found. Review value, feasibility, and evidence.',
    tone: 'border-sky-500/30 bg-sky-500/[0.06]',
  };
  if (['approved', 'building', 'live'].includes(strong.status.toLowerCase())) return {
    title: `Work with ${strong.owner.displayName}'s existing team`,
    body: `"${strong.title}" is already ${strong.status}. Coordinate or extend it before funding a separate build.`,
    tone: 'border-amber-500/35 bg-amber-500/[0.07]',
  };
  return {
    title: 'Coordinate scopes before approval',
    body: `"${strong.title}" is nearby work owned by ${strong.owner.displayName}. Ask both teams to align ownership and boundaries.`,
    tone: 'border-amber-500/35 bg-amber-500/[0.07]',
  };
}

/** Full-screen, evidence-first review surface shared by queue and compact review entry points. */
export function ReviewDossier({ detail, onClose, onDecision, acting = null }: Props) {
  const idea = normalizeIdea(detail.idea);
  const [note, setNote] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlaps = detail.overlappingIdeas ?? [];
  const rec = recommendation(overlaps);

  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const figures = idea ? caseFigures(idea) : null;
  const shape = idea ? chosenShape(idea) : null;
  const decisionGuided = !!idea && !!(
    idea.spark?.primaryEntity
    || idea.spark?.aliases?.length
    || shape?.decisionStyle
    || shape?.cadence
    || Object.keys(idea.questionDetails ?? {}).length
    || idea.summary?.keyResults?.length
  );
  const strongOverlap = overlaps.some(m => m.proximity === 'strong');
  const canDecide = detail.review.status === 'pending' && !acting;
  const canApprove = canDecide && (!strongOverlap || !!note.trim());
  const owner = detail.owner;

  const prefillCollaboration = (match: SimilarIdeaMatch) => {
    setNote(`Close overlap with "${match.title}", owned by ${match.owner.displayName}${match.owner.email ? ` (${match.owner.email})` : ''} and currently ${match.status}. Please connect with that team, compare scope, and either collaborate on the existing initiative or document the distinct decision, users, and data that require separate work.`);
    requestAnimationFrame(() => document.getElementById('dossier-review-note')?.focus());
  };

  const nav = useMemo(() => [
    ['dossier-one-pager', 'One-pager'],
    ['dossier-value', 'ROI'],
    ['dossier-fit', 'Where it fits'],
    ['dossier-overlap', `Overlap${overlaps.length ? ` (${overlaps.length})` : ''}`],
    ['dossier-history', 'History'],
  ] as const, [overlaps.length]);
  const goToSection = (id: string) => {
    const root = scrollRef.current;
    const section = document.getElementById(id);
    if (!root || !section) return;
    const top = section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16;
    root.scrollTo({ top, behavior: 'smooth' });
  };

  if (!idea) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="dossier-title" className="fixed inset-0 z-[1100] flex flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-card/95 backdrop-blur">
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <button ref={closeRef} onClick={onClose} className="inline-flex items-center gap-1.5 p-2 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4" /> Back to review queue
          </button>
          <div className="min-w-0 flex-1">
            <h1 id="dossier-title" className="text-ui-lg font-semibold text-foreground truncate">{idea.title}</h1>
            <p className="text-ui-xs text-muted-foreground">
              Revision {detail.review.revision} · {owner?.displayName || owner?.email || 'Unknown owner'}
              {detail.review.submittedAt ? ` · submitted ${new Date(detail.review.submittedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
          {figures && <span className="rounded-full bg-emerald-500/12 border border-emerald-500/25 px-3 py-1 text-ui-sm font-semibold text-emerald-700 dark:text-emerald-300">{money(figures.value.expected)}/yr</span>}
          {!!overlaps.length && <span className="rounded-full bg-amber-500/12 border border-amber-500/25 px-3 py-1 text-ui-xs font-semibold text-amber-700 dark:text-amber-300">{overlaps.length} related</span>}
          <span className="rounded-full bg-secondary px-3 py-1 text-ui-xs font-semibold capitalize">{detail.review.status.replace('_', ' ')}</span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[96rem] mx-auto p-4 sm:p-6 grid xl:grid-cols-[11rem_minmax(0,1fr)_22rem] gap-6 items-start">
          <aside className="xl:sticky xl:top-4 rounded-2xl border border-border bg-card p-2 flex xl:flex-col gap-1 overflow-x-auto" aria-label="Review sections">
            {nav.map(([id, label]) => (
              <button key={id} onClick={() => goToSection(id)} className="px-3 py-2 rounded-xl text-ui-sm font-medium text-left text-muted-foreground hover:text-foreground hover:bg-secondary whitespace-nowrap">
                {label}
              </button>
            ))}
          </aside>
          <main className="min-w-0 space-y-6">
            <section className={`rounded-2xl border p-4 sm:p-5 ${rec.tone}`} aria-label="Recommended action">
              <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended action</p>
              <h2 className="text-ui-lg font-semibold text-foreground mt-1">{rec.title}</h2>
              <p className="text-ui-sm text-muted-foreground mt-1">{rec.body}</p>
            </section>

            <section id="dossier-one-pager" className="scroll-mt-28 rounded-3xl border border-border bg-card p-5 sm:p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted one-pager</p>
                  <p className="text-ui-sm text-muted-foreground mt-0.5">The complete submitted revision—nothing collapsed.</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(idea.brief ?? '')} className="px-3 py-1.5 rounded-lg border border-border text-ui-xs font-medium hover:bg-secondary">Copy</button>
              </div>
              <div className="prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{idea.brief || '_No one-pager was included._'}</ReactMarkdown>
              </div>
            </section>

            <section id="dossier-value" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <h2 className="text-ui-lg font-semibold text-foreground">Business value &amp; evidence</h2>
              </div>
              {idea.summary ? (
                <div className="overflow-x-auto rounded-3xl border border-border bg-secondary/30 p-3 sm:p-5">
                  <div className="w-[8.5in] mx-auto">
                    <CaseDocument idea={idea} summary={idea.summary} figures={figures} decisionGuided={decisionGuided} />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-5 text-ui-sm text-muted-foreground">
                  No generated business-case summary was submitted. Review the one-pager and Impact evidence directly.
                </div>
              )}
            </section>

            <section id="dossier-fit" className="scroll-mt-28 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5">
              <div>
                <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Where this fits</p>
                <h2 className="text-ui-lg font-semibold text-foreground mt-1">Idea journey and decision model</h2>
              </div>
              <ClimbRoute steps={ideaProgressSteps(idea, null)} {...ideaTrail(idea)} />
              <div className="grid sm:grid-cols-2 gap-3 text-ui-sm">
                <Fact label="Industry" value={idea.spark?.industry || idea.industry || 'Not specified'} />
                <Fact label="Approach" value={shape ? `${shape.title} · ${shape.kind}` : 'Not specified'} />
                <Fact label="Decision grain" value={idea.spark?.primaryEntity || 'Not specified'} />
                <Fact label="Cadence / lead time" value={shape?.cadence || 'Not specified'} />
                <Fact label="Decision style" value={shape?.decisionStyle || 'Not specified'} />
                <Fact label="Questions for Genie" value={`${idea.genieQuestions?.length ?? 0} selected`} />
              </div>
              {!!idea.summary?.keyResults?.length && (
                <div>
                  <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Results</p>
                  <ul className="grid sm:grid-cols-2 gap-2 mt-2">
                    {idea.summary.keyResults.map(result => (
                      <li key={`${result.kr}-${result.target}`} className="rounded-xl bg-secondary/50 px-3 py-2 text-ui-sm text-foreground">
                        <span className="font-medium">{result.kr}</span><span className="text-muted-foreground"> · {result.target}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section id="dossier-overlap" className="scroll-mt-28 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-amber-500" />
                <div>
                  <h2 className="text-ui-lg font-semibold text-foreground">Overlap with existing ideas</h2>
                  <p className="text-ui-sm text-muted-foreground">Explainable signals—not an automatic duplicate decision.</p>
                </div>
              </div>
              {detail.overlapDecision && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] px-4 py-3">
                  <p className="text-ui-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-300">Submitter continued independently</p>
                  <p className="text-ui-sm text-foreground mt-1">{REASON_LABEL[detail.overlapDecision.reasonCode] ?? detail.overlapDecision.reasonCode}{detail.overlapDecision.reasonText ? ` — ${detail.overlapDecision.reasonText}` : ''}</p>
                </div>
              )}
              {!overlaps.length ? <p className="text-ui-sm text-muted-foreground">No material overlap was found at review time.</p> : overlaps.map(match => {
                const introduce = `mailto:${encodeURIComponent([owner.email, match.owner.email].filter(Boolean).join(','))}?subject=${encodeURIComponent(`Coordinate related ideas: ${idea.title} / ${match.title}`)}&body=${encodeURIComponent(`These two submissions appear related:\n\n1. ${idea.title} — ${owner.displayName}\n2. ${match.title} — ${match.owner.displayName}\n\nPlease compare scope, ownership, and whether one shared initiative should move forward.`)}`;
                return (
                  <article key={match.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-ui-md font-semibold text-foreground">{match.title}</p>
                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-ui-2xs font-semibold text-amber-700 dark:text-amber-300">{match.proximity === 'strong' ? 'High overlap' : 'Related'}</span>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-ui-2xs text-muted-foreground">{match.status}</span>
                        </div>
                        <p className="text-ui-sm text-muted-foreground mt-1">Owned by {match.owner.displayName}{match.owner.email ? ` · ${match.owner.email}` : ''}</p>
                        <ul className="mt-2 space-y-1">{match.sharedSignals.map(s => <li key={s} className="text-ui-xs text-foreground/80">• {s}</li>)}</ul>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a href={`/ideate/view/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-ui-xs font-medium hover:bg-secondary">
                          Inspect <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a href={introduce} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-ui-xs font-medium hover:bg-secondary">
                          <Mail className="w-3.5 h-3.5" /> Introduce teams
                        </a>
                        <button onClick={() => prefillCollaboration(match)} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-ui-xs font-semibold">
                          Recommend collaboration
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section id="dossier-history" className="scroll-mt-28 rounded-3xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-ui-lg font-semibold text-foreground"><History className="w-4 h-4" /> Review history</h2>
              <div className="mt-3 space-y-2">
                {detail.review.history.map((event, index) => (
                  <p key={`${event.at}-${index}`} className="text-ui-sm text-muted-foreground">
                    <span className="font-semibold text-foreground capitalize">{event.action.replace('_', ' ')}</span> · rev {event.revision}
                    {event.by ? ` · ${event.by}` : ''}{event.note ? ` — “${event.note}”` : ''}
                  </p>
                ))}
                {!detail.review.history.length && <p className="text-ui-sm text-muted-foreground">No review events yet.</p>}
              </div>
            </section>
          </main>

          <aside className="xl:sticky xl:top-4 space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground"><UserRound className="w-3.5 h-3.5" /> Submitted by</p>
              <div className="flex items-center gap-2 mt-3">
                <Avatar email={owner.email} />
                <div className="min-w-0">
                  <p className="text-ui-sm font-semibold text-foreground">{owner.displayName || owner.email}</p>
                  <p className="text-ui-xs text-muted-foreground truncate">{owner.email}</p>
                </div>
              </div>
            </section>

            {detail.review.status === 'pending' && (
              <section className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm">
                <p className="flex items-center gap-2 text-ui-sm font-semibold text-foreground"><ShieldCheck className="w-4 h-4 text-primary" /> Review decision</p>
                <textarea
                  id="dossier-review-note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={5}
                  placeholder={strongOverlap ? 'Required to approve despite high overlap, return, or reject…' : 'Add context for approval, return, or rejection…'}
                  className="mt-3 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-ui-sm outline-none focus:border-primary/50"
                />
                <div className="grid gap-2 mt-3">
                  <button disabled={!canApprove} onClick={() => void onDecision('approve', note.trim())} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-emerald-600 text-white text-ui-sm font-semibold disabled:opacity-40">
                    <Check className="w-4 h-4" /> {acting === 'approve' ? 'Approving…' : 'Approve & publish'}
                  </button>
                  <button disabled={!canDecide || !note.trim()} onClick={() => void onDecision('changes_requested', note.trim())} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300 text-ui-sm font-semibold disabled:opacity-40">
                    <RotateCcw className="w-4 h-4" /> Return for changes
                  </button>
                  <button disabled={!canDecide || !note.trim()} onClick={() => void onDecision('reject', note.trim())} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-rose-600 dark:text-rose-400 text-ui-sm font-medium hover:bg-rose-500/10 disabled:opacity-40">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
                {strongOverlap && !note.trim() && <p className="text-ui-2xs text-amber-600 dark:text-amber-300 mt-2">Add a rationale to approve despite high overlap.</p>}
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-3 py-2">
      <p className="text-ui-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-ui-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
