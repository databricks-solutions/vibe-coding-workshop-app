import { ArrowRight, Database, TrendingUp } from 'lucide-react';
import type { PriorityAssessment } from '../priorityAssessment';
import type { IdeaReviewStatus } from '../../journeykit';

interface PriorityMatrixProps {
  current: PriorityAssessment;
  portfolio: PriorityAssessment[];
  onImproveValue?: () => void;
  onImproveFeasibility?: () => void;
  onSelectIdea?: (ideaId: string) => void;
  portfolioLimit?: number | null;
  subtitle?: string;
  /** Optional set of ideaIds that match the current queue filter; non-matching points render slightly dimmed on the map. */
  highlightedIds?: Set<string> | null;
  /** When true, hides the bottom 2-column Value/Feasibility cards (useful when the inspector already shows full breakdown). */
  hideSummaryCards?: boolean;
}

const x = (n: number) => 11 + n * 0.82;
const y = (n: number) => 91 - n * 0.78;

const STATUS_META: Record<IdeaReviewStatus, { label: string; dotFill: string; haloFill: string; stroke: string; pillCls: string }> = {
  pending: {
    label: 'Pending review',
    dotFill: 'fill-amber-500',
    haloFill: 'fill-amber-500/20',
    stroke: 'stroke-amber-500',
    pillCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  approved: {
    label: 'Approved',
    dotFill: 'fill-emerald-500',
    haloFill: 'fill-emerald-500/20',
    stroke: 'stroke-emerald-500',
    pillCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  changes_requested: {
    label: 'Changes requested',
    dotFill: 'fill-sky-500',
    haloFill: 'fill-sky-500/20',
    stroke: 'stroke-sky-500',
    pillCls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  rejected: {
    label: 'Rejected',
    dotFill: 'fill-rose-500',
    haloFill: 'fill-rose-500/20',
    stroke: 'stroke-rose-500',
    pillCls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  draft: {
    label: 'Draft',
    dotFill: 'fill-primary',
    haloFill: 'fill-primary/20',
    stroke: 'stroke-primary',
    pillCls: 'bg-primary/15 text-primary border-primary/30',
  },
};

function shortTitle(title: string, maxLen = 22): string {
  const clean = (title || 'Untitled').trim();
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Deterministic collision-avoidance for plotted points and their top labels.
 * Nudges overlapping coordinates slightly and alternates label vertical offsets
 * so every use case name on the map remains legible and clickable.
 */
function layoutPoints(points: PriorityAssessment[], selectedId: string) {
  const placed: {
    item: PriorityAssessment;
    cx: number;
    cy: number;
    labelX: number;
    labelY: number;
    pillWidth: number;
    labelText: string;
    isSelected: boolean;
  }[] = [];

  // Sort so selected is processed last (drawn on top)
  const ordered = [...points].sort((a, b) => {
    if (a.ideaId === selectedId) return 1;
    if (b.ideaId === selectedId) return -1;
    return a.title.localeCompare(b.title);
  });

  for (let idx = 0; idx < ordered.length; idx++) {
    const item = ordered[idx];
    const isSelected = item.ideaId === selectedId;
    let cx = x(item.feasibility);
    let cy = y(item.value);

    // Check if another point is at nearly the exact same spot
    let collisionCount = 0;
    for (const prev of placed) {
      const dist = Math.hypot(prev.cx - cx, prev.cy - cy);
      if (dist < 4.2) {
        collisionCount++;
      }
    }
    if (collisionCount > 0) {
      const angle = (collisionCount * 2.1) % (Math.PI * 2);
      const radius = 2.8 + Math.floor((collisionCount - 1) / 3) * 2.0;
      cx = Math.max(15, Math.min(90, cx + Math.cos(angle) * radius));
      cy = Math.max(18, Math.min(86, cy + Math.sin(angle) * radius));
    }

    const labelText = shortTitle(item.title, isSelected ? 26 : 20);
    const pillWidth = Math.max(16, Math.min(42, labelText.length * 1.48 + 4.5));
    const halfW = pillWidth / 2;
    const clampedX = Math.max(12 + halfW, Math.min(93 - halfW, cx));

    // Place label above the node by default; flip below if near the top edge or colliding with an upper label
    let labelY = cy - (isSelected ? 6.2 : 5.0);
    if (labelY < 16.5) {
      labelY = cy + (isSelected ? 7.2 : 6.0);
    }
    for (const prev of placed) {
      if (Math.abs(prev.labelX - clampedX) < (prev.pillWidth + pillWidth) * 0.45 && Math.abs(prev.labelY - labelY) < 4.5) {
        labelY = cy + (isSelected ? 7.2 : 6.0);
        break;
      }
    }

    placed.push({
      item,
      cx,
      cy,
      labelX: clampedX,
      labelY,
      pillWidth,
      labelText,
      isSelected,
    });
  }

  return placed;
}

export function PriorityMatrix({
  current,
  portfolio,
  onImproveValue,
  onImproveFeasibility,
  onSelectIdea,
  portfolioLimit = 10,
  subtitle,
  highlightedIds = null,
  hideSummaryCards = false,
}: PriorityMatrixProps) {
  const allOthers = portfolio.filter(p => p.ideaId !== current.ideaId);
  const others = portfolioLimit == null ? allOthers : allOthers.slice(0, portfolioLimit);
  const allPoints = [current, ...others];
  const laidOut = layoutPoints(allPoints, current.ideaId);
  const [fx0, fx1] = current.feasibilityRange;
  const [vy0, vy1] = current.valueRange;

  const hasStatuses = allPoints.some(p => p.status && p.status !== 'draft');
  const currentStatusMeta = current.status ? STATUS_META[current.status] : null;

  return (
    <section className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm" aria-labelledby="priority-heading">
      <div className="px-5 sm:px-6 py-5 border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <p id="priority-heading" className="text-ui-xl font-semibold text-foreground">Value vs. feasibility</p>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-ui-2xs font-semibold text-muted-foreground tabular-nums">
                {allPoints.length} {allPoints.length === 1 ? 'use case' : 'use cases'} on map
              </span>
            </div>
            <p className="text-ui-sm text-muted-foreground mt-1">
              {subtitle ?? 'Evidence from your idea, value inputs, selected data, and build plan.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentStatusMeta && current.status !== 'draft' && (
              <span className={`rounded-full border px-2.5 py-1 text-ui-xs font-semibold ${currentStatusMeta.pillCls}`}>
                {currentStatusMeta.label}
              </span>
            )}
            <span className="rounded-full bg-primary/15 border border-primary/25 px-2.5 py-1 text-ui-xs font-semibold text-primary">
              {current.quadrant}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-ui-xs text-muted-foreground">
              {current.confidence} confidence
            </span>
          </div>
        </div>

        {/* Status legend when reviewing multi-status portfolio */}
        {hasStatuses && (
          <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center gap-x-5 gap-y-2 text-ui-xs">
            <span className="text-muted-foreground font-medium">Status on map:</span>
            {(['pending', 'approved', 'changes_requested', 'rejected'] as const).map(st => {
              const count = allPoints.filter(p => p.status === st).length;
              if (count === 0 && st !== 'pending' && st !== 'approved') return null;
              const meta = STATUS_META[st];
              return (
                <span key={st} className="inline-flex items-center gap-1.5 text-foreground/90 font-medium">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      st === 'pending'
                        ? 'bg-amber-500 ring-2 ring-amber-500/30'
                        : st === 'approved'
                          ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                          : st === 'changes_requested'
                            ? 'bg-sky-500 ring-2 ring-sky-500/30'
                            : 'bg-rose-500 ring-2 ring-rose-500/30'
                    }`}
                  />
                  <span>{meta.label}</span>
                  <span className="text-muted-foreground tabular-nums">({count})</span>
                </span>
              );
            })}
            <span className="ml-auto text-ui-2xs text-muted-foreground hidden sm:inline">
              Click any named point on the map to inspect details
            </span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-4">
          <svg
            viewBox="0 0 100 100"
            className="w-full aspect-[16/9] min-h-[20rem] select-none"
            role="img"
            aria-label={`Priority matrix. ${current.title}: value ${current.value}, feasibility ${current.feasibility}, ${current.quadrant}.`}
          >
            {/* Quadrant backgrounds */}
            <rect x="11" y="13" width="49.2" height="31.2" rx="2" className="fill-amber-500/[0.06] dark:fill-amber-500/[0.05]" />
            <rect x="60.2" y="13" width="32.8" height="31.2" rx="2" className="fill-emerald-500/[0.08] dark:fill-emerald-500/[0.065]" />
            <rect x="11" y="44.2" width="49.2" height="46.8" rx="2" className="fill-muted/35 dark:fill-muted/15" />
            <rect x="60.2" y="44.2" width="32.8" height="46.8" rx="2" className="fill-sky-500/[0.06] dark:fill-sky-500/[0.05]" />

            {/* Quadrant headers */}
            <text x="13" y="17.2" className="fill-amber-700/80 dark:fill-amber-300/70 text-[2.5px] font-bold uppercase tracking-wider">Strategic bet</text>
            <text x="91" y="17.2" textAnchor="end" className="fill-emerald-700/85 dark:fill-emerald-300/80 text-[2.5px] font-bold uppercase tracking-wider">Invest now</text>
            <text x="13" y="88.5" className="fill-muted-foreground/75 text-[2.5px] font-bold uppercase tracking-wider">Rework or park</text>
            <text x="91" y="88.5" textAnchor="end" className="fill-sky-700/80 dark:fill-sky-300/75 text-[2.5px] font-bold uppercase tracking-wider">Quick win</text>

            {/* Axes and quadrant dividers */}
            <line x1="11" y1="91" x2="94" y2="91" className="stroke-border" strokeWidth=".45" />
            <line x1="11" y1="91" x2="11" y2="11" className="stroke-border" strokeWidth=".45" />
            <line x1="60.2" y1="13" x2="60.2" y2="91" className="stroke-border/80" strokeWidth=".35" strokeDasharray="1 1.5" />
            <line x1="11" y1="44.2" x2="93" y2="44.2" className="stroke-border/80" strokeWidth=".35" strokeDasharray="1 1.5" />

            <text x="52" y="98" textAnchor="middle" className="fill-muted-foreground text-[2.9px] font-semibold">Feasibility →</text>
            <text x="3.5" y="53" textAnchor="middle" transform="rotate(-90 3.5 53)" className="fill-muted-foreground text-[2.9px] font-semibold">Value →</text>

            {/* Provisional uncertainty box for currently selected idea */}
            {current.provisional && (
              <rect
                x={x(fx0)}
                y={y(vy1)}
                width={Math.max(3, x(fx1) - x(fx0))}
                height={Math.max(3, y(vy0) - y(vy1))}
                rx="2"
                className="fill-primary/[0.07] stroke-primary/30"
                strokeWidth=".4"
                strokeDasharray="1 1"
              />
            )}

            {/* Plotted portfolio nodes with Use Case names on top */}
            {laidOut.map(({ item, cx, cy, labelX, labelY, pillWidth, labelText, isSelected }) => {
              const st = item.status ?? 'draft';
              const meta = STATUS_META[st] ?? STATUS_META.draft;
              const isDimmed = highlightedIds && !highlightedIds.has(item.ideaId) && !isSelected;

              return (
                <g
                  key={item.ideaId}
                  onClick={() => onSelectIdea?.(item.ideaId)}
                  className={`${onSelectIdea ? 'cursor-pointer' : ''} transition-opacity ${isDimmed ? 'opacity-45 hover:opacity-100' : 'opacity-100'}`}
                >
                  <title>{`${item.title} — Value ${item.value}/100, Feasibility ${item.feasibility}/100 (${meta.label})`}</title>

                  {/* Connector tick between node and its name pill */}
                  <line
                    x1={cx}
                    y1={cy}
                    x2={labelX}
                    y2={labelY}
                    className={isSelected ? 'stroke-primary/60' : 'stroke-border'}
                    strokeWidth={isSelected ? '.4' : '.25'}
                  />

                  {/* Outer pulse / halo */}
                  {isSelected ? (
                    <>
                      <circle cx={cx} cy={cy} r="4.6" className={`${meta.haloFill} ${meta.stroke}`} strokeWidth=".55" strokeDasharray="1.2 0.8" />
                      <circle cx={cx} cy={cy} r="3.1" className={`${meta.haloFill} ${meta.stroke}`} strokeWidth=".8" />
                      <circle cx={cx} cy={cy} r="1.45" className={meta.dotFill} />
                    </>
                  ) : (
                    <>
                      <circle cx={cx} cy={cy} r="2.7" className={`${meta.haloFill} ${meta.stroke}`} strokeWidth=".5" />
                      <circle cx={cx} cy={cy} r="1.25" className={meta.dotFill} />
                    </>
                  )}

                  {/* Name pill on top of each node */}
                  <g transform={`translate(${labelX} ${labelY})`}>
                    <rect
                      x={-pillWidth / 2}
                      y="-2.8"
                      width={pillWidth}
                      height="5.2"
                      rx="1.6"
                      className={isSelected ? 'fill-foreground stroke-primary' : 'fill-card/95 stroke-border'}
                      strokeWidth={isSelected ? '.45' : '.3'}
                    />
                    <text
                      x="0"
                      y="0.5"
                      textAnchor="middle"
                      className={
                        isSelected
                          ? 'fill-background text-[2.25px] font-bold'
                          : 'fill-foreground text-[2.1px] font-semibold'
                      }
                    >
                      {labelText}
                    </text>
                  </g>

                  {/* Score badge beside the selected node */}
                  {isSelected && (
                    <g transform={`translate(${Math.min(77, cx + 4.5)} ${Math.min(88, cy + 2.5)})`}>
                      <rect x="0" y="-3.2" width="16.5" height="5.2" rx="1.5" className="fill-card stroke-primary/50" strokeWidth=".35" />
                      <text x="8.25" y="0.2" textAnchor="middle" className="fill-primary text-[2.15px] font-bold">
                        {item.value}V · {item.feasibility}F
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {!hideSummaryCards && (
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
        )}

        <ul className="sr-only">
          <li>{`${current.title}: value ${current.value}, feasibility ${current.feasibility}, ${current.quadrant}, ${current.confidence} confidence.`}</li>
          {others.map(p => <li key={p.ideaId}>{`${p.title}: value ${p.value}, feasibility ${p.feasibility}${p.provisional ? ', provisional' : ''}.`}</li>)}
        </ul>
      </div>
    </section>
  );
}
