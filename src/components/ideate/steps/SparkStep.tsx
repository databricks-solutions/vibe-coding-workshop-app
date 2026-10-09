import { Quote } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';

export function SparkStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const spark = idea.spark;
  if (!spark) return null;

  const set = (patch: Partial<typeof spark>) =>
    flow.patch(i => ({ spark: { ...i.spark!, ...patch }, ...(patch.title !== undefined ? { title: patch.title } : {}) }));

  return (
    <div className="space-y-6 animate-slide-up-fade">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          <Quote className="w-3 h-3" /> You said
        </p>
        <p className="text-ui-base text-muted-foreground leading-relaxed">{idea.seed}</p>
      </div>

      <div className="space-y-4">
        <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary">Here's how I understood it</p>
        <input
          value={spark.title}
          onChange={e => set({ title: e.target.value })}
          className="w-full bg-transparent text-ui-3xl font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary/60 pb-1 transition-colors"
        />
        <textarea
          value={spark.statement}
          onChange={e => set({ statement: e.target.value })}
          rows={3}
          className="w-full resize-none bg-transparent text-ui-lg text-foreground leading-relaxed outline-none rounded-lg border border-transparent hover:border-border focus:border-primary/60 p-2 -m-2 transition-colors"
        />
        <div className="flex items-center gap-2">
          <span className="text-ui-xs text-muted-foreground">Industry</span>
          <input
            value={spark.industry}
            onChange={e => set({ industry: e.target.value })}
            className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-ui-sm font-medium outline-none border border-transparent focus:border-primary/50 w-auto"
            size={Math.max(8, spark.industry.length)}
          />
        </div>
        <p className="text-ui-xs text-muted-foreground/70">Click any text to edit it directly.</p>
      </div>
    </div>
  );
}
