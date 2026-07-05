interface TruncationWarningBannerProps {
  message: string;
  className?: string;
}

/**
 * Shared amber banner shown when LLM generation stops at the token limit.
 * Used across all generation surfaces for a consistent look.
 */
export function TruncationWarningBanner({ message, className = '' }: TruncationWarningBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-ui-sm ${className}`}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
      <p>{message}</p>
    </div>
  );
}
