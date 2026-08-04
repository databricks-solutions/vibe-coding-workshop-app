/**
 * Commit-before-reveal panel for decision steps.
 *
 * Most workshop steps hand the attendee a prompt to copy, which means the coding
 * assistant ends up making every design call for them. A decision step inverts
 * that: the attendee has to commit to a real choice first, only then sees how an
 * experienced practitioner would answer, and their committed values are fed into
 * the prompt so the agent implements *their* design rather than inventing one.
 *
 * The expert answer is fetched from the server at commit time — never shipped with
 * the step content — so it cannot be read ahead of the commitment.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { DiffView } from '../DiffView';
import { MarkdownContent } from '../MarkdownContent';
import { apiClient, type DecisionField, type DecisionValues, type StepConfig } from '../../api/client';

interface DecisionPanelProps {
  sectionTag: string;
  stepConfig: StepConfig;
  industry: string;
  useCase: string;
  sessionId?: string | null;
  stepNumber?: number;
  /** Restored commitment from a previous visit, if any. */
  initialCommitted?: DecisionValues | null;
  /** Fires once the attendee has committed, so the step can enable Done. */
  onCommitted?: (values: DecisionValues) => void;
  readOnly?: boolean;
}

/** Rows for a radio_per_row field, derived from the attendee's own list input. */
function candidateRows(values: DecisionValues, fields: DecisionField[]): string[] {
  const listField = fields.find(f => f.kind === 'list');
  if (!listField) return [];
  const raw = values[listField.key];
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

export function DecisionPanel({
  sectionTag,
  stepConfig,
  industry,
  useCase,
  sessionId,
  stepNumber,
  initialCommitted,
  onCommitted,
  readOnly = false,
}: DecisionPanelProps) {
  const fields = stepConfig.fields ?? [];
  const [values, setValues] = useState<DecisionValues>(initialCommitted ?? {});
  const [committed, setCommitted] = useState<DecisionValues | null>(initialCommitted ?? null);
  const [expertAnswer, setExpertAnswer] = useState('');
  const [revealSource, setRevealSource] = useState<string>('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // Abort an in-flight reveal if the step is collapsed or the page navigates away.
  useEffect(() => () => streamControllerRef.current?.abort(), []);

  // Restore a commitment made in an earlier visit so a refresh doesn't ask the
  // attendee to decide twice. Runs only while still uncommitted in this session.
  useEffect(() => {
    if (!sessionId || committed) return;
    let cancelled = false;

    apiClient.getSessionDecisions(sessionId)
      .then(({ decisions }) => {
        const saved = decisions?.[sectionTag]?.decision;
        if (cancelled || !saved || Object.keys(saved).length === 0) return;
        setValues(saved);
        setCommitted(saved);
        onCommitted?.(saved);
        // Re-fetch the reveal too: a locked panel with no expert answer would look
        // broken. The commitment is already recorded, so re-posting is idempotent.
        return apiClient
          .revealStepExpertAnswer(sectionTag, saved, industry, useCase, sessionId, stepNumber)
          .then(reveal => {
            if (cancelled) return;
            setExpertAnswer(reveal.expert_answer);
            setRevealSource(reveal.source);
          })
          .catch(() => {
            // Leave the panel locked without the comparison rather than erroring.
          });
      })
      .catch(() => {
        // A missing or unreachable session just means nothing to restore.
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sectionTag]);

  const setField = (key: string, value: string | string[]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  /**
   * A field counts as answered only if it clears its own min_chars. Without this a
   * decision step degrades into a button someone taps to see the answer.
   */
  const fieldSatisfied = (field: DecisionField): boolean => {
    const value = values[field.key];
    if (!field.required) return true;

    if (field.kind === 'list') {
      const items = Array.isArray(value) ? value.filter(v => v.trim()) : [];
      return items.length > 0;
    }
    if (field.kind === 'radio_per_row') {
      const rows = candidateRows(values, fields);
      // Nothing to decide yet if the source list is still empty.
      if (rows.length === 0) return true;
      return rows.every(row => !!values[`${field.key}::${row}`]);
    }
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length >= (field.min_chars ?? 1);
  };

  const allSatisfied = fields.every(fieldSatisfied);

  /**
   * Fetch the reveal in one payload. Used when the stream fails, and by static
   * reveals restored from a previous visit.
   */
  const revealViaJson = async () => {
    try {
      const reveal = await apiClient.revealStepExpertAnswer(
        sectionTag,
        values,
        industry,
        useCase,
        sessionId,
        stepNumber
      );
      setExpertAnswer(reveal.expert_answer);
      setRevealSource(reveal.source);
    } catch (err) {
      // Never trap the attendee: the commitment is already recorded, so let them move
      // on even when no expert view could be fetched.
      setError(err instanceof Error ? err.message : 'Could not load the expert view');
    }
  };

  const handleCommit = async () => {
    if (!allSatisfied || isRevealing) return;
    setIsRevealing(true);
    setError(null);

    // Lock the panel immediately. The commitment is recorded server-side before the
    // first token streams, so it is already final — and waiting for the answer to
    // arrive before showing "locked in" would make a fast reveal feel slower than it is.
    setCommitted(values);
    onCommitted?.(values);
    setExpertAnswer('');

    // Stream so the first words land in about a second rather than after ten. The
    // attendee is waiting on this to know whether they are on the right track, which
    // is exactly the case where perceived latency is the whole feature.
    await new Promise<void>(resolve => {
      let receivedAny = false;

      const controller = apiClient.revealStepExpertAnswerStream(
        sectionTag,
        values,
        chunk => {
          receivedAny = true;
          setExpertAnswer(prev => prev + chunk);
        },
        source => {
          if (source) setRevealSource(source);
          setIsRevealing(false);
          resolve();
        },
        async message => {
          // Only fall back when nothing arrived. Retrying after partial output would
          // duplicate text mid-answer.
          if (receivedAny) {
            setError(message);
          } else {
            await revealViaJson();
          }
          setIsRevealing(false);
          resolve();
        },
        industry,
        useCase,
        sessionId,
        stepNumber
      );

      streamControllerRef.current = controller;
    });
  };

  const isLocked = committed !== null;

  /** The prose field worth diffing — the one with the highest min_chars. */
  const diffField = fields
    .filter(f => f.kind === 'text' && (f.min_chars ?? 0) >= 20)
    .sort((a, b) => (b.min_chars ?? 0) - (a.min_chars ?? 0))[0];

  /**
   * A word-level diff only reads well against a comparable statement. Expert answers
   * are often several paragraphs, so pull out the first bolded line (which is where
   * the headline answer lives) and fall back to the opening sentence. If neither is
   * short enough, skip the diff rather than show a wall of churn.
   */
  const comparableExpertText = (() => {
    if (!expertAnswer) return null;
    const bolded = expertAnswer.match(/\*\*(.+?)\*\*/);
    const candidate = bolded
      ? bolded[1]
      : expertAnswer.split(/(?<=[.!?])\s/)[0] ?? '';
    const cleaned = candidate.replace(/[*_`#]/g, '').trim();
    return cleaned && cleaned.length <= 220 ? cleaned : null;
  })();

  const showDiff =
    !!diffField &&
    !!comparableExpertText &&
    typeof committed?.[diffField.key] === 'string';

  return (
    <div className="space-y-4">
      {!isLocked && (
        <div className="flex items-start gap-2 text-ui-sm text-muted-foreground bg-muted/40 border border-border rounded-md p-3">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <span>
            Make your call before you see the recommended answer. Your choices are passed
            to your coding assistant, so this shapes what actually gets built.
          </span>
        </div>
      )}

      {fields.map(field => (
        <DecisionFieldInput
          key={field.key}
          field={field}
          values={values}
          rows={candidateRows(values, fields)}
          disabled={isLocked || readOnly}
          onChange={setField}
        />
      ))}

      {!isLocked && !readOnly && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleCommit}
            disabled={!allSatisfied || isRevealing}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ui-sm font-medium transition-colors ${
              allSatisfied && !isRevealing
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            title={allSatisfied ? 'Lock in your answer' : 'Answer every field first'}
          >
            {isRevealing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isRevealing ? 'Checking…' : 'Commit and compare'}
          </button>
          {!allSatisfied && (
            <span className="text-ui-xs text-muted-foreground">
              Every field needs an answer.
            </span>
          )}
        </div>
      )}

      {isLocked && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-ui-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">Your call is locked in</span>
          </div>

          {error && (
            <p className="text-ui-xs text-amber-400">
              {error}. Your answer was saved — carry on with the step.
            </p>
          )}

          {(expertAnswer || isRevealing) && (
            <div className="border border-primary/30 bg-primary/5 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-ui-sm font-semibold text-primary">
                  How an experienced practitioner would answer
                </h4>
                {isRevealing ? (
                  <span className="flex items-center gap-1 text-ui-2xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    thinking about your answer
                  </span>
                ) : (
                  revealSource === 'llm_generated' && (
                    <span className="text-ui-2xs text-muted-foreground">
                      generated for your schema
                    </span>
                  )
                )}
              </div>

              {/* The diff waits for the full answer: it keys off the first bolded line,
                  which would otherwise churn on every chunk as it streams in. */}
              {!isRevealing && showDiff && diffField && comparableExpertText && (
                <div className="space-y-1">
                  <p className="text-ui-xs text-muted-foreground">
                    Your {diffField.label.toLowerCase()}, compared:
                  </p>
                  <div className="bg-background/60 rounded p-2">
                    <DiffView
                      oldText={String(committed[diffField.key])}
                      newText={comparableExpertText}
                      compact
                    />
                  </div>
                </div>
              )}

              <MarkdownContent content={expertAnswer} maxPreviewLines={14} />

              <p className="text-ui-xs text-muted-foreground">
                Differences are not necessarily mistakes — if you can defend your choice,
                keep it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders one field. Split out to keep the panel readable. */
function DecisionFieldInput({
  field,
  values,
  rows,
  disabled,
  onChange,
}: {
  field: DecisionField;
  values: DecisionValues;
  rows: string[];
  disabled: boolean;
  onChange: (key: string, value: string | string[]) => void;
}) {
  const inputClasses =
    'w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-ui-sm ' +
    'focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60';

  if (field.kind === 'list') {
    const items = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
    const max = field.max_items ?? 5;
    const slots = Array.from({ length: max }, (_, i) => items[i] ?? '');
    const filled = items.filter(v => v.trim()).length;

    // Show a worked example per row where the step supplies one. An empty box
    // numbered "1." tells the attendee nothing about the shape of answer expected,
    // which is the difference between a decision and a guess.
    const examples = (field.placeholder ?? '')
      .split('|')
      .map(e => e.trim())
      .filter(Boolean);

    return (
      <div className="space-y-1.5">
        <label className="block text-ui-sm font-medium">
          {field.label}
          {field.max_items && (
            <span className="ml-1.5 text-ui-xs text-muted-foreground font-normal">
              pick {field.max_items} — {filled}/{field.max_items} chosen, in priority order
            </span>
          )}
        </label>
        {field.hint && (
          <p className="text-ui-xs text-muted-foreground">{field.hint}</p>
        )}
        {slots.map((value, idx) => (
          <input
            key={idx}
            type="text"
            value={value}
            disabled={disabled}
            placeholder={examples[idx] ? `e.g. ${examples[idx]}` : `${idx + 1}.`}
            className={inputClasses}
            onChange={e => {
              const next = [...slots];
              next[idx] = e.target.value;
              onChange(field.key, next);
            }}
          />
        ))}
      </div>
    );
  }

  if (field.kind === 'radio') {
    return (
      <div className="space-y-1.5">
        <label className="block text-ui-sm font-medium">{field.label}</label>
        {field.hint && <p className="text-ui-xs text-muted-foreground">{field.hint}</p>}
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map(option => (
            <button
              key={option}
              disabled={disabled}
              onClick={() => onChange(field.key, option)}
              className={`px-2.5 py-1 rounded-md text-ui-sm border transition-colors disabled:opacity-60 ${
                values[field.key] === option
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background hover:border-primary/50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === 'radio_per_row') {
    if (rows.length === 0) {
      return (
        <p className="text-ui-xs text-muted-foreground italic">
          {field.label} — fill in the list above first.
        </p>
      );
    }
    return (
      <div className="space-y-1.5">
        <label className="block text-ui-sm font-medium">{field.label}</label>
        {field.hint && <p className="text-ui-xs text-muted-foreground">{field.hint}</p>}
        <div className="space-y-1">
          {rows.map(row => (
            <div key={row} className="flex items-center justify-between gap-2">
              <span className="text-ui-sm text-muted-foreground truncate">{row}</span>
              <div className="flex gap-1.5 flex-shrink-0">
                {(field.options ?? []).map(option => (
                  <button
                    key={option}
                    disabled={disabled}
                    onClick={() => onChange(`${field.key}::${row}`, option)}
                    className={`px-2 py-0.5 rounded text-ui-xs border transition-colors disabled:opacity-60 ${
                      values[`${field.key}::${row}`] === option
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Plain prose, with a live count so the minimum never feels arbitrary.
  const text = typeof values[field.key] === 'string' ? (values[field.key] as string) : '';
  const min = field.min_chars ?? 0;
  const short = min > 0 && text.trim().length < min;

  return (
    <div className="space-y-1.5">
      <label className="block text-ui-sm font-medium">{field.label}</label>
      {field.hint && <p className="text-ui-xs text-muted-foreground">{field.hint}</p>}
      <textarea
        value={text}
        disabled={disabled}
        rows={2}
        placeholder={field.placeholder}
        className={inputClasses}
        onChange={e => onChange(field.key, e.target.value)}
      />
      {min > 0 && !disabled && (
        <p className={`text-ui-2xs ${short ? 'text-muted-foreground' : 'text-emerald-400'}`}>
          {short
            ? `${text.trim().length}/${min} characters — be specific enough to act on`
            : 'Specific enough'}
        </p>
      )}
    </div>
  );
}
