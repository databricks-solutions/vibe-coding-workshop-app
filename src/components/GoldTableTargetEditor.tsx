import { useState, useEffect } from 'react';
import { Database, Lock, Save, X } from 'lucide-react';

export interface GoldTableTarget {
  catalog: string;
  schema: string;
  prefix: string;
}

interface GoldTableTargetEditorProps {
  value: GoldTableTarget;
  onChange: (target: GoldTableTarget) => void;
  /** Dynamic defaults derived from user email + use case. Used to detect customisation. */
  defaultValues?: Partial<GoldTableTarget>;
}

export function GoldTableTargetEditor({ value, onChange, defaultValues }: GoldTableTargetEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCatalog, setEditCatalog] = useState(value.catalog);
  const [editSchema, setEditSchema] = useState(value.schema);
  const [editPrefix, setEditPrefix] = useState(value.prefix);

  // Keep edit fields in sync when parent auto-derives new defaults (only while not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditCatalog(value.catalog);
      setEditSchema(value.schema);
      setEditPrefix(value.prefix);
    }
  }, [value.catalog, value.schema, value.prefix, isEditing]);

  const handleSave = () => {
    onChange({ catalog: editCatalog.trim(), schema: editSchema.trim(), prefix: editPrefix.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditCatalog(value.catalog);
    setEditSchema(value.schema);
    setEditPrefix(value.prefix);
    setIsEditing(false);
  };

  const defCatalog = defaultValues?.catalog ?? '';
  const defSchema = defaultValues?.schema ?? '';
  const isCustom =
    (value.catalog !== '' && value.catalog !== defCatalog) ||
    (value.schema !== '' && value.schema !== defSchema) ||
    value.prefix !== '';

  if (!isEditing) {
    return (
      <div className="mt-3 px-4 py-3 bg-muted/30 rounded-md border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span className="text-sm text-muted-foreground flex-shrink-0">Gold Tables:</span>
            <span className="text-sm font-medium text-foreground truncate">
              {value.catalog}.{value.schema}{value.prefix ? ` (prefix: ${value.prefix}*)` : ''}
            </span>
            {isCustom && (
              <span className="text-ui-2xs px-1.5 py-0.5 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-full font-medium flex-shrink-0">
                Custom
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors flex-shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 px-4 py-3 bg-muted/30 rounded-md border border-border/50">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-foreground">Gold Layer Target</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editCatalog.trim() || !editSchema.trim()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Catalog
            </label>
            <input
              type="text"
              value={editCatalog}
              onChange={(e) => setEditCatalog(e.target.value)}
              placeholder="vibe_coding_workshop_catalog"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Schema
            </label>
            <input
              type="text"
              value={editSchema}
              onChange={(e) => setEditSchema(e.target.value)}
              placeholder="my_app_gold"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex-[0.7]">
            <label className="block text-ui-2xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Table Prefix <span className="normal-case text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={editPrefix}
              onChange={(e) => setEditPrefix(e.target.value)}
              placeholder="dim_, fact_..."
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        
        <p className="text-ui-2xs text-muted-foreground">
          Specify the catalog and schema containing your gold-layer tables. Optional prefix filters tables by name (e.g., <code className="text-violet-400">dim_</code>).
        </p>
      </div>
    </div>
  );
}
