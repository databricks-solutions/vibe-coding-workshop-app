import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, SkipForward, Undo2, CheckCircle, Workflow } from 'lucide-react';
import { MarkdownContent, type MarkdownContentRef } from './MarkdownContent';
import { CopyButton } from './CopyButton';
import { ExpandableOutputModal } from './ExpandableOutputModal';
import { ImageGallery } from './ImageGallery';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { colorClasses } from '../constants/colorClasses';
import type { ColorType } from '../constants/colorClasses';
import { apiClient, type GeneratedContent } from '../api/client';
import { VerificationLinks } from './VerificationLinks';
import { SkillBlueprintTab, SkillBlueprintFullScreenModal } from './SkillBlueprintTab';
import { useSkillBlueprint } from '../hooks/useSkillBlueprint';
import { BorderBeamButton } from './BorderBeamButton';

interface WorkflowStepProps {
  icon: ReactNode;
  title: string;
  description: string;
  color: ColorType;
  input?: string;
  onToggleComplete?: () => void;
  isComplete?: boolean;
  sectionTag: string;
  industry?: string;
  useCase?: string;
  /** When true, removes outer container styles (for embedding in tabs) */
  embedded?: boolean;
  /** Callback when prompt is generated (for session tracking) */
  onPromptGenerated?: (stepNumber: number, promptText: string) => void;
  /** Step number for session tracking */
  stepNumber?: number;
  /** Pre-loaded prompt from session restore */
  initialPrompt?: string;
  /** Outputs from previous steps (e.g., {prd_document: "..."}) */
  previousOutputs?: Record<string, string>;
  /** Whether the previous step is complete (enables Generate Prompt button) */
  isPreviousStepComplete?: boolean;
  /** Whether the step is expanded (controlled from parent) */
  isExpanded?: boolean;
  /** Callback to toggle expansion */
  onToggleExpand?: () => void;
  /** Session ID for using session-specific parameter overrides */
  sessionId?: string | null;
  /** Custom content to render below the title/description (e.g., lakehouse params editor) */
  customHeaderContent?: ReactNode;
  /** Callback when user clicks Re-generate (to reset completion status) */
  onStepReset?: () => void;
  /** Whether this step is skipped */
  isSkipped?: boolean;
  /** Callback to toggle skip state */
  onToggleSkip?: () => void;
  /** Callback to navigate to the next step after skipping */
  onNavigateNext?: () => void;
  /** When set, disables the Generate button and shows this as a tooltip reason */
  generateDisabledReason?: string;
}

export function WorkflowStep({ 
  icon, 
  title, 
  description, 
  color, 
  input, 
  onToggleComplete, 
  isComplete, 
  sectionTag, 
  industry = '', 
  useCase = '',
  embedded = false,
  onPromptGenerated,
  stepNumber,
  initialPrompt,
  previousOutputs,
  isPreviousStepComplete = true,
  isExpanded = true,
  onToggleExpand,
  sessionId,
  customHeaderContent,
  onStepReset,
  isSkipped = false,
  onToggleSkip,
  onNavigateNext,
  generateDisabledReason
}: WorkflowStepProps) {
  const colors = colorClasses[color];
  
  // Container styles - simplified when embedded in tabs
  const containerClasses = embedded 
    ? 'p-5' 
    : 'bg-card rounded-lg p-5 border border-border';
  
  // Refs for collapsing content
  const promptContentRef = useRef<MarkdownContentRef>(null);
  const inputContentRef = useRef<MarkdownContentRef>(null);
  const metadataFetchedRef = useRef(false);
  const footerRef = useRef<HTMLDivElement>(null);
  // Ref to accumulate streaming content — survives re-renders without forced sync rendering
  const streamBufferRef = useRef('');
  const rafIdRef = useRef<number>(0);
  
  // State for fetched content
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedPrompt, setStreamedPrompt] = useState('');
  
  const [showGeneratedPrompt, setShowGeneratedPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'how_to_apply' | 'expected_output' | 'skill_blueprint'>('prompt');
  const { copied, handleCopy } = useCopyToClipboard();
  
  const skillBlueprint = useSkillBlueprint(sectionTag);
  const skillAnimPlayedRef = useRef(false);

  // Handle Mark Complete - collapse content
  const handleMarkComplete = () => {
    promptContentRef.current?.collapse();
    inputContentRef.current?.collapse();
    onToggleComplete?.();
  };

  // Stream generated content from backend with real-time display
  const handleGeneratePrompt = useCallback(() => {
    if (!industry || !useCase) {
      setPromptError('Please select an industry and use case first');
      return;
    }

    // Reset buffer and state
    streamBufferRef.current = '';
    setIsLoadingPrompt(true);
    setIsStreaming(true);
    setPromptError(null);
    setStreamedPrompt('');
    setShowGeneratedPrompt(true);
    
    setGeneratedContent({
      prompt: '',
      input: 'Loading input content...',
      source: 'llm_generated',
    });

    // Fetch static metadata from lightweight cache-backed endpoint
    setIsLoadingMetadata(true);
    apiClient.getSectionMetadata(sectionTag, industry, useCase, sessionId)
      .then(meta => {
        setGeneratedContent(prev => ({
          ...prev!,
          how_to_apply: meta.how_to_apply || '',
          expected_output: meta.expected_output || '',
          how_to_apply_images: meta.how_to_apply_images || [],
          expected_output_images: meta.expected_output_images || [],
        }));
        setIsLoadingMetadata(false);
      })
      .catch(err => {
        console.error('Failed to fetch section metadata:', err);
        setIsLoadingMetadata(false);
      });

    // Start streaming — accumulate in ref (always current) and sync to state
    apiClient.generatePromptStream(
      industry,
      useCase,
      sectionTag,
      (content: string) => {
        streamBufferRef.current += content;
        setIsLoadingPrompt(false);
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            setStreamedPrompt(streamBufferRef.current);
          });
        }
      },
      (model?: string) => {
        if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
        setStreamedPrompt(streamBufferRef.current);
        setIsStreaming(false);
        setGeneratedContent(prev => ({
          ...prev!,
          source: 'llm_generated',
          model: model,
        }));
        if (onPromptGenerated && stepNumber && streamBufferRef.current) {
          onPromptGenerated(stepNumber, streamBufferRef.current);
        }
      },
      (error: string) => {
        if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
        setStreamedPrompt(streamBufferRef.current);
        setIsStreaming(false);
        setIsLoadingPrompt(false);
        setPromptError(`Streaming failed: ${error}`);
      },
      previousOutputs,
      sessionId
    );
  }, [industry, useCase, sectionTag, previousOutputs, sessionId, onPromptGenerated, stepNumber]);

  // Handle regenerate - clear and restart generation
  const handleRegenerate = useCallback(() => {
    onStepReset?.();
    
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
    streamBufferRef.current = '';
    setGeneratedContent(null);
    setShowGeneratedPrompt(false);
    setPromptError(null);
    setStreamedPrompt('');
    setIsStreaming(false);
    
    setTimeout(() => {
      handleGeneratePrompt();
    }, 100);
  }, [handleGeneratePrompt]);

  // Reset state when industry/useCase changes
  useEffect(() => {
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
    streamBufferRef.current = '';
    setGeneratedContent(null);
    setShowGeneratedPrompt(false);
    setPromptError(null);
    setStreamedPrompt('');
    setIsStreaming(false);
    metadataFetchedRef.current = false;
  }, [industry, useCase]);

  // Restore prompt text from session (instant, no API call)
  useEffect(() => {
    if (initialPrompt && !streamedPrompt && !generatedContent?.prompt) {
      setStreamedPrompt(initialPrompt);
      setShowGeneratedPrompt(true);
      setGeneratedContent({
        prompt: initialPrompt,
        input: '',
        source: 'llm_generated',
      });
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

  // Fetch metadata (how_to_apply, expected_output, images) only when step is expanded
  useEffect(() => {
    if (!isExpanded || metadataFetchedRef.current) return;
    if (!initialPrompt || !industry || !useCase) return;
    if (generatedContent?.how_to_apply) return;

    metadataFetchedRef.current = true;
    setIsLoadingMetadata(true);
    apiClient.getSectionMetadata(sectionTag, industry, useCase, sessionId)
      .then(meta => {
        setGeneratedContent(prev => ({
          ...prev!,
          how_to_apply: meta.how_to_apply || '',
          expected_output: meta.expected_output || '',
          how_to_apply_images: meta.how_to_apply_images || [],
          expected_output_images: meta.expected_output_images || [],
        }));
        setIsLoadingMetadata(false);
      })
      .catch(err => {
        console.error('Failed to fetch section metadata:', err);
        metadataFetchedRef.current = false;
        setIsLoadingMetadata(false);
      });
  }, [isExpanded, initialPrompt, industry, useCase, sectionTag, sessionId]);

  // Use streamed content when available, otherwise fall back to generated content
  const promptText = streamedPrompt || generatedContent?.prompt || '';
  const howToApplyText = generatedContent?.how_to_apply || '';
  const expectedOutputText = generatedContent?.expected_output || '';

  const onCopy = () => {
    let textToCopy = promptText;
    if (activeTab === 'how_to_apply') textToCopy = howToApplyText;
    if (activeTab === 'expected_output') textToCopy = expectedOutputText;
    handleCopy(textToCopy);
    setTimeout(() => {
      footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  };

  const hasPrompt = !title.includes('Branding & Design Iteration') && !title.includes('Final Interactive Demo Experience');
  const showGenerateButton = hasPrompt && !isSkipped;
  
  const isPromptComplete = showGeneratedPrompt && !isStreaming && !isLoadingPrompt && !!promptText;
  
  // Determine why the Generate button might be disabled
  const prerequisiteReason = !isPreviousStepComplete
    ? 'Complete the previous steps first'
    : (!industry || !useCase)
      ? 'Select an industry and use case first'
      : generateDisabledReason || '';

  const canClickGeneratePrompt = isPreviousStepComplete && industry && useCase && !showGeneratedPrompt && !isLoadingPrompt && !isStreaming && !generateDisabledReason;
  
  // Mark Complete button is enabled only if prompt is fully generated for this step
  const canClickMarkComplete = isPromptComplete && !isComplete;

  return (
    <div className={`${containerClasses} ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
      {/* Header Row - Always Visible */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${colors.bg} p-2.5 rounded-md ${colors.icon} flex-shrink-0`}>
          {icon}
        </div>
        
        {/* Title and Description - Clickable to expand/collapse */}
        <div 
          className={`flex-1 min-w-0 ${onToggleExpand ? 'cursor-pointer' : ''}`}
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-2">
            <h3 className={`text-[15px] font-semibold text-foreground leading-tight ${isComplete ? 'line-through opacity-50' : ''}`}>
              {title}
            </h3>
            {isComplete && (
              <span className="text-emerald-400 text-[11px] font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
            )}
            {isStreaming && !isExpanded && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary animate-pulse inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Generating...
              </span>
            )}
            {onToggleExpand && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                isExpanded 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}>
                {isExpanded ? '▼ Expanded' : '▶ Click to expand'}
              </span>
            )}
          </div>
          <p className={`text-[13px] text-muted-foreground mt-1 leading-relaxed ${isComplete ? 'line-through opacity-50' : ''}`}>
            {description}
          </p>
          {input && (
            <div className={`inline-block mt-2.5 px-2.5 py-1 text-[11px] font-medium rounded ${colors.badge} ${isComplete ? 'line-through opacity-50' : ''}`}>
              {input}
            </div>
          )}
          
          {/* Custom header content (e.g., lakehouse params editor) */}
          {customHeaderContent}
        </div>

        {/* Generate Button - Always visible in header */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showGenerateButton && (() => {
            const shouldShowRegenerate = (isComplete || showGeneratedPrompt) && !isStreaming && !isLoadingPrompt;
            const canClick = shouldShowRegenerate || canClickGeneratePrompt;
            const showBeam = !!canClickGeneratePrompt && !shouldShowRegenerate;
            
            const btn = (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!isExpanded && onToggleExpand) {
                    onToggleExpand();
                  }
                  if (shouldShowRegenerate) {
                    handleRegenerate();
                  } else if (canClickGeneratePrompt) {
                    handleGeneratePrompt();
                  }
                }}
                disabled={isLoadingPrompt || isStreaming || !canClick}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded transition-all group ${
                  showBeam
                    ? 'relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500'
                    : shouldShowRegenerate
                    ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 cursor-pointer'
                    : isLoadingPrompt || isStreaming
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : !canClick
                    ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed opacity-50'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
                title={shouldShowRegenerate ? 'Click to regenerate' : prerequisiteReason || undefined}
              >
                {isLoadingPrompt || isStreaming ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : shouldShowRegenerate ? (
                  <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {shouldShowRegenerate ? 'Re-generate' : isStreaming ? 'Streaming...' : isLoadingPrompt ? 'Loading...' : 'Generate'}
              </button>
            );

            return showBeam ? <div className="border-beam-wrapper">{btn}</div> : btn;
          })()}
        </div>
      </div>

      {/* Collapsible Content with smooth animation */}
      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
          {/* Prerequisite hint when step is blocked */}
          {!isComplete && !isSkipped && prerequisiteReason && (
            <div className="mt-3 mx-0 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[13px] flex items-center gap-2 animate-prerequisite-pulse">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {prerequisiteReason}
            </div>
          )}
          {/* Error message */}
          {promptError && (
            <div className="mt-3 p-2.5 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-[13px]">
              {promptError}
            </div>
          )}

      {showGeneratedPrompt && (isStreaming || streamedPrompt || generatedContent) && (
        <div className="mt-4 bg-secondary/40 rounded-lg border border-border overflow-hidden">
          {/* Tabs - Clean minimal styling */}
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
                  ? 'text-foreground bg-secondary/60 border-b-2 border-amber-500 -mb-[1px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> Verify Results
            </button>
            {skillBlueprint && (
              <button
                onClick={() => setActiveTab('skill_blueprint')}
                className={`flex-1 px-3 py-2 text-[12px] font-medium transition-all ${
                  activeTab === 'skill_blueprint'
                    ? 'text-foreground bg-secondary/60 border-b-2 border-cyan-500 -mb-[1px]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <Workflow className="w-3.5 h-3.5 inline mr-1" /> Agent Skills
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[12px] font-medium ${
                activeTab === 'prompt' ? 'text-primary' : 
                activeTab === 'how_to_apply' ? 'text-emerald-400' :
                activeTab === 'skill_blueprint' ? 'text-cyan-400' : 'text-amber-400'
              }`}>
                {activeTab === 'prompt' && '💡 Generated Prompt:'}
                {activeTab === 'how_to_apply' && '🚀 Steps to Apply:'}
                {activeTab === 'expected_output' && '✅ Verify Your Results:'}
                {activeTab === 'skill_blueprint' && '⚡ How Agent Skills Power This Prompt:'}
              </span>
              {/* Action buttons for all tabs */}
              <div className="flex items-center gap-2">
                {/* Review button - show for all tabs when content is available */}
                {activeTab === 'prompt' && !isStreaming && !isLoadingPrompt && promptText && (
                  <>
                    <ExpandableOutputModal
                      content={promptText}
                      title={`${title} - Generated Prompt`}
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
                    title={`${title} - How to Apply`}
                    isStreaming={false}
                    buttonColor="emerald"
                  />
                )}
                {activeTab === 'expected_output' && !isLoadingMetadata && expectedOutputText && (
                  <ExpandableOutputModal
                    content={expectedOutputText}
                    title={`${title} - Verify Results`}
                    isStreaming={false}
                    buttonColor="amber"
                  />
                )}
                {activeTab === 'skill_blueprint' && skillBlueprint && (
                  <SkillBlueprintFullScreenModal
                    config={skillBlueprint}
                    title={`${title} - Agent Skills`}
                  />
                )}
              </div>
            </div>
            {activeTab === 'prompt' && (
              isLoadingPrompt && !promptText ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-[13px]">Generating prompt...</span>
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
                <>
                  {/* Images for How to Apply */}
                  {Array.isArray(generatedContent?.how_to_apply_images) && generatedContent.how_to_apply_images.length > 0 && (
                    <ImageGallery
                      images={generatedContent.how_to_apply_images}
                      editable={false}
                      color="emerald"
                    />
                  )}
                  <MarkdownContent 
                    ref={inputContentRef}
                    content={howToApplyText || '_No application steps defined for this section._'} 
                    isStreaming={false}
                    maxPreviewLines={12}
                  />
                </>
              )
            )}
            {activeTab === 'expected_output' && (
              isLoadingMetadata ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="text-[13px]">Loading verification checklist...</span>
                </div>
              ) : (
                <>
                  <VerificationLinks sectionTag={sectionTag} sessionId={sessionId || null} />
                  {/* Images for Expected Output */}
                  {Array.isArray(generatedContent?.expected_output_images) && generatedContent.expected_output_images.length > 0 && (
                    <ImageGallery
                      images={generatedContent.expected_output_images}
                      editable={false}
                      color="amber"
                    />
                  )}
                  <MarkdownContent 
                    content={expectedOutputText || '_No expected output defined for this section._'} 
                    isStreaming={false}
                    maxPreviewLines={12}
                  />
                </>
              )
            )}
            {activeTab === 'skill_blueprint' && skillBlueprint && (
              <SkillBlueprintTab
                config={skillBlueprint}
                shouldAnimate={!skillAnimPlayedRef.current}
                onMounted={() => { skillAnimPlayedRef.current = true; }}
              />
            )}
          </div>
        </div>
      )}

          {/* Footer bar: Skip + Mark Done */}
          {onToggleComplete && (
            <div ref={footerRef} className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              {/* Left side: Skip / Undo Skip */}
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
              {/* Right side: Mark Done / Complete badge */}
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
                    active={canClickMarkComplete}
                    onClick={(e) => { e.stopPropagation(); handleMarkComplete(); }}
                    disabled={!canClickMarkComplete}
                  >
                    Done
                  </BorderBeamButton>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}


