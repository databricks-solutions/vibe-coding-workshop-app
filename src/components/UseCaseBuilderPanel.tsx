/**
 * Shared UI panel for the Use Case Builder.
 * Renders inputs (industry, name, images, hints), streaming output,
 * refinement bar, diff toggle, and action buttons.
 *
 * Supports a `compact` mode for embedding inside Step 1's "Create Your Own".
 */

import { useCallback } from 'react';
import {
  Sparkles,
  Send,
  Pencil,
  RefreshCw,
  Save,
  Copy,
  Check,
  X,
  Upload,
  ImageIcon,
  Lightbulb,
  GitCompareArrows,
  FileText,
  FileSpreadsheet,
  Mic,
  MicOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DiffView } from './DiffView';
import { ExpandableErrorBanner } from './ExpandableErrorBanner';
import { useSpeechToText } from '../hooks/useSpeechToText';
import type { UseCaseBuilderState } from '../hooks/useUseCaseBuilder';

interface UseCaseBuilderPanelProps {
  builder: UseCaseBuilderState;
  compact?: boolean;
  /** When true, hide the Save button (e.g. in Step 1 where saving isn't needed) */
  hideSave?: boolean;
  /** When true, hide the industry dropdown (e.g. when industry is pre-determined by config page) */
  hideIndustry?: boolean;
  /** Callback fired after a successful save, so the parent can refresh lists */
  onSaved?: () => void;
}

const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Retail & E-Commerce',
  'Manufacturing',
  'Media & Entertainment',
  'Travel & Hospitality',
  'Education',
  'Real Estate',
  'Energy & Utilities',
  'Automotive',
  'Agriculture',
  'Government',
  'Logistics & Supply Chain',
  'Other',
];

const markdownComponents = (compact: boolean) => ({
  h1: ({ children }: any) => (
    <h1 className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-foreground border-b border-border pb-2 mb-3 mt-1`}>
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className={`${compact ? 'text-[12px]' : 'text-[14px]'} font-semibold text-foreground mt-4 mb-2`}>
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-medium text-foreground mt-3 mb-1.5`}>
      {children}
    </h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-[12px] font-medium text-foreground mt-2 mb-1">{children}</h4>
  ),
  p: ({ children }: any) => (
    <p className={`text-muted-foreground ${compact ? 'text-[12px]' : 'text-[13px]'} leading-relaxed mb-2`}>
      {children}
    </p>
  ),
  ul: ({ children }: any) => (
    <ul className={`list-disc my-2 space-y-1 text-muted-foreground ${compact ? 'text-[12px] pl-4' : 'text-[13px] pl-5'}`}>
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className={`list-decimal my-2 space-y-1 text-muted-foreground ${compact ? 'text-[12px] pl-4' : 'text-[13px] pl-5'}`}>
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="text-muted-foreground leading-relaxed pl-1 [&>p]:inline [&>p]:m-0">{children}</li>
  ),
  code: ({ className, children }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-secondary text-primary px-1 py-0.5 rounded text-[12px] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-background text-foreground p-3 rounded overflow-x-auto text-[12px] font-mono my-2 border border-border">
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <pre className="bg-background text-foreground p-3 rounded overflow-x-auto my-2 border border-border">
      {children}
    </pre>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-3 border-primary bg-primary/10 pl-3 py-1.5 my-2 text-[13px] italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  hr: () => <hr className="border-t border-border my-3" />,
  a: ({ href, children }: any) => (
    <a
      href={href}
      className="text-primary hover:text-primary/80 underline text-[13px]"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
});

export function UseCaseBuilderPanel({
  builder: b,
  compact = false,
  hideSave = false,
  hideIndustry = false,
  onSaved,
}: UseCaseBuilderPanelProps) {
  const imgSize = compact ? 'w-10 h-10' : 'w-16 h-16';
  const textareaRows = compact ? 3 : 5;
  const outputMaxH = compact ? 'max-h-[40vh]' : 'max-h-[60vh]';
  const editMinH = compact ? 'min-h-[200px]' : 'min-h-[400px]';

  const handleAppendTranscript = useCallback(
    (text: string) => b.setHints((prev: string) => (prev ? `${prev} ${text}` : text)),
    [b],
  );
  const speech = useSpeechToText({ onFinalTranscript: handleAppendTranscript });

  const handleSaveWithCallback = async () => {
    await b.handleSave();
    onSaved?.();
  };

  return (
    <div className={compact ? 'space-y-3' : 'grid grid-cols-1 lg:grid-cols-5 gap-6'}>
      {/* =============== INPUT SECTION =============== */}
      <div className={compact ? '' : 'lg:col-span-2 space-y-4'}>
        <div className={`bg-card border border-border rounded-xl ${compact ? 'p-3 space-y-3' : 'p-5 space-y-4'}`}>
          <h2 className={`${compact ? 'text-[12px]' : 'text-sm'} font-semibold text-foreground flex items-center gap-2`}>
            <Sparkles className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-primary`} />
            Describe Your Use Case
          </h2>

          {/* Industry dropdown (hidden when industry is pre-determined by parent) */}
          {!hideIndustry && (
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Industry
              </label>
              <select
                value={b.industry}
                onChange={(e) => b.setIndustry(e.target.value)}
                className={`w-full bg-background border border-border rounded-lg px-3 ${compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]'} text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors`}
              >
                <option value="">Select an industry...</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Use case name */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Use Case Name
            </label>
            <input
              type="text"
              value={b.useCaseName}
              maxLength={30}
              onChange={(e) => b.setUseCaseName(e.target.value)}
              placeholder="e.g., Customer 360, Fleet Mgmt..."
              className={`w-full bg-background border rounded-lg px-3 ${compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]'} text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-colors ${
                b.useCaseName.length >= 30
                  ? 'border-red-400/70 focus:ring-red-400/50 focus:border-red-400/70'
                  : b.useCaseName.length >= 25
                    ? 'border-amber-400/70 focus:ring-amber-400/50 focus:border-amber-400/70'
                    : 'border-border focus:ring-primary/50 focus:border-primary/50'
              }`}
            />
            <div className="flex items-center justify-between mt-1 min-h-[18px]">
              <span className="text-[10px] text-muted-foreground/60">Short, descriptive name</span>
              {b.useCaseName.length >= 20 && (
                <span className={`text-[10px] font-medium transition-colors ${
                  b.useCaseName.length >= 30 ? 'text-red-500' : b.useCaseName.length >= 25 ? 'text-amber-500' : 'text-muted-foreground/60'
                }`}>
                  {b.useCaseName.length >= 30 ? '30/30 — Try a shorter name' : `${b.useCaseName.length}/30`}
                </span>
              )}
            </div>
          </div>

          {/* Reference file upload (images, PDFs, text) */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Reference Files <span className="text-muted-foreground/60">(images, PDFs, text — up to 5)</span>
            </label>
            <input
              ref={b.fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.csv,.md,.json,.yaml,.yml,.xml,.log"
              multiple
              className="hidden"
              onChange={(e) => b.handleFileUpload(e.target.files)}
            />
            <button
              onClick={() => b.fileInputRef.current?.click()}
              disabled={b.attachments.length >= 5}
              className={`w-full flex items-center justify-center gap-2 px-3 ${compact ? 'py-2' : 'py-3'} border-2 border-dashed border-border rounded-lg text-muted-foreground text-[12px] hover:border-primary/40 hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Upload className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              {b.attachments.length >= 5 ? 'Max 5 files' : 'Upload images, PDFs, or text files'}
            </button>
            {b.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {b.attachments.map((att) => (
                  <div key={att.id} className="relative group">
                    {att.type === 'image' ? (
                      <img
                        src={att.base64}
                        alt={att.name}
                        className={`${imgSize} object-cover rounded-lg border border-border`}
                      />
                    ) : (
                      <div className={`${imgSize} flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/60`}>
                        {att.type === 'pdf' ? (
                          <FileText className="w-5 h-5 text-red-400" />
                        ) : att.name.endsWith('.csv') || att.name.endsWith('.tsv') ? (
                          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-400" />
                        )}
                        <span className="text-[7px] text-muted-foreground/70 mt-0.5 uppercase font-medium">
                          {att.type === 'pdf' ? 'PDF' : att.name.split('.').pop()?.toUpperCase() || 'TXT'}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => b.handleRemoveAttachment(att.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {!compact && (
                      <span className="block text-[9px] text-muted-foreground/60 truncate max-w-[64px] mt-0.5">
                        {att.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description of the use case (voice-enabled) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Description of the Use Case
              </label>
              {speech.isSupported && !speech.isListening && (
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  or use voice
                </span>
              )}
            </div>
            <div className="flex gap-2 items-start">
              <textarea
                value={b.hints}
                onChange={(e) => b.setHints(e.target.value)}
                placeholder="Describe the use case in detail — features, personas, data sources, or technical requirements..."
                rows={textareaRows}
                className={`flex-1 bg-background border rounded-lg px-3 py-2 ${compact ? 'text-[12px]' : 'text-[13px]'} text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-colors resize-none ${
                  speech.isListening
                    ? 'border-red-400/70 focus:ring-red-400/50 focus:border-red-400/70'
                    : 'border-border focus:ring-primary/50 focus:border-primary/50'
                }`}
              />
              {speech.isSupported && (
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="relative">
                    {speech.isListening && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                        <span className="absolute -inset-1 rounded-full border-2 border-red-400/40 animate-pulse" />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={speech.isListening ? speech.stopListening : speech.startListening}
                      className={`relative ${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${
                        speech.isListening
                          ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30 shadow-md scale-110'
                          : 'bg-gradient-to-br from-primary to-emerald-500 text-white hover:shadow-md hover:shadow-primary/30 hover:scale-105'
                      }`}
                      title={speech.isListening ? 'Stop recording' : 'Speak your use case description'}
                    >
                      {speech.isListening
                        ? <MicOff className={compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
                        : <Mic className={compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
                      }
                    </button>
                  </div>
                  <span className={`text-[9px] font-medium ${speech.isListening ? 'text-red-400' : 'text-muted-foreground/50'}`}>
                    {speech.isListening ? 'Stop' : 'Speak'}
                  </span>
                </div>
              )}
            </div>
            {speech.isListening && speech.interimTranscript && (
              <p className={`mt-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'} text-red-400/80 italic truncate`}>
                {speech.interimTranscript}
              </p>
            )}
            {speech.isListening && !speech.interimTranscript && (
              <div className={`mt-1.5 flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'} text-red-400/70`}>
                <span className="flex gap-0.5">
                  <span className="inline-block w-1 h-3 rounded-full bg-red-400/80 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-1 h-2 rounded-full bg-red-400/60 animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-1 h-3.5 rounded-full bg-red-400/80 animate-pulse" style={{ animationDelay: '300ms' }} />
                  <span className="inline-block w-1 h-2 rounded-full bg-red-400/60 animate-pulse" style={{ animationDelay: '450ms' }} />
                </span>
                Listening — speak now...
              </div>
            )}
          </div>

          {/* Generate button */}
          {(() => {
            const isActive = b.hasInput && !b.isStreaming;
            const btn = (
              <button
                onClick={b.handleGenerate}
                disabled={!b.hasInput || b.isStreaming}
                className={`w-full flex items-center justify-center gap-2 px-4 ${compact ? 'py-2' : 'py-2.5'} text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {b.isStreaming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Generate Use Case
                  </>
                )}
              </button>
            );
            return isActive ? <div className="border-beam-wrapper">{btn}</div> : btn;
          })()}

          {!b.hasInput && (
            <p className="text-[11px] text-muted-foreground/60 text-center">
              Fill in at least one field to generate a use case description
            </p>
          )}
        </div>
      </div>

      {/* =============== OUTPUT SECTION =============== */}
      <div className={compact ? '' : 'lg:col-span-3 space-y-4'}>
        <div className={`bg-card border border-border rounded-xl ${compact ? 'p-3' : 'p-5'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className={`${compact ? 'text-[12px]' : 'text-sm'} font-semibold text-foreground flex items-center gap-2`}>
              <ImageIcon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-primary`} />
              Generated Description
              {b.iterationCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-medium rounded-full">
                  v{b.iterationCount + 1}
                </span>
              )}
              {b.streamModel && (
                <span className="text-[10px] text-muted-foreground/60 font-normal">
                  via {b.streamModel}
                </span>
              )}
            </h2>

            {/* Action buttons */}
            {b.outputText && (
              <div className="flex items-center gap-1.5">
                {b.isStreaming && (
                  <button
                    onClick={b.handleStopStreaming}
                    className="flex items-center gap-1 px-2.5 py-1 bg-destructive/10 text-destructive rounded-md text-[11px] font-medium hover:bg-destructive/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Stop
                  </button>
                )}
                {!b.isStreaming && (
                  <>
                    {/* Diff toggle -- only when a previous draft exists */}
                    {b.previousDraft && (
                      <button
                        onClick={b.toggleDiff}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          b.showDiff
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                        title="Show what changed from previous version"
                      >
                        <GitCompareArrows className="w-3 h-3" />
                        Diff
                      </button>
                    )}
                    <button
                      onClick={b.handleToggleEdit}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        b.isEditing
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Pencil className="w-3 h-3" />
                      {b.isEditing ? 'Done' : 'Edit'}
                    </button>
                    <button
                      onClick={() => b.handleCopy(b.isEditing ? b.editText : b.outputText)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-muted-foreground rounded-md text-[11px] font-medium hover:text-foreground transition-colors"
                    >
                      {b.copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {b.copied ? 'Copied' : 'Copy'}
                    </button>
                    {!hideSave && (
                      <button
                        onClick={handleSaveWithCallback}
                        disabled={b.isSaving}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md text-[11px] font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {b.saveSuccess ? (
                          <><Check className="w-3 h-3" /> Saved!</>
                        ) : b.isSaving ? (
                          <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>
                        ) : (
                          <><Save className="w-3 h-3" /> Save</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Retry status indicator */}
          {b.isStreaming && b.retryStatus && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[12px]">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              Retrying ({b.retryStatus.attempt} of {b.retryStatus.maxAttempts}) &mdash; {b.retryStatus.reason}...
            </div>
          )}
          {/* Error */}
          {!b.isStreaming && b.error && (
            <ExpandableErrorBanner
              error={b.error}
              summary={<>Generation failed &mdash; click <strong>Generate</strong> to try again</>}
              className="mb-3"
            />
          )}

          {/* Output area */}
          {b.outputText || b.isStreaming ? (
            b.isEditing ? (
              <textarea
                value={b.editText}
                onChange={(e) => b.setEditText(e.target.value)}
                className={`w-full bg-background border border-primary/30 rounded-lg px-4 py-3 text-[13px] text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors resize-none ${editMinH}`}
                style={compact ? undefined : { height: 'calc(60vh - 100px)' }}
              />
            ) : b.showDiff && b.previousDraft ? (
              <div
                ref={b.outputContainerRef}
                className={`${outputMaxH} overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent`}
              >
                <DiffView oldText={b.previousDraft} newText={b.outputText} compact={compact} />
              </div>
            ) : (
              <div
                ref={b.outputContainerRef}
                className={`${outputMaxH} overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent`}
              >
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents(compact)}>
                    {b.outputText}
                  </ReactMarkdown>
                  {b.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
            )
          ) : (
            <div className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-16'} text-center`}>
              <div className={`${compact ? 'p-3' : 'p-4'} bg-muted/50 rounded-2xl mb-4`}>
                <Lightbulb className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-muted-foreground/40`} />
              </div>
              <p className={`text-muted-foreground ${compact ? 'text-[12px]' : 'text-[13px]'} mb-1`}>
                Your generated use case will appear here
              </p>
              <p className="text-muted-foreground/50 text-[11px]">
                Fill in the inputs {compact ? 'above' : 'on the left'} and click <strong>Generate</strong>
              </p>
            </div>
          )}

          {/* Refinement feedback bar */}
          {b.outputText && !b.isStreaming && !b.isEditing && (
            <div className={`${compact ? 'mt-3 pt-3' : 'mt-4 pt-4'} border-t border-border`}>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Refine this description
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  value={b.refineFeedback}
                  onChange={(e) => b.setRefineFeedback(e.target.value)}
                  placeholder="Tell the AI how to improve this... e.g., 'Add more technical details', 'Focus on healthcare regulations'"
                  rows={compact ? 1 : 2}
                  className={`flex-1 bg-background border border-border rounded-lg px-3 py-2 ${compact ? 'text-[11px]' : 'text-[12px]'} text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors resize-none`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      b.handleRefine();
                    }
                  }}
                />
                {(() => {
                  const refineActive = !!b.refineFeedback.trim();
                  const refineBtn = (
                    <button
                      onClick={b.handleRefine}
                      disabled={!refineActive}
                      className={`flex items-center gap-1.5 px-4 ${compact ? 'py-2' : 'py-2.5'} text-[12px] font-medium transition-colors shrink-0 ${
                        refineActive
                          ? 'relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refine
                    </button>
                  );
                  return refineActive ? <div className="border-beam-wrapper shrink-0">{refineBtn}</div> : refineBtn;
                })()}
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                Describe what to change and press Enter or click Refine.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
