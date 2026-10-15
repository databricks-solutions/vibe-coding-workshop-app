import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Gauge, Link2, Network, Plus, ShieldCheck, X } from 'lucide-react';
import { KIND_LABEL } from './kinds';
import { neighbours } from './match';
import type { BlueprintDigest, TableKind } from './types';

interface AreaXrayProps {
  digest: BlueprintDigest;
  area: string;
  inFocus: boolean;
  onToggleFocus: (area: string) => void;
  onSelect: (area: string) => void;
  onClose: () => void;
  onOpenDiagram?: (area: string) => void;
}

export function AreaXray({ digest, area: name, inFocus, onToggleFocus, onSelect, onClose, onOpenDiagram }: AreaXrayProps) {
  const area = digest.areas.find(a => a.name === name);
  const [showAll, setShowAll] = useState(false);

  const { groups, kpis, connections } = useMemo(() => {
    const tables = digest.tables.filter(t => t.area === name);
    const g = (['event', 'thing', 'link', 'lookup'] as TableKind[])
      .map(kind => ({ kind, tables: tables.filter(t => t.kind === kind) }))
      .filter(x => x.tables.length);
    const k = digest.kpis.filter(x => x.area === name);
    const conns = neighbours(name, digest).slice(0, 4).map(c => {
      const reason = tables.flatMap(t => t.linksTo).find(l => l.to.startsWith(`${c.area}.`))?.reason ?? '';
      return { ...c, label: digest.areas.find(a => a.name === c.area)?.label ?? c.area, reason };
    });
    return { groups: g, kpis: k, connections: conns };
  }, [digest, name]);

  if (!area) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <p className="text-ui-xs font-medium uppercase tracking-wider text-muted-foreground">{area.division || 'Business area'}</p>
          <h3 className="text-ui-xl font-semibold text-foreground">{area.label}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 space-y-4 pb-4">
        <p className={`text-ui-sm text-muted-foreground leading-relaxed ${showAll ? '' : 'line-clamp-3'}`}>{area.description}</p>
        {area.description.length > 180 && (
          <button onClick={() => setShowAll(s => !s)} className="-mt-2 text-ui-xs font-medium text-muted-foreground hover:text-foreground">
            {showAll ? 'Less' : 'More'}
          </button>
        )}

        <button
          onClick={() => onToggleFocus(name)}
          className={`w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-ui-sm font-semibold transition-all ${
            inFocus ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          {inFocus ? <><Check className="w-4 h-4" strokeWidth={3} /> In your Genie</> : <><Plus className="w-4 h-4" /> Include in your Genie</>}
        </button>
        {onOpenDiagram && (
          <button
            onClick={() => onOpenDiagram(name)}
            className="w-full inline-flex items-center justify-center gap-2 h-9 -mt-2 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Network className="w-4 h-4 text-primary" /> See how its tables connect
          </button>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: area.tableIds.length, l: 'tables' },
            { v: kpis.length, l: 'KPI sets' },
            { v: area.sensitiveCount, l: 'sensitive' },
          ].map(s => (
            <div key={s.l} className="rounded-xl bg-secondary/40 py-2">
              <p className="text-ui-lg font-semibold tabular-nums text-foreground">{s.v}</p>
              <p className="text-ui-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>

        {area.subdomains.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {area.subdomains.map(s => <span key={s} className="px-2 py-0.5 rounded-full border border-border text-ui-xs text-foreground/80">{s}</span>)}
          </div>
        )}

        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.kind}>
              <p className="text-ui-xs font-semibold text-foreground/90" title={KIND_LABEL[g.kind].hint}>
                {KIND_LABEL[g.kind].label} <span className="font-normal text-muted-foreground">· {g.tables.length}</span>
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {g.tables.map(t => (
                  <span key={t.id} title={t.purpose} className="px-1.5 py-0.5 rounded-md bg-secondary/60 text-ui-xs text-foreground/85">{t.label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {kpis.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-ui-xs font-semibold text-foreground/90"><Gauge className="w-3.5 h-3.5 text-primary" /> Ready-made KPIs</p>
            <p className="text-ui-xs text-muted-foreground mt-1 leading-relaxed">
              {kpis.slice(0, 6).map(k => k.measures[0]?.label).filter(Boolean).join(' · ')}
              {kpis.reduce((n, k) => n + k.measures.length, 0) > 6 && ' and more'}
            </p>
          </div>
        )}

        {connections.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-ui-xs font-semibold text-foreground/90"><Link2 className="w-3.5 h-3.5 text-primary" /> Connects to</p>
            <ul className="mt-1.5 space-y-1.5">
              {connections.map(c => (
                <li key={c.area}>
                  <button onClick={() => onSelect(c.area)} className="group w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/50">
                    <span className="flex items-center justify-between text-ui-sm">
                      <span className="font-medium text-foreground group-hover:text-primary">{c.label}</span>
                      <span className="text-ui-xs text-muted-foreground tabular-nums">{c.n} links</span>
                    </span>
                    {c.reason && <span className="block text-ui-xs text-muted-foreground line-clamp-2 mt-0.5">{c.reason}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {area.standards.length > 0 && (
          <p className="flex items-start gap-1.5 text-ui-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 mt-px text-emerald-500 shrink-0" /> Aligned to {area.standards.join(', ')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 border-t border-border/70 bg-secondary/20 text-ui-xs">
        {[
          { href: area.schemaUrl, label: 'Table definitions' },
          { href: area.metricsUrl, label: 'KPI definitions' },
          { href: area.readmeUrl, label: 'Docs' },
        ].filter(l => l.href).map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
            {l.label} <ArrowUpRight className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}
