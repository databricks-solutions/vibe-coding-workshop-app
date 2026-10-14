import { CircleDollarSign, Quote } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';

const LINE = { cost: 'Lower cost', revenue: 'More revenue', risk: 'Less risk', capacity: 'More capacity' } as const;

export function SparkStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const spark = idea.spark;
  if (!spark) return null;

  const { readOnly } = flow;
  // Renaming keeps the approvals; changing what the idea is reopens the steps built on it.
  const set = (patch: Partial<typeof spark>) => {
    const apply = (i: typeof idea) => ({ spark: { ...i.spark!, ...patch }, ...(patch.title !== undefined ? { title: patch.title } : {}) });
    if (Object.keys(patch).every(k => k === 'title')) flow.patch(apply);
    else flow.revise('spark', apply, 'Changed how the idea is described');
  };

  return (
    <div className="space-y-6 animate-slide-up-fade">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          <Quote className="w-3 h-3" /> {idea.startPath === 'approved' ? 'From the use case' : 'You said'}
        </p>
        <p className="text-ui-base text-muted-foreground leading-relaxed">{idea.seed}</p>
      </div>

      <div className="space-y-4">
        <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary">Here's how I understood it</p>
        <input
          title={readOnly ? undefined : 'Click to edit'}
          readOnly={readOnly}
          value={spark.title}
          onChange={e => set({ title: e.target.value })}
          className="w-full bg-transparent text-ui-3xl font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary/60 pb-1 transition-colors"
        />
        <textarea
          title={readOnly ? undefined : 'Click to edit'}
          readOnly={readOnly}
          value={spark.statement}
          onChange={e => set({ statement: e.target.value })}
          rows={3}
          className="w-full resize-none bg-transparent text-ui-lg text-foreground leading-relaxed outline-none rounded-lg border border-transparent hover:border-border focus:border-primary/60 p-2 -m-2 transition-colors"
        />
        {spark.valueHypothesis !== undefined && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-3.5 py-2.5">
            <CircleDollarSign className="w-4 h-4 mt-1 shrink-0 text-emerald-500" />
            <div className="flex-1 min-w-0">
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                Where the money is{spark.businessLine ? ` · ${LINE[spark.businessLine]}` : ''}
              </p>
              <textarea
                title={readOnly ? undefined : 'Click to edit'}
          readOnly={readOnly}
                value={spark.valueHypothesis}
                onChange={e => set({ valueHypothesis: e.target.value })}
                rows={2}
                placeholder="Which money line moves, and why"
                className="w-full resize-none bg-transparent text-ui-base text-foreground leading-relaxed outline-none rounded-md border border-transparent hover:border-border focus:border-primary/60 px-1 -mx-1 mt-0.5 transition-colors"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui-xs text-muted-foreground">Industry</span>
          <input
            value={spark.industry}
            readOnly={readOnly}
            onChange={e => set({ industry: e.target.value, industryAlternatives: [] })}
            className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-ui-sm font-medium outline-none border border-transparent focus:border-primary/50 w-auto"
            size={Math.max(8, spark.industry.length)}
          />
          {spark.catalogIndustryLabel && spark.catalogIndustryLabel.toLowerCase() !== spark.industry.toLowerCase() && (
            <span className="text-ui-xs text-muted-foreground" title="Where this lands in the use case catalog">in {spark.catalogIndustryLabel}</span>
          )}
        </div>
        {!readOnly && !!spark.industryAlternatives?.length && (
          <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
            <span className="text-ui-xs text-muted-foreground">Did you mean</span>
            {spark.industryAlternatives.map(alt => (
              <button
                key={alt}
                onClick={() => set({ industry: alt, industryAlternatives: spark.industryAlternatives!.filter(a => a !== alt).concat(spark.industry) })}
                className="px-2 py-0.5 rounded-full border border-border text-ui-xs text-muted-foreground hover:text-foreground hover:border-primary/40"
              >
                {alt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
