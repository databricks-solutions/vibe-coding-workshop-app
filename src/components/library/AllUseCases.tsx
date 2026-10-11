import { useMemo, useState } from 'react';
import { List, Search, Sparkles, X } from 'lucide-react';
import type { LibraryUseCase } from '../../api/library';
import { intersect, keyOf, type LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { BulkBar } from './BulkBar';
import { UseCaseTable } from './UseCaseTable';
import { KINDS } from './theme';
import { CollectionGlyph, EmptyState, SegmentedControl, cx } from './ui';

type Filter = 'all' | 'live' | 'hidden' | 'certified';

interface Props {
  model: LibraryModel;
  actions: LibraryActions;
  mode: 'all' | 'skills';
  pair: string[];
  onClearPair: () => void;
  onOpen: (uc: LibraryUseCase) => void;
  onAddTo: (ucs: LibraryUseCase[], collectionId: string) => void;
}

export function AllUseCases({ model, actions, mode, pair, onClearPair, onOpen, onAddTo }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [kind, setKind] = useState<'any' | string>('any');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const base = useMemo(() => {
    if (mode === 'skills') return model.skills;
    if (pair.length === 2) return intersect(model, pair[0], pair[1]);
    return model.useCases.filter(u => u.path_type !== 'skill');
  }, [model, mode, pair]);

  const q = query.trim().toLowerCase();
  const rows = base.filter(u => {
    if (q && !`${u.use_case_label} ${model.byId[u.industry]?.label || ''}`.toLowerCase().includes(q)) return false;
    if (kind !== 'any' && model.byId[u.industry]?.kind !== kind) return false;
    if (filter === 'live') return u.is_active;
    if (filter === 'hidden') return !u.is_active;
    if (filter === 'certified') return u.is_certified;
    return true;
  });
  const selectedUcs = base.filter(u => selected.has(keyOf(u)));
  const pairCols = pair.map(id => model.byId[id]).filter(Boolean);

  return (
    <div className="px-8 py-8 max-w-[90rem] mx-auto">
      <header className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-xl bg-secondary inline-flex items-center justify-center text-primary">
          {mode === 'skills' ? <Sparkles className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </span>
        <div className="flex-1">
          <h1 className="text-ui-2xl font-semibold text-foreground">{mode === 'skills' ? 'Skills' : 'All use cases'}</h1>
          <p className="text-ui-sm text-muted-foreground">
            {mode === 'skills' ? 'Skill-building paths participants can pick instead of a use case.' : 'Every use case across industries, business functions and technical solutions.'}
          </p>
        </div>
      </header>

      {pairCols.length === 2 && (
        <div className="mb-4 inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-secondary ring-1 ring-border text-ui-sm">
          <CollectionGlyph collection={pairCols[0]} size="xs" />{pairCols[0].label}
          <span className="text-muted-foreground">×</span>
          <CollectionGlyph collection={pairCols[1]} size="xs" />{pairCols[1].label}
          <button onClick={onClearPair} aria-label="Clear filter" className="p-1 rounded-full hover:bg-background"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} data-library-filter placeholder="Search use cases…" className="w-64 pl-8 pr-3 py-1.5 rounded-lg bg-card ring-1 ring-border text-ui-sm outline-none focus:ring-primary/50" />
        </div>
        <SegmentedControl
          id="all-filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: base.length },
            { id: 'live', label: 'Live', count: base.filter(u => u.is_active).length },
            { id: 'hidden', label: 'Hidden', count: base.filter(u => !u.is_active).length },
            { id: 'certified', label: 'Certified', count: base.filter(u => u.is_certified).length },
          ]}
        />
        {mode === 'all' && (
          <div className="flex items-center gap-1">
            {[{ id: 'any', label: 'Any home' }, ...KINDS.map(k => ({ id: k.id, label: k.short }))].map(k => (
              <button key={k.id} onClick={() => setKind(k.id)} className={cx('px-2.5 py-1 rounded-full text-ui-xs font-medium ring-1 transition-colors', kind === k.id ? 'bg-primary/15 text-primary ring-primary/30' : 'text-muted-foreground ring-border hover:text-foreground')}>
                {k.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Search className="w-6 h-6" />} title="Nothing here" body={pair.length === 2 ? 'No use case sits in both collections yet.' : 'Try a different search or filter.'} />
      ) : (
        <UseCaseTable
          rows={rows.map(uc => ({ uc }))}
          model={model}
          showHome
          selected={selected}
          onToggleSelect={k => setSelected(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          onToggleAll={(keys, on) => setSelected(s => { const n = new Set(s); keys.forEach(k => (on ? n.add(k) : n.delete(k))); return n; })}
          onOpen={onOpen}
          onLive={(uc, v) => void actions.setFlags([uc], { is_active: v })}
          onCertified={(uc, v) => void actions.setFlags([uc], { is_certified: v })}
        />
      )}

      <BulkBar
        model={model}
        selected={selectedUcs}
        onClear={() => setSelected(new Set())}
        onFlags={flags => { void actions.setFlags(selectedUcs, flags); setSelected(new Set()); }}
        onAddTo={cid => { onAddTo(selectedUcs, cid); setSelected(new Set()); }}
      />
    </div>
  );
}
