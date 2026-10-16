import { Check, Hammer, RotateCcw, Send, X } from 'lucide-react';
import { isApproved } from '../engine/approval';
import type { Idea } from '../engine/types';

type Mark = 'todo' | 'current' | 'done' | 'returned' | 'rejected';

function marks(idea: Idea, building: boolean): [Mark, Mark, Mark] {
  const s = idea.review?.status;
  if (building && isApproved(idea)) return ['done', 'done', 'current'];
  if (isApproved(idea)) return ['done', 'done', 'todo'];
  if (s === 'pending') return ['done', 'current', 'todo'];
  if (s === 'changes_requested') return ['done', 'returned', 'todo'];
  if (s === 'rejected') return ['done', 'rejected', 'todo'];
  return ['todo', 'todo', 'todo'];
}

const STEP_LABEL = ['Submitted', 'Approved', 'Building'];
const MARK_LABEL: Partial<Record<Mark, string>> = { current: 'In review', returned: 'Returned', rejected: 'Not approved' };
const ICONS = [Send, Check, Hammer];

/** Submitted, Approved, Building: where the idea is on its way to a build. */
export function ApprovalTracker({ idea, building = false, size = 'sm', className = '' }: { idea: Idea; building?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const m = marks(idea, building);
  const dot = size === 'md' ? 'w-6 h-6' : 'w-4 h-4';
  const icon = size === 'md' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  const text = size === 'md' ? 'text-ui-xs' : 'text-ui-2xs';
  return (
    <ol className={`flex items-center gap-1 ${className}`} aria-label="Approval progress">
      {m.map((mark, i) => {
        const Icon = mark === 'returned' ? RotateCcw : mark === 'rejected' ? X : mark === 'done' ? Check : ICONS[i];
        const tone = mark === 'done' ? 'bg-emerald-500 text-white'
          : mark === 'current' ? (i === 1 ? 'bg-amber-500 text-white motion-safe:animate-pulse' : 'bg-primary text-primary-foreground')
          : mark === 'returned' ? 'bg-sky-500 text-white'
          : mark === 'rejected' ? 'bg-red-500 text-white'
          : 'bg-secondary text-muted-foreground';
        const label = (mark !== 'todo' && mark !== 'done' && MARK_LABEL[mark]) || STEP_LABEL[i];
        return (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className={`h-px ${size === 'md' ? 'w-6' : 'w-3'} ${m[i - 1] === 'done' ? 'bg-emerald-500/60' : 'bg-border'}`} />}
            <span className={`${dot} rounded-full flex items-center justify-center transition-colors duration-500 ${tone}`} title={label}>
              <Icon className={icon} />
            </span>
            <span className={`${text} font-medium ${mark === 'todo' ? 'text-muted-foreground/70' : 'text-foreground'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
