import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, Pin, Search } from 'lucide-react';
import type { BlueprintDigest } from './types';

interface KpiLibraryProps {
  digest: BlueprintDigest;
  focus: string[];
  pinned: string[];
  onTogglePin: (kpiId: string) => void;
}

export function KpiLibrary({ digest, focus, pinned, onTogglePin }: KpiLibraryProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'focus' | 'all'>(focus.length ? 'focus' : 'all');
  const areaLabel = useMemo(() => new Map(digest.areas.map(a => [a.name, a.label])), [digest]);
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const kpis = useMemo(() => {
    const q = query.trim().toLowerCase();
    return digest.kpis
      .filter(k => scope === 'all' || focus.includes(k.area) || pinnedSet.has(k.id))
      .filter(k => !q || `${k.label} ${k.description} ${k.measures.map(m => m.label).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => Number(pinnedSet.has(b.id)) - Number(pinnedSet.has(a.id)));
  }, [digest, query, scope, focus, pinnedSet]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-card focus-within:border-primary/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${digest.stats.measures.toLocaleString()} measures, e.g. margin, churn, on-time`}
            className="flex-1 bg-transparent outline-none text-ui-md"
          />
        </label>
        <div className="inline-flex p-1 rounded-xl bg-secondary/60 text-ui-sm">
          {(['focus', 'all'] as const).map(s => (
            <button
              key={s}
              disabled={s === 'focus' && focus.length === 0}
              onClick={() => setScope(s)}
              className={`px-3 h-8 rounded-lg font-medium transition-colors disabled:opacity-40 ${scope === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'focus' ? 'Your areas' : 'Everything'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {kpis.slice(0, 40).map(k => {
          const isPinned = pinnedSet.has(k.id);
          const time = k.slices.find(s => s.kind === 'time');
          return (
            <div key={k.id} className={`rounded-2xl border bg-card p-4 transition-colors ${isPinned ? 'border-primary/50' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-ui-xs text-muted-foreground">{areaLabel.get(k.area)}</p>
                  <p className="text-ui-md font-semibold text-foreground">{k.label}</p>
                </div>
                <button
                  onClick={() => onTogglePin(k.id)}
                  aria-pressed={isPinned}
                  title={isPinned ? 'Remove from your KPIs' : 'Add to your KPIs'}
                  className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                >
                  <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {k.measures.slice(0, 5).map(m => (
                  <span key={m.name} title={m.comment} className="px-1.5 py-0.5 rounded-md bg-primary/[0.07] text-ui-xs text-foreground/85">{m.label}</span>
                ))}
                {k.measures.length > 5 && <span className="px-1.5 py-0.5 text-ui-xs text-muted-foreground">+{k.measures.length - 5}</span>}
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 text-ui-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  {time && <CalendarClock className="w-3 h-3 shrink-0" />}
                  Slice by {k.slices.filter(s => s.kind !== 'time').slice(0, 2).map(s => s.label.toLowerCase()).join(', ') || 'time'}
                  {time ? ' and time' : ''}
                </span>
                <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 shrink-0 hover:text-primary">
                  Source <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
      {kpis.length === 0 && <p className="text-ui-sm text-muted-foreground text-center py-8">Nothing matches that. Try a broader word, or look at everything.</p>}
      {kpis.length > 40 && <p className="text-ui-xs text-muted-foreground text-center">Showing 40 of {kpis.length}. Search to narrow it down.</p>}
    </div>
  );
}
