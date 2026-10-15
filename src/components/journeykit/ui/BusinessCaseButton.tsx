import { ArrowUpRight, FileText, Share2 } from 'lucide-react';
import type { Idea } from '../engine/types';

const CASE_LABEL = 'Business case 1-pager';
const CASE_HINT = 'View the one-page business case, ready to share with your sponsor';

interface BusinessCaseButtonProps {
  /** Until this idea's 1-pager has been opened once, the button gently invites a click. */
  idea?: Idea;
  onClick: () => void;
  /** `compact` fits toolbars, `default` fits cards, `quiet` is a plain text button for dense headers. */
  variant?: 'compact' | 'default' | 'quiet';
  className?: string;
}

/** The one way into the business case 1-pager, shared by Ideate and Insights. */
export function BusinessCaseButton({ idea, onClick, variant = 'default', className = '' }: BusinessCaseButtonProps) {
  if (variant === 'quiet') {
    return (
      <button onClick={onClick} title={CASE_HINT} aria-label={CASE_HINT} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors ${className}`}>
        <FileText className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">{CASE_LABEL}</span>
        <span className="sm:hidden">1-pager</span>
      </button>
    );
  }

  const compact = variant === 'compact';
  const invite = !!idea && !idea.caseOpenedAt;
  return (
    <button
      onClick={onClick}
      title={CASE_HINT}
      aria-label={CASE_HINT}
      data-invite={invite || undefined}
      className={`case-cta group inline-flex items-center justify-center font-semibold shrink-0 ${compact ? 'gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-ui-sm' : 'gap-2 pl-4 pr-2 py-2 rounded-xl text-ui-sm'} ${className}`}
    >
      <FileText className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span>{CASE_LABEL}</span>
      <span className={`case-cta-chip hidden sm:inline-flex items-center gap-1 rounded-md font-medium ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-ui-xs'}`}>
        <Share2 className="w-3 h-3" /> Ready to share
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
    </button>
  );
}
