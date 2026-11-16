import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, FileCode2, FolderArchive, Plus, ShieldCheck, X } from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { buildDlcAssets, type DlcAssetKey } from '../engine/dlcAssets';
import { slugOf } from '../engine/handoff';
import { buildZipBlob } from '../engine/zip';
import type { Idea } from '../engine/types';

interface DlcAssetsModalProps {
  idea: Idea;
  open: boolean;
  readOnly?: boolean;
  onClose: () => void;
  /** Optional inline constraint editor hook; updates Spark constraints before export. */
  onUpdateConstraints?: (constraints: string[]) => void;
}

const SUGGESTED_CONSTRAINTS = [
  'No new PII in app session',
  'Existing SSO auth only',
  'Human approval before action',
  'Certified Unity Catalog data only',
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DlcAssetsModal({ idea, open, readOnly = false, onClose, onUpdateConstraints }: DlcAssetsModalProps) {
  useEscapeKey(open, onClose);
  const [activeTab, setActiveTab] = useState<DlcAssetKey>('intent.md');
  const [newConstraint, setNewConstraint] = useState('');
  const { copied, handleCopy } = useCopyToClipboard();

  const assets = useMemo(() => buildDlcAssets(idea), [idea]);
  const active = assets.find(a => a.name === activeTab) ?? assets[0];
  const sparkConstraints = idea.spark?.constraints ?? [];

  if (!open) return null;

  const addConstraint = (text: string) => {
    const clean = text.trim();
    if (!clean || !onUpdateConstraints) return;
    if (sparkConstraints.some(c => c.toLowerCase() === clean.toLowerCase())) return;
    onUpdateConstraints([...sparkConstraints, clean]);
    setNewConstraint('');
  };

  const removeConstraint = (item: string) => {
    if (!onUpdateConstraints) return;
    onUpdateConstraints(sparkConstraints.filter(c => c !== item));
  };

  const downloadZip = () => {
    const slug = slugOf(idea.title || 'idea').replace(/_/g, '-');
    const blob = buildZipBlob(assets.map(a => ({ name: `${slug}/${a.name}`, content: a.content })));
    triggerDownload(blob, `${slug}-ai-dlc-pack.zip`);
  };

  const downloadSingle = () => {
    const mime = active.name.endsWith('.json') ? 'application/json' : 'text/markdown';
    triggerDownload(new Blob([active.content], { type: mime }), active.name);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlc-assets-title"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-in"
        onMouseDown={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border bg-primary/[0.04]">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wider text-primary">
              <FileCode2 className="w-3.5 h-3.5" /> AI-DLC Starter Pack
            </p>
            <h2 id="dlc-assets-title" className="text-ui-xl font-semibold text-foreground mt-1 truncate">
              {idea.title}
            </h2>
            <p className="text-ui-sm text-muted-foreground mt-0.5">
              Drop these files into your project repo so Cursor, Claude Code, or Genie Code respects your intent, constraints, and evals.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {!readOnly && onUpdateConstraints && (
          <div className="px-6 py-3.5 border-b border-border bg-secondary/20 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wider text-foreground/80">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Tune hard constraints before export
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CONSTRAINTS.filter(s => !sparkConstraints.some(c => c.toLowerCase() === s.toLowerCase())).slice(0, 3).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addConstraint(s)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-primary/40 text-ui-2xs font-medium text-primary hover:bg-primary/10"
                  >
                    <Plus className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {sparkConstraints.map(c => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 py-0.5 text-ui-xs text-foreground">
                  {c}
                  <button
                    type="button"
                    onClick={() => removeConstraint(c)}
                    aria-label={`Remove constraint ${c}`}
                    className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <form
                className="inline-flex items-center gap-1.5"
                onSubmit={e => {
                  e.preventDefault();
                  addConstraint(newConstraint);
                }}
              >
                <input
                  value={newConstraint}
                  onChange={e => setNewConstraint(e.target.value)}
                  placeholder="Add constraint…"
                  aria-label="Add constraint"
                  className="h-7 w-44 rounded-full border border-border bg-card px-2.5 text-ui-xs outline-none focus:border-primary/50"
                />
                {newConstraint.trim() && (
                  <button type="submit" className="h-7 px-2.5 rounded-full bg-primary text-primary-foreground text-ui-xs font-medium hover:opacity-90">
                    Add
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        <div className="px-6 pt-3 border-b border-border flex flex-wrap items-center gap-1.5 bg-card">
          {assets.map(asset => {
            const isActive = asset.name === active.name;
            return (
              <button
                key={asset.name}
                type="button"
                onClick={() => setActiveTab(asset.name)}
                className={`px-3 py-2 rounded-t-xl text-ui-sm font-mono font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary bg-primary/[0.04]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                {asset.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3 bg-background/40">
          <p className="text-ui-xs text-muted-foreground">{active.summary}</p>
          <pre className="rounded-2xl border border-border bg-card p-4 text-ui-xs font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
            {active.content}
          </pre>
        </div>

        <footer className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-border bg-card">
          <button
            type="button"
            onClick={() => handleCopy(active.content)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary/60"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied file' : `Copy ${active.name}`}
          </button>
          <button
            type="button"
            onClick={downloadSingle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-ui-sm font-medium text-foreground hover:bg-secondary/60"
          >
            <Download className="w-4 h-4" /> Download {active.name}
          </button>
          <button
            type="button"
            onClick={downloadZip}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.99]"
          >
            <FolderArchive className="w-4 h-4" /> Download Starter Pack (.zip)
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
