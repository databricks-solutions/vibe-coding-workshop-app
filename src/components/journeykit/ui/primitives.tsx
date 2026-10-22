import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE } from '../tokens';

export function PrimaryButton({ children, className = '', size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        size === 'lg' ? 'h-12 px-6 text-ui-lg' : 'h-10 px-5 text-ui-md'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-ui-md font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-ui-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/50 disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary/90">{children}</p>;
}

/** Large, calm page heading used at the top of every guided screen; `art` adds the step illustration. */
export function Headline({ eyebrow, title, subtitle, art }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; art?: string }) {
  return (
    <div className="flex items-start gap-5">
      {art && (
        <img
          src={art}
          alt=""
          width={72}
          height={72}
          className="hidden sm:block w-[72px] h-[72px] rounded-2xl object-cover ring-1 ring-border/60 shrink-0"
        />
      )}
      <div className="space-y-3 min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">{title}</h1>
        {subtitle && <p className="text-ui-lg text-muted-foreground max-w-xl leading-relaxed">{subtitle}</p>}
      </div>
    </div>
  );
}

export function FadeIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * What a screen shows while it loads, instead of an empty area. Waits a moment before
 * appearing so fast loads don't flash a spinner.
 */
export function PageLoader({ label, className = 'min-h-[50vh]' }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, delay: 0.15, ease: EASE }}
        className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/90 px-4 py-2.5 shadow-sm backdrop-blur"
      >
        <span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin" aria-hidden />
        <span className="text-ui-sm font-medium text-foreground">{label}</span>
      </motion.div>
    </div>
  );
}

export function ProgressRing({ value, size = 56, stroke = 5, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
