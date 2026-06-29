/** Overview tab — read-only summary + role-aware "what you can do" hints. */

import { motion } from 'framer-motion';
import { Users, FileCode2, Gavel, Trophy, Calendar, Award, MapPin, Clock, DollarSign, Tag, Sparkles } from 'lucide-react';
import type { HackathonDetail } from '../../../api/client';
import { displayName } from '../hackathonStyles';

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OverviewTab({
  detail,
  onGoToTab,
}: {
  detail: HackathonDetail;
  onGoToTab: (t: 'teams' | 'submissions' | 'judging' | 'results') => void;
}) {
  const stats = [
    { icon: Users, label: 'Teams', value: detail.teams.length, grad: 'from-emerald-500/15 to-emerald-500/5', ring: 'border-emerald-500/20', accent: 'text-emerald-400' },
    { icon: FileCode2, label: 'Submissions', value: detail.submissions.length, grad: 'from-sky-500/15 to-sky-500/5', ring: 'border-sky-500/20', accent: 'text-sky-400' },
    { icon: Gavel, label: 'Judges', value: detail.judges.length, grad: 'from-violet-500/15 to-violet-500/5', ring: 'border-violet-500/20', accent: 'text-violet-400' },
  ];

  const nextSteps = roleNextSteps(detail);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 280, damping: 20 }}
              whileHover={{ y: -3 }}
              className={`rounded-xl border ${s.ring} bg-gradient-to-br ${s.grad} p-4`}
            >
              <div className={`flex items-center gap-2 ${s.accent} mb-1`}>
                <Icon className="w-4 h-4" />
                <span className="text-ui-2xs uppercase tracking-wider">{s.label}</span>
              </div>
              <div className="text-3xl font-extrabold text-foreground tabular-nums">{s.value}</div>
            </motion.div>
          );
        })}
      </div>

      {detail.description && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-ui-sm font-semibold text-foreground mb-2">About</h3>
          <p className="text-ui-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {detail.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-ui-sm font-semibold text-foreground">Details</h3>
          <Row icon={Calendar} label="Format" value={titleCase(detail.hackathon_type)} />
          {(detail.location || detail.venue) && (
            <Row
              icon={MapPin}
              label="Where"
              value={[detail.venue, detail.location].filter(Boolean).join(' · ')}
            />
          )}
          <Row
            icon={Users}
            label="Team size"
            value={`${detail.min_team_size}–${detail.max_team_size} members · up to ${detail.max_participants} participants`}
          />
          {(fmtDate(detail.registration_start) || fmtDate(detail.registration_end)) && (
            <Row
              icon={Calendar}
              label="Registration"
              value={`${fmtDate(detail.registration_start) || 'open'} → ${fmtDate(detail.registration_end) || 'event start'}`}
            />
          )}
          {fmtDate(detail.start_date) && (
            <Row
              icon={Clock}
              label="When"
              value={`${fmtDate(detail.start_date)}${fmtDate(detail.end_date) ? ` → ${fmtDate(detail.end_date)}` : ''}`}
            />
          )}
          {fmtDate(detail.submission_deadline) && (
            <Row icon={Clock} label="Submission deadline" value={fmtDate(detail.submission_deadline)!} />
          )}
          {detail.total_prize_pool > 0 && (
            <Row
              icon={DollarSign}
              label="Prize pool"
              value={`$${detail.total_prize_pool.toLocaleString()}${detail.prize_description ? ` — ${detail.prize_description}` : ''}`}
            />
          )}
          {detail.total_prize_pool === 0 && detail.prize_description && (
            <Row icon={Award} label="Prize" value={detail.prize_description} />
          )}
          <Row
            icon={Trophy}
            label="Voting"
            value={detail.has_voting ? 'Community voting enabled' : 'Judge-only scoring'}
          />
          {(() => {
            const feats = [
              detail.has_team_matching && 'Team matching',
              detail.has_chat && 'In-event chat',
              detail.has_voting && 'Community voting',
            ].filter(Boolean) as string[];
            return feats.length > 0 ? (
              <Row icon={Sparkles} label="Features" value={feats.join(' · ')} />
            ) : null;
          })()}
          {detail.topics.length > 0 && (
            <div className="pt-1">
              <span className="text-ui-2xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" /> Topics
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {detail.topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-ui-2xs font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="pt-1">
            <span className="text-ui-2xs uppercase tracking-wider text-muted-foreground">
              Judging criteria
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {detail.judging_criteria.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-secondary px-2 py-0.5 text-ui-2xs font-medium text-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          {detail.rules && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-ui-2xs uppercase tracking-wider text-muted-foreground">Rules</span>
              <p className="text-ui-xs text-muted-foreground mt-1 whitespace-pre-wrap">{detail.rules}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-ui-sm font-semibold text-foreground mb-3">
            Your next steps
          </h3>
          <ul className="space-y-2.5">
            {nextSteps.map((step) => (
              <li key={step.label}>
                <button
                  onClick={() => onGoToTab(step.tab)}
                  className="w-full text-left flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <step.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-ui-sm font-medium text-foreground">{step.label}</div>
                    <div className="text-ui-2xs text-muted-foreground">{step.hint}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {detail.judges.length > 0 && (
            <p className="text-ui-2xs text-muted-foreground/70 mt-3">
              Judges: {detail.judges.map((j) => displayName(j.email)).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function roleNextSteps(detail: HackathonDetail) {
  const onTeam = detail.my_team_ids.length > 0;
  if (detail.your_role === 'organizer') {
    return [
      { label: 'Manage judges & status', hint: 'Add judges and advance the hackathon', tab: 'judging' as const, icon: Gavel },
      { label: 'Review submissions', hint: 'See what teams have shipped', tab: 'submissions' as const, icon: FileCode2 },
      { label: 'View results', hint: 'Track the live leaderboard', tab: 'results' as const, icon: Trophy },
    ];
  }
  if (detail.your_role === 'judge') {
    return [
      { label: 'Score submissions', hint: 'Rate each project on the criteria', tab: 'judging' as const, icon: Gavel },
      { label: 'View results', hint: 'See how scoring is shaping up', tab: 'results' as const, icon: Trophy },
    ];
  }
  // participant / voter
  return [
    onTeam
      ? { label: 'Submit your project', hint: 'Add repo, demo, and video links', tab: 'submissions' as const, icon: FileCode2 }
      : { label: 'Create or join a team', hint: 'Team up before submitting', tab: 'teams' as const, icon: Users },
    { label: 'Vote on submissions', hint: 'Back your favorite projects', tab: 'submissions' as const, icon: FileCode2 },
    { label: 'View results', hint: 'See the live leaderboard', tab: 'results' as const, icon: Trophy },
  ];
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <span className="text-ui-2xs uppercase tracking-wider text-muted-foreground block">
          {label}
        </span>
        <span className="text-ui-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
