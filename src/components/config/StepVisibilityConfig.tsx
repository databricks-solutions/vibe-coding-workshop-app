import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { WORKFLOW_SECTIONS, WORKSHOP_LEVELS, type WorkshopLevel } from '../../constants/workflowSections';
import { BUTTON_LABELS } from '../LevelSelector';
import { Loader2, AlertTriangle, Route, ListOrdered } from 'lucide-react';

interface StepVisibilityConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

type AssistantColumn = '__default__' | 'coda' | 'genie-code';

// Secondary navigation within the Visibility tab. Paths (which tracks appear in
// the picker) and Flow (Prerequisites + the ordered step sequence) are distinct
// concerns; splitting them keeps each toggle group unambiguous.
type SubTab = 'paths' | 'flow';

interface MatrixItem {
  section_key: string;
  kind: 'step' | 'prerequisites' | 'path';
  default_enabled: boolean;
  coda_enabled: boolean;
  genie_code_enabled: boolean;
}

interface StepRow {
  sectionKey: string;
  kind: 'step' | 'prerequisites' | 'path';
  title: string;
  chapter: string;
  chapterColor: string;
  values: Record<AssistantColumn, boolean>;
}

// ---------------------------------------------------------------------------
// Workshop-path rows derive from the frontend's canonical WORKSHOP_LEVELS map
// (the backend never enumerates the level universe). Display order mirrors
// the LevelSelector visual layout so the matrix and the picker line up.
// ---------------------------------------------------------------------------

const PATH_KEY_PREFIX = '__path_';
const pathKeyFor = (level: WorkshopLevel) => `${PATH_KEY_PREFIX}${level}__`;

// Forward direction first (matches the column ordering in LevelSelector),
// then End-to-End, then accelerators, then Reverse ETL.
const PATH_DISPLAY_ORDER: WorkshopLevel[] = [
  'app-only', 'app-database',
  'lakehouse', 'lakehouse-di',
  'end-to-end',
  'accelerator', 'genie-accelerator', 'data-engineering-accelerator',
  'skills-accelerator', 'agents-accelerator',
  'reverse-lakehouse', 'reverse-lakehouse-di', 'reverse-lakebase', 'reverse-app',
];

// Per-level chapter header. Mirrors the persona-aligned column groupings used
// by LevelSelector but is intentionally duplicated here as a static lookup so
// (a) StepVisibilityConfig has no dependency on non-component exports from the
// LevelSelector module (preserves react-refresh fast-refresh boundaries), and
// (b) admins see a stable display order even if LevelSelector's internal track
// model evolves later.
const PATH_CHAPTER: Record<WorkshopLevel, string> = {
  'app-only':                       'Workshop Paths · Apps and Lakebase',
  'app-database':                   'Workshop Paths · Apps and Lakebase',
  'lakehouse':                      'Workshop Paths · Lakehouse',
  'lakehouse-di':                   'Workshop Paths · AI and Agents',
  'end-to-end':                     'Workshop Paths · Complete Workshop',
  'accelerator':                    'Workshop Paths · Accelerators',
  'genie-accelerator':              'Workshop Paths · Accelerators',
  'data-engineering-accelerator':   'Workshop Paths · Accelerators',
  'skills-accelerator':             'Workshop Paths · Accelerators',
  'agents-accelerator':             'Workshop Paths · Accelerators',
  'reverse-lakehouse':              'Workshop Paths · Reverse ETL',
  'reverse-lakehouse-di':           'Workshop Paths · Reverse ETL',
  'reverse-lakebase':               'Workshop Paths · Reverse ETL',
  'reverse-app':                    'Workshop Paths · Reverse ETL',
};

const COLUMNS: Array<{ id: AssistantColumn; label: string }> = [
  { id: '__default__', label: 'Default' },
  { id: 'coda', label: 'CoDA' },
  { id: 'genie-code', label: 'Genie Code' },
];

function groupByChapter(rows: StepRow[]): Array<[string, StepRow[]]> {
  // Preserve insertion order; return [chapter, rows].
  const order: string[] = [];
  const map = new Map<string, StepRow[]>();
  for (const row of rows) {
    if (!map.has(row.chapter)) {
      map.set(row.chapter, []);
      order.push(row.chapter);
    }
    map.get(row.chapter)!.push(row);
  }
  return order.map(name => [name, map.get(name)!]);
}

export function StepVisibilityConfig({ onToast }: StepVisibilityConfigProps) {
  const [prereqRow, setPrereqRow] = useState<StepRow | null>(null);
  const [pathRows, setPathRows] = useState<StepRow[]>([]);
  const [stepRows, setStepRows] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('paths');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { items } = await apiClient.getStepVisibilityMatrix();
      const itemMap = new Map<string, MatrixItem>();
      for (const it of items) itemMap.set(it.section_key, it);

      // Prerequisites row (pinned at top).
      const prereq = itemMap.get('__prerequisites__');
      const prereqRowBuilt: StepRow | null = prereq
        ? {
            sectionKey: '__prerequisites__',
            kind: 'prerequisites',
            title: 'Prerequisites (workshop section)',
            chapter: 'Workshop Setup',
            chapterColor: 'text-primary',
            values: {
              '__default__': prereq.default_enabled,
              'coda': prereq.coda_enabled,
              'genie-code': prereq.genie_code_enabled,
            },
          }
        : null;
      setPrereqRow(prereqRowBuilt);

      // Workshop-path rows. Built from the frontend's canonical level list
      // (WORKSHOP_LEVELS) — the backend never enumerates levels, so any level
      // not yet present in step_visibility_overrides shows up as all-enabled.
      // This mirrors the runtime resolver's "absence == enabled" rule.
      const pathRowsBuilt: StepRow[] = PATH_DISPLAY_ORDER
        .filter(level => level in WORKSHOP_LEVELS)
        .map(level => {
          const key = pathKeyFor(level);
          const it = itemMap.get(key);
          return {
            sectionKey: key,
            kind: 'path' as const,
            title: BUTTON_LABELS[level] ?? level,
            chapter: PATH_CHAPTER[level],
            chapterColor: 'text-primary',
            values: {
              '__default__': it?.default_enabled ?? true,
              'coda':        it?.coda_enabled    ?? true,
              'genie-code':  it?.genie_code_enabled ?? true,
            },
          };
        });
      setPathRows(pathRowsBuilt);

      // Real step rows, grouped by chapter. Mirror the pre-change upload-variant
      // behaviour: if `${tag}_upload` exists in the matrix, insert it right after
      // its base tag so admins see the pair together.
      const rowsBuilt: StepRow[] = [];
      const usedKeys = new Set<string>();
      for (const section of WORKFLOW_SECTIONS) {
        for (const step of section.steps) {
          const tag = step.sectionTag || '';
          if (!tag) continue;
          const it = itemMap.get(tag);
          if (it) {
            usedKeys.add(tag);
            rowsBuilt.push({
              sectionKey: tag,
              kind: 'step',
              title: step.title,
              chapter: `${section.chapter}: ${section.title}`,
              chapterColor: section.color,
              values: {
                '__default__': it.default_enabled,
                'coda': it.coda_enabled,
                'genie-code': it.genie_code_enabled,
              },
            });
          }
          const uploadTag = `${tag}_upload`;
          const uploadIt = itemMap.get(uploadTag);
          if (uploadIt) {
            usedKeys.add(uploadTag);
            rowsBuilt.push({
              sectionKey: uploadTag,
              kind: 'step',
              title: `${step.title} (Upload Mode)`,
              chapter: `${section.chapter}: ${section.title}`,
              chapterColor: section.color,
              values: {
                '__default__': uploadIt.default_enabled,
                'coda': uploadIt.coda_enabled,
                'genie-code': uploadIt.genie_code_enabled,
              },
            });
          }
        }
      }

      // Append any orphan section_keys not covered by WORKFLOW_SECTIONS so they
      // don't silently disappear from the admin surface.
      for (const it of items) {
        if (it.kind !== 'step') continue;
        if (usedKeys.has(it.section_key)) continue;
        rowsBuilt.push({
          sectionKey: it.section_key,
          kind: 'step',
          title: it.section_key,
          chapter: 'Other / Unmapped',
          chapterColor: 'text-muted-foreground',
          values: {
            '__default__': it.default_enabled,
            'coda': it.coda_enabled,
            'genie-code': it.genie_code_enabled,
          },
        });
      }

      setStepRows(rowsBuilt);
    } catch (err) {
      console.error('Error loading step visibility matrix:', err);
      onToast('Failed to load step visibility data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(row: StepRow, col: AssistantColumn) {
    const togglingId = `${row.sectionKey}::${col}`;
    setToggling(togglingId);
    const previous = row.values[col];
    const next = !previous;

    // Optimistic update
    const apply = (v: boolean) => {
      const updated: StepRow = { ...row, values: { ...row.values, [col]: v } };
      if (row.kind === 'prerequisites') {
        setPrereqRow(updated);
      } else if (row.kind === 'path') {
        setPathRows(prev => prev.map(r => (r.sectionKey === row.sectionKey ? updated : r)));
      } else {
        setStepRows(prev => prev.map(r => (r.sectionKey === row.sectionKey ? updated : r)));
      }
    };
    apply(next);

    try {
      await apiClient.setStepVisibility(row.sectionKey, next, col);
      const colLabel = COLUMNS.find(c => c.id === col)?.label ?? col;
      // Path-row wording reads more naturally in the UI: paths are "available"
      // or "hidden" rather than "enabled"/"disabled" (which fits steps better).
      const verb = row.kind === 'path'
        ? (next ? 'available' : 'hidden')
        : (next ? 'enabled' : 'disabled');
      const noun = row.kind === 'path' ? 'path' : 'step';
      onToast(`${noun.charAt(0).toUpperCase() + noun.slice(1)} "${row.title}" — ${colLabel}: ${verb}`, 'success');
    } catch (err) {
      console.error('Error toggling step visibility:', err);
      apply(previous);
      onToast(`Failed to update ${row.kind === 'path' ? 'path' : 'step'} visibility`, 'error');
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading visibility...</span>
      </div>
    );
  }

  const grouped = groupByChapter(stepRows);
  const groupedPaths = groupByChapter(pathRows);

  const SUB_TABS: Array<{ id: SubTab; label: string; icon: typeof Route }> = [
    { id: 'paths', label: 'Workshop Paths', icon: Route },
    { id: 'flow', label: 'Workshop Flow', icon: ListOrdered },
  ];

  const columnHeaderLabel = subTab === 'paths' ? 'Path' : 'Step';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">Visibility</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each row has three independent visibility toggles &mdash; one per coding assistant.
            Newly added rows start with all three enabled. Changing Default later does not flip
            CoDA or Genie Code.
          </p>
        </div>

        {/* Secondary sub-tab bar — separates the two distinct concerns:
            which path tracks appear in the picker (Paths) vs. the ordered
            step sequence shown during the workshop (Flow). */}
        <div className="mb-5 inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          {SUB_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-ui-sm font-medium transition-colors ${
                subTab === id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tab scoped guidance */}
        {subTab === 'paths' ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-ui-sm text-amber-400/90">
              These toggles control which tracks appear in the workshop path picker. Hiding a path
              greys it out in the picker; the user&rsquo;s currently-selected path always remains
              clickable even when hidden, so saved sessions never break.
            </p>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-ui-sm text-amber-400/90">
              These toggles control the ordered step sequence shown during the workshop. Hiding a
              step (including Prerequisites) auto-advances the wizard to the next visible step for
              that assistant.
            </p>
          </div>
        )}

        {/* Column header */}
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,120px))] gap-4 px-5 pb-2 text-ui-xs uppercase tracking-wide text-muted-foreground">
          <div>{columnHeaderLabel}</div>
          {COLUMNS.map(c => (
            <div key={c.id} className="text-center">{c.label}</div>
          ))}
        </div>

        {subTab === 'paths' ? (
          <div className="space-y-6">
            {/* Workshop paths. Sourced from WORKSHOP_LEVELS (frontend canonical
                list); rows render even when no override row exists for them yet
                (defaults to all-enabled). */}
            {groupedPaths.map(([chapter, paths]) => (
              <div key={chapter} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-ui-base font-semibold text-foreground">{chapter}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {paths.map(p => (
                    <VisibilityRow
                      key={p.sectionKey}
                      row={p}
                      toggling={toggling}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Prerequisites — pinned at the top of the flow */}
            {prereqRow && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-ui-base font-semibold text-foreground">{prereqRow.chapter}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  <VisibilityRow
                    row={prereqRow}
                    toggling={toggling}
                    onToggle={handleToggle}
                  />
                </div>
              </div>
            )}

            {grouped.map(([chapter, steps]) => (
              <div key={chapter} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-ui-base font-semibold text-foreground">{chapter}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {steps.map(step => (
                    <VisibilityRow
                      key={step.sectionKey}
                      row={step}
                      toggling={toggling}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 mb-10 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-ui-sm text-amber-400/90">
            Changes take effect immediately for new page loads. Participants currently in a session
            will see the updated step list on their next refresh.
          </p>
        </div>
      </div>
    </div>
  );
}

interface VisibilityRowProps {
  row: StepRow;
  toggling: string | null;
  onToggle: (row: StepRow, col: AssistantColumn) => void;
}

function VisibilityRow({ row, toggling, onToggle }: VisibilityRowProps) {
  const anyOff = COLUMNS.some(c => !row.values[c.id]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,120px))] gap-4 items-center px-5 py-3.5 hover:bg-secondary/20 transition-colors">
      <div className="min-w-0 flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${anyOff ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <div className="min-w-0">
          <span className="text-ui-base font-medium text-foreground block truncate">{row.title}</span>
          <span className="text-ui-xs text-muted-foreground block mt-0.5 truncate">{row.sectionKey}</span>
        </div>
      </div>
      {COLUMNS.map(col => {
        const on = row.values[col.id];
        const tid = `${row.sectionKey}::${col.id}`;
        const isToggling = toggling === tid;
        const offVerb = row.kind === 'path' ? 'hidden' : 'disabled';
        const onVerb  = row.kind === 'path' ? 'available' : 'enabled';
        return (
          <div key={col.id} className="flex justify-center">
            <button
              onClick={() => onToggle(row, col.id)}
              disabled={isToggling}
              aria-label={`Set ${col.label} visibility for ${row.title} to ${on ? offVerb : onVerb}`}
              className="relative shrink-0"
            >
              <div
                className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  on ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    on ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                >
                  {isToggling && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground absolute top-1 left-1" />
                  )}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
