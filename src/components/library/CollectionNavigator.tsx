import { useState, type DragEvent, type ReactNode } from 'react';
import { ChevronRight, Eye, Inbox, LayoutDashboard, LibraryBig, List, Pencil, Plus, Search, Sparkles, Trash2, ToggleLeft } from 'lucide-react';
import type { CollectionKind, LibraryCollection } from '../../api/library';
import type { LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { KINDS, collectionTint, tintStyle } from './theme';
import { CollectionGlyph, Kbd, RowMenu, Switch, cx } from './ui';

export type LibraryView = { name: 'home' } | { name: 'all' } | { name: 'review' } | { name: 'skills' } | { name: 'collection'; id: string };

interface Props {
  model: LibraryModel;
  view: LibraryView;
  actions: LibraryActions;
  onNavigate: (path: string) => void;
  onSearch: () => void;
  onCreateCollection: (kind: CollectionKind) => void;
  onEditCollection: (c: LibraryCollection) => void;
  onDeleteCollection: (c: LibraryCollection) => void;
}

const COLLAPSE_KEY = 'library.nav.collapsed';

function NavItem({ icon, label, active, onClick, trailing }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; trailing?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-ui-sm font-medium transition-colors',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
      )}
    >
      <span className={cx('w-4 h-4 inline-flex items-center justify-center', active ? 'text-primary' : '')}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function CollectionNavigator({ model, view, actions, onNavigate, onSearch, onCreateCollection, onEditCollection, onDeleteCollection }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); } catch { return {}; }
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const toggleGroup = (kind: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [kind]: !prev[kind] };
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const onDrop = (kind: CollectionKind, targetId: string) => (e: DragEvent) => {
    e.preventDefault();
    const list = model.byKind[kind].map(c => c.collection_id);
    if (!dragId || dragId === targetId || !list.includes(dragId)) { setDragId(null); setOverId(null); return; }
    const without = list.filter(id => id !== dragId);
    without.splice(without.indexOf(targetId), 0, dragId);
    void actions.reorderCollections(kind, without);
    setDragId(null);
    setOverId(null);
  };

  const reviewCount = model.pendingReview.length;

  return (
    <aside className="w-[17.5rem] shrink-0 border-r border-border bg-card/40 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground inline-flex items-center justify-center shadow-lg shadow-primary/20">
            <LibraryBig className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-ui-md font-semibold text-foreground leading-tight">Use Case Library</h1>
            <p className="text-ui-2xs text-muted-foreground">Curate what attendees see</p>
          </div>
        </div>
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/60 ring-1 ring-border text-ui-sm text-muted-foreground hover:text-foreground hover:ring-primary/40 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search library…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 lib-scroll">
        <div className="space-y-0.5">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active={view.name === 'home'} onClick={() => onNavigate('/library')} />
          <NavItem
            icon={<List className="w-4 h-4" />}
            label="All use cases"
            active={view.name === 'all'}
            onClick={() => onNavigate('/library/all')}
            trailing={<span className="text-ui-2xs tabular-nums text-muted-foreground">{model.useCases.length - model.skills.length}</span>}
          />
          <NavItem
            icon={<Inbox className="w-4 h-4" />}
            label="Needs review"
            active={view.name === 'review'}
            onClick={() => onNavigate('/library/review')}
            trailing={reviewCount > 0 ? (
              <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30 text-ui-2xs font-semibold tabular-nums">{reviewCount}</span>
            ) : undefined}
          />
        </div>

        {KINDS.map(kind => {
          const list = model.byKind[kind.id];
          const isCollapsed = !!collapsed[kind.id];
          const KindIcon = kind.icon;
          return (
            <div key={kind.id} className="mt-5">
              <div className="group flex items-center gap-1.5 px-1.5 mb-1">
                <button onClick={() => toggleGroup(kind.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" aria-expanded={!isCollapsed}>
                  <ChevronRight className={cx('w-3 h-3 text-muted-foreground transition-transform', !isCollapsed && 'rotate-90')} />
                  <span style={tintStyle(kind.tint)} className="lib-ink inline-flex"><KindIcon className="w-3.5 h-3.5" /></span>
                  <span className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{kind.label}</span>
                  <span className="text-ui-2xs text-muted-foreground/60 tabular-nums">{list.length}</span>
                </button>
                <button
                  onClick={() => onCreateCollection(kind.id)}
                  className="p-1 rounded-md text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-foreground hover:bg-secondary transition"
                  aria-label={`New ${kind.singular.toLowerCase()}`}
                  title={`New ${kind.singular.toLowerCase()}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {list.length === 0 && (
                    <button
                      onClick={() => onCreateCollection(kind.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-ui-xs text-muted-foreground border border-dashed border-border hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + Add your first {kind.singular.toLowerCase()}
                    </button>
                  )}
                  {list.map(c => {
                    const s = model.stats[c.collection_id] || { live: 0, total: 0 };
                    const active = view.name === 'collection' && view.id === c.collection_id;
                    return (
                      <div
                        key={c.collection_id}
                        draggable
                        onDragStart={e => { setDragId(c.collection_id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={e => { if (dragId && model.byKind[kind.id].some(x => x.collection_id === dragId)) { e.preventDefault(); setOverId(c.collection_id); } }}
                        onDragLeave={() => setOverId(o => (o === c.collection_id ? null : o))}
                        onDrop={onDrop(kind.id, c.collection_id)}
                        onDragEnd={() => { setDragId(null); setOverId(null); }}
                        onClick={() => onNavigate(`/library/c/${c.collection_id}`)}
                        style={tintStyle(collectionTint(c))}
                        className={cx(
                          'group relative flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-lg cursor-pointer transition-colors',
                          active ? 'bg-secondary' : 'hover:bg-secondary/60',
                          dragId === c.collection_id && 'opacity-40',
                          overId === c.collection_id && dragId !== c.collection_id && 'ring-1 ring-primary/50',
                        )}
                      >
                        {active && <span className="lib-dot absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" />}
                        <CollectionGlyph collection={c} size="sm" off={!c.is_enabled} />
                        <div className="flex-1 min-w-0">
                          <div className={cx('text-ui-sm truncate', c.is_enabled ? 'text-foreground font-medium' : 'text-muted-foreground')} title={c.label}>{c.label}</div>
                          <div className="text-ui-2xs text-muted-foreground tabular-nums">
                            {c.is_enabled ? (s.total === 0 ? 'Empty' : `${s.live} of ${s.total} live`) : 'Off for attendees'}
                          </div>
                        </div>
                        <RowMenu
                          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                          items={[
                            { label: 'Edit details', icon: <Pencil className="w-3.5 h-3.5" />, onSelect: () => onEditCollection(c) },
                            { label: c.is_enabled ? 'Hide from attendees' : 'Show to attendees', icon: <ToggleLeft className="w-3.5 h-3.5" />, onSelect: () => void actions.updateCollection(c.collection_id, { is_enabled: !c.is_enabled }) },
                            { label: 'Delete…', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onSelect: () => onDeleteCollection(c) },
                          ]}
                        />
                        <Switch size="sm" checked={c.is_enabled} tint={collectionTint(c)} label={`${c.label}: ${c.is_enabled ? 'visible' : 'hidden'} for attendees`} onChange={v => void actions.updateCollection(c.collection_id, { is_enabled: v })} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-5">
          <NavItem
            icon={<Sparkles className="w-4 h-4" />}
            label="Skills"
            active={view.name === 'skills'}
            onClick={() => onNavigate('/library/skills')}
            trailing={<span className="text-ui-2xs tabular-nums text-muted-foreground">{model.skills.length}</span>}
          />
        </div>
      </nav>

      <button
        onClick={() => onNavigate('/library')}
        className="mx-2.5 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/[0.07] ring-1 ring-emerald-500/20 text-left hover:bg-emerald-500/10 transition-colors"
      >
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-ui-xs font-medium text-foreground">Attendees see</div>
          <div className="text-ui-2xs text-muted-foreground tabular-nums">
            {model.attendeeCollections.length} collections · {model.attendeeUseCaseCount} use cases
          </div>
        </div>
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </aside>
  );
}
