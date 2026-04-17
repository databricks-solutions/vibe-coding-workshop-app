import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, Copy, Check, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface UseCaseDescriptionBoxProps {
  content: string;
  useCase: string;
  isEdited?: boolean;
  onEdit?: () => void;
  heading?: string;
}

export function UseCaseDescriptionBox({ content, useCase, isEdited, onEdit, heading }: UseCaseDescriptionBoxProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  useEscapeKey(isModalOpen, closeModal);

  const handleCopy = async (shouldCloseModal: boolean = false) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (shouldCloseModal) {
        setTimeout(() => {
          setIsModalOpen(false);
          setCopied(false);
        }, 500);
      } else {
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <div className="mb-5 p-3 bg-secondary/40 rounded-md border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ui-base font-medium text-foreground flex items-center gap-1.5">
            {heading || 'Description of the Use Case:'}
            {isEdited && (
              <span className="text-ui-2xs font-medium bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded">Edited</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-2 py-0.5 text-ui-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                title="Edit use case name and description"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 text-ui-xs rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all hover:scale-105 animate-button-glow"
              title="Review in full view"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Review</span>
            </button>
          </div>
        </div>
        <div className="max-w-none max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-ui-lg font-bold text-foreground mt-3 mb-1.5">{children}</h1>,
              h2: ({ children }) => <h2 className="text-ui-lg font-bold text-foreground mt-3 mb-1.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-ui-md font-semibold text-foreground mt-2.5 mb-1">{children}</h3>,
              h4: ({ children }) => <h4 className="text-ui-base font-semibold text-foreground mt-2 mb-1">{children}</h4>,
              h5: ({ children }) => <h5 className="text-ui-base font-medium text-foreground mt-2 mb-1">{children}</h5>,
              p: ({ children }) => <p className="text-foreground text-ui-base mb-2 last:mb-0 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              em: ({ children }) => <em className="text-primary not-italic font-medium">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1.5 text-foreground text-ui-base">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1.5 text-foreground text-ui-base">{children}</ol>,
              li: ({ children }) => <li className="text-foreground">{children}</li>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {isModalOpen && createPortal(
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
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="absolute inset-0 bg-black/90" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
          
          <div 
            className="relative bg-card border border-border rounded-lg shadow-2xl flex flex-col animate-fade-in"
            style={{ 
              width: 'calc(100vw - 48px)', 
              height: 'calc(100vh - 48px)', 
              maxWidth: 'none',
              zIndex: 100000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
              <h3 className="text-ui-lg font-semibold text-foreground">
                {useCase}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-ui-sm font-medium rounded transition-all ${
                    copied
                      ? 'bg-emerald-900/40 text-emerald-400'
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
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="text-foreground text-ui-md mb-3 last:mb-0 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="text-primary not-italic font-medium">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 text-foreground text-ui-md">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-foreground text-ui-md">{children}</ol>,
                    li: ({ children }) => <li className="text-foreground">{children}</li>,
                    h1: ({ children }) => <h1 className="text-ui-xl font-bold text-foreground mb-3 mt-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-ui-lg font-semibold text-foreground mb-2 mt-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-ui-md font-semibold text-foreground mb-2 mt-2">{children}</h3>,
                    code: ({ children }) => <code className="bg-background/80 px-1.5 py-0.5 rounded text-primary font-mono text-ui-sm">{children}</code>,
                    pre: ({ children }) => <pre className="bg-background/80 p-3 rounded-md overflow-x-auto my-2">{children}</pre>,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-ui-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-ui-2xs font-mono">Esc</kbd> to close
              </span>
              <span className="text-ui-xs text-muted-foreground">
                {(content ?? '').length.toLocaleString()} characters
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
