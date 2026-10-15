import { Check, type LucideIcon } from 'lucide-react';
import { PROGRESS_TOKENS, type StepState } from '../tokens';

const SIZE = { sm: 'w-6 h-6', md: 'w-7 h-7' };
const ICON = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5' };

/** A labelled step marker: the step's icon while upcoming, a filled ring when current, a check when done. */
export function StepDot({ icon: Icon, state, prefilled, size = 'md' }: { icon: LucideIcon; state: StepState; prefilled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className={`relative shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ${SIZE[size]} ${PROGRESS_TOKENS.dot[state]}`}>
      {state === 'done' ? <Check className={ICON[size]} strokeWidth={3} /> : <Icon className={ICON[size]} />}
      {prefilled && state !== 'done' && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-background" aria-hidden />
      )}
    </span>
  );
}

/** The dense variant for rails with many steps; same tokens as StepDot. */
export function StepSegment({ state }: { state: StepState }) {
  return <span className={`block h-1.5 rounded-full transition-all duration-500 ${PROGRESS_TOKENS.segment[state]} ${state === 'current' ? 'scale-y-125' : ''}`} />;
}

/** Line between two markers that fills once the left one is done. */
export function StepConnector({ done, className = '' }: { done: boolean; className?: string }) {
  return (
    <span className={`flex-1 h-px relative overflow-hidden min-w-3 ${PROGRESS_TOKENS.connector.upcoming} ${className}`}>
      <span className={`absolute inset-y-0 left-0 transition-all duration-500 ${PROGRESS_TOKENS.connector.done} ${done ? 'w-full' : 'w-0'}`} />
    </span>
  );
}
