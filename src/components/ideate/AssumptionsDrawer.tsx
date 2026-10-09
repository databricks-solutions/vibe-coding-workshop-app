import { Check, HelpCircle, Undo2, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { STEPS, type Assumption } from './types';

interface AssumptionsDrawerProps {
  open: boolean;
  onClose: () => void;
  assumptions: Assumption[];
  onSet: (id: string, status: Assumption['status']) => void;
}

/**
 * AI-DLC rule: anything the AI inferred is labeled, and the human either accepts
 * it (it stays an assumption, not a fact) or turns it into an open question.
 */
export function AssumptionsDrawer({ open, onClose, assumptions, onSet }: AssumptionsDrawerProps) {
  useEscapeKey(open, onClose);
  if (!open) return null;

  const open_ = assumptions.filter(a => a.status === 'open');
  const settled = assumptions.filter(a => a.status !== 'open');

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-ui-md font-semibold text-foreground">Assumptions</h2>
            <p className="text-ui-xs text-muted-foreground">Things the AI inferred that you didn't say.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {open_.length === 0 && settled.length === 0 && (
            <p className="text-ui-sm text-muted-foreground">Nothing assumed yet.</p>
          )}

          {open_.length > 0 && (
            <section className="space-y-2">
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-amber-400">Needs your call</p>
              {open_.map((a, i) => (
                <div key={a.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 animate-cascade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <p className="text-ui-sm text-foreground">{a.text}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button onClick={() => onSet(a.id, 'accepted')} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-ui-xs font-medium hover:bg-emerald-500/25">
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button onClick={() => onSet(a.id, 'question')} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-ui-xs font-medium hover:text-foreground">
                      <HelpCircle className="w-3 h-3" /> Make it an open question
                    </button>
                    <span className="ml-auto text-ui-2xs text-muted-foreground/70">{STEPS.find(s => s.key === a.step)?.label}</span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {settled.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">Settled</p>
              {settled.map(a => (
                <div key={a.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 group">
                  {a.status === 'accepted'
                    ? <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                    : <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-sky-400 shrink-0" />}
                  <p className="flex-1 text-ui-sm text-muted-foreground">{a.text}</p>
                  <button onClick={() => onSet(a.id, 'open')} title="Undo" className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground">
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
