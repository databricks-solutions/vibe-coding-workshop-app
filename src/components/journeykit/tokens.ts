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

/** Shared motion tokens so every guided screen moves the same way. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const DURATION = { fast: 0.16, base: 0.25, slow: 0.35 } as const;
