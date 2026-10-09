import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, MessageSquareWarning, PenLine, RefreshCw, Swords, X } from 'lucide-react';
import { VoiceTextarea } from './VoiceTextarea';

interface StepFooterProps {
  canApprove: boolean;
  approveLabel?: string;
  onApprove: () => void;
  onChange: (feedback: string) => void;
  onChallenge: () => void;
  challenging: boolean;
  pushbacks: string[] | null;
  onDismissPushbacks: () => void;
  busy: boolean;
  approved: boolean;
  /** Shown instead of "Looks good" when the step is already approved and not the current step. */
  onContinue?: () => void;
}

/**
 * The AI-DLC gate for every step: approve (Enter), ask for a targeted change
 * (voice or text), or have the AI play reviewer and push back.
 */
export function StepFooter({
  canApprove,
  approveLabel = 'Looks good',
  onApprove,
  onChange,
  onChallenge,
  challenging,
  pushbacks,
  onDismissPushbacks,
  busy,
  approved,
  onContinue,
}: StepFooterProps) {
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
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !editing && !busy) {
        if (approved && onContinue) onContinue();
        else if (canApprove) onApprove();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approved, busy, canApprove, editing, onApprove, onContinue]);

  return (
    <div className="mt-8 space-y-3">
      {pushbacks && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 animate-slide-up-fade">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-1.5 text-ui-xs font-semibold text-violet-300">
              <MessageSquareWarning className="w-3.5 h-3.5" /> A product lead would push back on…
            </p>
            <button onClick={onDismissPushbacks} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
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
            <button onClick={() => { setEditing(false); setFeedback(''); }} className="px-3 py-1.5 text-ui-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button
              onClick={() => submit(feedback)}
              disabled={!feedback.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply change
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40"
          >
            <PenLine className="w-3.5 h-3.5" /> Change something
          </button>
        )}
        <button
          onClick={onChallenge}
          disabled={busy || challenging}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-ui-sm font-medium text-muted-foreground hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-40"
        >
          {challenging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />} Challenge me
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline text-ui-2xs text-muted-foreground/60">Enter ↵</span>
          {approved && onContinue ? (
            <button
              onClick={onContinue}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-foreground text-ui-base font-semibold hover:bg-secondary/80"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onApprove}
              disabled={!canApprove || busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-ui-base font-semibold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none"
            >
              {approveLabel} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
      <div className="relative w-12 h-12">
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <span className="absolute inset-2 rounded-full bg-primary/40 animate-pulse" />
        <span className="absolute inset-4 rounded-full bg-primary" />
      </div>
      <p className="text-ui-md text-muted-foreground">{label}<span className="loading-dots-inline">...</span></p>
    </div>
  );
}
