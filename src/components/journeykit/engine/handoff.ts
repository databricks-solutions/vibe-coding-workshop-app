import { answerFor, caseFigures, chosenShape, placedLeaf } from './ideaContext';
import { money, units } from './businessCase';
import { useIdeas } from './useIdeas';
import type { BuildTarget, Idea } from './types';

/** Answers-first approaches build in Insights; copilots and automations build in the Technical workflow. */
export function buildTargetFor(idea: Idea): BuildTarget {
  if (idea.buildTarget) return idea.buildTarget;
  if (idea.mode === 'insights') return 'insights';
  return chosenShape(idea)?.kind === 'insight' ? 'insights' : 'technical';
}

export const BUILD_TARGET_LABEL: Record<BuildTarget, string> = { insights: 'Insights', technical: 'Technical workflow' };

/** Starts a new project for the idea, or reopens the one it is linked to. */
export const startBuildHref = (idea: Idea) => `/?buildIdea=${encodeURIComponent(idea.id)}`;

/** Opens the idea's linked project in the view that builds it. */
export const openBuildHref = (idea: Idea) =>
  idea.sessionId ? `/?openSession=${encodeURIComponent(idea.sessionId)}&view=${buildTargetFor(idea)}` : null;

/** The idea is linked to a project that builds it. */
export const isBuilding = (idea: Idea) => !!idea.sessionId && (!!idea.buildTarget || idea.mode === 'insights');

/** Use case description handed to the Technical workflow: the brief when there is one, else the shaped idea. */
export function buildDescription(idea: Idea): string {
  if (idea.brief?.trim()) return `# ${idea.title}\n\n${idea.brief.trim()}`;
  const shape = chosenShape(idea);
  const f = caseFigures(idea);
  const who = placedLeaf(idea)?.personas ?? [];
  const lines = [
    `# ${idea.title}`,
    idea.spark?.statement ?? idea.seed,
    who.length ? `Who it's for: ${who.join(', ')}` : '',
    answerFor(idea, 'business') ? `Success metric: ${answerFor(idea, 'business')}` : '',
    shape ? `Approach: ${shape.title}. ${shape.value}` : '',
    f ? `Value: about ${money(f.value.expected)} a year${f.rollout ? ` across ${units(f.rollout.units, f.rollout.unit)}` : ''}` : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

export const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'idea';

/** The idea this project builds, if any: Ideate ideas handed to a build, or Insights ideas. */
export function useLinkedIdea(sessionId: string | null): Idea | undefined {
  const { ideas } = useIdeas();
  return sessionId ? ideas.find(i => i.sessionId === sessionId && (!!i.buildTarget || i.mode === 'insights')) : undefined;
}
