import { useMemo, useState } from 'react';
import { ChevronDown, EyeOff, KeyRound, Link2 } from 'lucide-react';
import { KIND_LABEL } from './kinds';
import type { BlueprintDigest, BlueprintTable, TableKind } from './types';

function TableRow({ table, digest }: { table: BlueprintTable; digest: BlueprintDigest }) {
  const [open, setOpen] = useState(false);
  const sensitive = table.columns.filter(c => c.s).length;
  const label = (id: string) => digest.tables.find(t => t.id === id)?.label ?? id;
  return (
    <li className="rounded-xl border border-border bg-card">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-start gap-3 px-4 py-3 text-left">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 text-ui-md font-medium text-foreground">
            {table.label}
            <span className="font-mono text-[11px] text-muted-foreground font-normal truncate">{table.id}</span>
          </p>
          <p className="text-ui-sm text-muted-foreground line-clamp-1">{table.purpose}</p>
        </div>
        <span className="flex items-center gap-2 text-ui-xs text-muted-foreground shrink-0 pt-1">
          <span className="tabular-nums">{table.columns.length} cols</span>
          {sensitive > 0 && <span className="inline-flex items-center gap-0.5 text-amber-500"><EyeOff className="w-3 h-3" />{sensitive}</span>}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            {table.columns.slice(0, 48).map(c => (
              <span
                key={c.n}
                title={`${c.n} · ${c.t}${c.s ? ' · sensitive' : ''}`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-ui-xs ${
                  c.k === 'pk' ? 'bg-primary/10 text-primary font-medium' : c.s ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-secondary/60 text-foreground/80'
                }`}
              >
                {c.k && <KeyRound className="w-2.5 h-2.5" />}{c.s && !c.k && <EyeOff className="w-2.5 h-2.5" />}{c.l}
              </span>
            ))}
            {table.columns.length > 48 && <span className="text-ui-xs text-muted-foreground px-1">+{table.columns.length - 48} more</span>}
          </div>
          {table.linksTo.length > 0 && (
            <ul className="space-y-1">
              {table.linksTo.slice(0, 4).map(l => (
                <li key={`${l.to}-${l.via}`} className="flex items-start gap-2 text-ui-xs text-muted-foreground">
                  <Link2 className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                  <span><span className="text-foreground/85 font-medium">{label(l.to)}</span> via {l.via}{l.reason ? `: ${l.reason}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function TableCatalog({ digest, focus }: { digest: BlueprintDigest; focus: string[] }) {
  const [scope, setScope] = useState<'focus' | 'all'>(focus.length ? 'focus' : 'all');
  const groups = useMemo(() => {
    const tables = digest.tables.filter(t => scope === 'all' || focus.includes(t.area));
    return (['event', 'thing', 'link', 'lookup'] as TableKind[])
      .map(kind => ({ kind, tables: tables.filter(t => t.kind === kind) }))
      .filter(g => g.tables.length);
  }, [digest, focus, scope]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ui-sm text-muted-foreground">
          <KeyRound className="inline w-3.5 h-3.5 text-primary mr-1" />keys connect tables ·
          <EyeOff className="inline w-3.5 h-3.5 text-amber-500 mx-1" />sensitive fields are labelled
        </p>
        <div className="inline-flex p-1 rounded-xl bg-secondary/60 text-ui-sm shrink-0">
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
      {groups.map(g => (
        <section key={g.kind}>
          <p className="text-ui-sm font-semibold text-foreground">{KIND_LABEL[g.kind].label} <span className="font-normal text-muted-foreground">· {g.tables.length}</span></p>
          <p className="text-ui-xs text-muted-foreground mb-2">{KIND_LABEL[g.kind].hint}</p>
          <ul className="space-y-1.5">
            {g.tables.slice(0, 30).map(t => <TableRow key={t.id} table={t} digest={digest} />)}
          </ul>
          {g.tables.length > 30 && <p className="text-ui-xs text-muted-foreground mt-2">+{g.tables.length - 30} more {KIND_LABEL[g.kind].label.toLowerCase()}</p>}
        </section>
      ))}
    </div>
  );
}
