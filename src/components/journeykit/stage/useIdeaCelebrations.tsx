import { useEffect, useRef } from 'react';
import { Mountain } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { useCelebration } from '../../../hooks/useCelebration';
import { calculateIdeaScore, getCompletedIdeaPhase, ideaDepthPoints, ideaStepPoints } from '../../../constants/scoring';
import { ART } from '../art';
import { stepMeta } from '../engine/ideaContext';
import type { Idea, StepKey } from '../engine/types';
import { modeOf } from '../modes';
import { StoredScorecard } from '../ui/Scorecard';

const rankAgainst = (ideaId: string) => () =>
  apiClient.insightsLeaderboard({ limit: 100 }).then(rows => rows.filter(r => r.idea_id !== ideaId).map(r => r.total));

/**
 * Celebrates an idea's progress with the workshop's own celebration: a points pop per stop,
 * the milestone modal at each camp, and the scorecard at the top. Host it where the flow
 * stays mounted, since Insights leaves the idea screen as soon as the brief is locked.
 */
export function useIdeaCelebrations(idea: Idea | undefined, { readOnly = false, onRaise }: { readOnly?: boolean; onRaise?: (step: StepKey) => void } = {}) {
  const { celebrate, clear, overlay } = useCelebration({ disabled: readOnly || !idea || !!idea.sample });
  const prev = useRef<{ id: string; approved: StepKey[]; depth: number } | null>(null);

  useEffect(() => {
    if (!idea || readOnly || idea.sample) return;
    const depth = ideaDepthPoints(idea);
    const before = prev.current;
    prev.current = { id: idea.id, approved: idea.approved, depth };
    if (!before || before.id !== idea.id) return;

    const added = idea.approved.filter(s => !before.approved.includes(s));
    if (!added.length) {
      const gained = depth - before.depth;
      if (gained > 0) void celebrate({ type: 'step', pointsEarned: gained, stepTitle: 'Depth bonus' });
      return;
    }

    const step = added[added.length - 1];
    const points = ideaStepPoints(idea, step);
    const phase = getCompletedIdeaPhase({ mode: idea.mode, approved: before.approved }, step);
    const total = calculateIdeaScore(idea).total;
    const trail = modeOf(idea).trail;
    const raise = onRaise ? (s: StepKey) => { clear(); onRaise(s); } : undefined;

    if (step === 'brief') {
      void celebrate({
        type: 'milestone',
        pointsEarned: points,
        image: ART.celebrate,
        congratsTitle: trail.briefMilestone,
        totalScore: total,
        rankAgainst: rankAgainst(idea.id),
        body: <StoredScorecard ideaId={idea.id} editable autoScore onRaise={raise} />,
        hideFeedback: true,
        closeLabel: trail.briefMilestoneClose,
      });
    } else if (phase) {
      const phasePoints = phase.steps.reduce((n, s) => n + ideaStepPoints(idea, s), 0);
      void celebrate({
        type: 'milestone',
        pointsEarned: phasePoints,
        icon: Mountain,
        congratsTitle: phase.display,
        totalScore: total,
        rankAgainst: rankAgainst(idea.id),
        hideFeedback: true,
        closeLabel: 'Keep climbing',
      });
    } else if (points > 0) {
      void celebrate({ type: 'step', pointsEarned: points, stepTitle: stepMeta(idea, step).label });
    }
  }, [idea, readOnly, celebrate, clear, onRaise]);

  return overlay;
}
