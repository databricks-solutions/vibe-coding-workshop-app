import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus, RotateCw, Search } from 'lucide-react';
import { useCatalogs, useSchemas, type UcNameList } from './sourcesApi';

interface SelectProps {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  list: UcNameList;
  emptyText: string;
  isTaken?: (name: string) => boolean;
  onOpen?: () => void;
  onPick: (name: string) => void;
}

/** A dropdown with a type-to-filter box, arrow keys, Enter to pick and Escape to close. */
function SearchSelect({ label, value, placeholder, disabled, disabledHint, list, emptyText, isTaken, onOpen, onPick }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.items.filter(i => i.name.toLowerCase().includes(q)) : list.items;
  }, [list.items, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = () => {
    if (disabled) return;
    if (!open) { setQuery(''); setActive(0); onOpen?.(); }
    setOpen(o => !o);
  };
  const pick = (name: string) => {
    if (isTaken?.(name)) return;
    onPick(name);
    setOpen(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (shown[active]) pick(shown[active].name);
    }
  };

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">{label}</span>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={disabled ? disabledHint : undefined}
        className={`w-full h-10 flex items-center gap-2 px-3 rounded-lg border bg-card text-left text-ui-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border hover:border-foreground/30'
        }`}
      >
        <span className={`flex-1 min-w-0 truncate ${value ? 'font-mono text-foreground' : 'text-muted-foreground'}`}>
          {value || (disabled ? disabledHint : placeholder)}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 border-b border-border/70">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder={`Search ${label.toLowerCase()}s`}
              aria-label={`Search ${label.toLowerCase()}s`}
              className="flex-1 min-w-0 h-9 bg-transparent text-ui-sm outline-none"
            />
          </div>
          {list.loading ? (
            <p className="flex items-center gap-2 px-3 py-3 text-ui-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
          ) : list.error ? (
            <div className="px-3 py-3 space-y-2">
              <p className="text-ui-xs text-amber-600 dark:text-amber-400">{list.error}</p>
              <button type="button" onClick={list.retry} className="inline-flex items-center gap-1 text-ui-xs font-medium text-primary hover:underline">
                <RotateCw className="w-3 h-3" /> Try again
              </button>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-3 text-ui-xs text-muted-foreground">{query ? `Nothing matches "${query}".` : emptyText}</p>
          ) : (
            <ul ref={listRef} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1">
              {shown.map((item, i) => {
                const taken = isTaken?.(item.name) ?? false;
                const selected = item.name === value;
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-index={i}
                      disabled={taken}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(item.name)}
                      title={item.comment || item.name}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-ui-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        i === active ? 'bg-secondary/70' : ''
                      }`}
                    >
                      <span className="flex-1 min-w-0 truncate font-mono text-foreground">{item.name}</span>
                      {taken ? (
                        <span className="text-ui-2xs text-muted-foreground">Added</span>
                      ) : selected ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export interface CatalogSchemaPickerProps {
  /** Called with "catalog.schema" when the user clicks Add. */
  onAdd: (id: string) => void;
  /** catalog.schema ids already added; shown as "Added" and not pickable. */
  existing: string[];
  /** Stacks the two dropdowns for narrow containers. */
  compact?: boolean;
}

/** Pick a Unity Catalog catalog, then one of its schemas, from what the app can read. */
export function CatalogSchemaPicker({ onAdd, existing, compact = false }: CatalogSchemaPickerProps) {
  const [catalogsWanted, setCatalogsWanted] = useState(false);
  const [catalog, setCatalog] = useState('');
  const [schema, setSchema] = useState('');
  const catalogs = useCatalogs(catalogsWanted);
  const schemas = useSchemas(catalog);
  const taken = new Set(existing.map(e => e.toLowerCase()));

  const add = () => {
    if (!catalog || !schema) return;
    onAdd(`${catalog}.${schema}`);
    setSchema('');
  };

  return (
    <div className="space-y-2">
      <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-end'}`}>
        <SearchSelect
          label="Catalog"
          value={catalog}
          placeholder="Choose a catalog"
          list={catalogs}
          emptyText="No catalogs the app can read."
          onOpen={() => setCatalogsWanted(true)}
          onPick={name => { if (name !== catalog) { setCatalog(name); setSchema(''); } }}
        />
        <SearchSelect
          label="Schema"
          value={schema}
          placeholder="Choose a schema"
          disabled={!catalog}
          disabledHint="Pick a catalog first"
          list={schemas}
          emptyText="No schemas you can read in this catalog."
          isTaken={name => taken.has(`${catalog}.${name}`.toLowerCase())}
          onPick={setSchema}
        />
        <button
          type="button"
          onClick={add}
          disabled={!catalog || !schema}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" /> Add and scan
        </button>
      </div>
      <p className="text-ui-xs text-muted-foreground">Only catalogs and schemas the app can read are listed.</p>
    </div>
  );
}
