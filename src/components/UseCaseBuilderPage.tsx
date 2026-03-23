/**
 * Build Your Use Case [Beta]
 * 
 * Interactive page for generating, editing, and saving use case descriptions.
 * Uses the shared useUseCaseBuilder hook and UseCaseBuilderPanel for the core
 * builder functionality, while managing the community library of saved use cases.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Lightbulb,
  Pencil,
  RefreshCw,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { apiClient, type SavedUseCase } from '../api/client';
import { useUseCaseBuilder } from '../hooks/useUseCaseBuilder';
import { UseCaseBuilderPanel } from './UseCaseBuilderPanel';

export function UseCaseBuilderPage() {
  const builder = useUseCaseBuilder();

  // --- Saved use cases list ---
  const [savedUseCases, setSavedUseCases] = useState<SavedUseCase[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showSavedList, setShowSavedList] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSavedText, setEditingSavedText] = useState('');
  const [viewingId, setViewingId] = useState<number | null>(null);

  const loadSavedUseCases = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const result = await apiClient.listSavedUseCases();
      setSavedUseCases(result.use_cases || []);
    } catch (err) {
      console.error('Failed to load saved use cases:', err);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    loadSavedUseCases();
  }, [loadSavedUseCases]);

  const handleLoadSaved = useCallback((uc: SavedUseCase) => {
    builder.setOutputText(uc.description);
    builder.setIndustry(uc.industry || '');
    builder.setUseCaseName(uc.use_case_name || '');
    setViewingId(uc.id);
    builder.outputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [builder]);

  const handleUpdateSaved = useCallback(async (id: number, description: string) => {
    try {
      await apiClient.updateSavedUseCase(id, { description });
      setEditingId(null);
      loadSavedUseCases();
    } catch (err) {
      builder.setError((err as Error).message);
    }
  }, [loadSavedUseCases, builder]);

  const handleDeleteSaved = useCallback(async (id: number) => {
    if (!confirm('Are you sure you want to delete this use case?')) return;
    try {
      await apiClient.deleteSavedUseCase(id);
      if (viewingId === id) {
        setViewingId(null);
        builder.setOutputText('');
      }
      loadSavedUseCases();
    } catch (err) {
      builder.setError((err as Error).message);
    }
  }, [viewingId, loadSavedUseCases, builder]);

  return (
    <div className="flex-1 overflow-auto gradient-mesh relative">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Lightbulb className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Build Your Use Case</h1>
            <p className="text-muted-foreground text-[12px] mt-0.5">
              Generate professional use case descriptions powered by AI.
            </p>
          </div>
        </div>

        {/* Builder Panel (shared component) */}
        <UseCaseBuilderPanel
          builder={builder}
          onSaved={loadSavedUseCases}
        />

        {/* Saved Use Cases (Community Library) */}
        <div className="bg-card border border-border rounded-xl mt-6">
          <button
            onClick={() => setShowSavedList(!showSavedList)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors rounded-xl"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Saved Use Cases
              <span className="text-[10px] text-muted-foreground font-normal">
                ({savedUseCases.length} total)
              </span>
            </span>
            {showSavedList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSavedList && (
            <div className="px-5 pb-4 space-y-2">
              {loadingSaved ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-[12px] text-muted-foreground">Loading...</span>
                </div>
              ) : savedUseCases.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground/60 text-[12px]">
                  No saved use cases yet. Generate and save one to start the community library!
                </p>
              ) : (
                savedUseCases.map((uc) => (
                  <div
                    key={uc.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      viewingId === uc.id
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-border/80 bg-background/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-medium text-foreground truncate">
                            {uc.use_case_name || 'Untitled Use Case'}
                          </span>
                          {uc.industry && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-medium rounded-full shrink-0">
                              {uc.industry}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <span>by {uc.display_name}</span>
                          <span>·</span>
                          <span>{new Date(uc.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleLoadSaved(uc)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted/50"
                          title="Load into editor"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (editingId === uc.id) {
                              handleUpdateSaved(uc.id, editingSavedText);
                            } else {
                              setEditingId(uc.id);
                              setEditingSavedText(uc.description);
                            }
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                          title={editingId === uc.id ? 'Save changes' : 'Edit'}
                        >
                          {editingId === uc.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteSaved(uc.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted/50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingId === uc.id && (
                      <div className="mt-2">
                        <textarea
                          value={editingSavedText}
                          onChange={(e) => setEditingSavedText(e.target.value)}
                          className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 text-[12px] text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none min-h-[120px]"
                        />
                        <div className="flex justify-end gap-2 mt-1.5">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateSaved(uc.id, editingSavedText)}
                            className="px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-[11px] font-medium hover:bg-primary/90 transition-colors"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
