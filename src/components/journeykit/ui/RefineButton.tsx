import type { LucideIcon } from 'lucide-react';

const TONE = {
  primary: { chip: 'bg-primary/10 text-primary', hover: 'hover:border-primary/50 hover:bg-primary/[0.04]' },
  violet: { chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', hover: 'hover:border-violet-400/60 hover:bg-violet-500/[0.05]' },
};

/** A labelled refine action: icon, what it does, and a one-line hint, so it reads as a real choice. */
export function RefineButton({ icon: Icon, tone, label, hint, onClick, disabled, spin, badge }: {
  icon: LucideIcon; tone: keyof typeof TONE; label: string; hint: string; onClick: () => void; disabled?: boolean; spin?: boolean;
  /** e.g. the points it earns */
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-sm transition-all ${TONE[tone].hover} hover:-translate-y-px disabled:opacity-50 disabled:pointer-events-none`}
    >
      <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${TONE[tone].chip}`}>
        <Icon className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-ui-sm font-semibold text-foreground leading-tight">
          {label}
          {badge && <span className="px-1.5 py-px rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-ui-3xs font-semibold tabular-nums">{badge}</span>}
        </span>
        <span className="block text-ui-2xs text-muted-foreground leading-tight mt-0.5">{hint}</span>
      </span>
    </button>
  );
}
