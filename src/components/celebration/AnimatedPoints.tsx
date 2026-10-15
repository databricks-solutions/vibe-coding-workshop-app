import { useEffect, useRef, useState } from 'react';

/** Counts up to `points` with an ease-out; starts from `from` so a total can tick up from its last value. */
export function AnimatedPoints({
  points,
  from = 0,
  duration = 800,
  prefix = '+',
  suffix = '',
}: {
  points: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(from);
  const startRef = useRef(from);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = startRef.current;
    const length = reduce || start === points ? 0 : duration;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = length ? Math.min((Date.now() - t0) / length, 1) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (points - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else startRef.current = points;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [points, duration]);

  return <span className="tabular-nums">{prefix}{display.toLocaleString()}{suffix}</span>;
}
