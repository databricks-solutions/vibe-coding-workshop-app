import { useState, useMemo, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Maximize2, Minimize2 } from 'lucide-react';
import { REMARK_PLUGINS, MARKDOWN_COMPONENTS } from './MarkdownContent.utils';

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
  maxPreviewLines?: number;
  className?: string;
  autoScrollOnStream?: boolean;
}

export interface MarkdownContentRef {
  collapse: () => void;
  expand: () => void;
}

export const MarkdownContent = forwardRef<MarkdownContentRef, MarkdownContentProps>(({ 
  content, 
  isStreaming = false, 
  maxPreviewLines = 8,
  className = '',
  autoScrollOnStream = true
}, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when expanded and streaming
  useEffect(() => {
    if (isExpanded && isStreaming && autoScrollOnStream && scrollContainerRef.current) {
      // Scroll the container to the bottom smoothly
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [content, isExpanded, isStreaming, autoScrollOnStream]);

  // Expose collapse/expand methods to parent
  useImperativeHandle(ref, () => ({
    collapse: () => {
      setIsExpanded(false);
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    expand: () => {
      setIsExpanded(true);
    }
  }));

  const handleShowAll = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Calculate content to display
  const { displayContent, hasMore, totalLines } = useMemo(() => {
    // Guard against null/undefined content
    const safeContent = content ?? '';
    const lines = safeContent.split('\n');
    const total = lines.length;
    
    if (isExpanded) {
      return {
        displayContent: safeContent,
        hasMore: false,
        totalLines: total
      };
    }
    
    const hasMoreContent = total > maxPreviewLines;
    const display = hasMoreContent 
      ? lines.slice(0, maxPreviewLines).join('\n') 
      : safeContent;
    
    return {
      displayContent: display,
      hasMore: hasMoreContent,
      totalLines: total
    };
  }, [content, maxPreviewLines, isExpanded]);

  const hiddenLines = totalLines - maxPreviewLines;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Markdown content with dark theme styling */}
      <div 
        ref={scrollContainerRef}
        className={`markdown-content transition-all duration-300 ${
          isExpanded 
            ? 'max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent' 
            : hasMore ? 'overflow-hidden' : ''
        }`}
      >
        <ReactMarkdown 
          remarkPlugins={REMARK_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {displayContent}
        </ReactMarkdown>
        
        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
        )}
        
        {/* Scroll anchor for auto-scroll */}
        <div ref={contentEndRef} />
      </div>

      {/* Gradient fade when there's more content (preview mode) */}
      {hasMore && !isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/90 to-transparent pointer-events-none" />
      )}

      {/* Show All / Collapse button */}
      {(hasMore || isExpanded) && (
        <div className="flex justify-center mt-2 relative z-10">
          {!isExpanded ? (
            <button
              onClick={handleShowAll}
              className="group flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full 
                         hover:bg-primary/20 hover:border-primary/50 transition-all duration-200 
                         text-ui-sm font-medium text-primary"
            >
              <Maximize2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
              <span>Show All</span>
              <span className="text-ui-2xs text-primary/70 ml-0.5">
                (+{hiddenLines} lines{isStreaming && <span className="animate-pulse">...</span>})
              </span>
            </button>
          ) : (
            <button
              onClick={handleCollapse}
              className="group flex items-center gap-2 px-4 py-1.5 bg-muted border border-border rounded-full 
                         hover:bg-muted/80 hover:border-border/80 transition-all duration-200 
                         text-ui-sm font-medium text-muted-foreground"
            >
              <Minimize2 className="w-3.5 h-3.5 transition-transform group-hover:scale-90" />
              <span>Collapse</span>
              {isStreaming && (
                <span className="ml-1 text-ui-2xs text-emerald-400 animate-pulse">
                  streaming...
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
