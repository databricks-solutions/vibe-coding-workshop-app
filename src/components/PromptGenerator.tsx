import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2, ChevronDown, Maximize2, Minimize2, X, Copy, Check, Pencil, RotateCcw, Library, PenLine, Palette, Globe } from 'lucide-react';
import { apiClient, type SelectOption } from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUseCaseBuilder } from '../hooks/useUseCaseBuilder';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { UseCaseBuilderPanel } from './UseCaseBuilderPanel';
import { getLevelUIOverrides, type WorkshopLevel } from '../constants/workflowSections';

type DefineMode = 'library' | 'custom';

interface PromptGeneratorProps {
  onPromptGenerated: (prompt: string, industry: string, useCase: string, industryLabel?: string, useCaseLabel?: string, customDescription?: string) => void;
  onBrandUrlChange?: (url: string) => void;
  initialIndustry?: string;
  initialUseCase?: string;
  initialPrompt?: string;
  initialCustomUseCaseLabel?: string;
  initialCustomDescription?: string;
  initialBrandUrl?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  prerequisitesCompleted?: boolean;
  dataRefreshKey?: number;
  workshopLevel?: WorkshopLevel;
}

function extractCompanyName(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (path) {
      const lastSeg = path.split('/').pop() || '';
      if (lastSeg.length > 2 && /[a-zA-Z]/.test(lastSeg)) {
        return lastSeg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  } catch {
    // invalid URL -- ignore
  }
  return null;
}

export function PromptGenerator({ 
  onPromptGenerated,
  onBrandUrlChange,
  initialIndustry = '',
  initialUseCase = '',
  initialPrompt = '',
  initialCustomUseCaseLabel = '',
  initialCustomDescription = '',
  initialBrandUrl = '',
  isExpanded = true,
  onToggleExpand,
  prerequisitesCompleted = false,
  dataRefreshKey = 0,
  workshopLevel = 'end-to-end',
}: PromptGeneratorProps) {
  const levelOverrides = getLevelUIOverrides(workshopLevel);
  const defaultMode: DefineMode = levelOverrides.defaultUseCaseMode ?? 'library';

  // State for fetched data
  const [industries, setIndustries] = useState<SelectOption[]>([]);
  const [useCases, setUseCases] = useState<Record<string, SelectOption[]>>({});
  const [promptTemplates, setPromptTemplates] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode: library (pick from dropdowns) or custom (define your own)
  const [mode, setMode] = useState<DefineMode>(defaultMode);

  // Library mode state
  const [selectedIndustry, setSelectedIndustry] = useState(initialIndustry);
  const [selectedUsecase, setSelectedUsecase] = useState(initialUseCase);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStarted, setHasStarted] = useState(!!initialIndustry && !!initialUseCase);

  // Edit mode for library selections
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedUseCaseLabel, setEditedUseCaseLabel] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [defaultUseCaseLabel, setDefaultUseCaseLabel] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');

  // Custom mode state
  const [customIndustry, setCustomIndustry] = useState('');
  const [customUseCaseName, setCustomUseCaseName] = useState('');
  const [customUseCaseDescription, setCustomUseCaseDescription] = useState('');

  // Branding URL (optional)
  const [brandUrl, setBrandUrl] = useState(initialBrandUrl);
  const [showBranding, setShowBranding] = useState(!!initialBrandUrl);

  // Shared builder hook for the "Create Your Own" AI-powered flow
  const builder = useUseCaseBuilder();

  // Full-screen expand for the builder panel
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(false);

  const closeBuilder = useCallback(() => setIsBuilderExpanded(false), []);
  useEscapeKey(isBuilderExpanded, closeBuilder);

  useEffect(() => {
    if (isBuilderExpanded) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBuilderExpanded]);

  const isEdited = (editedUseCaseLabel && editedUseCaseLabel !== defaultUseCaseLabel) || 
                   (editedDescription && editedDescription !== defaultDescription);

  const handleResetEdits = () => {
    setEditedUseCaseLabel(defaultUseCaseLabel);
    setEditedDescription(defaultDescription);
    setIsEditMode(false);
  };

  const handleDoneEditing = () => {
    setIsEditMode(false);
  };

  const displayContent = (editedDescription && editedDescription !== defaultDescription) 
    ? editedDescription 
    : (promptTemplates[selectedIndustry]?.[selectedUsecase] || '');
  const displayLabel = (editedUseCaseLabel && editedUseCaseLabel !== defaultUseCaseLabel) 
    ? editedUseCaseLabel 
    : (availableUsecasesRef(useCases, selectedIndustry, selectedUsecase) || selectedUsecase);

  // Update state when initial props change (e.g., when loading a session or creating new session)
  useEffect(() => {
    if (!initialIndustry && !initialUseCase) {
      setSelectedIndustry('');
      setSelectedUsecase('');
      setHasStarted(false);
      setIsEditMode(false);
      setEditedUseCaseLabel('');
      setEditedDescription('');
      setDefaultUseCaseLabel('');
      setDefaultDescription('');
      setMode(defaultMode);
      setCustomIndustry('');
      setCustomUseCaseName('');
      setCustomUseCaseDescription('');
      // Reset builder hook state
      builder.setIndustry('');
      builder.setUseCaseName('');
      builder.setHints('');
      builder.setAttachments([]);
      builder.setOutputText('');
      builder.setError(null);
      return;
    }
    
    if (initialIndustry) {
      setSelectedIndustry(initialIndustry);
    }
    if (initialUseCase) {
      setSelectedUsecase(initialUseCase);
    }
    if (initialIndustry && initialUseCase) {
      setHasStarted(true);
    }
  }, [initialIndustry, initialUseCase, initialPrompt]);

  // Auto-detect custom use case on session restore:
  // If industry/useCase don't match any known dropdown values, switch to custom mode
  useEffect(() => {
    if (!initialIndustry || !initialUseCase || industries.length === 0) return;
    
    const industryExists = industries.some(i => i.value === initialIndustry);
    const useCaseExists = industryExists && (useCases[initialIndustry] || []).some(u => u.value === initialUseCase);
    
    if (!industryExists || !useCaseExists) {
      setMode('custom');
      const industryLabel = industries.find(i => i.value === initialIndustry)?.label || initialIndustry;
      const restoredIndustry = industryExists ? industryLabel : initialIndustry;
      const restoredName = initialCustomUseCaseLabel || initialUseCase;
      const restoredDesc = initialCustomDescription || '';
      setCustomIndustry(restoredIndustry);
      setCustomUseCaseName(restoredName);
      setCustomUseCaseDescription(restoredDesc);
      // Sync builder hook state for session restore
      builder.setIndustry(restoredIndustry);
      builder.setUseCaseName(restoredName);
      if (restoredDesc) builder.setOutputText(restoredDesc);
    }
  }, [industries, useCases, initialIndustry, initialUseCase, initialCustomUseCaseLabel, initialCustomDescription]);

  // Populate defaults when data loads and a use case is already selected (session restore)
  useEffect(() => {
    if (selectedIndustry && selectedUsecase && Object.keys(promptTemplates).length > 0) {
      const template = promptTemplates[selectedIndustry]?.[selectedUsecase] || '';
      const label = (useCases[selectedIndustry] || []).find(u => u.value === selectedUsecase)?.label || selectedUsecase;
      setDefaultUseCaseLabel(label);
      setDefaultDescription(template);
      if (!editedUseCaseLabel) setEditedUseCaseLabel(label);
      if (!editedDescription) setEditedDescription(template);
    }
  }, [promptTemplates, useCases, selectedIndustry, selectedUsecase]);

  // Restore custom edits from session when loading (overrides defaults)
  useEffect(() => {
    if (initialCustomUseCaseLabel) setEditedUseCaseLabel(initialCustomUseCaseLabel);
    if (initialCustomDescription) setEditedDescription(initialCustomDescription);
  }, [initialCustomUseCaseLabel, initialCustomDescription]);

  // Sync builder hook outputs -> PromptGenerator custom fields
  useEffect(() => {
    if (mode !== 'custom') return;
    if (builder.industry) setCustomIndustry(builder.industry);
    if (builder.useCaseName) setCustomUseCaseName(builder.useCaseName);
    if (builder.outputText) setCustomUseCaseDescription(builder.outputText);
  }, [mode, builder.industry, builder.useCaseName, builder.outputText]);

  // Fetch all data on component mount or when dataRefreshKey changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getAllData();
        setIndustries(data.industries);
        setUseCases(data.use_cases);
        setPromptTemplates(data.prompt_templates);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dataRefreshKey]);

  const handleIndustryChange = (value: string) => {
    setSelectedIndustry(value);
    setSelectedUsecase('');
    setIsEditMode(false);
    setEditedUseCaseLabel('');
    setEditedDescription('');
    setDefaultUseCaseLabel('');
    setDefaultDescription('');
  };

  const handleUsecaseChange = (value: string) => {
    setSelectedUsecase(value);
    setIsEditMode(false);
    if (selectedIndustry && value) {
      const template = promptTemplates[selectedIndustry]?.[value] || '';
      const label = (useCases[selectedIndustry] || []).find(u => u.value === value)?.label || value;
      setDefaultUseCaseLabel(label);
      setDefaultDescription(template);
      setEditedUseCaseLabel(label);
      setEditedDescription(template);
    } else {
      setDefaultUseCaseLabel('');
      setDefaultDescription('');
      setEditedUseCaseLabel('');
      setEditedDescription('');
    }
  };

  const handleModeChange = (newMode: DefineMode) => {
    if (hasStarted) return;
    setMode(newMode);
  };

  // Normalize a string to a slug-like value for storage
  const toSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleGeneratePrompt = async () => {
    if (mode === 'library') {
      if (!selectedIndustry || !selectedUsecase) return;
      setIsGenerating(true);
      setHasStarted(true);
      setIsEditMode(false);
      
      try {
        const prompt = editedDescription || promptTemplates[selectedIndustry]?.[selectedUsecase] || '';
        const industryLabel = industries.find(i => i.value === selectedIndustry)?.label || selectedIndustry;
        const useCaseLabel = editedUseCaseLabel || availableUsecases.find(u => u.value === selectedUsecase)?.label || selectedUsecase;
        const customDesc = (editedDescription && editedDescription !== defaultDescription) ? editedDescription : undefined;
        
        onPromptGenerated(prompt, selectedIndustry, selectedUsecase, industryLabel, useCaseLabel, customDesc);
      } catch (err) {
        console.error('Failed to generate prompt:', err);
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Custom mode
      if (!customIndustry.trim() || !customUseCaseName.trim() || !customUseCaseDescription.trim()) return;
      setIsGenerating(true);
      setHasStarted(true);
      
      try {
        const industrySlug = toSlug(customIndustry);
        const useCaseSlug = toSlug(customUseCaseName);
        
        // Set library state so downstream code has values
        setSelectedIndustry(industrySlug);
        setSelectedUsecase(useCaseSlug);
        
        onPromptGenerated(
          customUseCaseDescription.trim(),
          industrySlug,
          useCaseSlug,
          customIndustry.trim(),
          customUseCaseName.trim(),
          customUseCaseDescription.trim()
        );
      } catch (err) {
        console.error('Failed to generate prompt:', err);
      } finally {
        setIsGenerating(false);
      }
    }

    // Persist brand URL as session parameter override (empty string clears it)
    if (onBrandUrlChange) {
      onBrandUrlChange(brandUrl.trim());
    }
  };

  const availableUsecases = selectedIndustry ? (useCases[selectedIndustry] || []) : [];

  // Determine if "Get Started" should be enabled
  const canStart = mode === 'library'
    ? prerequisitesCompleted && !!selectedIndustry && !!selectedUsecase && !hasStarted && !isGenerating
    : prerequisitesCompleted && !!customIndustry.trim() && !!customUseCaseName.trim() && !!customUseCaseDescription.trim() && !hasStarted && !isGenerating && !builder.isStreaming;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-5 border border-border">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-muted-foreground text-ui-base">Loading industries and use cases...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg p-5 border border-red-700/30">
        <div className="text-center">
          <p className="text-red-400 mb-3 text-ui-base">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-red-900/30 text-red-300 rounded text-ui-base hover:bg-red-900/50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Clickable Header - Always Visible */}
      <button
        onClick={onToggleExpand}
        className="group w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      >
        <div className="p-2 rounded-md bg-primary/20">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h2 className={`text-ui-lg font-semibold text-foreground ${hasStarted ? 'line-through opacity-50' : ''}`}>
              Define Your Intent
            </h2>
            {hasStarted && (
              <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">Done</span>
            )}
          </div>
          <p className={`text-muted-foreground text-ui-base ${hasStarted ? 'line-through opacity-50' : ''}`}>
            Select your industry and use case to set the direction for your workshop
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-5 pb-5">
          {/* Segmented Toggle */}
          {!hasStarted && (
            <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg mb-5">
              <button
                onClick={() => handleModeChange('library')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-ui-sm font-medium transition-all duration-200 ${
                  mode === 'library'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                Choose from Library
              </button>
              <button
                onClick={() => handleModeChange('custom')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-ui-sm font-medium transition-all duration-200 ${
                  mode === 'custom'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                Create Your Own
              </button>
            </div>
          )}

          {/* Show current mode badge when step is done */}
          {hasStarted && (
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-ui-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                {mode === 'library' ? <Library className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
                {mode === 'library' ? 'From Library' : 'Custom Use Case'}
              </span>
            </div>
          )}

          {/* ====== LIBRARY MODE ====== */}
          {mode === 'library' && (
            <>
              {!hasStarted && !selectedIndustry && (
                <div className="mb-4 px-3 py-2.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-ui-sm flex items-center gap-2 animate-in fade-in duration-500">
                  <Sparkles className="w-4 h-4 flex-shrink-0 animate-pulse" />
                  <span className="font-medium">Select an industry and use case below to get started</span>
                </div>
              )}
              <div className="space-y-3 mb-5">
                {/* Industry Dropdown */}
                <div>
                  <label className="block text-ui-base font-medium text-foreground mb-1.5">Industry</label>
                  <select
                    value={selectedIndustry}
                    onChange={(e) => handleIndustryChange(e.target.value)}
                    disabled={hasStarted}
                    className="w-full px-3 py-2 text-ui-base border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-input text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                  >
                    {industries.map((industry) => (
                      <option key={industry.value} value={industry.value}>
                        {industry.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Use Case Dropdown */}
                <div>
                  <label className="block text-ui-base font-medium text-foreground mb-1.5">Use Case</label>
                  <select
                    value={selectedUsecase}
                    onChange={(e) => handleUsecaseChange(e.target.value)}
                    disabled={!selectedIndustry || hasStarted}
                    className="w-full px-3 py-2 text-ui-base border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-input text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                  >
                    {availableUsecases.length > 0 ? (
                      availableUsecases.map((usecase) => (
                        <option key={usecase.value} value={usecase.value}>
                          {usecase.label}
                        </option>
                      ))
                    ) : (
                      <option value="">Select an industry first...</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Description of the Use Case - rendered markdown (default) or edit mode */}
              {selectedIndustry && selectedUsecase && promptTemplates[selectedIndustry]?.[selectedUsecase] && (
                isEditMode && !hasStarted ? (
                  <div className="mb-5 space-y-3">
                    <div>
                      <label className="block text-ui-base font-medium text-foreground mb-1.5">Use Case Name</label>
                      <input
                        type="text"
                        value={editedUseCaseLabel}
                        maxLength={30}
                        onChange={(e) => setEditedUseCaseLabel(e.target.value)}
                        className={`w-full px-3 py-2 text-ui-base border rounded-md focus:ring-2 outline-none transition-all bg-input text-foreground ${
                          editedUseCaseLabel.length >= 30
                            ? 'border-red-400/70 focus:ring-red-400/50 focus:border-red-400/70'
                            : editedUseCaseLabel.length >= 25
                              ? 'border-amber-400/70 focus:ring-amber-400/50 focus:border-amber-400/70'
                              : 'border-border focus:ring-primary focus:border-primary'
                        }`}
                        placeholder="Enter use case name..."
                      />
                      <div className="flex items-center justify-between mt-1 min-h-[18px]">
                        <span className="text-ui-2xs text-muted-foreground/60">Short, descriptive name</span>
                        {editedUseCaseLabel.length >= 20 && (
                          <span className={`text-ui-2xs font-medium transition-colors ${
                            editedUseCaseLabel.length >= 30 ? 'text-red-500' : editedUseCaseLabel.length >= 25 ? 'text-amber-500' : 'text-muted-foreground/60'
                          }`}>
                            {editedUseCaseLabel.length >= 30 ? '30/30 — Try a shorter name' : `${editedUseCaseLabel.length}/30`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-ui-base font-medium text-foreground mb-1.5">Description</label>
                      <textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 text-ui-base border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-input text-foreground font-mono leading-relaxed resize-y"
                        placeholder="Enter use case description..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDoneEditing}
                        className="px-3 py-1.5 text-ui-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      >
                        Done
                      </button>
                      <button
                        onClick={handleResetEdits}
                        className="flex items-center gap-1 px-3 py-1.5 text-ui-sm rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to default
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="transition-opacity duration-300">
                    <UseCaseDescriptionBox 
                      content={displayContent}
                      useCase={displayLabel}
                      isEdited={!!isEdited}
                      onEdit={!hasStarted ? () => setIsEditMode(true) : undefined}
                    />
                  </div>
                )
              )}
            </>
          )}

          {/* ====== CUSTOM MODE ====== */}
          {mode === 'custom' && (
            <div className="mb-5">
              {hasStarted ? (
                /* When step is done, show a read-only summary with formatted markdown */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ui-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Industry</label>
                      <p className="text-ui-base text-foreground bg-muted/50 rounded-md px-3 py-1.5">{customIndustry || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-ui-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Use Case</label>
                      <p className="text-ui-base text-foreground bg-muted/50 rounded-md px-3 py-1.5">{customUseCaseName || '—'}</p>
                    </div>
                  </div>
                  {customUseCaseDescription && (
                    <UseCaseDescriptionBox
                      content={customUseCaseDescription}
                      useCase={customUseCaseName || 'Custom Use Case'}
                    />
                  )}
                </div>
              ) : (
                <>
                  {/* Expand toolbar */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-ui-xs text-muted-foreground">
                      Build your use case with AI assistance
                    </p>
                    <button
                      onClick={() => setIsBuilderExpanded(true)}
                      className="flex items-center gap-1 px-2 py-0.5 text-ui-xs rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all hover:scale-105"
                      title="Expand to full screen for more space"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Expand</span>
                    </button>
                  </div>

                  <UseCaseBuilderPanel builder={builder} compact hideSave />

                  {/* Full-screen modal (portal) */}
                  {isBuilderExpanded && createPortal(
                    <div
                      className="fixed inset-0 flex items-center justify-center p-4"
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, width: '100vw', height: '100vh' }}
                      onClick={() => setIsBuilderExpanded(false)}
                    >
                      <div className="absolute inset-0 bg-black/90" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

                      <div
                        className="relative bg-card border border-border rounded-lg shadow-2xl flex flex-col animate-fade-in"
                        style={{ width: 'calc(100vw - 48px)', height: 'calc(100vh - 48px)', maxWidth: 'none', zIndex: 100000 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30 rounded-t-lg">
                          <div className="flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-primary" />
                            <h3 className="text-ui-lg font-semibold text-foreground">Create Your Own Use Case</h3>
                          </div>
                          <button
                            onClick={() => setIsBuilderExpanded(false)}
                            className="flex items-center gap-1.5 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Close (Esc)"
                          >
                            <Minimize2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Builder panel at full size */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                          <UseCaseBuilderPanel builder={builder} hideSave />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-secondary/20 rounded-b-lg">
                          <span className="text-ui-xs text-muted-foreground">
                            Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-ui-2xs font-mono">Esc</kbd> to close
                          </span>
                          <span className="text-ui-xs text-muted-foreground">
                            All changes are preserved when you close
                          </span>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </div>
          )}

          {/* ====== BRANDING (Optional) — shared across both modes ====== */}
          {(() => {
            // After start: only show if a brand URL was provided
            if (hasStarted && !brandUrl.trim()) return null;

            const parsedName = brandUrl.trim() ? extractCompanyName(brandUrl.trim()) : null;

            // Read-only summary after Get Started
            if (hasStarted && brandUrl.trim()) {
              return (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-md border border-border/50">
                  <Palette className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {parsedName ? (
                    <span className="text-ui-sm font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">{parsedName}</span>
                  ) : (
                    <span className="text-ui-sm font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Brand URL set</span>
                  )}
                  <span className="text-ui-xs text-muted-foreground truncate flex-1" title={brandUrl}>{brandUrl}</span>
                </div>
              );
            }

            // Editable state (before Get Started)
            return (
              <div className="mb-4">
                {/* Toggle row */}
                <button
                  type="button"
                  onClick={() => setShowBranding(!showBranding)}
                  className="w-full flex items-center gap-2 py-1.5 text-left group"
                >
                  <Palette className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-ui-sm text-muted-foreground group-hover:text-foreground transition-colors">Branding</span>
                  <span className="text-ui-2xs bg-secondary/50 text-muted-foreground/70 rounded-full px-1.5 py-0.5 leading-none">Optional</span>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto transition-transform duration-200 ${showBranding ? 'rotate-180' : ''}`} />
                </button>

                {/* Expandable content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showBranding ? 'max-h-[200px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="border border-border/50 rounded-md bg-secondary/20 p-3">
                    {/* URL input with Globe icon */}
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input
                        type="url"
                        value={brandUrl}
                        onChange={(e) => setBrandUrl(e.target.value)}
                        placeholder="https://www.brandcolorcode.com/company-name"
                        className="w-full pl-9 pr-8 py-2 text-ui-base border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-input text-foreground placeholder:text-muted-foreground/40"
                      />
                      {brandUrl && (
                        <button
                          type="button"
                          onClick={() => setBrandUrl('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* Helper text */}
                    <p className="text-ui-xs text-muted-foreground/60 mt-1.5">
                      Paste a URL with brand colors and assets. UI design prompts will apply these for styling.
                    </p>
                    {/* Live preview chip */}
                    {brandUrl.trim() && (
                      <div className="mt-2 animate-in fade-in duration-300">
                        {parsedName ? (
                          <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                            <Palette className="w-3 h-3" />
                            {parsedName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                            <Check className="w-3 h-3" />
                            Brand URL set
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Get Started Button */}
          {(() => {
            const baseClasses = 'w-full py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-ui-base font-medium';

            if (!prerequisitesCompleted) {
              return (
                <button disabled className={`${baseClasses} bg-muted text-muted-foreground cursor-not-allowed opacity-60`} title="Complete prerequisites first">
                  <Sparkles className="w-4 h-4" />
                  Complete Prerequisites First
                </button>
              );
            }

            if (isGenerating) {
              return (
                <button disabled className={`${baseClasses} bg-emerald-600 text-white`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </button>
              );
            }

            if (hasStarted) {
              return (
                <button onClick={() => setHasStarted(false)} className={`${baseClasses} bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60`}>
                  <RotateCcw className="w-4 h-4" />
                  Get Started
                </button>
              );
            }

            if (canStart) {
              return (
                <div className="border-beam-wrapper w-full">
                  <button onClick={handleGeneratePrompt} className={`${baseClasses} relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500`}>
                    <Sparkles className="w-4 h-4" />
                    Get Started
                  </button>
                </div>
              );
            }

            return (
              <button disabled className={`${baseClasses} bg-muted text-muted-foreground cursor-not-allowed`}>
                <Sparkles className="w-4 h-4" />
                Get Started
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// Helper to look up the use case label from the useCases map
function availableUsecasesRef(useCases: Record<string, SelectOption[]>, industry: string, useCase: string): string {
  if (!industry || !useCase) return '';
  const list = useCases[industry] || [];
  return list.find(u => u.value === useCase)?.label || '';
}

// Component for displaying use case description with expand functionality
function UseCaseDescriptionBox({ content, useCase, isEdited, onEdit }: { 
  content: string; 
  useCase: string; 
  isEdited?: boolean;
  onEdit?: () => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  useEscapeKey(isModalOpen, closeModal);

  const handleCopy = async (closeModal: boolean = false) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (closeModal) {
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
            Description of the Use Case:
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
              className="flex items-center gap-1 px-2 py-0.5 text-ui-xs rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all hover:scale-105"
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

      {/* Modal rendered via Portal to document.body */}
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
                Use Case: {useCase}
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
