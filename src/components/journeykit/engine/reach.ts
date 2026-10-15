import { stepIndex, stepsOf } from './ideaContext';
import type { Idea, StepKey } from './types';

export function hasOutput(idea: Idea, step: StepKey) {
  switch (step) {
    case 'spark': return !!idea.spark;
    case 'map': return !!idea.map;
    case 'clarify': return !!idea.questions?.length;
    case 'shape': return !!idea.shapes?.length;
    case 'questions': return !!idea.genieQuestions?.length;
    case 'impact': return !!idea.impact;
    case 'brief': return !!idea.brief;
  }
}

/** A step opens once the one before it is approved. */
export function canReach(idea: Idea, step: StepKey) {
  const i = stepIndex(step, idea.mode);
  return i === 0 || idea.approved.includes(stepsOf(idea)[i - 1].key);
}
