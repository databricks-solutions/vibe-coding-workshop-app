import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import { VoiceTextarea } from '../VoiceTextarea';
import { NOT_SURE, type ClarifyQuestion } from '../types';

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

      {q && <QuestionCard key={q.id} q={q} selected={idea.answers[q.id]} onPick={pick} />}

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

function QuestionCard({ q, selected, onPick }: { q: ClarifyQuestion; selected?: string; onPick: (value: string) => void }) {
  const [other, setOther] = useState('');
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) onPick(q.options[n - 1]);
      else if (n === q.options.length + 1) onPick(NOT_SURE);
      else if (e.key.toLowerCase() === 'o') { e.preventDefault(); setShowOther(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, onPick]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 animate-slide-up-fade">
      {q.isFollowup && <p className="text-ui-2xs uppercase tracking-wider font-semibold text-amber-400 mb-1">One quick follow-up</p>}
      <p className="text-ui-xl font-semibold text-foreground leading-snug">{q.question}</p>
      <div className="grid gap-2 mt-5 sm:grid-cols-2">
        {q.options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            className={`group flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition-all animate-cascade-in active:scale-[0.98] ${
              selected === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-primary/5'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <kbd className="w-6 h-6 rounded-md bg-secondary text-ui-2xs font-semibold text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {i + 1}
            </kbd>
            <span className="text-ui-base text-foreground">{opt}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={() => onPick(NOT_SURE)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        >
          <kbd className="text-ui-2xs font-semibold">{q.options.length + 1}</kbd> {NOT_SURE}
        </button>
        {!showOther && (
          <button onClick={() => setShowOther(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
            <kbd className="text-ui-2xs font-semibold">O</kbd> Something else…
          </button>
        )}
      </div>
      {showOther && (
        <div className="mt-3 animate-slide-up-fade">
          <VoiceTextarea value={other} onChange={setOther} rows={2} autoFocus placeholder="Say or type your answer. Ctrl+Enter to save." onSubmit={() => onPick(other)} />
          <div className="flex justify-end mt-2">
            <button onClick={() => onPick(other)} disabled={!other.trim()} className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-ui-sm font-medium disabled:opacity-40">
              Save answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
