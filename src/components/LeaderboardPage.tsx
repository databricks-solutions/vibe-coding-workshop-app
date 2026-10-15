/**
 * LeaderboardPage - Kahoot-style gamified leaderboard
 * 
 * Features:
 * - Top 10 users ranked by workshop progress score
 * - Emoji avatars for playful personality
 * - Real-time refresh (manual + auto 10-second interval)
 * - Movement indicators when rankings change
 * - Hover tooltips showing chapter progress
 * - Confetti effect for #1 position
 * - Staggered entrance animations
 */

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Trophy, 
  RefreshCw, 
  Flame, 
  Mountain,
  Code2,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Users,
  X,
  Search,
  ExternalLink,
  History,
} from 'lucide-react';
import { apiClient, type InsightsLeaderboardEntry, type LeaderboardEntry, type LeaderboardSeason, type LeaderboardSeasons, type WorkshopUser, type SessionListItem } from '../api/client';
import { WORKSHOP_LEVELS, type WorkshopLevel } from '../constants/workflowSections';
import { InsightsBoard } from './leaderboard/InsightsBoard';
import { MovementIndicator, RankBadge, RowConfetti } from './leaderboard/LeaderboardParts';
import { formatRelativeTime, rankRowClasses, withMovement, type Movement } from './leaderboard/ranking';

type BoardTab = 'technical' | 'insights';
const BOARD_TABS: { key: BoardTab; label: string; icon: typeof Code2; subtitle: string }[] = [
  { key: 'technical', label: 'Technical', icon: Code2, subtitle: 'Top workshop performers' },
  { key: 'insights', label: 'Insights', icon: Mountain, subtitle: 'Best ideas from Ideate and Insights' },
];

// Sort config for the Workshop Participants modal table
type UsersSortKey = 'display_name' | 'email' | 'workshop_level_label' | 'updated_at';
type SortDir = 'asc' | 'desc';

// Extended entry with movement tracking
interface LeaderboardEntryWithMovement extends LeaderboardEntry {
  movement: Movement;
  rankChange?: number;
}

// Tooltip component for chapter progress
function ChapterTooltip({ 
  completed, 
  inProgress,
  skippedSteps = [],
  workshopLevel,
}: { 
  completed: string[]; 
  inProgress: string[];
  skippedSteps?: number[];
  workshopLevel?: string;
}) {
  const levelLabel = workshopLevel
    ? WORKSHOP_LEVELS[workshopLevel as WorkshopLevel]?.label
    : undefined;

  return (
    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[12.5rem] text-left">
        {levelLabel && (
          <div className="mb-2 pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 text-ui-2xs font-semibold text-primary uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              Workshop Path
            </div>
            <div className="text-ui-xs text-foreground font-medium">
              {levelLabel}
            </div>
          </div>
        )}
        {completed.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-ui-2xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </div>
            <div className="text-ui-xs text-foreground">
              {completed.join(', ')}
            </div>
          </div>
        )}
        {inProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-ui-2xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Circle className="w-3 h-3" />
              In Progress
            </div>
            <div className="text-ui-xs text-muted-foreground">
              {inProgress.join(', ')}
            </div>
          </div>
        )}
        {skippedSteps.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 text-ui-2xs font-semibold text-amber-500/80 uppercase tracking-wider mb-1">
              <SkipForward className="w-3 h-3" />
              {skippedSteps.length} Step{skippedSteps.length !== 1 ? 's' : ''} Skipped
            </div>
            <div className="text-ui-2xs text-muted-foreground/70">
              Steps: {skippedSteps.join(', ')}
            </div>
          </div>
        )}
        {completed.length === 0 && inProgress.length === 0 && !levelLabel && (
          <div className="text-ui-xs text-muted-foreground">No progress yet</div>
        )}
        {/* Arrow */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-border" />
      </div>
    </div>
  );
}

// Single leaderboard row
function LeaderboardRow({ 
  entry, 
  index 
}: { 
  entry: LeaderboardEntryWithMovement; 
  index: number;
}) {
  const isTop3 = entry.rank <= 3;
  const isFirst = entry.rank === 1;
  const pathLabel = entry.workshop_level
    ? WORKSHOP_LEVELS[entry.workshop_level as WorkshopLevel]?.label
    : undefined;

  const rowClasses = `relative group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300
        ${rankRowClasses(entry.rank)}
        animate-leaderboard-slide-in
        ${entry.session_id ? 'cursor-pointer' : ''}`;

  const Wrapper = entry.session_id ? 'a' : 'div';
  const wrapperProps = entry.session_id
    ? { href: `/?sessionId=${entry.session_id}`, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={rowClasses}
      style={{ animationDelay: `${index * 80}ms`, textDecoration: 'none', color: 'inherit' }}
    >
      {/* Confetti for #1 */}
      {isFirst && <RowConfetti />}

      {/* Rank Badge */}
      <RankBadge rank={entry.rank} />

      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
        ${isFirst ? 'bg-amber-500/20 ring-2 ring-amber-500/50' : 'bg-secondary'}
      `}>
        {entry.avatar}
      </div>

      {/* Name and progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold truncate
            ${isFirst ? 'text-amber-400' : 'text-foreground'}
          `}>
            {entry.display_name}
          </h3>
          {isFirst && <Flame className="w-4 h-4 text-orange-500 animate-pulse" />}
        </div>
        <div className="text-ui-xs text-muted-foreground space-y-0.5">
          <p className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <span className="text-green-500">✓</span>
              {entry.completed_chapters.length} chapter{entry.completed_chapters.length !== 1 ? 's' : ''}
            </span>
            <span className="text-muted-foreground/50">•</span>
            {/* T5 R4b: gate-derived count from the backend (completed_step_count
                is authoritative; 0 when a cached/older response omits it). */}
            <span>{entry.completed_step_count ?? 0} steps</span>
            {(entry.skipped_step_count ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-amber-400/70">{entry.skipped_step_count ?? 0} skipped</span>
              </>
            )}
          </p>
          {entry.completed_chapters.length > 0 && (
            <p className="text-ui-2xs text-muted-foreground/70 truncate">
              {entry.completed_chapters.join(' → ')}
            </p>
          )}
          {pathLabel && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-ui-2xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 w-fit">
              <Sparkles className="w-2.5 h-2.5" />
              {pathLabel}
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="relative text-right">
        <div className={`text-2xl font-bold tabular-nums
          ${isFirst ? 'text-amber-400' : isTop3 ? 'text-foreground' : 'text-muted-foreground'}
        `}>
          {entry.score.toLocaleString()}
        </div>
        <div className="text-ui-2xs text-muted-foreground uppercase tracking-wider">
          points
        </div>
        {entry.updated_at && (
          <div className="flex items-center justify-end gap-1 mt-1 text-ui-2xs text-muted-foreground/60">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(entry.updated_at)}
          </div>
        )}
        
        {/* Movement Indicator */}
        <MovementIndicator movement={entry.movement} rankChange={entry.rankChange} />
      </div>

      {/* Hover Tooltip */}
      <ChapterTooltip 
        completed={entry.completed_chapters} 
        inProgress={entry.in_progress_chapters}
        skippedSteps={entry.skipped_globals || []}
        workshopLevel={entry.workshop_level}
      />
    </Wrapper>
  );
}

export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: BoardTab = searchParams.get('tab') === 'insights' ? 'insights' : 'technical';
  const setTab = (next: BoardTab) => setSearchParams(prev => {
    const p = new URLSearchParams(prev);
    if (next === 'technical') p.delete('tab'); else p.set('tab', next);
    p.delete('season');
    return p;
  }, { replace: true });
  const seasonId = searchParams.get('season');
  const setSeason = (id: string | null) => setSearchParams(prev => {
    const p = new URLSearchParams(prev);
    if (id) p.set('season', id); else p.delete('season');
    return p;
  }, { replace: true });
  const [seasons, setSeasons] = useState<LeaderboardSeasons | null>(null);
  const [archived, setArchived] = useState<{ id: string; season: (LeaderboardSeason & { entries: unknown[] }) | null } | null>(null);

  useEffect(() => {
    let live = true;
    apiClient.leaderboardSeasons(tab).then(s => { if (live) setSeasons(s); }).catch(() => { if (live) setSeasons(null); });
    return () => { live = false; };
  }, [tab]);

  useEffect(() => {
    if (!seasonId) return;
    let live = true;
    apiClient.leaderboardSeason(seasonId)
      .then(s => { if (live) setArchived({ id: seasonId, season: s }); })
      .catch(() => { if (live) setArchived({ id: seasonId, season: null }); });
    return () => { live = false; };
  }, [seasonId]);

  // An archived season, once loaded, for the board on screen.
  const archiveState = !seasonId ? 'live' : archived?.id !== seasonId ? 'loading' : !archived.season || archived.season.board !== tab ? 'missing' : 'ready';
  const frozen = archiveState === 'ready' ? archived!.season! : null;
  const [insightsTick, setInsightsTick] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntryWithMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [workshopUsers, setWorkshopUsers] = useState<WorkshopUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userSessions, setUserSessions] = useState<Record<string, SessionListItem[]>>({});
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [usersSort, setUsersSort] = useState<{ key: UsersSortKey; dir: SortDir } | null>(
    { key: 'updated_at', dir: 'desc' }
  );

  const toggleUsersSort = (key: UsersSortKey) => {
    setUsersPage(0);
    setExpandedUser(null);
    setUsersSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  // Track previous ranks for movement detection
  const previousRanksRef = useRef<Map<string, number>>(new Map());

  // Calculate movements between old and new data
  const calculateMovements = useCallback((newEntries: LeaderboardEntry[]): LeaderboardEntryWithMovement[] => {
    const { rows, ranks } = withMovement(newEntries, previousRanksRef.current, e => e.user_id);
    previousRanksRef.current = ranks;
    return rows;
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async (showRefreshIndicator = true) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const data = await apiClient.getLeaderboard();
      const withMovements = calculateMovements(data);
      setEntries(withMovements);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [calculateMovements]);

  // Initial load
  useEffect(() => {
    fetchLeaderboard(false);
    apiClient.getWorkshopUsers().then(data => {
      setTotalUsers(data.total);
      setWorkshopUsers(data.users);
    }).catch(() => {});
  }, [fetchLeaderboard]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh || isPaused) {
      setCountdown(30);
      return;
    }

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (tab === 'insights') setInsightsTick(t => t + 1); else fetchLeaderboard();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, isPaused, fetchLeaderboard, tab]);

  // Clear movement indicators after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setEntries(prev => prev.map(e => ({ ...e, movement: 'same' as Movement, rankChange: undefined })));
    }, 3000);

    return () => clearTimeout(timer);
  }, [entries]);

  const handleManualRefresh = () => {
    if (tab === 'insights') setInsightsTick(t => t + 1); else fetchLeaderboard();
    setCountdown(30);
  };

  const shown: LeaderboardEntryWithMovement[] = frozen
    ? (frozen.entries as LeaderboardEntry[]).map(e => ({ ...e, movement: 'same' as Movement }))
    : entries;

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const toggleUserExpand = async (email: string) => {
    if (expandedUser === email) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(email);
    if (userSessions[email]) return;
    setLoadingSessions(true);
    try {
      const sessions = await apiClient.getUserSessionsByEmail(email);
      setUserSessions(prev => ({ ...prev, [email]: sessions }));
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setExpandedUser(null);
    } finally {
      setLoadingSessions(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto gradient-mesh">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/30">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Leaderboard</h1>
                <p className="text-ui-xs text-muted-foreground">{BOARD_TABS.find(t => t.key === tab)!.subtitle}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Auto-refresh toggle */}
              <div 
                className="flex items-center gap-2"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                <label className="text-ui-xs text-muted-foreground">Auto-refresh</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    autoRefresh ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    autoRefresh ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
                {autoRefresh && (
                  <span className={`text-ui-2xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                    isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {isPaused ? 'paused' : `${countdown}s`}
                  </span>
                )}
              </div>

              {/* Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
                title="Refresh now"
              >
                <RefreshCw className={`w-4 h-4 text-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

            </div>
          </div>
          <div className="mt-3 -mb-4 flex gap-1" role="tablist" aria-label="Leaderboard">
            {BOARD_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          {seasons && (seasons.current || seasons.archive.length > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-ui-xs text-muted-foreground">
              <History className="w-3.5 h-3.5" />
              <select
                value={seasonId ?? ''}
                onChange={e => setSeason(e.target.value || null)}
                aria-label="Season"
                className="h-7 rounded-lg border border-border bg-card px-2 text-ui-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Live · {seasons.current?.name || 'All time'}</option>
                {seasons.archive.map(a => (
                  <option key={a.id} value={a.id}>{a.name || 'Untitled'} ({a.kind === 'snapshot' ? 'snapshot' : 'archived'})</option>
                ))}
              </select>
              {!seasonId && seasons.current?.startedAt && (
                <span>Counting work started since {new Date(`${seasons.current.startedAt}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </div>
          )}

          {seasonId && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3 text-ui-sm">
              <History className="w-4 h-4 text-primary shrink-0" />
              <p className="flex-1 min-w-[12rem] text-muted-foreground">
                {archiveState === 'loading' ? 'Loading the archive…'
                  : archiveState === 'missing' ? "That archive isn't available for this board."
                  : <><span className="font-medium text-foreground">{frozen!.name || 'Archived season'}</span>, read only. {frozen!.entryCount} {frozen!.entryCount === 1 ? 'entry' : 'entries'} as it stood.</>}
              </p>
              <button onClick={() => setSeason(null)} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-ui-xs font-medium hover:bg-primary/90">Back to live</button>
            </div>
          )}

          {seasonId && !frozen ? null : tab === 'insights' ? (
            <InsightsBoard
              key={frozen?.id ?? 'live'}
              refreshTick={insightsTick}
              onRefreshing={setIsRefreshing}
              onUpdated={setLastUpdated}
              frozen={frozen ? (frozen.entries as InsightsLeaderboardEntry[]) : undefined}
            />
          ) : (<>
          {/* Workshop user count banner */}
          {totalUsers > 0 && (
            <div className="mb-5 flex items-center justify-center gap-2 text-ui-base text-muted-foreground">
              <Users className="w-4 h-4 text-primary" />
              <span className="flex items-center gap-1.5">
                This workshop has been used by
                <span className="border-beam-wrapper inline-flex mx-0.5">
                  <span className="relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white text-ui-base font-bold px-2.5 py-0.5 tabular-nums">
                    {totalUsers}
                  </span>
                </span>
                users
              </span>
              <span className="border-beam-wrapper inline-flex ml-1">
                <button
                  onClick={() => { setShowUsersModal(true); setUsersPage(0); }}
                  className="relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500 text-ui-sm font-medium px-3 py-0.5 transition-colors"
                >
                  View all
                </button>
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Loading leaderboard...</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Trophy className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No entries yet</h2>
              <p className="text-muted-foreground max-w-md">
                Complete workshop steps to appear on the leaderboard. 
                Each step earns points based on difficulty!
              </p>
            </div>
          ) : (
            <div 
              className="space-y-3"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {shown.slice(0, visibleCount).map((entry, index) => (
                <LeaderboardRow 
                  key={entry.user_id} 
                  entry={entry} 
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Show More button */}
          {!isLoading && shown.length > visibleCount && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setVisibleCount(prev => prev + 10)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-ui-base font-medium transition-colors border border-border"
              >
                <ChevronDown className="w-4 h-4" />
                Show 10 more ({shown.length - visibleCount} remaining)
              </button>
            </div>
          )}

          {/* Footer with last updated */}
          {lastUpdated && !isLoading && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-ui-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                <Clock className="w-3 h-3" />
                Last updated: {formatLastUpdated(lastUpdated)}
              </div>
            </div>
          )}

          {/* Scoring info */}
          <div className="mt-8 p-4 bg-card rounded-xl border border-border">
            <h3 className="text-ui-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Scoring System
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-ui-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foundation (1-3)</span>
                <span className="text-foreground font-medium">10 pts/step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ch1: App (4-5)</span>
                <span className="text-foreground font-medium">20 pts/step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ch2: Lakebase (6-8)</span>
                <span className="text-foreground font-medium">30 pts/step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ch3: Lakehouse (9-14)</span>
                <span className="text-foreground font-medium">40 pts/step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ch4: Data Intel (15-18)</span>
                <span className="text-foreground font-medium">50 pts/step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refinement (19-20)</span>
                <span className="text-foreground font-medium">60 pts/step</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-ui-xs">
              <span className="text-muted-foreground">Maximum possible score</span>
              <span className="text-primary font-bold">720 points</span>
            </div>
          </div>
          </>)}
        </div>
      </div>

      {/* Workshop Participants Modal */}
      {showUsersModal && (() => {
        const searchLower = usersSearch.toLowerCase();
        const filteredUsers = searchLower
          ? workshopUsers.filter(u =>
              u.display_name.toLowerCase().includes(searchLower) ||
              u.email.toLowerCase().includes(searchLower)
            )
          : workshopUsers;
        const sortedUsers = usersSort
          ? [...filteredUsers].sort((a, b) => {
              const { key, dir } = usersSort;
              const av = (a[key] ?? '') as string;
              const bv = (b[key] ?? '') as string;
              const cmp = key === 'updated_at'
                ? new Date(av || 0).getTime() - new Date(bv || 0).getTime()
                : av.localeCompare(bv, undefined, { sensitivity: 'base' });
              return dir === 'asc' ? cmp : -cmp;
            })
          : filteredUsers;
        const filteredTotal = sortedUsers.length;
        const pageUsers = sortedUsers.slice(usersPage * 10, (usersPage + 1) * 10);
        const formatDate = (iso?: string) => {
          if (!iso) return '—';
          try {
            return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } catch { return iso; }
        };
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setShowUsersModal(false); setUsersSearch(''); setExpandedUser(null); }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative bg-popover border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-ui-md2 font-semibold text-foreground">Workshop Participants</h2>
                <span className="text-ui-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{totalUsers}</span>
              </div>
              <button
                onClick={() => { setShowUsersModal(false); setUsersSearch(''); setExpandedUser(null); }}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={usersSearch}
                  onChange={e => { setUsersSearch(e.target.value); setUsersPage(0); setExpandedUser(null); }}
                  className="w-full pl-9 pr-3 py-2 text-ui-base bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-5 py-3">
              <table className="w-full">
                <thead>
                  <tr className="text-ui-2xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    {([
                      { label: 'Name', key: 'display_name' as const },
                      { label: 'Email', key: 'email' as const },
                      { label: 'Last Path', key: 'workshop_level_label' as const },
                      { label: 'Last Updated', key: 'updated_at' as const },
                    ]).map(col => {
                      const active = usersSort?.key === col.key;
                      const dir = active ? usersSort!.dir : null;
                      return (
                        <th key={col.key} className="text-left pb-2 font-medium">
                          <button
                            type="button"
                            onClick={() => toggleUsersSort(col.key)}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${active ? 'text-foreground' : ''}`}
                          >
                            {col.label}
                            {dir === 'asc' && <ChevronUp className="w-3 h-3" />}
                            {dir === 'desc' && <ChevronDown className="w-3 h-3" />}
                            {!active && <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                          </button>
                        </th>
                      );
                    })}
                    <th className="text-left pb-2 font-medium">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((user, i) => {
                    const isExpanded = expandedUser === user.email;
                    const sessions = userSessions[user.email];
                    const count = user.session_count || 1;
                    return (
                      <Fragment key={user.email}>
                        <tr
                          className={`text-ui-base border-b border-border/50 cursor-pointer transition-colors hover:bg-secondary/30 ${i % 2 === 0 ? '' : 'bg-secondary/20'}`}
                          onClick={() => toggleUserExpand(user.email)}
                        >
                          <td className="py-2.5 pr-4 text-foreground font-medium whitespace-nowrap">{user.display_name}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{user.email}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            {user.workshop_level_label ? (
                              <span className="text-ui-xs font-medium bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                                {user.workshop_level_label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap text-ui-sm">
                            {formatDate(user.updated_at)}
                          </td>
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-ui-xs font-medium text-muted-foreground">
                              {loadingSessions && isExpanded ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              {count} {count === 1 ? 'session' : 'sessions'}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && sessions && sessions.map(session => (
                          <tr key={session.session_id} className="text-ui-sm bg-secondary/10 border-b border-border/30">
                            <td colSpan={2} className="py-2 pl-8 pr-4 text-muted-foreground">
                              {session.is_saved ? session.session_name : 'Unsaved Session'}
                            </td>
                            <td className="py-2 pr-4" />
                            <td className="py-2 pr-4 text-muted-foreground/70 whitespace-nowrap text-ui-xs">
                              {formatDate(session.updated_at)}
                            </td>
                            <td className="py-2 whitespace-nowrap">
                              <a
                                href={`${window.location.origin}?sessionId=${session.session_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-ui-xs font-medium px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                                style={{
                                  backgroundColor: session.is_saved ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                                  color: session.is_saved ? 'rgb(52,211,153)' : 'rgb(250,204,21)',
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                                {session.is_saved ? 'Saved' : 'Unsaved'}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                  {pageUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ui-base text-muted-foreground">
                        No users found matching &ldquo;{usersSearch}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTotal > 10 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border text-ui-sm">
                <span className="text-muted-foreground">
                  {usersPage * 10 + 1}–{Math.min((usersPage + 1) * 10, filteredTotal)} of {filteredTotal}
                  {usersSearch && ` (filtered)`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setUsersPage(p => p - 1)}
                    disabled={usersPage === 0}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-muted-foreground tabular-nums">
                    Page {usersPage + 1} of {Math.ceil(filteredTotal / 10)}
                  </span>
                  <button
                    onClick={() => setUsersPage(p => p + 1)}
                    disabled={(usersPage + 1) * 10 >= filteredTotal}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
