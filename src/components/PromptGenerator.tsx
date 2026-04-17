import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2, ChevronDown, Maximize2, Minimize2, X, Check, RotateCcw, Library, PenLine, Palette, Globe } from 'lucide-react';
import { apiClient, type SelectOption } from '../api/client';
import { useUseCaseBuilder } from '../hooks/useUseCaseBuilder';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { UseCaseBuilderPanel } from './UseCaseBuilderPanel';
import { getLevelUIOverrides, type WorkshopLevel } from '../constants/workflowSections';
import { IntentPathSelector, type IntentPath } from './IntentPathSelector';
import { IndustryChips } from './IndustryChips';
import { UseCaseCardGrid } from './UseCaseCardGrid';
import { SkillPathPanel } from './SkillPathPanel';
import { UseCaseDescriptionBox } from './UseCaseDescriptionBox';

const SKILL_USE_CASES = new Set(['build_skill']);

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
  const [skills, setSkills] = useState<Record<string, SelectOption[]>>({});
  const [promptTemplates, setPromptTemplates] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Path selector: 'use_case' or 'skill' -- eagerly derived from props for instant render on session restore
  const [selectedPath, setSelectedPath] = useState<IntentPath>(
    initialIndustry && initialUseCase
      ? (SKILL_USE_CASES.has(initialUseCase) ? 'skill' : 'use_case')
      : null
  );

  // Mode: library (pick from cards) or custom (define your own)
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

  const handleEnterEditMode = () => {
    builder.setOutputText(editedDescription || defaultDescription);
    builder.setError(null);
    setIsEditMode(true);
  };

  const handleResetEdits = () => {
    setEditedUseCaseLabel(defaultUseCaseLabel);
    setEditedDescription(defaultDescription);
    builder.setOutputText(defaultDescription);
    setIsEditMode(false);
  };

  const handleDoneEditing = () => {
    const refinedText = builder.isEditing ? builder.editText : builder.outputText;
    if (refinedText.trim()) {
      setEditedDescription(refinedText);
    }
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
      setSelectedPath(null);
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
      setSelectedPath(SKILL_USE_CASES.has(initialUseCase) ? 'skill' : 'use_case');
    }
  }, [initialIndustry, initialUseCase, initialPrompt]);

  // Auto-detect path and custom use case on session restore
  useEffect(() => {
    if (!initialIndustry || !initialUseCase || industries.length === 0) return;

    // Detect skill path from API skills data or convention
    const isSkill = Object.values(skills).flat().some(s => s.value === initialUseCase)
      || (useCases[initialIndustry] || []).some(u => u.value === initialUseCase && u.path_type === 'skill');
    
    if (isSkill) {
      setSelectedPath('skill');
      return;
    }

    setSelectedPath('use_case');
    
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
      builder.setIndustry(restoredIndustry);
      builder.setUseCaseName(restoredName);
      if (restoredDesc) builder.setOutputText(restoredDesc);
    }
  }, [industries, useCases, skills, initialIndustry, initialUseCase, initialCustomUseCaseLabel, initialCustomDescription]);

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

  useEffect(() => {
    if (initialCustomUseCaseLabel) setEditedUseCaseLabel(initialCustomUseCaseLabel);
    if (initialCustomDescription) setEditedDescription(initialCustomDescription);
  }, [initialCustomUseCaseLabel, initialCustomDescription]);

  useEffect(() => {
    if (mode !== 'custom') return;
    if (builder.industry) setCustomIndustry(builder.industry);
    if (builder.useCaseName) setCustomUseCaseName(builder.useCaseName);
    if (builder.outputText) setCustomUseCaseDescription(builder.outputText);
  }, [mode, builder.industry, builder.useCaseName, builder.outputText]);

  // Fetch all data on mount or refresh
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getAllData();
        setIndustries(data.industries);
        setUseCases(data.use_cases);
        setSkills(data.skills || {});
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

  // Auto-select single industry
  useEffect(() => {
    if (hasStarted || selectedIndustry || mode !== 'library' || selectedPath !== 'use_case') return;
    const filtered = industries.filter(i => i.value !== '');
    if (filtered.length === 1) {
      setSelectedIndustry(filtered[0].value);
    }
  }, [industries, hasStarted, selectedIndustry, mode, selectedPath]);

  const handleIndustryChange = (value: string) => {
    setSelectedIndustry(value === selectedIndustry ? '' : value);
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
      if (!customIndustry.trim() || !customUseCaseName.trim() || !customUseCaseDescription.trim()) return;
      setIsGenerating(true);
      setHasStarted(true);
      
      try {
        const industrySlug = toSlug(customIndustry);
        const useCaseSlug = toSlug(customUseCaseName);
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

    if (onBrandUrlChange) {
      onBrandUrlChange(brandUrl.trim());
    }
  };

  const handleSkillGetStarted = (industry: string, useCase: string, industryLabel: string, useCaseLabel: string, description: string) => {
    setSelectedIndustry(industry);
    setSelectedUsecase(useCase);
    setHasStarted(true);
    onPromptGenerated(description, industry, useCase, industryLabel, useCaseLabel);
    if (onBrandUrlChange) onBrandUrlChange(brandUrl.trim());
  };

  const availableUsecases = selectedIndustry ? (useCases[selectedIndustry] || []) : [];

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
      {/* Clickable Header */}
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
            Choose your path and set the direction for your workshop
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-5 pb-5">
          {/* Path Selector */}
          {!hasStarted && (
            <IntentPathSelector
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              disabled={hasStarted}
            />
          )}

          {/* Done badge with path info */}
          {hasStarted && (
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-ui-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                {selectedPath === 'skill' ? 'Skill' : mode === 'library' ? 'From Library' : 'Custom Use Case'}
              </span>
            </div>
          )}

          {/* ====== USE CASE PATH ====== */}
          {selectedPath === 'use_case' && (
            <>
              {/* Mode Toggle */}
              {!hasStarted && (
                <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-lg border border-border/50 mb-5">
                  <button
                    onClick={() => handleModeChange('library')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-ui-sm font-medium transition-all duration-200 ${
                      mode === 'library'
                        ? 'bg-card text-foreground shadow-sm border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Library className="w-3.5 h-3.5" />
                    Choose from Library
                  </button>
                  <button
                    onClick={() => handleModeChange('custom')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-ui-sm font-medium transition-all duration-200 ${
                      mode === 'custom'
                        ? 'bg-card text-foreground shadow-sm border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Create Your Own
                  </button>
                </div>
              )}

              {/* LIBRARY MODE */}
              {mode === 'library' && (
                <>
                  {hasStarted && (
                    <div className="space-y-3 mb-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-ui-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Industry</label>
                          <p className="text-ui-base text-foreground bg-muted/50 rounded-md px-3 py-1.5">
                            {industries.find(i => i.value === selectedIndustry)?.label || selectedIndustry || '—'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-ui-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Use Case</label>
                          <p className="text-ui-base text-foreground bg-muted/50 rounded-md px-3 py-1.5">
                            {displayLabel || selectedUsecase || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasStarted && (
                    <>
                      <IndustryChips
                        industries={industries}
                        selectedIndustry={selectedIndustry}
                        onSelect={handleIndustryChange}
                        disabled={hasStarted}
                      />
                      {selectedIndustry && (
                        <UseCaseCardGrid
                          useCases={availableUsecases}
                          selectedUseCase={selectedUsecase}
                          onSelect={handleUsecaseChange}
                          disabled={hasStarted}
                        />
                      )}
                    </>
                  )}

                  {selectedIndustry && selectedUsecase && promptTemplates[selectedIndustry]?.[selectedUsecase] && (
                    isEditMode && !hasStarted ? (
                      <div className="mb-5 space-y-3 animate-slide-up-fade">
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
                          <div className="flex items-center justify-between mt-1 min-h-[1.125rem]">
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
                        <UseCaseBuilderPanel builder={builder} compact hideInputs hideSave />
                        <div className="flex items-center gap-2">
                          <button onClick={handleDoneEditing} className="px-3 py-1.5 text-ui-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all">Done</button>
                          <button onClick={handleResetEdits} className="flex items-center gap-1 px-3 py-1.5 text-ui-sm rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                            <RotateCcw className="w-3 h-3" />
                            Reset to default
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="transition-opacity duration-300 animate-slide-up-fade">
                        <UseCaseDescriptionBox 
                          content={displayContent}
                          useCase={displayLabel}
                          isEdited={!!isEdited}
                          onEdit={!hasStarted ? handleEnterEditMode : undefined}
                          onContentChange={!hasStarted ? (text) => setEditedDescription(text) : undefined}
                        />
                      </div>
                    )
                  )}
                </>
              )}

              {/* CUSTOM MODE */}
              {mode === 'custom' && (
                <div className="mb-5">
                  {hasStarted ? (
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
                        <UseCaseDescriptionBox content={customUseCaseDescription} useCase={customUseCaseName || 'Custom Use Case'} />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-ui-xs text-muted-foreground">Build your use case with AI assistance</p>
                        <button
                          onClick={() => setIsBuilderExpanded(true)}
                          className="flex items-center gap-1 px-2 py-0.5 text-ui-xs rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all hover:scale-105"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Expand</span>
                        </button>
                      </div>
                      <UseCaseBuilderPanel builder={builder} compact hideSave />
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
                            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30 rounded-t-lg">
                              <div className="flex items-center gap-2">
                                <PenLine className="w-4 h-4 text-primary" />
                                <h3 className="text-ui-lg font-semibold text-foreground">Create Your Own Use Case</h3>
                              </div>
                              <button onClick={() => setIsBuilderExpanded(false)} className="flex items-center gap-1.5 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Close (Esc)">
                                <Minimize2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-5 py-4">
                              <UseCaseBuilderPanel builder={builder} hideSave />
                            </div>
                            <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-secondary/20 rounded-b-lg">
                              <span className="text-ui-xs text-muted-foreground">Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-ui-2xs font-mono">Esc</kbd> to close</span>
                              <span className="text-ui-xs text-muted-foreground">All changes are preserved when you close</span>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Branding (shared across library/custom) */}
              {selectedPath === 'use_case' && (() => {
                if (hasStarted && !brandUrl.trim()) return null;
                const parsedName = brandUrl.trim() ? extractCompanyName(brandUrl.trim()) : null;
                if (hasStarted && brandUrl.trim()) {
                  return (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-md border border-border/50">
                      <Palette className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-ui-sm font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">{parsedName || 'Brand URL set'}</span>
                      <span className="text-ui-xs text-muted-foreground truncate flex-1" title={brandUrl}>{brandUrl}</span>
                    </div>
                  );
                }
                return (
                  <div className="mb-4">
                    <button type="button" onClick={() => setShowBranding(!showBranding)} className="w-full flex items-center gap-2 py-1.5 text-left group">
                      <Palette className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-ui-sm text-muted-foreground group-hover:text-foreground transition-colors">Branding</span>
                      <span className="text-ui-2xs bg-secondary/50 text-muted-foreground/70 rounded-full px-1.5 py-0.5 leading-none">Optional</span>
                      <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto transition-transform duration-200 ${showBranding ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showBranding ? 'max-h-[200px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                      <div className="border border-border/50 rounded-md bg-secondary/20 p-3">
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                          <input type="url" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder="https://www.brandcolorcode.com/company-name" className="w-full pl-9 pr-8 py-2 text-ui-base border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-input text-foreground placeholder:text-muted-foreground/40" />
                          {brandUrl && (
                            <button type="button" onClick={() => setBrandUrl('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-ui-xs text-muted-foreground/60 mt-1.5">Paste a URL with brand colors and assets. UI design prompts will apply these for styling.</p>
                        {brandUrl.trim() && (
                          <div className="mt-2 animate-in fade-in duration-300">
                            <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                              {parsedName ? <><Palette className="w-3 h-3" />{parsedName}</> : <><Check className="w-3 h-3" />Brand URL set</>}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Get Started Button for Use Case path */}
              {(() => {
                const baseClasses = 'w-full py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-ui-base font-medium';
                if (!prerequisitesCompleted) return <button disabled className={`${baseClasses} bg-muted text-muted-foreground cursor-not-allowed opacity-60`}><Sparkles className="w-4 h-4" />Complete Prerequisites First</button>;
                if (isGenerating) return <button disabled className={`${baseClasses} bg-emerald-600 text-white`}><Loader2 className="w-4 h-4 animate-spin" />Starting...</button>;
                if (hasStarted) return <button onClick={() => setHasStarted(false)} className={`${baseClasses} bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60`}><RotateCcw className="w-4 h-4" />Get Started</button>;
                if (canStart) return <div className="border-beam-wrapper w-full"><button onClick={handleGeneratePrompt} className={`${baseClasses} relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500`}><Sparkles className="w-4 h-4" />Get Started</button></div>;
                return <button disabled className={`${baseClasses} bg-muted text-muted-foreground cursor-not-allowed`}><Sparkles className="w-4 h-4" />Get Started</button>;
              })()}
            </>
          )}

          {/* ====== SKILL PATH ====== */}
          {selectedPath === 'skill' && (
            <SkillPathPanel
              skills={skills}
              promptTemplates={promptTemplates}
              onGetStarted={handleSkillGetStarted}
              hasStarted={hasStarted}
            />
          )}
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

