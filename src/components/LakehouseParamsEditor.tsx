import { useState, useEffect } from 'react';
import { Database, Lock, RotateCcw, RefreshCw, Save, Loader2 } from 'lucide-react';
import { apiClient, type LakehouseParams } from '../api/client';

export interface LakehouseParamsEditorProps {
  sessionId: string | null;
  isExpanded: boolean;
  label?: string;
  refreshKey?: number;
  onParamsLoaded?: (loaded: boolean) => void;
}

export function LakehouseParamsEditor({ sessionId, isExpanded, label = 'Source:', refreshKey = 0, onParamsLoaded }: LakehouseParamsEditorProps) {
  const [params, setParams] = useState<LakehouseParams | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCatalog, setEditCatalog] = useState('');
  const [editSchema, setEditSchema] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId && isExpanded) {
      setParams(null);
      onParamsLoaded?.(false);
      fetchParams();
    }
  }, [sessionId, isExpanded, refreshKey]);

  const fetchParams = async () => {
    if (!sessionId) return;
    try {
      const data = await apiClient.getLakehouseParams(sessionId);
      setParams(data);
      setEditCatalog(data.catalog);
      setEditSchema(data.schema_name);
      setError(null);
      onParamsLoaded?.(true);
    } catch (err) {
      console.error('Failed to fetch lakehouse params:', err);
      setParams({ catalog: 'samples', schema_name: 'wanderbricks', is_overridden: false });
      setEditCatalog('samples');
      setEditSchema('wanderbricks');
      onParamsLoaded?.(true);
    }
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.updateLakehouseParams(sessionId, editCatalog, editSchema);
      setParams({ catalog: editCatalog, schema_name: editSchema, is_overridden: true });
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error('Failed to save lakehouse params:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.resetLakehouseParams(sessionId);
      await fetchParams();
      setIsEditing(false);
    } catch (err) {
      setError('Failed to reset. Please try again.');
      console.error('Failed to reset lakehouse params:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (params) {
      setEditCatalog(params.catalog);
      setEditSchema(params.schema_name);
    }
    setIsEditing(false);
    setError(null);
  };

  if (!params) {
    return (
      <div className="mt-3 px-4 py-3 bg-muted/20 rounded-md border border-border/40">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
          <span className="text-[13px] text-muted-foreground">Loading source catalog &amp; schema...</span>
        </div>
        <div className="mt-2 flex gap-3">
          <div className="flex-1 h-7 bg-muted/40 rounded-md animate-pulse" />
          <div className="flex-1 h-7 bg-muted/40 rounded-md animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 px-4 py-3 bg-muted/30 rounded-md border border-border/50">
      {!isEditing ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">
              {params.catalog}.{params.schema_name}
            </span>
            {params.is_overridden && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                Custom
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">Source Configuration</span>
            </div>
            <div className="flex items-center gap-1">
              {params.is_overridden && (
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50"
                  title="Reset to global defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || (!editCatalog.trim() || !editSchema.trim())}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save
              </button>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Catalog
              </label>
              <input
                type="text"
                value={editCatalog}
                onChange={(e) => setEditCatalog(e.target.value)}
                placeholder="samples"
                className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Schema
              </label>
              <input
                type="text"
                value={editSchema}
                onChange={(e) => setEditSchema(e.target.value)}
                placeholder="wanderbricks"
                className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          
          <p className="text-[10px] text-muted-foreground">
            Changes are saved to your session only. Other users will see global defaults.
          </p>
        </div>
      )}
    </div>
  );
}
