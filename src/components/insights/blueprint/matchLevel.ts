import type { BlueprintFit } from './types';

export type MatchLevel = 'ok' | 'low' | 'veryLow';

/**
 * How well the data answers the participant's questions.
 * `veryLow`: under a third answered, or the AI calls the fit weak and half or fewer are answered.
 * `low`: more than half unanswered.
 */
export function matchLevel(answered: number, total: number, fit?: BlueprintFit['fit'] | null): MatchLevel {
  if (total <= 0) return 'ok';
  if (answered * 3 < total || (fit === 'weak' && answered * 2 <= total)) return 'veryLow';
  if ((total - answered) * 2 > total) return 'low';
  return 'ok';
}
