import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, GitCommitHorizontal, Github, Info } from 'lucide-react';
import type { BlueprintSource } from './types';

export const REPO_SHORT = 'databricks-industry-solutions/lakehouse-industry-data-models';

function SourceLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2">
      {children} <ArrowUpRight className="w-3 h-3" />
    </a>
  );
}

/** Every blueprint surface carries this so it is obvious where the model came from. */
export function SourcePill({ source, label, compact = false }: { source: BlueprintSource; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block max-w-full">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border border-border bg-card text-ui-xs text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors max-w-full"
      >
        <Github className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate min-w-0">{compact ? 'Industry Data Models' : REPO_SHORT}</span>
        <span className="shrink-0 font-mono text-[11px] px-1.5 rounded bg-secondary text-foreground/80">{source.shortSha}</span>
        <Info className="w-3 h-3 shrink-0 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 left-0 mt-2 w-[min(92vw,380px)] rounded-2xl border border-border bg-card shadow-xl p-4 space-y-3 text-left"
          >
            <p className="text-ui-sm font-semibold text-foreground">About this source</p>
            <p className="text-ui-sm text-muted-foreground leading-relaxed">
              {label ? <>The <span className="text-foreground font-medium">{label}</span> model</> : 'This model'} is pulled live from the
              open <span className="text-foreground font-medium">Lakehouse Industry Data Models</span> gallery by Databricks Industry Solutions.
              Nothing here was written for this app.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-ui-xs">
              <dt className="text-muted-foreground">Repository</dt>
              <dd className="truncate"><SourceLink href={source.repoUrl}>{REPO_SHORT}</SourceLink></dd>
              {source.path && <>
                <dt className="text-muted-foreground">Folder</dt>
                <dd className="truncate font-mono"><SourceLink href={source.treeUrl}>{source.path}</SourceLink></dd>
              </>}
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="flex items-center gap-1 font-mono"><GitCommitHorizontal className="w-3 h-3 text-muted-foreground" /><SourceLink href={source.commitUrl}>{source.shortSha}</SourceLink></dd>
              {source.generatedAt && <>
                <dt className="text-muted-foreground">Generated</dt>
                <dd className="text-foreground/90">{source.generatedAt}{source.agentVersion ? ` by the model agent v${source.agentVersion}` : ''}</dd>
              </>}
              <dt className="text-muted-foreground">License</dt>
              <dd className="flex flex-wrap gap-x-3"><SourceLink href={source.licenseUrl}>Databricks License</SourceLink><SourceLink href={source.noticeUrl}>Notice</SourceLink></dd>
            </dl>
            <div className="rounded-xl bg-secondary/50 px-3 py-2 text-ui-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/90">What's real, what's sample:</span> table designs, connections, sensitive-field labels
              and KPI definitions come from the model. The rows are realistic generated data until you point it at your own.
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-ui-xs pt-1">
              <SourceLink href={source.galleryUrl}>Open in the gallery</SourceLink>
              <SourceLink href={source.modelUrl}>model.json</SourceLink>
              <SourceLink href={source.dictionaryUrl}>Data dictionary</SourceLink>
            </div>
            <p className="text-[11px] text-muted-foreground/80">{source.noticeText}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SourceFooter({ source }: { source: BlueprintSource }) {
  return (
    <p className="text-ui-xs text-muted-foreground text-center leading-relaxed">
      Data model from{' '}
      <a href={source.repoUrl} target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-primary underline underline-offset-2">{REPO_SHORT}</a>
      {' '}at commit{' '}
      <a href={source.commitUrl} target="_blank" rel="noreferrer" className="font-mono text-foreground/80 hover:text-primary underline underline-offset-2">{source.shortSha}</a>
      . {source.noticeText} Used under the{' '}
      <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-primary underline underline-offset-2">Databricks License</a>.
    </p>
  );
}
