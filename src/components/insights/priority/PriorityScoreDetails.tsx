import { ArrowRight, ChevronDown, Database, Lightbulb, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PriorityAssessment, PriorityFactor } from '../priorityAssessment';

interface Props {
  assessment: PriorityAssessment;
  compact?: boolean;
  onImproveValue?: () => void;
  onImproveFeasibility?: () => void;
}

export function PriorityScoreDetails({
  assessment,
  compact = false,
  onImproveValue,
  onImproveFeasibility,
}: Props) {
  return (
    <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
      <DimensionCard
        icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
        title="Business value"
        definition="The measurable business impact, scale, urgency, and strength of the value evidence."
        score={assessment.value}
        band={assessment.valueBand}
        evidenceWeight={assessment.valueEvidenceWeight}
        factors={assessment.valueFactors}
        evidence={assessment.valueEvidence}
        actions={assessment.valueActions}
        barClass="bg-emerald-500"
        compact={compact}
        onImprove={onImproveValue}
      />
      <DimensionCard
        icon={<Database className="w-4 h-4 text-sky-500" />}
        title="Technical feasibility"
        definition="How ready the data, workflow, scope, and delivery approach are for a credible first release."
        score={assessment.feasibility}
        band={`${assessment.feasibilityBand} · ${assessment.confidence} confidence`}
        evidenceWeight={assessment.feasibilityEvidenceWeight}
        factors={assessment.feasibilityFactors}
        evidence={assessment.feasibilityEvidence}
        actions={assessment.feasibilityActions}
        barClass="bg-sky-500"
        compact={compact}
        onImprove={onImproveFeasibility}
      />
    </div>
  );
}

function DimensionCard({
  icon,
  title,
  definition,
  score,
  band,
  evidenceWeight,
  factors,
  evidence,
  actions,
  barClass,
  compact,
  onImprove,
}: {
  icon: ReactNode;
  title: string;
  definition: string;
  score: number;
  band: string;
  evidenceWeight: number;
  factors: PriorityFactor[];
  evidence: string[];
  actions: string[];
  barClass: string;
  compact: boolean;
  onImprove?: () => void;
}) {
  const strongest = [...factors]
    .filter((factor): factor is PriorityFactor & { score: number } => factor.score !== null)
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))[0];
  const next = actions[0] ?? factors.find(factor => factor.score === null)?.action;

  return (
    <section className="rounded-2xl border border-border bg-background/45 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-ui-sm font-semibold text-foreground">{title}</p>
          {!compact && <p className="mt-0.5 text-ui-2xs leading-relaxed text-muted-foreground">{definition}</p>}
        </div>
        <span className="text-ui-xl font-semibold tabular-nums text-foreground">{score}</span>
        <span className="text-ui-2xs text-muted-foreground">/100</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-ui-2xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">{band}</span>
        <span>{evidenceWeight}% evidence coverage</span>
      </div>

      {(strongest?.evidence || evidence[0]) && (
        <p className="mt-3 text-ui-xs leading-relaxed text-foreground/85">
          <span className="font-semibold text-foreground">Strongest signal:</span>{' '}
          {strongest?.evidence ?? evidence[0]}
        </p>
      )}

      {next && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/[0.055] px-3 py-2.5 ring-1 ring-primary/15">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="flex-1 text-ui-xs leading-relaxed text-foreground/90">
            <span className="font-semibold">Best next move:</span> {next}
          </p>
          {onImprove && (
            <button
              type="button"
              onClick={onImprove}
              className="shrink-0 inline-flex items-center gap-1 text-ui-xs font-semibold text-primary hover:underline"
            >
              Improve <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <details className="group mt-3 border-t border-border/60 pt-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-ui-xs font-semibold text-muted-foreground hover:text-foreground">
          How this is calculated
          <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2.5">
          {factors.map(factor => (
            <div key={factor.label}>
              <div className="flex items-center gap-2 text-ui-xs">
                <span className="min-w-0 flex-1 font-medium text-foreground">{factor.label}</span>
                <span className="text-muted-foreground">{factor.weight}% weight</span>
                <span className={`w-12 text-right font-semibold tabular-nums ${factor.score === null ? 'text-amber-500' : 'text-foreground'}`}>
                  {factor.score === null ? 'Missing' : `${factor.score}`}
                </span>
              </div>
              {(factor.evidence || factor.action) && (
                <p className="mt-0.5 pr-14 text-ui-2xs leading-relaxed text-muted-foreground">
                  {factor.evidence ?? factor.action}
                </p>
              )}
            </div>
          ))}
          <p className="border-t border-border/60 pt-2 text-ui-2xs leading-relaxed text-muted-foreground">
            Known factors are reweighted to 100. Missing evidence widens the confidence range instead of silently counting as zero.
          </p>
        </div>
      </details>
    </section>
  );
}
