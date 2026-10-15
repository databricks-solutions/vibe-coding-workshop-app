import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ConfettiBurst } from '../../celebration/ConfettiBurst';

// Cloth shapes in a 32x40 box with the pole at x=3. Same commands in each, so the path morphs.
const WAVE = [
  'M3 3 C 11 0, 19 6, 29 3 L 29 15 C 19 18, 11 12, 3 15 Z',
  'M3 3 C 11 6, 19 0, 29 4 L 29 16 C 19 12, 11 18, 3 15 Z',
  'M3 3 C 11 2, 19 4, 28 2 L 28 14 C 19 16, 11 14, 3 15 Z',
];
const POLE_X = 3 / 32;
const HEIGHT = { xl: 68, lg: 40, md: 22 } as const;

/**
 * The summit flag: waves while it waits halfway down the pole, and runs up to the top
 * (with a short sparkle) once the summit is reached. Static when motion is reduced.
 */
export function SummitFlag({ reached, size = 'lg' }: { reached: boolean; size?: keyof typeof HEIGHT }) {
  const reduce = useReducedMotion();
  const h = HEIGHT[size];
  const w = h * 0.8;
  const [seen, setSeen] = useState(reached);
  const [burst, setBurst] = useState(0);
  if (reached !== seen) {
    setSeen(reached);
    if (reached) setBurst(b => b + 1);
  }

  return (
    <span className="absolute bottom-full left-1/2 pointer-events-none" style={{ width: w, height: h, marginLeft: -w * POLE_X }} aria-hidden>
      {reached && (
        <span
          className="absolute rounded-full bg-amber-400/30 blur-md motion-safe:animate-pulse"
          style={{ width: w * 1.4, height: w * 1.4, left: -w * 0.35, top: -w * 0.25 }}
        />
      )}
      <svg viewBox="0 0 32 40" width={w} height={h} className="relative overflow-visible">
        <line x1="3" y1="2.5" x2="3" y2="40" strokeWidth={size === 'xl' ? 1.4 : 1.8} strokeLinecap="round" className={reached ? 'stroke-amber-600 dark:stroke-amber-400' : 'stroke-muted-foreground/60'} />
        <circle cx="3" cy="2" r="1.6" className={reached ? 'fill-amber-500' : 'fill-muted-foreground/60'} />
        <motion.g initial={false} animate={{ y: reached ? 0 : 13 }} transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}>
          <motion.path
            d={WAVE[0]}
            strokeWidth="1"
            strokeLinejoin="round"
            className={reached ? 'fill-amber-400 stroke-amber-500' : size === 'xl' ? 'fill-primary/70 stroke-primary' : 'fill-primary/15 stroke-primary/60'}
            style={size === 'xl' ? { filter: 'drop-shadow(0 1.5px 1.5px rgb(0 0 0 / 0.18))' } : undefined}
            animate={reduce ? undefined : { d: [WAVE[0], WAVE[1], WAVE[2], WAVE[0]] }}
            transition={{ duration: reached ? 2.4 : 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>
      </svg>
      {burst > 0 && !reduce && (
        <span key={burst} className="absolute -inset-10 overflow-hidden">
          <ConfettiBurst count={12} centerX={50} centerY={45} spread={30} />
        </span>
      )}
    </span>
  );
}
