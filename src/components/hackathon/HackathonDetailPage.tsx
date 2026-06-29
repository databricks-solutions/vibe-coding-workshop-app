/**
 * HackathonDetailPage — /hackathons/:id
 *
 * One role-aware page consolidating HackathonHive's HackathonDetail tabs into
 * V2V's idiom. Tabs shown depend on the caller's per-hackathon role:
 *   - Overview  : everyone
 *   - Teams     : everyone (participant can create/join)
 *   - Submissions: everyone (team leader can submit; everyone can vote)
 *   - Judging   : judges + organizer (judges score)
 *   - Results   : everyone (computed leaderboard)
 *   - Manage    : organizer only (add judges, advance status)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Users,
  FileCode2,
  Gavel,
  BarChart3,
  Settings2,
  Info,
  Trophy,
} from 'lucide-react';
import { apiClient, type HackathonDetail } from '../../api/client';
import { ThemeToggle } from '../ThemeToggle';
import { StatusBadge, RoleBadge } from './hackathonShared';
import { DevPersonaPicker } from './DevPersonaPicker';
import { OverviewTab } from './tabs/OverviewTab';
import { TeamsTab } from './tabs/TeamsTab';
import { SubmissionsTab } from './tabs/SubmissionsTab';
import { JudgingTab } from './tabs/JudgingTab';
import { ResultsTab } from './tabs/ResultsTab';
import { ManageTab } from './tabs/ManageTab';

type TabKey = 'overview' | 'teams' | 'submissions' | 'judging' | 'results' | 'manage';

const TAB_DEFS: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: 'overview', label: 'Overview', icon: Info },
  { key: 'teams', label: 'Teams', icon: Users },
  { key: 'submissions', label: 'Submissions', icon: FileCode2 },
  { key: 'judging', label: 'Judging', icon: Gavel },
  { key: 'results', label: 'Results', icon: BarChart3 },
  { key: 'manage', label: 'Manage', icon: Settings2 },
];

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<HackathonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await apiClient.getHackathon(id);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hackathon');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Which tabs the current role may see.
  const visibleTabs = TAB_DEFS.filter((t) => {
    if (!detail) return t.key === 'overview';
    if (t.key === 'manage') return detail.your_role === 'organizer';
    if (t.key === 'judging') return detail.your_role === 'judge' || detail.your_role === 'organizer';
    return true;
  });

  return (
    <div className="flex-1 overflow-auto gradient-mesh">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate('/hackathons')}
              className="flex items-center gap-1.5 text-ui-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All hackathons
            </button>
            <div className="flex items-center gap-3">
              <DevPersonaPicker />
              <ThemeToggle />
            </div>
          </div>
          {detail && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-transparent to-amber-500/10 mt-3 p-4"
            >
              <div className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full bg-primary/15 blur-3xl animate-pulse-glow" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">{detail.title}</h1>
                    {detail.short_description && (
                      <p className="text-ui-sm text-foreground/80 mt-0.5">{detail.short_description}</p>
                    )}
                    <p className="text-ui-xs text-muted-foreground mt-0.5">
                      Organized by {detail.organizer_name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={detail.status} />
                  <RoleBadge role={detail.your_role} />
                </div>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          {detail && (
            <div className="flex items-center gap-1 mt-4 -mb-px overflow-x-auto">
              {visibleTabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    data-testid={`tab-${t.key}`}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-t-md text-ui-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-ui-sm text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {detail && !loading && !error && (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'overview' && <OverviewTab detail={detail} onGoToTab={setTab} />}
            {tab === 'teams' && <TeamsTab detail={detail} onChanged={load} />}
            {tab === 'submissions' && <SubmissionsTab detail={detail} onChanged={load} />}
            {tab === 'judging' && <JudgingTab detail={detail} onChanged={load} />}
            {tab === 'results' && <ResultsTab hackathonId={detail.hackathon_id} />}
            {tab === 'manage' && <ManageTab detail={detail} onChanged={load} />}
          </motion.div>
        )}
      </div>
    </div>
  );
}
