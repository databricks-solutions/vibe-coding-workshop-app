import { useState, useEffect, useCallback } from 'react';
import { Plug, Lock, RotateCcw, RefreshCw, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../api/client';

export interface AgentToolInputsEditorProps {
  sessionId: string | null;
  isExpanded: boolean;
  refreshKey?: number;
  onParamsLoaded?: (loaded: boolean) => void;
}

// Workshop parameter keys backing the editor. Strings only — workshop_parameters
// stores everything as TEXT, so booleans live as the literal strings "true"/"false".
const SQL_KEYS = {
  enabled: 'agent_tool_sql_mcp_enabled',
  catalog: 'agent_sql_catalog',
  schema: 'agent_sql_schema',
  warehouseId: 'agent_sql_warehouse_id',
  tableScope: 'agent_sql_table_scope',
} as const;

const GENIE_KEYS = {
  enabled: 'agent_tool_genie_enabled',
  spaceId: 'genie_space_id',
} as const;

const VS_KEYS = {
  enabled: 'agent_tool_vector_search_enabled',
  endpoint: 'vs_endpoint',
  index: 'vs_index',
} as const;

const UCF_KEYS = {
  enabled: 'agent_tool_uc_functions_enabled',
  targets: 'uc_function_targets',
} as const;

const EXTMCP_KEYS = {
  enabled: 'agent_tool_external_mcp_enabled',
  connection: 'external_mcp_connection',
} as const;

// All keys we read/write so we can ask the session-parameters API for them in
// one round-trip and reset cleanly.
const ALL_KEYS: readonly string[] = [
  SQL_KEYS.enabled, SQL_KEYS.catalog, SQL_KEYS.schema, SQL_KEYS.warehouseId, SQL_KEYS.tableScope,
  GENIE_KEYS.enabled, GENIE_KEYS.spaceId,
  VS_KEYS.enabled, VS_KEYS.endpoint, VS_KEYS.index,
  UCF_KEYS.enabled, UCF_KEYS.targets,
  EXTMCP_KEYS.enabled, EXTMCP_KEYS.connection,
];

interface ToolInputsState {
  sqlEnabled: boolean;
  sqlCatalog: string;
  sqlSchema: string;
  sqlWarehouseId: string;
  sqlTableScope: string; // "all" or comma list
  genieEnabled: boolean;
  genieSpaceId: string;
  vsEnabled: boolean;
  vsEndpoint: string;
  vsIndex: string;
  ucfEnabled: boolean;
  ucfTargets: string;
  extMcpEnabled: boolean;
  extMcpConnection: string;
}

const EMPTY_STATE: ToolInputsState = {
  sqlEnabled: true,
  sqlCatalog: 'samples',
  sqlSchema: 'wanderbricks',
  sqlWarehouseId: '',
  sqlTableScope: 'all',
  genieEnabled: false,
  genieSpaceId: '',
  vsEnabled: false,
  vsEndpoint: '',
  vsIndex: '',
  ucfEnabled: false,
  ucfTargets: '',
  extMcpEnabled: false,
  extMcpConnection: '',
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

export function AgentToolInputsEditor({
  sessionId,
  isExpanded,
  refreshKey = 0,
  onParamsLoaded,
}: AgentToolInputsEditorProps) {
  const [params, setParams] = useState<ToolInputsState | null>(null);
  const [isOverridden, setIsOverridden] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ToolInputsState>(EMPTY_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSqlAdvanced, setShowSqlAdvanced] = useState(false);

  const fetchParams = useCallback(async () => {
    if (!sessionId) return;
    try {
      const all = await apiClient.getSessionParameters(sessionId);
      const byKey = new Map(all.map((p) => [p.param_key, p]));
      const get = (k: string) => byKey.get(k)?.param_value ?? '';

      const next: ToolInputsState = {
        sqlEnabled: parseBool(get(SQL_KEYS.enabled), true),
        sqlCatalog: get(SQL_KEYS.catalog) || 'samples',
        sqlSchema: get(SQL_KEYS.schema) || 'wanderbricks',
        sqlWarehouseId: get(SQL_KEYS.warehouseId),
        sqlTableScope: get(SQL_KEYS.tableScope) || 'all',
        genieEnabled: parseBool(get(GENIE_KEYS.enabled), false),
        genieSpaceId: get(GENIE_KEYS.spaceId),
        vsEnabled: parseBool(get(VS_KEYS.enabled), false),
        vsEndpoint: get(VS_KEYS.endpoint),
        vsIndex: get(VS_KEYS.index),
        ucfEnabled: parseBool(get(UCF_KEYS.enabled), false),
        ucfTargets: get(UCF_KEYS.targets),
        extMcpEnabled: parseBool(get(EXTMCP_KEYS.enabled), false),
        extMcpConnection: get(EXTMCP_KEYS.connection),
      };

      const overridden = ALL_KEYS.some((k) => byKey.get(k)?.is_overridden);

      setParams(next);
      setDraft(next);
      setIsOverridden(overridden);
      setError(null);
      onParamsLoaded?.(true);
    } catch (err) {
      console.error('Failed to fetch agent tool inputs:', err);
      setParams(EMPTY_STATE);
      setDraft(EMPTY_STATE);
      setIsOverridden(false);
      onParamsLoaded?.(true);
    }
  }, [sessionId, onParamsLoaded]);

  useEffect(() => {
    if (sessionId && isExpanded) {
      setParams(null);
      onParamsLoaded?.(false);
      fetchParams();
    }
    // fetchParams is stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isExpanded, refreshKey]);

  const handleSave = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        [SQL_KEYS.enabled]: draft.sqlEnabled ? 'true' : 'false',
        [SQL_KEYS.catalog]: draft.sqlCatalog,
        [SQL_KEYS.schema]: draft.sqlSchema,
        [SQL_KEYS.warehouseId]: draft.sqlWarehouseId,
        [SQL_KEYS.tableScope]: draft.sqlTableScope || 'all',
        [GENIE_KEYS.enabled]: draft.genieEnabled ? 'true' : 'false',
        [GENIE_KEYS.spaceId]: draft.genieSpaceId,
        [VS_KEYS.enabled]: draft.vsEnabled ? 'true' : 'false',
        [VS_KEYS.endpoint]: draft.vsEndpoint,
        [VS_KEYS.index]: draft.vsIndex,
        [UCF_KEYS.enabled]: draft.ucfEnabled ? 'true' : 'false',
        [UCF_KEYS.targets]: draft.ucfTargets,
        [EXTMCP_KEYS.enabled]: draft.extMcpEnabled ? 'true' : 'false',
        [EXTMCP_KEYS.connection]: draft.extMcpConnection,
      };
      await apiClient.updateSessionParameters(sessionId, payload);
      await fetchParams();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save agent tool inputs:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    setError(null);
    try {
      // Reset every key we own back to the global default. The backend silently
      // skips keys that aren't currently overridden, so this is safe to call
      // for the full set.
      await Promise.all(ALL_KEYS.map((k) => apiClient.resetSessionParameter(sessionId, k)));
      await fetchParams();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to reset agent tool inputs:', err);
      setError('Failed to reset. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (params) setDraft(params);
    setIsEditing(false);
    setError(null);
  };

  if (!params) {
    return (
      <div className="mt-3 px-4 py-3 bg-muted/20 rounded-md border border-border/40">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          <span className="text-ui-base text-muted-foreground">Loading agent tool inputs...</span>
        </div>
      </div>
    );
  }

  // ----- Read mode summary -----
  if (!isEditing) {
    const summaryParts: string[] = [];
    if (params.sqlEnabled) {
      summaryParts.push(
        `SQL MCP: ${params.sqlCatalog || '?'}.${params.sqlSchema || '?'} (${params.sqlTableScope === 'all' ? 'all tables' : 'allowlist'})`
      );
    }
    if (params.genieEnabled) {
      summaryParts.push(`Genie: ${params.genieSpaceId ? params.genieSpaceId : 'not set'}`);
    }
    if (params.vsEnabled) {
      summaryParts.push(`Vector Search: ${params.vsIndex ? params.vsIndex : 'not set'}`);
    }
    if (params.ucfEnabled) {
      summaryParts.push(`UC Functions: ${params.ucfTargets ? 'configured' : 'not set'}`);
    }
    if (params.extMcpEnabled) {
      summaryParts.push(`External MCP: ${params.extMcpConnection ? params.extMcpConnection : 'not set'}`);
    }
    if (summaryParts.length === 0) {
      summaryParts.push('No tools selected');
    }

    return (
      <div className="mt-3 px-4 py-3 bg-muted/30 rounded-md border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Plug className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">Agent Tools:</span>
            <span className="text-sm font-medium text-foreground truncate">
              {summaryParts.join(' \u00b7 ')}
            </span>
            {isOverridden && (
              <span className="text-ui-2xs px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium shrink-0">
                Custom
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  // ----- Edit mode -----
  return (
    <div className="mt-3 px-4 py-3 bg-muted/30 rounded-md border border-border/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-foreground">Agent Tool Inputs</span>
        </div>
        <div className="flex items-center gap-1">
          {isOverridden && (
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
            disabled={isSaving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>

      {/* SQL MCP — on by default */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.sqlEnabled}
            onChange={(e) => setDraft({ ...draft, sqlEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-blue-500"
          />
          <span className="text-sm font-medium text-foreground">SQL MCP</span>
          <span className="text-ui-2xs text-muted-foreground">(read-only Unity Catalog scope)</span>
        </label>
        {draft.sqlEnabled && (
          <div className="ml-6 space-y-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Catalog
                </label>
                <input
                  type="text"
                  value={draft.sqlCatalog}
                  onChange={(e) => setDraft({ ...draft, sqlCatalog: e.target.value })}
                  placeholder="samples"
                  className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Schema
                </label>
                <input
                  type="text"
                  value={draft.sqlSchema}
                  onChange={(e) => setDraft({ ...draft, sqlSchema: e.target.value })}
                  placeholder="wanderbricks"
                  className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Warehouse ID
                </label>
                <input
                  type="text"
                  value={draft.sqlWarehouseId}
                  onChange={(e) => setDraft({ ...draft, sqlWarehouseId: e.target.value })}
                  placeholder="default warehouse"
                  className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <p className="text-ui-2xs text-muted-foreground">
              Scope: all tables in this schema, governed by Unity Catalog permissions.
            </p>
            <button
              type="button"
              onClick={() => setShowSqlAdvanced((v) => !v)}
              className="flex items-center gap-1 text-ui-2xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showSqlAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Advanced
            </button>
            {showSqlAdvanced && (
              <div>
                <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Table allowlist (optional)
                </label>
                <input
                  type="text"
                  value={draft.sqlTableScope === 'all' ? '' : draft.sqlTableScope}
                  onChange={(e) =>
                    setDraft({ ...draft, sqlTableScope: e.target.value.trim() === '' ? 'all' : e.target.value })
                  }
                  placeholder="catalog.schema.table_a, catalog.schema.table_b (leave blank for all)"
                  className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-ui-2xs text-muted-foreground">
                  Leave blank to keep the default (all tables, governed by UC).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Genie */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.genieEnabled}
            onChange={(e) => setDraft({ ...draft, genieEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-blue-500"
          />
          <span className="text-sm font-medium text-foreground">Genie</span>
          <span className="text-ui-2xs text-muted-foreground">(bring your own Genie Space)</span>
        </label>
        {draft.genieEnabled && (
          <div className="ml-6">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Genie Space ID
            </label>
            <input
              type="text"
              value={draft.genieSpaceId}
              onChange={(e) => setDraft({ ...draft, genieSpaceId: e.target.value })}
              placeholder="01abc23..."
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Vector Search */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.vsEnabled}
            onChange={(e) => setDraft({ ...draft, vsEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-blue-500"
          />
          <span className="text-sm font-medium text-foreground">Vector Search</span>
          <span className="text-ui-2xs text-muted-foreground">(bring your own endpoint and index)</span>
        </label>
        {draft.vsEnabled && (
          <div className="ml-6 flex gap-3">
            <div className="flex-1">
              <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Endpoint
              </label>
              <input
                type="text"
                value={draft.vsEndpoint}
                onChange={(e) => setDraft({ ...draft, vsEndpoint: e.target.value })}
                placeholder="my-vs-endpoint"
                className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Index
              </label>
              <input
                type="text"
                value={draft.vsIndex}
                onChange={(e) => setDraft({ ...draft, vsIndex: e.target.value })}
                placeholder="catalog.schema.index"
                className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* UC Functions */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.ucfEnabled}
            onChange={(e) => setDraft({ ...draft, ucfEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-blue-500"
          />
          <span className="text-sm font-medium text-foreground">UC Functions</span>
          <span className="text-ui-2xs text-muted-foreground">(fully qualified function names)</span>
        </label>
        {draft.ucfEnabled && (
          <div className="ml-6">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Function targets
            </label>
            <textarea
              value={draft.ucfTargets}
              onChange={(e) => setDraft({ ...draft, ucfTargets: e.target.value })}
              rows={2}
              placeholder="catalog.schema.function_a, catalog.schema.function_b"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* External MCP */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.extMcpEnabled}
            onChange={(e) => setDraft({ ...draft, extMcpEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-blue-500"
          />
          <span className="text-sm font-medium text-foreground">External MCP</span>
          <span className="text-ui-2xs text-muted-foreground">(UC connection or registry candidate)</span>
        </label>
        {draft.extMcpEnabled && (
          <div className="ml-6">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              UC Connection
            </label>
            <input
              type="text"
              value={draft.extMcpConnection}
              onChange={(e) => setDraft({ ...draft, extMcpConnection: e.target.value })}
              placeholder="my_uc_connection_or_registry_name"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-ui-2xs text-muted-foreground">
        Changes are saved to your session only. Other users will see global defaults.
      </p>
    </div>
  );
}
