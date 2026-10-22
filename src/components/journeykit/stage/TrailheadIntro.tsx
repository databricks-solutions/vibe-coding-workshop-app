import { ArrowRight, Info } from 'lucide-react';
import { IDEA_OUTCOME_POINTS, IDEA_POINTS_MAX, IDEA_QUALITY_MAX } from '../../../constants/scoring';
import { stepsOf } from '../engine/ideaContext';
import type { Idea } from '../engine/types';
import { ideaMinutes, modeOf } from '../modes';
import { FadeIn, GhostButton, Headline, PrimaryButton } from '../ui/primitives';
import { ClimbRoute } from './ClimbMap';
import { ideaProgressSteps, ideaTrail } from './ideaProgress';

const CLIMB_POINTS = 300;

/**
 * The trailhead: shown once when an idea starts, so people see the whole route, what each stop
 * is and where the top is before they take the first step. The first step keeps working in the
 * background while they read.
 */
export function TrailheadIntro({ idea, onStart }: { idea: Idea; onStart: () => void }) {
  const config = modeOf(idea);
  const steps = ideaProgressSteps(idea, null).map((s, i) => ({ ...s, state: i === 0 ? 'current' as const : s.state, disabled: i > 0 }));
  const stops = stepsOf(idea).length;
  const minutes = ideaMinutes(idea.mode ?? 'ideate');
  const outcome = idea.mode === 'insights' ? 'starting your Genie' : 'getting it approved';
  const outcomePoints = IDEA_OUTCOME_POINTS.first + IDEA_OUTCOME_POINTS.second;

  return (
    <div className="space-y-6">
      <Headline
        eyebrow="Your route"
        title="Here's the climb."
        subtitle={`${stops} stops, about ${minutes} minutes. ${config.trail.summitLine} Tap any stop to see what happens there.`}
      />

      <FadeIn delay={0.05}>
        <ClimbRoute steps={steps} animateIn {...ideaTrail(idea)} />
      </FadeIn>

      <FadeIn delay={0.25} className="flex flex-wrap items-center gap-3">
        <PrimaryButton size="lg" onClick={onStart} autoFocus>
          Start the climb <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
        <GhostButton onClick={onStart}>Skip the tour</GhostButton>
        <p
          className="w-full sm:w-auto sm:ml-auto inline-flex items-center gap-1.5 text-ui-xs text-muted-foreground"
          title="Points count on the leaderboard."
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          Up to {IDEA_POINTS_MAX.toLocaleString()} points: {CLIMB_POINTS} for the climb, {IDEA_QUALITY_MAX} for brief quality, {outcomePoints} for {outcome}.
        </p>
      </FadeIn>
    </div>
  );
}
