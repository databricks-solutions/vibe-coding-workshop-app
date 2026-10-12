import type { LucideIcon } from 'lucide-react';
import { PROGRESS_TOKENS, type StepState } from '../tokens';
import { StepConnector, StepDot } from './StepDot';

export interface ProgressStep {
  key: string;
  label: string;
  icon: LucideIcon;
  state: StepState;
  prefilled?: boolean;
  optional?: boolean;
  disabled?: boolean;
}

export interface ProgressPhase {
  key: string;
  label: string;
  icon: LucideIcon;
  state: StepState;
  /** Sub-steps, shown expanded while this phase is current. */
  steps?: ProgressStep[];
}

interface JourneyProgressProps {
  /** Phased journey (Insights). Omit to show a single flat track of `steps` (Ideate). */
  phases?: ProgressPhase[];
  steps?: ProgressStep[];
  onSelectStep?: (key: string) => void;
  /** Muted note after the last phase, e.g. "then 4 build chapters". */
  trailing?: string;
}

const stepTitle = (s: ProgressStep) => `${s.label}${s.prefilled ? ' (pre-filled)' : ''}${s.optional ? ' (optional)' : ''}`;

/**
 * The dense track inside a phase pill: the current step keeps its marker and label,
 * the rest shrink to small dots so seven steps fit beside the other phases.
 */
function CompactTrack({ steps, onSelect }: { steps: ProgressStep[]; onSelect?: (key: string) => void }) {
  const hasCurrent = steps.some(s => s.state === 'current');
  return (
    <ol className="flex items-center gap-1 min-w-0">
      {steps.map(s => {
        const current = s.state === 'current';
        const mini = hasCurrent && !current;
        return (
          <li key={s.key} className="flex shrink-0">
            <button
              type="button"
              disabled={s.disabled || !onSelect}
              onClick={() => onSelect?.(s.key)}
              title={stepTitle(s)}
              aria-label={stepTitle(s)}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full transition-all ${
                current ? 'bg-primary/10 pl-0.5 pr-2.5 py-0.5' : mini ? 'p-1' : 'p-0.5'
              } ${s.disabled ? 'cursor-not-allowed' : current ? '' : 'hover:bg-secondary/60'}`}
            >
              {mini ? (
                <span className={`block w-2 h-2 rounded-full transition-colors ${s.prefilled && s.state !== 'done' ? 'bg-amber-400' : PROGRESS_TOKENS.segment[s.state]}`} />
              ) : (
                <StepDot icon={s.icon} state={s.state} prefilled={s.prefilled} size="sm" />
              )}
              {current && (
                <span className="text-ui-sm font-medium whitespace-nowrap text-foreground">
                  {s.label}
                  {s.prefilled && <span className={`ml-1.5 text-ui-3xs font-semibold uppercase tracking-wide ${PROGRESS_TOKENS.prefilled}`}>Pre-filled</span>}
                  {s.optional && !s.prefilled && <span className="ml-1 text-ui-3xs font-normal text-muted-foreground/60">optional</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The full track (Ideate): every step keeps its marker. The current step always shows its
 * label; the others show theirs from lg up and truncate rather than run into the connectors.
 */
function StepTrack({ steps, onSelect }: { steps: ProgressStep[]; onSelect?: (key: string) => void }) {
  return (
    <ol className="flex items-center gap-1.5 flex-1 min-w-0">
      {steps.map((s, i) => {
        const current = s.state === 'current';
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className={`flex items-center gap-1.5 min-w-0 ${last ? '' : 'flex-1'} ${current ? 'shrink-0' : ''}`}>
            <button
              type="button"
              disabled={s.disabled || !onSelect}
              onClick={() => onSelect?.(s.key)}
              title={stepTitle(s)}
              aria-label={stepTitle(s)}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-2 min-w-0 rounded-full transition-all pl-0.5 py-0.5 ${current ? 'pr-3 shrink-0 bg-primary/10 ring-1 ring-primary/20' : 'pr-0.5 lg:pr-2'} ${
                s.disabled ? 'opacity-50 cursor-not-allowed' : current ? '' : 'hover:bg-secondary/60'
              }`}
            >
              <StepDot icon={s.icon} state={s.state} prefilled={s.prefilled} size="md" />
              <span
                className={`text-ui-sm font-medium whitespace-nowrap ${
                  current ? 'inline text-foreground' : `hidden lg:inline truncate ${s.state === 'done' ? 'text-foreground/80' : 'text-muted-foreground'}`
                }`}
              >
                {s.label}
                {current && s.prefilled && <span className={`ml-1.5 text-ui-3xs font-semibold uppercase tracking-wide ${PROGRESS_TOKENS.prefilled}`}>Pre-filled</span>}
                {current && s.optional && !s.prefilled && <span className="ml-1 text-ui-3xs font-normal text-muted-foreground/60">optional</span>}
              </span>
            </button>
            {!last && <StepConnector done={s.state === 'done'} />}
          </li>
        );
      })}
    </ol>
  );
}

function mobileSummary(phases: ProgressPhase[]) {
  const phase = phases.find(p => p.state === 'current') ?? phases[phases.length - 1];
  const steps = phase.steps;
  const i = steps?.findIndex(s => s.state === 'current') ?? -1;
  return steps && i >= 0 ? `${phase.label} · step ${i + 1} of ${steps.length}: ${steps[i].label}` : phase.label;
}

/** The one progress bar for every guided flow: same markers, colours and motion everywhere. */
export function JourneyProgress({ phases, steps, onSelectStep, trailing }: JourneyProgressProps) {
  if (!phases) return <StepTrack steps={steps ?? []} onSelect={onSelectStep} />;
  const anyExpanded = phases.some(p => p.state === 'current' && !!p.steps?.length);

  return (
    <nav aria-label="Progress" className="min-w-0 flex-1">
      <ol className="hidden sm:flex items-center gap-2">
        {phases.map((p, i) => {
          const expanded = p.state === 'current' && !!p.steps?.length;
          const last = i === phases.length - 1;
          return (
            <li key={p.key} className={`flex items-center gap-2 ${expanded ? 'flex-1 min-w-0' : anyExpanded || last ? 'shrink-0' : 'flex-1 min-w-0'}`}>
              {expanded ? (
                <div className="flex items-center gap-2.5 flex-1 min-w-0 rounded-full border border-primary/15 bg-primary/[0.05] pl-3 pr-1.5 py-1">
                  <span className="text-ui-xs font-semibold uppercase tracking-wider text-primary whitespace-nowrap">{p.label}</span>
                  <CompactTrack steps={p.steps!} onSelect={onSelectStep} />
                </div>
              ) : (
                <span className="flex items-center gap-2 shrink-0" aria-current={p.state === 'current' ? 'step' : undefined}>
                  <StepDot icon={p.icon} state={p.state} size="sm" />
                  <span className={`text-ui-sm font-medium whitespace-nowrap ${p.state === 'current' ? 'text-foreground' : 'text-muted-foreground'}`}>{p.label}</span>
                </span>
              )}
              {!last && <StepConnector done={p.state === 'done'} className={anyExpanded ? 'flex-none w-6 lg:w-10' : ''} />}
            </li>
          );
        })}
        {trailing && <li className="hidden lg:block pl-1 text-ui-xs text-muted-foreground/60 whitespace-nowrap">{trailing}</li>}
      </ol>
      <p className="sm:hidden text-ui-sm font-medium text-muted-foreground">
        <span className="text-primary">●</span> {mobileSummary(phases)}
      </p>
    </nav>
  );
}
