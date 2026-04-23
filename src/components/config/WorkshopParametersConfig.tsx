/**
 * Workshop Parameters Configuration Component
 * 
 * Allows users to configure key-value parameters that are available
 * to all workflow steps and section input prompts. Parameters are
 * replaced in templates using {param_key} syntax.
 */

import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Globe, Database, Server, AlertCircle, Check, Info, Layers, Bot, Trash2, Lock, Unlock, Building2, ListChecks } from 'lucide-react';
import { apiClient } from '../../api/client';
import { CodingAssistantsConfigEditor } from './CodingAssistantsConfigEditor';
import { parseCodingAssistantsConfig } from '../../constants/codingAssistants';

interface WorkshopParameter {
  param_id?: number;
  param_key: string;
  param_label: string;
  param_value: string;
  param_description?: string;
  param_type: string;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  allow_session_override: boolean;
}

interface WorkshopParametersConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

// Icon mapping for parameter types
const paramIcons: Record<string, React.ElementType> = {
  url: Globe,
  text: Settings,
  warehouse: Database,
  lakebase: Server,
  catalog: Layers,
  endpoint: Bot,
  assistant_config: ListChecks,
};

export function WorkshopParametersConfig({ onToast }: WorkshopParametersConfigProps) {
  const [parameters, setParameters] = useState<WorkshopParameter[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch parameters on mount
  useEffect(() => {
    fetchParameters();
  }, []);

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config/workshop-parameters');
      if (!response.ok) throw new Error('Failed to fetch parameters');
      const data: WorkshopParameter[] = await response.json();
      setParameters(data);
      
      // Initialize edited values with current values
      const values: Record<string, string> = {};
      data.forEach(p => {
        values[p.param_key] = p.param_value;
      });
      setEditedValues(values);
      setHasChanges({});
    } catch (error) {
      console.error('Error fetching parameters:', error);
      onToast('Failed to load workshop parameters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (paramKey: string, newValue: string) => {
    setEditedValues(prev => ({
      ...prev,
      [paramKey]: newValue
    }));
    
    // Check if value has changed from original
    const originalParam = parameters.find(p => p.param_key === paramKey);
    setHasChanges(prev => ({
      ...prev,
      [paramKey]: originalParam?.param_value !== newValue
    }));
  };

  const handleSave = async (paramKey: string) => {
    setSaving(paramKey);
    try {
      const response = await fetch(`/api/config/workshop-parameters/${paramKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ param_value: editedValues[paramKey] }),
      });
      
      if (!response.ok) throw new Error('Failed to save parameter');
      
      const data = await response.json();
      
      // Update local state
      setParameters(prev => prev.map(p => 
        p.param_key === paramKey ? { ...p, param_value: editedValues[paramKey] } : p
      ));
      setHasChanges(prev => ({ ...prev, [paramKey]: false }));
      
      onToast(data.message || 'Parameter saved successfully', 'success');
    } catch (error) {
      console.error('Error saving parameter:', error);
      onToast('Failed to save parameter', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleOverride = async (paramKey: string, currentValue: boolean) => {
    try {
      await apiClient.updateWorkshopParameterOverride(paramKey, !currentValue);
      
      // Update local state
      setParameters(prev => prev.map(p => 
        p.param_key === paramKey ? { ...p, allow_session_override: !currentValue } : p
      ));
      
      onToast(`Session override ${!currentValue ? 'enabled' : 'disabled'} for ${paramKey}`, 'success');
    } catch (error) {
      console.error('Error toggling override:', error);
      onToast('Failed to update override setting', 'error');
    }
  };

  const handleReset = (paramKey: string) => {
    const originalParam = parameters.find(p => p.param_key === paramKey);
    if (originalParam) {
      setEditedValues(prev => ({
        ...prev,
        [paramKey]: originalParam.param_value
      }));
      setHasChanges(prev => ({ ...prev, [paramKey]: false }));
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirmModal || deleteConfirmText !== 'DELETE') return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/config/workshop-parameters/${showDeleteConfirmModal}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete parameter');
      
      const data = await response.json();
      
      // Remove from local state
      setParameters(prev => prev.filter(p => p.param_key !== showDeleteConfirmModal));
      setEditedValues(prev => {
        const newValues = { ...prev };
        delete newValues[showDeleteConfirmModal!];
        return newValues;
      });
      
      onToast(data.message || 'Parameter deleted successfully', 'success');
      setShowDeleteConfirmModal(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Error deleting parameter:', error);
      onToast('Failed to delete parameter', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getIconForParam = (paramKey: string, paramType: string) => {
    if (paramKey.includes('url') || paramKey.includes('workspace')) return Globe;
    if (paramKey.includes('warehouse')) return Database;
    if (paramKey.includes('lakebase') || paramKey.includes('instance')) return Server;
    if (paramKey.includes('catalog') || paramType === 'catalog') return Layers;
    if (paramKey.includes('endpoint') || paramKey.includes('model') || paramType === 'endpoint') return Bot;
    if (paramKey.includes('company')) return Building2;
    return paramIcons[paramType] || Settings;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading workshop parameters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Workshop Parameters</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure parameters that are available to all workflow steps. These values will be substituted 
          in prompt templates using <code className="bg-secondary px-1.5 py-0.5 rounded text-primary font-mono text-xs">{'{param_key}'}</code> syntax.
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex-shrink-0 mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">How Parameters Work</p>
            <p className="text-blue-300/80">
              When you walk through the workflow, these parameters are automatically inserted into the generated prompts.
              For example, <code className="bg-blue-900/50 px-1 rounded">{'{workspace_url}'}</code> in Step 2 will show 
              the workspace URL you configure here.
            </p>
          </div>
        </div>
      </div>

      {/* Parameters List */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {parameters.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No workshop parameters found.</p>
            <p className="text-sm mt-1">Run the setup script to initialize default parameters.</p>
          </div>
        ) : (
          parameters.map(param => {
            const Icon = getIconForParam(param.param_key, param.param_type);
            const isChanged = hasChanges[param.param_key];
            const isSaving = saving === param.param_key;
            
            return (
              <div 
                key={param.param_key}
                className={`p-4 bg-card border rounded-lg transition-all ${
                  isChanged ? 'border-amber-500/50 bg-amber-900/10' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${
                    isChanged ? 'bg-amber-900/30 text-amber-400' : 'bg-secondary text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{param.param_label}</h3>
                      {param.is_required && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">Required</span>
                      )}
                      {isChanged && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded">Modified</span>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {param.param_description}
                    </p>
                    
                    {/* Session Override Toggle */}
                    <div className="flex items-center gap-3 mb-3 p-2 bg-secondary/30 rounded-lg">
                      <button
                        onClick={() => handleToggleOverride(param.param_key, param.allow_session_override)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          param.allow_session_override ? 'bg-primary' : 'bg-secondary'
                        }`}
                        title={param.allow_session_override ? 'Disable session override' : 'Enable session override'}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          param.allow_session_override ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {param.allow_session_override ? (
                          <Unlock className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {param.allow_session_override ? 'Users can override in their session' : 'Locked - users cannot override'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-xs bg-secondary px-2 py-1 rounded font-mono text-primary">
                        {'{' + param.param_key + '}'}
                      </code>
                      <span className="text-xs text-muted-foreground">← Use this in templates</span>
                    </div>
                    
                    {/* Input — rich editor for assistant_config, plain input otherwise */}
                    {param.param_type === 'assistant_config' ? (
                      <>
                        <CodingAssistantsConfigEditor
                          value={editedValues[param.param_key] || ''}
                          onChange={(next) => handleValueChange(param.param_key, next)}
                        />
                        <div className="flex items-center gap-2 mt-3">
                          {isChanged && (
                            <>
                              <button
                                onClick={() => handleSave(param.param_key)}
                                disabled={
                                  isSaving ||
                                  (parseCodingAssistantsConfig(editedValues[param.param_key])?.length ?? 0) === 0
                                }
                                title={
                                  (parseCodingAssistantsConfig(editedValues[param.param_key])?.length ?? 0) === 0
                                    ? 'At least one assistant must be visible before saving'
                                    : undefined
                                }
                                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                {isSaving ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                Save
                              </button>
                              <button
                                onClick={() => handleReset(param.param_key)}
                                className="px-3 py-2 bg-secondary text-muted-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
                              >
                                Reset
                              </button>
                            </>
                          )}
                          {!isChanged && param.param_value && (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                              <Check className="w-4 h-4" />
                              <span>Saved</span>
                            </div>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirmModal(param.param_key)}
                            className="ml-auto px-2 py-2 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete parameter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type={param.param_type === 'url' ? 'url' : 'text'}
                          value={editedValues[param.param_key] || ''}
                          onChange={(e) => handleValueChange(param.param_key, e.target.value)}
                          placeholder={`Enter ${param.param_label.toLowerCase()}`}
                          className={`flex-1 px-3 py-2 bg-secondary/50 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary ${
                            param.param_type === 'url' ? 'font-mono text-xs' : ''
                          }`}
                        />

                        {isChanged && (
                          <>
                            <button
                              onClick={() => handleSave(param.param_key)}
                              disabled={isSaving}
                              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isSaving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => handleReset(param.param_key)}
                              className="px-3 py-2 bg-secondary text-muted-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
                            >
                              Reset
                            </button>
                          </>
                        )}

                        {!isChanged && param.param_value && (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                            <Check className="w-4 h-4" />
                            <span>Saved</span>
                          </div>
                        )}

                        <button
                          onClick={() => setShowDeleteConfirmModal(param.param_key)}
                          className="px-2 py-2 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Delete parameter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {parameters.length} parameter{parameters.length !== 1 ? 's' : ''} configured
          </p>
          <button
            onClick={fetchParameters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal - Two-Step Confirmation */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-[28.125rem] p-6 border border-red-500/50">
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
              <p className="text-foreground font-medium">
                Parameter: <code className="bg-red-900/30 px-1.5 py-0.5 rounded font-mono">{'{' + showDeleteConfirmModal + '}'}</code>
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-3">
                This action <span className="text-red-400 font-semibold">CANNOT be undone</span>. Any templates using this parameter will no longer have it substituted.
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
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  deleteConfirmText === 'DELETE'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-red-500/30 text-red-300/50 cursor-not-allowed'
                }`}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
