/**
 * Coding Assistants Config Editor
 *
 * Custom editor rendered inside the Workshop Parameters admin page for the
 * `coding_assistants_config` parameter. Controls three dimensions in one
 * JSON blob stored as that parameter's value:
 *
 *   - Visibility: membership in the Available box.
 *   - Order: position inside the Available box.
 *   - Recommended flag: per-row checkbox. All rows with `recommended: true`
 *     show a consistent "Recommended" pill — no special "most recommended"
 *     distinction. Order alone conveys priority.
 *
 * Any change calls `onChange(JSON.stringify(available))` which feeds into the
 * existing WorkshopParametersConfig save/reset flow.
 */

import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Sparkles, AlertCircle, Map } from 'lucide-react';
import {
  ASSISTANT_CATALOG,
  DEFAULT_LEVEL_BY_ASSISTANT,
  parseCodingAssistantsConfig,
  type AssistantId,
  type CodingAssistantConfigEntry,
} from '../../constants/codingAssistants';

const DEFAULT_PATH_OPTIONS: { value: string; label: string }[] = [
  { value: 'end-to-end', label: 'Complete Workshop (All Chapters)' },
  { value: 'genie-accelerator', label: 'Genie Accelerator' },
  { value: 'agents-accelerator', label: 'Agents Accelerator' },
  { value: 'data-engineering-accelerator', label: 'Data Engineering Accelerator' },
  { value: 'lakehouse-di', label: 'Lakehouse + AI & Agents' },
  { value: 'lakehouse', label: 'Lakehouse' },
  { value: 'app-database', label: 'Apps + Lakebase' },
  { value: 'app-only', label: 'Databricks Apps' },
];

interface CodingAssistantsConfigEditorProps {
  value: string;
  onChange: (next: string) => void;
}

export function CodingAssistantsConfigEditor({ value, onChange }: CodingAssistantsConfigEditorProps) {
  const available = useMemo<CodingAssistantConfigEntry[]>(
    () => parseCodingAssistantsConfig(value) ?? [],
    [value],
  );

  const hidden = useMemo(() => {
    const availableIds = new Set(available.map(a => a.id));
    return ASSISTANT_CATALOG.filter(a => !availableIds.has(a.id));
  }, [available]);

  const emit = (next: CodingAssistantConfigEntry[]) => {
    onChange(JSON.stringify(next));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...available];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    emit(next);
  };

  const moveDown = (index: number) => {
    if (index >= available.length - 1) return;
    const next = [...available];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    emit(next);
  };

  const hide = (index: number) => {
    const next = available.filter((_, i) => i !== index);
    emit(next);
  };

  const show = (id: AssistantId) => {
    if (available.some(a => a.id === id)) return;
    const fallbackTrack = DEFAULT_LEVEL_BY_ASSISTANT[id] ?? 'end-to-end';
    emit([...available, { id, recommended: false, defaultTrack: fallbackTrack }]);
  };

  const toggleRecommended = (index: number) => {
    const next = available.map((entry, i) =>
      i === index ? { ...entry, recommended: !entry.recommended } : entry,
    );
    emit(next);
  };

  const changeDefaultTrack = (index: number, defaultTrack: string) => {
    const next = available.map((entry, i) =>
      i === index ? { ...entry, defaultTrack } : entry,
    );
    emit(next);
  };

  const effectiveDefaultTrack = (entry: CodingAssistantConfigEntry): string =>
    entry.defaultTrack || DEFAULT_LEVEL_BY_ASSISTANT[entry.id] || 'end-to-end';

  const nameFor = (id: string) => ASSISTANT_CATALOG.find(a => a.id === id)?.name ?? id;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Available (visible, ordered) */}
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">Available</h4>
            <span className="text-xs text-muted-foreground">Shown to users · top = first</span>
          </div>
          {available.length === 0 ? (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-md p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>At least one assistant must be visible, otherwise users can't pick one.</span>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {available.map((entry, index) => {
                const currentTrack = effectiveDefaultTrack(entry);
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md bg-background border border-border"
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={entry.recommended}
                        onChange={() => toggleRecommended(index)}
                        className="w-3.5 h-3.5 accent-amber-500"
                        aria-label={`Mark ${nameFor(entry.id)} as recommended`}
                      />
                      <span className="text-xs text-muted-foreground">Rec</span>
                    </label>
                    <span className="flex-1 min-w-[7rem] text-sm text-foreground truncate">{nameFor(entry.id)}</span>
                    {entry.recommended && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-amber-400/10 text-amber-200 border border-amber-400/30"
                        title="Recommended"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        Recommended
                      </span>
                    )}
                    <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={`Default workshop path when ${nameFor(entry.id)} is selected`}>
                      <Map className="w-3 h-3 text-primary/70 shrink-0" />
                      <select
                        value={currentTrack}
                        onChange={(e) => changeDefaultTrack(index, e.target.value)}
                        aria-label={`Default path for ${nameFor(entry.id)}`}
                        className="bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-primary"
                      >
                        {DEFAULT_PATH_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      title="Move up"
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === available.length - 1}
                      title="Move down"
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => hide(index)}
                      title="Hide from users"
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Hidden */}
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">Hidden</h4>
            <span className="text-xs text-muted-foreground">Not shown to users</span>
          </div>
          {hidden.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">All assistants are currently visible.</p>
          ) : (
            <ul className="space-y-1.5">
              {hidden.map(entry => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border border-dashed border-border/70"
                >
                  <button
                    type="button"
                    onClick={() => show(entry.id)}
                    title="Show to users"
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-sm text-muted-foreground truncate">{entry.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip: use the arrows to move assistants between boxes and reorder inside Available. Check the Rec box on any row
        to flag it as recommended, and use the Default Path selector on each row to choose which workshop path is
        automatically selected when a participant picks that coding assistant (Genie Code defaults to Genie Accelerator;
        others default to Complete Workshop).
      </p>
    </div>
  );
}
