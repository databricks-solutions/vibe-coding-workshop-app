import type { InsightsStage } from './progress';
import type { Idea } from '../journeykit';

/**
 * Where "Back to the idea" and "Update build" land. A locked idea goes back to where its data was chosen, with
 * that choice kept; the idea itself is one Back away from there. An idea still being shaped opens its steps.
 */
export function reviewTarget(to: 'idea' | 'update', lockedAt: string | undefined): InsightsStage {
  if (!lockedAt) return 'idea';
  return to === 'update' ? 'locked' : 'data';
}

/** Ideas built in Insights go back inside the open project, including ones first shaped in Ideate. */
export const reviewsInInsights = (idea: Pick<Idea, 'mode' | 'buildTarget'>) =>
  idea.mode === 'insights' || idea.buildTarget === 'insights';
