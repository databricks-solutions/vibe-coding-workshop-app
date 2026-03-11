import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Maximize2 } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

interface ExpandableOutputModalProps {
  /** The content to display */
  content: string;
  /** Title for the modal header */
  title?: string;
  /** Whether content is still streaming */
  isStreaming?: boolean;
  /** Whether content is loading */
  isLoading?: boolean;
  /** Color theme for the expand button */
  buttonColor?: 'primary' | 'emerald' | 'violet' | 'amber';
}

export function ExpandableOutputModal({
  content,
  title = 'Generated Output',
  isStreaming = false,
  isLoading = false,
  buttonColor = 'primary',
}: ExpandableOutputModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle copy to clipboard and close modal
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      // Close modal after a brief delay to show "Copied!" feedback
      setTimeout(() => {
        setIsOpen(false);
        setCopied(false);
      }, 500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Button color classes
  const buttonColorClasses = {
    primary: 'text-primary hover:bg-primary/10 border-primary/30',
    emerald: 'text-emerald-400 hover:bg-emerald-900/30 border-emerald-500/30',
    violet: 'text-violet-400 hover:bg-violet-900/30 border-violet-500/30',
    amber: 'text-amber-400 hover:bg-amber-900/30 border-amber-500/30',
  };

  // Don't show expand button if loading or no content
  if (isLoading || !content) {
    return null;
  }

  return (
    <>
      {/* View Full Screen Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-all hover:scale-105 ${buttonColorClasses[buttonColor]}`}
        title="View in full screen"
      >
        <Maximize2 className="w-3 h-3" />
        <span>View full screen</span>
      </button>

      {/* Modal rendered via Portal to document.body - breaks out of ALL parent containers */}
      {isOpen && createPortal(
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 99999,
            width: '100vw',
            height: '100vh'
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop - covers entire viewport */}
          <div 
            className="absolute inset-0 bg-black/90" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
          
          {/* Modal Content - Full viewport with small margin */}
          <div 
            className="relative bg-card border border-border rounded-lg shadow-2xl flex flex-col"
            style={{ 
              width: 'calc(100vw - 48px)', 
              height: 'calc(100vh - 48px)', 
              maxWidth: 'none',
              zIndex: 100000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
              <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                {title}
                {isStreaming && (
                  <span className="text-[11px] font-normal text-primary animate-pulse">● Streaming...</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {/* Copy Button - Original smaller size */}
                <button
                  onClick={handleCopy}
                  disabled={isStreaming}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded transition-all ${
                    copied
                      ? 'bg-emerald-900/40 text-emerald-400'
                      : isStreaming
                      ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                      : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 animate-button-glow-copy'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy All
                    </>
                  )}
                </button>
                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content - Large area for easy reading */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="max-w-none">
                <MarkdownContent 
                  content={content}
                  isStreaming={isStreaming}
                  maxPreviewLines={1000}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-[11px] text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">Esc</kbd> to close
              </span>
              <span className="text-[11px] text-muted-foreground">
                {(content ?? '').split('\n').length} lines • {(content ?? '').length.toLocaleString()} characters
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// zoom-in-95 animation is now defined globally in src/index.css

