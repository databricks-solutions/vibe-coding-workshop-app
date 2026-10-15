import { motion, useReducedMotion } from 'framer-motion';
import type { StepKey } from '../engine/types';

const reveal = (reduce: boolean | null, delay: number, y = 5) => ({
  initial: reduce ? false : { opacity: 0, y, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.45, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
});

const draw = (reduce: boolean | null, delay: number) => ({
  initial: reduce ? false : { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { duration: 0.7, delay: reduce ? 0 : delay, ease: 'easeOut' as const },
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-56 h-44 rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-primary/[0.03] shadow-sm overflow-hidden">
      <svg viewBox="0 0 240 176" className="w-full h-full" aria-hidden>
        <circle cx="205" cy="25" r="36" className="fill-primary/[0.04]" />
        <circle cx="28" cy="150" r="48" className="fill-primary/[0.035]" />
        {children}
      </svg>
    </div>
  );
}

function SparkArt({ reduce }: { reduce: boolean | null }) {
  const bits = [{ x: 52, y: 45 }, { x: 187, y: 45 }, { x: 45, y: 125 }, { x: 194, y: 128 }];
  return (
    <Frame>
      {bits.map((p, i) => (
        <motion.g key={i} {...reveal(reduce, 0.12 + i * 0.1)}>
          <circle cx={p.x} cy={p.y} r="8" className="fill-card stroke-primary/30" />
          <path d={`M ${p.x + (p.x < 120 ? 9 : -9)} ${p.y} Q 120 88 111 88`} className="fill-none stroke-primary/20" strokeWidth="2" strokeDasharray="3 4" />
        </motion.g>
      ))}
      <motion.circle cx="120" cy="88" r="31" className="fill-primary/10 stroke-primary/30" strokeWidth="2" {...reveal(reduce, 0.55)} />
      <motion.path d="M120 69 l4.5 10 10.5 4.5 -10.5 4.5 -4.5 10 -4.5 -10 -10.5 -4.5 10.5 -4.5 Z" className="fill-primary" {...reveal(reduce, 0.75)} />
      <motion.rect x="83" y="132" width="74" height="7" rx="3.5" className="fill-primary/25" {...reveal(reduce, 0.9)} />
      <motion.rect x="98" y="145" width="44" height="5" rx="2.5" className="fill-primary/12" {...reveal(reduce, 1)} />
    </Frame>
  );
}

function MapArt({ reduce }: { reduce: boolean | null }) {
  const routes = [
    { d: 'M120 87 C94 78 82 54 55 47', x: 51, y: 45 },
    { d: 'M120 87 C145 76 157 50 187 47', x: 190, y: 45 },
    { d: 'M120 87 C147 101 157 129 190 135', x: 193, y: 136 },
    { d: 'M120 87 C92 101 79 131 48 137', x: 45, y: 138 },
  ];
  return (
    <Frame>
      {routes.map((r, i) => (
        <motion.path key={r.d} d={r.d} className="fill-none stroke-primary/35" strokeWidth="2.2" strokeLinecap="round" {...draw(reduce, 0.12 + i * 0.12)} />
      ))}
      {routes.map((r, i) => (
        <motion.g key={r.x} {...reveal(reduce, 0.55 + i * 0.1)}>
          <circle cx={r.x} cy={r.y} r={i === 1 ? 17 : 14} className={i === 1 ? 'fill-primary/15 stroke-primary/60' : 'fill-card stroke-primary/30'} strokeWidth="2" />
          <circle cx={r.x} cy={r.y} r="4" className={i === 1 ? 'fill-primary' : 'fill-primary/45'} />
        </motion.g>
      ))}
      <motion.circle cx="120" cy="87" r="24" className="fill-card stroke-primary/40" strokeWidth="2" {...reveal(reduce, 0.2)} />
      <motion.path d="M120 72 l3.8 8.5 9 3.8 -9 3.8 -3.8 8.5 -3.8 -8.5 -9 -3.8 9 -3.8 Z" className="fill-primary" {...reveal(reduce, 0.35)} />
      <motion.g {...reveal(reduce, 1.05, -8)}>
        <path d="M190 29 c-7 0 -12 5 -12 12 0 9 12 19 12 19s12-10 12-19c0-7-5-12-12-12Z" className="fill-primary" />
        <circle cx="190" cy="41" r="4" className="fill-primary-foreground" />
      </motion.g>
    </Frame>
  );
}

function QuestionsArt({ reduce }: { reduce: boolean | null }) {
  return (
    <Frame>
      <motion.g {...reveal(reduce, 0.1)}>
        <circle cx="46" cy="73" r="17" className="fill-primary/12 stroke-primary/30" />
        <path d="M24 125c2-22 12-34 22-34s20 12 22 34" className="fill-primary/10 stroke-primary/25" strokeWidth="2" />
      </motion.g>
      <motion.g {...reveal(reduce, 0.2)}>
        <circle cx="194" cy="73" r="17" className="fill-primary/12 stroke-primary/30" />
        <path d="M172 125c2-22 12-34 22-34s20 12 22 34" className="fill-primary/10 stroke-primary/25" strokeWidth="2" />
      </motion.g>
      <motion.g {...reveal(reduce, 0.35, 8)}>
        <rect x="81" y="25" width="78" height="50" rx="16" className="fill-card stroke-primary/35" strokeWidth="2" />
        <path d="M105 74l-8 11 20-11" className="fill-card stroke-primary/35" strokeWidth="2" strokeLinejoin="round" />
        <text x="120" y="59" textAnchor="middle" className="fill-primary text-[25px] font-semibold">?</text>
      </motion.g>
      {[{ y: 101, w: 82 }, { y: 121, w: 99 }, { y: 141, w: 70 }].map((c, i) => (
        <motion.g key={c.y} {...reveal(reduce, 0.62 + i * 0.14)}>
          <rect x="80" y={c.y} width={c.w} height="12" rx="6" className={i === 1 ? 'fill-primary/18 stroke-primary/30' : 'fill-primary/[0.07]'} />
          {i === 1 && <path d="M87 127l3 3 6-7" className="fill-none stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        </motion.g>
      ))}
    </Frame>
  );
}

function ApproachesArt({ reduce }: { reduce: boolean | null }) {
  const cards = [{ x: 20, y: 45 }, { x: 87, y: 29 }, { x: 154, y: 45 }];
  return (
    <Frame>
      {cards.map((c, i) => (
        <motion.g key={c.x} {...reveal(reduce, 0.15 + i * 0.18, 12)}>
          <rect x={c.x} y={c.y} width="66" height="94" rx="12" className={i === 1 ? 'fill-primary/[0.09] stroke-primary/55' : 'fill-card stroke-primary/20'} strokeWidth={i === 1 ? 2 : 1.5} />
          <circle cx={c.x + 14} cy={c.y + 17} r="6" className={i === 1 ? 'fill-primary' : 'fill-primary/25'} />
          <rect x={c.x + 25} y={c.y + 12} width="29" height="5" rx="2.5" className="fill-foreground/20" />
          <rect x={c.x + 11} y={c.y + 36} width="44" height="5" rx="2.5" className="fill-foreground/12" />
          <rect x={c.x + 11} y={c.y + 47} width="35" height="5" rx="2.5" className="fill-foreground/10" />
          <rect x={c.x + 11} y={c.y + 66} width="18" height="12" rx="4" className="fill-primary/12" />
          <rect x={c.x + 33} y={c.y + 66} width="20" height="12" rx="4" className="fill-primary/12" />
        </motion.g>
      ))}
      <motion.path d="M120 13l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" className="fill-amber-400" {...reveal(reduce, 0.92)} />
    </Frame>
  );
}

function ImpactArt({ reduce }: { reduce: boolean | null }) {
  const inputs = [{ y: 39, w: 50 }, { y: 72, w: 64 }, { y: 105, w: 42 }];
  return (
    <Frame>
      {inputs.map((x, i) => (
        <motion.g key={x.y} {...reveal(reduce, 0.12 + i * 0.15)}>
          <rect x="23" y={x.y} width={x.w} height="19" rx="7" className="fill-card stroke-primary/25" />
          <circle cx="34" cy={x.y + 9.5} r="3.5" className="fill-primary/50" />
          <rect x="42" y={x.y + 7} width={x.w - 26} height="5" rx="2.5" className="fill-primary/12" />
          <motion.path d={`M ${x.w + 27} ${x.y + 9} C 102 ${x.y + 9} 102 88 121 88`} className="fill-none stroke-primary/25" strokeWidth="2" {...draw(reduce, 0.42 + i * 0.1)} />
        </motion.g>
      ))}
      <motion.g {...reveal(reduce, 0.76)}>
        <rect x="121" y="49" width="92" height="79" rx="17" className="fill-primary/[0.08] stroke-primary/40" strokeWidth="2" />
        <text x="167" y="82" textAnchor="middle" className="fill-primary text-[19px] font-semibold">$</text>
        <rect x="143" y="94" width="48" height="7" rx="3.5" className="fill-primary/30" />
        <rect x="151" y="107" width="32" height="5" rx="2.5" className="fill-primary/15" />
      </motion.g>
      <motion.path d="M127 140h78" className="stroke-primary/15" strokeWidth="5" strokeLinecap="round" {...draw(reduce, 1)} />
      <motion.circle cx="169" cy="140" r="6" className="fill-primary" {...reveal(reduce, 1.08)} />
    </Frame>
  );
}

function BriefArt({ reduce }: { reduce: boolean | null }) {
  return (
    <Frame>
      <motion.g {...reveal(reduce, 0.12, 8)}>
        <path d="M70 19h75l27 27v109H70Z" className="fill-card stroke-primary/30" strokeWidth="2" />
        <path d="M145 19v28h27" className="fill-primary/[0.08] stroke-primary/30" strokeWidth="2" />
      </motion.g>
      {[61, 78, 95, 118].map((y, i) => (
        <motion.path key={y} d={`M88 ${y}h${i === 2 ? 46 : 62}`} className={i === 0 ? 'stroke-primary/55' : 'stroke-foreground/14'} strokeWidth={i === 0 ? 6 : 5} strokeLinecap="round" {...draw(reduce, 0.42 + i * 0.14)} />
      ))}
      <motion.g {...reveal(reduce, 1.08)}>
        <circle cx="166" cy="134" r="20" className="fill-primary" />
        <path d="M157 134l6 6 12-14" className="fill-none stroke-primary-foreground" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </Frame>
  );
}

export function JourneyThinkingArt({ step }: { step: StepKey }) {
  const reduce = useReducedMotion();
  if (step === 'spark') return <SparkArt reduce={reduce} />;
  if (step === 'map') return <MapArt reduce={reduce} />;
  if (step === 'clarify' || step === 'questions') return <QuestionsArt reduce={reduce} />;
  if (step === 'shape') return <ApproachesArt reduce={reduce} />;
  if (step === 'impact') return <ImpactArt reduce={reduce} />;
  return <BriefArt reduce={reduce} />;
}
