import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, KeyRound, Link2, Maximize2, Minus, Plus, ShieldAlert, X } from 'lucide-react';
import { KIND_LABEL } from './kinds';
import type { BlueprintDigest, BlueprintTable, TableKind } from './types';

const KIND_ORDER: TableKind[] = ['lookup', 'thing', 'event', 'link'];
const KIND_COLOR: Record<TableKind, { bar: string; dot: string }> = {
  thing: { bar: 'fill-primary', dot: 'bg-primary' },
  event: { bar: 'fill-amber-400', dot: 'bg-amber-400' },
  lookup: { bar: 'fill-slate-400', dot: 'bg-slate-400' },
  link: { bar: 'fill-violet-400', dot: 'bg-violet-400' },
};

const BOX_W = 210;
const ROW_H = 17;
const HEAD_H = 30;
const COL_GAP = 90;
const ROW_GAP = 22;
const PAD = 24;
const MAX_FK_ROWS = 4;
const GHOST_W = 170;
const GHOST_H = 40;

interface Row { name: string; label: string; key: 'pk' | 'fk' | null; sensitive: boolean; to?: string }
interface Box { t: BlueprintTable; x: number; y: number; h: number; rows: Row[]; more: number }
interface Ghost { area: string; label: string; count: number; x: number; y: number; from: Set<string> }
interface Edge { from: string; to: string; y1: number; x1: number; x2: number; y2: number; via: string }

function rowsFor(t: BlueprintTable): { rows: Row[]; more: number } {
  const linked = new Map(t.linksTo.map(l => [l.via, l.to]));
  const pk = t.columns.filter(c => c.k === 'pk');
  const fk = t.columns.filter(c => c.k === 'fk' && linked.has(c.l)).slice(0, MAX_FK_ROWS);
  const rows: Row[] = [...pk, ...fk].map(c => ({ name: c.n, label: c.l, key: c.k ?? null, sensitive: !!c.s, to: linked.get(c.l) }));
  if (rows.length === 0) {
    rows.push(...t.columns.slice(0, 2).map(c => ({ name: c.n, label: c.l, key: null, sensitive: !!c.s })));
  }
  return { rows, more: Math.max(0, t.columns.length - rows.length) };
}

function layout(digest: BlueprintDigest, area: string) {
  const tables = digest.tables.filter(t => t.area === area);
  const ids = new Set(tables.map(t => t.id));
  const degree = (t: BlueprintTable) => t.linksTo.filter(l => ids.has(l.to)).length
    + tables.filter(o => o.linksTo.some(l => l.to === t.id)).length;
  const columns = KIND_ORDER.map(k => tables.filter(t => t.kind === k).sort((a, b) => degree(b) - degree(a))).filter(c => c.length);

  const boxes = new Map<string, Box>();
  let height = 0;
  columns.forEach((col, ci) => {
    let y = PAD + 18;
    for (const t of col) {
      const { rows, more } = rowsFor(t);
      const h = HEAD_H + rows.length * ROW_H + (more ? ROW_H : 0) + 8;
      boxes.set(t.id, { t, x: PAD + ci * (BOX_W + COL_GAP), y, h, rows, more });
      y += h + ROW_GAP;
    }
    height = Math.max(height, y);
  });

  const areaLabel = new Map(digest.areas.map(a => [a.name, a.label]));
  const ghostMap = new Map<string, Ghost>();
  for (const t of tables) {
    for (const l of t.linksTo) {
      if (ids.has(l.to)) continue;
      const other = l.to.split('.')[0];
      const g = ghostMap.get(other) ?? { area: other, label: areaLabel.get(other) ?? other, count: 0, x: 0, y: 0, from: new Set<string>() };
      g.count += 1;
      g.from.add(t.id);
      ghostMap.set(other, g);
    }
  }
  const ghosts = Array.from(ghostMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  const ghostX = PAD + columns.length * (BOX_W + COL_GAP);
  ghosts.forEach((g, i) => { g.x = ghostX; g.y = PAD + 18 + i * (GHOST_H + 12); });
  height = Math.max(height, PAD + 18 + ghosts.length * (GHOST_H + 12));

  const edges: Edge[] = [];
  for (const b of boxes.values()) {
    b.rows.forEach((r, ri) => {
      if (!r.to) return;
      const target = boxes.get(r.to);
      if (!target || target === b) return;
      const rowY = b.y + HEAD_H + ri * ROW_H + ROW_H / 2;
      const rightward = target.x >= b.x;
      edges.push({
        from: b.t.id,
        to: target.t.id,
        via: r.label,
        x1: rightward ? b.x + BOX_W : b.x,
        y1: rowY,
        x2: rightward ? (target.x === b.x ? target.x + BOX_W : target.x) : target.x + BOX_W,
        y2: target.y + HEAD_H / 2,
      });
    });
  }

  const width = ghostX + (ghosts.length ? GHOST_W : 0) + PAD;
  return { boxes, ghosts, edges, width, height: height + PAD, count: tables.length };
}

function edgePath(e: Edge): string {
  const sameCol = Math.abs(e.x1 - e.x2) < 1;
  if (sameCol) {
    const bulge = e.x1 + 46;
    return `M${e.x1},${e.y1} C${bulge},${e.y1} ${bulge},${e.y2} ${e.x2},${e.y2}`;
  }
  const mid = (e.x1 + e.x2) / 2;
  return `M${e.x1},${e.y1} C${mid},${e.y1} ${mid},${e.y2} ${e.x2},${e.y2}`;
}

export function ErDiagram({ digest, focus, initialArea }: { digest: BlueprintDigest; focus: string[]; initialArea?: string | null }) {
  const ordered = useMemo(() => [...digest.areas].sort((a, b) => Number(focus.includes(b.name)) - Number(focus.includes(a.name))), [digest, focus]);
  const [area, setArea] = useState<string>(initialArea ?? ordered[0]?.name ?? '');
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const g = useMemo(() => layout(digest, area), [digest, area]);

  const active = hover ?? picked;
  const neighbours = useMemo(() => {
    if (!active) return null;
    const s = new Set([active]);
    g.edges.forEach(e => { if (e.from === active) s.add(e.to); if (e.to === active) s.add(e.from); });
    return s;
  }, [active, g]);
  const pickedTable = picked ? digest.tables.find(t => t.id === picked) ?? null : null;
  const areaInfo = digest.areas.find(a => a.name === area);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ordered.map(a => (
          <button
            key={a.name}
            onClick={() => { setArea(a.name); setPicked(null); }}
            className={`h-8 px-3 rounded-full text-ui-sm font-medium border transition-all inline-flex items-center gap-1.5 ${
              a.name === area ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {focus.includes(a.name) && <span className={`w-1.5 h-1.5 rounded-full ${a.name === area ? 'bg-background' : 'bg-primary'}`} />}
            {a.label}
            <span className="tabular-nums opacity-60 text-ui-xs">{a.tableIds.length}</span>
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/70 bg-secondary/20">
          <p className="text-ui-sm text-foreground">
            <span className="font-semibold">{areaInfo?.label}</span>
            <span className="text-muted-foreground"> · {g.count} tables · {g.edges.length} links inside · {g.ghosts.reduce((n, x) => n + x.count, 0)} to other areas</span>
          </p>
          <div className="flex items-center gap-1">
            <button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><Minus className="w-4 h-4" /></button>
            <span className="w-10 text-center text-ui-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><Plus className="w-4 h-4" /></button>
            <button aria-label="Fit" onClick={() => setZoom(0.9)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-auto max-h-[620px]" onClick={() => setPicked(null)}>
          <svg
            width={g.width * zoom}
            height={g.height * zoom}
            viewBox={`0 0 ${g.width} ${g.height}`}
            className="block select-none"
            role="img"
            aria-label={`Diagram of the ${areaInfo?.label} area`}
          >
            <defs>
              <marker id="er-many" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                <path d="M0,6 L11,6 M11,1 L4,6 L11,11" fill="none" className="stroke-muted-foreground" strokeWidth="1.2" />
              </marker>
            </defs>

            {KIND_ORDER.filter(k => Array.from(g.boxes.values()).some(b => b.t.kind === k)).map((k, i) => (
              <text key={k} x={PAD + i * (BOX_W + COL_GAP)} y={PAD + 4} className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-wider">{KIND_LABEL[k].label}</text>
            ))}
            {g.ghosts.length > 0 && (
              <text x={g.ghosts[0].x} y={PAD + 4} className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Connects to</text>
            )}

            {g.edges.map((e, i) => {
              const on = !active || e.from === active || e.to === active;
              return (
                <path
                  key={i}
                  d={edgePath(e)}
                  fill="none"
                  markerStart="url(#er-many)"
                  className={on ? (active ? 'stroke-primary' : 'stroke-muted-foreground/50') : 'stroke-border'}
                  strokeWidth={on && active ? 1.8 : 1.1}
                  opacity={on ? 1 : 0.35}
                />
              );
            })}

            {active && g.ghosts.filter(gh => gh.from.has(active)).map(gh => {
              const b = g.boxes.get(active)!;
              const x1 = b.x + BOX_W, y1 = b.y + HEAD_H / 2, x2 = gh.x, y2 = gh.y + GHOST_H / 2;
              const mid = (x1 + x2) / 2;
              return <path key={gh.area} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} fill="none" className="stroke-primary/60" strokeDasharray="4 4" strokeWidth={1.2} />;
            })}

            {Array.from(g.boxes.values()).map(b => {
              const dim = neighbours && !neighbours.has(b.t.id);
              const isActive = active === b.t.id;
              return (
                <g
                  key={b.t.id}
                  transform={`translate(${b.x},${b.y})`}
                  opacity={dim ? 0.35 : 1}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setHover(b.t.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={ev => { ev.stopPropagation(); setPicked(b.t.id); }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.t.label} table`}
                  onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPicked(b.t.id); } }}
                  style={{ transition: 'opacity 150ms' }}
                >
                  <rect width={BOX_W} height={b.h} rx={10} className={`fill-card ${isActive ? 'stroke-primary' : 'stroke-border'}`} strokeWidth={isActive ? 2 : 1} />
                  <rect width={4} height={b.h - 12} x={0} y={6} rx={2} className={KIND_COLOR[b.t.kind].bar} />
                  <text x={14} y={19} className="fill-foreground text-[12.5px] font-semibold">{truncate(b.t.label, 26)}</text>
                  <line x1={8} x2={BOX_W - 8} y1={HEAD_H - 2} y2={HEAD_H - 2} className="stroke-border" />
                  {b.rows.map((r, ri) => (
                    <g key={r.name} transform={`translate(0,${HEAD_H + ri * ROW_H})`}>
                      <text x={14} y={12} className={`text-[10.5px] ${r.key === 'pk' ? 'fill-amber-500 font-semibold' : r.key === 'fk' ? 'fill-primary' : 'fill-muted-foreground'}`}>
                        {r.key === 'pk' ? 'PK' : r.key === 'fk' ? 'FK' : '  '}
                      </text>
                      <text x={34} y={12} className="fill-foreground/85 text-[11px]">{truncate(r.label, r.to ? 18 : 24)}</text>
                      {r.to && <text x={BOX_W - 10} y={12} textAnchor="end" className="fill-muted-foreground text-[10px]">{truncate(r.to.split('.').pop() ?? '', 10)}</text>}
                    </g>
                  ))}
                  {b.more > 0 && (
                    <text x={34} y={HEAD_H + b.rows.length * ROW_H + 12} className="fill-muted-foreground/70 text-[10.5px]">+{b.more} more columns</text>
                  )}
                </g>
              );
            })}

            {g.ghosts.map(gh => {
              const lit = active && gh.from.has(active);
              return (
                <g
                  key={gh.area}
                  transform={`translate(${gh.x},${gh.y})`}
                  className="cursor-pointer"
                  onClick={ev => { ev.stopPropagation(); setArea(gh.area); setPicked(null); }}
                  opacity={active && !lit ? 0.4 : 1}
                >
                  <rect width={GHOST_W} height={GHOST_H} rx={GHOST_H / 2} className={`fill-secondary/40 ${lit ? 'stroke-primary' : 'stroke-border'}`} strokeDasharray="4 3" />
                  <text x={16} y={17} className="fill-foreground text-[11.5px] font-medium">{truncate(gh.label, 20)}</text>
                  <text x={16} y={31} className="fill-muted-foreground text-[10px]">{gh.count} link{gh.count === 1 ? '' : 's'} · open</text>
                </g>
              );
            })}
          </svg>
        </div>

        <AnimatePresence>
          {pickedTable && (
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="absolute top-12 right-3 bottom-3 w-[min(340px,calc(100%-24px))] overflow-y-auto rounded-2xl border border-border bg-card/98 backdrop-blur shadow-xl p-4 space-y-3"
              onClick={ev => ev.stopPropagation()}
            >
              <TableDetail table={pickedTable} digest={digest} onClose={() => setPicked(null)} onJump={id => { const t = digest.tables.find(x => x.id === id); if (t) { setArea(t.area); setPicked(id); } }} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ui-xs text-muted-foreground px-1">
        {KIND_ORDER.map(k => (
          <span key={k} className="inline-flex items-center gap-1.5" title={KIND_LABEL[k].hint}><span className={`w-2.5 h-2.5 rounded-sm ${KIND_COLOR[k].dot}`} /> {KIND_LABEL[k].label}</span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="text-amber-500 font-semibold">PK</span> identifies a row</span>
        <span className="inline-flex items-center gap-1"><span className="text-primary">FK</span> points to another table</span>
        <span>Hover a table to trace its connections. Click for details.</span>
      </div>
    </div>
  );
}

function TableDetail({ table, digest, onClose, onJump }: { table: BlueprintTable; digest: BlueprintDigest; onClose: () => void; onJump: (id: string) => void }) {
  const byId = new Map(digest.tables.map(t => [t.id, t]));
  const incoming = digest.tables.filter(t => t.linksTo.some(l => l.to === table.id));
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{KIND_LABEL[table.kind].label.replace(/s$/, '')} · {table.area}</p>
          <p className="text-ui-lg font-semibold text-foreground leading-snug">{table.label}</p>
          <p className="font-mono text-ui-xs text-muted-foreground truncate">{digest.catalog}.{table.id}</p>
        </div>
        <button onClick={onClose} aria-label="Close details" className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="w-4 h-4" /></button>
      </div>
      {table.purpose && <p className="text-ui-sm text-foreground/85 leading-relaxed">{table.purpose}</p>}

      <div className="space-y-1">
        <p className="text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns ({table.columns.length})</p>
        <ul className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
          {table.columns.slice(0, 40).map(c => (
            <li key={c.n} className="flex items-center gap-1.5 text-ui-xs">
              {c.k === 'pk' ? <KeyRound className="w-3 h-3 text-amber-500 shrink-0" /> : c.k === 'fk' ? <Link2 className="w-3 h-3 text-primary shrink-0" /> : <span className="w-3 shrink-0" />}
              <span className="text-foreground/90 truncate">{c.l}</span>
              {c.s && <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" aria-label="Sensitive" />}
              <span className="ml-auto text-muted-foreground/70 font-mono text-[10px]">{c.t}</span>
            </li>
          ))}
        </ul>
      </div>

      {table.linksTo.length > 0 && (
        <div className="space-y-1">
          <p className="text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground">Points to</p>
          {table.linksTo.slice(0, 8).map(l => (
            <button key={`${l.to}-${l.via}`} onClick={() => onJump(l.to)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-secondary/60 transition-colors">
              <span className="flex items-center gap-1 text-ui-xs font-medium text-foreground">{byId.get(l.to)?.label ?? l.to} <ArrowRight className="w-3 h-3 text-muted-foreground" /> <span className="text-muted-foreground font-normal">via {l.via}</span></span>
              {l.reason && <span className="block text-[11px] text-muted-foreground line-clamp-2">{l.reason}</span>}
            </button>
          ))}
        </div>
      )}
      {incoming.length > 0 && (
        <div className="space-y-1">
          <p className="text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground">Used by</p>
          <div className="flex flex-wrap gap-1">
            {incoming.slice(0, 12).map(t => (
              <button key={t.id} onClick={() => onJump(t.id)} className="h-6 px-2 rounded-md border border-border text-[11px] text-foreground/85 hover:border-foreground/30">{t.label}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}\u2026` : s;
}
