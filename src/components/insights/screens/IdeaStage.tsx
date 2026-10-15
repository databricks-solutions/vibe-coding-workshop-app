import type { ReactNode } from 'react';
import { ArrowRight, CloudOff } from 'lucide-react';
import {
  IdeaStepStage, IdeaTools, JourneyProgress, JourneyScreen, MAX_GENIE_QUESTIONS, PrimaryButton, QuestionListEditor, useIdeaFlow,
  type IdeaFlow, type ProgressPhase, type StepKey,
} from '../../journeykit';
import { INDUSTRY_IDEAS } from '../journey';

interface IdeaStageProps {
  ideaId: string;
  industryId: string;
  phasesFor: (viewStep: StepKey) => ProgressPhase[];
  tools?: ReactNode;
  onBackFromFirst?: () => void;
  onChangeUseCase?: () => void;
}

/** Insights' idea phase: the exact Ideate steps, inside the Insights progress. Keyed by idea id by the caller. */
export function IdeaStage({ ideaId, industryId, phasesFor, tools, onBackFromFirst, onChangeUseCase }: IdeaStageProps) {
  const flow = useIdeaFlow(ideaId);
  if (!flow.idea) return null;
  return (
    <JourneyScreen
      progress={<JourneyProgress phases={phasesFor(flow.viewStep)} onSelectStep={k => flow.setViewStep(k as StepKey)} trailing="then 4 build chapters" />}
      tools={<>{tools}<IdeaTools flow={flow} /></>}
    >
      <IdeaStepStage
        flow={flow}
        unavailable={<ClassicFallback flow={flow} industryId={industryId} />}
        onBackFromFirst={onBackFromFirst}
        onChangeUseCase={flow.idea.sourceUseCase ? onChangeUseCase : undefined}
      />
    </JourneyScreen>
  );
}

/** When the idea helper is offline, people can still list their questions and carry on to the build. */
function ClassicFallback({ flow, industryId }: { flow: IdeaFlow; industryId: string }) {
  const idea = flow.idea!;
  const questions = idea.genieQuestions ?? [];
  const suggestions = (INDUSTRY_IDEAS.find(i => i.id === industryId)?.questions ?? []).filter(q => !questions.includes(q));
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary text-muted-foreground shrink-0"><CloudOff className="w-5 h-5" /></span>
        <div>
          <p className="text-ui-lg font-semibold text-foreground">The idea helper is offline right now</p>
          <p className="text-ui-md text-muted-foreground">You can still list the questions people should be able to ask, then go straight to your data. Your idea is saved; come back to shape it any time.</p>
        </div>
      </div>
      <QuestionListEditor
        questions={questions}
        onChange={flow.setGenieQuestions}
        max={MAX_GENIE_QUESTIONS}
        sources={idea.genieQuestionSources}
        suggestions={suggestions}
        autoFocus
      />
      <div className="flex justify-end">
        <PrimaryButton
          size="lg"
          disabled={!questions.length}
          onClick={() => flow.patch({ classic: true, lockedAt: new Date().toISOString() })}
        >
          Continue with these questions <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
