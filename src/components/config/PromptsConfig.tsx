/**
 * Use Case Descriptions Configuration Screen
 * Manage industries, use cases, and their descriptions with version history
 * Shows markdown preview by default, with edit mode toggle
 * Updated to match dark theme
 */

import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient } from '../../api/client';
import type { PromptConfig, ConfigVersionInfo } from '../../api/client';

// Styled markdown components for nice rendering (dark theme)
const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-xl font-bold text-foreground border-b border-border pb-2 mb-4 mt-2">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="text-muted-foreground mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-outside space-y-1 mb-3 text-muted-foreground ml-6">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-outside space-y-1 mb-3 text-muted-foreground ml-6">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="text-muted-foreground pl-1">{children}</li>
  ),
  code: ({ inline, children }: any) => 
    inline ? (
      <code className="bg-secondary text-primary px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ) : (
      <code className="block bg-slate-900 text-emerald-400 p-3 rounded-lg text-sm font-mono overflow-x-auto my-3 whitespace-pre-wrap">
        {children}
      </code>
    ),
  pre: ({ children }: any) => (
    <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg overflow-x-auto my-3 text-sm">
      {children}
    </pre>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-emerald-500 pl-4 my-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({ href, children }: any) => (
    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border border-border rounded">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="bg-secondary border border-border px-3 py-2 text-left text-sm font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-border px-3 py-2 text-sm text-muted-foreground">{children}</td>
  ),
};

interface PromptsConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

export function PromptsConfig({ onToast }: PromptsConfigProps) {
  // Data state
  const [configs, setConfigs] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selection state
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // View/Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  
  // Active status editing
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [editingActiveStatus, setEditingActiveStatus] = useState(false);

  // Version state
  const [versions, setVersions] = useState<ConfigVersionInfo[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);

  // Modal state
  const [showAddIndustryModal, setShowAddIndustryModal] = useState(false);
  const [showAddUseCaseModal, setShowAddUseCaseModal] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<{type: 'industry' | 'usecase', industry: string, useCase?: string} | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [newIndustryId, setNewIndustryId] = useState('');
  const [newIndustryLabel, setNewIndustryLabel] = useState('');
  const [newUseCaseId, setNewUseCaseId] = useState('');
  const [newUseCaseLabel, setNewUseCaseLabel] = useState('');

  // Load configs on mount
  useEffect(() => {
    loadConfigs();
  }, []);

  // Load versions when selection changes
  useEffect(() => {
    if (selectedIndustry && selectedUseCase) {
      loadVersions();
      setIsEditMode(false); // Reset to view mode when changing selection
    }
  }, [selectedIndustry, selectedUseCase]);

  // Update editor when selection changes
  useEffect(() => {
    const config = configs.find(
      c => c.industry === selectedIndustry && c.use_case === selectedUseCase
    );
    if (config) {
      setEditingTemplate(config.prompt_template);
      setIsDraft(false);
      setSelectedVersion(config.version);
      setIsViewingOldVersion(false);
      setEditingActiveStatus(config.is_active);
      setIsEditingActive(false);
    }
  }, [selectedIndustry, selectedUseCase, configs]);

  async function loadConfigs() {
    try {
      setLoading(true);
      const data = await apiClient.getLatestPromptConfigs();
      setConfigs(data);
    } catch (error) {
      onToast('Failed to load configurations', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions() {
    try {
      const data = await apiClient.getPromptConfigVersions(selectedIndustry, selectedUseCase);
      setVersions(data);
    } catch {
      setVersions([]);
    }
  }

  // Derive unique industries from configs
  const industries = useMemo(() => {
    const seen = new Set<string>();
    return configs
      .filter(c => {
        if (seen.has(c.industry)) return false;
        seen.add(c.industry);
        return true;
      })
      .filter(c => c.use_case !== '_placeholder')
      .map(c => ({ value: c.industry, label: c.industry_label }))
      .filter(i => !searchQuery || i.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [configs, searchQuery]);

  // Derive use cases for selected industry
  const useCases = useMemo(() => {
    return configs
      .filter(c => c.industry === selectedIndustry && c.use_case !== '_placeholder')
      .map(c => ({ value: c.use_case, label: c.use_case_label, is_active: c.is_active }));
  }, [configs, selectedIndustry]);

  // Current config for selected industry/use case
  const currentConfig = useMemo(() => {
    return configs.find(
      c => c.industry === selectedIndustry && c.use_case === selectedUseCase
    );
  }, [configs, selectedIndustry, selectedUseCase]);

  async function handleSelectVersion(version: number) {
    if (version === currentConfig?.version) {
      setEditingTemplate(currentConfig.prompt_template);
      setSelectedVersion(version);
      setIsViewingOldVersion(false);
      setIsDraft(false);
      return;
    }

    try {
      const oldConfig = await apiClient.getPromptConfigByVersion(
        selectedIndustry,
        selectedUseCase,
        version
      );
      setEditingTemplate(oldConfig.prompt_template);
      setSelectedVersion(version);
      setIsViewingOldVersion(true);
      setIsDraft(false);
    } catch {
      onToast('Failed to load version', 'error');
    }
  }

  function handleCopyToDraft() {
    setIsViewingOldVersion(false);
    setIsDraft(true);
    setIsEditMode(true);
  }

  function handleTemplateChange(value: string) {
    setEditingTemplate(value);
    setIsDraft(true);
  }

  function handleEditClick() {
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    // Reset to original value
    if (currentConfig) {
      setEditingTemplate(currentConfig.prompt_template);
    }
    setIsDraft(false);
    setIsEditMode(false);
  }

  async function handleSave() {
    if (!selectedIndustry || !selectedUseCase || !currentConfig) return;

    try {
      setSaving(true);
      const result = await apiClient.createPromptConfig({
        industry: selectedIndustry,
        industry_label: currentConfig.industry_label,
        use_case: selectedUseCase,
        use_case_label: currentConfig.use_case_label,
        prompt_template: editingTemplate,
      });

      onToast(`Saved version ${result.version}`, 'success');
      setShowConfirmSaveModal(false);
      setIsDraft(false);
      setIsEditMode(false); // Return to view mode after save
      await loadConfigs();
      await loadVersions();
    } catch (error) {
      onToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddIndustry() {
    if (!newIndustryId || !newIndustryLabel) return;

    try {
      setSaving(true);
      await apiClient.addIndustry({
        industry: newIndustryId.toLowerCase().replace(/\s+/g, '_'),
        industry_label: newIndustryLabel,
      });
      onToast(`Industry "${newIndustryLabel}" created`, 'success');
      setShowAddIndustryModal(false);
      setNewIndustryId('');
      setNewIndustryLabel('');
      await loadConfigs();
    } catch (error: any) {
      onToast(error?.message || 'Failed to add industry', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUseCase() {
    if (!selectedIndustry || !newUseCaseId || !newUseCaseLabel) return;

    try {
      setSaving(true);
      await apiClient.addUseCase({
        industry: selectedIndustry,
        use_case: newUseCaseId.toLowerCase().replace(/\s+/g, '_'),
        use_case_label: newUseCaseLabel,
      });
      onToast(`Use case "${newUseCaseLabel}" created`, 'success');
      setShowAddUseCaseModal(false);
      setNewUseCaseId('');
      setNewUseCaseLabel('');
      await loadConfigs();
    } catch (error: any) {
      onToast(error?.message || 'Failed to add use case', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveActiveStatus() {
    if (!selectedIndustry || !selectedUseCase) return;
    
    // Only save if status actually changed
    if (currentConfig?.is_active === editingActiveStatus) {
      setIsEditingActive(false);
      return;
    }
    
    try {
      setSaving(true);
      const result = await apiClient.toggleUseCaseActive(selectedIndustry, selectedUseCase);
      onToast(result.message, 'success');
      setIsEditingActive(false);
      await loadConfigs();
    } catch (error: any) {
      onToast(error?.message || 'Failed to update active status', 'error');
    } finally {
      setSaving(false);
    }
  }
  
  function handleCancelActiveEdit() {
    setEditingActiveStatus(currentConfig?.is_active || false);
    setIsEditingActive(false);
  }

  async function handleDelete() {
    if (!showDeleteConfirmModal || deleteConfirmText !== 'DELETE') return;
    
    try {
      setSaving(true);
      if (showDeleteConfirmModal.type === 'industry') {
        await apiClient.deleteIndustry(showDeleteConfirmModal.industry);
        onToast(`Industry "${showDeleteConfirmModal.industry}" deleted`, 'success');
        setSelectedIndustry('');
        setSelectedUseCase('');
      } else if (showDeleteConfirmModal.useCase) {
        await apiClient.deleteUseCase(showDeleteConfirmModal.industry, showDeleteConfirmModal.useCase);
        onToast(`Use case deleted`, 'success');
        setSelectedUseCase('');
      }
      setShowDeleteConfirmModal(null);
      setDeleteConfirmText('');
      await loadConfigs();
    } catch (error: any) {
      onToast(error?.message || 'Failed to delete', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Column - Industries */}
      <div className="w-56 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-secondary/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-sm">Industries</h3>
            <button
              onClick={() => setShowAddIndustryModal(true)}
              className="text-primary hover:text-primary/80 text-lg font-bold"
              title="Add Industry"
            >
              +
            </button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {industries.map(ind => (
            <div
              key={ind.value}
              className={`flex items-center justify-between px-3 py-2 text-sm border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer ${
                selectedIndustry === ind.value ? 'bg-primary/20 text-primary font-medium' : 'text-foreground'
              }`}
              onClick={() => {
                setSelectedIndustry(ind.value);
                setSelectedUseCase('');
                setIsEditMode(false);
              }}
            >
              <span className="truncate">{ind.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirmModal({ type: 'industry', industry: ind.value });
                }}
                className="text-muted-foreground hover:text-red-400 ml-2 flex-shrink-0"
                title="Delete Industry"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {industries.length === 0 && (
            <p className="text-muted-foreground text-sm p-3">No industries found</p>
          )}
        </div>
      </div>

      {/* Middle Column - Use Cases */}
      <div className="w-56 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-secondary/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Use Cases</h3>
            {selectedIndustry && (
              <button
                onClick={() => setShowAddUseCaseModal(true)}
                className="text-primary hover:text-primary/80 text-lg font-bold"
                title="Add Use Case"
              >
                +
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {useCases.map(uc => (
            <div
              key={uc.value}
              className={`flex items-center justify-between px-3 py-2 text-sm border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer ${
                selectedUseCase === uc.value ? 'bg-primary/20 text-primary font-medium' : 'text-foreground'
              } ${!uc.is_active ? 'opacity-50' : ''}`}
              onClick={() => {
                setSelectedUseCase(uc.value);
                setIsEditMode(false);
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {uc.is_active ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Active" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 flex-shrink-0" title="Inactive" />
                )}
                <span className="truncate">{uc.label}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirmModal({ type: 'usecase', industry: selectedIndustry, useCase: uc.value });
                }}
                className="text-muted-foreground hover:text-red-400 ml-2 flex-shrink-0"
                title="Delete Use Case"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {!selectedIndustry && (
            <p className="text-muted-foreground text-sm p-3">Select an industry</p>
          )}
          {selectedIndustry && useCases.length === 0 && (
            <p className="text-muted-foreground text-sm p-3">No use cases</p>
          )}
        </div>
      </div>

      {/* Right Panel - View/Editor */}
      <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        {selectedIndustry && selectedUseCase ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border bg-secondary/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {currentConfig?.industry_label} / {currentConfig?.use_case_label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Version {selectedVersion || currentConfig?.version}
                    {isViewingOldVersion && (
                      <span className="ml-2 text-amber-400">(Read-only - viewing old version)</span>
                    )}
                    {isDraft && <span className="ml-2 text-primary">(Draft)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isViewingOldVersion && (
                    <button
                      onClick={handleCopyToDraft}
                      className="px-3 py-1.5 text-sm bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                    >
                      Copy to Draft
                    </button>
                  )}
                  {!isEditMode && !isViewingOldVersion && (
                    <button
                      onClick={handleEditClick}
                      className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 transition-colors"
                    >
                      Edit Description
                    </button>
                  )}
                  {isEditMode && (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowConfirmSaveModal(true)}
                        disabled={!isDraft || saving}
                        className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
                          isDraft && !saving
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-secondary text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {saving ? 'Saving...' : 'Save as New Version'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Active Status Section */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Workflow Status:</span>
                  {!isEditingActive ? (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      currentConfig?.is_active 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${currentConfig?.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      {currentConfig?.is_active ? 'Active - Shown in Workflow' : 'Inactive - Hidden from Workflow'}
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingActiveStatus}
                        onChange={(e) => setEditingActiveStatus(e.target.checked)}
                        className="w-4 h-4 rounded border-muted-foreground text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-background"
                      />
                      <span className={`text-sm ${editingActiveStatus ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {editingActiveStatus ? 'Active - Will show in Workflow' : 'Inactive - Will hide from Workflow'}
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingActive ? (
                    <button
                      onClick={() => setIsEditingActive(true)}
                      className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded hover:border-primary transition-colors"
                    >
                      Change
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleCancelActiveEdit}
                        className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveActiveStatus}
                        disabled={saving}
                        className="px-3 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Version History - Top */}
            <div className="px-4 py-2 border-b border-border bg-secondary/30">
              <h4 className="text-sm font-medium text-foreground mb-2">Version History (last 5)</h4>
              <div className="flex flex-wrap gap-2">
                {versions.map(v => (
                  <button
                    key={v.version}
                    onClick={() => handleSelectVersion(v.version)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedVersion === v.version
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary'
                    }`}
                    title={`Created: ${v.inserted_at || 'N/A'}${v.created_by ? ` by ${v.created_by}` : ''}`}
                  >
                    v{v.version}
                    {v.version === currentConfig?.version && (
                      <span className="ml-1 text-emerald-400">(latest)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content - View Mode (Markdown) */}
            {!isEditMode && (
              <div className="flex-1 p-4 overflow-y-auto">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Use Case Description
                </h4>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {editingTemplate || '_No use case description defined_'}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Content - Edit Mode */}
            {isEditMode && (
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <label className="text-sm font-medium text-foreground mb-2">Use Case Description</label>
                <textarea
                  value={editingTemplate}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="flex-1 w-full p-3 font-mono text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                  placeholder="Enter use case description..."
                />
              </div>
            )}

            {/* Version History */}
            <div className="p-4 border-t border-border bg-secondary/50">
              <h4 className="text-sm font-medium text-foreground mb-2">Version History (last 5)</h4>
              <div className="flex flex-wrap gap-2">
                {versions.map(v => (
                  <button
                    key={v.version}
                    onClick={() => handleSelectVersion(v.version)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedVersion === v.version
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary'
                    }`}
                    title={`Created: ${v.inserted_at || 'N/A'}${v.created_by ? ` by ${v.created_by}` : ''}`}
                  >
                    v{v.version}
                    {v.version === currentConfig?.version && (
                      <span className="ml-1 text-emerald-400">(latest)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select an industry and use case to view or edit</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Industry Modal */}
      {showAddIndustryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-96 p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New Industry</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Industry ID</label>
                <input
                  type="text"
                  value={newIndustryId}
                  onChange={e => setNewIndustryId(e.target.value)}
                  placeholder="e.g., healthcare"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Lowercase, no spaces (use underscores)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Label</label>
                <input
                  type="text"
                  value={newIndustryLabel}
                  onChange={e => setNewIndustryLabel(e.target.value)}
                  placeholder="e.g., Healthcare"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddIndustryModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIndustry}
                disabled={!newIndustryId || !newIndustryLabel || saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Industry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Use Case Modal */}
      {showAddUseCaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-96 p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New Use Case</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adding to: <span className="font-medium text-foreground">{currentConfig?.industry_label || selectedIndustry}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Use Case ID</label>
                <input
                  type="text"
                  value={newUseCaseId}
                  onChange={e => setNewUseCaseId(e.target.value)}
                  placeholder="e.g., patient_portal"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Lowercase, no spaces (use underscores)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Label</label>
                <input
                  type="text"
                  value={newUseCaseLabel}
                  onChange={e => setNewUseCaseLabel(e.target.value)}
                  placeholder="e.g., Patient Portal"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddUseCaseModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUseCase}
                disabled={!newUseCaseId || !newUseCaseLabel || saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Use Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Save Modal */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-96 p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Confirm Save</h3>
            <p className="text-muted-foreground mb-4">
              This will create <span className="font-medium text-foreground">version {(currentConfig?.version || 0) + 1}</span> and it will become the new default for this prompt configuration.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmSaveModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save New Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Two-Step Confirmation */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-[450px] p-6 border border-red-500/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-400">⚠️ Danger Zone - Permanent Delete</h3>
            </div>
            
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-200 mb-2">
                <strong>You are about to permanently delete:</strong>
              </p>
              {showDeleteConfirmModal.type === 'industry' ? (
                <p className="text-foreground font-medium">
                  Industry: "{showDeleteConfirmModal.industry}" <span className="text-red-400">(and ALL its use cases)</span>
                </p>
              ) : (
                <p className="text-foreground font-medium">
                  Use Case: "{showDeleteConfirmModal.useCase}"
                </p>
              )}
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-3">
                This action <span className="text-red-400 font-semibold">CANNOT be undone</span>. All versions and associated data will be permanently removed.
              </p>
              <label className="block text-sm font-medium text-foreground mb-2">
                To confirm, type <span className="text-red-400 font-mono bg-red-900/30 px-1.5 py-0.5 rounded">DELETE</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-red-500/50 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/50 placeholder:text-muted-foreground"
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving || deleteConfirmText !== 'DELETE'}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  deleteConfirmText === 'DELETE'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-red-500/30 text-red-300/50 cursor-not-allowed'
                }`}
              >
                {saving ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
