import type { InsightsStage } from './progress';
import type { Idea } from '../journeykit';

/**
 * Where "Review idea" and "Update build" land. Reviewing always opens the seven
 * idea steps directly; updating opens the locked summary so the latest approved
 * revision can be carried into the build deliberately.
 */
export function reviewTarget(to: 'idea' | 'update', lockedAt: string | undefined): InsightsStage {
  if (!lockedAt) return 'idea';
  return to === 'update' ? 'locked' : 'idea';
}

/** Ideas built in Insights go back inside the open project, including ones first shaped in Ideate. */
export const reviewsInInsights = (idea: Pick<Idea, 'mode' | 'buildTarget'>) =>
  idea.mode === 'insights' || idea.buildTarget === 'insights';
