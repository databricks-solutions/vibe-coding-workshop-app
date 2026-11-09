import { Info, Loader2, Sparkles } from 'lucide-react';
import { MAX_GENIE_QUESTIONS, RECOMMENDED_GENIE_QUESTIONS, type IdeaFlow } from '../engine/useIdeaFlow';
import type { QuestionKind } from '../engine/types';
import { QuestionListEditor } from '../ui/QuestionListEditor';
import { GhostButton } from '../ui/primitives';

const DECISION_STAGES: { kind: QuestionKind; label: string }[] = [
  { kind: 'look_back', label: 'Look back' },
  { kind: 'track_live', label: 'Track live' },
  { kind: 'look_ahead', label: 'Look ahead' },
  { kind: 'what_to_do', label: 'What to do' },
];

export function QuestionsStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const questions = idea.genieQuestions ?? [];
  const fromUseCase = questions.filter(q => idea.genieQuestionSources?.[q] === 'use_case').length;
  const suggested = questions.filter(q => idea.genieQuestionSources?.[q] === 'ai').length;
  const suggestionRoom = RECOMMENDED_GENIE_QUESTIONS - questions.length;
  const coveredKinds = new Set(questions.flatMap(q => idea.questionDetails?.[q]?.kind ? [idea.questionDetails[q]!.kind!] : []));

  return (
    <div className="space-y-5">
      <div className="animate-fade-in">
        <p className="text-ui-xl font-semibold text-foreground leading-snug">Which questions should Genie answer on day one?</p>
        <p className="flex items-center gap-1.5 text-ui-xs text-muted-foreground mt-1.5">
          <Info className="w-3 h-3 shrink-0" /> These become the test set the Genie is checked against, and they decide which data it needs.
        </p>
        <p className="text-ui-md text-muted-foreground mt-3">
          {fromUseCase > 0
            ? `${fromUseCase} came from your use case${suggested ? ` and ${suggested} are recommended` : ''}. Keep, edit, or add your own. Aim for 3 to 6.`
            : suggested > 0
              ? `${suggested} recommended to start. Remove any that miss, tap one below to swap in, or add your own. Aim for 3 to 6.`
              : 'Plain-English questions someone would type into Genie. Keep the ones that matter, edit freely, aim for 3 to 6.'}
        </p>
      </div>
      {flow.ideaStudioVersion === 'v2' && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
          <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary">Decision progression</p>
          <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-4">
            {DECISION_STAGES.map((stage, index) => {
              const covered = coveredKinds.has(stage.kind);
              return (
                <div key={stage.kind} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-ui-xs ${covered ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border bg-card/50 text-muted-foreground'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-ui-2xs font-semibold ${covered ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{index + 1}</span>
                  {stage.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <QuestionListEditor
        questions={questions}
        onChange={flow.setGenieQuestions}
        max={MAX_GENIE_QUESTIONS}
        sources={idea.genieQuestionSources}
        details={flow.ideaStudioVersion === 'v2' ? idea.questionDetails : undefined}
        validating={flow.validatingQuestions}
        onUseClearer={flow.replaceGenieQuestion}
        onKindChange={flow.setQuestionKind}
        suggestions={idea.genieAlternates}
        suggestionsLabel="More you could ask"
      />
      {suggestionRoom > 0 && (
        <GhostButton onClick={() => flow.run('questions')} disabled={!!flow.loading} className="text-primary hover:!text-primary">
          {flow.loading === 'questions' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Suggest {questions.length ? 'more' : 'some'} for me
        </GhostButton>
      )}
    </div>
  );
}
