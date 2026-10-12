import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BlueprintDigest } from './types';

interface DataMapProps {
  digest: BlueprintDigest;
  focus: string[];
  matched: string[];
  selected: string | null;
  onSelect: (area: string) => void;
}

const W = 640;
const H = 460;

/** Business areas on a ring, grouped by division; threads are foreign-key connections. */
export function DataMap({ digest, focus, matched, selected, onSelect }: DataMapProps) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const areas = [...digest.areas].sort((a, b) => a.division.localeCompare(b.division) || b.tableIds.length - a.tableIds.length);
    const maxTables = Math.max(...areas.map(a => a.tableIds.length), 1);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const nodes = areas.map((a, i) => {
      const angle = (i / areas.length) * Math.PI * 2 - Math.PI / 2;
      return {
        area: a,
        angle,
        x: cx + Math.cos(angle) * R * 1.18,
        y: cy + Math.sin(angle) * R,
        r: 9 + Math.sqrt(a.tableIds.length / maxTables) * 17,
      };
    });
    const byName = new Map(nodes.map(n => [n.area.name, n]));
    const maxN = Math.max(...digest.links.map(l => l.n), 1);
    const edges = digest.links
      .filter(l => byName.has(l.a) && byName.has(l.b))
      .slice(0, 60)
      .map(l => ({ ...l, from: byName.get(l.a)!, to: byName.get(l.b)!, w: l.n / maxN }));
    return { nodes, edges, cx, cy };
  }, [digest]);

  const active = hover ?? selected;
  const neighbourSet = useMemo(() => {
    if (!active) return null;
    const s = new Set<string>([active]);
    for (const e of layout.edges) {
      if (e.a === active) s.add(e.b);
      if (e.b === active) s.add(e.a);
    }
    return s;
  }, [active, layout.edges]);

  const focusSet = new Set(focus);
  const matchedSet = new Set(matched);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={`Map of the ${digest.label} data model`}>
      {layout.edges.map((e, i) => {
        const lit = active ? e.a === active || e.b === active : focusSet.has(e.a) && focusSet.has(e.b);
        const mx = (e.from.x + e.to.x) / 2, my = (e.from.y + e.to.y) / 2;
        const qx = mx + (layout.cx - mx) * 0.55, qy = my + (layout.cy - my) * 0.55;
        return (
          <motion.path
            key={`${e.a}-${e.b}`}
            d={`M${e.from.x},${e.from.y} Q${qx},${qy} ${e.to.x},${e.to.y}`}
            fill="none"
            className={lit ? 'stroke-primary' : 'stroke-foreground'}
            strokeWidth={0.6 + e.w * (lit ? 3.4 : 2.2)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: lit ? 0.75 : active ? 0.04 : 0.06 + e.w * 0.12 }}
            transition={{ pathLength: { duration: 1, delay: 0.2 + i * 0.01 }, opacity: { duration: 0.25 } }}
          />
        );
      })}
      {layout.nodes.map((n, i) => {
        const name = n.area.name;
        const inFocus = focusSet.has(name);
        const dim = neighbourSet ? !neighbourSet.has(name) : false;
        const right = Math.cos(n.angle) >= -0.05;
        const labelX = n.x + Math.cos(n.angle) * (n.r + 8);
        const labelY = n.y + Math.sin(n.angle) * (n.r + 8);
        return (
          <motion.g
            key={name}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: dim ? 0.28 : 1, scale: 1 }}
            transition={{ duration: 0.35, delay: i * 0.025 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            className="cursor-pointer outline-none"
            onMouseEnter={() => setHover(name)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(name)}
            role="button"
            tabIndex={0}
            aria-label={`${n.area.label}: ${n.area.tableIds.length} tables`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(name); } }}
          >
            {selected === name && <circle cx={n.x} cy={n.y} r={n.r + 6} className="fill-none stroke-primary/40" strokeWidth={2} strokeDasharray="3 3" />}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              className={inFocus ? 'fill-primary stroke-primary' : 'fill-card stroke-border'}
              strokeWidth={1.5}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle" className={`text-[11px] font-semibold tabular-nums pointer-events-none ${inFocus ? 'fill-primary-foreground' : 'fill-muted-foreground'}`}>
              {n.area.tableIds.length}
            </text>
            {matchedSet.has(name) && (
              <circle cx={n.x + n.r * 0.72} cy={n.y - n.r * 0.72} r={4.5} className="fill-amber-400 stroke-card" strokeWidth={2} />
            )}
            <text
              x={labelX}
              y={labelY + 4}
              textAnchor={Math.abs(Math.cos(n.angle)) < 0.2 ? 'middle' : right ? 'start' : 'end'}
              className={`text-[12px] pointer-events-none ${inFocus ? 'fill-foreground font-semibold' : 'fill-muted-foreground'}`}
            >
              {n.area.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
