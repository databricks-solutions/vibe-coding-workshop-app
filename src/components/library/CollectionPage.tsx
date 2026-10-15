import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Eye, EyeOff, LayoutGrid, Link2, List as ListIcon, Pencil, Plus, Search, Settings2, SearchX } from 'lucide-react';
import type { LibraryCollection, LibraryUseCase } from '../../api/library';
import { columnsFor, keyOf, UNCATEGORIZED, type Column, type Entry, type LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { BulkBar } from './BulkBar';
import { UseCaseCard } from './UseCaseCard';
import { UseCaseTable } from './UseCaseTable';
import { KIND_BY_ID, categoryTint, collectionIcon, collectionTint, relativeTime, tintStyle } from './theme';
import { Avatar, CollectionGlyph, EmptyState, KindBadge, Meter, SegmentedControl, Switch, cx } from './ui';
import { BTN_PRIMARY, BTN_SECONDARY } from '../skills/uiStyles';

type Filter = 'all' | 'live' | 'hidden' | 'certified' | 'cross';
type ViewMode = 'board' | 'list';

interface Props {
  model: LibraryModel;
  collection: LibraryCollection;
  actions: LibraryActions;
  onOpen: (uc: LibraryUseCase) => void;
  onNewUseCase: (collectionId: string) => void;
  onPreview: (collectionId: string) => void;
  onEditCollection: (c: LibraryCollection) => void;
  onAddTo: (ucs: LibraryUseCase[], collectionId: string) => void;
}

const VIEW_KEY = 'library.collection.view';

function matches(e: Entry, q: string, filter: Filter, model: LibraryModel): boolean {
  if (q && !`${e.uc.use_case_label} ${e.uc.prompt_template.slice(0, 400)}`.toLowerCase().includes(q)) return false;
  switch (filter) {
    case 'live': return e.uc.is_active;
    case 'hidden': return !e.uc.is_active;
    case 'certified': return e.uc.is_certified;
    case 'cross': return !e.isHome || (model.membersByKey[e.key]?.length ?? 0) > 0;
    default: return true;
  }
}

function InlineText({ value, onSave, className, placeholder, multiline }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const commit = () => { setEditing(false); if (draft.trim() !== value.trim()) onSave(draft.trim()); };
  if (editing) {
    const common = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        if (e.key === 'Enter' && (!multiline || e.metaKey)) { e.preventDefault(); commit(); }
      },
      className: cx('w-full bg-background/70 rounded-lg ring-1 ring-primary/50 px-2 py-1 outline-none', className),
      placeholder,
    };
    return multiline ? <textarea rows={2} {...common} /> : <input {...common} />;
  }
  return (
    <button onClick={() => setEditing(true)} className={cx('group/inline text-left rounded-lg -mx-1 px-1 hover:bg-foreground/5 transition-colors inline-flex items-start gap-2 max-w-full', className)}>
      <span className={cx(!value && 'text-muted-foreground italic')}>{value || placeholder}</span>
      <Pencil className="w-3.5 h-3.5 mt-1 shrink-0 opacity-0 group-hover/inline:opacity-50" />
    </button>
  );
}

export function CollectionPage({ model, collection, actions, onOpen, onNewUseCase, onPreview, onEditCollection, onAddTo }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'board');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ key: string; from: string } | null>(null);
  const [over, setOver] = useState<{ col: string; before: string | null } | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');

  useEffect(() => { setSelected(new Set()); setExtraCats([]); setQuery(''); setFilter('all'); }, [collection.collection_id]);
  useEffect(() => { localStorage.setItem(VIEW_KEY, mode); }, [mode]);

  const id = collection.collection_id;
  const tint = collectionTint(collection);
  const kind = KIND_BY_ID[collection.kind];
  const stats = model.stats[id] || { total: 0, live: 0, hidden: 0, certified: 0, crossListed: 0 };
  const allEntries = useMemo(() => model.entriesByCollection[id] || [], [model, id]);
  const q = query.trim().toLowerCase();
  const entries = useMemo(() => allEntries.filter(e => matches(e, q, filter, model)), [allEntries, q, filter, model]);
  const columns = useMemo(() => columnsFor(entries, q || filter !== 'all' ? [] : extraCats), [entries, extraCats, q, filter]);
  const canDrag = !q && filter === 'all';
  const lastEdit = allEntries.reduce<Entry | null>((best, e) => (!best || (e.uc.updated_at || '') > (best.uc.updated_at || '') ? e : best), null);
  const selectedUcs = allEntries.filter(e => selected.has(e.key)).map(e => e.uc).filter((u, i, a) => a.findIndex(x => keyOf(x) === keyOf(u)) === i);

  const toggle = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const realOrders = columnsFor(allEntries).filter(c => c.id !== UNCATEGORIZED).map(c => c.order).filter(o => o < 900);
  const nextOrder = (realOrders.length ? Math.max(...realOrders) : 0) + 1;

  const onDropColumn = (col: Column) => (e: DragEvent) => {
    e.preventDefault();
    if (!drag) return;
    const moving = allEntries.find(x => x.key === drag.key);
    if (!moving) return;
    const list = col.entries.filter(x => x.key !== drag.key);
    const idx = over?.before ? list.findIndex(x => x.key === over.before) : -1;
    list.splice(idx < 0 ? list.length : idx, 0, moving);
    const category = col.id === UNCATEGORIZED ? null : col.title;
    const order = category ? (col.order < 900 ? col.order : nextOrder) : null;
    void actions.setLayout(id, list.map((x, i) => ({ industry: x.uc.industry, use_case: x.uc.use_case, category, category_order: order, display_order: i + 1 })));
    if (category) setExtraCats(c => c.filter(t => t !== category));
    setDrag(null);
    setOver(null);
  };

  const renameColumn = (col: Column, title: string) => {
    if (!title || title === col.title) return;
    if (col.entries.length === 0) { setExtraCats(c => c.map(t => (t === col.title ? title : t))); return; }
    void actions.setLayout(id, col.entries.map((x, i) => ({ industry: x.uc.industry, use_case: x.uc.use_case, category: title, category_order: col.order < 900 ? col.order : nextOrder, display_order: x.displayOrder ?? i + 1 })));
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'live', label: 'Live', count: stats.live },
    { id: 'hidden', label: 'Hidden', count: stats.hidden },
    { id: 'certified', label: 'Certified', count: stats.certified },
    { id: 'cross', label: 'Cross-listed', count: stats.crossListed },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* Hero */}
      <section style={tintStyle(tint)} className="relative lib-wash border-b border-border">
        <div className="px-8 pt-7 pb-5">
          <div className="flex items-center gap-2 mb-4 text-ui-xs text-muted-foreground">
            <KindBadge kind={collection.kind} />
            <span>{kind.blurb}</span>
          </div>
          <div className="flex items-start gap-5">
            <CollectionGlyph collection={collection} size="xl" off={!collection.is_enabled} />
            <div className="flex-1 min-w-0">
              <InlineText value={collection.label} onSave={v => v && void actions.updateCollection(id, { label: v })} className="text-ui-3xl font-semibold tracking-tight text-foreground" />
              <InlineText
                value={collection.description || ''}
                placeholder="Add a one-line description attendees will see under the tab…"
                multiline
                onSave={v => void actions.updateCollection(id, { description: v || null })}
                className="mt-1 text-ui-md text-muted-foreground max-w-2xl"
              />
            </div>
            <div className={cx('shrink-0 rounded-2xl p-4 w-72 ring-1 backdrop-blur', collection.is_enabled ? 'bg-card/70 ring-border' : 'bg-card/50 ring-amber-500/30')}>
              <div className="flex items-center gap-3">
                <span className={cx('w-9 h-9 rounded-xl inline-flex items-center justify-center', collection.is_enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted-foreground/10 text-muted-foreground')}>
                  {collection.is_enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </span>
                <div className="flex-1">
                  <div className="text-ui-sm font-semibold text-foreground">Visible to attendees</div>
                  <div className="text-ui-xs text-muted-foreground">
                    {collection.is_enabled ? (stats.live ? `${stats.live} use case${stats.live === 1 ? '' : 's'} showing` : 'On, but nothing is live yet') : 'Hidden from the workshop'}
                  </div>
                </div>
                <Switch size="lg" checked={collection.is_enabled} tint={tint} label="Visible to attendees" onChange={v => void actions.updateCollection(id, { is_enabled: v })} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-6 flex-wrap">
            <div className="w-56">
              <Meter live={stats.live} total={stats.total} tint={tint} />
            </div>
            <div className="flex items-center gap-4 text-ui-sm text-muted-foreground tabular-nums">
              <span><span className="text-foreground font-semibold">{stats.live}</span> live</span>
              <span><span className="text-foreground font-semibold">{stats.hidden}</span> hidden</span>
              <span className="inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-amber-500" /><span className="text-foreground font-semibold">{stats.certified}</span> certified</span>
              <span className="inline-flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /><span className="text-foreground font-semibold">{stats.crossListed}</span> cross-listed</span>
            </div>
            {lastEdit?.uc.updated_at && (
              <span className="ml-auto inline-flex items-center gap-2 text-ui-xs text-muted-foreground">
                <Avatar email={lastEdit.uc.created_by} size="xs" />
                Last edit {relativeTime(lastEdit.uc.updated_at)}
              </span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!collection.is_enabled && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mx-8 mb-5 flex items-center gap-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25 px-4 py-2.5">
                <EyeOff className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="flex-1 text-ui-sm text-foreground">
                  Hidden from attendees. Its {stats.total} use case{stats.total === 1 ? '' : 's'} keep their own settings and come back when you turn it on.
                </p>
                <button className="px-3 py-1 rounded-lg bg-amber-500 text-white text-ui-sm font-medium hover:bg-amber-600" onClick={() => void actions.updateCollection(id, { is_enabled: true })}>Turn on</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 px-8 py-3 bg-background/85 backdrop-blur border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${collection.label}…`}
            data-library-filter
            className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-card ring-1 ring-border text-ui-sm outline-none focus:ring-primary/50"
          />
        </div>
        <SegmentedControl id={`filter-${id}`} size="sm" options={filters} value={filter} onChange={setFilter} />
        <span className="flex-1" />
        <SegmentedControl
          id={`mode-${id}`}
          size="sm"
          value={mode}
          onChange={setMode}
          options={[{ id: 'board', label: 'Board', icon: <LayoutGrid className="w-3.5 h-3.5" /> }, { id: 'list', label: 'List', icon: <ListIcon className="w-3.5 h-3.5" /> }]}
        />
        <button className={BTN_SECONDARY} onClick={() => onEditCollection(collection)} title="Collection settings"><Settings2 className="w-4 h-4" /></button>
        <button className={BTN_SECONDARY} onClick={() => onPreview(id)}><Eye className="w-4 h-4" />Preview</button>
        <button className={BTN_PRIMARY} onClick={() => onNewUseCase(id)}><Plus className="w-4 h-4" />New use case</button>
      </div>

      {/* Body */}
      <div className="flex-1 px-8 py-6">
        {allEntries.length === 0 ? (
          <EmptyState
            icon={(() => { const I = collectionIcon(collection); return <I className="w-6 h-6" />; })()}
            title={`${collection.label} is empty`}
            body={collection.kind === 'industry'
              ? 'Build a use case with the AI builder, or add existing ones from other collections.'
              : `Cross-list use cases from your industries into ${collection.label}, or build a new play from scratch.`}
            action={
              <div className="flex gap-2">
                <button className={BTN_PRIMARY} onClick={() => onNewUseCase(id)}><Plus className="w-4 h-4" />Build a use case</button>
              </div>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState icon={<SearchX className="w-6 h-6" />} title="Nothing matches" body="Try a different search or filter." action={<button className={BTN_SECONDARY} onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button>} />
        ) : mode === 'list' ? (
          <UseCaseTable
            rows={entries.map(e => ({ uc: e.uc, category: e.category }))}
            model={model}
            selected={selected}
            onToggleSelect={toggle}
            onToggleAll={(keys, on) => setSelected(s => { const n = new Set(s); keys.forEach(k => (on ? n.add(k) : n.delete(k))); return n; })}
            onOpen={onOpen}
            onLive={(uc, v) => void actions.setFlags([uc], { is_active: v })}
            onCertified={(uc, v) => void actions.setFlags([uc], { is_certified: v })}
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {columns.map((col, ci) => {
              const ct = col.id === UNCATEGORIZED ? { h: 220, s: 10 } : categoryTint(ci);
              const isOver = over?.col === col.id;
              return (
                <div
                  key={col.id}
                  style={tintStyle(ct)}
                  onDragOver={e => { if (drag) { e.preventDefault(); setOver(o => (o?.col === col.id && o.before === null ? o : { col: col.id, before: null })); } }}
                  onDrop={onDropColumn(col)}
                  className={cx('lib-column w-[19rem] shrink-0 rounded-2xl p-2.5 transition-colors', isOver && drag && 'lib-dropzone')}
                >
                  <div className={cx('flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5', col.id === UNCATEGORIZED ? 'bg-secondary/70 text-foreground' : 'lib-band shadow-md')}>
                    {col.id === UNCATEGORIZED ? (
                      <span className="flex-1 text-ui-sm font-semibold">Uncategorized</span>
                    ) : (
                      <InlineText value={col.title} onSave={v => renameColumn(col, v)} className="flex-1 text-ui-sm font-semibold !text-white" />
                    )}
                    <span className={cx('px-2 py-0.5 rounded-full text-ui-2xs font-semibold tabular-nums', col.id === UNCATEGORIZED ? 'bg-background/70' : 'bg-white/20 ring-1 ring-white/25')}>{col.entries.length}</span>
                  </div>
                  <div className="space-y-2.5 min-h-[3rem]">
                    {col.entries.map(e => (
                      <UseCaseCard
                        key={e.key}
                        entry={e}
                        model={model}
                        collection={collection}
                        tint={ct}
                        selected={selected.has(e.key)}
                        selectionMode={selected.size > 0}
                        onToggleSelect={() => toggle(e.key)}
                        onOpen={() => onOpen(e.uc)}
                        onLive={v => void actions.setFlags([e.uc], { is_active: v })}
                        onCertified={v => void actions.setFlags([e.uc], { is_certified: v })}
                        dragging={drag?.key === e.key}
                        dropBefore={isOver && over?.before === e.key && drag?.key !== e.key}
                        onDragStart={canDrag ? ev => { ev.dataTransfer.effectAllowed = 'move'; setDrag({ key: e.key, from: col.id }); } : undefined}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        onDragOver={ev => { if (drag) { ev.preventDefault(); ev.stopPropagation(); setOver({ col: col.id, before: e.key }); } }}
                      />
                    ))}
                    {col.entries.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-ui-xs text-muted-foreground">Drag cards here</div>
                    )}
                  </div>
                </div>
              );
            })}
            {canDrag && (
              <div className="w-[15rem] shrink-0">
                {addingCat ? (
                  <form
                    onSubmit={e => { e.preventDefault(); const t = newCat.trim(); if (t) setExtraCats(c => [...c, t]); setNewCat(''); setAddingCat(false); }}
                    className="rounded-2xl ring-1 ring-border bg-card p-2.5"
                  >
                    <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)} onBlur={() => !newCat && setAddingCat(false)} placeholder="Category name" className="w-full px-2.5 py-1.5 rounded-lg bg-background ring-1 ring-border text-ui-sm outline-none focus:ring-primary/50" />
                    <p className="text-ui-2xs text-muted-foreground mt-1.5 px-1">Press Enter, then drag cards into it.</p>
                  </form>
                ) : (
                  <button onClick={() => setAddingCat(true)} className="w-full rounded-2xl border border-dashed border-border px-3 py-4 text-ui-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" />Add category
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <BulkBar
        model={model}
        selected={selectedUcs}
        excludeCollection={id}
        onClear={() => setSelected(new Set())}
        onFlags={flags => { void actions.setFlags(selectedUcs, flags); setSelected(new Set()); }}
        onAddTo={cid => { onAddTo(selectedUcs, cid); setSelected(new Set()); }}
      />
    </div>
  );
}
