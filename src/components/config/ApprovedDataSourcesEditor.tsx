/**
 * Approved Data Sources Editor
 *
 * Custom editor for the `approved_data_sources` workshop parameter: the
 * certified Unity Catalog schemas offered on the Insights data step. Each row is
 * a catalog, a schema and a display label. Any change calls
 * `onChange(JSON.stringify(rows))`, which feeds the existing save/reset flow.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { sourcesApi } from '../insights/sources/sourcesApi';
import { invalidDataSourceRows, parseDataSources, type DataSourceRow } from './dataSourcesConfig';

type Check = { state: 'checking' } | { state: 'ok'; tables: number } | { state: 'error'; message: string };

interface ApprovedDataSourcesEditorProps {
  value: string;
  onChange: (next: string) => void;
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
  const update = (i: number, patch: Partial<DataSourceRow>) => emit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
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

  const input = 'px-2.5 py-1.5 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Catalog</span><span>Schema</span><span>Label shown to users</span><span className="w-[7.5rem]" />
      </div>
      {rows.map((r, i) => {
        const id = `${r.catalog}.${r.schema}`;
        const c = checks[id];
        return (
          <div key={i} className="space-y-1">
            <div className="grid sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-center">
              <input value={r.catalog} onChange={e => update(i, { catalog: e.target.value.trim() })} placeholder="samples" className={`${input} font-mono text-xs ${invalid.has(i) ? 'border-amber-500/60' : 'border-border'}`} />
              <input value={r.schema} onChange={e => update(i, { schema: e.target.value.trim() })} placeholder="wanderbricks" className={`${input} font-mono text-xs ${invalid.has(i) ? 'border-amber-500/60' : 'border-border'}`} />
              <input value={r.label} onChange={e => update(i, { label: e.target.value })} placeholder="Wanderbricks (sample)" className={`${input} border-border`} />
              <div className="flex items-center gap-1 w-[7.5rem]">
                <button
                  onClick={() => check(r)}
                  disabled={invalid.has(i) || c?.state === 'checking'}
                  title="Check the app can read this schema"
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  {c?.state === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Check
                </button>
                <button onClick={() => remove(i)} title="Remove" className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {invalid.has(i) && <p className="text-[11px] text-amber-500 pl-1">Use letters, numbers, _ or - for catalog and schema, and list each schema once.</p>}
            {c?.state === 'ok' && <p className="flex items-center gap-1 text-[11px] text-emerald-500 pl-1"><CheckCircle2 className="w-3 h-3" /> Readable · {c.tables} tables</p>}
            {c?.state === 'error' && <p className="flex items-center gap-1 text-[11px] text-red-400 pl-1"><XCircle className="w-3 h-3" /> {c.message}</p>}
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No approved sources. Users can still type a catalog.schema on the data step.</p>}
      <button onClick={add} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10">
        <Plus className="w-3.5 h-3.5" /> Add a source
      </button>
      <p className="text-[11px] text-muted-foreground">The app's service principal needs USE CATALOG, USE SCHEMA and SELECT (or BROWSE) on each schema.</p>
    </div>
  );
}
