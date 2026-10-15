export type StepState = 'done' | 'current' | 'upcoming';

/** The single colour language for progress anywhere in the app. */
export const PROGRESS_TOKENS = {
  dot: {
    done: 'bg-emerald-500 text-white',
    current: 'bg-primary text-primary-foreground ring-4 ring-primary/20',
    upcoming: 'bg-secondary text-muted-foreground',
  },
  segment: {
    done: 'bg-emerald-500',
    current: 'bg-primary ring-2 ring-primary/25',
    upcoming: 'bg-border',
  },
  connector: { done: 'bg-emerald-500', upcoming: 'bg-border' },
  prefilled: 'text-amber-500 dark:text-amber-400',
} as const;

/** Idea Points tiers, mapped onto colours the app already uses (muted, brand, success, the milestone gold). */
export const TIER_TOKENS: Record<string, { chip: string; bar: string }> = {
  spark: { chip: 'bg-secondary text-muted-foreground', bar: 'bg-muted-foreground/50' },
  shaped: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  investable: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  boardroom: { chip: 'bg-gradient-to-r from-amber-400/20 to-orange-500/20 text-amber-600 dark:text-amber-400', bar: 'bg-gradient-to-r from-amber-400 to-orange-500' },
};

/** Same thresholds as the clarity ring: amber below 45, brand to 80, then success. */
export const scoreTone = (pct: number) => (pct >= 80 ? 'bg-emerald-500' : pct >= 45 ? 'bg-primary' : 'bg-amber-400');

/** Shared motion tokens so every guided screen moves the same way. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const DURATION = { fast: 0.16, base: 0.25, slow: 0.35 } as const;
