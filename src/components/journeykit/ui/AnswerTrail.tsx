import { Check, Pencil } from 'lucide-react';

export interface TrailItem {
  key: string;
  question: string;
  answer: string;
  /** Shown in amber, e.g. "Not sure" or an estimate the user didn't give. */
  soft?: boolean;
}

/** The answers given so far in a question step; click one to change it. */
export function AnswerTrail({ items, onEdit }: { items: (TrailItem & { index: number })[]; onEdit: (index: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 animate-fade-in">
      <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">Your answers so far</p>
      {items.map(x => (
        <button
          key={x.key}
          onClick={() => onEdit(x.index)}
          className="group w-full flex items-center gap-3 text-left rounded-lg border border-border bg-card/60 px-3 py-2 hover:border-primary/40 transition-colors"
        >
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
            <span className="text-ui-xs text-muted-foreground truncate max-w-full">{x.question}</span>
            <span className={`text-ui-sm font-medium ${x.soft ? 'text-amber-500' : 'text-foreground'}`}>{x.answer}</span>
          </span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </button>
      ))}
    </div>
  );
}
