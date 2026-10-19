/**
 * Approved Data Sources Editor
 *
 * Custom editor for the `approved_data_sources` workshop parameter: the
 * certified Unity Catalog schemas offered on the Insights data step. Each row is
 * a catalog, a schema and a display label; catalog and schema are type-or-pick
 * fields listing what the app can read. Any change calls
 * `onChange(JSON.stringify(rows))`, which feeds the existing save/reset flow.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { sourcesApi, useCatalogs, useSchemas } from '../insights/sources/sourcesApi';
import { SearchSelect } from '../insights/sources/CatalogSchemaPicker';
import { invalidDataSourceRows, parseDataSources, type DataSourceRow } from './dataSourcesConfig';

type Check = { state: 'checking' } | { state: 'ok'; tables: number } | { state: 'error'; message: string };

const IDENT = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** "sales_analytics" -> "Sales Analytics" */
const humanize = (s: string) => s.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, ch => ch.toUpperCase());

interface ApprovedDataSourcesEditorProps {
  value: string;
  onChange: (next: string) => void;
}

interface SourceRowProps {
  row: DataSourceRow;
  invalid: boolean;
  check?: Check;
  /** catalog.schema ids used by the other rows. */
  others: Set<string>;
  onUpdate: (next: DataSourceRow) => void;
  onCheck: (row: DataSourceRow) => void;
  onRemove: () => void;
}

function SourceRow({ row, invalid, check, others, onUpdate, onCheck, onRemove }: SourceRowProps) {
  const [catalogsWanted, setCatalogsWanted] = useState(false);
  const catalogs = useCatalogs(catalogsWanted);
  const schemas = useSchemas(IDENT.test(row.catalog) ? row.catalog : '');
  const blank = !row.catalog && !row.schema;

  const set = (patch: Partial<DataSourceRow>) => {
    const next = { ...row, ...patch };
    if (!next.label.trim() && next.schema) next.label = humanize(next.schema);
    onUpdate(next);
    if (IDENT.test(next.catalog) && IDENT.test(next.schema)) onCheck(next);
  };

  return (
    <div className="space-y-1">
      <div className="grid sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-center">
        <SearchSelect
          label="Catalog"
          hideLabel
          dense
          allowCustom
          value={row.catalog}
          placeholder="Choose or type"
          list={catalogs}
          emptyText="No catalogs the app can read."
          invalid={invalid && !blank}
          onOpen={() => setCatalogsWanted(true)}
          onPasteSource={(catalog, schema) => set({ catalog, schema })}
          onPick={catalog => { if (catalog !== row.catalog) set({ catalog, schema: '' }); }}
        />
        <SearchSelect
          label="Schema"
          hideLabel
          dense
          allowCustom
          value={row.schema}
          placeholder="Choose or type"
          disabled={!row.catalog}
          disabledHint="Pick a catalog first"
          list={schemas}
          emptyText="No schemas you can read in this catalog."
          invalid={invalid && !blank}
          isTaken={schema => others.has(`${row.catalog}.${schema}`.toLowerCase())}
          onPasteSource={(catalog, schema) => set({ catalog, schema })}
          onPick={schema => set({ schema })}
        />
        <input
          value={row.label}
          onChange={e => onUpdate({ ...row, label: e.target.value })}
          placeholder={row.schema ? humanize(row.schema) : 'Label shown to users'}
          aria-label="Label shown to users"
          className="h-8 px-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex items-center gap-1 w-[7.5rem]">
          <button
            onClick={() => onCheck(row)}
            disabled={invalid || check?.state === 'checking'}
            title="Check the app can read this schema"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"
          >
            {check?.state === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Check
          </button>
          <button onClick={onRemove} title="Remove" className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {invalid && !blank && <p className="text-[11px] text-amber-500 pl-1">Use letters, numbers, _ or - for catalog and schema, and list each schema once.</p>}
      {check?.state === 'ok' && <p className="flex items-center gap-1 text-[11px] text-emerald-500 pl-1"><CheckCircle2 className="w-3 h-3" /> Readable · {check.tables} tables</p>}
      {check?.state === 'error' && <p className="flex items-center gap-1 text-[11px] text-red-400 pl-1"><XCircle className="w-3 h-3" /> {check.message}</p>}
    </div>
  );
}

export function ApprovedDataSourcesEditor({ value, onChange }: ApprovedDataSourcesEditorProps) {
  const rows = useMemo(() => parseDataSources(value), [value]);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  if (rows === null) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-amber-500">The saved value is not a valid list. Start over to fix it.</p>
        <button onClick={() => onChange('[]')} className="px-3 py-1.5 bg-secondary rounded-md text-xs font-medium">Start over</button>
      </div>
    );
  }

  const invalid = new Set(invalidDataSourceRows(rows));
  const emit = (next: DataSourceRow[]) => onChange(JSON.stringify(next));
  const remove = (i: number) => emit(rows.filter((_, j) => j !== i));
  const add = () => emit([...rows, { catalog: '', schema: '', label: '' }]);

  const check = async (r: DataSourceRow) => {
    const id = `${r.catalog}.${r.schema}`;
    setChecks(c => ({ ...c, [id]: { state: 'checking' } }));
    try {
      const res = await sourcesApi.check(id);
      setChecks(c => ({ ...c, [id]: res.readable ? { state: 'ok', tables: res.tableCount } : { state: 'error', message: res.error || 'The app cannot read this schema.' } }));
    } catch (e) {
      setChecks(c => ({ ...c, [id]: { state: 'error', message: e instanceof Error ? e.message : 'Check failed' } }));
    }
  };

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Catalog</span><span>Schema</span><span>Label shown to users</span><span className="w-[7.5rem]" />
      </div>
      {rows.map((r, i) => (
        <SourceRow
          key={i}
          row={r}
          invalid={invalid.has(i)}
          check={checks[`${r.catalog}.${r.schema}`]}
          others={new Set(rows.filter((_, j) => j !== i).map(o => `${o.catalog}.${o.schema}`.toLowerCase()))}
          onUpdate={next => emit(rows.map((x, j) => (j === i ? next : x)))}
          onCheck={check}
          onRemove={() => remove(i)}
        />
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No approved sources. Users can still add a catalog and schema on the data step.</p>}
      <button onClick={add} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10">
        <Plus className="w-3.5 h-3.5" /> Add a source
      </button>
      <p className="text-[11px] text-muted-foreground">
        Pick a catalog and schema from the lists, or type any name. Paste catalog.schema to fill both. The app's service principal needs USE CATALOG, USE SCHEMA and SELECT (or BROWSE) on each schema.
      </p>
    </div>
  );
}
