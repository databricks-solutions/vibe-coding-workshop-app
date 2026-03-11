/**
 * Shared hook encapsulating all state and handlers for the Use Case Builder.
 * Used by both the dedicated Build Use Case page and the Step 1 "Create Your Own" mode.
 */

import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useCopyToClipboard } from './useCopyToClipboard';

export type AttachmentType = 'image' | 'text' | 'pdf';

export interface BuilderAttachment {
  id: string;
  base64: string;
  name: string;
  type: AttachmentType;
  textContent?: string;
}

/** @deprecated Use BuilderAttachment instead */
export type BuilderImage = BuilderAttachment;

const MAX_ATTACHMENTS = 5;
const MAX_PDF_BYTES = 5_000_000;
const MAX_TEXT_BYTES = 500_000;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function resizeImageIfNeeded(base64: string, maxBytes = 1_000_000): Promise<string> {
  const sizeEstimate = (base64.length * 3) / 4;
  if (sizeEstimate <= maxBytes) return base64;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.sqrt(maxBytes / sizeEstimate);
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
  });
}

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_EXACT = [
  'application/json',
  'application/yaml',
  'application/x-yaml',
  'application/xml',
];
const TEXT_EXTENSIONS = ['.txt', '.csv', '.md', '.json', '.yaml', '.yml', '.xml', '.log', '.tsv'];

function classifyFile(file: File): AttachmentType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (TEXT_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return 'text';
  if (TEXT_MIME_EXACT.includes(file.type)) return 'text';
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  return null;
}

export function useUseCaseBuilder() {
  // --- Input state ---
  const [industry, setIndustry] = useState('');
  const [useCaseName, setUseCaseName] = useState('');
  const [hints, setHints] = useState('');
  const [attachments, setAttachments] = useState<BuilderAttachment[]>([]);

  // --- Output state ---
  const [outputText, setOutputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [streamModel, setStreamModel] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- Refinement state ---
  const [refineFeedback, setRefineFeedback] = useState('');
  const [iterationCount, setIterationCount] = useState(0);

  // --- Diff tracking ---
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // --- Save state ---
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Clipboard ---
  const { copied, handleCopy } = useCopyToClipboard();

  // --- Refs ---
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInput = !!(industry || useCaseName || hints || attachments.length > 0);

  const handleGenerate = useCallback(() => {
    if (!hasInput || isStreaming) return;
    setError(null);
    setPreviousDraft(null);
    setShowDiff(false);
    setOutputText('');
    setIsEditing(false);
    setIsStreaming(true);
    setSaveSuccess(false);
    setIterationCount(0);
    setRefineFeedback('');

    const imageAttachments = attachments.filter((a) => a.type === 'image');
    const textAttachments = attachments.filter((a) => a.type === 'text');
    const pdfAttachments = attachments.filter((a) => a.type === 'pdf');

    const controller = apiClient.useCaseBuilderStream(
      {
        industry: industry || undefined,
        use_case_name: useCaseName || undefined,
        hints: hints || undefined,
        images: imageAttachments.length > 0 ? imageAttachments.map((a) => a.base64) : undefined,
        text_attachments:
          textAttachments.length > 0
            ? textAttachments.map((a) => ({ name: a.name, content: a.textContent || '' }))
            : undefined,
        pdf_attachments:
          pdfAttachments.length > 0
            ? pdfAttachments.map((a) => ({ name: a.name, data: a.base64 }))
            : undefined,
        mode: 'generate',
      },
      (content) => setOutputText((prev) => prev + content),
      (model) => {
        setIsStreaming(false);
        setStreamModel(model);
      },
      (err) => {
        setIsStreaming(false);
        setError(err);
      },
    );
    abortRef.current = controller;
  }, [hasInput, isStreaming, industry, useCaseName, hints, attachments]);

  const handleRefine = useCallback(() => {
    const textToRefine = isEditing ? editText : outputText;
    if (!textToRefine.trim() || isStreaming || !refineFeedback.trim()) return;

    setPreviousDraft(textToRefine);
    setShowDiff(false);
    setError(null);
    setOutputText('');
    setIsEditing(false);
    setIsStreaming(true);

    const controller = apiClient.useCaseBuilderStream(
      {
        current_draft: textToRefine,
        refinement_feedback: refineFeedback.trim(),
        mode: 'refine',
      },
      (content) => setOutputText((prev) => prev + content),
      (model) => {
        setIsStreaming(false);
        setStreamModel(model);
        setIterationCount((c) => c + 1);
        setRefineFeedback('');
      },
      (err) => {
        setIsStreaming(false);
        setError(err);
      },
    );
    abortRef.current = controller;
  }, [isEditing, editText, outputText, isStreaming, refineFeedback]);

  const handleStopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      setOutputText(editText);
      setIsEditing(false);
    } else {
      setEditText(outputText);
      setIsEditing(true);
    }
  }, [isEditing, editText, outputText]);

  const handleSave = useCallback(async () => {
    const text = isEditing ? editText : outputText;
    if (!text.trim()) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await apiClient.saveUseCase({
        industry: industry || '',
        use_case_name: useCaseName || '',
        description: text.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [isEditing, editText, outputText, industry, useCaseName]);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS - attachments.length)) {
      const fileType = classifyFile(file);
      if (!fileType) continue;

      try {
        if (fileType === 'image') {
          let base64 = await readFileAsBase64(file);
          base64 = await resizeImageIfNeeded(base64);
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), base64, name: file.name, type: 'image' },
          ]);
        } else if (fileType === 'text') {
          if (file.size > MAX_TEXT_BYTES) continue;
          const textContent = await readFileAsText(file);
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), base64: '', name: file.name, type: 'text', textContent },
          ]);
        } else if (fileType === 'pdf') {
          if (file.size > MAX_PDF_BYTES) continue;
          const base64 = await readFileAsBase64(file);
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), base64, name: file.name, type: 'pdf' },
          ]);
        }
      } catch {
        // skip failed files
      }
    }
  }, [attachments.length]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleDiff = useCallback(() => {
    setShowDiff((v) => !v);
  }, []);

  return {
    // Input state
    industry,
    setIndustry,
    useCaseName,
    setUseCaseName,
    hints,
    setHints,
    attachments,
    setAttachments,
    hasInput,

    // Output state
    outputText,
    setOutputText,
    isStreaming,
    isEditing,
    editText,
    setEditText,
    streamModel,
    error,
    setError,

    // Refinement
    refineFeedback,
    setRefineFeedback,
    iterationCount,

    // Diff
    previousDraft,
    showDiff,
    toggleDiff,

    // Save
    isSaving,
    saveSuccess,

    // Clipboard
    copied,
    handleCopy,

    // Refs
    outputContainerRef,
    fileInputRef,

    // Handlers
    handleGenerate,
    handleRefine,
    handleStopStreaming,
    handleToggleEdit,
    handleSave,
    handleFileUpload,
    handleRemoveAttachment,
  };
}

export type UseCaseBuilderState = ReturnType<typeof useUseCaseBuilder>;
