import { useCallback, useState } from 'react';
import { CelebrationOverlay, type CelebrationData } from '../components/CelebrationOverlay';
import { getLeaderboardMessage } from '../constants/scoring';

export interface CelebrateOptions extends CelebrationData {
  /** Scores on the relevant leaderboard; a milestone uses them for "You're in the Top 5!". */
  rankAgainst?: () => Promise<number[]>;
}

/**
 * One way to celebrate progress anywhere in the app: a quick points pop for a step,
 * a modal with the leaderboard message for a milestone. Render `overlay` once.
 */
export function useCelebration({ disabled = false }: { disabled?: boolean } = {}) {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const celebrate = useCallback(async ({ rankAgainst, ...data }: CelebrateOptions) => {
    if (disabled) return;
    let leaderboardMessage = data.leaderboardMessage;
    if (data.type === 'milestone' && rankAgainst && data.totalScore !== undefined && leaderboardMessage === undefined) {
      try {
        leaderboardMessage = getLeaderboardMessage(data.totalScore, await rankAgainst());
      } catch (err) {
        console.error('Failed to fetch leaderboard for celebration:', err);
        leaderboardMessage = 'Keep going!';
      }
    }
    setCelebration({ ...data, leaderboardMessage });
  }, [disabled]);

  const clear = useCallback(() => setCelebration(null), []);
  const overlay = disabled ? null : <CelebrationOverlay celebration={celebration} onComplete={clear} />;

  return { celebration, celebrate, clear, overlay };
}
