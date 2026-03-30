import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableErrorBannerProps {
  /** The full error string (shown in the expandable detail section) */
  error: string;
  /** Summary line shown before expanding (e.g. "Generation failed — click Re-generate to try again") */
  summary: React.ReactNode;
  /** Extra Tailwind classes on the outer wrapper (e.g. "mt-3") */
  className?: string;
}

/**
 * A red error banner that shows a short summary by default.
 * Clicking it expands to reveal the full error details.
 */
export function ExpandableErrorBanner({ error, summary, className = '' }: ExpandableErrorBannerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-[12px] overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 transition-colors cursor-pointer"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
        <span className="flex-1 text-left">{summary}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-red-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-red-400" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-red-700/30">
          <pre className="whitespace-pre-wrap break-all text-[11px] text-red-300/80 font-mono leading-relaxed max-h-40 overflow-y-auto">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}
