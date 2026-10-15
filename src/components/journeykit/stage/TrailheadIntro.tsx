import { ArrowRight, Footprints, Gauge, Trophy } from 'lucide-react';
import { IDEA_OUTCOME_POINTS, IDEA_POINTS_MAX, IDEA_QUALITY_MAX } from '../../../constants/scoring';
import { stepsOf } from '../engine/ideaContext';
import type { Idea } from '../engine/types';
import { ideaMinutes, modeOf } from '../modes';
import { FadeIn, GhostButton, Headline, PrimaryButton } from '../ui/primitives';
import { ideaProgressSteps, ideaTrail } from './ideaProgress';
import { SummitTrail, TrailLegend } from './SummitTrail';

/**
 * The trailhead: shown once when an idea starts, so people see the whole route, what each stop
 * is worth, and where the top is before they take the first step. The first step keeps working
 * in the background while they read.
 */
export function TrailheadIntro({ idea, onStart }: { idea: Idea; onStart: () => void }) {
  const config = modeOf(idea);
  const steps = ideaProgressSteps(idea, null).map(s => ({ ...s, disabled: true }));
  const stops = stepsOf(idea).length;
  const minutes = ideaMinutes(idea.mode ?? 'ideate');
  const outcome = idea.mode === 'insights' ? 'starting and setting up your Genie' : 'submitting it and getting it approved';

  return (
    <div className="space-y-8">
      <Headline
        eyebrow="Your route"
        title="Here's the climb."
        subtitle={`${stops} stops, about ${minutes} minutes, up to ${IDEA_POINTS_MAX.toLocaleString()} points. ${config.trail.summitLine}`}
      />

      <FadeIn delay={0.1} className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="relative bg-gradient-to-b from-primary/[0.13] via-primary/[0.05] to-transparent">
          <SummitTrail steps={steps} size="lg" drawIn {...ideaTrail(idea)} />
        </div>
        <div className="px-4 sm:px-8 py-4 border-t border-border/60 bg-card">
          <TrailLegend />
        </div>
      </FadeIn>

      <FadeIn delay={0.35} className="grid gap-3 sm:grid-cols-3">
        <PointsWay icon={Footprints} title="Climb" points="Up to 300" text="Earn points at every stop. Real answers beat “not sure”." />
        <PointsWay icon={Gauge} title="Quality" points={`Up to ${IDEA_QUALITY_MAX}`} text="At the top, an AI reviewer scores how strong and clear your idea is." />
        <PointsWay icon={Trophy} title="Outcome" points={`Up to ${IDEA_OUTCOME_POINTS.first + IDEA_OUTCOME_POINTS.second}`} text={`For ${outcome}.`} />
      </FadeIn>

      <FadeIn delay={0.5} className="flex flex-wrap items-center gap-3">
        <PrimaryButton size="lg" onClick={onStart} autoFocus>
          Start the climb <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
        <GhostButton onClick={onStart}>Skip the tour</GhostButton>
        <span className="text-ui-xs text-muted-foreground">Your points count on the Insights leaderboard.</span>
      </FadeIn>
    </div>
  );
}

function PointsWay({ icon: Icon, title, points, text }: { icon: typeof Trophy; title: string; points: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-3.5 h-3.5" /></span>
        <span className="text-ui-sm font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-ui-xs font-semibold tabular-nums text-muted-foreground">{points}</span>
      </div>
      <p className="text-ui-xs text-muted-foreground mt-2 leading-relaxed">{text}</p>
    </div>
  );
}
