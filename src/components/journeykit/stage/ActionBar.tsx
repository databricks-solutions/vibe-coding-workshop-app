import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MessageSquareWarning, PenLine, RefreshCw, Swords, X } from 'lucide-react';
import { VoiceTextarea } from '../ui/VoiceTextarea';
import { GhostButton, PrimaryButton, SecondaryButton } from '../ui/primitives';

interface ActionBarProps {
  onBack?: () => void;
  backLabel?: string;
  /** Quiet actions between Back and the primary button. */
  secondary?: ReactNode;
  primaryLabel?: ReactNode;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  /** Small helper line under the bar, e.g. what happens next. */
  note?: ReactNode;
  /** Replaces the primary button, e.g. with "Continue" on an approved step. */
  primary?: ReactNode;
  children?: ReactNode;
}

/** The bottom row of every guided screen: Back left, quiet actions middle, one primary action right. */
export function ActionBar({ onBack, backLabel = 'Back', secondary, primaryLabel, onPrimary, primaryDisabled, note, primary, children }: ActionBarProps) {
  return (
    <div className="mt-8 pt-5 border-t border-border/60 space-y-3">
      {children}
      <div className="flex flex-wrap items-center gap-2">
        {onBack && <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> {backLabel}</GhostButton>}
        {secondary}
        <div className="ml-auto flex items-center gap-3">
          {primary ?? (onPrimary && (
            <PrimaryButton size="lg" onClick={onPrimary} disabled={primaryDisabled}>
              {primaryLabel} <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          ))}
        </div>
      </div>
      {note && <p className="text-ui-sm text-muted-foreground text-right">{note}</p>}
    </div>
  );
}

interface StepActionsProps {
  canApprove: boolean;
  approveLabel: string;
  onApprove: () => void;
  onChange: (feedback: string) => void;
  onChallenge: () => void;
  /** Label for the challenge button, e.g. "Pressure-test" on the numbers. */
  challengeLabel?: string;
  challenging: boolean;
  pushbacks: string[] | null;
  onDismissPushbacks: () => void;
  busy: boolean;
  approved: boolean;
  /** Shown instead of the approve button when the step is already approved and not the current step. */
  onContinue?: () => void;
  onBack?: () => void;
  /** Extra quiet action, e.g. "Skip this step". */
  extra?: ReactNode;
  showKeyHint?: boolean;
}

/**
 * The AI-DLC gate for every idea step, built on ActionBar: approve (Enter),
 * ask for a targeted change (voice or text), or have the AI push back.
 */
export function StepActions({
  canApprove, approveLabel, onApprove, onChange, onChallenge, challengeLabel = 'Challenge me', challenging, pushbacks, onDismissPushbacks, busy, approved, onContinue, onBack, extra, showKeyHint = false,
}: StepActionsProps) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');

  const submit = (text: string) => {
    if (!text.trim()) return;
    onChange(text.trim());
    setFeedback('');
    setEditing(false);
    onDismissPushbacks();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.defaultPrevented || (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'))) return;
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !editing && !busy) {
        if (approved && onContinue) onContinue();
        else if (canApprove) onApprove();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approved, busy, canApprove, editing, onApprove, onContinue]);

  const secondary = !editing && (
    <>
      <GhostButton onClick={() => setEditing(true)} disabled={busy}>
        <PenLine className="w-3.5 h-3.5" /> Change something
      </GhostButton>
      <GhostButton onClick={onChallenge} disabled={busy || challenging} className="hover:!text-violet-400 hover:!bg-violet-500/10">
        {challenging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />} {challengeLabel}
      </GhostButton>
      {extra}
    </>
  );

  const primary = approved && onContinue ? (
    <SecondaryButton onClick={onContinue} className="h-12 px-5 text-ui-lg font-semibold">
      Continue <ArrowRight className="w-4 h-4" />
    </SecondaryButton>
  ) : (
    <>
      {showKeyHint && <span className="hidden sm:inline text-ui-2xs text-muted-foreground/60">Press Enter ↵</span>}
      <PrimaryButton size="lg" onClick={onApprove} disabled={!canApprove || busy}>
        {approveLabel} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );

  return (
    <ActionBar onBack={onBack} secondary={secondary} primary={primary}>
      {pushbacks && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 animate-slide-up-fade">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-1.5 text-ui-xs font-semibold text-violet-500 dark:text-violet-300">
              <MessageSquareWarning className="w-3.5 h-3.5" /> A product lead would push back on…
            </p>
            <button onClick={onDismissPushbacks} aria-label="Dismiss" className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pushbacks.map((p, i) => (
              <button
                key={p}
                onClick={() => submit(p)}
                title="Apply this as feedback"
                className="text-left text-ui-sm px-3 py-1.5 rounded-lg border border-violet-500/25 bg-card hover:border-violet-400 hover:bg-violet-500/10 text-foreground transition-all animate-cascade-in"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-ui-2xs text-muted-foreground mt-2">Tap one to apply it.</p>
        </div>
      )}

      {editing && (
        <div className="animate-slide-up-fade">
          <VoiceTextarea
            value={feedback}
            onChange={setFeedback}
            autoFocus
            rows={2}
            placeholder="What should change? Speak or type. Ctrl+Enter to apply."
            onSubmit={() => submit(feedback)}
          />
          <div className="flex justify-end gap-2 mt-2">
            <GhostButton onClick={() => { setEditing(false); setFeedback(''); }}>Cancel</GhostButton>
            <SecondaryButton onClick={() => submit(feedback)} disabled={!feedback.trim()}>
              <RefreshCw className="w-3.5 h-3.5" /> Apply change
            </SecondaryButton>
          </div>
        </div>
      )}
    </ActionBar>
  );
}
