interface OutputStatsFooterProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Shared footer showing line/character counts and a streaming indicator.
 * Used across all LLM generation surfaces for a consistent look.
 */
export function OutputStatsFooter({ content, isStreaming = false }: OutputStatsFooterProps) {
  const safeContent = content ?? '';
  const lineCount = safeContent ? safeContent.split('\n').length : 0;
  const charCount = safeContent.length;

  return (
    <div className="flex items-center justify-between text-ui-xs text-muted-foreground pt-0.5">
      <span>
        {lineCount.toLocaleString()} lines • {charCount.toLocaleString()} characters
      </span>
      {isStreaming && <span className="text-primary/80 animate-pulse">Generating…</span>}
    </div>
  );
}
