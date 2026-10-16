import { ArrowLeftRight, X } from 'lucide-react';

/** What the background session sync tells the learner (App.syncFromServer). */
export type SessionSyncMessage =
  | { kind: 'updated'; text: string }
  | { kind: 'newer'; sessionId: string; text: string };

/**
 * A quiet notice when this session changed in Genie Code (or another tab), or
 * when Genie Code started a newer session the learner may want to open.
 * Styled like BundleUpdateNotice and stacked above it.
 */
export function SessionSyncNotice({
  message,
  onOpen,
  onDismiss,
}: {
  message: SessionSyncMessage | null;
  onOpen: (sessionId: string) => void;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div
      data-testid="session-sync-notice"
      className="fixed inset-x-4 bottom-24 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-xl backdrop-blur"
      role="status"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ArrowLeftRight className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-semibold text-foreground">
          {message.kind === 'newer' ? 'New session in Genie Code' : 'Updated from Genie Code'}
        </span>
        <span className="block text-ui-xs text-muted-foreground">{message.text}</span>
      </span>
      {message.kind === 'newer' && (
        <button
          onClick={() => onOpen(message.sessionId)}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-ui-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Open
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
