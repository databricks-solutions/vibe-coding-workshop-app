import type { SelectOption } from '../../api/client';
import { matchesSource as matches, type SourceFilterValue } from './provenance';

const OPTIONS: { key: SourceFilterValue; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'native', label: 'Native' },
  { key: 'partner', label: 'Partner' },
  { key: 'third_party', label: 'Third-party' },
  { key: 'certified', label: 'Certified' },
];

/** Segmented filter for collections that mix native and contributed use cases. Empty segments are hidden. */
export function SourceFilter({ items, value, onChange }: {
  items: SelectOption[];
  value: SourceFilterValue;
  onChange: (v: SourceFilterValue) => void;
}) {
  const real = items.filter(i => i.value && i.path_type !== 'skill');
  const options = OPTIONS.filter(o => o.key === 'all' || real.some(i => matches(i, o.key)));
  return (
    <div role="group" aria-label="Filter use cases by source" className="mb-3 inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1 ring-1 ring-border/40">
      {options.map(o => {
        const count = o.key === 'all' ? real.length : real.filter(i => matches(i, o.key)).length;
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`px-2.5 py-1 rounded-md text-ui-xs font-medium transition-colors ${
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label} <span className="text-muted-foreground/70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
