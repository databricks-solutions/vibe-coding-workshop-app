import { ArrowRight, Check, Clock, Lock, MapPin, Sparkles } from 'lucide-react';
import type { ProgressStep } from './JourneyProgress';
import { StepDot } from './StepDot';
import type { StopStatus } from './trailGeometry';


const STATUS: Record<StopStatus, { label: string; icon: typeof Check; cls: string }> = {
  done: { label: 'Done', icon: Check, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  current: { label: 'You are here', icon: MapPin, cls: 'bg-primary/10 text-primary' },
  next: { label: 'Up next', icon: ArrowRight, cls: 'bg-secondary text-foreground/80' },
  open: { label: 'Ready', icon: ArrowRight, cls: 'bg-secondary text-foreground/80' },
  locked: { label: 'Locked', icon: Lock, cls: 'bg-secondary text-muted-foreground' },
};

export function StopStatusChip({ status }: { status: StopStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-2xs font-semibold whitespace-nowrap ${s.cls}`}>
      <Icon className="w-3 h-3" strokeWidth={2.5} /> {s.label}
    </span>
  );
}

function PointsNote({ step }: { step: ProgressStep }) {
  if (!step.points?.available) return null;
  if (step.points.earned > 0) {
    return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><Check className="w-3 h-3" strokeWidth={3} /> {step.points.earned} pts</span>;
  }
  return <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> {step.optional ? 'up to ' : ''}+{step.points.available} pts</span>;
}

interface StopSummaryProps {
  step: ProgressStep;
  /** e.g. "Step 3 of 6", or "After your brief". */
  position: string;
  status: StopStatus;
  /** Opens the step; omitted when it can't be opened from here. */
  onGo?: () => void;
  goLabel?: string;
  size?: 'sm' | 'md';
}

/** What a stop on the route is: where it sits, what happens there, and whether you can go there yet. */
export function StopSummary({ step, position, status, onGo, goLabel = 'Go to this step', size = 'md' }: StopSummaryProps) {
  const big = size === 'md';
  const lockedNote = !step.disabled ? null
    : status === 'next' ? 'Opens when you confirm the step you are on.'
    : status === 'locked' ? 'Opens once you confirm the steps before it.'
    : null;
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <StepDot icon={step.icon} state={step.state} size={big ? 'lg' : 'md'} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`${big ? 'text-ui-lg' : 'text-ui-base'} font-semibold text-foreground leading-tight`}>{step.label}</p>
            <StopStatusChip status={status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-ui-xs text-muted-foreground tabular-nums">
            <span>{position}{step.optional ? ' · Optional' : ''}</span>
            {step.minutes != null && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> about {step.minutes} min</span>}
            <PointsNote step={step} />
          </p>
        </div>
      </div>
      {step.detail && <p className={`${big ? 'text-ui-base' : 'text-ui-sm'} text-muted-foreground leading-relaxed mt-2.5`}>{step.detail}</p>}
      {(onGo || lockedNote) && (
        <div className="mt-3 flex items-center">
          {onGo ? (
            <button
              type="button"
              onClick={onGo}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary text-ui-xs font-semibold transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {goLabel} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-ui-xs text-muted-foreground"><Lock className="w-3 h-3" /> {lockedNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
