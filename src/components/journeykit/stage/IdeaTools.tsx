import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { AssumptionsDrawer } from '../ui/AssumptionsDrawer';
import { ClarityRing } from '../ui/ClarityRing';
import { PointsChip } from '../ui/PointsChip';
import { caseFigures, overallClarity } from '../engine/ideaContext';
import { money, units } from '../engine/businessCase';

/** Quiet tools for the top row: an assumptions chip only when something needs a look, and the clarity ring. */
export function IdeaTools({ flow }: { flow: IdeaFlow }) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);
  const idea = flow.idea;

  useEffect(() => {
    if (!healthOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!healthRef.current?.contains(e.target as Node)) setHealthOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHealthOpen(false);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [healthOpen]);

  if (!idea) return null;
  const count = idea.assumptions.filter(a => a.status === 'open').length;
  const f = caseFigures(idea);
  const clarity = overallClarity(idea);

  return (
    <>
      {f && f.value.expected > 0 && (
        <span
          title={`${money(f.hard)} hard and ${money(f.soft)} soft dollars a year${f.rollout ? ` across ${units(f.rollout.units, f.rollout.unit)}` : ''}`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-ui-xs font-semibold tabular-nums animate-scale-in"
        >
          {money(f.value.expected)}/yr
        </span>
      )}
      <div ref={healthRef} className="relative">
        <button
          onClick={() => setHealthOpen(open => !open)}
          aria-expanded={healthOpen}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <Activity className="h-3.5 w-3.5 text-primary" />
          Idea health
          <span className="font-semibold text-foreground">{clarity}</span>
          {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          <ChevronDown className={`h-3 w-3 transition-transform ${healthOpen ? 'rotate-180' : ''}`} />
        </button>
        {healthOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Idea health</p>
                <p className="text-ui-sm text-foreground mt-1">Clarity and readiness</p>
              </div>
              <ClarityRing idea={idea} size={42} />
            </div>
            {!idea.sample && <div className="mt-3"><PointsChip idea={idea} /></div>}
            <button
              onClick={() => { setHealthOpen(false); setAssumptionsOpen(true); }}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-ui-sm text-foreground hover:bg-secondary"
            >
              <span>Open assumptions</span>
              <span className={count ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>{count} open</span>
            </button>
          </div>
        )}
      </div>
      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} assumptions={idea.assumptions} onSet={flow.setAssumption} />
    </>
  );
}
