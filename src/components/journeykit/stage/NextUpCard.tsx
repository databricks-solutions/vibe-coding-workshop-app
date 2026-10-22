import { CloudOff, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { welcomeBack } from '../engine/encouragement';
import { useSyncState } from '../engine/useIdeas';
import type { Idea } from '../engine/types';

/** A one-line welcome for someone reopening an idea partway up. */
export function WelcomeBack({ idea }: { idea: Idea }) {
  const [text] = useState(() => welcomeBack(idea));
  const [open, setOpen] = useState(true);
  if (!text || !open) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-2.5 animate-fade-in" role="status">
      <p className="flex-1 text-ui-sm text-foreground"><span className="font-semibold">Welcome back.</span> <span className="text-muted-foreground">{text}</span></p>
      <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Where the idea is saved, in a few quiet words. */
export function SaveStatus() {
  const state = useSyncState();
  if (state === 'idle' || state === 'local') return null;
  const view = {
    saving: { icon: <Loader2 className="w-3 h-3 animate-spin" />, text: 'Saving…', cls: 'text-muted-foreground' },
    saved: { icon: null, text: 'Saved', cls: 'text-muted-foreground/70' },
    offline: { icon: <CloudOff className="w-3 h-3" />, text: 'Offline, will retry', cls: 'text-amber-600 dark:text-amber-400' },
    'storage-full': { icon: <CloudOff className="w-3 h-3" />, text: 'Browser storage full', cls: 'text-amber-600 dark:text-amber-400' },
  }[state];
  return <span className={`hidden sm:inline-flex items-center gap-1 text-ui-2xs ${view.cls}`} role="status">{view.icon}{view.text}</span>;
}
