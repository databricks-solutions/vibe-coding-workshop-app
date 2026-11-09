import type { ReactNode } from 'react';
import type { ProgressStep } from './JourneyProgress';

export interface DockProgress {
  steps: ProgressStep[];
  onSelectStep?: (key: string) => void;
  /** What comes after the last step, e.g. "Genie build". */
  beyondLabel?: string;
}

interface StepDockProps extends DockProgress {
  /** Actions on the right: Back, quiet extras and the one primary button. */
  actions?: ReactNode;
}

/**
 * The sticky action area. Direct step navigation lives at the top; this dock only
 * says where you are and keeps Back/Next/Approve within reach.
 */
export function StepDock({ steps, beyondLabel, actions }: StepDockProps) {
  const here = steps.findIndex(s => s.state === 'current');
  const current = steps[Math.max(0, here)];
  const complete = steps.every(s => s.completed);
  const remaining = steps.filter((s, i) => i > here && !s.optional && !s.completed).length;
  const helper = complete
    ? 'All steps complete'
    : remaining > 0
      ? `${remaining} required step${remaining === 1 ? '' : 's'} after this`
      : beyondLabel ? `Then: ${beyondLabel}` : 'Last required step';

  return (
    <div className="sticky bottom-0 z-20 -mx-3 sm:-mx-4 mt-6 px-3 sm:px-4 py-3 border-t border-border/70 bg-background/90 backdrop-blur-md shadow-[0_-10px_24px_-18px_rgb(0_0_0/0.25)]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        {current && (
          <p className="flex-1 min-w-0 text-ui-sm" aria-live="polite">
            <span className="font-semibold text-foreground tabular-nums">
              {complete ? 'Reviewing ' : ''}Step {here + 1} of {steps.length}
            </span>
            <span className="text-muted-foreground"> · {current.label}{current.optional ? ' (optional)' : ''}</span>
            <span className="hidden md:inline text-muted-foreground/70"> · {helper}</span>
          </p>
        )}
        {actions && <div className="flex items-center justify-end gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
