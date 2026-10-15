import { motion } from 'framer-motion';

/** A tiny, decorative glimpse of a data model: areas as dots, connections as threads. */
export function MiniConstellation({ nodes = 9, active = false, size = 44 }: { nodes?: number; active?: boolean; size?: number }) {
  const n = Math.max(5, Math.min(12, nodes));
  const c = size / 2;
  const r = size * 0.36;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const wobble = i % 2 === 0 ? 1 : 0.78;
    return { x: c + Math.cos(a) * r * wobble, y: c + Math.sin(a) * r * wobble };
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    edges.push([i, (i + 2) % n]);
    if (i % 3 === 0) edges.push([i, (i + Math.floor(n / 2)) % n]);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y}
          className={active ? 'stroke-primary-foreground/50' : 'stroke-primary/35'}
          strokeWidth={0.8}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: i * 0.03 }}
        />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i % 3 === 0 ? 2.6 : 1.8} className={active ? 'fill-primary-foreground' : 'fill-primary'} />
      ))}
    </svg>
  );
}
