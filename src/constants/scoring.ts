/**
 * Scoring Constants for Vibe Coding Workshop
 * 
 * Mirrors the backend scoring logic from lakebase.py
 * Used for instant point calculation and chapter detection in the UI
 */

import { NOT_SURE, type Idea, type JourneyMode, type StepKey } from '../components/journeykit/engine/types';

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
  // Agents Accelerator — Agents on Apps (steps 38-46): 50 points each
  38: 50, 39: 50, 40: 50, 41: 50, 42: 50, 43: 50, 44: 50, 45: 50, 46: 50,
  // Agents Accelerator — MLflow for Gen-AI (steps 47-54): 50 points each
  47: 50, 48: 50, 49: 50, 50: 50, 51: 50, 52: 50, 53: 50, 54: 50,
  // Agents Accelerator — MLflow tail (steps 55-56): 50 points each (T5 PR3c)
  55: 50, 56: 50,
  // Genie Accelerator — Semantic Layer (steps 57-61): 50 points each (T5 PR3c)
  57: 50, 58: 50, 59: 50, 60: 50, 61: 50,
  // Genie Accelerator — Genie Agent (steps 62-66, 71): 50 points each (T5 PR3c)
  62: 50, 63: 50, 64: 50, 65: 50, 66: 50, 71: 50,
  // Genie Accelerator — Genie Ontology (steps 67-69): 50 points each (T5 PR3c)
  67: 50, 68: 50, 69: 50,
  // Genie Accelerator — Genie Activation (steps 72-73): 40 points each (T5 PR3c)
  72: 40, 73: 40,
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
  'Agents Accelerator': { steps: new Set([38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56]), display: 'Agents Accelerator' },
  // Genie Accelerator chapters (T5 PR3c) — mirror the manifest's genie-accelerator
  // section groupings; kept as their own chapters (not merged into the shared
  // 'Chapter 4'/'Activation' sets) so cross-track chapter-completion is unaffected.
  'Semantic Layer': { steps: new Set([57, 58, 59, 60, 61]), display: 'Semantic Layer' },
  'Genie Agent': { steps: new Set([62, 63, 64, 65, 66, 71]), display: 'Genie Agent' },
  'Genie Ontology': { steps: new Set([67, 68, 69]), display: 'Genie Ontology' },
  'Genie Activation': { steps: new Set([72, 73]), display: 'Genie Activation' },
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

// ============== Idea Points (Ideate and Insights) ==============
// Mirrors IDEA_STEP_SCORES and friends in src/backend/api/ideate_ideas.py.
// Journey (up to 300) + AI quality (up to 600) + outcome (up to 100) = 1,000.

export const IDEA_STEP_SCORES: Record<JourneyMode, Partial<Record<StepKey, number>>> = {
  ideate: { spark: 20, map: 20, clarify: 50, shape: 25, questions: 50, impact: 40, brief: 45 },
  insights: { spark: 20, map: 20, clarify: 50, shape: 25, questions: 50, impact: 40, brief: 45 },
};

const POINTS_PER_ITEM = 10;
const DEPTH = { gaps: 15, case: 15, assumption: 5, assumptionMax: 20, max: 50 };
export const IDEA_OUTCOME_POINTS = { first: 40, second: 60 };
export const IDEA_QUALITY_MAX = 600;
export const IDEA_POINTS_MAX = 1000;

export type IdeaTier = 'spark' | 'shaped' | 'investable' | 'boardroom';

export const IDEA_TIERS: { key: IdeaTier; label: string; floor: number }[] = [
  { key: 'spark', label: 'Spark', floor: 0 },
  { key: 'shaped', label: 'Shaped', floor: 250 },
  { key: 'investable', label: 'Investable', floor: 500 },
  { key: 'boardroom', label: 'Boardroom-ready', floor: 750 },
];

/** Camps along the trail: finishing every step in one is a milestone, like a chapter in the technical flow. */
export const IDEA_PHASES: Record<JourneyMode, { key: string; display: string; steps: StepKey[] }[]> = {
  ideate: [
    { key: 'understand', display: 'Problem understood', steps: ['spark', 'map', 'clarify'] },
    { key: 'design', display: 'Approach designed', steps: ['shape', 'questions', 'impact'] },
    { key: 'summit', display: 'Summit reached', steps: ['brief'] },
  ],
  insights: [
    { key: 'understand', display: 'Problem understood', steps: ['spark', 'map', 'clarify'] },
    { key: 'design', display: 'Approach designed', steps: ['shape', 'questions', 'impact'] },
    { key: 'camp', display: 'Ready to build', steps: ['brief'] },
  ],
};

const modeOfIdea = (idea: Pick<Idea, 'mode'>): JourneyMode => (idea.mode === 'insights' ? 'insights' : 'ideate');

function realAnswers(idea: Idea) {
  return (idea.questions ?? []).filter(q => { const a = idea.answers[q.id]; return !!a && a !== NOT_SURE; }).length;
}

/** Share of impact answers the user gave themselves; null when Impact was skipped or not sized. */
function impactShare(idea: Idea): number | null {
  if (!idea.impact || idea.impact.skipped) return null;
  const answers = Object.values(idea.impact.answers ?? {});
  if (!answers.length) return 0;
  return answers.filter(a => a.source === 'you said').length / answers.length;
}

/** Points a step is worth at most on this idea's trail. */
export function ideaStepAvailable(idea: Pick<Idea, 'mode'>, step: StepKey): number {
  return IDEA_STEP_SCORES[modeOfIdea(idea)][step] ?? 0;
}

/** Points earned on a step; only approved steps count. */
export function ideaStepPoints(idea: Idea, step: StepKey): number {
  const available = ideaStepAvailable(idea, step);
  if (!available || !idea.approved.includes(step)) return 0;
  if (step === 'clarify') return Math.min(available, POINTS_PER_ITEM * realAnswers(idea));
  if (step === 'questions') return Math.min(available, POINTS_PER_ITEM * (idea.genieQuestions?.length ?? 0));
  if (step === 'impact') {
    const share = impactShare(idea);
    return share === null ? 0 : Math.round(available * (0.5 + 0.5 * share));
  }
  return available;
}

export function ideaDepthPoints(idea: Idea): number {
  let pts = 0;
  if (idea.gaps?.length) pts += DEPTH.gaps;
  if (idea.caseOpenedAt) pts += DEPTH.case;
  const resolved = idea.assumptions.filter(a => a.status === 'accepted' || a.status === 'question').length;
  pts += Math.min(DEPTH.assumptionMax, DEPTH.assumption * resolved);
  return Math.min(DEPTH.max, pts);
}

export function ideaJourneyPoints(idea: Idea): number {
  const steps = Object.keys(IDEA_STEP_SCORES[modeOfIdea(idea)]) as StepKey[];
  return steps.reduce((n, s) => n + ideaStepPoints(idea, s), 0) + ideaDepthPoints(idea);
}

export function ideaOutcomePoints(idea: Idea): number {
  const insights = modeOfIdea(idea) === 'insights';
  const first = insights ? !!idea.lockedAt : !!idea.catalogRef;
  const second = insights ? idea.buildStage === 'studio' : first && !!idea.score?.approvedInLibrary;
  return (first ? IDEA_OUTCOME_POINTS.first : 0) + (second ? IDEA_OUTCOME_POINTS.second : 0);
}

export interface IdeaPointsBreakdown {
  journey: number;
  quality: number | null;
  outcome: number;
  total: number;
  tier: IdeaTier;
}

/** The score shown in the UI: journey and outcome computed live, quality from the server's scorecard. */
export function calculateIdeaScore(idea: Idea): IdeaPointsBreakdown {
  const journey = ideaJourneyPoints(idea);
  const outcome = ideaOutcomePoints(idea);
  const quality = idea.score?.quality ?? null;
  const total = journey + outcome + (quality ?? 0);
  return { journey, quality, outcome, total, tier: ideaTierFor(total).key };
}

export function ideaTierFor(total: number) {
  return [...IDEA_TIERS].reverse().find(t => total >= t.floor) ?? IDEA_TIERS[0];
}

export function nextIdeaTier(total: number) {
  return IDEA_TIERS.find(t => t.floor > total) ?? null;
}

/** The camp finished by approving `newlyApproved`, if any; mirrors getCompletedChapter. */
export function getCompletedIdeaPhase(idea: Pick<Idea, 'mode' | 'approved'>, newlyApproved: StepKey) {
  const approved = new Set([...idea.approved, newlyApproved]);
  return IDEA_PHASES[modeOfIdea(idea)].find(p => p.steps.includes(newlyApproved) && p.steps.every(s => approved.has(s))) ?? null;
}
