import { useState } from 'react';
import { CircleDollarSign, Crosshair, Loader2, Plus, Quote, Server, ShieldAlert, Sparkles, Tags, X } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';

const LINE = { cost: 'Lower cost', revenue: 'More revenue', risk: 'Less risk', capacity: 'More capacity' } as const;

const SUGGESTED_CONSTRAINTS = [
  'No new PII in app session',
  'Existing SSO auth only',
  'Human approval before action',
  'Certified Unity Catalog data only',
];

export function SparkStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const spark = idea.spark;
  const [newSystem, setNewSystem] = useState('');
  const [newConstraint, setNewConstraint] = useState('');
  if (!spark) return null;

  const { readOnly } = flow;
  // Renaming keeps the approvals; changing what the idea is reopens the steps built on it.
  const set = (patch: Partial<typeof spark>) => {
    const apply = (i: typeof idea) => ({ spark: { ...i.spark!, ...patch }, ...(patch.title !== undefined ? { title: patch.title } : {}) });
    if (Object.keys(patch).every(k => k === 'title')) flow.patch(apply);
    else flow.revise('spark', apply, 'Changed how the idea is described');
  };

  const systems = spark.affectedSystems ?? [];
  const constraints = spark.constraints ?? [];
  const addSystem = (val: string) => {
    const clean = val.trim();
    if (!clean || systems.some(s => s.toLowerCase() === clean.toLowerCase())) return;
    set({ affectedSystems: [...systems, clean] });
    setNewSystem('');
  };
  const addConstraint = (val: string) => {
    const clean = val.trim();
    if (!clean || constraints.some(c => c.toLowerCase() === clean.toLowerCase())) return;
    set({ constraints: [...constraints, clean] });
    setNewConstraint('');
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary">Here's how I understood it</p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void flow.improveIntent()}
              disabled={!!flow.loading}
              title="Tighten the problem statement and surface missing constraints without wiping later steps"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1 text-ui-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {flow.loading === 'spark' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Improve intent &amp; constraints
            </button>
          )}
        </div>
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
        {flow.ideaStudioVersion === 'v2' && spark.primaryEntity && (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-primary">
              <Crosshair className="w-3.5 h-3.5" /> Decision grain
            </p>
            <input
              title={readOnly ? undefined : 'Click to edit'}
              readOnly={readOnly}
              value={spark.primaryEntity}
              onChange={e => set({ primaryEntity: e.target.value })}
              className="w-full bg-transparent text-ui-base font-medium text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary/60 mt-1 pb-0.5 transition-colors"
            />
            <p className="text-ui-xs text-muted-foreground mt-1">The operational unit and time window each decision acts on.</p>
          </div>
        )}
        {flow.ideaStudioVersion === 'v2' && !!spark.aliases?.length && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-ui-xs text-muted-foreground"><Tags className="w-3.5 h-3.5" /> Also known as</span>
            {spark.aliases.map(alias => (
              <span key={alias} className="px-2.5 py-1 rounded-full border border-border bg-secondary/40 text-ui-xs text-foreground/80">{alias}</span>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">
              <Server className="w-3.5 h-3.5 text-primary" /> Affected systems &amp; data
            </p>
            <div className="flex flex-wrap gap-1.5">
              {systems.map(sys => (
                <span key={sys} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 pl-2.5 pr-1.5 py-0.5 text-ui-xs text-foreground">
                  {sys}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => set({ affectedSystems: systems.filter(s => s !== sys) })}
                      aria-label={`Remove system ${sys}`}
                      className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {systems.length === 0 && (
                <span className="text-ui-xs text-muted-foreground">None named yet — add systems or tables this touches.</span>
              )}
            </div>
            {!readOnly && (
              <div className="flex gap-1.5">
                <input
                  value={newSystem}
                  onChange={e => setNewSystem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSystem(newSystem); } }}
                  placeholder="Add system, e.g. Claims API"
                  aria-label="Add affected system"
                  className="flex-1 min-w-0 h-8 rounded-lg border border-border bg-background/60 px-2.5 text-ui-xs outline-none focus:border-primary/50"
                />
                {newSystem.trim() && (
                  <button type="button" onClick={() => addSystem(newSystem)} className="h-8 px-2.5 rounded-lg bg-secondary text-ui-xs font-medium text-foreground hover:bg-secondary/80">
                    Add
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5" /> Constraints &amp; guardrails
            </p>
            <div className="flex flex-wrap gap-1.5">
              {constraints.map(c => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-card pl-2.5 pr-1.5 py-0.5 text-ui-xs text-foreground">
                  {c}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => set({ constraints: constraints.filter(x => x !== c) })}
                      aria-label={`Remove constraint ${c}`}
                      className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {constraints.length === 0 && (
                <span className="text-ui-xs text-muted-foreground">No guardrails yet — add PII, auth, or approval rules.</span>
              )}
            </div>
            {!readOnly && (
              <>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_CONSTRAINTS.filter(s => !constraints.some(c => c.toLowerCase() === s.toLowerCase())).slice(0, 2).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addConstraint(s)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/40 px-2 py-0.5 text-ui-2xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                      <Plus className="w-2.5 h-2.5" /> {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={newConstraint}
                    onChange={e => setNewConstraint(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addConstraint(newConstraint); } }}
                    placeholder="Add constraint, e.g. No PII in session"
                    aria-label="Add constraint"
                    className="flex-1 min-w-0 h-8 rounded-lg border border-border bg-background/60 px-2.5 text-ui-xs outline-none focus:border-primary/50"
                  />
                  {newConstraint.trim() && (
                    <button type="button" onClick={() => addConstraint(newConstraint)} className="h-8 px-2.5 rounded-lg bg-secondary text-ui-xs font-medium text-foreground hover:bg-secondary/80">
                      Add
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
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
