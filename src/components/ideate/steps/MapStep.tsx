import { MapPin, Sparkles } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import { placedLeaf } from '../ideaContext';
import { avatarFor } from '../art';

export function MapStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const map = idea.map;
  if (!map) return null;
  const placed = placedLeaf(idea);

  const place = (leafId: string) => {
    if (leafId === map.placedLeafId) return;
    flow.patch(i => ({ map: { ...i.map!, placedLeafId: leafId, adjacentLeafIds: i.map!.adjacentLeafIds.filter(a => a !== leafId) } }));
  };

  let order = 0;
  return (
    <div className="space-y-6">
      <p className="text-ui-sm text-muted-foreground animate-fade-in">
        Your idea is pinned where I think it lives in {idea.spark?.industry || 'your industry'}. Tap another spot to move it.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {map.branches.map((b, bi) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card/50 p-4 animate-cascade-in" style={{ animationDelay: `${bi * 140}ms` }}>
            <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">{b.name}</p>
            <div className="space-y-2">
              {b.leaves.map(leaf => {
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
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {placed && (
        <div key={placed.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 animate-slide-up-fade">
          <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-primary mb-1.5">
            <MapPin className="w-3 h-3" /> {placed.branch}
          </p>
          <p className="text-ui-lg font-semibold text-foreground">{placed.name}</p>
          <p className="text-ui-base text-muted-foreground mt-1">{placed.problem}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {placed.personas.map(p => (
              <span key={p} className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-secondary text-ui-xs text-foreground">
                <img src={avatarFor(p)} alt="" width={22} height={22} className="w-[22px] h-[22px] rounded-full" />
                {p}
              </span>
            ))}
          </div>
          {placed.surfaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {placed.surfaces.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full border border-primary/30 text-ui-2xs text-primary">{s}</span>
              ))}
            </div>
          )}
          {map.rationale && (
            <p className="flex items-start gap-1.5 text-ui-xs text-muted-foreground mt-3">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary/70" /> {map.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
