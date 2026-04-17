import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Search,
  Activity,
  TrendingUp,
  Loader2,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  SkipForward,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type {
  AnalyticsData,
  AnalyticsStepCount,
  AnalyticsChapterFeedback,
  AnalyticsFeedbackDetail,
  AnalyticsUserActivity,
  AnalyticsRecentSession,
} from '../api/client';
import { ALL_STEPS } from '../constants/workflowSections';
import { CHAPTERS } from '../constants/scoring';
import { ThemeToggle } from './ThemeToggle';

type Tab = 'overview' | 'feedback' | 'chapter-feedback' | 'users';

const TAB_CONFIG: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'chapter-feedback', label: 'Chapter Feedback', icon: ThumbsUp },
  { id: 'users', label: 'User Activity', icon: Users },
];

const STEP_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(ALL_STEPS).map(([n, s]) => [Number(n), s.title]),
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  accent: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-ui-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
          {label}
        </span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-ui-3xl font-bold text-foreground leading-none tabular-nums">
        {value}
      </div>
      {subtitle && (
        <div className="text-ui-xs text-muted-foreground mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function HorizontalBarList({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-ui-base text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-ui-base font-bold text-foreground mb-1">{title}</h3>
      <p className="text-ui-xs text-muted-foreground mb-4">{subtitle}</p>
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-ui-sm font-medium text-muted-foreground truncate max-w-[12.5rem]">
                {idx + 1}. {item.label}
              </span>
              <span className="text-ui-xs font-semibold text-muted-foreground tabular-nums ml-2 shrink-0">
                {item.count}
              </span>
            </div>
            <div className="h-[0.375rem] rounded-full overflow-hidden bg-secondary">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-500"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelDistribution({ items }: { items: { level: string; label: string; count: number }[] }) {
  if (items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-primary" />
        <h3 className="text-ui-base font-bold text-foreground">Workshop Levels</h3>
        <span className="text-ui-xs text-muted-foreground">({total} sessions)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((m) => {
          const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
          return (
            <div
              key={m.level}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-ui-sm"
            >
              <span className="font-semibold text-foreground">{m.label}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-muted-foreground tabular-nums">{m.count}</span>
              <span className="text-ui-2xs text-muted-foreground">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterProgressChart({
  stepCounts,
  totalSessions,
}: {
  stepCounts: AnalyticsStepCount[];
  totalSessions: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const stepMap = useMemo(() => {
    const m: Record<number, AnalyticsStepCount> = {};
    for (const sc of stepCounts) m[sc.step_number] = sc;
    return m;
  }, [stepCounts]);

  const toggle = (ch: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });

  if (totalSessions === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-ui-base text-muted-foreground">No session data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-ui-base font-bold text-foreground mb-1">Step Completion by Chapter</h3>
      <p className="text-ui-xs text-muted-foreground mb-4">
        Click a chapter to expand individual steps
      </p>
      <div className="space-y-3">
        {Object.entries(CHAPTERS).map(([chapterName, chapterInfo]) => {
          const chSteps = Array.from(chapterInfo.steps);
          const completedTotal = chSteps.reduce(
            (sum, s) => sum + (stepMap[s]?.completed ?? 0),
            0,
          );
          const skippedTotal = chSteps.reduce(
            (sum, s) => sum + (stepMap[s]?.skipped ?? 0),
            0,
          );
          const maxPossible = chSteps.length * totalSessions;
          const completedPct = maxPossible > 0 ? (completedTotal / maxPossible) * 100 : 0;
          const skippedPct = maxPossible > 0 ? (skippedTotal / maxPossible) * 100 : 0;
          const isOpen = expanded.has(chapterName);

          return (
            <div key={chapterName}>
              <button
                onClick={() => toggle(chapterName)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-ui-sm font-semibold text-foreground">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {chapterInfo.display}
                  </span>
                  <div className="flex items-center gap-2 text-ui-xs text-muted-foreground tabular-nums">
                    <span className="flex items-center gap-0.5 text-emerald-500">
                      <CheckCircle2 size={10} /> {completedTotal}
                    </span>
                    {skippedTotal > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <SkipForward size={10} /> {skippedTotal}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 h-[0.375rem] rounded-full overflow-hidden bg-secondary">
                  {completedPct > 0 && (
                    <div
                      className="h-full bg-emerald-500/70 rounded-l-full transition-all duration-500"
                      style={{ width: `${completedPct}%` }}
                    />
                  )}
                  {skippedPct > 0 && (
                    <div
                      className="h-full bg-amber-500/50 transition-all duration-500"
                      style={{ width: `${skippedPct}%` }}
                    />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="mt-2 ml-5 space-y-2 pb-1">
                  {chSteps.map((stepNum) => {
                    const sc = stepMap[stepNum];
                    const c = sc?.completed ?? 0;
                    const sk = sc?.skipped ?? 0;
                    const cPct = totalSessions > 0 ? (c / totalSessions) * 100 : 0;
                    const sPct = totalSessions > 0 ? (sk / totalSessions) * 100 : 0;
                    return (
                      <div key={stepNum}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-ui-xs text-muted-foreground truncate max-w-[11.25rem]">
                            {stepNum}. {STEP_LABELS[stepNum] || `Step ${stepNum}`}
                          </span>
                          <div className="flex items-center gap-2 text-ui-2xs text-muted-foreground tabular-nums">
                            {c > 0 && <span className="text-emerald-500">{c}</span>}
                            {sk > 0 && <span className="text-amber-500">{sk} skip</span>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 h-[0.25rem] rounded-full overflow-hidden bg-secondary">
                          {cPct > 0 && (
                            <div
                              className="h-full bg-emerald-500/60 rounded-l-full transition-all duration-300"
                              style={{ width: `${cPct}%` }}
                            />
                          )}
                          {sPct > 0 && (
                            <div
                              className="h-full bg-amber-500/40 transition-all duration-300"
                              style={{ width: `${sPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterFeedbackChart({ data }: { data: AnalyticsChapterFeedback[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-ui-base text-muted-foreground">No chapter feedback yet.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.up + d.down), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-ui-base font-bold text-foreground mb-1">Chapter Feedback</h3>
      <p className="text-ui-xs text-muted-foreground mb-4">Sentiment per chapter milestone</p>
      <div className="space-y-3">
        {data.map((item) => {
          const upPct = (item.up / maxTotal) * 100;
          const downPct = (item.down / maxTotal) * 100;
          return (
            <div key={item.chapter}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-ui-sm font-medium text-muted-foreground truncate max-w-[12.5rem]">
                  {item.chapter}
                </span>
                <div className="flex items-center gap-2 text-ui-xs text-muted-foreground tabular-nums">
                  {item.up > 0 && (
                    <span className="flex items-center gap-0.5 text-emerald-500">
                      <ThumbsUp size={10} /> {item.up}
                    </span>
                  )}
                  {item.down > 0 && (
                    <span className="flex items-center gap-0.5 text-red-400">
                      <ThumbsDown size={10} /> {item.down}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-0.5 h-[0.375rem] rounded-full overflow-hidden bg-secondary">
                {upPct > 0 && (
                  <div
                    className="h-full bg-emerald-500/80 rounded-l-full transition-all duration-500"
                    style={{ width: `${upPct}%` }}
                  />
                )}
                {downPct > 0 && (
                  <div
                    className="h-full bg-red-400/80 rounded-r-full transition-all duration-500"
                    style={{ width: `${downPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopContributors({ users }: { users: AnalyticsUserActivity[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-ui-base font-bold text-foreground mb-1">Top Contributors</h3>
      <p className="text-ui-xs text-muted-foreground mb-4">Highest scores across all sessions</p>
      <div className="space-y-2.5">
        {users.slice(0, 8).map((u, idx) => (
          <div key={u.email} className="flex items-center gap-3">
            <span className="w-5 text-right text-ui-sm font-bold text-muted-foreground tabular-nums">
              {idx + 1}
            </span>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-ui-xs font-bold text-white shrink-0"
              style={{
                backgroundColor: `hsl(${(u.display_name.charCodeAt(0) * 37) % 360}, 55%, 50%)`,
              }}
            >
              {u.display_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ui-base font-semibold text-foreground truncate">
                {u.display_name}
              </div>
            </div>
            <div className="text-ui-sm font-medium text-muted-foreground tabular-nums shrink-0">
              {u.best_score} pts · {u.session_count}s
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-ui-base text-muted-foreground text-center py-4">No users yet.</p>
        )}
      </div>
    </div>
  );
}

function RecentActivityTable({ sessions }: { sessions: AnalyticsRecentSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-ui-base text-muted-foreground">No sessions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-secondary/30">
        <h3 className="text-ui-base font-bold text-foreground">Recent Activity</h3>
        <p className="text-ui-xs text-muted-foreground">Last 10 sessions created</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                User
              </th>
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                Industry
              </th>
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                Use Case
              </th>
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                Path
              </th>
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em] text-center">
                Steps
              </th>
              <th className="px-5 py-2.5 text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.map((s) => (
              <tr
                key={s.session_id}
                className="hover:bg-secondary/30 transition-colors duration-150"
              >
                <td className="px-5 py-2.5 text-ui-sm font-medium text-foreground">
                  {s.display_name}
                </td>
                <td className="px-5 py-2.5 text-ui-sm text-muted-foreground">
                  {s.industry_label || '—'}
                </td>
                <td className="px-5 py-2.5 text-ui-sm text-muted-foreground max-w-[10rem] truncate">
                  {s.use_case_label || '—'}
                </td>
                <td className="px-5 py-2.5">
                  <span className="text-ui-2xs font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">
                    {s.workshop_level_label}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-center text-ui-sm font-medium text-muted-foreground tabular-nums">
                  {s.completed_count}
                </td>
                <td className="px-5 py-2.5 text-ui-xs text-muted-foreground">
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackList({
  items,
  searchTerm,
}: {
  items: AnalyticsFeedbackDetail[];
  searchTerm: string;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.feedback_comment?.toLowerCase().includes(lower) ||
        item.display_name?.toLowerCase().includes(lower) ||
        item.industry_label?.toLowerCase().includes(lower) ||
        item.use_case_label?.toLowerCase().includes(lower),
    );
  }, [items, searchTerm]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-ui-md text-muted-foreground">
          {items.length === 0 ? 'No feedback yet.' : 'No results match your search.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((item, idx) => (
        <div
          key={`${item.session_id}-${idx}`}
          className="rounded-xl border border-border bg-card px-5 py-4 hover:border-primary/30 transition-colors duration-200"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-ui-2xs font-bold ${
                    item.feedback_rating === 'thumbs_down'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}
                >
                  {item.feedback_rating === 'thumbs_down' ? (
                    <ThumbsDown size={10} />
                  ) : (
                    <ThumbsUp size={10} />
                  )}
                  {item.feedback_rating === 'thumbs_down' ? 'Negative' : 'Positive'}
                </span>
                {item.industry_label && (
                  <span className="text-ui-xs text-muted-foreground">
                    {item.industry_label}
                    {item.use_case_label ? ` · ${item.use_case_label}` : ''}
                  </span>
                )}
              </div>
              {item.feedback_comment && (
                <p className="text-ui-base text-foreground leading-relaxed mt-1">
                  &ldquo;{item.feedback_comment}&rdquo;
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-ui-sm font-medium text-muted-foreground">
                {item.display_name}
              </div>
              <div className="text-ui-xs text-muted-foreground">
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserActivityTable({ users }: { users: AnalyticsUserActivity[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-ui-md text-muted-foreground">No user activity data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-5 py-3 text-ui-xs font-bold text-muted-foreground uppercase tracking-[0.06em]">
                User
              </th>
              <th className="px-5 py-3 text-ui-xs font-bold text-muted-foreground uppercase tracking-[0.06em] text-center">
                Sessions
              </th>
              <th className="px-5 py-3 text-ui-xs font-bold text-muted-foreground uppercase tracking-[0.06em] text-center">
                Steps
              </th>
              <th className="px-5 py-3 text-ui-xs font-bold text-muted-foreground uppercase tracking-[0.06em] text-center">
                Best Score
              </th>
              <th className="px-5 py-3 text-ui-xs font-bold text-muted-foreground uppercase tracking-[0.06em] text-center">
                Feedback
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr
                key={u.email}
                className="hover:bg-secondary/30 transition-colors duration-150"
              >
                <td className="px-5 py-3">
                  <div className="text-ui-base font-semibold text-foreground">
                    {u.display_name}
                  </div>
                  <div className="text-ui-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-5 py-3 text-center text-ui-base font-medium text-muted-foreground tabular-nums">
                  {u.session_count}
                </td>
                <td className="px-5 py-3 text-center text-ui-base font-medium text-muted-foreground tabular-nums">
                  {u.total_steps}
                </td>
                <td className="px-5 py-3 text-center text-ui-base font-medium text-muted-foreground tabular-nums">
                  {u.best_score}
                </td>
                <td className="px-5 py-3 text-center text-ui-base font-medium text-muted-foreground tabular-nums">
                  {u.feedback_given}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    apiClient
      .getAnalytics()
      .then(setData)
      .catch((err) => console.error('Analytics load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-ui-base text-muted-foreground">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-ui-md text-muted-foreground">Failed to load analytics data.</p>
        <button
          onClick={() => navigate('/')}
          className="text-ui-base font-medium text-primary hover:underline"
        >
          Go Home
        </button>
      </div>
    );
  }

  const { summary, usage, by_industry, by_use_case, by_level, step_completion_counts, chapter_feedback, recent_sessions, feedback_details, user_activity } = data;
  const sentimentRate =
    summary.total_feedback > 0
      ? Math.round((summary.positive_count / summary.total_feedback) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-[3.5rem] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              <h1 className="text-ui-lg font-bold text-foreground">Analytics</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Row 1: Usage metrics */}
        <div className="mb-2">
          <div className="text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.1em] mb-2 px-1">
            Usage
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Users"
              value={summary.total_users}
              icon={Users}
              accent="bg-blue-500/10 text-blue-500"
            />
            <StatCard
              label="Total Sessions"
              value={summary.total_sessions}
              icon={Activity}
              accent="bg-violet-500/10 text-violet-500"
              subtitle={`${usage.saved_sessions} saved`}
            />
            <StatCard
              label="Avg Steps / Session"
              value={usage.avg_steps_per_session}
              icon={Zap}
              accent="bg-amber-500/10 text-amber-500"
              subtitle={`${usage.total_prompts_generated} prompts generated`}
            />
            <StatCard
              label="Avg Score"
              value={usage.avg_score}
              icon={TrendingUp}
              accent="bg-emerald-500/10 text-emerald-500"
              subtitle={`${usage.prereqs_completed} completed prereqs`}
            />
          </div>
        </div>

        {/* Row 2: Feedback metrics */}
        <div className="mb-6">
          <div className="text-ui-2xs font-bold text-muted-foreground uppercase tracking-[0.1em] mb-2 px-1 mt-4">
            Feedback
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Feedback"
              value={summary.total_feedback}
              icon={MessageSquare}
              accent="bg-sky-500/10 text-sky-500"
            />
            <StatCard
              label="Positive"
              value={summary.positive_count}
              icon={ThumbsUp}
              accent="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              label="Negative"
              value={summary.negative_count}
              icon={ThumbsDown}
              accent="bg-red-500/10 text-red-400"
            />
            <StatCard
              label="Sentiment"
              value={summary.total_feedback > 0 ? `${sentimentRate}%` : '—'}
              icon={TrendingUp}
              accent={
                sentimentRate >= 70
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : sentimentRate >= 40
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-red-500/10 text-red-400'
              }
              subtitle={
                summary.total_feedback > 0
                  ? 'positive across all feedback'
                  : 'No feedback yet'
              }
            />
          </div>
        </div>

        {/* Workshop Level Distribution */}
        {by_level.length > 0 && (
          <div className="mb-6">
            <LevelDistribution items={by_level} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-ui-base font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'feedback' && summary.total_feedback > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-ui-2xs font-bold bg-primary/10 text-primary leading-none">
                  {summary.total_feedback}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar for feedback tab */}
        {activeTab === 'feedback' && (
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search feedback..."
                className="w-full pl-9 pr-3 py-2 text-ui-base rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChapterProgressChart
                stepCounts={step_completion_counts}
                totalSessions={summary.total_sessions}
              />
              <HorizontalBarList
                title="Industry Popularity"
                subtitle="Most selected industries"
                items={by_industry.map((i) => ({ label: i.industry, count: i.count }))}
                emptyMessage="No industry data yet."
              />
              <HorizontalBarList
                title="Use Case Popularity"
                subtitle="Most selected use cases"
                items={by_use_case.map((u) => ({ label: u.use_case, count: u.count }))}
                emptyMessage="No use case data yet."
              />
              <TopContributors users={user_activity} />
            </div>
            <RecentActivityTable sessions={recent_sessions} />
          </div>
        )}

        {activeTab === 'feedback' && (
          <FeedbackList items={feedback_details} searchTerm={searchTerm} />
        )}

        {activeTab === 'chapter-feedback' && (
          <ChapterFeedbackChart data={chapter_feedback} />
        )}

        {activeTab === 'users' && <UserActivityTable users={user_activity} />}
      </div>
    </div>
  );
}
