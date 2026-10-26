import { Fragment, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Pencil, Plus, RotateCcw, Sparkles, Trash2, UserCheck, X } from 'lucide-react';
import { avatarsForList } from '../art';
import type { WorkflowActorKind, WorkflowNode } from '../engine/types';

interface WorkflowPlaybackProps {
  workflow: WorkflowNode[];
  readOnly?: boolean;
  onChange?: (workflow: WorkflowNode[]) => void;
}

const MAX_STEPS = 4;
const MIN_STEPS = 2;
const STEP_BEAT = 0.52;

const KIND_LABELS: { kind: WorkflowActorKind; label: string }[] = [
  { kind: 'persona', label: 'Team role' },
  { kind: 'system', label: 'Automated step' },
  { kind: 'customer', label: 'Customer' },
];

const JARGON_ACTORS = /\b(?:databricks\s+app|ai\/bi\s+dashboard|unity\s+catalog|declarative\s+pipelines?|model\s+serving|data\s+warehouse|lakehouse|lakebase|databricks|dwh|genie(?:\s+space)?|dashboard|app)\b/gi;
const JARGON_ACTIONS = /\s+\b(?:in|on|via|through|inside|using|from)\s+(?:the\s+)?(?:databricks\s+app|ai\/bi\s+dashboard|unity\s+catalog|lakehouse|lakebase|databricks|data\s+warehouse|dwh|genie(?:\s+space)?|app|dashboard)\b/gi;

function cleanActorLabel(actor: string, kind: WorkflowActorKind): string {
  if (kind === 'system' || JARGON_ACTORS.test(actor)) {
    JARGON_ACTORS.lastIndex = 0;
    const stripped = actor.replace(JARGON_ACTORS, '').replace(/^[\s\-–—:/,.]+|[\s\-–—:/,.]+$/g, '').replace(/\s+/g, ' ');
    return stripped || 'Automated alert';
  }
  return actor;
}

function cleanActionText(action: string): string {
  return action
    .replace(JARGON_ACTIONS, '')
    .replace(JARGON_ACTORS, 'the system')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Animated actor-to-customer workflow playback for Step 3 ("A few questions").
 * Flows horizontally in one line and wraps cleanly to a second line when space is tight,
 * with zero arrow overlap and distinct inclusive avatars.
 */
export function WorkflowPlayback({ workflow, readOnly = false, onChange }: WorkflowPlaybackProps) {
  const reduce = useReducedMotion();
  const [playKey, setPlayKey] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<WorkflowNode | null>(null);

  const steps = workflow.slice(0, MAX_STEPS);
  if (steps.length < MIN_STEPS) return null;

  // Assign distinct, non-repeating avatars across all actors in the workflow.
  const avatars = avatarsForList(steps.map(s => cleanActorLabel(s.actor, s.kind)));
  const hasCustomer = steps.some(s => s.kind === 'customer');
  const canEdit = !readOnly && !!onChange;

  const startEdit = (idx: number) => {
    if (!canEdit) return;
    if (editingIdx === idx) {
      setEditingIdx(null);
      setDraft(null);
      return;
    }
    const current = steps[idx];
    setEditingIdx(idx);
    setDraft({
      ...current,
      actor: cleanActorLabel(current.actor, current.kind),
      action: cleanActionText(current.action),
    });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (editingIdx === null || !draft || !onChange) return;
    const actor = draft.actor.trim() || steps[editingIdx].actor;
    const action = draft.action.trim() || steps[editingIdx].action;
    const handoff = editingIdx < steps.length - 1 ? (draft.handoff ?? '').trim() : undefined;
    const next = steps.map((s, i) => (
      i === editingIdx
        ? { ...s, actor, kind: draft.kind, action, ...(handoff ? { handoff } : { handoff: undefined }) }
        : i === steps.length - 1
          ? { ...s, handoff: undefined }
          : s
    ));
    onChange(next);
    setEditingIdx(null);
    setDraft(null);
  };

  const removeStep = (idx: number) => {
    if (!onChange || steps.length <= MIN_STEPS) return;
    const next = steps.filter((_, i) => i !== idx).map((s, i, arr) => (
      i === arr.length - 1 ? { ...s, handoff: undefined } : s
    ));
    onChange(next);
    setEditingIdx(null);
    setDraft(null);
  };

  const addStep = () => {
    if (!onChange || steps.length >= MAX_STEPS) return;
    const newNode: WorkflowNode = {
      id: `step-${steps.length + 1}`,
      actor: hasCustomer ? 'Team lead' : 'Customer',
      kind: hasCustomer ? 'persona' : 'customer',
      action: hasCustomer ? 'Reviews and acts on the update' : 'Receives faster, reliable service',
    };
    const lastIsCustomer = steps[steps.length - 1].kind === 'customer';
    const insertAt = lastIsCustomer ? steps.length - 1 : steps.length;
    const copy = [...steps];
    if (insertAt > 0 && !copy[insertAt - 1].handoff) {
      copy[insertAt - 1] = { ...copy[insertAt - 1], handoff: 'Hands off to' };
    }
    copy.splice(insertAt, 0, newNode);
    const normalized = copy.map((s, i, arr) => (i === arr.length - 1 ? { ...s, handoff: undefined } : s));
    onChange(normalized);
    setEditingIdx(insertAt);
    setDraft({ ...normalized[insertAt] });
  };

  return (
    <section
      aria-label="How the workflow plays out"
      className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5 space-y-4 animate-slide-up-fade"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary">
            How the workflow plays out
          </p>
          {hasCustomer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-ui-2xs font-medium text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-3 h-3" /> Customer impact included
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <span className="hidden sm:inline text-ui-2xs text-muted-foreground">
              Click any step to tweak
            </span>
          )}
          {canEdit && steps.length < MAX_STEPS && (
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Add a step to the workflow"
            >
              <Plus className="w-3 h-3" /> Add step
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlayKey(k => k + 1)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Replay workflow animation"
          >
            <RotateCcw className="w-3 h-3" /> Replay
          </button>
        </div>
      </div>

      {/* Horizontal flow that wraps cleanly onto a second line when needed */}
      <div key={playKey} className="flex flex-wrap items-stretch gap-y-3">
        {steps.map((node, i) => {
          const isLast = i === steps.length - 1;
          const isCustomer = node.kind === 'customer';
          const isSystem = node.kind === 'system';
          const isEditing = editingIdx === i;
          const displayActor = cleanActorLabel(node.actor, node.kind);
          const displayAction = cleanActionText(node.action);
          const displayHandoff = node.handoff ? cleanActionText(node.handoff) : '';
          const nodeDelay = reduce ? 0 : i * STEP_BEAT;
          const lineDelay = reduce ? 0 : i * STEP_BEAT + 0.22;
          const nextIsCustomer = steps[i + 1]?.kind === 'customer';

          return (
            <Fragment key={node.id || i}>
              <motion.button
                type="button"
                disabled={!canEdit}
                onClick={() => startEdit(i)}
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: nodeDelay, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative flex-1 min-w-[195px] sm:min-w-[205px] text-left rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                  isEditing
                    ? 'border-primary bg-primary/[0.07] ring-2 ring-primary/25'
                    : isCustomer
                      ? 'border-emerald-500/40 bg-emerald-500/[0.05] hover:border-emerald-500/60'
                      : isSystem
                        ? 'border-primary/30 bg-primary/[0.03] hover:border-primary/50'
                        : 'border-border/80 bg-card/90 hover:border-primary/40'
                } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-start gap-2.5">
                  {isSystem ? (
                    <span className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-2 ring-primary/20 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </span>
                  ) : (
                    <img
                      src={avatars[i]}
                      alt=""
                      width={32}
                      height={32}
                      className={`w-8 h-8 rounded-full shrink-0 object-cover mt-0.5 ${
                        isCustomer ? 'ring-2 ring-emerald-500/50' : 'ring-2 ring-border'
                      }`}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <span
                      className={`block text-ui-3xs font-semibold uppercase tracking-wider ${
                        isCustomer
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isSystem
                            ? 'text-primary'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {isCustomer ? 'Customer' : isSystem ? 'Automated step' : `Step ${i + 1}`}
                    </span>
                    <p className="text-ui-sm font-semibold text-foreground leading-snug break-words">
                      {displayActor}
                    </p>
                  </div>

                  {canEdit && (
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity mt-0.5" />
                  )}
                </div>

                <p className="text-ui-xs text-muted-foreground mt-2 leading-snug">
                  {displayAction}
                </p>
              </motion.button>

              {!isLast && (
                <div className="shrink-0 flex flex-col items-center justify-center px-2 py-1 select-none" aria-hidden>
                  {displayHandoff && (
                    <motion.span
                      initial={reduce ? false : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: lineDelay + 0.08 }}
                      className={`mb-1 max-w-[115px] text-center leading-tight rounded-full px-2 py-0.5 text-ui-3xs font-medium ${
                        nextIsCustomer
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-secondary/90 text-muted-foreground'
                      }`}
                    >
                      {displayHandoff}
                    </motion.span>
                  )}
                  <svg viewBox="0 0 56 14" className="w-12 h-3.5 overflow-visible">
                    <line
                      x1="2"
                      y1="7"
                      x2="48"
                      y2="7"
                      className="stroke-border/70"
                      strokeWidth="1.5"
                      strokeDasharray="2.5 2.5"
                    />
                    <motion.path
                      d="M 2 7 L 48 7"
                      className={nextIsCustomer ? 'stroke-emerald-500' : 'stroke-primary'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: lineDelay, ease: 'easeOut' }}
                    />
                    <motion.path
                      d="M 43 3 L 50 7 L 43 11"
                      className={nextIsCustomer ? 'stroke-emerald-500' : 'stroke-primary'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.18, delay: lineDelay + 0.22 }}
                    />
                  </svg>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {editingIdx !== null && draft && canEdit && (
        <div className="rounded-xl border border-primary/30 bg-card p-3.5 space-y-3 animate-slide-up-fade">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ui-xs font-semibold text-foreground">
              Edit step {editingIdx + 1} of {steps.length}
            </span>
            <div className="flex items-center gap-1">
              {KIND_LABELS.map(k => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setDraft({ ...draft, kind: k.kind })}
                  className={`px-2 py-0.5 rounded-md text-ui-2xs font-medium transition-colors ${
                    draft.kind === k.kind
                      ? k.kind === 'customer'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                        : 'bg-primary/15 text-primary ring-1 ring-primary/30'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-ui-2xs text-muted-foreground">Who (actor)</span>
              <input
                type="text"
                value={draft.actor}
                maxLength={44}
                onChange={e => setDraft({ ...draft, actor: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                }}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-ui-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="e.g. Store manager"
              />
            </label>

            <label className={`block space-y-1 ${editingIdx < steps.length - 1 ? '' : 'sm:col-span-2'}`}>
              <span className="text-ui-2xs text-muted-foreground">What happens</span>
              <input
                type="text"
                value={draft.action}
                maxLength={110}
                onChange={e => setDraft({ ...draft, action: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                }}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-ui-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Short action taken at this step"
              />
            </label>

            {editingIdx < steps.length - 1 && (
              <label className="block space-y-1">
                <span className="text-ui-2xs text-muted-foreground">Arrow to next step</span>
                <input
                  type="text"
                  value={draft.handoff ?? ''}
                  maxLength={28}
                  onChange={e => setDraft({ ...draft, handoff: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  }}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-ui-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. Clicks approve"
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {steps.length > MIN_STEPS ? (
              <button
                type="button"
                onClick={() => removeStep(editingIdx)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-ui-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove step
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-ui-xs font-medium hover:opacity-90"
              >
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
