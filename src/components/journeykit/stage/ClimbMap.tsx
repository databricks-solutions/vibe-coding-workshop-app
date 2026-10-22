import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mountain, Tent } from 'lucide-react';
import { DURATION, EASE } from '../tokens';
import { StepDot } from './StepDot';
import { SummitFlag } from './SummitFlag';
import { StopSummary } from './StopCard';
import { layoutTrail, smooth, stopPosition, stopStatus, type Pt, type TrailFrame } from './trailGeometry';
import type { ProgressStep } from './JourneyProgress';
import type { TrailBeyond } from './SummitTrail';

const FRAME: TrailFrame = { base: 70, top: 32, left: 8, right: 90, rightWithBeyond: 70, beyondX: 88, dip: 14 };
const BEYOND_KEY = '__beyond';
const DRAW_START = 0.35;
const DRAW_TIME = 1.1;

interface ClimbRouteProps {
  steps: ProgressStep[];
  briefMarker?: 'summit' | 'camp';
  beyond?: TrailBeyond;
  /** Play the entrance: hills rise, the trail draws, stops arrive as it reaches them. */
  animateIn?: boolean;
}

/**
 * The whole route as a small mountain scene with a details panel under it. Every stop is a
 * button; the panel says what happens there. Starts on the stop you are at.
 */
export function ClimbRoute({ steps, briefMarker = 'summit', beyond, animateIn = false }: ClimbRouteProps) {
  const beyondStep: ProgressStep | null = beyond
    ? { key: BEYOND_KEY, label: beyond.label, icon: Mountain, state: beyond.state, detail: beyond.detail, disabled: true }
    : null;
  const stops = beyondStep ? [...steps, beyondStep] : steps;
  const initial = stops.find(s => s.state === 'current') ?? stops.find(s => s.state !== 'done') ?? stops[stops.length - 1];
  const [selectedKey, setSelectedKey] = useState(initial?.key);
  const selected = stops.find(s => s.key === selectedKey) ?? initial;
  const index = selected ? stops.indexOf(selected) : -1;
  const move = (delta: number) => {
    const next = stops[Math.min(stops.length - 1, Math.max(0, index + delta))];
    if (next) setSelectedKey(next.key);
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <ClimbMap steps={steps} briefMarker={briefMarker} beyond={beyond} selectedKey={selected?.key} onSelect={setSelectedKey} onMove={move} animateIn={animateIn} />
      {selected && (
        <div className="relative border-t border-border/60 px-5 sm:px-6 py-5">
          <div className="absolute right-4 top-4 flex items-center gap-1">
            <span className="mr-1 text-ui-2xs text-muted-foreground tabular-nums">{index + 1} / {stops.length}</span>
            <PanelArrow label="Previous stop" disabled={index <= 0} onClick={() => move(-1)}><ChevronLeft className="w-4 h-4" /></PanelArrow>
            <PanelArrow label="Next stop" disabled={index >= stops.length - 1} onClick={() => move(1)}><ChevronRight className="w-4 h-4" /></PanelArrow>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.fast, ease: EASE }}
              className="pr-24 min-h-[6.5rem]"
            >
              <StopSummary
                step={selected}
                position={selected === beyondStep ? 'After your brief' : stopPosition(selected, steps)}
                status={stopStatus(selected, stops)}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function PanelArrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

interface ClimbMapProps {
  steps: ProgressStep[];
  briefMarker: 'summit' | 'camp';
  beyond?: TrailBeyond;
  selectedKey?: string;
  onSelect: (key: string) => void;
  onMove: (delta: number) => void;
  animateIn: boolean;
}

function ClimbMap({ steps, briefMarker, beyond, selectedKey, onSelect, onMove, animateIn }: ClimbMapProps) {
  const reduce = useReducedMotion();
  const draw = animateIn && !reduce;
  const clipId = `climb-${useId().replace(/:/g, '')}`;
  const groupRef = useRef<HTMLDivElement>(null);
  const { main, pos, beyond: beyondPt, loops, trailPts, progressPts } = layoutTrail(steps, FRAME, !!beyond);
  const peak = trailPts.at(-1) ?? { x: 50, y: 40 };
  const summitReached = beyond ? beyond.state === 'done' : main.at(-1)?.state === 'done';
  const arrive = (p: Pt) => (draw ? DRAW_START + (p.x / 100) * DRAW_TIME : 0);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    onMove(e.key === 'ArrowRight' ? 1 : -1);
    requestAnimationFrame(() => groupRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus());
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Your route. Use the arrow keys to move between stops."
      onKeyDown={onKeyDown}
      className="relative h-56 sm:h-64 w-full select-none overflow-hidden bg-gradient-to-b from-primary/[0.10] via-primary/[0.04] to-transparent"
    >
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] rounded-full pointer-events-none transition-[background] duration-1000"
        style={{
          left: `${peak.x}%`,
          top: `${peak.y - 4}%`,
          background: summitReached
            ? 'radial-gradient(circle, rgb(251 191 36 / 0.28), rgb(251 191 36 / 0.06) 42%, transparent 68%)'
            : 'radial-gradient(circle, hsl(var(--primary) / 0.14), hsl(var(--primary) / 0.03) 42%, transparent 68%)',
        }}
      />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            {draw
              ? <motion.rect x={0} y={0} height={100} initial={{ width: 0 }} animate={{ width: 100 }} transition={{ delay: DRAW_START, duration: DRAW_TIME, ease: [0.45, 0, 0.25, 1] }} />
              : <rect x={0} y={0} width={100} height={100} />}
          </clipPath>
        </defs>
        <Hills trail={trailPts} peak={peak} draw={draw} />
        <g clipPath={`url(#${clipId})`}>
          <path d={smooth(trailPts)} className="fill-none stroke-white/70 dark:stroke-white/[0.06]" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={smooth(trailPts)} className="fill-none stroke-muted-foreground/35" strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {loops.map(l => (
            <path key={l.key} d={l.d} className={`fill-none ${l.done ? 'stroke-emerald-500/70' : 'stroke-amber-400/80'}`} strokeWidth={1.75} strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {progressPts.length > 1 && (
            <path d={smooth(progressPts)} className="fill-none stroke-emerald-500" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </g>
      </svg>

      {steps.map((s, i) => {
        const p = pos.get(s.key)!;
        const last = !s.optional && main.indexOf(s) === main.length - 1;
        return (
          <Stop
            key={s.key}
            step={s}
            at={p}
            labelAbove={!s.optional && !!steps[i + 1]?.optional}
            delay={arrive(p)}
            draw={draw}
            selected={selectedKey === s.key}
            onSelect={() => onSelect(s.key)}
            flag={last && briefMarker === 'summit' ? 'summit' : last && briefMarker === 'camp' ? 'camp' : undefined}
          />
        );
      })}
      {beyond && beyondPt && (
        <Stop
          step={{ key: BEYOND_KEY, label: beyond.label, icon: Mountain, state: beyond.state, disabled: true }}
          at={beyondPt}
          delay={arrive(beyondPt)}
          draw={draw}
          selected={selectedKey === BEYOND_KEY}
          onSelect={() => onSelect(BEYOND_KEY)}
          flag="summit"
        />
      )}
    </div>
  );
}

interface StopProps {
  step: ProgressStep;
  at: Pt;
  delay: number;
  draw: boolean;
  selected: boolean;
  onSelect: () => void;
  flag?: 'summit' | 'camp';
  /** Label over the dot, leaving the space under it to an optional detour. */
  labelAbove?: boolean;
}

function Stop({ step, at, delay, draw, selected, onSelect, flag, labelAbove = false }: StopProps) {
  const reduce = useReducedMotion();
  const current = step.state === 'current';
  const tone = current ? 'text-primary' : step.state === 'done' ? 'text-foreground' : 'text-muted-foreground';
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 ${selected ? 'z-20' : 'z-10'}`} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <motion.div
        className="relative flex flex-col items-center"
        initial={draw ? { opacity: 0, scale: 0.5 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={draw ? { type: 'spring', stiffness: 420, damping: 22, delay } : { duration: 0 }}
      >
        {flag === 'summit' && (
          <motion.span
            className="absolute inset-0 pointer-events-none"
            initial={draw ? { opacity: 0, y: -18 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={draw ? { type: 'spring', stiffness: 260, damping: 15, delay: delay + 0.2 } : { duration: 0 }}
          >
            <SummitFlag reached={step.state === 'done'} size="lg" />
          </motion.span>
        )}
        {flag === 'camp' && (
          <span className={`absolute bottom-full mb-1.5 flex items-center gap-1 text-ui-2xs font-semibold uppercase tracking-[0.14em] whitespace-nowrap ${step.state === 'done' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/80'}`}>
            <Tent className="w-3.5 h-3.5" /> Base camp
          </span>
        )}
        {current && !flag && (
          <span className={`absolute flex items-center pointer-events-none ${labelAbove ? 'top-full mt-2.5 flex-col-reverse' : 'bottom-full mb-2.5 flex-col'}`}>
            <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-ui-2xs font-semibold whitespace-nowrap shadow-sm">You are here</span>
            <span className={`w-1.5 h-1.5 rotate-45 bg-primary ${labelAbove ? '-mb-[3px]' : '-mt-[3px]'}`} />
          </span>
        )}
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-current={current ? 'step' : undefined}
          aria-label={`${step.label}${current ? ', you are here' : step.state === 'done' ? ', done' : ''}`}
          tabIndex={selected ? 0 : -1}
          className={`relative rounded-full transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none ${
            selected ? 'ring-2 ring-primary ring-offset-[3px] ring-offset-card shadow-md' : 'hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40'
          } ${step.state === 'upcoming' && !selected ? 'opacity-75 hover:opacity-100' : ''}`}
        >
          {current && !reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/30"
              animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <StepDot icon={step.icon} state={step.state} prefilled={step.prefilled} size="lg" />
        </button>
        <span className={`absolute ${labelAbove ? 'bottom-full mb-2' : 'top-full mt-2'} flex-col items-center text-center whitespace-nowrap ${selected || current ? 'flex' : 'hidden sm:flex'}`}>
          <span className={`text-ui-sm leading-tight transition-colors ${selected ? 'font-semibold text-foreground' : `font-medium ${tone}`}`}>{step.label}</span>
          {step.optional && <span className="mt-0.5 text-ui-2xs font-medium text-amber-600 dark:text-amber-400">Optional</span>}
        </span>
      </motion.div>
    </div>
  );
}

/** Far range, the summit, rolling mid hills and the ground the trail climbs on; they rise in back to front. */
function Hills({ trail, peak, draw }: { trail: Pt[]; peak: Pt; draw: boolean }) {
  const { x: px, y: py } = peak;
  const apex = py - 14;
  const first = trail[0] ?? { x: 0, y: 80 };
  const ground = `${smooth([{ x: 0, y: first.y + 9 }, ...trail.map(p => ({ x: p.x, y: p.y + 9 })), { x: 100, y: peak.y + 16 }])} L 100 100 L 0 100 Z`;
  const layer = (i: number, rise: number) => ({
    initial: draw ? { opacity: 0, y: rise } : false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay: draw ? i * 0.08 : 0 },
  } as const);

  return (
    <>
      <motion.path {...layer(0, 6)} d="M 0 60 C 12 48, 22 52, 32 46 S 52 36, 62 42 S 80 48, 100 40 L 100 100 L 0 100 Z" className="fill-primary/[0.05]" />
      <motion.g {...layer(1, 10)}>
        <path d={`M ${px - 30} 100 C ${px - 18} ${apex + 44}, ${px - 8} ${apex + 14}, ${px} ${apex} C ${px + 8} ${apex + 14}, ${px + 18} ${apex + 44}, ${px + 30} 100 Z`} className="fill-primary/[0.11]" />
        <path d={`M ${px} ${apex} C ${px + 8} ${apex + 14}, ${px + 18} ${apex + 44}, ${px + 30} 100 L ${px + 8} 100 C ${px + 7} ${apex + 44}, ${px + 3} ${apex + 16}, ${px} ${apex} Z`} className="fill-primary/[0.06]" />
        <path
          d={`M ${px - 4.4} ${apex + 8} C ${px - 2.6} ${apex + 3}, ${px - 1.1} ${apex + 1}, ${px} ${apex} C ${px + 1.1} ${apex + 1}, ${px + 2.6} ${apex + 3}, ${px + 4.4} ${apex + 8} L ${px + 2.6} ${apex + 6.4} L ${px + 1.2} ${apex + 9} L ${px - 0.4} ${apex + 6.2} L ${px - 2.4} ${apex + 9.2} Z`}
          className="fill-white/90 dark:fill-white/20"
        />
      </motion.g>
      <motion.path {...layer(2, 8)} d="M 0 72 C 14 64, 26 68, 40 72 S 62 64, 76 70 S 92 78, 100 74 L 100 100 L 0 100 Z" className="fill-primary/[0.07]" />
      <motion.path {...layer(3, 6)} d={ground} className="fill-primary/[0.08]" />
      <motion.path {...layer(4, 4)} d="M 0 92 C 16 86, 30 90, 46 94 S 74 88, 100 92 L 100 100 L 0 100 Z" className="fill-primary/[0.12]" />
    </>
  );
}
