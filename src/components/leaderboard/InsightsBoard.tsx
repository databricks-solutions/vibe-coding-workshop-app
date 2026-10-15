import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Flame, Lightbulb, Loader2, Mountain, Sparkles } from 'lucide-react';
import { apiClient, type InsightsLeaderboardEntry } from '../../api/client';
import { IDEA_OUTCOME_POINTS, IDEA_POINTS_MAX, IDEA_QUALITY_MAX, IDEA_TIERS } from '../../constants/scoring';
import { SummitTrail, TierBadge, money, scoreTone, trailFromSummary } from '../journeykit';
import { MovementIndicator, RankBadge, RowConfetti } from './LeaderboardParts';
import { formatRelativeTime, rankRowClasses, withMovement, type Movement } from './ranking';

type Row = InsightsLeaderboardEntry & { movement: Movement; rankChange?: number };
type Source = 'all' | 'ideate' | 'insights';

const STATUS_LABEL: Record<InsightsLeaderboardEntry['status'], { label: string; cls: string }> = {
  exploring: { label: 'Exploring', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  committed: { label: 'Committed', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  parked: { label: 'Parked', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  submitted: { label: 'Submitted', cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  approved: { label: 'In the library', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  shaping: { label: 'Shaping', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  building: { label: 'Building Genie', cls: 'bg-primary/10 text-primary' },
  live: { label: 'Genie live', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const SOURCES: { key: Source; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ideate', label: 'Ideate' },
  { key: 'insights', label: 'Insights builds' },
];

function QualityBars({ dims }: { dims: InsightsLeaderboardEntry['dimensions'] }) {
  if (!dims.length) return <span className="text-ui-2xs text-muted-foreground/70">Not scored yet</span>;
  return (
    <span className="inline-flex items-end gap-0.5 h-4" title={dims.map(d => `${d.label}: ${d.score}`).join('\n')} aria-label="Quality by dimension">
      {dims.map(d => (
        <span key={d.key} className="w-1.5 h-4 rounded-sm bg-secondary overflow-hidden flex items-end">
          <span className={`w-full rounded-sm ${scoreTone(d.score)}`} style={{ height: `${Math.max(8, d.score)}%` }} />
        </span>
      ))}
    </span>
  );
}

function IdeaRow({ entry, index, onOpen }: { entry: Row; index: number; onOpen: () => void }) {
  const isFirst = entry.rank === 1;
  const isTop3 = entry.rank <= 3;
  const status = STATUS_LABEL[entry.status];
  const trail = trailFromSummary({ mode: entry.mode, approved: entry.approved, step: entry.step, locked: entry.status === 'building' || entry.status === 'live', built: entry.status === 'live' });

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 animate-leaderboard-slide-in ${rankRowClasses(entry.rank)} ${entry.is_mine ? 'ring-1 ring-primary/40' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {isFirst && <RowConfetti />}
      <RankBadge rank={entry.rank} />

      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl ${isFirst ? 'bg-amber-500/20 ring-2 ring-amber-500/50' : 'bg-secondary'}`}>
        {entry.avatar}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold truncate ${isFirst ? 'text-amber-400' : 'text-foreground'}`}>{entry.title || 'Untitled idea'}</h3>
          {isFirst && <Flame className="w-4 h-4 shrink-0 text-orange-500 animate-pulse" />}
        </div>
        <p className="text-ui-xs text-muted-foreground truncate">
          {entry.display_name}{entry.is_mine && <span className="text-primary font-medium"> (you)</span>}
          {entry.industry && <><span className="text-muted-foreground/50"> • </span>{entry.industry}</>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-2xs font-medium bg-secondary text-muted-foreground">
            {entry.mode === 'insights' ? <Mountain className="w-2.5 h-2.5" /> : <Lightbulb className="w-2.5 h-2.5" />}
            {entry.mode === 'insights' ? 'Insights build' : 'Ideate'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-ui-2xs font-semibold ${status.cls}`}>{status.label}</span>
          <TierBadge total={entry.total} size="xs" />
          {!!entry.value_per_year && entry.value_per_year > 0 && (
            <span className="text-ui-2xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{money(entry.value_per_year)}/yr</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 min-w-0 max-w-[16rem]"><SummitTrail size="xs" {...trail} /></div>
          <QualityBars dims={entry.dimensions} />
        </div>
      </div>

      <div className="relative shrink-0 text-right pr-4">
        <div className={`text-2xl font-bold tabular-nums ${isFirst ? 'text-amber-400' : isTop3 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {entry.total.toLocaleString()}
        </div>
        <div className="text-ui-2xs text-muted-foreground uppercase tracking-wider">points</div>
        {entry.updated_at && <div className="mt-1 text-ui-2xs text-muted-foreground/60">{formatRelativeTime(entry.updated_at)}</div>}
        <MovementIndicator movement={entry.movement} rankChange={entry.rankChange} />
      </div>
    </button>
  );
}

/** Ideas from Ideate and the Insights flow, one row per idea, ranked by Idea Points. */
export function InsightsBoard({ refreshTick, onRefreshing, onUpdated, frozen }: {
  refreshTick: number;
  onRefreshing?: (on: boolean) => void;
  onUpdated?: (at: Date) => void;
  /** An archived season's rows: shown as they stood, nothing is fetched. */
  frozen?: InsightsLeaderboardEntry[];
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<Source>('all');
  const [industry, setIndustry] = useState('');
  const [visible, setVisible] = useState(10);
  const ranks = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    if (frozen) {
      const kept = frozen.filter(e => (source === 'all' || e.mode === source) && (!industry || e.industry === industry));
      setRows(kept.map((e, i) => ({ ...e, rank: i + 1, is_mine: false, movement: 'same' as Movement })));
      setLoading(false);
      return;
    }
    onRefreshing?.(true);
    try {
      const data = await apiClient.insightsLeaderboard({ limit: 100, mode: source === 'all' ? undefined : source, industry: industry || undefined });
      const next = withMovement(data, ranks.current, e => e.idea_id);
      ranks.current = next.ranks;
      setRows(next.rows);
      setError(false);
      onUpdated?.(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      onRefreshing?.(false);
    }
  }, [source, industry, onRefreshing, onUpdated, frozen]);

  useEffect(() => { ranks.current = new Map(); }, [source, industry]);
  useEffect(() => { void load(); }, [load, refreshTick]);

  useEffect(() => {
    if (!rows.some(r => r.movement !== 'same')) return;
    const t = setTimeout(() => setRows(prev => prev.map(r => ({ ...r, movement: 'same' as Movement, rankChange: undefined }))), 3000);
    return () => clearTimeout(t);
  }, [rows]);

  const industries = useMemo(() => [...new Set((frozen ?? rows).map(r => r.industry).filter(Boolean))].sort(), [rows, frozen]);
  const mine = rows.filter(r => r.is_mine);
  const best = mine.length ? mine.reduce((a, b) => (a.rank < b.rank ? a : b)) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-secondary p-0.5" role="group" aria-label="Source">
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => { setSource(s.key); setVisible(10); }}
              aria-pressed={source === s.key}
              className={`px-3 py-1 rounded-md text-ui-xs font-medium transition-colors ${source === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {(industries.length > 1 || industry) && (
          <select
            value={industry}
            onChange={e => { setIndustry(e.target.value); setVisible(10); }}
            className="h-7 rounded-lg border border-border bg-card px-2 text-ui-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Industry"
          >
            <option value="">All industries</option>
            {(industry && !industries.includes(industry) ? [industry, ...industries] : industries).map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        {best && (
          <span className="ml-auto text-ui-xs text-muted-foreground">
            Your best idea is <span className="font-semibold text-foreground">#{best.rank}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      ) : error && !rows.length ? (
        <div className="py-20 text-center text-muted-foreground">Couldn't load the leaderboard. Try refreshing.</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Mountain className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No ideas on the board yet</h2>
          <p className="text-muted-foreground max-w-md mb-5">Shape an idea in Ideate or the Insights flow. Every stop on the climb earns points, and a sharp brief earns the most.</p>
          <button onClick={() => navigate('/ideate')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-ui-sm font-medium hover:bg-primary/90">
            <Lightbulb className="w-4 h-4" /> Start an idea
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, visible).map((entry, i) => (
            <IdeaRow key={entry.idea_id} entry={entry} index={i} onOpen={() => navigate(`/ideate/view/${encodeURIComponent(entry.idea_id)}`)} />
          ))}
        </div>
      )}

      {!loading && rows.length > visible && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setVisible(v => v + 10)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-ui-base font-medium transition-colors border border-border"
          >
            <ChevronDown className="w-4 h-4" />
            Show 10 more ({rows.length - visible} remaining)
          </button>
        </div>
      )}

      <div className="mt-8 p-4 bg-card rounded-xl border border-border">
        <h3 className="text-ui-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          How Idea Points work
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-ui-xs">
          <div>
            <div className="flex justify-between"><span className="text-muted-foreground">The climb</span><span className="text-foreground font-medium">up to 300</span></div>
            <p className="mt-1 text-muted-foreground/80">Each approved stop, real answers, sized value, and going deeper.</p>
          </div>
          <div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quality</span><span className="text-foreground font-medium">up to {IDEA_QUALITY_MAX}</span></div>
            <p className="mt-1 text-muted-foreground/80">An AI reviewer scores the brief: problem, users, value, feasibility, risks, writing.</p>
          </div>
          <div>
            <div className="flex justify-between"><span className="text-muted-foreground">Outcome</span><span className="text-foreground font-medium">up to {IDEA_OUTCOME_POINTS.first + IDEA_OUTCOME_POINTS.second}</span></div>
            <p className="mt-1 text-muted-foreground/80">Submitted to the library and approved, or the Genie built.</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-ui-xs">
          <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
            Tiers: {IDEA_TIERS.map(t => <TierBadge key={t.key} total={t.floor} size="xs" />)}
          </span>
          <span><span className="text-muted-foreground">Maximum possible score </span><span className="text-primary font-bold">{IDEA_POINTS_MAX.toLocaleString()} points</span></span>
        </div>
      </div>
    </div>
  );
}
