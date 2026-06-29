/**
 * Results tab — computed leaderboard (avg judge score, tie-broken by votes).
 * Self-fetches /results so rankings reflect the latest scores/votes.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Medal,
  Award,
  Heart,
  Gavel,
  Loader2,
  AlertCircle,
  Github,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { apiClient, type HackathonResults } from '../../../api/client';

export function ResultsTab({ hackathonId }: { hackathonId: string }) {
  const [data, setData] = useState<HackathonResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiClient.getHackathonResults(hackathonId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [hackathonId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading results…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-sm text-rose-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }
  if (!data || data.results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Trophy className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-ui-sm text-muted-foreground">No results yet — submissions and scores will appear here.</p>
      </div>
    );
  }

  const winner = data.results[0];
  const isComplete = data.status === 'completed';

  return (
    <div className="space-y-4">
      {/* Winner banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-crown-glow">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-ui-2xs uppercase tracking-wider text-amber-400 font-semibold">
              {isComplete ? 'Winner' : 'Currently leading'}
            </p>
            <h3 className="text-ui-lg font-bold text-foreground">{winner.title}</h3>
            <p className="text-ui-xs text-muted-foreground">
              {winner.team_name} · {winner.avg_score.toFixed(1)}/10 avg · {winner.vote_count} votes
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <p className="text-ui-xs text-muted-foreground">
          Ranked by average judge score, tie-broken by community votes.
        </p>
        <button
          onClick={() => void load()}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {data.results.map((r, i) => (
          <motion.div
            key={r.submission_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-4 rounded-xl border p-4 ${
              i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'
            }`}
          >
            <RankBadge rank={r.rank} />
            <div className="flex-1 min-w-0">
              <h4 className="text-ui-sm font-semibold text-foreground truncate">{r.title}</h4>
              <p className="text-ui-2xs text-muted-foreground">{r.team_name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {r.repo_url && <ResultLink icon={Github} url={r.repo_url} />}
                {r.demo_url && <ResultLink icon={ExternalLink} url={r.demo_url} />}
              </div>
            </div>
            <div className="flex items-center gap-4 text-ui-xs">
              <Metric icon={Gavel} value={`${r.avg_score.toFixed(1)}`} sub={`${r.judge_count} judges`} />
              <Metric icon={Heart} value={`${r.vote_count}`} sub="votes" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
        <Trophy className="w-4 h-4 text-white" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center flex-shrink-0">
        <Medal className="w-4 h-4 text-white" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
        <Award className="w-4 h-4 text-white" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
      <span className="text-ui-sm font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  sub,
}: {
  icon: typeof Gavel;
  value: string;
  sub: string;
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1 text-foreground font-semibold">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {value}
      </div>
      <div className="text-ui-2xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ResultLink({ icon: Icon, url }: { icon: typeof Github; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-primary transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </a>
  );
}
