/**
 * Workshop Parameters Configuration Component
 *
 * Configurable key-value parameters available to all workflow steps.
 * Parameters are substituted in prompt templates as {param_key}.
 *
 * Visual layout: chapter-band section headers (matching SectionInputsConfig
 * styling) with compact list rows underneath. Sections are grouped by update
 * cadence (Set once / Per session / Per workshop / Optional / BYO).
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Globe,
  Database,
  Server,
  AlertCircle,
  Check,
  Info,
  Layers,
  Bot,
  Trash2,
  Lock,
  Unlock,
  Building2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { CodingAssistantsConfigEditor } from './CodingAssistantsConfigEditor';
import { parseCodingAssistantsConfig } from '../../constants/codingAssistants';
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  SUBGROUP_ORDER,
  categorizeParam,
  PARAM_ICON_OVERRIDES,
} from '../../constants/workshopParamCategories';

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

const paramIcons: Record<string, React.ElementType> = {
  url: Globe,
  text: Settings,
  warehouse: Database,
  lakebase: Server,
  catalog: Layers,
  endpoint: Bot,
  assistant_config: ListChecks,
};

// v2: bumped when defaults flipped to all-collapsed so cached state from v1
// doesn't override the new default behavior on first render.
const OPEN_STATE_KEY = 'workshopParams.categoryOpen.v2';

function loadOpenState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveOpenState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(OPEN_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy mode failures
  }
}

interface CategoryBucket {
  categoryId: string;
  subgroups: Array<{
    name: string | null;
    items: WorkshopParameter[];
  }>;
  totalCount: number;
}

export function WorkshopParametersConfig({ onToast }: WorkshopParametersConfigProps) {
  const [parameters, setParameters] = useState<WorkshopParameter[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [openState, setOpenState] = useState<Record<string, boolean>>(() => {
    const persisted = loadOpenState();
    const initial: Record<string, boolean> = {};
    for (const id of CATEGORY_ORDER) {
      initial[id] = id in persisted ? !!persisted[id] : !!CATEGORY_META[id]?.defaultOpen;
    }
    return initial;
  });

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
    if (PARAM_ICON_OVERRIDES[paramKey]) return PARAM_ICON_OVERRIDES[paramKey];
    if (paramKey.includes('url') || paramKey.includes('workspace')) return Globe;
    if (paramKey.includes('warehouse')) return Database;
    if (paramKey.includes('lakebase') || paramKey.includes('instance')) return Server;
    if (paramKey.includes('catalog') || paramType === 'catalog') return Layers;
    if (paramKey.includes('endpoint') || paramKey.includes('model') || paramType === 'endpoint') return Bot;
    if (paramKey.includes('company')) return Building2;
    return paramIcons[paramType] || Settings;
  };

  const toggleCategory = (categoryId: string) => {
    setOpenState(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] };
      saveOpenState(next);
      return next;
    });
  };

  const buckets: CategoryBucket[] = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (p: WorkshopParameter) => {
      if (!trimmedQuery) return true;
      return (
        p.param_label.toLowerCase().includes(trimmedQuery) ||
        p.param_key.toLowerCase().includes(trimmedQuery) ||
        (p.param_description ?? '').toLowerCase().includes(trimmedQuery)
      );
    };

    const grouped: Record<string, Record<string, WorkshopParameter[]>> = {};
    for (const param of parameters) {
      if (!matchesQuery(param)) continue;
      const { category, subgroup } = categorizeParam(param.param_key);
      const bucket = grouped[category] ?? (grouped[category] = {});
      const subKey = subgroup ?? '__default__';
      (bucket[subKey] ?? (bucket[subKey] = [])).push(param);
    }

    const result: CategoryBucket[] = [];
    for (const categoryId of CATEGORY_ORDER) {
      const cat = grouped[categoryId];
      if (!cat) continue;
      const subKeysInOrder = SUBGROUP_ORDER[categoryId] ?? [];
      const seen = new Set<string>();
      const subgroups: CategoryBucket['subgroups'] = [];
      let total = 0;

      for (const subName of subKeysInOrder) {
        const items = cat[subName];
        if (items && items.length > 0) {
          subgroups.push({ name: subName, items });
          total += items.length;
          seen.add(subName);
        }
      }

      if (cat['__default__'] && cat['__default__'].length > 0) {
        subgroups.unshift({ name: null, items: cat['__default__'] });
        total += cat['__default__'].length;
        seen.add('__default__');
      }

      for (const [subName, items] of Object.entries(cat)) {
        if (seen.has(subName) || items.length === 0) continue;
        subgroups.push({ name: subName, items });
        total += items.length;
      }

      if (total > 0) {
        result.push({ categoryId, subgroups, totalCount: total });
      }
    }
    return result;
  }, [parameters, searchQuery]);

  const isExpanded = (bucket: CategoryBucket): boolean => {
    if (searchQuery.trim()) return true;
    const hasUnsavedEdit = bucket.subgroups.some(sg =>
      sg.items.some(p => hasChanges[p.param_key])
    );
    if (hasUnsavedEdit) return true;
    return openState[bucket.categoryId] ?? !!CATEGORY_META[bucket.categoryId]?.defaultOpen;
  };

  const totalModifiedCount = useMemo(
    () => Object.values(hasChanges).filter(Boolean).length,
    [hasChanges]
  );

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

  const renderParameterRow = (param: WorkshopParameter, isLast: boolean) => {
    const Icon = getIconForParam(param.param_key, param.param_type);
    const isChanged = !!hasChanges[param.param_key];
    const isSaving = saving === param.param_key;

    return (
      <div
        key={param.param_key}
        className={`group relative px-5 py-4 transition-colors ${
          isLast ? '' : 'border-b border-border/40'
        } ${isChanged ? 'bg-amber-500/5' : 'hover:bg-secondary/30'}`}
      >
        {isChanged && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/70" />
        )}

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-medium text-foreground text-sm">{param.param_label}</h3>
              <code
                className="text-[11px] bg-secondary px-1.5 py-0.5 rounded font-mono text-primary"
                title={`Use {${param.param_key}} in templates to substitute this value`}
              >
                {'{' + param.param_key + '}'}
              </code>
              {param.is_required && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">Required</span>
              )}
              {isChanged && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded">Modified</span>
              )}

              <button
                onClick={() => handleToggleOverride(param.param_key, param.allow_session_override)}
                className={`ml-auto inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
                  param.allow_session_override
                    ? 'border-primary/30 text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground hover:bg-secondary/60'
                }`}
                title={
                  param.allow_session_override
                    ? 'Users can override this value in their session. Click to lock.'
                    : 'Locked - users cannot override. Click to allow session override.'
                }
              >
                {param.allow_session_override ? (
                  <Unlock className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                <span>{param.allow_session_override ? 'Override' : 'Locked'}</span>
              </button>
            </div>

            {param.param_description && (
              <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
                {param.param_description}
              </p>
            )}

            {param.param_type === 'assistant_config' ? (
              <div className="space-y-2">
                <CodingAssistantsConfigEditor
                  value={editedValues[param.param_key] || ''}
                  onChange={(next) => handleValueChange(param.param_key, next)}
                />
                <div className="flex items-center gap-2">
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
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={() => handleReset(param.param_key)}
                        className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  )}
                  {!isChanged && param.param_value && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirmModal(param.param_key)}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete parameter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type={param.param_type === 'url' ? 'url' : 'text'}
                  value={editedValues[param.param_key] || ''}
                  onChange={(e) => handleValueChange(param.param_key, e.target.value)}
                  placeholder={`Enter ${param.param_label.toLowerCase()}`}
                  className={`flex-1 min-w-[20rem] px-3 py-1.5 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${
                    isChanged ? 'border-amber-500/50' : 'border-border'
                  } ${param.param_type === 'url' ? 'font-mono text-xs' : ''}`}
                />

                {isChanged ? (
                  <>
                    <button
                      onClick={() => handleSave(param.param_key)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => handleReset(param.param_key)}
                      className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      Reset
                    </button>
                  </>
                ) : param.param_value ? (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs px-2">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </div>
                ) : null}

                <button
                  onClick={() => setShowDeleteConfirmModal(param.param_key)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete parameter"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Workshop Parameters</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure parameters that are available to all workflow steps. These values are substituted
          in prompt templates using <code className="bg-secondary px-1.5 py-0.5 rounded text-primary font-mono text-xs">{'{param_key}'}</code> syntax.
          Sections are grouped by how often you typically need to change them.
        </p>
      </div>

      {/* Info Banner - made more compact than before */}
      <div className="flex-shrink-0 mb-3 px-3 py-2 bg-blue-900/15 border border-blue-700/25 rounded-md flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-200/90">
          <span className="font-medium">How it works:</span> values you save here are auto-inserted into the prompts generated for each workflow step.
          For example, <code className="bg-blue-900/40 px-1 rounded font-mono">{'{workspace_url}'}</code> in Step 2 shows your workspace URL.
        </p>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parameters by name, key, or description..."
            className="w-full pl-9 pr-9 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {parameters.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No workshop parameters found.</p>
            <p className="text-sm mt-1">Run the setup script to initialize default parameters.</p>
          </div>
        ) : buckets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No parameters match your search.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-primary hover:underline mt-2"
            >
              Clear search
            </button>
          </div>
        ) : (
          buckets.map(bucket => {
            const meta = CATEGORY_META[bucket.categoryId];
            if (!meta) return null;
            const expanded = isExpanded(bucket);
            const modifiedInBucket = bucket.subgroups.reduce(
              (n, sg) => n + sg.items.filter(p => hasChanges[p.param_key]).length,
              0
            );
            const flatItems = bucket.subgroups.flatMap(sg => sg.items);
            const totalCount = flatItems.length;
            let rowIndex = -1;

            return (
              <section
                key={bucket.categoryId}
                className={`rounded-lg border ${meta.style.border} bg-card overflow-hidden`}
              >
                {/* Chapter band header — distinct uppercase, colored, tinted bg */}
                <button
                  type="button"
                  onClick={() => toggleCategory(bucket.categoryId)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 ${meta.style.bg} border-b ${meta.style.border} hover:brightness-125 transition-all text-left`}
                >
                  <div className={`flex-shrink-0 ${meta.style.text}`}>
                    {expanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${meta.style.dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${meta.style.text}`}>
                    {meta.label}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.style.border} ${meta.style.text}`}
                  >
                    {meta.cadence}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {totalCount} param{totalCount !== 1 ? 's' : ''}
                  </span>
                  {modifiedInBucket > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded">
                      {modifiedInBucket} modified
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground/80 hidden md:inline-block max-w-[40%] truncate">
                    {meta.description}
                  </span>
                </button>

                {/* Body — list rows, no individual cards */}
                {expanded && (
                  <div className="bg-background/40">
                    {bucket.subgroups.map((sg, sgIdx) => {
                      const showDivider = sg.name !== null;
                      return (
                        <div key={sg.name ?? `default-${sgIdx}`}>
                          {showDivider && (
                            <div className={`flex items-center gap-2 px-5 py-2 ${meta.style.bg} border-b border-border/30`}>
                              <div className="h-px flex-1 bg-border/40" />
                              <span className={`text-[10px] uppercase tracking-wider font-semibold ${meta.style.text}`}>
                                {sg.name}
                              </span>
                              <div className="h-px flex-1 bg-border/40" />
                            </div>
                          )}
                          {sg.items.map(param => {
                            rowIndex++;
                            return renderParameterRow(param, rowIndex === totalCount - 1);
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {parameters.length} parameter{parameters.length !== 1 ? 's' : ''} in {buckets.length} section{buckets.length !== 1 ? 's' : ''}
            {totalModifiedCount > 0 && ` · ${totalModifiedCount} unsaved`}
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

      {/* Delete Confirmation Modal */}
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
