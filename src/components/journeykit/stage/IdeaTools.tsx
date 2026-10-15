import { useState } from 'react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { AssumptionsDrawer } from '../ui/AssumptionsDrawer';
import { ClarityRing } from '../ui/ClarityRing';
import { PointsChip } from '../ui/PointsChip';
import { caseFigures } from '../engine/ideaContext';
import { money, units } from '../engine/businessCase';

/** Quiet tools for the top row: an assumptions chip only when something needs a look, and the clarity ring. */
export function IdeaTools({ flow }: { flow: IdeaFlow }) {
  const [open, setOpen] = useState(false);
  const idea = flow.idea;
  if (!idea) return null;
  const count = idea.assumptions.filter(a => a.status === 'open').length;
  const f = caseFigures(idea);
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
      {count > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-ui-xs font-semibold hover:bg-amber-500/20 animate-scale-in"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {count} assumption{count === 1 ? '' : 's'}
        </button>
      )}
      {!idea.sample && <PointsChip idea={idea} />}
      <ClarityRing idea={idea} size={34} />
      <AssumptionsDrawer open={open} onClose={() => setOpen(false)} assumptions={idea.assumptions} onSet={flow.setAssumption} />
    </>
  );
}
