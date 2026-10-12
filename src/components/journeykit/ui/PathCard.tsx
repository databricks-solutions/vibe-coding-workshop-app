import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Check, Clock } from 'lucide-react';

interface PathCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  tag?: string;
  /** Short facts under the body, e.g. "About 6 min". */
  meta?: string[];
  selected: boolean;
  onSelect: () => void;
}

/** A large, equal-weight choice between ways to begin. */
export function PathCard({ icon: Icon, title, body, tag, meta = [], selected, onSelect }: PathCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group relative w-full h-full text-left rounded-3xl border p-5 sm:p-6 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        selected ? 'border-primary/60 bg-card ring-4 ring-primary/10 shadow-sm' : 'border-border bg-card hover:border-foreground/25 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
          <Icon className="w-6 h-6" />
        </span>
        {tag && <span className="px-2.5 py-1 rounded-full bg-secondary text-ui-xs font-medium text-muted-foreground">{tag}</span>}
      </div>
      <p className="mt-4 text-ui-xl font-semibold text-foreground leading-snug">{title}</p>
      <p className="mt-1.5 text-ui-md text-muted-foreground leading-relaxed">{body}</p>
      <div className="mt-4 flex items-center gap-3">
        {meta.map(m => (
          <span key={m} className="inline-flex items-center gap-1 text-ui-sm text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {m}</span>
        ))}
        <span className={`ml-auto inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground'}`}>
          {selected ? <Check className="w-4 h-4" strokeWidth={3} /> : <ArrowRight className="w-4 h-4" />}
        </span>
      </div>
    </button>
  );
}
