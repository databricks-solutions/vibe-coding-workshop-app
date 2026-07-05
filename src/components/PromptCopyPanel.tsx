import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { CopyButton } from './CopyButton';
import { ExpandableOutputModal } from './ExpandableOutputModal';
import { OutputStatsFooter } from './OutputStatsFooter';
import { TruncationWarningBanner } from './TruncationWarningBanner';
import { REMARK_PLUGINS, MARKDOWN_COMPONENTS } from './MarkdownContent';

export interface PromptCopyPanelProps {
  content: string;
  isStreaming?: boolean;
  copied: boolean;
  onCopy: () => void;
  title: string;
  truncationWarning?: string | null;
}

/**
 * Copy-first full-text panel for PRD Generation (Step 3).
 * Shows the entire generated prompt in a scrollable read-only field.
 */
export function PromptCopyPanel({
  content,
  isStreaming = false,
  copied,
  onCopy,
  title,
  truncationWarning,
}: PromptCopyPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const safeContent = content ?? '';

  useEffect(() => {
    if (!isStreaming || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [safeContent, isStreaming]);

  if (!safeContent && !isStreaming) {
    return null;
  }

  return (
    <div className="space-y-2">
      {truncationWarning && !isStreaming && (
        <TruncationWarningBanner message={truncationWarning} />
      )}

      <div className="flex items-center justify-end gap-2">
        {safeContent && (
          <>
            <ExpandableOutputModal
              content={safeContent}
              title={title}
              isStreaming={isStreaming}
              buttonColor="primary"
              variant="markdown"
            />
            <CopyButton
              copied={copied}
              onClick={onCopy}
              showGlow={!copied && !isStreaming}
              disabled={!safeContent}
            />
          </>
        )}
        {isStreaming && (
          <span className="text-ui-2xs text-primary animate-pulse ml-1">Streaming…</span>
        )}
      </div>

      <div
        ref={scrollRef}
        aria-label="Generated prompt — formatted preview (copy button copies the raw markdown)"
        className="markdown-content w-full min-h-[40vh] max-h-[60vh] overflow-y-auto bg-background border border-border rounded-lg px-4 py-3 focus:outline-none scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {safeContent}
        </ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
        )}
      </div>

      <OutputStatsFooter content={safeContent} isStreaming={isStreaming} />
    </div>
  );
}
