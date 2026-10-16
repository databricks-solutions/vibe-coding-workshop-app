import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Hammer, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { apiClient, type IdeaReviewDecision } from '../../../api/client';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../../MarkdownContent';
import { setIdeaReview } from '../engine/useIdeas';
import { caseFigures } from '../engine/ideaContext';
import { money } from '../engine/businessCase';
import type { Idea, IdeaReview } from '../engine/types';
import { submitterOf, useReviewer } from '../engine/approval';
import { ApprovalTracker } from './ApprovalTracker';
const NOTE_HINT: Record<Exclude<IdeaReviewDecision, 'approve'>, string> = {
  changes_requested: 'What should the owner change before you approve? For example: tighten the value estimate, name the data source…',
  reject: 'Why is this not moving forward? The owner sees this and can revise and resubmit.',
};

interface Props {
  idea: Idea;
  onClose: () => void;
  /** Called after an approval when the reviewer chooses to build right away. */
  onStartBuild?: () => void;
  /** Called after any decision, before the reviewer closes the dialog. */
  onDecided?: (action: IdeaReviewDecision) => void;
}

/** Review the submitted revision in place: read the one-pager, decide, then go straight to the next step. */
export function ReviewDialog({ idea, onClose, onStartBuild, onDecided }: Props) {
  const navigate = useNavigate();
  const me = useReviewer();
  const [choice, setChoice] = useState<Exclude<IdeaReviewDecision, 'approve'> | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<IdeaReviewDecision | null>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const buildRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const figures = caseFigures(idea);
  const own = !!me.email && submitterOf(idea) === me.email;

  useEffect(() => { approveRef.current?.focus(); }, []);
  useEffect(() => { if (choice) noteRef.current?.focus(); }, [choice]);
  useEffect(() => { if (done === 'approve') buildRef.current?.focus(); }, [done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || acting) return;
      if (choice && !done) setChoice(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [acting, choice, done, onClose]);

  const decide = async (action: IdeaReviewDecision) => {
    if (action !== 'approve' && !note.trim()) return;
    setActing(true);
    setError(null);
    try {
      const r = await apiClient.ideaReviewAction(idea.id, action, action === 'approve' ? note : note.trim());
      setIdeaReview(idea.id, r.review as IdeaReview);
      setDone(action);
      onDecided?.(action);
    } catch (e) {
      setError((e as Error).message || 'Could not save the review. Try again.');
    } finally {
      setActing(false);
    }
  };

  const reviewed = done ? { ...idea, review: { ...(idea.review as IdeaReview), status: done === 'approve' ? 'approved' : done === 'reject' ? 'rejected' : 'changes_requested', approvedRevision: done === 'approve' ? idea.revision ?? 0 : idea.review?.approvedRevision } as IdeaReview } : idea;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onMouseDown={() => !acting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <button onClick={onClose} disabled={acting} className="absolute top-3 right-3 z-10 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        <header className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-b from-primary/[0.06] to-transparent">
          <p className="flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wide text-primary">
            <ShieldCheck className="w-3.5 h-3.5" /> Review · revision {idea.review?.revision ?? idea.revision ?? 1}
          </p>
          <h2 id="review-title" className="text-ui-xl font-semibold text-foreground mt-1 pr-8">{idea.title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <ApprovalTracker idea={reviewed} size="md" />
            {figures && <span className="text-ui-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">~{money(figures.value.expected)} a year</span>}
          </div>
        </header>

        {done ? (
          <div className="px-6 py-10 text-center animate-slide-up-fade" aria-live="polite">
            {done === 'approve'
              ? <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 animate-scale-in" />
              : <RotateCcw className="w-12 h-12 mx-auto text-sky-500 animate-scale-in" />}
            <p className="text-ui-xl font-semibold text-foreground mt-3">
              {done === 'approve' ? 'Approved. Ready to build.' : done === 'reject' ? 'Rejected with your notes' : 'Sent back with your notes'}
            </p>
            <p className="text-ui-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {done === 'approve'
                ? 'This revision is cleared. Start the Insights build now, or pick it up later from My Ideas.'
                : 'The owner sees your note on their idea and can revise and resubmit.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {done === 'approve' && onStartBuild && (
                <button ref={buildRef} onClick={onStartBuild} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-ui-base font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                  <Hammer className="w-4 h-4" /> Start building <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80">
                {done === 'approve' ? 'Later' : 'Done'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <div className="prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{idea.brief || '_No one-pager was included._'}</ReactMarkdown>
              </div>
            </div>
            <footer className="px-6 py-4 border-t border-border space-y-3 bg-card">
              {own && !choice && (
                <p className="text-ui-xs text-muted-foreground">
                  You're reviewing your own idea.{me.everyone ? ' Everyone is an approver right now, so you can approve it yourself.' : ''}
                </p>
              )}
              {choice ? (
                <div className="space-y-3 animate-slide-up-fade">
                  <label htmlFor="review-note" className="block text-ui-sm font-semibold text-foreground">
                    {choice === 'reject' ? 'Why not?' : 'What needs to change?'}
                  </label>
                  <textarea
                    id="review-note"
                    ref={noteRef}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void decide(choice); }}
                    rows={3}
                    placeholder={NOTE_HINT[choice]}
                    className="w-full rounded-xl bg-secondary/50 px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
                  />
                  {error && <p className="text-ui-sm text-red-400">{error}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={acting || !note.trim()}
                      onClick={() => void decide(choice)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-ui-sm font-semibold disabled:opacity-40 ${choice === 'reject' ? 'bg-red-500 hover:bg-red-400' : 'bg-sky-600 hover:bg-sky-500'}`}
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : choice === 'reject' ? <X className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      {choice === 'reject' ? 'Reject with note' : 'Send back with note'}
                    </button>
                    <button disabled={acting} onClick={() => setChoice(null)} className="px-3 py-2 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">Back</button>
                    <span className="ml-auto text-ui-2xs text-muted-foreground hidden sm:inline">⌘↵ to send</span>
                  </div>
                </div>
              ) : (
                <>
                  {error && <p className="text-ui-sm text-red-400">{error}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      ref={approveRef}
                      disabled={acting}
                      onClick={() => void decide('approve')}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-ui-base font-semibold shadow-sm hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                    </button>
                    <button disabled={acting} onClick={() => setChoice('changes_requested')} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sky-600 dark:text-sky-400 text-ui-sm font-semibold hover:bg-sky-500/10 disabled:opacity-40">
                      <RotateCcw className="w-4 h-4" /> Request changes
                    </button>
                    <button disabled={acting} onClick={() => setChoice('reject')} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-red-500 text-ui-sm font-medium hover:bg-red-500/10 disabled:opacity-40">
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                  <button onClick={() => navigate(`/library/review?id=${encodeURIComponent(idea.id)}`)} className="text-ui-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                    Compare it with other ideas in the review queue
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
