import { useEffect, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { VoiceTextarea } from './VoiceTextarea';
import { NOT_SURE } from './types';

interface QuestionCardProps {
  question: string;
  options: string[];
  selected?: string;
  /** Small line above the question, e.g. "One quick follow-up". */
  eyebrow?: ReactNode;
  /** Index of the option to gently highlight as the likely answer. */
  suggested?: number;
  /** One-line reason shown under the options. */
  hint?: string;
  notSureLabel?: string;
  onPick: (value: string) => void;
  onNotSure: () => void;
  /** Returns an error message when free text can't be used. */
  validateOther?: (text: string) => string | null;
}

/** One clickable question with numbered options, "Not sure", and a free-text escape hatch. */
export function QuestionCard({
  question,
  options,
  selected,
  eyebrow,
  suggested,
  hint,
  notSureLabel = NOT_SURE,
  onPick,
  onNotSure,
  validateOther,
}: QuestionCardProps) {
  const [other, setOther] = useState('');
  const [showOther, setShowOther] = useState(false);
  const otherError = other.trim() && validateOther ? validateOther(other) : null;

  const pickOther = () => {
    if (!other.trim() || otherError) return;
    onPick(other.trim());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(options[n - 1]);
      else if (n === options.length + 1) onNotSure();
      else if (e.key.toLowerCase() === 'o') { e.preventDefault(); setShowOther(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onPick, onNotSure]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 animate-slide-up-fade">
      {eyebrow}
      <p className="text-ui-xl font-semibold text-foreground leading-snug">{question}</p>
      <div className="grid gap-2 mt-5 sm:grid-cols-2">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            className={`group flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition-all animate-cascade-in active:scale-[0.98] ${
              selected === opt
                ? 'border-primary bg-primary/10'
                : suggested === i && !selected
                  ? 'border-primary/30 bg-primary/[0.03] hover:border-primary/50 hover:bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <kbd className="w-6 h-6 rounded-md bg-secondary text-ui-2xs font-semibold text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {i + 1}
            </kbd>
            <span className="flex-1 text-ui-base text-foreground">{opt}</span>
            {suggested === i && !selected && <span className="text-ui-2xs text-primary/70">Likely</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={onNotSure}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        >
          <kbd className="text-ui-2xs font-semibold">{options.length + 1}</kbd> {notSureLabel}
        </button>
        {!showOther && (
          <button onClick={() => setShowOther(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
            <kbd className="text-ui-2xs font-semibold">O</kbd> Something else…
          </button>
        )}
      </div>
      {hint && (
        <p className="flex items-start gap-1.5 text-ui-xs text-muted-foreground mt-3">
          <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary/70" /> {hint}
        </p>
      )}
      {showOther && (
        <div className="mt-3 animate-slide-up-fade">
          <VoiceTextarea value={other} onChange={setOther} rows={2} autoFocus placeholder="Say or type your answer. Ctrl+Enter to save." onSubmit={pickOther} />
          <div className="flex items-center justify-end gap-3 mt-2">
            {otherError && <span className="text-ui-xs text-amber-400">{otherError}</span>}
            <button onClick={pickOther} disabled={!other.trim() || !!otherError} className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-ui-sm font-medium disabled:opacity-40">
              Save answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
