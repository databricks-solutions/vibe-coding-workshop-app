import { ArrowRight, Database, TrendingUp } from 'lucide-react';
import type { PriorityAssessment } from '../priorityAssessment';

interface PriorityMatrixProps {
  current: PriorityAssessment;
  portfolio: PriorityAssessment[];
  onImproveValue?: () => void;
  onImproveFeasibility?: () => void;
  onSelectIdea?: (ideaId: string) => void;
  portfolioLimit?: number | null;
  subtitle?: string;
}

const x = (n: number) => 11 + n * 0.82;
const y = (n: number) => 91 - n * 0.78;

export function PriorityMatrix({ current, portfolio, onImproveValue, onImproveFeasibility, onSelectIdea, portfolioLimit = 10, subtitle }: PriorityMatrixProps) {
  const allOthers = portfolio.filter(p => p.ideaId !== current.ideaId);
  const others = portfolioLimit == null ? allOthers : allOthers.slice(0, portfolioLimit);
  const [fx0, fx1] = current.feasibilityRange;
  const [vy0, vy1] = current.valueRange;
  return (
    <section className="rounded-3xl border border-border bg-card overflow-hidden" aria-labelledby="priority-heading">
      <div className="px-5 sm:px-6 py-5 border-b border-border/70">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p id="priority-heading" className="text-ui-xl font-semibold text-foreground">Value vs. feasibility</p>
            <p className="text-ui-sm text-muted-foreground mt-1">{subtitle ?? 'Evidence from your idea, value inputs, selected data, and build plan.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-ui-xs font-semibold text-primary">{current.quadrant}</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-ui-xs text-muted-foreground">{current.confidence} confidence</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-4">
          <svg viewBox="0 0 100 100" className="w-full aspect-[16/9] min-h-[18rem]" role="img" aria-label={`Priority matrix. ${current.title}: value ${current.value}, feasibility ${current.feasibility}, ${current.quadrant}.`}>
            <rect x="11" y="13" width="49.2" height="31.2" rx="2" className="fill-amber-500/[0.045]" />
            <rect x="60.2" y="13" width="32.8" height="31.2" rx="2" className="fill-emerald-500/[0.055]" />
            <rect x="11" y="44.2" width="49.2" height="46.8" rx="2" className="fill-muted/15" />
            <rect x="60.2" y="44.2" width="32.8" height="46.8" rx="2" className="fill-sky-500/[0.045]" />

            <text x="13" y="17" className="fill-muted-foreground/60 text-[2.6px] font-semibold uppercase tracking-wider">Strategic bet</text>
            <text x="91" y="17" textAnchor="end" className="fill-muted-foreground/60 text-[2.6px] font-semibold uppercase tracking-wider">Invest now</text>
            <text x="13" y="88" className="fill-muted-foreground/60 text-[2.6px] font-semibold uppercase tracking-wider">Rework or park</text>
            <text x="91" y="88" textAnchor="end" className="fill-muted-foreground/60 text-[2.6px] font-semibold uppercase tracking-wider">Quick win</text>

            <line x1="11" y1="91" x2="94" y2="91" className="stroke-border" strokeWidth=".45" />
            <line x1="11" y1="91" x2="11" y2="11" className="stroke-border" strokeWidth=".45" />
            <line x1="60.2" y1="13" x2="60.2" y2="91" className="stroke-border/70" strokeWidth=".3" strokeDasharray="1 1.5" />
            <line x1="11" y1="44.2" x2="93" y2="44.2" className="stroke-border/70" strokeWidth=".3" strokeDasharray="1 1.5" />

            <text x="52" y="98" textAnchor="middle" className="fill-muted-foreground text-[3px] font-medium">Feasibility →</text>
            <text x="3.5" y="53" textAnchor="middle" transform="rotate(-90 3.5 53)" className="fill-muted-foreground text-[3px] font-medium">Value →</text>

            {others.map(p => (
              <g key={p.ideaId} onClick={() => onSelectIdea?.(p.ideaId)} className={onSelectIdea ? 'cursor-pointer' : undefined}>
                <circle cx={x(p.feasibility)} cy={y(p.value)} r={onSelectIdea ? '2.3' : '1.5'} className={p.provisional ? 'fill-muted-foreground/35 stroke-card' : 'fill-primary/35 stroke-card'} strokeWidth=".45" />
                <title>{`${p.title}: value ${p.value}, feasibility ${p.feasibility}${p.provisional ? ', provisional' : ''}`}</title>
              </g>
            ))}

            {current.provisional && (
              <rect
                x={x(fx0)}
                y={y(vy1)}
                width={Math.max(3, x(fx1) - x(fx0))}
                height={Math.max(3, y(vy0) - y(vy1))}
                rx="2"
                className="fill-primary/[0.07] stroke-primary/25"
                strokeWidth=".4"
                strokeDasharray="1 1"
              />
            )}
            <g onClick={() => onSelectIdea?.(current.ideaId)} className={onSelectIdea ? 'cursor-pointer' : undefined}>
              <circle cx={x(current.feasibility)} cy={y(current.value)} r="3.6" className="fill-primary/20 stroke-primary" strokeWidth=".75" />
              <circle cx={x(current.feasibility)} cy={y(current.value)} r="1.35" className="fill-primary" />
              <title>{`${current.title}: selected`}</title>
            </g>
            <g transform={`translate(${Math.min(73, x(current.feasibility) + 4)} ${Math.max(20, y(current.value) - 2)})`}>
              <rect x="0" y="-4" width="18" height="7" rx="2" className="fill-card stroke-border" strokeWidth=".4" />
              <text x="2" y="0" className="fill-foreground text-[2.6px] font-semibold">{current.value}V · {current.feasibility}F</text>
            </g>
          </svg>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-ui-md font-semibold text-foreground">Value · {current.value}/100</p>
              <span className="ml-auto text-ui-xs text-muted-foreground">{current.valueBand}</span>
            </div>
            {current.valueEvidence[0] && <p className="text-ui-xs text-muted-foreground mt-2">{current.valueEvidence[0]}</p>}
            {current.valueActions[0] && (
              <button onClick={onImproveValue} disabled={!onImproveValue} className="mt-3 inline-flex items-center gap-1 text-ui-xs font-medium text-primary hover:underline disabled:pointer-events-none">
                {current.valueActions[0]} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-500" />
              <p className="text-ui-md font-semibold text-foreground">Feasibility · {current.feasibility}/100</p>
              <span className="ml-auto text-ui-xs text-muted-foreground">{current.feasibilityBand}</span>
            </div>
            {current.feasibilityEvidence[0] && <p className="text-ui-xs text-muted-foreground mt-2">{current.feasibilityEvidence[0]}</p>}
            {current.feasibilityActions[0] && (
              <button onClick={onImproveFeasibility} disabled={!onImproveFeasibility} className="mt-3 inline-flex items-center gap-1 text-ui-xs font-medium text-primary hover:underline disabled:pointer-events-none">
                {current.feasibilityActions[0]} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <ul className="sr-only">
          <li>{`${current.title}: value ${current.value}, feasibility ${current.feasibility}, ${current.quadrant}, ${current.confidence} confidence.`}</li>
          {others.map(p => <li key={p.ideaId}>{`${p.title}: value ${p.value}, feasibility ${p.feasibility}${p.provisional ? ', provisional' : ''}.`}</li>)}
        </ul>
      </div>
    </section>
  );
}
