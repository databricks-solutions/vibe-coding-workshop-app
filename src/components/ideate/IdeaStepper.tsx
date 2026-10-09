import { Check } from 'lucide-react';
import { stepIndex } from './ideaContext';
import { STEP_ART } from './art';
import { STEPS, type Idea, type StepKey } from './types';

interface IdeaStepperProps {
  idea: Idea;
  viewStep: StepKey;
  onSelect: (step: StepKey) => void;
}

export function IdeaStepper({ idea, viewStep, onSelect }: IdeaStepperProps) {
  const furthest = stepIndex(idea.step);
  return (
    <ol className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((s, i) => {
        const approved = idea.approved.includes(s.key);
        const reachable = i <= furthest;
        const active = s.key === viewStep;
        const Icon = STEP_ART[s.key].icon;
        return (
          <li key={s.key} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(s.key)}
              className={`flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition-all ${
                active ? 'bg-primary/10' : reachable ? 'hover:bg-secondary/60' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-ui-2xs font-semibold transition-all duration-300 ${
                  approved
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-secondary text-muted-foreground'
                }`}
              >
                {approved ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </span>
              <span className={`hidden md:inline text-ui-sm font-medium whitespace-nowrap ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="flex-1 h-px bg-border relative overflow-hidden min-w-3">
                <span className={`absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500 ${approved ? 'w-full' : 'w-0'}`} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
