import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CornerDownLeft, Loader2, Plus, RotateCw, Search } from 'lucide-react';
import { useCatalogs, useSchemas, type UcNameList } from './sourcesApi';

const UC_NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/;
const UC_SOURCE = /^\s*([A-Za-z0-9_][A-Za-z0-9_-]*)\.([A-Za-z0-9_][A-Za-z0-9_-]*)\s*$/;

const isUcName = (s: string) => UC_NAME.test(s.trim());

/** "catalog.schema" text split into its parts, or null. */
function splitUcSource(text: string): [string, string] | null {
  const m = UC_SOURCE.exec(text);
  return m ? [m[1], m[2]] : null;
}

/** Free-text name box used when the list can't load; commits on Enter or blur. */
function PlainNameInput({ value, label, placeholder, className, border, onPasteSource, onCommit }: {
  value: string;
  label: string;
  placeholder: string;
  className: string;
  border: string;
  onPasteSource?: (catalog: string, schema: string) => void;
  onCommit: (name: string) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const t = text.trim();
    if (t !== value && (isUcName(t) || !t)) onCommit(t);
  };
  return (
    <input
      value={text}
      autoFocus
      aria-label={label}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onPaste={e => {
        const parts = onPasteSource ? splitUcSource(e.clipboardData.getData('text')) : null;
        if (onPasteSource && parts) { e.preventDefault(); onPasteSource(parts[0], parts[1]); }
      }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); } }}
      placeholder={placeholder}
      className={`${className} ${text.trim() && !isUcName(text) ? 'border-amber-500/60' : border}`}
    />
  );
}

export interface SearchSelectProps {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  list: UcNameList;
  emptyText: string;
  /** Drops the small label above the field (when a table header names the column). */
  hideLabel?: boolean;
  /** Lets the user type any valid name, not only pick a listed one. */
  allowCustom?: boolean;
  /** Smaller field for dense tables. */
  dense?: boolean;
  invalid?: boolean;
  isTaken?: (name: string) => boolean;
  onOpen?: () => void;
  /** Pasting "catalog.schema" calls this instead of picking the whole text. */
  onPasteSource?: (catalog: string, schema: string) => void;
  onPick: (name: string) => void;
}

/**
 * Type-or-pick field: a dropdown with a filter box, arrow keys, Enter to pick and
 * Escape to close. With `allowCustom`, the typed text is always offered as
 * "Use ..." and kept on Enter or click-away; if the list can't load, it becomes a
 * plain text box.
 */
export function SearchSelect({
  label, value, placeholder, disabled, disabledHint, list, emptyText, hideLabel, allowCustom, dense, invalid,
  isTaken, onOpen, onPasteSource, onPick,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.items.filter(i => i.name.toLowerCase().includes(q)) : list.items;
  }, [list.items, query]);
  const typed = query.trim();
  const custom = allowCustom && isUcName(typed) && !list.items.some(i => i.name.toLowerCase() === typed.toLowerCase()) ? typed : '';
  const options = custom ? [custom, ...shown.map(i => i.name)] : shown.map(i => i.name);
  const plain = !!allowCustom && opened && !disabled && !list.loading && (!!list.error || list.items.length === 0);

  const pick = (name: string) => {
    if (isTaken?.(name)) return;
    onPick(name);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (custom && !isTaken?.(custom)) onPick(custom);
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, custom, isTaken, onPick]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = () => {
    if (disabled) return;
    if (!open) { setQuery(''); setActive(0); setOpened(true); onOpen?.(); }
    setOpen(o => !o);
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parts = onPasteSource ? splitUcSource(e.clipboardData.getData('text')) : null;
    if (!onPasteSource || !parts) return;
    e.preventDefault();
    onPasteSource(parts[0], parts[1]);
    setOpen(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (options[active]) pick(options[active]);
    }
  };

  const height = dense ? 'h-8' : 'h-10';
  const border = invalid ? 'border-amber-500/60' : 'border-border';
  const labelEl = !hideLabel && (
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">{label}</span>
  );

  if (plain) {
    return (
      <div className="flex-1 min-w-0">
        {labelEl}
        <PlainNameInput
          key={value}
          value={value}
          label={label}
          placeholder={placeholder}
          className={`w-full ${height} px-3 rounded-lg border bg-card font-mono text-ui-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10`}
          border={border}
          onPasteSource={onPasteSource}
          onCommit={onPick}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {list.error ? "Couldn't load the list. Type the name instead." : `${emptyText} Type the name instead.`}
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {labelEl}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={hideLabel ? label : undefined}
        title={disabled ? disabledHint : undefined}
        className={`w-full ${height} flex items-center gap-2 px-3 rounded-lg border bg-card text-left text-ui-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-primary/50 ring-2 ring-primary/10' : `${border} hover:border-foreground/30`
        }`}
      >
        <span className={`flex-1 min-w-0 truncate ${value ? 'font-mono text-foreground' : 'text-muted-foreground'}`}>
          {value || (disabled ? disabledHint : placeholder)}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 min-w-[14rem] mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 border-b border-border/70">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={allowCustom ? `Search or type a ${label.toLowerCase()} name` : `Search ${label.toLowerCase()}s`}
              aria-label={`Search ${label.toLowerCase()}s`}
              className="flex-1 min-w-0 h-9 bg-transparent text-ui-sm outline-none"
            />
          </div>
          {allowCustom && typed && !isUcName(typed) && (
            <p className="px-3 pt-2 text-ui-2xs text-amber-600 dark:text-amber-400">Use letters, numbers, _ or - only.</p>
          )}
          {custom && (
            <button
              type="button"
              data-index={0}
              onMouseEnter={() => setActive(0)}
              onClick={() => pick(custom)}
              disabled={isTaken?.(custom)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-ui-sm border-b border-border/60 disabled:opacity-50 ${active === 0 ? 'bg-secondary/70' : ''}`}
            >
              <CornerDownLeft className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">Use</span>
              <span className="font-mono font-semibold text-foreground truncate">&ldquo;{custom}&rdquo;</span>
              {isTaken?.(custom) && <span className="ml-auto text-ui-2xs text-muted-foreground">Added</span>}
            </button>
          )}
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
            !custom && <p className="px-3 py-3 text-ui-xs text-muted-foreground">{query ? `Nothing matches "${query}".` : emptyText}</p>
          ) : (
            <ul ref={listRef} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1">
              {shown.map((item, i) => {
                const idx = custom ? i + 1 : i;
                const taken = isTaken?.(item.name) ?? false;
                const selected = item.name === value;
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-index={idx}
                      disabled={taken}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => pick(item.name)}
                      title={item.comment || item.name}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-ui-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        idx === active ? 'bg-secondary/70' : ''
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

/** Pick or type a Unity Catalog catalog, then one of its schemas. */
export function CatalogSchemaPicker({ onAdd, existing, compact = false }: CatalogSchemaPickerProps) {
  const [catalogsWanted, setCatalogsWanted] = useState(false);
  const [catalog, setCatalog] = useState('');
  const [schema, setSchema] = useState('');
  const catalogs = useCatalogs(catalogsWanted);
  const schemas = useSchemas(catalog);
  const taken = new Set(existing.map(e => e.toLowerCase()));
  const pasteSource = (c: string, s: string) => { setCatalog(c); setSchema(s); };

  const add = () => {
    if (!catalog || !schema || taken.has(`${catalog}.${schema}`.toLowerCase())) return;
    onAdd(`${catalog}.${schema}`);
    setSchema('');
  };

  return (
    <div className="space-y-2">
      <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-start'}`}>
        <SearchSelect
          label="Catalog"
          value={catalog}
          placeholder="Choose or type a catalog"
          list={catalogs}
          emptyText="No catalogs the app can read."
          allowCustom
          onOpen={() => setCatalogsWanted(true)}
          onPasteSource={pasteSource}
          onPick={name => { if (name !== catalog) { setCatalog(name); setSchema(''); } }}
        />
        <SearchSelect
          label="Schema"
          value={schema}
          placeholder="Choose or type a schema"
          disabled={!catalog}
          disabledHint="Pick a catalog first"
          list={schemas}
          emptyText="No schemas you can read in this catalog."
          allowCustom
          isTaken={name => taken.has(`${catalog}.${name}`.toLowerCase())}
          onPasteSource={pasteSource}
          onPick={setSchema}
        />
        <button
          type="button"
          onClick={add}
          disabled={!catalog || !schema}
          className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${compact ? '' : 'sm:mt-[22px]'}`}
        >
          <Plus className="w-4 h-4" /> Add and scan
        </button>
      </div>
      <p className="text-ui-xs text-muted-foreground">Pick from the list, or type any catalog or schema name. Paste catalog.schema to fill both.</p>
    </div>
  );
}
