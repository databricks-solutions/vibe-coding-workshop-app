import { AnimatedPoints } from '../../celebration/AnimatedPoints';
import { IDEA_OUTCOME_POINTS, IDEA_QUALITY_MAX, calculateIdeaScore, ideaTierFor, nextIdeaTier } from '../../../constants/scoring';
import type { Idea } from '../engine/types';
import { TIER_TOKENS, scoreTone } from '../tokens';

const JOURNEY_MAX = 300;

/** Idea Points in the header: a quiet pill, with the breakdown on hover like the clarity ring. */
export function PointsChip({ idea }: { idea: Idea }) {
  const s = calculateIdeaScore(idea);
  const tier = ideaTierFor(s.total);
  const next = nextIdeaTier(s.total);
  const toNext = next ? Math.round(((s.total - tier.floor) / (next.floor - tier.floor)) * 100) : 100;
  const dims = idea.score?.breakdown ?? null;
  const outcomeMax = IDEA_OUTCOME_POINTS.first + IDEA_OUTCOME_POINTS.second;

  return (
    <div className="relative group">
      <span className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-border bg-card text-ui-xs font-semibold tabular-nums cursor-default`}>
        <span className="text-foreground"><AnimatedPoints points={s.total} prefix="" /></span>
        <span className="text-muted-foreground font-normal">pts</span>
        <span className={`px-1.5 py-px rounded-full text-ui-3xs ${TIER_TOKENS[tier.key].chip}`}>{tier.label}</span>
      </span>
      <div className="absolute right-0 top-full mt-2 w-64 z-30 rounded-xl border border-border bg-card shadow-xl p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
        <p className="text-ui-xs font-semibold text-foreground mb-2">Idea Points</p>
        <ul className="space-y-1.5 text-ui-xs">
          <Row label="Climb" value={s.journey} max={JOURNEY_MAX} />
          <Row label="Quality scorecard" value={s.quality} max={IDEA_QUALITY_MAX} placeholder="At the summit" />
          <Row label={idea.mode === 'insights' ? 'Build' : 'Submitted and approved'} value={s.outcome} max={outcomeMax} />
        </ul>
        {dims && (
          <div className="mt-3 pt-2 border-t border-border space-y-1">
            {dims.map(d => (
              <div key={d.key} className="flex items-center gap-2 text-ui-2xs">
                <span className="flex-1 text-muted-foreground truncate">{d.label}</span>
                <span className="w-14 h-1 rounded-full bg-secondary overflow-hidden">
                  <span className={`block h-full ${scoreTone(d.score)}`} style={{ width: `${d.score}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-2 border-t border-border">
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full ${TIER_TOKENS[tier.key].bar} transition-all duration-700`} style={{ width: `${toNext}%` }} />
          </div>
          <p className="text-ui-2xs text-muted-foreground/80 mt-1.5">
            {next ? `${next.floor - s.total} points to ${next.label}.` : 'Top tier.'} Points count on the Insights leaderboard.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, max, placeholder }: { label: string; value: number | null; max: number; placeholder?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex-1 text-muted-foreground">{label}</span>
      {value === null ? (
        <span className="text-muted-foreground/60">{placeholder}</span>
      ) : (
        <span className="font-semibold tabular-nums text-foreground">{value}<span className="font-normal text-muted-foreground"> / {max}</span></span>
      )}
    </li>
  );
}
