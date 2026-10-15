import { useState } from 'react';
import { Check, ChevronDown, CircleDollarSign, MapPin, Plus, Sparkles, Waypoints, X } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { alsoLeaves, placedLeaf } from '../engine/ideaContext';
import { MAX_ALSO_LEAVES } from '../engine/types';
import { PersonaChip } from '../ui/PersonaChip';
import { SurfaceChips } from '../ui/SurfaceChips';

/** Leaves shown per branch before "more"; the placed, added and adjacent leaves always show. */
const VISIBLE_LEAVES = 2;

export function MapStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const map = idea.map;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [why, setWhy] = useState(false);
  if (!map) return null;
  const placed = placedLeaf(idea);
  const also = alsoLeaves(idea);
  const alsoIds = also.map(l => l.id);
  const full = alsoIds.length >= MAX_ALSO_LEAVES;
  const adjacent = map.branches.flatMap(b => b.leaves).filter(l => map.adjacentLeafIds.includes(l.id));
  const personas = [...new Set([...(placed?.personas ?? []), ...also.flatMap(l => l.personas)])];

  const toggle = (leafId: string) => {
    if (leafId === map.placedLeafId || flow.readOnly) return;
    const leaf = map.branches.flatMap(b => b.leaves).find(l => l.id === leafId);
    if (alsoIds.includes(leafId)) {
      flow.revise('map', i => ({ map: { ...i.map!, alsoLeafIds: alsoIds.filter(a => a !== leafId) } }), `Removed ${leaf?.name ?? 'a spot'} from the industry map`);
    } else if (!full) {
      flow.revise('map', i => ({ map: { ...i.map!, alsoLeafIds: [...alsoIds, leafId] } }), `Added ${leaf?.name ?? 'a spot'} to the industry map`);
    }
  };

  const makeMain = (leafId: string) => {
    if (flow.readOnly || !map.placedLeafId) return;
    const prev = map.placedLeafId;
    const leaf = also.find(l => l.id === leafId);
    flow.revise('map', i => ({
      map: {
        ...i.map!,
        placedLeafId: leafId,
        alsoLeafIds: alsoIds.map(a => (a === leafId ? prev : a)),
        adjacentLeafIds: i.map!.adjacentLeafIds.filter(a => a !== leafId),
      },
    }), `Made ${leaf?.name ?? 'a spot'} the main spot on the industry map`);
  };

  const scrollToGrid = () => document.getElementById('industry-map-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let order = 0;
  return (
    <div className="space-y-6">
      <p className="text-ui-md text-muted-foreground animate-fade-in">
        Your idea is pinned where I think it lives in {idea.spark?.industry || 'your industry'}.
        {!flow.readOnly && <> <span className="text-foreground font-medium">Tap any other spot it also covers</span> (up to {MAX_ALSO_LEAVES}).</>}
      </p>

      {placed && (
        <div key={placed.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 animate-slide-up-fade">
          <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-primary mb-1.5">
            <MapPin className="w-3 h-3" /> {placed.branch} · Main spot
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

          {(also.length > 0 || !flow.readOnly) && (
            <div className="mt-4 pt-4 border-t border-primary/15">
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Also covers{!flow.readOnly && <span className="normal-case tracking-normal font-normal"> · {also.length} of {MAX_ALSO_LEAVES}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {also.map(l => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card pl-3 pr-1 py-1 text-ui-sm text-foreground animate-scale-in">
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">{l.branch} ·</span> <span className="font-medium">{l.name}</span>
                    {!flow.readOnly && (
                      <>
                        <button onClick={() => makeMain(l.id)} className="ml-1 px-2 py-0.5 rounded-full text-ui-xs font-medium text-primary hover:bg-primary/10">
                          Make main
                        </button>
                        <button onClick={() => toggle(l.id)} aria-label={`Remove ${l.name}`} title="Remove" className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                ))}
                {!flow.readOnly && !full && (
                  <button onClick={scrollToGrid} className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-3 py-1 text-ui-sm font-medium text-primary hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5" /> {also.length ? 'Add another' : 'Add a spot'}
                  </button>
                )}
              </div>
            </div>
          )}

          {personas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {personas.map(p => <PersonaChip key={p} name={p} />)}
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
                <SurfaceChips surfaces={placed.surfaces} size="sm" />
              )}
            </div>
          )}
        </div>
      )}

      <div id="industry-map-grid" className="grid gap-4 md:grid-cols-3 scroll-mt-24">
        {map.branches.map((b, bi) => {
          const important = (id: string) => id === map.placedLeafId || alsoIds.includes(id) || map.adjacentLeafIds.includes(id);
          const open = expanded[b.id];
          const shown = open ? b.leaves : b.leaves.filter((l, li) => important(l.id) || li < VISIBLE_LEAVES);
          const hidden = b.leaves.length - shown.length;
          return (
            <div key={b.id} className="rounded-2xl border border-border bg-card/50 p-4 animate-cascade-in" style={{ animationDelay: `${bi * 140}ms` }}>
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">{b.name}</p>
              <div className="space-y-2">
                {shown.map(leaf => {
                  const isPlaced = leaf.id === map.placedLeafId;
                  const isAdded = alsoIds.includes(leaf.id);
                  const isAdjacent = map.adjacentLeafIds.includes(leaf.id);
                  const blocked = full && !isAdded && !isPlaced;
                  const delay = 200 + order++ * 70;
                  const hint = flow.readOnly || isPlaced ? undefined : isAdded ? 'Tap to remove' : blocked ? `Up to ${MAX_ALSO_LEAVES} extra spots` : 'Tap to add';
                  return (
                    <button
                      key={leaf.id}
                      onClick={() => toggle(leaf.id)}
                      disabled={(flow.readOnly && !isPlaced && !isAdded) || blocked}
                      aria-pressed={isPlaced || isAdded}
                      title={hint}
                      className={`group relative w-full text-left rounded-xl px-3 py-2.5 border transition-all animate-cascade-in ${
                        isPlaced
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10 cursor-default'
                          : isAdded
                            ? 'border-primary/60 bg-primary/[0.07]'
                            : blocked
                              ? 'border-border/50 opacity-50 cursor-not-allowed'
                              : isAdjacent
                                ? 'border-dashed border-primary/40 bg-primary/[0.03] hover:bg-primary/5 hover:border-primary/60'
                                : 'border-border/70 hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <span className="flex items-start gap-2">
                        {isPlaced && <MapPin key={map.placedLeafId} className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-scale-in" />}
                        <span className="flex-1 min-w-0">
                          <span className={`block text-ui-sm font-medium ${isPlaced || isAdded ? 'text-foreground' : 'text-foreground/90'}`}>{leaf.name}</span>
                          {isPlaced && <span className="block text-ui-2xs text-primary mt-0.5">Main spot</span>}
                          {isAdjacent && !isAdded && !isPlaced && (
                            <span className="block text-ui-2xs text-primary/80 mt-0.5">Likely related</span>
                          )}
                          {leaf.valuePool && !isPlaced && <span className="block text-ui-2xs text-muted-foreground mt-0.5 line-clamp-1" title={leaf.valuePool}>{leaf.valuePool}</span>}
                        </span>
                        {!isPlaced && !flow.readOnly && (
                          isAdded ? (
                            <span className="shrink-0 grid rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-ui-2xs font-semibold animate-scale-in transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground" aria-hidden>
                              <span className="col-start-1 row-start-1 inline-flex items-center gap-1 group-hover:invisible"><Check className="w-3 h-3" strokeWidth={3} /> Added</span>
                              <span className="col-start-1 row-start-1 inline-flex items-center gap-1 invisible group-hover:visible"><X className="w-3 h-3" strokeWidth={3} /> Remove</span>
                            </span>
                          ) : !blocked && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/40 text-primary px-2 py-0.5 text-ui-2xs font-semibold transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden>
                              <Plus className="w-3 h-3" strokeWidth={3} /> Add
                            </span>
                          )
                        )}
                        {isAdded && flow.readOnly && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
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
