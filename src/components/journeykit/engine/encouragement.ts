import { calculateIdeaScore, ideaStepAvailable, ideaStepPoints, nextIdeaTier } from '../../../constants/scoring';
import { stepMeta, stepsOf } from './ideaContext';
import { NOT_SURE, type Idea, type StepKey } from './types';

export interface Nudge {
  /** One short sentence, specific to where the idea is. */
  text: string;
  /** Points the suggested move can earn, when it is a single move. */
  points?: number;
  /** Step to open for the suggested move. */
  step?: StepKey;
}

/**
 * The one line under the step that says what's next and why it's worth it.
 * Always specific (counts, points, the next stop) and never more than one sentence.
 */
export function nextNudge(idea: Idea, viewStep: StepKey): Nudge | null {
  const steps = stepsOf(idea);
  const required = steps.filter(s => !s.optional);
  const left = required.filter(s => !idea.approved.includes(s.key));
  const score = calculateIdeaScore(idea);
  const nextTier = nextIdeaTier(score.total);

  if (viewStep === 'clarify' && !idea.approved.includes('clarify') && idea.questions?.length) {
    const unanswered = idea.questions.filter(q => !idea.answers[q.id]).length;
    const notSure = idea.questions.filter(q => idea.answers[q.id] === NOT_SURE).length;
    if (unanswered) return { text: `Answer ${unanswered} more question${unanswered === 1 ? '' : 's'} to clear the switchbacks. Real answers earn 10 points each.`, step: 'clarify' };
    if (notSure) return { text: `${notSure} answer${notSure === 1 ? ' is' : 's are'} "Not sure yet". Picking a real answer earns 10 points each.`, points: notSure * 10, step: 'clarify' };
  }

  if (viewStep === 'impact' && !idea.approved.includes('impact')) {
    return { text: `The value step is optional but worth up to +${ideaStepAvailable(idea, 'impact')}, and it unlocks the value score on your scorecard.`, points: ideaStepAvailable(idea, 'impact'), step: 'impact' };
  }

  if (idea.approved.includes('brief')) {
    if (idea.impact?.skipped && ideaStepPoints(idea, 'impact') === 0) {
      return { text: `You skipped the value step. Sizing it is worth up to +${ideaStepAvailable(idea, 'impact')} and lifts your value score.`, points: ideaStepAvailable(idea, 'impact'), step: 'impact' };
    }
    if (!idea.gaps) return { text: 'Run "Find gaps" on the brief for +15, and see what a reviewer would ask.', points: 15, step: 'brief' };
    if (nextTier) return { text: `${nextTier.floor - score.total} points to ${nextTier.label}. Your scorecard shows the fastest way up.` };
    return { text: 'Top tier. Share it, submit it, or start the build.' };
  }

  if (!left.length) return null;
  const next = left[0];
  const stops = left.length;
  const label = stepMeta(idea, next.key).label;
  const available = ideaStepAvailable(idea, next.key);
  if (stops === 1) return { text: `One stop to the top: ${label.toLowerCase()} is worth +${available}.`, points: available, step: next.key };
  if (stops === 2) return { text: `Two stops to the top. Next: ${label.toLowerCase()}, worth up to +${available}.`, points: available, step: next.key };
  return { text: `Next stop: ${label.toLowerCase()}, worth up to +${available}. ${stops} stops to the top.`, points: available, step: next.key };
}

/** "You're at A few questions, 2 stops from the top." for someone reopening an idea. */
export function welcomeBack(idea: Idea): string | null {
  const required = stepsOf(idea).filter(s => !s.optional);
  const left = required.filter(s => !idea.approved.includes(s.key)).length;
  if (!idea.approved.length || !left) return null;
  const at = stepMeta(idea, idea.step).label;
  return `You're at ${at.toLowerCase()}, ${left === 1 ? 'one stop' : `${left} stops`} from the top.`;
}
