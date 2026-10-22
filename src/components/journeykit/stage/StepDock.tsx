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

const SEGMENT: Record<ProgressStep['state'], string> = {
  done: 'bg-emerald-500',
  current: 'bg-primary',
  upcoming: 'bg-border',
};

function segmentTitle(s: ProgressStep, i: number) {
  const status = s.state === 'done' ? 'done' : s.state === 'current' ? 'you are here' : s.disabled ? 'locked' : 'open';
  return `Step ${i + 1}: ${s.label}${s.optional ? ' (optional)' : ''} · ${status}`;
}

/**
 * Where you are in the journey, pinned to the bottom of the screen beside the action you take
 * next. The current step's segment is the wide one; done steps fill in green.
 */
export function StepDock({ steps, onSelectStep, beyondLabel, actions }: StepDockProps) {
  const here = steps.findIndex(s => s.state === 'current');
  const current = steps[here];
  const after = steps.filter((s, i) => i > here && !s.optional);
  const ahead = after.filter(s => s.state !== 'done');
  const minutes = ahead.reduce((n, s) => n + (s.minutes ?? 0), current?.minutes ?? 0);
  const remaining = after.length === 0
    ? beyondLabel ? `Then: ${beyondLabel}` : 'Last step'
    : ahead.length === 0 ? 'The rest of the route is done'
    : `${ahead.length} to go · about ${minutes} min`;

  return (
    <div className="sticky bottom-0 z-20 -mx-3 sm:-mx-4 mt-6 px-3 sm:px-4 py-3 border-t border-border/70 bg-background/90 backdrop-blur-md shadow-[0_-10px_24px_-18px_rgb(0_0_0/0.25)]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
        <nav aria-label="Your progress" className="flex-1 min-w-0 w-full">
          <ol className="flex items-center gap-1">
            {steps.map((s, i) => {
              const isCurrent = s.state === 'current';
              const canGo = !!onSelectStep && !s.disabled && !isCurrent;
              const optionalOpen = s.optional && s.state === 'upcoming';
              return (
                <li key={s.key} className={`min-w-0 transition-[flex-grow] duration-500 ease-out ${isCurrent ? 'grow-[2.4]' : 'grow'}`} style={{ flexBasis: 0 }}>
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => onSelectStep?.(s.key)}
                    title={segmentTitle(s, i)}
                    aria-label={segmentTitle(s, i)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className="group block w-full py-2 disabled:cursor-default"
                  >
                    <span
                      className={`block rounded-full transition-colors duration-500 ${
                        isCurrent ? 'h-2 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]' : 'h-1.5'
                      } ${
                        optionalOpen ? 'border border-dashed border-amber-400/80 bg-transparent' : SEGMENT[s.state]
                      } ${canGo ? 'group-hover:opacity-70' : ''}`}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
          {current && (
            <p className="flex items-baseline gap-1.5 text-ui-xs min-w-0 -mt-0.5" aria-live="polite">
              <span className="font-semibold text-foreground whitespace-nowrap tabular-nums">
                <span className="sm:hidden">{here + 1}/{steps.length}</span>
                <span className="hidden sm:inline">Step {here + 1} of {steps.length}</span>
              </span>
              <span className="text-muted-foreground truncate">· {current.label}{current.optional ? ' (optional)' : ''}</span>
              <span className="hidden sm:inline text-muted-foreground/70 whitespace-nowrap">· {remaining}</span>
            </p>
          )}
        </nav>
        {actions && <div className="flex items-center justify-end gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
