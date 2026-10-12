import { Info, Loader2, Sparkles } from 'lucide-react';
import { MAX_GENIE_QUESTIONS, type IdeaFlow } from '../engine/useIdeaFlow';
import { QuestionListEditor } from '../ui/QuestionListEditor';
import { GhostButton } from '../ui/primitives';

export function QuestionsStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const questions = idea.genieQuestions ?? [];
  const fromUseCase = questions.filter(q => idea.genieQuestionSources?.[q] === 'use_case').length;
  const suggested = questions.filter(q => idea.genieQuestionSources?.[q] === 'ai').length;
  const room = MAX_GENIE_QUESTIONS - questions.length;

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
      <QuestionListEditor
        questions={questions}
        onChange={flow.setGenieQuestions}
        max={MAX_GENIE_QUESTIONS}
        sources={idea.genieQuestionSources}
        suggestions={idea.genieAlternates}
        suggestionsLabel="More you could ask"
      />
      {room > 0 && (
        <GhostButton onClick={() => flow.run('questions')} disabled={!!flow.loading} className="text-primary hover:!text-primary">
          {flow.loading === 'questions' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Suggest {questions.length ? 'more' : 'some'} for me
        </GhostButton>
      )}
    </div>
  );
}
