import { useState } from 'react';
import { ChevronDown, CircleDollarSign, MapPin, Sparkles, Waypoints } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { placedLeaf } from '../engine/ideaContext';
import { PersonaChip } from '../ui/PersonaChip';

/** Leaves shown per branch before "more"; the placed and adjacent leaves always show. */
const VISIBLE_LEAVES = 2;

export function MapStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const map = idea.map;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [why, setWhy] = useState(false);
  if (!map) return null;
  const placed = placedLeaf(idea);
  const adjacent = map.branches.flatMap(b => b.leaves).filter(l => map.adjacentLeafIds.includes(l.id));

  const place = (leafId: string) => {
    if (leafId === map.placedLeafId) return;
    flow.patch(i => ({ map: { ...i.map!, placedLeafId: leafId, adjacentLeafIds: i.map!.adjacentLeafIds.filter(a => a !== leafId) } }));
  };

  let order = 0;
  return (
    <div className="space-y-6">
      <p className="text-ui-md text-muted-foreground animate-fade-in">
        Your idea is pinned where I think it lives in {idea.spark?.industry || 'your industry'}. Tap another spot to move it.
      </p>

      {placed && (
        <div key={placed.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 animate-slide-up-fade">
          <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-primary mb-1.5">
            <MapPin className="w-3 h-3" /> {placed.branch}
          </p>
          <p className="text-ui-lg font-semibold text-foreground">{placed.name}</p>
          <p className="text-ui-base text-muted-foreground mt-1">{placed.problem}</p>
          {placed.valuePool && (
            <p className="flex items-start gap-1.5 text-ui-sm text-emerald-700 dark:text-emerald-400 mt-2">
              <CircleDollarSign className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {placed.valuePool}
            </p>
          )}
          {adjacent.length > 0 && (
            <p className="flex items-start gap-1.5 text-ui-xs text-muted-foreground mt-1.5">
              <Waypoints className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" />
              <span>Unlocks next on the same data: <span className="text-foreground/80">{adjacent.map(l => l.name).join(', ')}</span></span>
            </p>
          )}
          {placed.personas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {placed.personas.map(p => <PersonaChip key={p} name={p} />)}
            </div>
          )}
          {(placed.surfaces.length > 0 || map.rationale) && (
            <button onClick={() => setWhy(w => !w)} className="mt-3 inline-flex items-center gap-1 text-ui-xs font-medium text-primary hover:underline" aria-expanded={why}>
              Why here? <ChevronDown className={`w-3.5 h-3.5 transition-transform ${why ? 'rotate-180' : ''}`} />
            </button>
          )}
          {why && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {map.rationale && (
                <p className="flex items-start gap-1.5 text-ui-sm text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" /> {map.rationale}
                </p>
              )}
              {placed.surfaces.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {placed.surfaces.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full border border-primary/30 text-ui-2xs text-primary">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {map.branches.map((b, bi) => {
          const important = (id: string) => id === map.placedLeafId || map.adjacentLeafIds.includes(id);
          const open = expanded[b.id];
          const shown = open ? b.leaves : b.leaves.filter((l, li) => important(l.id) || li < VISIBLE_LEAVES);
          const hidden = b.leaves.length - shown.length;
          return (
            <div key={b.id} className="rounded-2xl border border-border bg-card/50 p-4 animate-cascade-in" style={{ animationDelay: `${bi * 140}ms` }}>
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">{b.name}</p>
              <div className="space-y-2">
                {shown.map(leaf => {
                  const isPlaced = leaf.id === map.placedLeafId;
                  const isAdjacent = map.adjacentLeafIds.includes(leaf.id);
                  const delay = 200 + order++ * 70;
                  return (
                    <button
                      key={leaf.id}
                      onClick={() => place(leaf.id)}
                      className={`relative w-full text-left rounded-xl px-3 py-2.5 border transition-all animate-cascade-in ${
                        isPlaced
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                          : isAdjacent
                            ? 'border-dashed border-primary/40 bg-primary/[0.03] hover:bg-primary/5'
                            : 'border-border/70 hover:border-border hover:bg-secondary/40'
                      }`}
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <span className="flex items-start gap-2">
                        {isPlaced && <MapPin key={map.placedLeafId} className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-scale-in" />}
                        <span className="flex-1">
                          <span className={`block text-ui-sm font-medium ${isPlaced ? 'text-foreground' : 'text-foreground/90'}`}>{leaf.name}</span>
                          {isAdjacent && <span className="block text-ui-2xs text-primary/80 mt-0.5">Your idea likely touches this</span>}
                          {leaf.valuePool && !isPlaced && <span className="block text-ui-2xs text-muted-foreground mt-0.5 line-clamp-1" title={leaf.valuePool}>{leaf.valuePool}</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {hidden > 0 && (
                  <button onClick={() => setExpanded(e => ({ ...e, [b.id]: true }))} className="w-full text-left px-3 py-1.5 text-ui-xs font-medium text-muted-foreground hover:text-foreground">
                    + {hidden} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
