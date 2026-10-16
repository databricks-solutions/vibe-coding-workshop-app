import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calculateIdeaScore } from '../../constants/scoring';
import { apiClient } from '../../api/client';
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock, Copy, Hammer, History, Inbox, Lightbulb, Menu, MoreHorizontal, Pencil, RotateCcw, Send, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  ApprovalTracker, ART, BUILD_TARGET_LABEL, IndustryBadge, MakeItMineButton, PrimaryButton, ReviewDialog, SAMPLES, STEP_ART, SubmitDialog, SummitTrail,
  isApproved, personName, useReviewRefresh, useReviewer, SurfaceChips, TierBadge, VoiceTextarea,
  caseFigures, chosenShape, ideaProgressSteps, ideaTrail, isBuilding, money, needsBuildUpdate, openBuildHref, shapeBuild, startBuildHref, stepMeta, stepsOf, useEnabledAddOns, useIdeas,
  type Idea, type IdeaStatus,
} from '../journeykit';

const STATUS: Record<IdeaStatus, { label: string; cls: string }> = {
  exploring: { label: 'Exploring', cls: 'bg-sky-500/10 text-sky-400' },
  committed: { label: 'Committed', cls: 'bg-emerald-500/10 text-emerald-400' },
  parked: { label: 'Parked', cls: 'bg-amber-500/10 text-amber-400' },
};

const PROMPTS = [
  'Field techs waste hours finding the right repair manual…',
  'Claims adjusters re-key the same data into three systems…',
  'Store managers never know which shelves will run empty…',
];

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const approvedForBuild = isApproved;

/** What just happened to an idea, so the home page can point at it and say what to do next. */
type CoachEvent = 'submitted' | 'approved' | 'changes_requested' | 'rejected';
interface Coach { id: string; event: CoachEvent; by?: string | null; self?: boolean }
const COACH_EVENTS = new Set<CoachEvent>(['submitted', 'approved', 'changes_requested', 'rejected']);

/** Ideate hands approved ideas to Insights. A stale Technical link starts a fresh Insights project. */
const insightsBuildHref = (idea: Idea) =>
  `${startBuildHref(idea)}&target=insights${idea.sessionId && idea.buildTarget !== 'insights' ? '&fresh=1' : ''}`;

export function IdeasHome({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { ideas, createIdea, updateIdea, deleteIdea, duplicateIdea } = useIdeas();
  useEnabledAddOns();
  const navigate = useNavigate();
  const [seed, setSeed] = useState('');
  const [industry, setIndustry] = useState('');
  const [filter, setFilter] = useState<IdeaStatus | 'all' | 'pending' | 'changes_requested' | 'rejected' | 'approved' | 'building'>('all');
  const [sort, setSort] = useState<'recent' | 'value'>('recent');
  const [submitting, setSubmitting] = useState<Idea | null>(null);
  const [reviewing, setReviewing] = useState<Idea | null>(null);
  const me = useReviewer();
  const canReview = me.canReview;
  const [promptIdx, setPromptIdx] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [pulse, setPulse] = useState<{ id: string; n: number } | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  const spotlight = (next: Coach) => {
    setCoach(next);
    setPulse(p => ({ id: next.id, n: (p?.n ?? 0) + 1 }));
  };

  const focusParam = searchParams.get('focus');
  const [seenFocus, setSeenFocus] = useState<string | null>(null);
  if (focusParam !== seenFocus) {
    setSeenFocus(focusParam);
    if (focusParam) {
      const event = searchParams.get('event') as CoachEvent | null;
      setFilter('all');
      spotlight({ id: focusParam, event: event && COACH_EVENTS.has(event) ? event : 'submitted' });
    }
  }

  useEffect(() => {
    if (!focusParam) return;
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('event');
    setSearchParams(next, { replace: true });
  }, [focusParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (!pulse) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = requestAnimationFrame(() =>
      document.getElementById(`idea-card-${pulse.id}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [pulse]);

  const coachIdea = coach ? ideas.find(i => i.id === coach.id) : undefined;
  const anyPending = ideas.some(i => i.review?.status === 'pending');
  useReviewRefresh(anyPending, changes => {
    const decided = changes.find(c => c.from === 'pending' && c.idea.review?.status !== 'pending' && c.idea.review?.status !== 'draft');
    if (!decided) return;
    const status = decided.idea.review!.status as CoachEvent;
    spotlight({ id: decided.idea.id, event: status, by: decided.idea.review?.reviewer });
  });

  useEffect(() => {
    if (!canReview) return;
    let alive = true;
    const load = () => void apiClient.ideaReviews('pending')
      .then(list => alive && setQueueCount(list.filter(r => r.owner?.email?.toLowerCase() !== me.email).length))
      .catch(() => undefined);
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [canReview, me.email]);

  useEffect(() => {
    if (seed) return;
    const t = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 3500);
    return () => clearInterval(t);
  }, [seed]);

  const start = () => {
    if (!seed.trim()) return;
    const idea = createIdea(seed.trim(), industry.trim());
    navigate(`/ideate/${idea.id}`);
  };

  const values = useMemo(() => new Map(ideas.map(i => [i.id, caseFigures(i)?.value.expected ?? 0])), [ideas]);
  const visible = useMemo(() => {
    const list = ideas.filter(i =>
      filter === 'all' || (filter === 'building'
        ? isBuilding(i) && i.buildStatus !== 'later'
        : ['pending', 'changes_requested', 'rejected', 'approved'].includes(filter)
          ? (filter === 'approved'
            ? i.review?.status === 'approved' && i.review.approvedRevision === (i.revision ?? 0)
            : i.review?.status === filter)
          : i.status === filter));
    return sort === 'value' ? [...list].sort((a, b) => (values.get(b.id) ?? 0) - (values.get(a.id) ?? 0)) : list;
  }, [ideas, filter, sort, values]);
  const reviewFilters = (['pending', 'changes_requested', 'rejected', 'approved'] as const).filter(s => ideas.some(i =>
    s === 'approved' ? i.review?.status === s && i.review.approvedRevision === (i.revision ?? 0) : i.review?.status === s));
  const anyBuilding = ideas.some(i => isBuilding(i) && i.buildStatus !== 'later');
  const sized = ideas.filter(i => i.status !== 'parked' && (values.get(i.id) ?? 0) > 0);
  const portfolio = sized.reduce((a, i) => a + (values.get(i.id) ?? 0), 0);
  const open = (idea: Idea) => {
    if (isBuilding(idea) && idea.buildStatus !== 'later') {
      navigate(idea.buildTarget === 'insights' || idea.mode === 'insights'
        ? openBuildHref(idea)!
        : approvedForBuild(idea)
          ? insightsBuildHref(idea)
          : `/ideate/${idea.id}`);
      return;
    }
    navigate(idea.mode === 'insights' ? (openBuildHref(idea) ?? '/?view=insights') : `/ideate/${idea.id}`);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-5 py-8 md:py-12">
        {onOpenMobileNav && (
          <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 mb-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,320px)] mb-6 animate-fade-in">
          <div>
            <p className="flex items-center gap-2 text-ui-sm font-medium text-primary">
              <Lightbulb className="w-4 h-4" /> Ideate
              <span className="px-1.5 py-0.5 rounded text-ui-2xs font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400">Beta</span>
            </p>
            <h1 className="text-ui-3xl font-semibold text-foreground leading-tight mt-2">Say the messy version.<br />I'll ask the questions.</h1>
            <p className="text-ui-base text-muted-foreground mt-3 max-w-md">
              A few short steps turn a rough idea into a one-page brief and a business case you can submit. You pick, the AI does the heavy lifting.
            </p>
          </div>
          <img src={ART.hero} alt="" width={320} height={213} className="hidden md:block w-full rounded-3xl" />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm animate-slide-up-fade">
          <VoiceTextarea
            value={seed}
            onChange={setSeed}
            size="lg"
            rows={3}
            autoFocus
            placeholder={PROMPTS[promptIdx]}
            onSubmit={start}
          />
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="flex-1 min-w-[10rem] bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
              onKeyDown={e => e.key === 'Enter' && start()}
            />
            <PrimaryButton onClick={start} disabled={!seed.trim()}>
              Start ideating <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </div>
        </div>

        {ideas.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-ui-lg font-semibold text-foreground mr-2">My ideas</h2>
              {(['all', 'exploring', 'parked', ...reviewFilters, ...(anyBuilding ? ['building' as const] : [])] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-ui-xs font-medium transition-colors ${filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {f === 'all' ? `All ${ideas.length}` : f === 'pending' ? 'Pending approval' : f === 'changes_requested' ? 'Changes requested' : f === 'rejected' ? 'Rejected' : f === 'approved' ? 'Approved' : f === 'building' ? 'Building' : STATUS[f].label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3">
                {queueCount > 0 && (
                  <button
                    onClick={() => navigate('/library/review')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-ui-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    title="Ideas from other people waiting for an approver"
                  >
                    <Inbox className="w-3.5 h-3.5" /> {queueCount} waiting for your review
                  </button>
                )}
                {portfolio > 0 && (
                  <span className="hidden sm:inline text-ui-xs text-muted-foreground" title="Sum of the expected yearly value of ideas that are not parked">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{money(portfolio)}</span> a year across {sized.length} idea{sized.length === 1 ? '' : 's'}
                  </span>
                )}
                <button onClick={() => setSort(x => (x === 'recent' ? 'value' : 'recent'))} className="px-2 py-1 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary">
                  {sort === 'recent' ? 'Sort by value' : 'Sort by recent'}
                </button>
              </div>
            </div>
            {coachIdea && coach && (
              <CoachBanner
                key={`${coach.id}-${coach.event}`}
                coach={coach}
                idea={coachIdea}
                canReview={canReview}
                everyone={me.everyone}
                onReview={() => setReviewing(coachIdea)}
                onBuild={() => navigate(insightsBuildHref(coachIdea))}
                onOpen={() => navigate(`/ideate/${coachIdea.id}`)}
                onDismiss={() => setCoach(null)}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((idea, i) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  delay={i * 50}
                  value={values.get(idea.id) ?? 0}
                  onOpen={() => open(idea)}
                  onBuild={() => navigate(insightsBuildHref(idea))}
                  onRename={title => updateIdea(idea.id, { title })}
                  onDuplicate={() => duplicateIdea(idea.id)}
                  onDelete={() => deleteIdea(idea.id)}
                  onSubmit={() => setSubmitting(idea)}
                  onReview={canReview ? () => setReviewing(idea) : undefined}
                  spotlit={pulse?.id === idea.id ? pulse.n : 0}
                />
              ))}
              {visible.length === 0 && (
                <div className="sm:col-span-2 flex flex-col items-center py-6 text-center">
                  <img src={ART.empty} alt="" width={200} height={133} className="w-48 rounded-2xl opacity-90" />
                  <p className="text-ui-sm text-muted-foreground mt-3">
                    No matching ideas yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <SamplesSection onOpen={id => navigate(`/ideate/${id}`)} />
      </div>
      {submitting && <SubmitDialog idea={ideas.find(i => i.id === submitting.id) ?? submitting} onClose={() => setSubmitting(null)} />}
      {reviewing && (
        <ReviewDialog
          idea={ideas.find(i => i.id === reviewing.id) ?? reviewing}
          onClose={() => setReviewing(null)}
          onDecided={action => spotlight({
            id: reviewing.id,
            event: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested',
            by: me.email,
            self: true,
          })}
          onStartBuild={() => {
            const idea = ideas.find(i => i.id === reviewing.id) ?? reviewing;
            setReviewing(null);
            navigate(insightsBuildHref(idea));
          }}
        />
      )}
    </div>
  );
}

interface IdeaCardProps {
  idea: Idea;
  delay: number;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onBuild: () => void;
  onReview?: () => void;
  value: number;
  /** Bumps each time the card should draw attention; 0 for no spotlight. */
  spotlit: number;
}

function IdeaCard({ idea, delay, value, onOpen, onRename, onDuplicate, onDelete, onSubmit, onBuild, onReview, spotlit }: IdeaCardProps) {
  const building = isBuilding(idea);
  const later = idea.buildStatus === 'later';
  const reviewApproved = approvedForBuild(idea);
  const canBuild = idea.mode !== 'insights' && !!idea.brief && ((reviewApproved && !building) || (building && later));
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const score = calculateIdeaScore(idea);
  const stepLabel = stepMeta(idea, idea.step).label;
  const status = STATUS[idea.status];
  const StepIcon = STEP_ART[idea.step].icon;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setMenu(false); setConfirmDelete(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const reviewStatus = idea.review?.status;
  const action: CardAction | null =
    canBuild ? { kind: 'build', label: later ? 'Resume build' : 'Start building', onClick: onBuild }
    : idea.buildTarget === 'technical' && building && reviewApproved ? { kind: 'build', label: 'Move to Insights', onClick: onBuild }
    : reviewStatus === 'pending' && onReview ? { kind: 'review', label: 'Review & approve', onClick: onReview }
    : reviewStatus === 'pending' ? { kind: 'waiting', label: `Waiting for review${idea.review?.submittedAt ? ` · ${timeAgo(idea.review.submittedAt)}` : ''}` }
    : reviewStatus === 'changes_requested' || reviewStatus === 'rejected' ? { kind: 'revise', label: 'Revise and resubmit', onClick: onOpen }
    : idea.status === 'committed' && idea.brief && idea.mode !== 'insights' && !reviewApproved ? { kind: 'submit', label: reviewStatus === 'approved' ? 'Resubmit this revision' : 'Submit for approval', onClick: onSubmit }
    : null;
  const tracked = idea.mode !== 'insights' && !!reviewStatus && reviewStatus !== 'draft';

  return (
    <div
      id={`idea-card-${idea.id}`}
      onClick={() => !renaming && onOpen()}
      className={`group relative text-left rounded-2xl border bg-card/60 p-4 cursor-pointer scroll-mt-24 transition-colors hover:border-primary/40 hover:bg-card animate-cascade-in ${spotlit ? 'border-primary/50 bg-card' : 'border-border'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {spotlit > 0 && <span key={spotlit} aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl animate-spotlight" />}
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0" title={`At: ${stepLabel}`}>
          <StepIcon className="w-4 h-4" />
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={idea.title}
            onClick={e => e.stopPropagation()}
            onBlur={e => { onRename(e.target.value.trim() || idea.title); setRenaming(false); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(false); }}
            className="flex-1 bg-transparent text-ui-base font-semibold outline-none border-b border-primary/50"
          />
        ) : (
          <p className="flex-1 text-ui-base font-semibold text-foreground line-clamp-1 mt-1">{idea.title}</p>
        )}
        <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenu(m => !m)} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary" aria-label="Idea actions">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-popover p-1 shadow-lg animate-scale-in">
              <MenuItem icon={Pencil} label="Rename" onClick={() => { setRenaming(true); setMenu(false); }} />
              <MenuItem icon={Copy} label="Duplicate" onClick={() => { onDuplicate(); setMenu(false); }} />
              <MenuItem
                icon={Trash2}
                label={confirmDelete ? 'Click to confirm' : 'Delete'}
                danger
                onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              />
            </div>
          )}
        </div>
      </div>
      <p className="text-ui-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5em]">{idea.spark?.statement ?? idea.seed}</p>
      {(idea.review?.status === 'changes_requested' || idea.review?.status === 'rejected') && idea.review.note && (
        <p className={`mt-2 rounded-lg px-2.5 py-2 text-ui-xs text-muted-foreground line-clamp-2 border-l-2 ${idea.review.status === 'rejected' ? 'bg-red-500/5 border-red-500/60' : 'bg-sky-500/5 border-sky-500/60'}`}>
          <span className="font-semibold text-foreground">{personName(idea.review.reviewer)}:</span> {idea.review.note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3">
        {building && later ? (
          <span className="px-2 py-0.5 rounded-full text-ui-2xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">Build later</span>
        ) : idea.buildTarget && building ? (
          <span className="px-2 py-0.5 rounded-full text-ui-2xs font-semibold bg-primary/10 text-primary">Building in {BUILD_TARGET_LABEL[idea.buildTarget]}</span>
        ) : idea.mode === 'insights' ? (
          <span className="px-2 py-0.5 rounded-full text-ui-2xs font-semibold bg-primary/10 text-primary">{idea.lockedAt ? 'Building in Insights' : 'Shaping in Insights'}</span>
        ) : (
          <span className={`px-2 py-0.5 rounded-full text-ui-2xs font-semibold ${status.cls}`}>{status.label}</span>
        )}
        {needsBuildUpdate(idea) && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-2xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400" title="You changed approved answers. Open the brief to update the build.">
            <History className="w-3 h-3" /> Changes to apply
          </span>
        )}
        {value > 0 && <span className="text-ui-2xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{money(value)}/yr</span>}
        <span className="min-w-0 flex"><IndustryBadge industry={idea.spark?.industry || idea.industry} catalogKey={idea.spark?.catalogIndustry ?? idea.sourceUseCase?.industry} size="sm" /></span>
        <span className="ml-auto shrink-0 text-ui-2xs text-muted-foreground">{stepLabel} · {timeAgo(idea.updatedAt)}</span>
      </div>
      {(tracked || action) && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/60">
          {tracked && <ApprovalTracker idea={idea} building={building && !later} />}
          {action && <CardActionButton action={action} />}
        </div>
      )}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 min-w-0">
          <SummitTrail steps={ideaProgressSteps(idea, null)} size="xs" {...ideaTrail(idea)} />
        </div>
        <TierBadge total={score.total} size="xs" />
        <span className="shrink-0 text-ui-2xs font-semibold tabular-nums text-foreground" title={score.quality == null ? 'Climb and outcome points. Finish the brief for your quality score.' : undefined}>
          {score.total.toLocaleString()} pts
        </span>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ui-sm hover:bg-secondary ${danger ? 'text-red-400' : 'text-foreground'}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

interface CardAction { kind: 'build' | 'review' | 'waiting' | 'revise' | 'submit'; label: string; onClick?: () => void }

const ACTION_STYLE: Record<CardAction['kind'], string> = {
  build: 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
  review: 'bg-amber-500 text-white shadow-sm hover:bg-amber-400 animate-pulse-glow',
  waiting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-default',
  revise: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20',
  submit: 'bg-primary/10 text-primary hover:bg-primary/20',
};
const ACTION_ICON = { build: Hammer, review: ShieldCheck, waiting: Clock, revise: Pencil, submit: Send } as const;

/** The one thing to do next with this idea. */
function CardActionButton({ action }: { action: CardAction }) {
  const Icon = ACTION_ICON[action.kind];
  const cls = `ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-xs font-semibold transition-all active:scale-[0.97] ${ACTION_STYLE[action.kind]}`;
  if (!action.onClick) {
    return <span className={cls} title="Building unlocks as soon as an approver signs off. This card updates on its own."><Icon className="w-3.5 h-3.5" /> {action.label}</span>;
  }
  const run = action.onClick;
  return (
    <button onClick={e => { e.stopPropagation(); run(); }} className={cls}>
      <Icon className="w-3.5 h-3.5" /> {action.label}
      {action.kind === 'build' && <ArrowRight className="w-3.5 h-3.5" />}
    </button>
  );
}

interface CoachBannerProps {
  coach: Coach;
  idea: Idea;
  canReview: boolean;
  everyone: boolean;
  onReview: () => void;
  onBuild: () => void;
  onOpen: () => void;
  onDismiss: () => void;
}

/** One sentence about what just happened to an idea, with the next step one click away. */
function CoachBanner({ coach, idea, canReview, everyone, onReview, onBuild, onOpen, onDismiss }: CoachBannerProps) {
  const status = idea.review?.status;
  const by = coach.self ? 'You' : personName(coach.by ?? idea.review?.reviewer);
  const title = `"${idea.title}"`;
  let copy: { icon: typeof Hammer; tone: string; head: string; body: string; cta?: { label: string; run: () => void } };
  if (isApproved(idea)) {
    copy = {
      icon: CheckCircle2, tone: 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-600 dark:text-emerald-400',
      head: coach.self ? 'Approved. Ready to build.' : `${by} approved ${title}`,
      body: 'Start the Insights build now, or pick it up any time from this card.',
      cta: { label: 'Start building', run: onBuild },
    };
  } else if (status === 'pending') {
    copy = canReview
      ? {
          icon: ShieldCheck, tone: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400',
          head: `Submitted ${title} for approval`,
          body: everyone ? "You're an approver, so you can review and approve it right now." : 'You can review it yourself, or leave it for another approver.',
          cta: { label: 'Review & approve', run: onReview },
        }
      : {
          icon: Clock, tone: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400',
          head: `Submitted ${title} for approval`,
          body: 'An approver takes it from here. This card updates the moment they decide, so there is no need to refresh.',
        };
  } else if (status === 'changes_requested' || status === 'rejected') {
    copy = {
      icon: RotateCcw, tone: status === 'rejected' ? 'border-red-500/30 bg-red-500/[0.05] text-red-500' : 'border-sky-500/30 bg-sky-500/[0.06] text-sky-600 dark:text-sky-400',
      head: status === 'rejected' ? `${by} did not approve ${title}` : `${by} sent ${title} back with notes`,
      body: idea.review?.note || 'Revise the idea and resubmit it.',
      cta: coach.self ? undefined : { label: 'Revise and resubmit', run: onOpen },
    };
  } else {
    return null;
  }
  const Icon = copy.icon;
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 mb-3 animate-slide-up-fade ${copy.tone}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-ui-sm font-semibold text-foreground">{copy.head}</p>
        <p className="text-ui-xs text-muted-foreground mt-0.5 line-clamp-2">{copy.body}</p>
      </div>
      {copy.cta && (
        <button onClick={copy.cta.run} className="shrink-0 self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-ui-xs font-semibold hover:opacity-90 active:scale-[0.97]">
          {copy.cta.label} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onDismiss} className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Finished examples, one per featured industry, to show what a complete idea looks like. */
function SamplesSection({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="mt-12" aria-labelledby="ideate-samples">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 id="ideate-samples" className="flex items-center gap-2 text-ui-lg font-semibold text-foreground">
          <BookOpenCheck className="w-4 h-4 text-primary" /> Samples
        </h2>
        <p className="text-ui-sm text-muted-foreground">Finished ideas from the use case library. Walk through every step, or make one yours.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {SAMPLES.map((sample, i) => <SampleCard key={sample.id} sample={sample} delay={i * 60} onOpen={() => onOpen(sample.id)} />)}
      </div>
    </section>
  );
}

function SampleCard({ sample, delay, onOpen }: { sample: Idea; delay: number; onOpen: () => void }) {
  const shape = chosenShape(sample);
  const figures = caseFigures(sample);
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}
      className="group flex flex-col min-w-0 rounded-2xl border border-border bg-card/60 p-4 cursor-pointer transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 animate-cascade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <IndustryBadge industry={sample.industry} catalogKey={sample.sourceUseCase?.industry} />
        <span className="ml-auto shrink-0 text-ui-2xs text-muted-foreground">All {stepsOf(sample).length} steps</span>
      </div>
      <p className="text-ui-base font-semibold text-foreground mt-3 leading-snug">{sample.title}</p>
      <p className="text-ui-sm text-muted-foreground line-clamp-3 mt-1">{sample.spark?.statement}</p>
      {sample.sourceUseCase && <p className="text-ui-2xs text-muted-foreground/80 mt-2 truncate">From {sample.sourceUseCase.label}</p>}
      {shape && (
        <div className="mt-3 space-y-1.5">
          <p className="text-ui-2xs text-muted-foreground"><span className="text-foreground/80 font-medium">{shape.title}</span> builds</p>
          <SurfaceChips surfaces={shapeBuild(shape).visible} size="sm" />
        </div>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
        {figures && <span className="text-ui-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">~{money(figures.value.expected)}/yr</span>}
        <span className="ml-auto inline-flex items-center gap-1 text-ui-xs font-medium text-primary group-hover:underline">
          View <ArrowRight className="w-3.5 h-3.5" />
        </span>
        <span onClick={e => e.stopPropagation()}><MakeItMineButton idea={sample} size="sm" /></span>
      </div>
    </div>
  );
}
