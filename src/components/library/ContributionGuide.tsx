import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, FileCode2, GitPullRequest, RefreshCw } from 'lucide-react';
import { contribApi, type ContribStatus } from '../../api/contrib';
import { BTN_PRIMARY, BTN_SECONDARY } from '../skills/uiStyles';

const COMMANDS = [
  'python scripts/contrib/new_contributor.py --id your_id --type partner --name "Your Name"',
  'python scripts/contrib/new_usecase.py --contributor your_id --slug your_use_case',
  'python scripts/contrib/validate.py',
];

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background/70 ring-1 ring-border px-2.5 py-2">
      <code className="flex-1 min-w-0 truncate font-mono text-ui-2xs text-foreground">{command}</code>
      <button type="button" onClick={() => void copy()} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Copy command">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function SourceLink({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
      {children}<ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
}

export function ContributionGuide({ onCatalogReload }: { onCatalogReload: () => Promise<void> }) {
  const [status, setStatus] = useState<ContribStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await contribApi.status());
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'Could not load contribution status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const reload = async () => {
    setReloading(true);
    try {
      const next = await contribApi.reload();
      setStatus(next);
      setError(null);
      await onCatalogReload();
    } catch (e) {
      setError((e as Error).message || 'Could not reload contributions.');
    } finally {
      setReloading(false);
    }
  };

  const issues = [...(status?.errors || []), ...(status?.warnings || [])];
  const loadedAt = status?.loaded_at
    ? new Date(status.loaded_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not loaded yet';

  return (
    <section className="rounded-2xl ring-1 ring-teal-500/25 bg-gradient-to-br from-teal-500/[0.08] via-card to-card overflow-hidden">
      <div className="grid xl:grid-cols-[1.15fr_0.85fr]">
        <div className="p-5 border-b xl:border-b-0 xl:border-r border-border/70">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300 inline-flex items-center justify-center shrink-0">
              <GitPullRequest className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-ui-lg font-semibold text-foreground">Contribute through the repository</h2>
              <p className="mt-1 text-ui-sm text-muted-foreground max-w-2xl">
                Partner content is reviewed, validated and versioned as files. It cannot be created or edited in this UI.
              </p>
            </div>
          </div>

          <ol className="mt-5 grid sm:grid-cols-2 gap-3 text-ui-sm">
            {[
              ['1', 'Register once', 'Add your contributor profile and logo under contrib/contributors/.'],
              ['2', 'Create or update files', 'Work under contrib/usecases/ and increase the semantic version for updates.'],
              ['3', 'Validate locally', 'Run the same validation that the pull-request check runs.'],
              ['4', 'Open a pull request', 'Sign off the commit. A maintainer reviews and merges it before deployment.'],
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 text-ui-xs font-semibold inline-flex items-center justify-center shrink-0">{n}</span>
                <div><div className="font-semibold text-foreground">{title}</div><div className="text-ui-xs text-muted-foreground mt-0.5">{body}</div></div>
              </li>
            ))}
          </ol>

          <div className="mt-5 space-y-2">{COMMANDS.map(command => <CopyCommand key={command} command={command} />)}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SourceLink href={status?.guide_url}><FileCode2 className="w-4 h-4" />Full contributor guide</SourceLink>
            <SourceLink href={status?.sample_url}>View the sample</SourceLink>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h3 className="text-ui-sm font-semibold text-foreground">Deployed catalog</h3>
              <p className="text-ui-xs text-muted-foreground mt-0.5">Reload only re-reads files already synced into this app. It does not pull a GitHub branch.</p>
            </div>
            <button className={BTN_PRIMARY} disabled={reloading} onClick={() => void reload()}>
              <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />{reloading ? 'Reloading…' : 'Reload deployed files'}
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-background/60 ring-1 ring-border p-3">
            {loading ? (
              <div className="text-ui-xs text-muted-foreground">Loading catalog status…</div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-ui-sm">
                  {status?.errors.length ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  <span className="font-medium text-foreground">{status?.use_cases ?? 0} use case{status?.use_cases === 1 ? '' : 's'}</span>
                  <span className="text-muted-foreground">from {status?.contributors ?? 0} contributor{status?.contributors === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-1 text-ui-2xs text-muted-foreground">Last loaded {loadedAt}</div>
              </>
            )}
          </div>

          {error && <div className="mt-3 rounded-lg bg-red-500/10 ring-1 ring-red-500/25 px-3 py-2 text-ui-xs text-red-600 dark:text-red-300">{error}</div>}
          {issues.length > 0 && (
            <div className="mt-3">
              <h4 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">Validation issues</h4>
              <ul className="mt-2 space-y-2">
                {issues.slice(0, 4).map(issue => (
                  <li key={`${issue.path}-${issue.message}`} className="text-ui-xs">
                    <code className="font-mono text-amber-600 dark:text-amber-300">{issue.path}</code>
                    <div className="text-muted-foreground mt-0.5">{issue.message}</div>
                  </li>
                ))}
              </ul>
              {issues.length > 4 && <div className="mt-2 text-ui-2xs text-muted-foreground">And {issues.length - 4} more issue{issues.length - 4 === 1 ? '' : 's'}.</div>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
