import { useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import { QuestionCard } from '../QuestionCard';
import { NOT_SURE } from '../types';

export function ClarifyStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const questions = idea.questions ?? [];
  const firstOpen = questions.findIndex(q => !idea.answers[q.id]);
  const [editing, setEditing] = useState<number | null>(null);

  const active = editing ?? (firstOpen === -1 ? null : firstOpen);
  const q = active !== null ? questions[active] : null;
  const answeredCount = questions.filter(x => idea.answers[x.id]).length;

  const pick = (value: string) => {
    if (!q || !value.trim()) return;
    flow.answer(q.id, value.trim());
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.id}
            onClick={() => idea.answers[x.id] && setEditing(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-8 bg-primary' : idea.answers[x.id] ? 'w-4 bg-emerald-500' : 'w-4 bg-secondary'
            }`}
          />
        ))}
        <span className="ml-2 text-ui-xs text-muted-foreground">{answeredCount} of {questions.length}</span>
      </div>

      {q && (
        <QuestionCard
          key={q.id}
          question={q.question}
          options={q.options}
          selected={idea.answers[q.id]}
          eyebrow={q.isFollowup && <p className="text-ui-2xs uppercase tracking-wider font-semibold text-amber-400 mb-1">One quick follow-up</p>}
          onPick={pick}
          onNotSure={() => pick(NOT_SURE)}
        />
      )}

      {!q && flow.loading === 'followup' && (
        <p className="flex items-center gap-2 text-ui-sm text-muted-foreground animate-fade-in">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking your answers for anything unclear…
        </p>
      )}

      {!q && flow.loading !== 'followup' && (
        <div className="space-y-2 animate-slide-up-fade">
          <p className="text-ui-2xs uppercase tracking-wider font-semibold text-emerald-400">All set. Here's what you told me</p>
          {questions.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setEditing(i)}
              className="group w-full flex items-start gap-3 text-left rounded-xl border border-border bg-card/60 px-4 py-3 hover:border-primary/40 animate-cascade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
              <span className="flex-1">
                <span className="block text-ui-xs text-muted-foreground">{x.question}</span>
                <span className={`block text-ui-base ${idea.answers[x.id] === NOT_SURE ? 'text-amber-400' : 'text-foreground'}`}>{idea.answers[x.id]}</span>
              </span>
              <Pencil className="w-3.5 h-3.5 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
