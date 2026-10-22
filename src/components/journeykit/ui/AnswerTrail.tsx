import { Check, Pencil } from 'lucide-react';

export interface TrailItem {
  key: string;
  question: string;
  answer: string;
  /** Shown in amber, e.g. "Not sure" or an estimate the user didn't give. */
  soft?: boolean;
}

/** The answers given so far in a question step; click one to change it. */
export function AnswerTrail({
  items,
  onEdit,
  activeIndex = null,
}: {
  items: (TrailItem & { index: number })[];
  onEdit: (index: number) => void;
  activeIndex?: number | null;
}) {
  if (!items.length) return null;
  const ordered = [...items].sort((a, b) => {
    if (a.index === activeIndex) return -1;
    if (b.index === activeIndex) return 1;
    return a.index - b.index;
  });
  return (
    <div className="space-y-1.5 animate-fade-in">
      <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">Your answers so far</p>
      {ordered.map(x => {
        const active = x.index === activeIndex;
        return (
        <button
          key={x.key}
          onClick={() => onEdit(x.index)}
          aria-current={active ? 'step' : undefined}
          className={`group w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2 transition-colors ${
            active
              ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/15'
              : 'border-border bg-card/60 hover:border-primary/40'
          }`}
        >
          <Check className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-emerald-500'}`} />
          <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
            <span className="text-ui-xs text-muted-foreground truncate max-w-full">{x.question}</span>
            <span className={`text-ui-sm font-medium ${x.soft ? 'text-amber-500' : 'text-foreground'}`}>{x.answer}</span>
          </span>
          {active && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-ui-2xs font-semibold text-primary">Editing</span>}
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </button>
        );
      })}
    </div>
  );
}
