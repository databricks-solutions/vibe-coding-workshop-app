import { useState, useEffect } from 'react';
import { apiClient, type SectionInput } from '../../api/client';
import { WORKFLOW_SECTIONS } from '../../constants/workflowSections';
import { Loader2 } from 'lucide-react';

interface StepVisibilityConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface StepRow {
  sectionTag: string;
  title: string;
  chapter: string;
  chapterColor: string;
  enabled: boolean;
}

function groupByChapter(rows: StepRow[]): Record<string, StepRow[]> {
  const groups: Record<string, StepRow[]> = {};
  for (const row of rows) {
    if (!groups[row.chapter]) groups[row.chapter] = [];
    groups[row.chapter].push(row);
  }
  return groups;
}

export function StepVisibilityConfig({ onToast }: StepVisibilityConfigProps) {
  const [rows, setRows] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const inputs = await apiClient.getLatestSectionInputs();
      const inputMap = new Map<string, SectionInput>();
      for (const inp of inputs) {
        inputMap.set(inp.section_tag, inp);
      }

      const stepRows: StepRow[] = [];
      const usedTags = new Set<string>();
      for (const section of WORKFLOW_SECTIONS) {
        for (const step of section.steps) {
          const tag = step.sectionTag || '';
          if (!tag) continue;
          usedTags.add(tag);
          const inp = inputMap.get(tag);
          stepRows.push({
            sectionTag: tag,
            title: step.title,
            chapter: `${section.chapter}: ${section.title}`,
            chapterColor: section.color,
            enabled: inp?.step_enabled !== false,
          });
          // Check for _upload variant of this tag and insert it right after
          const uploadTag = `${tag}_upload`;
          const uploadInp = inputMap.get(uploadTag);
          if (uploadInp) {
            usedTags.add(uploadTag);
            stepRows.push({
              sectionTag: uploadTag,
              title: `${step.title} (Upload Mode)`,
              chapter: `${section.chapter}: ${section.title}`,
              chapterColor: section.color,
              enabled: uploadInp.step_enabled !== false,
            });
          }
        }
      }
      setRows(stepRows);
    } catch (err) {
      console.error('Error loading step visibility:', err);
      onToast('Failed to load step visibility data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(sectionTag: string, currentEnabled: boolean) {
    setToggling(sectionTag);
    const newEnabled = !currentEnabled;

    // Optimistic update
    setRows(prev => prev.map(r => r.sectionTag === sectionTag ? { ...r, enabled: newEnabled } : r));

    try {
      await apiClient.toggleStepVisibility(sectionTag, newEnabled);
      onToast(`Step "${sectionTag}" ${newEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      console.error('Error toggling step:', err);
      // Revert
      setRows(prev => prev.map(r => r.sectionTag === sectionTag ? { ...r, enabled: currentEnabled } : r));
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

  const grouped = groupByChapter(rows);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Step Visibility</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable individual workflow steps. Disabled steps will be hidden from all participants.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([chapter, steps]) => (
            <div key={chapter} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                <h3 className="text-ui-base font-semibold text-foreground">{chapter}</h3>
              </div>
              <div className="divide-y divide-border/50">
                {steps.map((step) => (
                  <div
                    key={step.sectionTag}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${step.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                      <div className="min-w-0">
                        <span className={`text-ui-base font-medium block ${step.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                          {step.title}
                        </span>
                        <span className="text-ui-xs text-muted-foreground block mt-0.5">
                          {step.sectionTag}
                        </span>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(step.sectionTag, step.enabled)}
                      disabled={toggling === step.sectionTag}
                      className="relative shrink-0 ml-4"
                      aria-label={`${step.enabled ? 'Disable' : 'Enable'} ${step.title}`}
                    >
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                        step.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          step.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}>
                          {toggling === step.sectionTag && (
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground absolute top-1 left-1" />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 mb-10 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-ui-sm text-amber-400/90">
            Changes take effect immediately for new page loads. Participants currently in a session will see the updated step list on their next refresh.
          </p>
        </div>
      </div>
    </div>
  );
}
