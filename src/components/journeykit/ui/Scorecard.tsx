import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Lock, RefreshCw, Sparkles } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { AnimatedPoints } from '../../celebration/AnimatedPoints';
import { IDEA_QUALITY_MAX, calculateIdeaScore } from '../../../constants/scoring';
import { flushIdea, serverSyncEnabled, setIdeaScore, useIdeas } from '../engine/useIdeas';
import type { Idea, IdeaScore, QualityDimension, StepKey } from '../engine/types';
import { DURATION, EASE, scoreTone } from '../tokens';
import { TierBadge } from './TierBadge';

/** The step that moves each dimension most, for "Raise your score". */
const RAISE_STEP: Record<QualityDimension['key'], StepKey> = {
  problem: 'spark',
  users: 'clarify',
  value: 'impact',
  feasibility: 'map',
  risks: 'shape',
  writing: 'brief',
};

// One judge call per idea revision, however many scorecards are on screen.
const inflight = new Map<string, Promise<IdeaScore>>();

function requestScore(idea: Idea): Promise<IdeaScore> {
  const key = `${idea.id}:${idea.revision ?? 0}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      await flushIdea(idea.id);
      const r = await apiClient.ideaScore(idea.id);
      setIdeaScore(idea.id, r.score as IdeaScore);
      return r.score as IdeaScore;
    })().finally(() => setTimeout(() => inflight.delete(key), 1000));
    inflight.set(key, p);
  }
  return p;
}

interface ScorecardProps {
  idea: Idea;
  /** The owner can ask for (re)scoring; viewers only see the stored card. */
  editable?: boolean;
  /** Score automatically when there is no card for this revision yet. */
  autoScore?: boolean;
  onRaise?: (step: StepKey) => void;
}

/**
 * The AI scorecard: six dimensions a reviewer would judge, each with why it scored that way
 * and the one move that would raise it. Quality is up to 600 of an idea's 1,000 points.
 */
export function Scorecard({ idea, editable = false, autoScore = false, onRaise }: ScorecardProps) {
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const score = idea.score;
  const dims = score?.breakdown ?? null;
  const stale = !!dims && (score?.revision ?? 0) !== (idea.revision ?? 0);
  const canScore = editable && !!idea.brief && !idea.sample;

  const run = useCallback(async () => {
    if (!serverSyncEnabled()) {
      setError('The scorecard needs your ideas saved to your account. Sign in to the workshop app and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestScore(idea);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [idea]);

  useEffect(() => {
    if (autoScore && canScore && (!dims || stale) && !loading && !error) void run();
    // Only when the revision changes; `run` closes over the latest idea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScore, canScore, idea.revision, !!dims]);

  if (loading && !dims) {
    return (
      <div className="flex items-center gap-3 py-6" role="status">
        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        <div>
          <p className="text-ui-sm font-medium text-foreground">Reading your brief like a reviewer would…</p>
          <p className="text-ui-xs text-muted-foreground">Six dimensions, each with one way to raise it.</p>
        </div>
      </div>
    );
  }

  if (!dims) {
    return (
      <div className="py-4 space-y-3">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <p className="text-ui-sm text-muted-foreground">
            {idea.brief ? 'The scorecard rates how strong, specific and well written your idea is. Up to 600 points.' : 'The scorecard unlocks at the summit, once your brief is written.'}
          </p>
        </div>
        {error && <p className="text-ui-xs text-red-500">{error}</p>}
        {canScore && (
          <button onClick={run} className="inline-flex items-center gap-1.5 text-ui-sm font-medium text-primary hover:underline">
            <Sparkles className="w-3.5 h-3.5" /> {error ? 'Try again' : 'Get my scorecard'}
          </button>
        )}
      </div>
    );
  }

  const quality = score?.quality ?? 0;
  const total = calculateIdeaScore(idea).total;
  const weakest = [...dims].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality score</p>
          <p className="text-ui-3xl font-semibold text-foreground leading-none mt-1">
            <AnimatedPoints points={quality} prefix="" />
            <span className="text-ui-base font-normal text-muted-foreground"> / {IDEA_QUALITY_MAX}</span>
          </p>
        </div>
        <TierBadge total={total} />
      </div>
      {score?.headline && <p className="text-ui-sm text-foreground/80 leading-relaxed">{score.headline}</p>}

      <ul className="space-y-3">
        {dims.map((d, i) => (
          <li key={d.key}>
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-ui-sm font-medium text-foreground">{d.label}</span>
              <span className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.span
                  className={`block h-full rounded-full ${scoreTone(d.score)}`}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${d.score}%` }}
                  transition={{ duration: DURATION.slow * 2, ease: EASE, delay: reduceMotion ? 0 : 0.15 + i * 0.12 }}
                />
              </span>
              <span className="w-8 text-right text-ui-sm font-semibold tabular-nums text-foreground">{d.score}</span>
            </div>
            {(d.why || d.raise) && (
              <div className="pl-0 sm:pl-[10.75rem] mt-1 space-y-0.5">
                {d.why && <p className="text-ui-xs text-muted-foreground leading-relaxed">{d.why}{d.capped && ' Capped until the step it depends on is done.'}</p>}
                {d.raise && onRaise && editable && (
                  <button onClick={() => onRaise(RAISE_STEP[d.key])} className="inline-flex items-center gap-1 text-ui-xs font-medium text-primary hover:underline">
                    {d.raise} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                {d.raise && !(onRaise && editable) && <p className="text-ui-xs text-foreground/70">To raise it: {d.raise}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {onRaise && weakest && (
            <button onClick={() => onRaise(RAISE_STEP[weakest.key])} className="inline-flex items-center gap-1.5 text-ui-sm font-medium text-primary hover:underline">
              Raise your score: start with {weakest.label.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {stale && canScore && (
            <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> You changed the idea. Re-score
            </button>
          )}
          {error && <span className="text-ui-xs text-red-500">{error}</span>}
        </div>
      )}
    </div>
  );
}

/** A scorecard for a stored idea that stays live as its score arrives (e.g. inside a celebration). */
export function StoredScorecard({ ideaId, ...rest }: Omit<ScorecardProps, 'idea'> & { ideaId: string }) {
  const { ideas } = useIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  return idea ? <Scorecard idea={idea} {...rest} /> : null;
}
