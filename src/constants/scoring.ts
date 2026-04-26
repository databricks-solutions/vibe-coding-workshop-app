/**
 * Scoring Constants for Vibe Coding Workshop
 * 
 * Mirrors the backend scoring logic from lakebase.py
 * Used for instant point calculation and chapter detection in the UI
 */

// Points per step based on chapter difficulty
// Later chapters = harder = more points
export const STEP_SCORES: Record<number, number> = {
  // Foundation (steps 1-3): 10 points each
  1: 10, 2: 10, 3: 10,
  // Chapter 1 - Databricks App (steps 4-5): 20 points each
  4: 20, 5: 20,
  // Chapter 2 - Lakebase (steps 6-8): 30 points each
  6: 30, 7: 30, 8: 30,
  // Chapter 3 - Lakehouse (steps 9-14, 22-23): 40 points each
  9: 40, 10: 40, 11: 40, 12: 40, 13: 40, 14: 40, 22: 40, 23: 40,
  // Activation - Reverse ETL (steps 32-37): 40 points each
  32: 40, 33: 40, 34: 40, 35: 40, 36: 40, 37: 40,
  // Chapter 4 - AI and Agents (steps 15-19, 24-25): 50 points each
  15: 50, 16: 50, 17: 50, 18: 50, 19: 50, 24: 50, 25: 50,
  // Refinement (steps 20-21): 60 points each
  20: 60, 21: 60,
  // Agent Skills (steps 26-30): 40 points each
  26: 40, 27: 40, 28: 40, 29: 40, 30: 40,
  // Clean Up (step 31): 10 points
  31: 10,
  // Agents Accelerator — Agents on Apps (steps 38-45): 50 points each
  38: 50, 39: 50, 40: 50, 41: 50, 42: 50, 43: 50, 44: 50, 45: 50,
  // Agents Accelerator — MLflow for Gen-AI (steps 46-54): 50 points each
  46: 50, 47: 50, 48: 50, 49: 50, 50: 50, 51: 50, 52: 50, 53: 50, 54: 50,
};

// Chapter definitions for milestone detection
export const CHAPTERS: Record<string, { steps: Set<number>; display: string }> = {
  'Foundation': { steps: new Set([1, 2, 3]), display: 'Foundation' },
  'Chapter 1': { steps: new Set([4, 5]), display: 'Databricks App' },
  'Chapter 2': { steps: new Set([6, 7, 8]), display: 'Lakebase' },
  'Chapter 3': { steps: new Set([9, 10, 11, 12, 13, 14, 22, 23]), display: 'Lakehouse' },
  'Chapter 4': { steps: new Set([15, 16, 17, 18, 19, 24, 25]), display: 'AI and Agents' },
  'Activation': { steps: new Set([32, 33, 34, 35, 36, 37]), display: 'Reverse ETL' },
  'Refinement': { steps: new Set([20, 21]), display: 'Refinement' },
  'Agent Skills': { steps: new Set([26, 27, 28, 29, 30]), display: 'Agent Skills' },
  'Agents Accelerator': { steps: new Set([38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54]), display: 'Agents Accelerator' },
  'Clean Up': { steps: new Set([31]), display: 'Clean Up' },
};

/**
 * Get points for completing a specific step
 */
export function getStepPoints(step: number): number {
  return STEP_SCORES[step] || 0;
}

/**
 * Calculate total score from completed steps.
 * Skipped steps earn 0 points, so they should not be included in completedSteps.
 */
export function calculateTotalScore(completedSteps: Set<number> | number[], skippedSteps?: Set<number> | number[]): number {
  const steps = completedSteps instanceof Set ? Array.from(completedSteps) : completedSteps;
  const skipped = skippedSteps
    ? (skippedSteps instanceof Set ? skippedSteps : new Set(skippedSteps))
    : new Set<number>();
  return steps.reduce((total, step) => {
    if (skipped.has(step)) return total;
    return total + (STEP_SCORES[step] || 0);
  }, 0);
}

/**
 * Check if completing a step completes a chapter.
 * Skipped steps count as "done" for chapter completion but earn 0 points.
 * When visibleSteps is provided, only steps visible in the current workshop
 * level are required for chapter completion (hidden steps are ignored).
 */
export function getCompletedChapter(
  completedSteps: Set<number>,
  newlyCompletedStep: number,
  skippedSteps: Set<number> = new Set(),
  visibleSteps?: Set<number>
): { name: string; display: string; chapterPoints: number } | null {
  // Merge completed + newly completed + skipped for chapter-done check
  const allDone = new Set(completedSteps);
  allDone.add(newlyCompletedStep);
  for (const s of skippedSteps) allDone.add(s);
  
  // Check each chapter
  for (const [chapterName, chapterInfo] of Object.entries(CHAPTERS)) {
    if (!chapterInfo.steps.has(newlyCompletedStep)) continue;
    
    // Only require steps that are actually visible in the current workshop level
    const requiredSteps = visibleSteps
      ? Array.from(chapterInfo.steps).filter(s => visibleSteps.has(s))
      : Array.from(chapterInfo.steps);
    
    if (requiredSteps.length === 0) continue;
    
    const allChapterStepsDone = requiredSteps.every(step => allDone.has(step));
    
    if (allChapterStepsDone) {
      // Points only for completed (not skipped) visible steps
      const chapterPoints = requiredSteps.reduce(
        (total, step) => {
          if (skippedSteps.has(step)) return total;
          if (!completedSteps.has(step) && step !== newlyCompletedStep) return total;
          return total + (STEP_SCORES[step] || 0);
        },
        0
      );
      
      return {
        name: chapterName,
        display: chapterInfo.display,
        chapterPoints,
      };
    }
  }
  
  return null;
}

/**
 * Calculate how far a score is from the top 10
 * Returns a friendly message
 */
export function getLeaderboardMessage(
  userScore: number,
  leaderboardScores: number[]
): string {
  if (leaderboardScores.length === 0) {
    return "You're leading the way!";
  }
  
  // Sort scores descending
  const sortedScores = [...leaderboardScores].sort((a, b) => b - a);
  
  // Find user's position
  const position = sortedScores.findIndex(score => userScore >= score);
  
  if (position === 0 || userScore >= sortedScores[0]) {
    return "🏆 You're #1!";
  }
  
  if (position > 0 && position < 10) {
    return `🔥 You're in the Top ${position + 1}!`;
  }
  
  // Calculate points needed to reach top 10
  const top10Threshold = sortedScores[Math.min(9, sortedScores.length - 1)];
  const pointsNeeded = top10Threshold - userScore + 1;
  
  if (pointsNeeded <= 0) {
    return "🎯 You're in the Top 10!";
  }
  
  return `${pointsNeeded} points to Top 10!`;
}
