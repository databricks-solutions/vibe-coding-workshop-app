import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mountain, Tent } from 'lucide-react';
import { DURATION, EASE, PROGRESS_TOKENS, type StepState } from '../tokens';
import { StepDot } from './StepDot';
import { SummitFlag } from './SummitFlag';
import { StopSummary } from './StopCard';
import { layoutTrail, smooth, stopPosition, stopStatus, type Pt, type TrailFrame } from './trailGeometry';
import type { ProgressStep } from './JourneyProgress';

export type TrailSize = 'md' | 'xs';

export interface TrailBeyond {
  label: string;
  state: StepState;
  /** What happens there, for the stop's details. */
  detail?: string;
}

interface SummitTrailProps {
  steps: ProgressStep[];
  size?: TrailSize;
  /** What the last step is: the summit (Ideate) or base camp before a further peak (Insights). */
  briefMarker?: 'summit' | 'camp';
  beyond?: TrailBeyond;
  onSelectStep?: (key: string) => void;
}

const HEIGHT: Record<TrailSize, string> = { md: 'h-[4.5rem]', xs: 'h-5' };
const FRAME: Record<TrailSize, TrailFrame> = {
  md: { base: 80, top: 52, left: 5, right: 95, rightWithBeyond: 76, beyondX: 94, dip: 16 },
  xs: { base: 84, top: 18, left: 5, right: 95, rightWithBeyond: 76, beyondX: 94, dip: 8 },
};
const BEYOND_KEY = '__beyond';

/** Keeps a stop's details card on screen: edge stops open towards the middle. */
const popoverAlign = (p: Pt) => (p.x < 22 ? 'left-[-0.75rem]' : p.x > 78 ? 'right-[-0.75rem]' : 'left-1/2');

/**
 * The idea journey as a climb: waypoints are the usual step markers and the trail fills in as
 * steps are approved. Clicking a stop (`md`) opens its details, with a way to go there when it is open.
 */
export function SummitTrail({ steps, size = 'md', briefMarker = 'summit', beyond, onSelectStep }: SummitTrailProps) {
  const gradId = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { main, pos, beyond: beyondPt, loops, trailPts, progressPts } = layoutTrail(steps, FRAME[size], !!beyond);
  const band = FRAME[size];

  useEffect(() => {
    if (!openKey) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpenKey(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openKey]);

  const ridgeFront = `${smooth(trailPts.map(p => ({ x: p.x, y: Math.min(100, p.y + 10) })))} L 100 ${Math.min(100, (trailPts.at(-1)?.y ?? 50) + 12)} L 100 100 L 0 100 L 0 ${Math.min(100, (trailPts[0]?.y ?? 80) + 10)} Z`;
  const ridgeBack = `M 0 ${band.base - 6} C 18 ${band.top + 26}, 30 ${band.top + 10}, 46 ${band.top + 22} S 70 ${band.top - 4}, 84 ${band.top + 6} S 96 ${band.top + 2}, 100 ${band.top + 8} L 100 100 L 0 100 Z`;

  const beyondStep: ProgressStep | null = beyond
    ? { key: BEYOND_KEY, label: beyond.label, icon: Mountain, state: beyond.state, detail: beyond.detail, disabled: true }
    : null;

  const toggle = (key: string) => setOpenKey(k => (k === key ? null : key));

  return (
    <div ref={rootRef} className={`relative w-full ${HEIGHT[size]} select-none`} aria-hidden={size === 'xs' || undefined}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`sky-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity="0.14" />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {size === 'md' && (
          <>
            <path d={ridgeBack} className="fill-primary/[0.07]" />
            <path d={ridgeFront} fill={`url(#sky-${gradId})`} />
          </>
        )}
        <path
          d={smooth(trailPts)}
          className={`fill-none ${size === 'xs' ? 'stroke-border' : 'stroke-muted-foreground/30'}`}
          strokeWidth={size === 'xs' ? 1.5 : 2}
          strokeDasharray={size === 'xs' ? undefined : '4 5'}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {loops.map(l => (
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
        {progressPts.length > 1 && (
          <path
            d={smooth(progressPts)}
            className="fill-none stroke-emerald-500"
            strokeWidth={size === 'xs' ? 2 : 3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {main.concat(steps.filter(s => s.optional)).map(s => {
        const p = pos.get(s.key)!;
        const isCurrent = s.state === 'current';
        const last = !s.optional && main.indexOf(s) === main.length - 1;
        const summitHere = last && briefMarker === 'summit';
        const campHere = last && briefMarker === 'camp';

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

        const open = openKey === s.key;
        const status = stopStatus(s, steps);
        const canGo = !!onSelectStep && !s.disabled && !isCurrent;
        return (
          <div
            key={s.key}
            className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${open ? 'z-30' : 'hover:z-20 focus-within:z-20'}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {!isCurrent && !open && (
              <span className="absolute bottom-full mb-1 px-2 py-0.5 rounded-full bg-card border border-border text-foreground text-ui-xs font-semibold whitespace-nowrap shadow-sm opacity-0 translate-y-1 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-y-0">
                {s.label}{s.disabled ? <span className="ml-1 font-normal text-muted-foreground">· locked</span> : null}
              </span>
            )}
            {summitHere && (
              <span className="absolute inset-0 pointer-events-none">
                <SummitFlag reached={s.state === 'done'} size="md" />
              </span>
            )}
            {campHere && (
              <span className={`absolute bottom-full mb-1 flex items-center gap-1 text-ui-3xs font-semibold uppercase tracking-[0.14em] whitespace-nowrap ${s.state === 'done' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/80'}`}>
                <Tent className="w-3 h-3" />
              </span>
            )}
            {isCurrent && !last && (
              <span className="absolute bottom-full mb-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-ui-xs font-semibold whitespace-nowrap">
                {s.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggle(s.key)}
              aria-label={`${s.label}: ${status === 'current' ? 'you are here' : status}. Show details`}
              aria-expanded={open}
              aria-current={isCurrent ? 'step' : undefined}
              className={`relative rounded-full transition-transform cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${open ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''} ${s.disabled && !open ? 'opacity-60 hover:opacity-100' : ''}`}
            >
              {isCurrent && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping motion-reduce:hidden" />}
              <StepDot icon={s.icon} state={s.state} prefilled={s.prefilled} size="md" />
            </button>
            <AnimatePresence>
              {open && (
                <StopPopover align={popoverAlign(p)}>
                  <StopSummary
                    size="sm"
                    step={s}
                    position={stopPosition(s, steps)}
                    status={status}
                    onGo={canGo ? () => { setOpenKey(null); onSelectStep!(s.key); } : undefined}
                  />
                </StopPopover>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {beyond && beyondPt && beyondStep && (
        size === 'xs' ? (
          <span
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${PROGRESS_TOKENS.segment[beyond.state]}`}
            style={{ left: `${beyondPt.x}%`, top: `${beyondPt.y}%` }}
          >
            {beyond.state === 'done' && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px w-0.5 h-2 rounded-full bg-amber-500" />}
          </span>
        ) : (
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${openKey === BEYOND_KEY ? 'z-30' : ''}`}
            style={{ left: `${beyondPt.x}%`, top: `${beyondPt.y}%` }}
          >
            <SummitFlag reached={beyond.state === 'done'} size="md" />
            <button
              type="button"
              onClick={() => toggle(BEYOND_KEY)}
              aria-label={`${beyond.label}. Show details`}
              aria-expanded={openKey === BEYOND_KEY}
              className={`rounded-full cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${beyond.state === 'upcoming' ? 'opacity-60 hover:opacity-100' : ''}`}
            >
              <StepDot icon={Mountain} state={beyond.state} size="md" />
            </button>
            <AnimatePresence>
              {openKey === BEYOND_KEY && (
                <StopPopover align={popoverAlign(beyondPt)}>
                  <StopSummary size="sm" step={beyondStep} position="After your brief" status={stopStatus(beyondStep, [...steps, beyondStep])} />
                </StopPopover>
              )}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}

function StopPopover({ align, children }: { align: string; children: ReactNode }) {
  const centered = align === 'left-1/2';
  return (
    <motion.div
      role="dialog"
      initial={{ opacity: 0, y: -4, scale: 0.98, x: centered ? '-50%' : 0 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: centered ? '-50%' : 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98, x: centered ? '-50%' : 0 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      style={{ transformOrigin: 'top center' }}
      className={`absolute top-full mt-3 w-72 rounded-2xl border border-border bg-popover p-4 text-left shadow-xl cursor-default select-text ${align}`}
    >
      {children}
    </motion.div>
  );
}
