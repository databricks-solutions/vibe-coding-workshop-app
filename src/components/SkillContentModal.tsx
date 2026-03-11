import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import type { SkillItem, SkillType } from '../constants/skillTreeMapping';

const REPO_BASE = 'https://raw.githubusercontent.com/databricks-solutions/vibe-coding-workshop-template/main';
const GITHUB_BASE = 'https://github.com/databricks-solutions/vibe-coding-workshop-template/blob/main';

const contentCache = new Map<string, string>();

const TYPE_COLORS: Record<SkillType, { badge: string; border: string }> = {
  entry:          { badge: 'bg-cyan-500/20 text-cyan-300',    border: 'border-cyan-500/30' },
  router:         { badge: 'bg-cyan-500/20 text-cyan-300',    border: 'border-cyan-500/30' },
  orchestrator:   { badge: 'bg-purple-500/20 text-purple-300', border: 'border-purple-500/30' },
  worker:         { badge: 'bg-amber-500/20 text-amber-300',   border: 'border-amber-500/30' },
  common:         { badge: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/30' },
  admin:          { badge: 'bg-slate-500/20 text-slate-300',   border: 'border-slate-500/30' },
  'agent-prompt': { badge: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/30' },
  reference:      { badge: 'bg-orange-500/20 text-orange-300', border: 'border-orange-500/30' },
  manifest:       { badge: 'bg-amber-500/20 text-amber-300',   border: 'border-amber-500/30' },
  input:          { badge: 'bg-amber-500/20 text-amber-300',   border: 'border-amber-500/30' },
};

const TYPE_LABELS: Record<SkillType, string> = {
  entry: 'Entry', router: 'Router', orchestrator: 'Orchestrator',
  worker: 'Worker', common: 'Common', admin: 'Admin',
  'agent-prompt': 'Agent Prompt', reference: 'Reference',
  manifest: 'Manifest', input: 'Input',
};

function resolveRawUrl(shortPath: string, type: SkillType): string | null {
  if (type === 'input' || type === 'manifest') return null;

  if (shortPath === 'AGENTS.md') return `${REPO_BASE}/AGENTS.md`;
  if (shortPath === 'data_product_accelerator/AGENTS.md') return `${REPO_BASE}/data_product_accelerator/AGENTS.md`;

  if (type === 'agent-prompt') return `${REPO_BASE}/vibe-coding-workshop-template/${shortPath}`;

  if (type === 'reference' && shortPath.endsWith('.md')) {
    return `${REPO_BASE}/data_product_accelerator/skills/${shortPath}`;
  }

  return `${REPO_BASE}/data_product_accelerator/skills/${shortPath}/SKILL.md`;
}

function resolveGitHubUrl(shortPath: string, type: SkillType): string | null {
  if (type === 'input' || type === 'manifest') return null;

  if (shortPath === 'AGENTS.md') return `${GITHUB_BASE}/AGENTS.md`;
  if (shortPath === 'data_product_accelerator/AGENTS.md') return `${GITHUB_BASE}/data_product_accelerator/AGENTS.md`;

  if (type === 'agent-prompt') return `${GITHUB_BASE}/vibe-coding-workshop-template/${shortPath}`;

  if (type === 'reference' && shortPath.endsWith('.md')) {
    return `${GITHUB_BASE}/data_product_accelerator/skills/${shortPath}`;
  }

  return `${GITHUB_BASE}/data_product_accelerator/skills/${shortPath}/SKILL.md`;
}

interface SkillContentModalProps {
  skill: SkillItem;
  onClose: () => void;
}

export function SkillContentModal({ skill, onClose }: SkillContentModalProps) {
  const [content, setContent] = useState<string | null>(contentCache.get(skill.shortPath) ?? null);
  const [loading, setLoading] = useState(!contentCache.has(skill.shortPath));
  const [error, setError] = useState<string | null>(null);

  const rawUrl = resolveRawUrl(skill.shortPath, skill.type);
  const githubUrl = resolveGitHubUrl(skill.shortPath, skill.type);
  const colors = TYPE_COLORS[skill.type];

  const fetchContent = useCallback(async () => {
    if (!rawUrl) {
      setError('This file type cannot be previewed.');
      setLoading(false);
      return;
    }
    if (contentCache.has(skill.shortPath)) {
      setContent(contentCache.get(skill.shortPath)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      contentCache.set(skill.shortPath, text);
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill content');
    } finally {
      setLoading(false);
    }
  }, [rawUrl, skill.shortPath]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, width: '100vw', height: '100vh' }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/85"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

      <div
        className="relative bg-card border border-border rounded-lg shadow-2xl flex flex-col"
        style={{ width: 'calc(100vw - 64px)', height: 'calc(100vh - 64px)', maxWidth: '960px', zIndex: 100000 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${colors.border} bg-secondary/30`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge} flex-shrink-0`}>
              {TYPE_LABELS[skill.type]}
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-foreground truncate">{skill.name}</h3>
              <p className="text-[11px] text-muted-foreground/60 font-mono truncate">{skill.shortPath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-3 h-3" />
                GitHub
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[13px]">Loading skill content...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="text-[13px] text-red-400">{error}</span>
              <button
                onClick={fetchContent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {content && !loading && (
            <div className="max-w-none">
              <MarkdownContent content={content} maxPreviewLines={1000} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
          <span className="text-[11px] text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">Esc</kbd> to close
          </span>
          {content && (
            <span className="text-[11px] text-muted-foreground">
              {content.split('\n').length} lines
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Returns true if the skill type supports content viewing.
 */
export function isSkillViewable(type: SkillType): boolean {
  return type !== 'input' && type !== 'manifest';
}
