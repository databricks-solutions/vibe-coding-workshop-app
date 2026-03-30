import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, CheckCircle, XCircle, Loader2, RefreshCw, X, SkipForward, Undo2 } from 'lucide-react';
import { BorderBeamButton } from './BorderBeamButton';
import { MarkdownContent, type MarkdownContentRef } from './MarkdownContent';
import { CopyButton } from './CopyButton';
import { ExpandableOutputModal } from './ExpandableOutputModal';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { ExpandableErrorBanner } from './ExpandableErrorBanner';
import { apiClient, type GeneratedContent } from '../api/client';

const REQUIRED_COLUMNS = ['table_name', 'column_name', 'data_type', 'ordinal_position', 'is_nullable', 'comment'] as const;
const RECOMMENDED_COLUMNS = ['table_catalog', 'table_schema', 'full_data_type', 'column_default'] as const;

interface ValidationResult {
  valid: boolean;
  presentRequired: string[];
  missingRequired: string[];
  presentRecommended: string[];
  missingRecommended: string[];
  tableCount: number;
  columnCount: number;
  tableNames: string[];
  error?: string;
}

interface CsvUploadPanelProps {
  sessionId: string | null;
  industry: string;
  useCase: string;
  stepNumber: number;
  onPromptGenerated: (stepNumber: number, prompt: string) => void;
  isPreviousStepComplete: boolean;
  initialPrompt?: string;
  isComplete?: boolean;
  onToggleComplete?: () => void;
  isSkipped?: boolean;
  onToggleSkip?: () => void;
  onNavigateNext?: () => void;
  sectionTag?: string;
}

function validateCsv(content: string): ValidationResult {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    return { valid: false, presentRequired: [], missingRequired: [...REQUIRED_COLUMNS], presentRecommended: [], missingRecommended: [...RECOMMENDED_COLUMNS], tableCount: 0, columnCount: 0, tableNames: [], error: 'File is empty' };
  }

  // Parse header -- handle quoted CSV headers
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/^"/, '').replace(/"$/, ''));

  const presentRequired = REQUIRED_COLUMNS.filter(c => headers.includes(c));
  const missingRequired = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  const presentRecommended = RECOMMENDED_COLUMNS.filter(c => headers.includes(c));
  const missingRecommended = RECOMMENDED_COLUMNS.filter(c => !headers.includes(c));

  if (missingRequired.length > 0) {
    return { valid: false, presentRequired: [...presentRequired], missingRequired: [...missingRequired], presentRecommended: [...presentRecommended], missingRecommended: [...missingRecommended], tableCount: 0, columnCount: 0, tableNames: [], error: `Missing required columns: ${missingRequired.join(', ')}` };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    return { valid: false, presentRequired: [...presentRequired], missingRequired: [], presentRecommended: [...presentRecommended], missingRecommended: [...missingRecommended], tableCount: 0, columnCount: 0, tableNames: [], error: 'CSV has no data rows (only header)' };
  }

  const tableNameIdx = headers.indexOf('table_name');
  const tableNamesSet = new Set<string>();
  for (const line of dataLines) {
    const cols = line.split(',');
    const tName = cols[tableNameIdx]?.trim().replace(/^"/, '').replace(/"$/, '');
    if (tName) tableNamesSet.add(tName);
  }

  return {
    valid: true,
    presentRequired: [...presentRequired],
    missingRequired: [],
    presentRecommended: [...presentRecommended],
    missingRecommended: [...missingRecommended],
    tableCount: tableNamesSet.size,
    columnCount: dataLines.length,
    tableNames: [...tableNamesSet].sort(),
  };
}

export function CsvUploadPanel({
  sessionId,
  industry,
  useCase,
  stepNumber,
  onPromptGenerated,
  isPreviousStepComplete,
  initialPrompt,
  isComplete = false,
  onToggleComplete,
  isSkipped = false,
  onToggleSkip,
  onNavigateNext,
  sectionTag = 'bronze_table_metadata_upload',
}: CsvUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptContentRef = useRef<MarkdownContentRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef('');
  const rafIdRef = useRef<number>(0);

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedPrompt, setStreamedPrompt] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<{ attempt: number; maxAttempts: number; reason: string } | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'how_to_apply' | 'expected_output'>('prompt');
  const [metadata, setMetadata] = useState<{ how_to_apply: string; expected_output: string } | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const { copied, handleCopy } = useCopyToClipboard();

  const promptText = streamedPrompt || '';
  const canMarkComplete = showOutput && !isStreaming && !isProcessing && !!promptText && !isComplete;

  // Restore output on remount (e.g., user switched tabs and came back, or page refresh)
  useEffect(() => {
    if (initialPrompt && !showOutput && !streamedPrompt) {
      setStreamedPrompt(initialPrompt);
      streamBufferRef.current = initialPrompt;
      setShowOutput(true);
    }
  }, [initialPrompt]);

  // Periodically save streaming content to session so partial output survives page refresh
  useEffect(() => {
    if (!isStreaming || !onPromptGenerated || !stepNumber) return;
    const interval = setInterval(() => {
      if (streamBufferRef.current) {
        onPromptGenerated(stepNumber, streamBufferRef.current);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isStreaming, onPromptGenerated, stepNumber]);

  // Fetch how_to_apply and expected_output metadata from the upload section
  const fetchMetadata = useCallback(async () => {
    if (metadata) return;
    setIsLoadingMetadata(true);
    try {
      const content: GeneratedContent = await apiClient.generatePrompt(
        industry, useCase, sectionTag, false, undefined, sessionId
      );
      setMetadata({
        how_to_apply: content.how_to_apply || '',
        expected_output: content.expected_output || '',
      });
    } catch {
      // Silently fail -- metadata is supplementary
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [industry, useCase, sessionId, metadata, sectionTag]);

  useEffect(() => {
    if (showOutput && !metadata) {
      fetchMetadata();
    }
  }, [showOutput, metadata, fetchMetadata]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setPromptError('Please upload a .csv file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPromptError('File size must be under 5MB');
      return;
    }

    setPromptError(null);
    setFileName(file.name);
    setShowOutput(false);
    setStreamedPrompt('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      const result = validateCsv(text);
      setValidation(result);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleProcess = useCallback(() => {
    if (!csvContent || !validation?.valid) return;

    streamBufferRef.current = '';
    setIsProcessing(true);
    setIsStreaming(true);
    setShowOutput(true);
    setStreamedPrompt('');
    setPromptError(null);
    setRetryStatus(null);
    setActiveTab('prompt');

    const controller = apiClient.processMetadataCsvStream(
      csvContent,
      industry,
      useCase,
      sessionId,
      sectionTag,
      (chunk) => {
        setRetryStatus(null);
        streamBufferRef.current += chunk;
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            setStreamedPrompt(streamBufferRef.current);
          });
        }
      },
      () => {
        if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
        setStreamedPrompt(streamBufferRef.current);
        setIsProcessing(false);
        setIsStreaming(false);
        setRetryStatus(null);
        if (streamBufferRef.current) {
          onPromptGenerated(stepNumber, streamBufferRef.current);
        }
      },
      (error) => {
        if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
        setStreamedPrompt(streamBufferRef.current);
        setIsProcessing(false);
        setIsStreaming(false);
        setRetryStatus(null);
        setPromptError(error);
      },
      (attempt, maxAttempts, reason) => {
        setRetryStatus({ attempt, maxAttempts, reason });
      }
    );

    abortControllerRef.current = controller;
  }, [csvContent, validation, industry, useCase, sessionId, stepNumber, onPromptGenerated, sectionTag]);

  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
    streamBufferRef.current = '';
    setCsvContent(null);
    setFileName(null);
    setValidation(null);
    setShowOutput(false);
    setStreamedPrompt('');
    setPromptError(null);
    setRetryStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const howToApplyText = metadata?.how_to_apply || '';
  const expectedOutputText = metadata?.expected_output || '';

  const onCopy = () => {
    let textToCopy = promptText;
    if (activeTab === 'how_to_apply') textToCopy = howToApplyText;
    if (activeTab === 'expected_output') textToCopy = expectedOutputText;
    handleCopy(textToCopy);
  };

  const canProcess = validation?.valid && !isProcessing && isPreviousStepComplete;

  return (
    <div className="mt-3 space-y-3">
      {/* Prerequisite hint when step is blocked */}
      {!isPreviousStepComplete && !isComplete && (
        <div className="px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[12px] flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Complete the previous steps first
        </div>
      )}
      {/* Upload Zone */}
      {!showOutput && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer
            ${validation?.valid
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : csvContent && !validation?.valid
                ? 'border-red-500/40 bg-red-500/5'
                : 'border-border/60 hover:border-primary/40 hover:bg-primary/5'
            }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {!fileName ? (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">
                Drop your schema CSV here or <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                CSV must include: table_name, column_name, data_type, ordinal_position, is_nullable, comment
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="text-[13px] font-medium text-foreground">{fileName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="p-0.5 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {validation && (
                <p className="text-[11px] text-muted-foreground/60">
                  Click to upload a different file
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {validation && !showOutput && (
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
          {/* Required columns checklist */}
          <div className="grid grid-cols-3 gap-1.5">
            {REQUIRED_COLUMNS.map(col => {
              const present = validation.presentRequired.includes(col);
              return (
                <div key={col} className="flex items-center gap-1.5 text-[11px]">
                  {present
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  }
                  <span className={present ? 'text-muted-foreground' : 'text-red-400 font-medium'}>{col}</span>
                </div>
              );
            })}
          </div>

          {/* Recommended columns warning */}
          {validation.valid && validation.missingRecommended.length > 0 && (
            <p className="text-[11px] text-amber-400/80">
              Recommended columns not found: {validation.missingRecommended.join(', ')}
            </p>
          )}

          {/* Error banner */}
          {!validation.valid && validation.error && (
            <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-[12px] text-red-300">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{validation.error}. Please fix and re-upload.</span>
            </div>
          )}

          {/* Success preview */}
          {validation.valid && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[12px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                CSV validated — {validation.tableCount} tables, {validation.columnCount} columns detected
              </div>
              <div className="flex flex-wrap gap-1.5">
                {validation.tableNames.slice(0, 12).map(name => (
                  <span key={name} className="text-[10px] px-1.5 py-0.5 bg-secondary/60 border border-border/40 rounded text-muted-foreground">
                    {name}
                  </span>
                ))}
                {validation.tableNames.length > 12 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground/60">
                    +{validation.tableNames.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Retry status indicator */}
      {isStreaming && retryStatus && (
        <div className="px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[13px] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          Retrying ({retryStatus.attempt} of {retryStatus.maxAttempts}) &mdash; {retryStatus.reason}...
        </div>
      )}
      {/* Error */}
      {!isStreaming && promptError && !validation?.error && (
        <ExpandableErrorBanner
          error={promptError}
          summary={<>Processing failed &mdash; click <strong>Process &amp; Generate</strong> to try again</>}
        />
      )}

      {/* Process button */}
      {validation?.valid && !showOutput && (
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all ${
              canProcess
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
              <><FileSpreadsheet className="w-4 h-4" /> Process &amp; Generate</>
            )}
          </button>
        </div>
      )}

      {/* Re-upload link when output is shown */}
      {showOutput && !isStreaming && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Upload Different CSV
          </button>
          {fileName && (
            <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              {fileName}
            </span>
          )}
        </div>
      )}

      {/* Output area -- matches WorkflowStep's 3-tab layout exactly */}
      {showOutput && (isStreaming || streamedPrompt || metadata) && (
        <div className="bg-secondary/40 rounded-lg border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex-1 px-3 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'prompt'
                  ? 'text-foreground bg-secondary/60 border-b-2 border-primary -mb-[1px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Generated Prompt
            </button>
            <button
              onClick={() => setActiveTab('how_to_apply')}
              className={`flex-1 px-3 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'how_to_apply'
                  ? 'text-foreground bg-secondary/60 border-b-2 border-emerald-500 -mb-[1px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              How to Apply
            </button>
            <button
              onClick={() => setActiveTab('expected_output')}
              className={`flex-1 px-3 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'expected_output'
                  ? 'text-foreground bg-secondary/60 border-b-2 border-violet-500 -mb-[1px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Expected Output
            </button>
          </div>

          {/* Content */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[12px] font-medium inline-flex items-center gap-2 ${
                activeTab === 'prompt' ? 'text-primary' :
                activeTab === 'how_to_apply' ? 'text-emerald-400' : 'text-violet-400'
              }`}>
                {activeTab === 'prompt' && '💡 Generated Prompt:'}
                {activeTab === 'how_to_apply' && '🚀 Steps to Apply:'}
                {activeTab === 'expected_output' && '✨ Expected Results:'}
                {activeTab === 'prompt' && isStreaming && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary animate-pulse">
                    Streaming...
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {activeTab === 'prompt' && !isStreaming && promptText && (
                  <>
                    <ExpandableOutputModal
                      content={promptText}
                      title="Table Metadata (Upload) - Generated Prompt"
                      isStreaming={false}
                      buttonColor="primary"
                    />
                    <CopyButton
                      copied={copied}
                      onClick={onCopy}
                      showGlow={!copied}
                      className="text-primary hover:bg-primary/10"
                    />
                  </>
                )}
                {activeTab === 'how_to_apply' && !isLoadingMetadata && howToApplyText && (
                  <ExpandableOutputModal
                    content={howToApplyText}
                    title="Table Metadata (Upload) - How to Apply"
                    isStreaming={false}
                    buttonColor="emerald"
                  />
                )}
                {activeTab === 'expected_output' && !isLoadingMetadata && expectedOutputText && (
                  <ExpandableOutputModal
                    content={expectedOutputText}
                    title="Table Metadata (Upload) - Expected Output"
                    isStreaming={false}
                    buttonColor="violet"
                  />
                )}
              </div>
            </div>

            {activeTab === 'prompt' && (
              isProcessing && !promptText ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-[13px]">Processing CSV and generating prompt...</span>
                </div>
              ) : (
                <MarkdownContent
                  ref={promptContentRef}
                  content={promptText}
                  isStreaming={isStreaming}
                  maxPreviewLines={8}
                />
              )
            )}
            {activeTab === 'how_to_apply' && (
              isLoadingMetadata ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span className="text-[13px]">Loading application steps...</span>
                </div>
              ) : (
                <MarkdownContent
                  content={howToApplyText || '_No application steps defined._'}
                  isStreaming={false}
                  maxPreviewLines={12}
                />
              )
            )}
            {activeTab === 'expected_output' && (
              isLoadingMetadata ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span className="text-[13px]">Loading expected output...</span>
                </div>
              ) : (
                <MarkdownContent
                  content={expectedOutputText || '_No expected output defined._'}
                  isStreaming={false}
                  maxPreviewLines={12}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Footer bar: Skip + Mark Done (mirrors WorkflowStep footer) */}
      {onToggleComplete && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div>
            {onToggleSkip && !isComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSkip(); }}
                className={`text-[11px] font-medium px-3 py-1.5 rounded transition-all inline-flex items-center gap-1.5 ${
                  isSkipped
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {isSkipped ? (
                  <><Undo2 className="w-3 h-3" /> Undo Skip</>
                ) : (
                  <><SkipForward className="w-3 h-3" /> Skip Step</>
                )}
              </button>
            )}
          </div>
          <div>
            {isSkipped ? (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigateNext?.(); }}
                className="text-[12px] font-medium px-4 py-2 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skipped — Next Step →
              </button>
            ) : isComplete ? (
              <div className="text-[12px] font-medium px-4 py-2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 select-none inline-flex items-center gap-1.5 animate-fade-in">
                <CheckCircle className="w-3.5 h-3.5" /> Done
              </div>
            ) : (
              <BorderBeamButton
                active={canMarkComplete}
                onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
                disabled={!canMarkComplete}
              >
                Done
              </BorderBeamButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
