import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

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

/** Large, calm page heading used at the top of every Insights screen. */
export function Headline({ eyebrow, title, subtitle }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="space-y-3">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">{title}</h1>
      {subtitle && <p className="text-ui-lg text-muted-foreground max-w-xl leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function FadeIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const STAGE_LABELS: Record<number, string[]> = {
  3: ['Ask', 'Data', 'Plan'],
  4: ['Ask', 'Data', 'Model', 'Plan'],
};

export function OnboardingProgress({ index, total = 3 }: { index: number; total?: number }) {
  const labels = STAGE_LABELS[total];
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${total}${labels ? `: ${labels[index]}` : ''}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <li key={i} className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1.5 ${current ? 'text-foreground' : done ? 'text-primary/80' : 'text-muted-foreground/60'}`}>
              <span className={`h-1 rounded-full transition-all duration-500 ${current ? 'w-8 bg-primary' : done ? 'w-4 bg-primary/50' : 'w-4 bg-border'}`} />
              {labels && <span className={`hidden sm:inline text-ui-xs font-medium ${current ? '' : 'opacity-80'}`}>{labels[i]}</span>}
            </span>
          </li>
        );
      })}
      <li className="hidden md:flex items-center gap-1 pl-1 text-ui-xs text-muted-foreground/50" aria-hidden>
        <span className="w-3 h-px bg-border" /> then 4 chapters
      </li>
    </ol>
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
