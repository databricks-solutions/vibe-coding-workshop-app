import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { ProgressStep } from './JourneyProgress';

const SHORT: Record<string, string> = {
  spark: 'Idea',
  map: 'Fit',
  clarify: 'Clarify',
  shape: 'Approach',
  questions: 'Genie questions',
  impact: 'ROI',
  brief: 'Brief',
};

/** The one persistent navigator for the seven Idea steps. */
export function IdeaStepNav({ steps, onSelectStep }: { steps: ProgressStep[]; onSelectStep: (key: string) => void }) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const currentKey = steps.find(step => step.state === 'current')?.key;
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentKey]);

  return (
    <nav aria-label="Idea steps" className="w-full overflow-x-auto [scrollbar-width:none]">
      <ol className="grid min-w-[760px] grid-cols-7 gap-2">
        {steps.map((step, index) => {
          const current = step.state === 'current';
          const done = step.completed || step.state === 'done';
          const reachable = !step.disabled;
          return (
            <li key={step.key}>
              <button
                ref={current ? activeRef : undefined}
                type="button"
                disabled={!reachable || current}
                onClick={() => onSelectStep(step.key)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${steps.length}: ${step.label}${done ? ', complete' : current ? ', current' : step.disabled ? ', locked' : ''}`}
                title={step.label}
                className={`group flex h-14 w-full items-center gap-2 rounded-xl border px-2.5 text-left transition-colors ${
                  current
                    ? 'border-primary/50 bg-primary/[0.08] text-foreground shadow-sm'
                    : done
                      ? 'border-emerald-500/25 bg-emerald-500/[0.04] text-foreground hover:bg-emerald-500/[0.08]'
                      : reachable
                        ? 'border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground'
                        : 'border-border/60 bg-secondary/20 text-muted-foreground/45'
                } disabled:cursor-default`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ui-xs font-semibold ${
                  current
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-secondary text-muted-foreground'
                }`}>
                  {done && !current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-ui-xs leading-tight ${current ? 'font-semibold' : 'font-medium'}`}>{SHORT[step.key] ?? step.label}</span>
                  {current && <span className="block text-ui-3xs text-primary mt-0.5">You are here</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
