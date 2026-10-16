import { useEffect, useMemo, useState } from 'react';
import { Check, Inbox, Loader2, RotateCcw, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, type IdeaReviewDecision, type IdeaReviewDetail, type IdeaReviewItem, type IdeaReviewStatus } from '../../api/client';
import { normalizeIdea } from '../journeykit/engine/useIdeas';
import { caseFigures } from '../journeykit/engine/ideaContext';
import { money } from '../journeykit/engine/businessCase';
import { assessPriority } from '../insights/priorityAssessment';
import { PriorityMatrix } from '../insights/priority/PriorityMatrix';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../MarkdownContent';
import { EmptyState } from './ui';

interface Props {
  notify: (notice: { tone: 'success' | 'error' | 'info'; message: string }) => void;
}

export function ReviewQueue({ notify }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<IdeaReviewItem[]>([]);
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get('id') ?? '';
  const [selectedId, setSelectedId] = useState(linkedId);
  const [detail, setDetail] = useState<IdeaReviewDetail | null>(null);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IdeaReviewStatus | 'all'>(linkedId ? 'all' : 'pending');
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<IdeaReviewDecision | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [capability, pending, user] = await Promise.all([
        apiClient.ideaReviewCapability(),
        apiClient.ideaReviews('all'),
        apiClient.getCurrentUser(),
      ]);
      const hydrated = await Promise.all(pending.map(async item => {
        if (item.idea) return item;
        try {
          const full = await apiClient.ideaReviewDetail(item.id);
          return { ...item, idea: full.idea };
        } catch {
          return item;
        }
      }));
      setCanReview(capability.canReview);
      setCurrentUser(user.user);
      setItems(hydrated);
      setSelectedId(id => hydrated.some(i => i.id === id) ? id : hydrated[0]?.id ?? '');
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t load the review queue' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    apiClient.ideaReviewDetail(selectedId)
      .then(d => { if (!cancelled) { setDetail(d); setNote(''); } })
      .catch(e => { if (!cancelled) notify({ tone: 'error', message: (e as Error).message || 'Couldn’t load that idea' }); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, notify]);

  const filtered = useMemo(() => items.filter(i =>
    (statusFilter === 'all' || i.review.status === statusFilter)
    && `${i.title} ${i.owner?.displayName ?? ''} ${i.industry}`.toLowerCase().includes(query.toLowerCase())
  ), [items, query, statusFilter]);
  useEffect(() => {
    if (filtered.length && !filtered.some(i => i.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);
  const ideas = useMemo(() => filtered
    .map(item => normalizeIdea(item.idea))
    .filter((idea): idea is NonNullable<ReturnType<typeof normalizeIdea>> => !!idea), [filtered]);
  const assessments = useMemo(() => ideas.map(idea => assessPriority(idea)), [ideas]);
  const selectedIdea = normalizeIdea(detail?.idea);
  const selectedAssessment = selectedIdea ? assessPriority(selectedIdea) : assessments.find(a => a.ideaId === selectedId);
  const portfolio = selectedAssessment && !assessments.some(a => a.ideaId === selectedAssessment.ideaId)
    ? [selectedAssessment, ...assessments]
    : assessments;
  const decide = async (action: IdeaReviewDecision) => {
    if (!detail || !canReview) return;
    if (action !== 'approve' && !note.trim()) {
      notify({ tone: 'info', message: 'Add a reviewer note before returning or rejecting the idea.' });
      return;
    }
    setActing(action);
    try {
      const result = await apiClient.ideaReviewAction(detail.id, action, note);
      setDetail({ ...detail, review: result.review });
      setItems(list => list.map(i => i.id === detail.id ? { ...i, review: result.review } : i));
      notify({ tone: 'success', message: action === 'approve' ? 'Idea approved' : action === 'changes_requested' ? 'Returned for changes' : 'Idea rejected' });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t save the review decision' });
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="p-12 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading review workspace…</div>;

  return (
    <div className="px-6 py-7 max-w-[96rem] mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 inline-flex items-center justify-center"><Inbox className="w-5 h-5" /></span>
        <div className="flex-1">
          <h1 className="text-ui-2xl font-semibold text-foreground">Idea review workspace</h1>
          <p className="text-ui-sm text-muted-foreground">Review submitted revisions before they can start or update a build.</p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary" title="Refresh"><RotateCcw className="w-4 h-4" /></button>
      </header>

      {canReview === false && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-ui-sm text-amber-700 dark:text-amber-300">
          The server has not granted this account reviewer capability. You can inspect the queue, but review actions are disabled.
        </div>
      )}

      {!items.length && !detail ? (
        <EmptyState icon={<Check className="w-6 h-6" />} title="You’re all caught up" body="New Ideate approval requests will appear here." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-border bg-card p-3 self-start xl:sticky xl:top-5">
            <div className="flex flex-wrap gap-1 mb-2">
              {(['pending', 'changes_requested', 'rejected', 'approved', 'all'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 rounded-md text-ui-2xs font-semibold ${statusFilter === status ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {status === 'changes_requested' ? 'Changes' : status[0].toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter ideas…" className="w-full rounded-lg bg-secondary/60 px-3 py-2 text-ui-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <p className="px-1 pt-3 pb-2 text-ui-xs font-semibold text-muted-foreground">{filtered.length} {statusFilter === 'all' ? 'submissions' : statusFilter.replace('_', ' ')}</p>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {filtered.map(item => (
                <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full text-left rounded-xl px-3 py-3 transition-colors ${selectedId === item.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/60'}`}>
                  <p className="text-ui-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                  <p className="text-ui-xs text-muted-foreground mt-1">{item.owner?.displayName || item.owner?.email || 'Unknown owner'} · rev {item.review.revision}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-5 min-w-0">
            {selectedAssessment && (
              <PriorityMatrix
                current={selectedAssessment}
                portfolio={portfolio}
                portfolioLimit={null}
                onSelectIdea={setSelectedId}
                subtitle="Pre-build feasibility is provisional. Ranges widen when data, architecture, or reviewer evidence is incomplete; click any point to review it."
              />
            )}

            {detailLoading ? (
              <div className="rounded-2xl border border-border bg-card p-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : detail && selectedIdea ? (
              <article className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                <div className="flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-ui-xs font-semibold uppercase tracking-wide text-primary">Submitted one-pager · revision {detail.review.revision}</p>
                    <h2 className="text-ui-2xl font-semibold text-foreground mt-1">{selectedIdea.title}</h2>
                    <p className="text-ui-sm text-muted-foreground mt-1">{detail.owner?.displayName || detail.owner?.email}</p>
                  </div>
                  {caseFigures(selectedIdea) && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-ui-sm font-semibold text-emerald-500">{money(caseFigures(selectedIdea)!.value.expected)}/yr</span>}
                </div>

                <div className="mt-6 prose-sm max-w-none rounded-xl border border-border bg-background/50 p-5">
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{selectedIdea.brief || 'No brief was included.'}</ReactMarkdown>
                </div>

                {selectedAssessment && (
                  <div className="grid md:grid-cols-2 gap-3 mt-5">
                    <Evidence title={`Value · ${selectedAssessment.value}/100`} items={selectedAssessment.valueEvidence} />
                    <Evidence title={`Feasibility · ${selectedAssessment.feasibility}/100 · ${selectedAssessment.confidence} confidence`} items={selectedAssessment.feasibilityEvidence} />
                  </div>
                )}

                {!!detail.review.history.length && (
                  <details className="mt-5 rounded-xl border border-border px-4 py-3">
                    <summary className="cursor-pointer text-ui-sm font-medium">Review history ({detail.review.history.length})</summary>
                    <div className="mt-3 space-y-2">
                      {detail.review.history.map((event, index) => <p key={`${event.at}-${index}`} className="text-ui-xs text-muted-foreground"><span className="font-semibold text-foreground">{event.action.replace('_', ' ')}</span> · rev {event.revision}{event.note ? ` — ${event.note}` : ''}</p>)}
                    </div>
                  </details>
                )}

                {detail.review.status === 'pending' ? (
                  <div className="mt-6 border-t border-border pt-5">
                    <label className="text-ui-xs font-medium text-muted-foreground">Reviewer note <span className="font-normal">(required for changes or rejection)</span></label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What should the owner know?" className="mt-1.5 w-full rounded-xl bg-secondary/50 px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40" />
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button disabled={!canReview || !!acting} onClick={() => void decide('approve')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-ui-sm font-semibold disabled:opacity-40"><Check className="w-4 h-4" />Approve</button>
                      <button disabled={!canReview || !!acting || !note.trim()} onClick={() => void decide('changes_requested')} className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-ui-sm font-semibold disabled:opacity-40">Return for changes</button>
                      <button disabled={!canReview || !!acting || !note.trim()} onClick={() => void decide('reject')} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-ui-sm font-semibold disabled:opacity-40"><X className="w-4 h-4" />Reject</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl bg-emerald-500/10 p-4">
                    <p className="text-ui-sm font-semibold text-emerald-500">Review complete: {detail.review.status.replace('_', ' ')}</p>
                    {detail.isOwner || (!!currentUser && detail.owner?.email === currentUser) ? (
                      <button onClick={() => navigate(`/?buildIdea=${encodeURIComponent(detail.id)}`)} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-ui-sm font-semibold">Start building</button>
                    ) : <p className="text-ui-xs text-muted-foreground mt-1">The owner can now start building this revision.</p>}
                  </div>
                )}
              </article>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Evidence({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-ui-sm font-semibold text-foreground">{title}</p>
      {items.length ? <ul className="mt-2 space-y-1 text-ui-xs text-muted-foreground">{items.map(item => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-ui-xs text-muted-foreground">No supporting evidence yet.</p>}
    </div>
  );
}
