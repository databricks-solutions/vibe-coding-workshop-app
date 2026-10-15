import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Info, Sparkles } from 'lucide-react';
import { VoiceTextarea } from './VoiceTextarea';
import { NOT_SURE } from '../engine/types';

/** Multi-select answers are stored as one string with this separator. */
export const MULTI_SEPARATOR = '; ';

interface QuestionCardProps {
  question: string;
  options: string[];
  selected?: string;
  /** Small line above the question, e.g. "One quick follow-up". */
  eyebrow?: ReactNode;
  /** What the answer decides, shown under the question. */
  why?: string;
  /** Index of the option the AI would bet on; -1 or missing means no pick. */
  recommended?: number;
  /** Badge text on the recommended option. */
  recommendLabel?: string;
  /** Short reason the recommended option was picked. */
  recommendedWhy?: string;
  /** Show the recommended option first. Off for ordered ranges such as numbers. */
  reorder?: boolean;
  /** Pick all that apply. */
  multi?: boolean;
  /** One-line note shown under the options. */
  hint?: string;
  notSureLabel?: string;
  /** Text on the button that saves the answer and moves on. */
  confirmLabel?: string;
  onPick: (value: string) => void;
  onNotSure: () => void;
  /** Returns an error message when free text can't be used. */
  validateOther?: (text: string) => string | null;
}

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
};

const NOT_SURE_PICK = '\u0000not-sure';

/**
 * One decision. Picking only highlights an answer; nothing is saved until the
 * user presses the confirm button or Enter, so they can see and change what
 * they chose. Number keys pick, Enter confirms (or highlights the
 * recommendation when nothing is picked yet), O types an answer.
 */
export function QuestionCard({
  question,
  options,
  selected,
  eyebrow,
  why,
  recommended = -1,
  recommendLabel = 'Recommended',
  recommendedWhy,
  reorder = true,
  multi = false,
  hint,
  notSureLabel = NOT_SURE,
  confirmLabel = 'Next',
  onPick,
  onNotSure,
  validateOther,
}: QuestionCardProps) {
  const [other, setOther] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [picks, setPicks] = useState<string[]>(() => {
    if (!selected) return [];
    if (selected === NOT_SURE || selected === notSureLabel) return [NOT_SURE_PICK];
    return multi ? selected.split(MULTI_SEPARATOR).filter(p => options.includes(p)) : options.includes(selected) ? [selected] : [];
  });
  const otherError = other.trim() && validateOther ? validateOther(other) : null;

  const rec = recommended >= 0 && recommended < options.length ? options[recommended] : null;
  const ordered = useMemo(
    () => (rec && reorder ? [rec, ...options.filter(o => o !== rec)] : options),
    [options, rec, reorder],
  );
  const notSurePicked = picks.includes(NOT_SURE_PICK);

  const choose = (opt: string) => setPicks(p => {
    if (!multi) return [opt];
    const rest = p.filter(x => x !== NOT_SURE_PICK);
    return rest.includes(opt) ? rest.filter(x => x !== opt) : [...rest, opt];
  });
  const chooseNotSure = () => setPicks([NOT_SURE_PICK]);

  const confirm = () => {
    if (!picks.length) return;
    if (notSurePicked) onNotSure();
    else onPick(ordered.filter(o => picks.includes(o)).join(MULTI_SEPARATOR));
  };

  const pickOther = () => {
    if (!other.trim() || otherError) return;
    const kept = ordered.filter(o => picks.includes(o));
    onPick(multi && kept.length ? [...kept, other.trim()].join(MULTI_SEPARATOR) : other.trim());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ordered.length) choose(ordered[n - 1]);
      else if (n === ordered.length + 1) chooseNotSure();
      else if (e.key.toLowerCase() === 'o') { e.preventDefault(); setShowOther(true); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        if (picks.length) { e.preventDefault(); confirm(); }
        else if (rec) { e.preventDefault(); choose(rec); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const keyHint = picks.length
    ? `1 to ${ordered.length} to change, Enter to continue`
    : rec
      ? `1 to ${ordered.length} to pick, Enter for ${recommendLabel.toLowerCase()}`
      : `1 to ${ordered.length} to pick`;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 animate-slide-up-fade">
      {eyebrow}
      <p className="text-ui-xl font-semibold text-foreground leading-snug">{question}</p>
      {why && (
        <p className="flex items-center gap-1.5 text-ui-xs text-muted-foreground mt-1.5">
          <Info className="w-3 h-3 shrink-0" /> {why}
        </p>
      )}
      {multi && <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mt-4">Pick all that apply</p>}
      <div className={`grid gap-2 sm:grid-cols-2 ${multi ? 'mt-2' : 'mt-5'}`}>
        {ordered.map((opt, i) => {
          const on = picks.includes(opt);
          const isRec = opt === rec;
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              aria-pressed={on}
              className={`group relative flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition-all animate-cascade-in active:scale-[0.98] ${
                on
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                  : isRec
                    ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-primary/15 hover:border-primary/60 hover:bg-primary/[0.07]'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
              } ${isRec && reorder && !multi ? 'sm:col-span-2' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <kbd className={`w-6 h-6 shrink-0 rounded-md text-ui-2xs font-semibold flex items-center justify-center transition-colors ${
                on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground'
              }`}>
                {on ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </kbd>
              <span className="flex-1 min-w-0">
                <span className="block text-ui-base text-foreground">{opt}</span>
                {isRec && recommendedWhy && !on && <span className="block text-ui-xs text-muted-foreground mt-0.5">{recommendedWhy}</span>}
              </span>
              {isRec && (
                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-ui-2xs font-medium">
                  <Sparkles className="w-3 h-3" /> {recommendLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={chooseNotSure}
          aria-pressed={notSurePicked}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm transition-colors ${
            notSurePicked ? 'bg-primary/10 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          {notSurePicked ? <Check className="w-3.5 h-3.5" /> : <kbd className="text-ui-2xs font-semibold">{ordered.length + 1}</kbd>} {notSureLabel}
        </button>
        {!showOther && (
          <button onClick={() => setShowOther(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
            <kbd className="text-ui-2xs font-semibold">O</kbd> Something else…
          </button>
        )}
        <span className="hidden md:inline ml-auto text-ui-2xs text-muted-foreground/70">{keyHint}</span>
        <button
          onClick={confirm}
          disabled={!picks.length}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-ui-sm font-medium shadow-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed md:ml-0 ml-auto"
        >
          {confirmLabel}{multi && picks.length && !notSurePicked ? ` (${picks.length})` : ''} <ArrowRight className="w-3.5 h-3.5" />
        </button>
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
