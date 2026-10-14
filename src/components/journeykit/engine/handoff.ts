import { answerFor, caseFigures, chosenShape, placedLeaf } from './ideaContext';
import { money, units } from './businessCase';
import { enabledAddOns } from './buildRecipes';
import { buildLines } from './surfaces';
import { useIdeas } from './useIdeas';
import type { BuildTarget, Idea } from './types';

/**
 * Answers-first approaches build in Insights. Signals, automations and copilots build in the
 * Technical workflow unless the Insights add-on that covers them is turned on.
 */
export function buildTargetFor(idea: Idea): BuildTarget {
  if (idea.buildTarget) return idea.buildTarget;
  if (idea.mode === 'insights') return 'insights';
  const kind = chosenShape(idea)?.kind;
  if (kind === 'insight') return 'insights';
  const on = enabledAddOns();
  if ((kind === 'signal' || kind === 'automation') && on.has('alerts')) return 'insights';
  if (kind === 'copilot' && on.has('copilot')) return 'insights';
  return 'technical';
}

export const BUILD_TARGET_LABEL: Record<BuildTarget, string> = { insights: 'Insights', technical: 'Technical workflow' };

/** Starts a new project for the idea, or reopens the one it is linked to. */
export const startBuildHref = (idea: Idea) => `/?buildIdea=${encodeURIComponent(idea.id)}`;

/** Opens the idea's linked project in the view that builds it. */
export const openBuildHref = (idea: Idea) =>
  idea.sessionId ? `/?openSession=${encodeURIComponent(idea.sessionId)}&view=${buildTargetFor(idea)}` : null;

/** Rewrites the linked project from the idea's latest answers. */
export const updateBuildHref = (idea: Idea) => `/?updateBuild=${encodeURIComponent(idea.id)}`;

/** Asks the open Insights project to show its idea again (`idea`) or the update screen (`update`). */
export const REVIEW_IDEA_EVENT = 'v2v:review-idea';
export type ReviewIdeaDetail = { ideaId: string; to: 'idea' | 'update' };
export const reviewIdea = (detail: ReviewIdeaDetail) => window.dispatchEvent(new CustomEvent<ReviewIdeaDetail>(REVIEW_IDEA_EVENT, { detail }));

/** The idea is linked to a project that builds it. */
export const isBuilding = (idea: Idea) => !!idea.sessionId && (!!idea.buildTarget || idea.mode === 'insights');

/** The project has been set up from the idea; Insights projects only once their build chapters exist. */
export const hasBuild = (idea: Idea) => isBuilding(idea) && (buildTargetFor(idea) === 'technical' || idea.buildStage === 'studio');

/** Approved answers changed since the build was set up; it keeps running on the old ones until updated. */
export const needsBuildUpdate = (idea: Idea) => hasBuild(idea) && (idea.revision ?? 0) > (idea.builtRevision ?? 0);

/** Use case description handed to the Technical workflow: the brief when there is one, else the shaped idea. */
export function buildDescription(idea: Idea): string {
  const shape = chosenShape(idea);
  const builds = buildLines(shape);
  if (idea.brief?.trim()) return [`# ${idea.title}`, idea.brief.trim(), builds.length ? `## What It Builds\n\n${builds.map(l => `- ${l}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
  const f = caseFigures(idea);
  const who = placedLeaf(idea)?.personas ?? [];
  const lines = [
    `# ${idea.title}`,
    idea.spark?.statement ?? idea.seed,
    who.length ? `Who it's for: ${who.join(', ')}` : '',
    answerFor(idea, 'business') ? `Success metric: ${answerFor(idea, 'business')}` : '',
    shape ? `Approach: ${shape.title}. ${shape.value}` : '',
    ...builds,
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
