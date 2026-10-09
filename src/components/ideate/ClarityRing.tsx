import { Check } from 'lucide-react';
import { clarityByDimension, overallClarity } from './ideaContext';
import { DIMENSIONS, type Idea } from './types';

/** One score in the UI: how fully the idea covers AI-DLC's six completeness dimensions. */
export function ClarityRing({ idea, size = 44 }: { idea: Idea; size?: number }) {
  const pct = overallClarity(idea);
  const dims = clarityByDimension(idea);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? 'stroke-emerald-400' : pct >= 45 ? 'stroke-primary' : 'stroke-amber-400';

  return (
    <div className="relative group">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} className="stroke-border fill-none" strokeWidth={4} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={`fill-none ${color} transition-[stroke-dashoffset] duration-700 ease-out`}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-ui-xs font-semibold text-foreground tabular-nums">
          {pct}
        </span>
      </div>
      <div className="absolute right-0 top-full mt-2 w-60 z-30 rounded-xl border border-border bg-card shadow-xl p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
        <p className="text-ui-xs font-semibold text-foreground mb-2">Idea clarity</p>
        <ul className="space-y-1.5">
          {DIMENSIONS.map(d => {
            const v = dims[d.key];
            return (
              <li key={d.key} className="flex items-center gap-2 text-ui-xs">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${v >= 0.99 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary text-muted-foreground'}`}>
                  {v >= 0.99 && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="flex-1 text-muted-foreground">{d.label}</span>
                <span className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                  <span className="block h-full bg-primary transition-all duration-500" style={{ width: `${Math.round(v * 100)}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-ui-2xs text-muted-foreground/70 mt-2">Fills as you move through the steps. Use "Find gaps" on the brief to close the rest.</p>
      </div>
    </div>
  );
}
