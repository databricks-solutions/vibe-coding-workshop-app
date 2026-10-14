import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, GraduationCap, Wrench } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { ACCELERATOR_SKILLS } from '../journey';
import { MarkdownContent } from '../../MarkdownContent';

interface UnderTheHoodProps {
  tag: string;
  /** Skills Navigator id of the Genie Accelerator skill behind this step. */
  skill?: string;
  industry: string;
  useCase: string;
  sessionId: string | null;
  prompt: string;
}

/** Everything the Technical view shows for a step, folded away by default. */
export function UnderTheHood({ tag, skill, industry, useCase, sessionId, prompt }: UnderTheHoodProps) {
  const skillName = skill ? ACCELERATOR_SKILLS[skill] : undefined;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'instructions' | 'how'>('instructions');
  const [howTo, setHowTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open || howTo !== null) return;
    let cancelled = false;
    apiClient.getSectionMetadata(tag, industry, useCase, sessionId)
      .then(meta => { if (!cancelled) setHowTo(meta.how_to_apply || ''); })
      .catch(() => { if (!cancelled) setHowTo(''); });
    return () => { cancelled = true; };
  }, [open, howTo, tag, industry, useCase, sessionId]);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-6 sm:px-8 py-3.5 text-ui-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Wrench className="w-3.5 h-3.5" />
        Under the hood
        <span className="text-muted-foreground/60 font-normal">for the curious</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-6 sm:px-8 pb-6 space-y-3">
              {skill && skillName && (
                <a
                  href={`/skills?skill=${encodeURIComponent(skill)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-ui-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Follows the Genie Accelerator skill <span className="font-medium text-foreground/85">{skillName}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
              <div className="inline-flex p-0.5 rounded-lg bg-secondary/60">
                {(['instructions', 'how'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`h-7 px-3 rounded-md text-ui-xs font-medium transition-colors ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {t === 'instructions' ? 'Full instructions' : 'Technical notes'}
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-secondary/30 border border-border/60 p-4">
                {tab === 'instructions' ? (
                  prompt
                    ? <MarkdownContent content={prompt} maxPreviewLines={14} />
                    : <p className="text-ui-sm text-muted-foreground">Prepare your instructions first, then you can read them here.</p>
                ) : howTo === null ? (
                  <p className="text-ui-sm text-muted-foreground">Loading…</p>
                ) : howTo ? (
                  <MarkdownContent content={howTo} maxPreviewLines={14} />
                ) : (
                  <p className="text-ui-sm text-muted-foreground">No extra notes for this step.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
