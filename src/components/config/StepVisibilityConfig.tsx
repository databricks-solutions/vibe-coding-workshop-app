import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { WORKFLOW_SECTIONS } from '../../constants/workflowSections';
import { Loader2, AlertTriangle } from 'lucide-react';

interface StepVisibilityConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

type AssistantColumn = '__default__' | 'coda' | 'genie-code';

interface MatrixItem {
  section_key: string;
  kind: 'step' | 'prerequisites';
  default_enabled: boolean;
  coda_enabled: boolean;
  genie_code_enabled: boolean;
}

interface StepRow {
  sectionKey: string;
  kind: 'step' | 'prerequisites';
  title: string;
  chapter: string;
  chapterColor: string;
  values: Record<AssistantColumn, boolean>;
}

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
  const [stepRows, setStepRows] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

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
      } else {
        setStepRows(prev => prev.map(r => (r.sectionKey === row.sectionKey ? updated : r)));
      }
    };
    apply(next);

    try {
      await apiClient.setStepVisibility(row.sectionKey, next, col);
      const colLabel = COLUMNS.find(c => c.id === col)?.label ?? col;
      onToast(`"${row.title}" — ${colLabel}: ${next ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      console.error('Error toggling step visibility:', err);
      apply(previous);
      onToast('Failed to update step visibility', 'error');
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading steps...</span>
      </div>
    );
  }

  const grouped = groupByChapter(stepRows);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Step Visibility</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each step has three independent visibility toggles &mdash; one per coding assistant.
            Newly created sections start with all three enabled and matching today&rsquo;s Default;
            changing Default later does not flip CoDA or Genie Code.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-ui-sm text-amber-400/90">
              Hiding a section (including Prerequisites) auto-advances the wizard to the next
              visible section for that assistant. Users are never stranded on a hidden stage.
            </p>
          </div>
        </div>

        {/* Column header */}
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,120px))] gap-4 px-5 pb-2 text-ui-xs uppercase tracking-wide text-muted-foreground">
          <div>Step</div>
          {COLUMNS.map(c => (
            <div key={c.id} className="text-center">{c.label}</div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Prerequisites — pinned row */}
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
        return (
          <div key={col.id} className="flex justify-center">
            <button
              onClick={() => onToggle(row, col.id)}
              disabled={isToggling}
              aria-label={`Set ${col.label} visibility for ${row.title} to ${on ? 'disabled' : 'enabled'}`}
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
