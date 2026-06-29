/**
 * HackathonsPage — the /hackathons landing destination.
 *
 * Lists all hackathons as V2V-styled cards and lets any signed-in user create
 * one (becoming its organizer). Self-fetches like LeaderboardPage/AnalyticsDashboard.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Plus,
  Users,
  FileCode2,
  RefreshCw,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { apiClient, type HackathonSummary } from '../../api/client';
import { ThemeToggle } from '../ThemeToggle';
import { StatusBadge, RoleBadge, PrimaryButton } from './hackathonShared';
import { displayName, STATUS_META } from './hackathonStyles';
import { CreateHackathonForm } from './CreateHackathonForm';
import { DevPersonaPicker } from './DevPersonaPicker';

export function HackathonsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hackathons, setHackathons] = useState<HackathonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.listHackathons();
      setHackathons(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeCreate = () => {
    setShowCreate(false);
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleCreated = (hid: string) => {
    closeCreate();
    navigate(`/hackathons/${hid}`);
  };

  const liveCount = hackathons.filter((h) => h.status !== 'completed' && h.status !== 'draft').length;

  return (
    <div className="flex-1 overflow-auto gradient-mesh">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Hackathons</h1>
              <p className="text-ui-xs text-muted-foreground">
                Organize, build, judge, and crown a winner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void load()}
              className="p-2 rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span data-testid="create-hackathon-btn">
              <PrimaryButton onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
                Create Hackathon
              </PrimaryButton>
            </span>
            <DevPersonaPicker />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Vibrant hero banner */}
      {!loading && !error && hackathons.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 p-6"
          >
            {/* glow blobs */}
            <div className="pointer-events-none absolute -top-12 -right-10 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl animate-pulse-glow" />
            <div className="pointer-events-none absolute -bottom-16 left-10 w-56 h-56 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  Build. Compete. Win. 🏆
                </h2>
                <p className="text-ui-sm text-muted-foreground mt-1 max-w-md">
                  Spin up a hackathon, rally teams, ship projects, and let judges and the
                  crowd crown a champion — all in one place.
                </p>
              </div>
              <div className="flex items-center gap-6">
                <HeroStat value={hackathons.length} label="Hackathons" />
                <div className="w-px h-10 bg-border" />
                <HeroStat value={liveCount} label="Active now" accent />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading hackathons…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-ui-sm text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && hackathons.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-ui-lg font-semibold text-foreground mb-1">No hackathons yet</h2>
            <p className="text-ui-sm text-muted-foreground mb-5">
              Be the first to run a build-off for your team.
            </p>
            <PrimaryButton onClick={() => setShowCreate(true)} className="mx-auto">
              <Plus className="w-4 h-4" />
              Create the first hackathon
            </PrimaryButton>
          </div>
        )}

        {!loading && !error && hackathons.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hackathons.map((h, i) => {
              const sm = STATUS_META[h.status] ?? STATUS_META.draft;
              return (
                <motion.button
                  key={h.hackathon_id}
                  data-testid="hackathon-card"
                  data-hackathon-title={h.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
                  whileHover={{ y: -4, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/hackathons/${h.hackathon_id}`)}
                  className="group relative text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-200"
                >
                  {/* status-colored top accent bar */}
                  <div className={`h-1 w-full ${sm.text.replace('text', 'bg')}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <StatusBadge status={h.status} />
                      {/* Only badge a real role (organizer/judge); plain viewers get no
                          chip so the card doesn't imply they've already joined. */}
                      {h.your_role !== 'participant' && <RoleBadge role={h.your_role} />}
                    </div>
                    <h3 className="text-ui-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {h.title}
                    </h3>
                    <p className="text-ui-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                      {h.short_description || h.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-ui-2xs font-semibold text-emerald-400">
                          <Users className="w-3.5 h-3.5" /> {h.team_count}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-ui-2xs font-semibold text-sky-400">
                          <FileCode2 className="w-3.5 h-3.5" /> {h.submission_count}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-ui-2xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                        Open
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                    <p className="text-ui-2xs text-muted-foreground/60 mt-2">
                      by {displayName(h.created_by)}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateHackathonForm onClose={closeCreate} onCreated={handleCreated} />
      )}
    </div>
  );
}

function HeroStat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }}
      className="text-center"
    >
      <div className={`text-3xl font-extrabold tabular-nums ${accent ? 'text-emerald-400' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-ui-2xs uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </motion.div>
  );
}
