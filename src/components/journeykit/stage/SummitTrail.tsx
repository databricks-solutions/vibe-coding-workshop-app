import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Flag, Mountain, Tent } from 'lucide-react';
import { DURATION, EASE, PROGRESS_TOKENS, type StepState } from '../tokens';
import { StepDot } from './StepDot';
import { SummitFlag } from './SummitFlag';
import type { ProgressStep } from './JourneyProgress';

export type TrailSize = 'lg' | 'md' | 'xs';

export interface TrailBeyond {
  label: string;
  state: StepState;
}

interface SummitTrailProps {
  steps: ProgressStep[];
  size?: TrailSize;
  /** What the last step is: the summit (Ideate) or base camp before a further peak (Insights). */
  briefMarker?: 'summit' | 'camp';
  beyond?: TrailBeyond;
  onSelectStep?: (key: string) => void;
  /** Draw the trail in from the trailhead (the intro). */
  drawIn?: boolean;
}

const HEIGHT: Record<TrailSize, string> = { lg: 'h-[26rem]', md: 'h-[4.5rem]', xs: 'h-5' };
// Vertical band (percent of height) the trail climbs through. The top leaves room for the summit flag.
const BAND: Record<TrailSize, { base: number; top: number }> = {
  lg: { base: 78, top: 31 },
  md: { base: 80, top: 52 },
  xs: { base: 84, top: 18 },
};
const DOT: Record<Exclude<TrailSize, 'xs'>, 'lg' | 'md'> = { lg: 'lg', md: 'md' };

interface Pt { x: number; y: number }

/** Catmull-Rom through the points, as cubic Beziers, in the 0..100 viewBox. */
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function layout(steps: ProgressStep[], size: TrailSize, hasBeyond: boolean) {
  const main = steps.map((s, i) => ({ s, i })).filter(({ s }) => !s.optional);
  const { base, top } = BAND[size];
  // The big scene is full-bleed, so its ends sit further in to keep labels on the card.
  const left = size === 'lg' ? 8 : 5;
  const right = hasBeyond ? (size === 'lg' ? 70 : 76) : size === 'lg' ? 88 : 95;
  const pos = new Map<string, Pt>();
  main.forEach(({ s }, k) => {
    const t = main.length > 1 ? k / (main.length - 1) : 1;
    // A gentle rolling climb: mostly up, with a small dip so it reads as hills rather than a ramp.
    const roll = Math.sin(t * Math.PI * 2.2) * (base - top) * 0.08;
    const peak = hasBeyond ? top + (base - top) * 0.3 : top;
    pos.set(s.key, { x: left + (right - left) * t, y: base - (base - peak) * t + roll });
  });
  // Optional steps sit on a short loop below the trail, between their neighbours.
  steps.forEach((s, i) => {
    if (!s.optional) return;
    const prev = [...steps.slice(0, i)].reverse().find(p => !p.optional);
    const next = steps.slice(i + 1).find(p => !p.optional);
    const a = prev ? pos.get(prev.key)! : { x: left, y: base };
    const b = next ? pos.get(next.key)! : a;
    pos.set(s.key, { x: (a.x + b.x) / 2, y: Math.min(94, Math.max(a.y, b.y) + (size === 'xs' ? 8 : 16)) });
  });
  const beyond = hasBeyond ? { x: size === 'lg' ? 88 : 94, y: top } : null;
  return { main: main.map(m => m.s), pos, beyond };
}

/** The "Summit" badge over the flag; amber once reached. */
function SummitLabel({ reached, flagHeight }: { reached: boolean; flagHeight: number }) {
  return (
    <span
      className={`absolute bottom-full left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-ui-2xs font-semibold uppercase tracking-[0.16em] whitespace-nowrap shadow-sm backdrop-blur-sm ${reached ? 'border-amber-300 bg-amber-50/90 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300' : 'border-border bg-card/90 text-foreground/80'}`}
      style={{ marginBottom: flagHeight + 8 }}
    >
      <Flag className={`w-3 h-3 ${reached ? 'text-amber-500' : 'text-primary'}`} strokeWidth={2.5} />
      Summit
    </span>
  );
}

const CLOUD_PUFFS = 'M 20 46 C 7 46 3 35 12 30 C 10 19 23 13 32 19 C 36 8 53 4 62 14 C 70 4 89 7 90 21 C 102 18 113 28 108 37 C 117 39 116 46 107 46 Z';

interface CloudSpec { top: number; width: number; duration: number; delay: number; rest: number; opacity: number; bob?: boolean }

// Far clouds pass behind the mountains; near ones are bigger, quicker and drift in front.
const FAR_CLOUDS: CloudSpec[] = [
  { top: 5, width: 120, duration: 140, delay: -20, rest: 18, opacity: 0.7 },
  { top: 17, width: 84, duration: 170, delay: -95, rest: 52, opacity: 0.55 },
  { top: 27, width: 100, duration: 155, delay: -60, rest: 70, opacity: 0.5 },
];
const NEAR_CLOUDS: CloudSpec[] = [
  { top: 9, width: 190, duration: 80, delay: -48, rest: 34, opacity: 0.95, bob: true },
  { top: 22, width: 150, duration: 95, delay: -8, rest: 78, opacity: 0.85, bob: true },
];

function Cloud3D({ width }: { width: number }) {
  return (
    <svg viewBox="0 0 120 52" width={width} height={width * 52 / 120} className="overflow-visible">
      <path d={CLOUD_PUFFS} transform="translate(0 4)" className="fill-primary/[0.14] dark:fill-primary/[0.12]" />
      <path d={CLOUD_PUFFS} className="fill-white dark:fill-white/[0.12]" />
      <path d="M 34 20 C 40 12 52 10 58 17" className="fill-none stroke-white dark:stroke-white/20" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

/** Clouds that drift right across the whole sky and wrap; parked at `rest` when motion is reduced. */
function TrailClouds({ clouds, birds = false }: { clouds: CloudSpec[]; birds?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {clouds.map((c, i) => (
        <div
          key={i}
          className="trail-cloud-track absolute inset-x-0"
          style={{ top: `${c.top}%`, opacity: c.opacity, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s`, ['--cloud-rest' as string]: `${c.rest}%` }}
        >
          <div className={c.bob ? 'trail-cloud-bob' : undefined}><Cloud3D width={c.width} /></div>
        </div>
      ))}
      {birds && (
        <div className="trail-cloud-track absolute inset-x-0" style={{ top: '14%', animationDuration: '65s', animationDelay: '-22s', ['--cloud-rest' as string]: '24%' }}>
          <svg viewBox="0 0 40 16" width={40} height={16} className="overflow-visible">
            {[{ x: 0, y: 6, s: 1 }, { x: 14, y: 0, s: 0.8 }, { x: 24, y: 9, s: 0.65 }].map((b, i) => (
              <g key={i} transform={`translate(${b.x} ${b.y}) scale(${b.s})`}>
                <path d="M 0 4 Q 3 0 6 4 Q 9 0 12 4" className="trail-bird fill-none stroke-foreground/40" strokeWidth={1.4} strokeLinecap="round" style={{ animationDelay: `${i * -0.3}s` }} />
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

/** A small two-tier pine; base sits below the hill drawn over it so it grows out of the slope. */
const pine = (x: number, base: number, h: number) =>
  `M ${x - 1} ${base} L ${x} ${base - h} L ${x + 1} ${base} Z M ${x - 1.25} ${base + h * 0.4} L ${x} ${base - h * 0.5} L ${x + 1.25} ${base + h * 0.4} Z`;
const PINES: [number, number, number][] = [[1.6, 90, 7], [3.4, 91, 10], [5.2, 91, 6], [33, 95, 6], [35, 96, 8], [62, 93, 7], [64, 94, 10], [97.5, 96, 8]];

/** The big scene behind the trail: far range, the summit massif, layered hills and a few pines. */
function TrailScenery({ trail, peak, draw }: { trail: Pt[]; peak: Pt; draw: boolean }) {
  const { x: px, y: py } = peak;
  const climb = trail.slice(0, -1);
  const last = climb.at(-1) ?? peak;
  const ground = climb.length
    ? `${smooth([{ x: 0, y: climb[0].y + 9 }, ...climb.map(p => ({ x: p.x, y: p.y + 9 }))])} C ${last.x + 6} ${last.y + 14}, ${px - 10} 86, ${px - 3} 100 L 0 100 Z`
    : '';
  return (
    <motion.g initial={draw ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow * 2, ease: EASE }}>
      {/* Far range, hazy */}
      <path
        d="M 0 62 Q 6 52 11 47 Q 13 45 15 47 Q 20 53 25 51 Q 31 41 36 37 Q 38 35.5 40 37 Q 46 45 52 48 Q 57 43 61 41 Q 63 40 65 42 Q 70 49 76 54 L 76 100 L 0 100 Z"
        className="fill-primary/[0.06]"
      />
      {/* Shoulder peak */}
      <path d={`M ${px - 38} 100 L ${px - 23} ${py + 27} L ${px - 17.4} ${py + 13} Q ${px - 16} ${py + 11} ${px - 14.6} ${py + 13} L ${px - 8} ${py + 30} L ${px + 4} 100 Z`} className="fill-primary/[0.09]" />
      <path d={`M ${px - 19.5} ${py + 18} L ${px - 17.4} ${py + 13} Q ${px - 16} ${py + 11} ${px - 14.6} ${py + 13} L ${px - 12.8} ${py + 17.5} L ${px - 14.6} ${py + 16.5} L ${px - 16} ${py + 19} L ${px - 17.6} ${py + 16.8} Z`} className="fill-white/80 dark:fill-white/15" />
      {/* Summit massif: lit west face, shaded east face, snowcap */}
      <path
        d={`M ${px - 27} 100 L ${px - 15} ${py + 30} L ${px - 11} ${py + 24} L ${px - 5} ${py + 8} L ${px - 1.2} ${py - 6} Q ${px} ${py - 8} ${px + 1.2} ${py - 6} L ${px + 7} ${py + 10} L ${px + 10} ${py + 16} L ${px + 20} ${py + 42} L ${px + 20} 100 Z`}
        className="fill-primary/[0.13]"
      />
      <path
        d={`M ${px + 0.6} ${py - 6.8} L ${px + 7} ${py + 10} L ${px + 10} ${py + 16} L ${px + 20} ${py + 42} L ${px + 20} 100 L ${px + 13} 100 L ${px + 6} ${py + 36} L ${px + 1.5} ${py + 18} L ${px + 3} ${py + 6} Z`}
        className="fill-primary/[0.12]"
      />
      <path
        d={`M ${px - 5} ${py + 8} L ${px - 1.2} ${py - 6} Q ${px} ${py - 8} ${px + 1.2} ${py - 6} L ${px + 5.5} ${py + 5} L ${px + 3.6} ${py + 3.6} L ${px + 2} ${py + 7.5} L ${px} ${py + 3.5} L ${px - 2.2} ${py + 9.5} L ${px - 3.4} ${py + 6.5} Z`}
        className="fill-white dark:fill-white/20"
      />
      <path d={`M ${px + 0.6} ${py - 6.8} L ${px + 5.5} ${py + 5} L ${px + 3.6} ${py + 3.6} L ${px + 2} ${py + 7.5} L ${px + 1.4} ${py + 4} Z`} className="fill-primary/[0.10]" />
      {/* Mid hills, then the ground the trail climbs on */}
      <path d="M 0 64 C 10 58, 20 60, 30 65 S 50 58, 60 63 S 74 74, 84 84 S 96 90, 100 88 L 100 100 L 0 100 Z" className="fill-primary/[0.05]" />
      {ground && <path d={ground} className="fill-primary/[0.09]" />}
      {PINES.map(([x, b, h]) => <path key={x} d={pine(x, b, h)} className="fill-primary/25" />)}
      {/* Foreground roll */}
      <path d="M 0 90 C 12 84, 24 88, 36 94 S 60 88, 72 92 S 90 97, 100 93 L 100 100 L 0 100 Z" className="fill-primary/[0.11]" />
      <path d="M 0 90 C 12 84, 24 88, 36 94 S 60 88, 72 92 S 90 97, 100 93" className="fill-none stroke-primary/15" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </motion.g>
  );
}

/**
 * The idea journey as a climb: waypoints are the usual step markers, the trail fills in as
 * steps are approved, and the summit is the brief (or, in Insights, the Genie build beyond it).
 */
export function SummitTrail({ steps, size = 'md', briefMarker = 'summit', beyond, onSelectStep, drawIn = false }: SummitTrailProps) {
  const reduceMotion = useReducedMotion();
  const gradId = useId().replace(/:/g, '');
  const { main, pos, beyond: beyondPt } = layout(steps, size, !!beyond);
  const mainPts = main.map(s => pos.get(s.key)!);
  const trailPts = beyondPt ? [...mainPts, beyondPt] : mainPts;
  const lastDone = main.reduce((n, s, i) => (s.state === 'done' ? i : n), -1);
  const currentIdx = main.findIndex(s => s.state === 'current');
  const reached = Math.max(lastDone, currentIdx);
  const progressPts = mainPts.slice(0, reached + 1);
  const total = trailPts.length;
  const draw = drawIn && !reduceMotion;
  const [drawn, setDrawn] = useState(false);
  const flagSize = size === 'lg' ? 'xl' : 'md';
  const flagHeight = size === 'lg' ? 68 : 22;
  const peak = trailPts.at(-1);
  const summitReached = beyond ? beyond.state === 'done' : main.at(-1)?.state === 'done';

  // Back ridges follow the trail so the hills always frame it.
  const ridgeFront = `${smooth(trailPts.map(p => ({ x: p.x, y: Math.min(100, p.y + 10) })))} L 100 ${Math.min(100, (trailPts.at(-1)?.y ?? 50) + 12)} L 100 100 L 0 100 L 0 ${Math.min(100, (trailPts[0]?.y ?? 80) + 10)} Z`;
  const ridgeBack = `M 0 ${BAND[size].base - 6} C 18 ${BAND[size].top + 26}, 30 ${BAND[size].top + 10}, 46 ${BAND[size].top + 22} S 70 ${BAND[size].top - 4}, 84 ${BAND[size].top + 6} S 96 ${BAND[size].top + 2}, 100 ${BAND[size].top + 8} L 100 100 L 0 100 Z`;

  const optionalLoops = steps.filter(s => s.optional).map(s => {
    const i = steps.indexOf(s);
    const prev = [...steps.slice(0, i)].reverse().find(p => !p.optional);
    const next = steps.slice(i + 1).find(p => !p.optional);
    const a = prev ? pos.get(prev.key)! : pos.get(s.key)!;
    const b = next ? pos.get(next.key)! : a;
    const o = pos.get(s.key)!;
    return { key: s.key, d: smooth([a, o, b]), done: s.state === 'done' };
  });

  const isLast = (i: number) => i === main.length - 1;

  return (
    <div className={`relative w-full ${HEIGHT[size]} select-none`} aria-hidden={size === 'xs' || undefined}>
      {size === 'lg' && peak && (
        <>
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] rounded-full pointer-events-none transition-[background] duration-1000"
            style={{
              left: `${peak.x}%`,
              top: `${peak.y - 6}%`,
              background: summitReached
                ? 'radial-gradient(circle, rgb(251 191 36 / 0.32), rgb(251 191 36 / 0.08) 40%, transparent 68%)'
                : 'radial-gradient(circle, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.04) 40%, transparent 68%)',
            }}
            aria-hidden
          />
          <TrailClouds clouds={FAR_CLOUDS} />
        </>
      )}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`absolute inset-0 w-full h-full ${size === 'lg' ? 'overflow-hidden' : 'overflow-visible'}`}>
        <defs>
          <linearGradient id={`sky-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity="0.14" />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {size === 'lg' && peak && <TrailScenery trail={trailPts} peak={peak} draw={draw} />}
        {size === 'md' && (
          <>
            <path d={ridgeBack} className="fill-primary/[0.07]" />
            <path d={ridgeFront} fill={`url(#sky-${gradId})`} />
          </>
        )}
        {size === 'lg' && (
          <path d={smooth(trailPts)} className="fill-none stroke-white/60 dark:stroke-white/[0.05]" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
        {/* The whole route, quiet and dashed */}
        <path
          d={smooth(trailPts)}
          className={`fill-none ${size === 'xs' ? 'stroke-border' : 'stroke-muted-foreground/30'}`}
          strokeWidth={size === 'xs' ? 1.5 : 2}
          strokeDasharray={size === 'xs' ? undefined : '4 5'}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {optionalLoops.map(l => (
          <path
            key={l.key}
            d={l.d}
            className={`fill-none ${l.done ? 'stroke-emerald-500/70' : 'stroke-amber-400/70'}`}
            strokeWidth={size === 'xs' ? 1 : 1.5}
            strokeDasharray="3 4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* How far this idea has climbed */}
        {/* pathLength dashes break under non-scaling strokes, so the drawn line is swapped for a plain one. */}
        {progressPts.length > 1 && (draw && !drawn ? (
          <motion.path
            d={smooth(progressPts)}
            className="fill-none stroke-emerald-500"
            strokeWidth={size === 'xs' ? 2 : size === 'lg' ? 4 : 3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DURATION.slow * 4, ease: EASE }}
            onAnimationComplete={() => setDrawn(true)}
          />
        ) : (
          <path
            d={smooth(progressPts)}
            className="fill-none stroke-emerald-500"
            strokeWidth={size === 'xs' ? 2 : size === 'lg' ? 4 : 3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {size === 'lg' && <TrailClouds clouds={NEAR_CLOUDS} birds />}

      {/* Waypoints: the same markers as every other progress bar */}
      {main.concat(steps.filter(s => s.optional)).map(s => {
        const p = pos.get(s.key)!;
        const i = main.indexOf(s);
        const order = s.optional ? steps.indexOf(s) : i;
        const isCurrent = s.state === 'current';
        const last = !s.optional && isLast(i);
        const summitHere = last && briefMarker === 'summit';
        const campHere = last && briefMarker === 'camp';
        const title = `${s.label}${s.optional ? ' (optional)' : ''}${s.points ? ` · ${s.points.earned ? `${s.points.earned} pts earned` : `up to +${s.points.available}`}` : ''}`;

        if (size === 'xs') {
          return (
            <span
              key={s.key}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${PROGRESS_TOKENS.segment[s.state]}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {summitHere && s.state === 'done' && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px w-0.5 h-2 rounded-full bg-amber-500" />}
            </span>
          );
        }

        return (
          <motion.div
            key={s.key}
            className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center hover:z-10 focus-within:z-10"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            initial={draw ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE, delay: draw ? 0.25 + order * 0.12 : 0 }}
          >
            {size === 'md' && !isCurrent && !s.disabled && onSelectStep && (
              <span className="absolute bottom-full mb-1 px-2 py-0.5 rounded-full bg-card border border-border text-foreground text-ui-xs font-semibold whitespace-nowrap shadow-sm opacity-0 translate-y-1 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
                {s.label}
              </span>
            )}
            {summitHere && (
              <motion.span
                className="absolute inset-0 pointer-events-none"
                initial={draw ? { opacity: 0, y: -28 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={draw ? { type: 'spring', stiffness: 260, damping: 14, delay: 0.45 + order * 0.12 } : { duration: 0 }}
              >
                <SummitFlag reached={s.state === 'done'} size={flagSize} />
                {size === 'lg' && <SummitLabel reached={s.state === 'done'} flagHeight={flagHeight} />}
              </motion.span>
            )}
            {campHere && (
              <span className={`absolute bottom-full mb-1 flex items-center gap-1 font-semibold uppercase tracking-[0.14em] whitespace-nowrap ${size === 'lg' ? 'text-ui-2xs' : 'text-ui-3xs'} ${s.state === 'done' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/80'}`}>
                <Tent className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
                {size === 'lg' && 'Base camp'}
              </span>
            )}
            {isCurrent && !last && (
              size === 'md' ? (
                <span className="absolute bottom-full mb-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-ui-xs font-semibold whitespace-nowrap">
                  {s.label}
                </span>
              ) : (
                <span className="absolute bottom-full mb-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-ui-2xs font-semibold whitespace-nowrap shadow-sm">
                  You are here
                </span>
              )
            )}
            <button
              type="button"
              disabled={s.disabled || !onSelectStep}
              onClick={() => onSelectStep?.(s.key)}
              title={title}
              aria-label={title}
              aria-current={isCurrent ? 'step' : undefined}
              className={`relative rounded-full transition-transform ${s.disabled ? 'opacity-50 cursor-not-allowed' : onSelectStep ? 'cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''}`}
            >
              {isCurrent && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping motion-reduce:hidden" />}
              <StepDot icon={s.icon} state={s.state} prefilled={s.prefilled} size={DOT[size]} />
            </button>
            {size === 'lg' && (
              <span className="absolute top-full mt-2 flex flex-col items-center text-center whitespace-nowrap px-2.5 py-1 rounded-lg bg-card/75 backdrop-blur-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                <span className={`text-ui-sm font-semibold leading-tight ${s.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'}`}>{s.label}</span>
                {s.points && (
                  s.points.earned > 0 ? (
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-ui-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} /> {s.points.earned} pts
                    </span>
                  ) : (
                    <span className={`mt-0.5 text-ui-xs tabular-nums ${s.optional ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      {s.optional ? `Optional · up to +${s.points.available}` : `+${s.points.available}`}
                    </span>
                  )
                )}
              </span>
            )}
          </motion.div>
        );
      })}

      {beyond && beyondPt && (
        size === 'xs' ? (
          <span
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${PROGRESS_TOKENS.segment[beyond.state]}`}
            style={{ left: `${beyondPt.x}%`, top: `${beyondPt.y}%` }}
          >
            {beyond.state === 'done' && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px w-0.5 h-2 rounded-full bg-amber-500" />}
          </span>
        ) : (
          <motion.div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${beyondPt.x}%`, top: `${beyondPt.y}%` }}
            initial={draw ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE, delay: draw ? 0.25 + total * 0.12 : 0 }}
            title={beyond.label}
          >
            <SummitFlag reached={beyond.state === 'done'} size={flagSize} />
            {size === 'lg' && <SummitLabel reached={beyond.state === 'done'} flagHeight={flagHeight} />}
            <span className={beyond.state === 'upcoming' ? 'opacity-60' : ''}>
              <StepDot icon={Mountain} state={beyond.state} size={DOT[size]} />
            </span>
            {size === 'lg' && (
              <span className="absolute top-full mt-2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-card/75 backdrop-blur-[3px] text-center text-ui-sm font-semibold leading-tight text-muted-foreground">{beyond.label}</span>
            )}
          </motion.div>
        )
      )}
    </div>
  );
}

/** The trail's key, for screens that show the big trail. */
export function TrailLegend({ summit = true }: { summit?: boolean }) {
  const item = 'inline-flex items-center gap-1.5';
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-ui-xs text-muted-foreground">
      <span className={item}><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Done</span>
      <span className={item}><span className="w-2.5 h-2.5 rounded-full ring-2 ring-primary ring-offset-1 ring-offset-card" /> You are here</span>
      <span className={item}><span className="w-4 border-t-2 border-dashed border-amber-400" /> Optional detour</span>
      {summit && <span className={item}><Flag className="w-3.5 h-3.5 text-amber-500" /> Summit</span>}
    </div>
  );
}
