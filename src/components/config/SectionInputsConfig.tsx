/**
 * Section Input Prompts Configuration Screen
 * Manage input templates and system prompts with version history
 * Shows markdown preview by default, with edit mode toggle
 * Includes test functionality to preview prompt generation
 * Updated to match dark theme
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Loader2, Play, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { SectionInput, ConfigVersionInfo, ImageMetadata } from '../../api/client';
import { ImageGallery } from '../ImageGallery';
import { WORKFLOW_SECTIONS } from '../../constants/workflowSections';

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
    <blockquote className="border-l-4 border-primary pl-4 my-3 text-muted-foreground italic">
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

// Build section_tag → chapter group mapping from workflow constants
const SECTION_TAG_TO_GROUP: Record<string, { chapter: string; title: string; color: string; dotColor: string }> = {};
for (const section of WORKFLOW_SECTIONS) {
  for (const step of section.steps) {
    if (step?.sectionTag) {
      SECTION_TAG_TO_GROUP[step.sectionTag] = {
        chapter: section.chapter,
        title: section.title,
        color: section.color,
        dotColor: section.bgColor.replace('/15', '/40'),
      };
    }
  }
}
// Extra section tags that live under a parent step but aren't steps themselves
if (SECTION_TAG_TO_GROUP['bronze_table_metadata']) {
  SECTION_TAG_TO_GROUP['bronze_table_metadata_upload'] = SECTION_TAG_TO_GROUP['bronze_table_metadata'];
}

const GROUP_ORDER = ['Foundation', 'Databricks App', 'Lakebase', 'Lakehouse', 'Data Intelligence', 'Workshop', 'Refinement'];

const GROUP_STYLES: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  'Foundation':        { label: 'Foundation',        bg: 'bg-blue-500/8',   border: 'border-blue-500/20',   text: 'text-blue-400',   dot: 'bg-blue-500' },
  'Databricks App':    { label: 'Databricks App',    bg: 'bg-red-500/8',    border: 'border-red-500/20',    text: 'text-red-400',    dot: 'bg-red-500' },
  'Lakebase':          { label: 'Lakebase',          bg: 'bg-violet-500/8', border: 'border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-500' },
  'Lakehouse':         { label: 'Lakehouse',         bg: 'bg-amber-500/8',  border: 'border-amber-500/20',  text: 'text-amber-400',  dot: 'bg-amber-500' },
  'Data Intelligence': { label: 'Data Intelligence', bg: 'bg-cyan-500/8',   border: 'border-cyan-500/20',   text: 'text-cyan-400',   dot: 'bg-cyan-500' },
  'Workshop':          { label: 'Agent Skills',      bg: 'bg-purple-500/8', border: 'border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
  'Refinement':        { label: 'Refinement',        bg: 'bg-pink-500/8',   border: 'border-pink-500/20',   text: 'text-pink-400',   dot: 'bg-pink-500' },
};

interface SectionInputsConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

export function SectionInputsConfig({ onToast }: SectionInputsConfigProps) {
  // Data state
  const [sectionInputs, setSectionInputs] = useState<SectionInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selection state
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // View/Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Content tab state (for organized navigation)
  const [activeContentTab, setActiveContentTab] = useState<'system' | 'input' | 'how_to_apply' | 'expected_output'>('system');

  // Editor state
  const [editingInputTemplate, setEditingInputTemplate] = useState('');
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingHowToApply, setEditingHowToApply] = useState('');
  const [editingExpectedOutput, setEditingExpectedOutput] = useState('');
  const [editingBypassLlm, setEditingBypassLlm] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  
  // Image state
  const [howToApplyImages, setHowToApplyImages] = useState<ImageMetadata[]>([]);
  const [expectedOutputImages, setExpectedOutputImages] = useState<ImageMetadata[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  
  // Bypass LLM toggle state (for quick toggle without full edit mode)
  const [isBypassDraft, setIsBypassDraft] = useState(false);

  // Version state
  const [versions, setVersions] = useState<ConfigVersionInfo[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);

  // Modal state
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionTag, setNewSectionTag] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  // Test functionality state
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState('');
  const [testModel, setTestModel] = useState<string | undefined>();
  const [testError, setTestError] = useState<string | null>(null);
  const [testCopied, setTestCopied] = useState(false);
  const testAbortRef = useRef<AbortController | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load versions when selection changes
  useEffect(() => {
    if (selectedTag) {
      loadVersions();
      setIsEditMode(false); // Reset to view mode when changing selection
    }
  }, [selectedTag]);

  // Update editor when selection changes
  useEffect(() => {
    const section = sectionInputs.find(s => s.section_tag === selectedTag);
    if (section) {
      setEditingInputTemplate(section.input_template);
      setEditingSystemPrompt(section.system_prompt);
      setEditingTitle(section.section_title || '');
      setEditingDescription(section.section_description || '');
      setEditingHowToApply(section.how_to_apply || '');
      setEditingExpectedOutput(section.expected_output || '');
      setEditingBypassLlm(section.bypass_llm || false);
      setHowToApplyImages(section.how_to_apply_images || []);
      setExpectedOutputImages(section.expected_output_images || []);
      setSelectedVersion(section.version);
      setIsViewingOldVersion(false);
      setIsDraft(false);
      setIsBypassDraft(false);
    }
  }, [selectedTag, sectionInputs]);

  async function loadData() {
    try {
      setLoading(true);
      const inputs = await apiClient.getLatestSectionInputs();
      setSectionInputs(inputs);
    } catch (error) {
      onToast('Failed to load section inputs', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions() {
    try {
      const data = await apiClient.getSectionInputVersions(selectedTag);
      setVersions(data);
    } catch {
      setVersions([]);
    }
  }

  // Filter section inputs and group by chapter
  const groupedSections = useMemo(() => {
    const filtered = sectionInputs.filter(
      s =>
        !searchQuery ||
        s.section_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.section_title || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const sorted = filtered.sort((a, b) => (a.order_number || 999) - (b.order_number || 999));

    const groups: { chapter: string; sections: SectionInput[] }[] = [];
    const grouped = new Map<string, SectionInput[]>();
    const ungrouped: SectionInput[] = [];

    for (const s of sorted) {
      const group = SECTION_TAG_TO_GROUP[s.section_tag];
      if (group) {
        const key = group.chapter;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s);
      } else {
        ungrouped.push(s);
      }
    }

    for (const chapter of GROUP_ORDER) {
      const items = grouped.get(chapter);
      if (items && items.length > 0) {
        groups.push({ chapter, sections: items });
      }
    }
    if (ungrouped.length > 0) {
      groups.push({ chapter: 'Other', sections: ungrouped });
    }
    return groups;
  }, [sectionInputs, searchQuery]);

  // Current section input
  const currentSection = useMemo(() => {
    return sectionInputs.find(s => s.section_tag === selectedTag);
  }, [sectionInputs, selectedTag]);

  async function handleSelectVersion(version: number) {
    if (version === currentSection?.version) {
      setEditingInputTemplate(currentSection.input_template);
      setEditingSystemPrompt(currentSection.system_prompt);
      setEditingTitle(currentSection.section_title || '');
      setEditingDescription(currentSection.section_description || '');
      setEditingHowToApply(currentSection.how_to_apply || '');
      setEditingExpectedOutput(currentSection.expected_output || '');
      setEditingBypassLlm(currentSection.bypass_llm || false);
      setSelectedVersion(version);
      setIsViewingOldVersion(false);
      setIsDraft(false);
      setIsBypassDraft(false);
      return;
    }

    try {
      const oldSection = await apiClient.getSectionInputByVersion(selectedTag, version);
      setEditingInputTemplate(oldSection.input_template);
      setEditingSystemPrompt(oldSection.system_prompt);
      setEditingTitle(oldSection.section_title || '');
      setEditingDescription(oldSection.section_description || '');
      setEditingHowToApply(oldSection.how_to_apply || '');
      setEditingExpectedOutput(oldSection.expected_output || '');
      setEditingBypassLlm(oldSection.bypass_llm || false);
      setSelectedVersion(version);
      setIsViewingOldVersion(true);
      setIsDraft(false);
      setIsBypassDraft(false);
    } catch {
      onToast('Failed to load version', 'error');
    }
  }

  function handleCopyToDraft() {
    setIsViewingOldVersion(false);
    setIsDraft(true);
    setIsEditMode(true);
  }

  function handleFieldChange(field: 'input' | 'system' | 'title' | 'description' | 'how_to_apply' | 'expected_output' | 'bypass_llm', value: string | boolean) {
    switch (field) {
      case 'input':
        setEditingInputTemplate(value as string);
        break;
      case 'system':
        setEditingSystemPrompt(value as string);
        break;
      case 'title':
        setEditingTitle(value as string);
        break;
      case 'description':
        setEditingDescription(value as string);
        break;
      case 'how_to_apply':
        setEditingHowToApply(value as string);
        break;
      case 'expected_output':
        setEditingExpectedOutput(value as string);
        break;
      case 'bypass_llm':
        setEditingBypassLlm(value as boolean);
        break;
    }
    setIsDraft(true);
  }
  
  // Handler for bypass toggle (separate from full edit mode)
  function handleBypassToggle(checked: boolean) {
    setEditingBypassLlm(checked);
    setIsBypassDraft(true);
  }
  
  function handleBypassCancel() {
    // Reset to original value
    if (currentSection) {
      setEditingBypassLlm(currentSection.bypass_llm || false);
    }
    setIsBypassDraft(false);
  }
  
  async function handleBypassSave() {
    if (!selectedTag || !currentSection) return;
    
    try {
      setSaving(true);
      await apiClient.createSectionInput({
        section_tag: selectedTag,
        section_title: currentSection.section_title,
        section_description: currentSection.section_description,
        input_template: currentSection.input_template,
        system_prompt: currentSection.system_prompt,
        order_number: currentSection.order_number,
        how_to_apply: currentSection.how_to_apply,
        expected_output: currentSection.expected_output,
        bypass_llm: editingBypassLlm,
      });
      
      onToast(editingBypassLlm ? 'Bypass LLM enabled - template will be returned as-is' : 'LLM processing enabled', 'success');
      setIsBypassDraft(false);
      await loadData();
      await loadVersions();
    } catch (error) {
      onToast('Failed to update bypass setting', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Image upload/delete handlers
  async function handleImageUpload(file: File, fieldType: 'how_to_apply' | 'expected_output') {
    if (!selectedTag) return;
    
    setImageUploading(true);
    try {
      const result = await apiClient.uploadSectionImage(file, selectedTag, fieldType);
      
      // Update local state
      if (fieldType === 'how_to_apply') {
        setHowToApplyImages(prev => [...prev, result.image]);
      } else {
        setExpectedOutputImages(prev => [...prev, result.image]);
      }
      
      onToast('Image uploaded successfully', 'success');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setImageUploading(false);
    }
  }
  
  async function handleImageDelete(imageId: string, fieldType: 'how_to_apply' | 'expected_output') {
    if (!selectedTag) return;
    
    try {
      await apiClient.deleteSectionImage(imageId, selectedTag, fieldType);
      
      // Update local state
      if (fieldType === 'how_to_apply') {
        setHowToApplyImages(prev => prev.filter(img => img.id !== imageId));
      } else {
        setExpectedOutputImages(prev => prev.filter(img => img.id !== imageId));
      }
      
      onToast('Image deleted', 'success');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Delete failed', 'error');
    }
  }

  function handleEditClick() {
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    // Reset to original values
    if (currentSection) {
      setEditingInputTemplate(currentSection.input_template);
      setEditingSystemPrompt(currentSection.system_prompt);
      setEditingTitle(currentSection.section_title || '');
      setEditingDescription(currentSection.section_description || '');
      setEditingHowToApply(currentSection.how_to_apply || '');
      setEditingExpectedOutput(currentSection.expected_output || '');
      setEditingBypassLlm(currentSection.bypass_llm || false);
    }
    setIsDraft(false);
    setIsEditMode(false);
  }

  async function handleSave() {
    if (!selectedTag) return;

    try {
      setSaving(true);
      const result = await apiClient.createSectionInput({
        section_tag: selectedTag,
        section_title: editingTitle,
        section_description: editingDescription,
        input_template: editingInputTemplate,
        system_prompt: editingSystemPrompt,
        order_number: currentSection?.order_number,
        how_to_apply: editingHowToApply,
        expected_output: editingExpectedOutput,
        bypass_llm: editingBypassLlm,
      });

      onToast(`Saved version ${result.version}`, 'success');
      setShowConfirmSaveModal(false);
      setIsDraft(false);
      setIsBypassDraft(false);
      setIsEditMode(false); // Return to view mode after save
      await loadData();
      await loadVersions();
    } catch (error) {
      onToast('Failed to save section input', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSection() {
    if (!newSectionTag) return;

    try {
      setSaving(true);
      await apiClient.createSectionInput({
        section_tag: newSectionTag.toLowerCase().replace(/\s+/g, '_'),
        section_title: newSectionTitle || newSectionTag,
        section_description: '',
        input_template: '',
        system_prompt: '',
      });

      onToast(`Section "${newSectionTitle || newSectionTag}" created`, 'success');
      setShowAddSectionModal(false);
      setNewSectionTag('');
      setNewSectionTitle('');
      await loadData();
    } catch (error: any) {
      onToast(error?.message || 'Failed to add section', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Test functionality
  function handleRunTest() {
    if (!selectedTag) return;
    
    // Cancel any existing test
    if (testAbortRef.current) {
      testAbortRef.current.abort();
    }
    
    // Reset and start
    setIsTestRunning(true);
    setTestOutput('');
    setTestError(null);
    setTestModel(undefined);
    setIsTestPanelOpen(true);
    
    // Use current editing values (draft or saved)
    const systemPrompt = editingSystemPrompt || '';
    const inputTemplate = editingInputTemplate || '';
    
    testAbortRef.current = apiClient.testPromptStream(
      selectedTag,
      systemPrompt,
      inputTemplate,
      editingBypassLlm,
      // onContent
      (content: string) => {
        setTestOutput(prev => prev + content);
      },
      // onComplete
      (model?: string) => {
        setIsTestRunning(false);
        setTestModel(model);
      },
      // onError
      (error: string) => {
        setIsTestRunning(false);
        setTestError(error);
      }
    );
  }
  
  function handleStopTest() {
    if (testAbortRef.current) {
      testAbortRef.current.abort();
      testAbortRef.current = null;
    }
    setIsTestRunning(false);
  }
  
  function handleClearTest() {
    setTestOutput('');
    setTestError(null);
    setTestModel(undefined);
  }
  
  async function handleCopyTestOutput() {
    if (!testOutput) return;
    try {
      await navigator.clipboard.writeText(testOutput);
      setTestCopied(true);
      setTimeout(() => setTestCopied(false), 2000);
    } catch {
      onToast('Failed to copy to clipboard', 'error');
    }
  }

  // Reset test panel when section changes
  useEffect(() => {
    setIsTestPanelOpen(false);
    setTestOutput('');
    setTestError(null);
    setTestModel(undefined);
    setIsTestRunning(false);
    if (testAbortRef.current) {
      testAbortRef.current.abort();
      testAbortRef.current = null;
    }
  }, [selectedTag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Column - Section Tags (ordered by order_number) */}
      <div className="w-64 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-secondary/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-sm">Sections</h3>
            <button
              onClick={() => setShowAddSectionModal(true)}
              className="text-primary hover:text-primary/80 text-lg font-bold"
              title="Add Section"
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
          {groupedSections.map((group) => {
            const style = GROUP_STYLES[group.chapter] || { label: group.chapter, bg: 'bg-secondary/30', border: 'border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
            return (
              <div key={group.chapter}>
                {/* Chapter group header */}
                <div className={`sticky top-0 z-10 px-3 py-1.5 ${style.bg} border-b ${style.border} flex items-center gap-2`}>
                  <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">{group.sections.length}</span>
                </div>
                {/* Section items in this group */}
                {group.sections.map((section) => (
                  <div
                    key={section.section_tag}
                    onClick={() => setSelectedTag(section.section_tag)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer ${
                      selectedTag === section.section_tag
                        ? 'bg-primary/20 text-primary font-medium'
                        : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${
                        selectedTag === section.section_tag ? `${style.dot} text-white` : 'bg-secondary text-muted-foreground'
                      }`}>
                        {section.order_number || '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {section.section_title || section.section_tag}
                          {section.bypass_llm && (
                            <span className="inline-flex items-center" title="Bypass LLM - returns template as-is">
                              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{section.section_tag}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {groupedSections.length === 0 && (
            <p className="text-muted-foreground text-sm p-3">No sections found</p>
          )}
        </div>
      </div>

      {/* Right Panel - View/Editor */}
      <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        {selectedTag ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border bg-secondary/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {currentSection?.section_title || selectedTag}
                    </h3>
                    {(() => {
                      const group = SECTION_TAG_TO_GROUP[selectedTag];
                      if (!group) return null;
                      const style = GROUP_STYLES[group.chapter];
                      if (!style) return null;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.border} border ${style.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <code className="bg-secondary px-1 rounded text-primary">{selectedTag}</code>
                    <span className="ml-2">Version {selectedVersion || currentSection?.version}</span>
                    {currentSection?.order_number && (
                      <span className="ml-2 text-muted-foreground">• Step {currentSection.order_number}</span>
                    )}
                    {isViewingOldVersion && (
                      <span className="ml-2 text-amber-400">(Read-only)</span>
                    )}
                    {isDraft && <span className="ml-2 text-primary">(Draft)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Test Button - Always visible when section is selected */}
                  <button
                    onClick={handleRunTest}
                    disabled={isTestRunning || (!editingInputTemplate && !editingSystemPrompt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium transition-all ${
                      isTestRunning
                        ? 'bg-cyan-500/20 text-cyan-400 cursor-wait'
                        : !editingInputTemplate && !editingSystemPrompt
                        ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                        : 'bg-cyan-600 text-white hover:bg-cyan-500'
                    }`}
                    title="Test prompt generation with current values"
                  >
                    {isTestRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isTestRunning ? 'Testing...' : 'Test'}
                  </button>
                  
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
                      Edit
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
                    {v.version === currentSection?.version && (
                      <span className="ml-1 text-emerald-400">(latest)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Output Panel - Collapsible */}
            {isTestPanelOpen && (
              <div className="border-b border-border bg-slate-900/50">
                {/* Test Panel Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-cyan-400">Test Output Preview</span>
                    {testModel && (
                      <span className="text-xs text-muted-foreground">
                        ({testModel === 'bypass_llm' ? 'Bypass LLM' : testModel})
                      </span>
                    )}
                    {isTestRunning && (
                      <span className="flex items-center gap-1 text-xs text-cyan-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Copy button */}
                    {testOutput && !isTestRunning && (
                      <button
                        onClick={handleCopyTestOutput}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy test output"
                      >
                        {testCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                    {/* Clear button */}
                    {testOutput && !isTestRunning && (
                      <button
                        onClick={handleClearTest}
                        className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    {/* Stop button */}
                    {isTestRunning && (
                      <button
                        onClick={handleStopTest}
                        className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                    {/* Re-run button */}
                    {testOutput && !isTestRunning && (
                      <button
                        onClick={handleRunTest}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Re-run
                      </button>
                    )}
                    {/* Collapse button */}
                    <button
                      onClick={() => setIsTestPanelOpen(false)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Collapse test panel"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Test Panel Content */}
                <div className="p-4 max-h-80 overflow-y-auto">
                  {testError && (
                    <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400 font-medium">Error</p>
                      <p className="text-sm text-red-300 mt-1">{testError}</p>
                    </div>
                  )}
                  
                  {testOutput ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {testOutput}
                      </ReactMarkdown>
                    </div>
                  ) : !isTestRunning && !testError ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Click <span className="text-cyan-400 font-medium">"Test"</span> to preview how the prompt will be generated
                    </p>
                  ) : null}
                  
                  {isTestRunning && !testOutput && (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-sm text-muted-foreground">Generating test output...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Collapsed Test Panel Toggle */}
            {!isTestPanelOpen && testOutput && (
              <button
                onClick={() => setIsTestPanelOpen(true)}
                className="w-full flex items-center justify-between px-4 py-2 bg-cyan-500/5 border-b border-border hover:bg-cyan-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-400">Test output available</span>
                </div>
                <ChevronDown className="w-4 h-4 text-cyan-400" />
              </button>
            )}

            {/* Content - View Mode (Tabbed Interface) */}
            {!isEditMode && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Content Tabs */}
                <div className="flex border-b border-border bg-secondary/30">
                  <button
                    onClick={() => setActiveContentTab('system')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'system'
                        ? 'text-purple-400 border-purple-500 bg-purple-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    System Prompt
                  </button>
                  <button
                    onClick={() => setActiveContentTab('input')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'input'
                        ? `${editingBypassLlm ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-blue-400 border-blue-500 bg-blue-500/10'}`
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${editingBypassLlm ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                    Input Template
                    {editingBypassLlm && <span className="text-[10px] text-amber-400 ml-1">(bypass)</span>}
                  </button>
                  <button
                    onClick={() => setActiveContentTab('how_to_apply')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'how_to_apply'
                        ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    How to Apply
                  </button>
                  <button
                    onClick={() => setActiveContentTab('expected_output')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'expected_output'
                        ? 'text-amber-400 border-amber-500 bg-amber-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Expected Output
                  </button>
                </div>
                
                {/* Tab Content */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {/* System Prompt Tab */}
                  {activeContentTab === 'system' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                          System Prompt
                        </h4>
                        <span className="text-xs text-muted-foreground">Instructions for the AI model</span>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5 min-h-[300px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {editingSystemPrompt || '_No system prompt defined_'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {/* Input Template Tab */}
                  {activeContentTab === 'input' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${editingBypassLlm ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                          Input Template
                        </h4>
                        
                        {/* Bypass LLM Toggle */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={editingBypassLlm}
                              onChange={(e) => handleBypassToggle(e.target.checked)}
                              disabled={isViewingOldVersion}
                              className="w-4 h-4 rounded border-border bg-background text-amber-500 focus:ring-amber-500/50 focus:ring-2 cursor-pointer"
                            />
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              Pass as-is to output
                              <span className="text-xs text-amber-500 ml-1">(skip LLM)</span>
                            </span>
                          </label>
                          
                          {/* Cancel/Save for bypass toggle */}
                          {isBypassDraft && !isViewingOldVersion && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                              <button
                                onClick={handleBypassCancel}
                                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleBypassSave}
                                disabled={saving}
                                className="px-3 py-1 text-xs bg-amber-500 text-white rounded font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Bypass indicator banner */}
                      {editingBypassLlm && (
                        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-amber-400">
                            LLM bypass enabled — This template will be returned directly to the user without AI processing
                          </span>
                        </div>
                      )}
                      
                      <div className={`${editingBypassLlm ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'} border rounded-xl p-5 min-h-[300px] transition-colors`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {editingInputTemplate || '_No input template defined_'}
                        </ReactMarkdown>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use {'{'}use_case_description{'}'} to include the prompt template content
                      </p>
                    </div>
                  )}
                  
                  {/* How to Apply Tab */}
                  {activeContentTab === 'how_to_apply' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                          How to Apply
                        </h4>
                        <span className="text-xs text-muted-foreground">Shown to users in the workflow</span>
                      </div>
                      
                      {/* Image Gallery for How to Apply */}
                      <ImageGallery
                        images={howToApplyImages}
                        editable={!isViewingOldVersion}
                        onUpload={(file) => handleImageUpload(file, 'how_to_apply')}
                        onDelete={(id) => handleImageDelete(id, 'how_to_apply')}
                        isLoading={imageUploading}
                        color="emerald"
                      />
                      
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 min-h-[300px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {editingHowToApply || '_No application steps defined_'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {/* Expected Output Tab */}
                  {activeContentTab === 'expected_output' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          Expected Output
                        </h4>
                        <span className="text-xs text-muted-foreground">Shown to users in the workflow</span>
                      </div>
                      
                      {/* Image Gallery for Expected Output */}
                      <ImageGallery
                        images={expectedOutputImages}
                        editable={!isViewingOldVersion}
                        onUpload={(file) => handleImageUpload(file, 'expected_output')}
                        onDelete={(id) => handleImageDelete(id, 'expected_output')}
                        isLoading={imageUploading}
                        color="amber"
                      />
                      
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 min-h-[300px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {editingExpectedOutput || '_No expected output defined_'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content - Edit Mode (Tabbed Interface) */}
            {isEditMode && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Title & Description - Always visible in edit mode */}
                <div className="p-4 border-b border-border bg-secondary/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Section Title</label>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={e => handleFieldChange('title', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        placeholder="Display title..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                      <input
                        type="text"
                        value={editingDescription}
                        onChange={e => handleFieldChange('description', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        placeholder="Brief description..."
                      />
                    </div>
                  </div>
                </div>
                
                {/* Content Tabs */}
                <div className="flex border-b border-border bg-secondary/30">
                  <button
                    onClick={() => setActiveContentTab('system')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'system'
                        ? 'text-purple-400 border-purple-500 bg-purple-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    System Prompt
                  </button>
                  <button
                    onClick={() => setActiveContentTab('input')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'input'
                        ? `${editingBypassLlm ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-blue-400 border-blue-500 bg-blue-500/10'}`
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${editingBypassLlm ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                    Input Template
                    {editingBypassLlm && <span className="text-[10px] text-amber-400 ml-1">(bypass)</span>}
                  </button>
                  <button
                    onClick={() => setActiveContentTab('how_to_apply')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'how_to_apply'
                        ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    How to Apply
                  </button>
                  <button
                    onClick={() => setActiveContentTab('expected_output')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeContentTab === 'expected_output'
                        ? 'text-amber-400 border-amber-500 bg-amber-500/10'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Expected Output
                  </button>
                </div>
                
                {/* Tab Content */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {/* System Prompt Tab */}
                  {activeContentTab === 'system' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                          System Prompt
                        </h4>
                        <span className="text-xs text-muted-foreground">Instructions for the AI model</span>
                      </div>
                      <textarea
                        value={editingSystemPrompt}
                        onChange={e => handleFieldChange('system', e.target.value)}
                        rows={16}
                        className="w-full p-3 font-mono text-sm border border-purple-500/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-background text-foreground"
                        placeholder="System prompt for the LLM..."
                      />
                    </div>
                  )}
                  
                  {/* Input Template Tab */}
                  {activeContentTab === 'input' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${editingBypassLlm ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                          Input Template
                        </h4>
                        
                        {/* Bypass LLM checkbox in edit mode */}
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={editingBypassLlm}
                            onChange={(e) => handleFieldChange('bypass_llm', e.target.checked)}
                            className="w-4 h-4 rounded border-border bg-background text-amber-500 focus:ring-amber-500/50 focus:ring-2 cursor-pointer"
                          />
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            Pass as-is to output
                            <span className="text-xs text-amber-500 ml-1">(skip LLM)</span>
                          </span>
                        </label>
                      </div>
                      
                      {/* Bypass indicator in edit mode */}
                      {editingBypassLlm && (
                        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-amber-400">
                            When enabled, this template text is returned directly without AI enrichment
                          </span>
                        </div>
                      )}
                      
                      <textarea
                        value={editingInputTemplate}
                        onChange={e => handleFieldChange('input', e.target.value)}
                        rows={14}
                        className={`w-full p-3 font-mono text-sm border ${editingBypassLlm ? 'border-amber-500/30 focus:ring-amber-500' : 'border-blue-500/30 focus:ring-blue-500'} rounded-lg resize-none focus:outline-none focus:ring-2 bg-background text-foreground transition-colors`}
                        placeholder="Input template with {placeholders}..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {'{'}use_case_description{'}'} to include the prompt template content
                      </p>
                    </div>
                  )}
                  
                  {/* How to Apply Tab */}
                  {activeContentTab === 'how_to_apply' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                          How to Apply
                        </h4>
                        <span className="text-xs text-muted-foreground">Shown to users in the workflow</span>
                      </div>
                      
                      {/* Image Gallery for How to Apply */}
                      <ImageGallery
                        images={howToApplyImages}
                        editable={true}
                        onUpload={(file) => handleImageUpload(file, 'how_to_apply')}
                        onDelete={(id) => handleImageDelete(id, 'how_to_apply')}
                        isLoading={imageUploading}
                        color="emerald"
                      />
                      
                      <textarea
                        value={editingHowToApply}
                        onChange={e => handleFieldChange('how_to_apply', e.target.value)}
                        rows={14}
                        className="w-full p-3 font-mono text-sm border border-emerald-500/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-background text-foreground"
                        placeholder="Steps for applying the generated prompt...&#10;&#10;## Steps&#10;1. Copy the generated prompt&#10;2. Open your AI assistant&#10;3. Paste and run..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Markdown supported. Include step-by-step instructions, links, and tips.
                      </p>
                    </div>
                  )}
                  
                  {/* Expected Output Tab */}
                  {activeContentTab === 'expected_output' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          Expected Output
                        </h4>
                        <span className="text-xs text-muted-foreground">Shown to users in the workflow</span>
                      </div>
                      
                      {/* Image Gallery for Expected Output */}
                      <ImageGallery
                        images={expectedOutputImages}
                        editable={true}
                        onUpload={(file) => handleImageUpload(file, 'expected_output')}
                        onDelete={(id) => handleImageDelete(id, 'expected_output')}
                        isLoading={imageUploading}
                        color="amber"
                      />
                      
                      <textarea
                        value={editingExpectedOutput}
                        onChange={e => handleFieldChange('expected_output', e.target.value)}
                        rows={14}
                        className="w-full p-3 font-mono text-sm border border-amber-500/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 bg-background text-foreground"
                        placeholder="Expected results after following the steps...&#10;&#10;## Expected Results&#10;- Feature A working&#10;- Dashboard visible&#10;&#10;### Reference Links&#10;- [Documentation](https://...)&#10;&#10;![Screenshot](https://...)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Markdown supported. Include images, links, tables, and sample outputs.
                      </p>
                    </div>
                  )}
                </div>
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
                    {v.version === currentSection?.version && (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <p>Select a section to view or edit</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-96 p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New Section</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Section Tag</label>
                <input
                  type="text"
                  value={newSectionTag}
                  onChange={e => setNewSectionTag(e.target.value)}
                  placeholder="e.g., data_pipeline"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Lowercase, underscores allowed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Title</label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  placeholder="e.g., Data Pipeline"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddSectionModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSection}
                disabled={!newSectionTag || saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Section'}
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
              This will create <span className="font-medium text-foreground">version {(currentSection?.version || 0) + 1}</span> and it will become the new default for this section input.
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

    </div>
  );
}
