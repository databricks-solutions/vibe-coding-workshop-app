import type { Idea, SourceUseCase, UseCaseContext } from './types';

type CreateIdea = (seed: string, industry: string, extra?: Partial<Idea>) => Idea;

function firstSentence(text: string, max = 240) {
  const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Starts an Insights idea from an approved use case. Step 1 is filled straight
 * from the catalog and step 2 is drafted in the background; both stay marked
 * pre-filled until the user confirms them, so nothing is skipped.
 */
export function seedFromUseCase(
  createIdea: CreateIdea,
  { uc, context, questions, sessionId }: { uc: SourceUseCase; context: UseCaseContext; questions: string[]; sessionId: string | null },
): Idea {
  const summary = context.summary || uc.label;
  return createIdea(summary, uc.industryLabel, {
    title: uc.label,
    mode: 'insights',
    sessionId,
    startPath: 'approved',
    sourceUseCase: uc,
    useCaseContext: context,
    prefilled: ['spark', 'map'],
    spark: {
      title: uc.label,
      statement: firstSentence(summary) || uc.label,
      industry: uc.industryLabel,
      catalogIndustry: uc.industry,
      catalogIndustryLabel: uc.industryLabel,
    },
    genieQuestions: questions.length ? questions : undefined,
    genieQuestionSources: Object.fromEntries(questions.map(q => [q, 'use_case'])),
    decisions: [{ at: new Date().toISOString(), text: `Started from the approved use case "${uc.label}"` }],
  });
}
