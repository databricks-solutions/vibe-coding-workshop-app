import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  History,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  apiClient,
  type IdeaReviewDecision,
  type IdeaReviewDetail,
  type IdeaReviewItem,
  type IdeaReviewStatus,
} from '../../api/client';
import { normalizeIdea } from '../journeykit/engine/useIdeas';
import { caseFigures } from '../journeykit/engine/ideaContext';
import { money } from '../journeykit/engine/businessCase';
import { assessPortfolioPriority, type PriorityAssessment } from '../insights/priorityAssessment';
import { PriorityMatrix } from '../insights/priority/PriorityMatrix';
import { PriorityScoreDetails } from '../insights/priority/PriorityScoreDetails';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../MarkdownContent.utils';
import type { LibraryUseCase } from '../../api/library';
import type { LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { Avatar, EmptyState } from './ui';
import { cx } from './cx';

interface Props {
  notify: (notice: { tone: 'success' | 'error' | 'info'; message: string }) => void;
  model?: LibraryModel;
  actions?: LibraryActions;
  onOpenUseCase?: (uc: LibraryUseCase) => void;
}

const STATUS_BADGE: Record<IdeaReviewStatus, { label: string; cls: string; dot: string }> = {
  pending: {
    label: 'Pending review',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  changes_requested: {
    label: 'Changes requested',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dot: 'bg-sky-500',
  },
  rejected: {
    label: 'Rejected',
    cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dot: 'bg-rose-500',
  },
  draft: {
    label: 'Draft',
    cls: 'bg-secondary text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

const QUADRANT_BADGE: Record<string, string> = {
  'Invest now': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'Quick win': 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  'Strategic bet': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'Rework or park': 'bg-secondary text-muted-foreground border-border',
};

function annualValueOf(item: IdeaReviewItem): number | null {
  const idea = normalizeIdea(item.idea);
  const figs = idea ? caseFigures(idea) : null;
  if (figs && figs.value.expected > 0) return figs.value.expected;
  if (typeof item.businessContext?.valuePerYear === 'number' && item.businessContext.valuePerYear > 0) {
    return item.businessContext.valuePerYear;
  }
  const vp = idea?.useCaseContext?.valueProfile;
  if (vp && typeof vp.typicalLow === 'number' && typeof vp.typicalHigh === 'number' && vp.typicalHigh > 0) {
    return Math.round((vp.typicalLow + vp.typicalHigh) / 2);
  }
  return null;
}

export function ReviewQueue({ notify, model, actions, onOpenUseCase }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<IdeaReviewItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = searchParams.get('id') ?? '';
  const [selectedId, setSelectedId] = useState(linkedId);
  const [detail, setDetail] = useState<IdeaReviewDetail | null>(null);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IdeaReviewStatus | 'all'>('all');
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<IdeaReviewDecision | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [capability, allReviews, user] = await Promise.all([
        apiClient.ideaReviewCapability(),
        apiClient.ideaReviews('all'),
        apiClient.getCurrentUser(),
      ]);
      const hydrated = await Promise.all(allReviews.map(async item => {
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

      const resolveLinkedId = (list: IdeaReviewItem[]) => {
        if (!linkedId) return '';
        const direct = list.find(i => i.id === linkedId);
        if (direct) return direct.id;
        if (linkedId.startsWith('catalog:')) {
          const key = linkedId.slice('catalog:'.length);
          const match = list.find(i => {
            const ref = normalizeIdea(i.idea)?.catalogRef;
            return ref && `${ref.industry}.${ref.useCase}` === key;
          });
          if (match) return match.id;
        }
        return '';
      };

      setSelectedId(prev => {
        const fromLink = resolveLinkedId(hydrated);
        if (fromLink) return fromLink;
        if (prev && hydrated.some(i => i.id === prev)) return prev;
        const firstPending = hydrated.find(i => i.review.status === 'pending');
        return firstPending?.id ?? hydrated[0]?.id ?? '';
      });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t load the review queue' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (linkedId && items.some(item => item.id === linkedId)) setSelectedId(linkedId);
  }, [items, linkedId]);

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

  // Compute assessments across ALL items so the Value vs. Feasibility map always shows the full portfolio
  const assessmentById = useMemo(() => {
    const map = new Map<string, PriorityAssessment>();
    for (const item of items) {
      const idea = normalizeIdea(item.idea);
      if (!idea) continue;
      const annual = annualValueOf(item);
      const assessment = assessPortfolioPriority(idea, {
        status: item.review.status,
        industry: item.industry || idea.spark?.industry || idea.industry,
        owner: item.owner?.displayName || item.owner?.email,
        annualValue: annual,
      });
      map.set(item.id, { ...assessment, ideaId: item.id, title: item.title || idea.title });
    }
    return map;
  }, [items]);

  const allAssessments = useMemo(() => [...assessmentById.values()], [assessmentById]);

  // Status counts for KPI summary cards and filter tabs
  const counts = useMemo(() => {
    const out = {
      all: items.length,
      pending: 0,
      approved: 0,
      changes_requested: 0,
      rejected: 0,
      draft: 0,
    };
    for (const i of items) {
      const st = i.review.status;
      if (st in out) out[st as keyof typeof out] += 1;
    }
    return out;
  }, [items]);

  const portfolioStats = useMemo(() => {
    let totalAnnual = 0;
    let sizedCount = 0;
    let investOrQuickWin = 0;
    for (const item of items) {
      const annual = annualValueOf(item);
      if (annual && annual > 0) {
        totalAnnual += annual;
        sizedCount += 1;
      }
      const a = assessmentById.get(item.id);
      if (a && (a.quadrant === 'Invest now' || a.quadrant === 'Quick win')) {
        investOrQuickWin += 1;
      }
    }
    return { totalAnnual, sizedCount, investOrQuickWin };
  }, [items, assessmentById]);

  const filtered = useMemo(() => items.filter(i =>
    (statusFilter === 'all' || i.review.status === statusFilter)
    && `${i.title} ${i.owner?.displayName ?? ''} ${i.owner?.email ?? ''} ${i.industry}`.toLowerCase().includes(query.toLowerCase()),
  ), [items, query, statusFilter]);

  const highlightedIds = useMemo(() => {
    if (statusFilter === 'all' && !query.trim()) return null;
    return new Set(filtered.map(i => i.id));
  }, [filtered, statusFilter, query]);

  useEffect(() => {
    if (filtered.length && !filtered.some(i => i.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const selectedIdea = normalizeIdea(detail?.idea ?? selectedItem?.idea);
  const selectedAssessment = useMemo(() => {
    if (selectedId && assessmentById.has(selectedId)) {
      return assessmentById.get(selectedId)!;
    }
    if (selectedIdea && detail) {
      return {
        ...assessPortfolioPriority(selectedIdea, {
          status: detail.review.status,
          industry: detail.industry,
          owner: detail.owner?.displayName || detail.owner?.email,
          annualValue: detail.businessContext?.valuePerYear ?? null,
        }),
        ideaId: detail.id,
      };
    }
    return allAssessments[0] ?? null;
  }, [selectedId, assessmentById, selectedIdea, detail, allAssessments]);

  const portfolio = useMemo(() => {
    if (!selectedAssessment) return allAssessments;
    return allAssessments.some(a => a.ideaId === selectedAssessment.ideaId)
      ? allAssessments
      : [selectedAssessment, ...allAssessments];
  }, [selectedAssessment, allAssessments]);

  const handleSelectFromMap = (ideaId: string) => {
    setSelectedId(ideaId);
    const next = new URLSearchParams(searchParams);
    next.set('id', ideaId);
    setSearchParams(next, { replace: true });
    // If the clicked point is hidden by the current tab filter, switch to 'all' so it highlights in the queue rail
    if (!filtered.some(i => i.id === ideaId)) {
      setStatusFilter('all');
    }
  };

  const handleOpenIdea = (ideaId: string) => {
    handleSelectFromMap(ideaId);
    const item = items.find(candidate => candidate.id === ideaId);
    const normalized = normalizeIdea(item?.idea);
    const ref = normalized?.catalogRef;
    const libraryUseCase = ref && model ? model.ucByKey[`${ref.industry}.${ref.useCase}`] : null;
    if (libraryUseCase && onOpenUseCase) {
      onOpenUseCase(libraryUseCase);
      return;
    }
    if (!ideaId.startsWith('catalog:')) navigate(`/ideate/view/${encodeURIComponent(ideaId)}`);
  };

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
      if (actions) {
        await actions.reload();
      }
      notify({
        tone: 'success',
        message: action === 'approve'
          ? 'Use case approved and published to the library'
          : action === 'changes_requested'
            ? 'Returned to owner for changes'
            : 'Use case rejected',
      });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t save the review decision' });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading review workspace…
      </div>
    );
  }

  const activeDetail = detail ?? selectedItem;
  const activeStatus = activeDetail?.review.status ?? 'pending';
  const statusMeta = STATUS_BADGE[activeStatus] ?? STATUS_BADGE.pending;
  const expectedAnnual = activeDetail ? annualValueOf(activeDetail) : null;
  const linkedCatalogRef = selectedIdea?.catalogRef;
  const linkedLibraryUc = linkedCatalogRef && model
    ? model.ucByKey[`${linkedCatalogRef.industry}.${linkedCatalogRef.useCase}`]
    : null;

  return (
    <div className="px-6 py-7 max-w-[96rem] mx-auto space-y-6">
      {/* Workspace Header */}
      <header className="flex flex-wrap items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30 inline-flex items-center justify-center shadow-sm">
          <Inbox className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-ui-2xl font-semibold text-foreground tracking-tight">Idea review workspace</h1>
            {counts.pending > 0 ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-ui-xs font-semibold text-amber-700 dark:text-amber-300">
                {counts.pending} awaiting review
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-ui-xs font-semibold text-emerald-700 dark:text-emerald-300">
                All caught up
              </span>
            )}
          </div>
          <p className="text-ui-sm text-muted-foreground mt-0.5">
            Compare every submitted use case on the Value vs. Feasibility map, click any node to inspect its business case, and approve or return revisions.
          </p>
        </div>
        <button
          onClick={() => { void load(); void actions?.reload(); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          title="Refresh review queue"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      {canReview === false && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-ui-sm text-amber-700 dark:text-amber-300">
          The server has not granted this account reviewer capability. You can inspect the queue and map, but review actions are disabled.
        </div>
      )}

      {/* Overall Page Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={cx(
            'text-left rounded-2xl border p-4 transition-all',
            statusFilter === 'pending'
              ? 'border-amber-500/60 bg-amber-500/[0.08] ring-2 ring-amber-500/20 shadow-sm'
              : 'border-border bg-card hover:border-amber-500/40',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-xs font-medium text-muted-foreground">Needs review</span>
            <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 inline-flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-ui-3xl font-semibold tabular-nums text-foreground">{counts.pending}</span>
            <span className="text-ui-xs text-muted-foreground">pending</span>
          </div>
          <p className="mt-1 text-ui-2xs text-muted-foreground">
            {counts.pending === 0 ? 'Queue is clear' : 'Click to filter pending submissions'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
          className={cx(
            'text-left rounded-2xl border p-4 transition-all',
            statusFilter === 'approved'
              ? 'border-emerald-500/60 bg-emerald-500/[0.08] ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-border bg-card hover:border-emerald-500/40',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-xs font-medium text-muted-foreground">Approved & live</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-ui-3xl font-semibold tabular-nums text-foreground">{counts.approved}</span>
            <span className="text-ui-xs text-muted-foreground">of {counts.all} total</span>
          </div>
          <p className="mt-1 text-ui-2xs text-muted-foreground">
            Cleared to build & visible in Library
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'changes_requested' ? 'all' : 'changes_requested')}
          className={cx(
            'text-left rounded-2xl border p-4 transition-all',
            statusFilter === 'changes_requested' || statusFilter === 'rejected'
              ? 'border-sky-500/60 bg-sky-500/[0.08] ring-2 ring-sky-500/20 shadow-sm'
              : 'border-border bg-card hover:border-sky-500/40',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-xs font-medium text-muted-foreground">Returned / Rejected</span>
            <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 inline-flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-ui-3xl font-semibold tabular-nums text-foreground">
              {counts.changes_requested + counts.rejected}
            </span>
            <span className="text-ui-xs text-muted-foreground">
              {counts.changes_requested} changes · {counts.rejected} rejected
            </span>
          </div>
          <p className="mt-1 text-ui-2xs text-muted-foreground">
            Sent back with reviewer notes
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className="text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-xs font-medium text-muted-foreground">Portfolio value & readiness</span>
            <span className="w-8 h-8 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-ui-3xl font-semibold tabular-nums text-foreground">
              {portfolioStats.totalAnnual > 0 ? `${money(portfolioStats.totalAnnual)}/yr` : `${portfolioStats.investOrQuickWin}`}
            </span>
          </div>
          <p className="mt-1 text-ui-2xs text-muted-foreground">
            {portfolioStats.investOrQuickWin} in Invest Now / Quick Win · {counts.all} on map
          </p>
        </button>
      </div>

      {!items.length && !detail ? (
        <EmptyState
          icon={<Check className="w-6 h-6" />}
          title="You’re all caught up"
          body="New Ideate approval requests will appear here and plot on the Value vs. Feasibility map."
        />
      ) : (
        <div className="space-y-6">
          {/* Full-Portfolio Value vs. Feasibility Map */}
          {selectedAssessment && (
            <PriorityMatrix
              current={selectedAssessment}
              portfolio={portfolio}
              portfolioLimit={null}
              highlightedIds={highlightedIds}
              hideSummaryCards
              onSelectIdea={handleSelectFromMap}
              onOpenIdea={handleOpenIdea}
              subtitle="All submitted use cases are plotted with their names and review status. Click any use case on the map to inspect its details and take action below."
            />
          )}

          {/* Split Queue List + Selected Use Case Detail & Review Inspector */}
          <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)] items-start">
            {/* Left Queue Rail */}
            <aside className="rounded-2xl border border-border bg-card p-3.5 xl:sticky xl:top-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-ui-sm font-semibold text-foreground">Submitted use cases</h2>
                <span className="text-ui-2xs text-muted-foreground tabular-nums">
                  Showing {filtered.length} of {items.length}
                </span>
              </div>

              {/* Status Filter Tabs with Counts */}
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/50 border border-border/60">
                {([
                  ['all', 'All', counts.all],
                  ['pending', 'Pending', counts.pending],
                  ['approved', 'Approved', counts.approved],
                  ['changes_requested', 'Changes', counts.changes_requested],
                  ['rejected', 'Rejected', counts.rejected],
                ] as const).map(([st, label, cnt]) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cx(
                      'flex-1 min-w-fit inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-ui-2xs font-semibold transition-colors',
                      statusFilter === st
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                    )}
                  >
                    <span>{label}</span>
                    <span className={cx('tabular-nums', statusFilter === st ? 'opacity-80' : 'opacity-60')}>
                      {cnt}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter by title, owner, industry…"
                  className="w-full rounded-xl bg-secondary/60 pl-8 pr-3 py-2 text-ui-sm text-foreground outline-none border border-transparent focus:border-primary/40"
                />
              </div>

              {/* Use Case Cards */}
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-ui-sm font-medium text-foreground">No matching use cases</p>
                  <p className="text-ui-xs text-muted-foreground mt-1">
                    {statusFilter !== 'all'
                      ? `No submissions in "${statusFilter.replace('_', ' ')}".`
                      : 'Try clearing your search filter.'}
                  </p>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-secondary text-ui-xs font-semibold text-foreground hover:bg-secondary/80"
                    >
                      Show all ({items.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-0.5 lib-scroll">
                  {filtered.map(item => {
                    const isSelected = selectedId === item.id;
                    const stMeta = STATUS_BADGE[item.review.status] ?? STATUS_BADGE.pending;
                    const a = assessmentById.get(item.id);
                    const annual = annualValueOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectFromMap(item.id)}
                        className={cx(
                          'w-full text-left rounded-xl p-3 transition-all border',
                          isSelected
                            ? 'bg-primary/[0.08] border-primary/40 ring-1 ring-primary/25 shadow-sm'
                            : 'bg-background/40 border-border/60 hover:bg-secondary/50 hover:border-border',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-ui-sm font-semibold text-foreground line-clamp-2 leading-snug">
                            {item.title}
                          </p>
                          <span className={cx('shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-ui-3xs font-semibold', stMeta.cls)}>
                            <span className={cx('w-1.5 h-1.5 rounded-full', stMeta.dot)} />
                            {item.review.status === 'changes_requested'
                              ? 'Changes'
                              : item.review.status[0].toUpperCase() + item.review.status.slice(1)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-2xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 text-foreground/80 font-medium">
                            <Avatar email={item.owner?.email} size="xs" />
                            {item.owner?.displayName || item.owner?.email || 'Unknown'}
                          </span>
                          {item.industry && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[8rem]">{item.industry}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>rev {item.review.revision}</span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-ui-2xs">
                          {a ? (
                            <span className="font-semibold text-primary tabular-nums">
                              {a.value}V · {a.feasibility}F ({a.quadrant})
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unscored</span>
                          )}
                          {annual && (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {money(annual)}/yr
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* Right Selected Use Case Inspector */}
            <div className="min-w-0">
              {detailLoading && !selectedIdea ? (
                <div className="rounded-2xl border border-border bg-card p-12 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : activeDetail && selectedIdea ? (
                <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  {/* Inspector Header */}
                  <div className="p-5 sm:p-6 border-b border-border bg-gradient-to-br from-primary/[0.05] via-card to-card">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-ui-xs font-semibold', statusMeta.cls)}>
                        <span className={cx('w-2 h-2 rounded-full', statusMeta.dot)} />
                        {statusMeta.label}
                      </span>
                      {selectedAssessment && (
                        <span className={cx('rounded-full border px-2.5 py-1 text-ui-xs font-semibold', QUADRANT_BADGE[selectedAssessment.quadrant] ?? QUADRANT_BADGE['Rework or park'])}>
                          {selectedAssessment.quadrant}
                        </span>
                      )}
                      {selectedAssessment && (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-ui-xs text-muted-foreground">
                          {selectedAssessment.confidence} confidence
                        </span>
                      )}
                      {expectedAnnual && (
                        <span className="ml-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-ui-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {money(expectedAnnual)}/yr expected
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-ui-xs font-semibold uppercase tracking-wide text-primary">
                          Submitted use case · revision {activeDetail.review.revision}
                          {activeDetail.industry ? ` · ${activeDetail.industry}` : ''}
                        </p>
                        <h2 className="text-ui-2xl font-semibold text-foreground mt-1">{selectedIdea.title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-ui-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                            <Avatar email={activeDetail.owner?.email} size="xs" />
                            {activeDetail.owner?.displayName || activeDetail.owner?.email || 'Unknown owner'}
                          </span>
                          {activeDetail.review.submittedAt && (
                            <span className="text-ui-xs">
                              Submitted {new Date(activeDetail.review.submittedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {linkedLibraryUc && onOpenUseCase && (
                        <button
                          onClick={() => onOpenUseCase(linkedLibraryUc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/70 text-ui-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                          Open in Library drawer
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 space-y-6">
                    {/* Prominent Review Decision / Status Bar at Top of Inspector */}
                    {activeStatus === 'pending' ? (
                      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.05] p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label htmlFor="reviewer-note-input" className="text-ui-sm font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            Review decision for revision {activeDetail.review.revision}
                          </label>
                          <span className="text-ui-2xs text-muted-foreground">
                            Note required when requesting changes or rejecting
                          </span>
                        </div>
                        <textarea
                          id="reviewer-note-input"
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          rows={2}
                          placeholder="Add reviewer feedback or approval notes for the owner…"
                          className="mt-1 w-full rounded-xl bg-background/80 px-3.5 py-2.5 text-ui-sm text-foreground outline-none border border-border focus:border-primary/50"
                        />
                        <div className="flex flex-wrap items-center gap-2.5 mt-3">
                          <button
                            disabled={!canReview || !!acting}
                            onClick={() => void decide('approve')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-ui-sm font-semibold shadow-sm transition-colors disabled:opacity-40"
                          >
                            {acting === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Approve & publish
                          </button>
                          <button
                            disabled={!canReview || !!acting || !note.trim()}
                            onClick={() => void decide('changes_requested')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-ui-sm font-semibold transition-colors disabled:opacity-40"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return for changes
                          </button>
                          <button
                            disabled={!canReview || !!acting || !note.trim()}
                            onClick={() => void decide('reject')}
                            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-ui-sm font-semibold transition-colors disabled:opacity-40"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cx(
                          'rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4',
                          activeStatus === 'approved'
                            ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                            : activeStatus === 'changes_requested'
                              ? 'border-sky-500/30 bg-sky-500/[0.06]'
                              : 'border-rose-500/30 bg-rose-500/[0.06]',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-ui-sm font-semibold text-foreground flex items-center gap-2">
                            {activeStatus === 'approved' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-sky-500 shrink-0" />
                            )}
                            <span>
                              Review status: <strong className="capitalize">{activeStatus.replace('_', ' ')}</strong>
                            </span>
                            {activeDetail.review.reviewer && (
                              <span className="text-ui-xs font-normal text-muted-foreground">
                                by {activeDetail.review.reviewer}
                              </span>
                            )}
                          </p>
                          {activeDetail.review.latestNote ? (
                            <p className="text-ui-xs text-muted-foreground mt-1">
                              Reviewer note: “{activeDetail.review.latestNote}”
                            </p>
                          ) : (
                            <p className="text-ui-xs text-muted-foreground mt-1">
                              {activeStatus === 'approved'
                                ? 'This use case is approved for building and active in the Use Case Library.'
                                : 'The owner can update their idea and submit a new revision.'}
                            </p>
                          )}
                        </div>

                        {activeStatus === 'approved' && !String(activeDetail.id).startsWith('catalog:') && (
                          (detail?.isOwner || (!!currentUser && activeDetail.owner?.email === currentUser)) ? (
                            <button
                              onClick={() => navigate(`/?buildIdea=${encodeURIComponent(activeDetail.id)}`)}
                              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold shadow-sm hover:opacity-90"
                            >
                              Start building
                            </button>
                          ) : null
                        )}
                      </div>
                    )}

                    {/* Value & Feasibility Evidence Breakdown */}
                    {selectedAssessment && (
                      <PriorityScoreDetails assessment={selectedAssessment} />
                    )}

                    {/* Submitted One-Pager Brief */}
                    <div>
                      <h3 className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                        Submitted One-Pager Brief
                      </h3>
                      <div className="prose-sm max-w-none rounded-2xl border border-border bg-background/50 p-5 sm:p-6">
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                          {selectedIdea.brief || 'No brief was included.'}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Review History */}
                    {!!activeDetail.review.history?.length && (
                      <details className="rounded-xl border border-border bg-background/30 px-4 py-3">
                        <summary className="cursor-pointer text-ui-sm font-medium text-foreground inline-flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          Review history ({activeDetail.review.history.length})
                        </summary>
                        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                          {activeDetail.review.history.map((event, index) => (
                            <p key={`${event.at}-${index}`} className="text-ui-xs text-muted-foreground">
                              <span className="font-semibold text-foreground capitalize">{event.action.replace('_', ' ')}</span>
                              {' · '}rev {event.revision}
                              {event.by ? ` · ${event.by}` : ''}
                              {event.note ? ` — “${event.note}”` : ''}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
