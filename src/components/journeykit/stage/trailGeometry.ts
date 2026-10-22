import type { ProgressStep } from './JourneyProgress';

export interface Pt { x: number; y: number }

export type StopStatus = 'done' | 'current' | 'next' | 'open' | 'locked';

/** Where a trail sits in its 0..100 box: the vertical band it climbs and how far in its ends are. */
export interface TrailFrame {
  base: number;
  top: number;
  left: number;
  right: number;
  /** Right end of the brief when a further peak follows it. */
  rightWithBeyond: number;
  beyondX: number;
  /** How far below the trail an optional detour dips. */
  dip: number;
}

/** Catmull-Rom through the points, as cubic Beziers, in the 0..100 viewBox. */
export function smooth(pts: Pt[]): string {
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

/** Places required steps on a gentle rolling climb and optional ones on a short loop below it. */
export function layoutTrail(steps: ProgressStep[], frame: TrailFrame, hasBeyond: boolean) {
  const main = steps.filter(s => !s.optional);
  const { base, top, left } = frame;
  const right = hasBeyond ? frame.rightWithBeyond : frame.right;
  const pos = new Map<string, Pt>();
  main.forEach((s, k) => {
    const t = main.length > 1 ? k / (main.length - 1) : 1;
    // Mostly up, with a small dip so it reads as hills rather than a ramp.
    const roll = Math.sin(t * Math.PI * 2.2) * (base - top) * 0.08;
    const peak = hasBeyond ? top + (base - top) * 0.3 : top;
    pos.set(s.key, { x: left + (right - left) * t, y: base - (base - peak) * t + roll });
  });
  steps.forEach((s, i) => {
    if (!s.optional) return;
    const prev = [...steps.slice(0, i)].reverse().find(p => !p.optional);
    const next = steps.slice(i + 1).find(p => !p.optional);
    const a = prev ? pos.get(prev.key)! : { x: left, y: base };
    const b = next ? pos.get(next.key)! : a;
    pos.set(s.key, { x: (a.x + b.x) / 2, y: Math.min(94, Math.max(a.y, b.y) + frame.dip) });
  });
  const beyond = hasBeyond ? { x: frame.beyondX, y: top } : null;

  const loops = steps.filter(s => s.optional).map(s => {
    const i = steps.indexOf(s);
    const prev = [...steps.slice(0, i)].reverse().find(p => !p.optional);
    const next = steps.slice(i + 1).find(p => !p.optional);
    const o = pos.get(s.key)!;
    const a = prev ? pos.get(prev.key)! : o;
    const b = next ? pos.get(next.key)! : a;
    return { key: s.key, d: smooth([a, o, b]), done: s.state === 'done' };
  });

  const mainPts = main.map(s => pos.get(s.key)!);
  const trailPts = beyond ? [...mainPts, beyond] : mainPts;
  const lastDone = main.reduce((n, s, i) => (s.state === 'done' ? i : n), -1);
  const reached = Math.max(lastDone, main.findIndex(s => s.state === 'current'));
  return { main, pos, beyond, loops, trailPts, progressPts: mainPts.slice(0, reached + 1) };
}

/** Where a stop stands relative to the person looking at the route. */
export function stopStatus(step: ProgressStep, steps: ProgressStep[]): StopStatus {
  if (step.state === 'done') return 'done';
  if (step.state === 'current') return 'current';
  const here = steps.findIndex(s => s.state === 'current');
  const next = steps.findIndex((s, i) => i > here && s.state !== 'done');
  if (here >= 0 && steps[next] === step) return 'next';
  return step.disabled ? 'locked' : 'open';
}

export function stopPosition(step: ProgressStep, steps: ProgressStep[]) {
  return `Step ${steps.indexOf(step) + 1} of ${steps.length}`;
}
