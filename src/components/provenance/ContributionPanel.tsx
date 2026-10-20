import { useState, type ReactNode } from 'react';
import { BadgeCheck, Check, ChevronDown, Copy, ExternalLink, GitPullRequest, History } from 'lucide-react';
import type { Contribution, ContributorBrief } from '../../api/contrib';
import { UseCaseBadges } from './ProvenanceBadges';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/60 ring-1 ring-border/50 px-2.5 py-1.5">
      <code className="flex-1 min-w-0 truncate font-mono text-[11.5px] text-foreground/90">{text}</code>
      <CopyButton text={text} label="Copy" />
    </div>
  );
}

function Avatar({ c }: { c: ContributorBrief }) {
  if (c.avatar_url) {
    return <img src={c.avatar_url} alt="" className="w-7 h-7 rounded-md object-cover ring-1 ring-border/60" />;
  }
  return (
    <span className="w-7 h-7 rounded-md grid place-items-center bg-muted text-ui-2xs font-bold text-muted-foreground ring-1 ring-border/60">
      {c.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4">
      {children}
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
    </a>
  );
}

/** How to contribute, shown on the sample: clone it, register, validate, open a pull request. */
export function ContributeCallout({ contribution }: { contribution: Contribution }) {
  return (
    <div className="rounded-xl border border-dashed border-teal-500/40 bg-teal-500/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <GitPullRequest className="w-4 h-4 text-teal-600 dark:text-teal-300" aria-hidden="true" />
        <h5 className="text-ui-sm font-semibold text-foreground">This is a sample. Clone it to contribute your own use case.</h5>
      </div>
      <p className="text-ui-xs text-muted-foreground mb-3">
        Anyone can contribute: a person, a company, a group or a partner. Contributions are files in the repository, reviewed through a
        pull request and versioned with git. Admins switch them on in the Library.
      </p>
      <ol className="space-y-2.5 text-ui-xs text-foreground/90">
        <li>
          <span className="font-semibold">1. Copy this folder as your starting point</span>
          <div className="mt-1"><CodeLine text={contribution.source_path} /></div>
        </li>
        <li>
          <span className="font-semibold">2. Register yourself once</span>
          <div className="mt-1"><CodeLine text={'python scripts/contrib/new_contributor.py --id your_id --type company --name "Your Name"'} /></div>
        </li>
        <li>
          <span className="font-semibold">3. Scaffold your use case from this sample</span>
          <div className="mt-1"><CodeLine text="python scripts/contrib/new_usecase.py --contributor your_id --slug your_use_case" /></div>
        </li>
        <li>
          <span className="font-semibold">4. Validate and open a pull request</span>
          <div className="mt-1"><CodeLine text="python scripts/contrib/validate.py" /></div>
        </li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ui-xs">
        {contribution.guide_url && <ExtLink href={contribution.guide_url}>Contributor guide</ExtLink>}
        {contribution.source_url && <ExtLink href={contribution.source_url}>View the sample on GitHub</ExtLink>}
      </div>
    </div>
  );
}

/** Who contributed a use case, who certified it, its version history and links. */
export function ContributionPanel({ contribution, defaultOpen = false }: { contribution: Contribution; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || contribution.sample);
  const c = contribution;
  const latest = c.changelog[0];

  return (
    <section className="mt-3 rounded-xl border border-border/60 bg-card/70 overflow-hidden" aria-label="Contribution details">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <Avatar c={c.contributor} />
        <div className="flex-1 min-w-0">
          <p className="text-ui-xs text-muted-foreground">
            Contributed by <span className="font-semibold text-foreground">{c.contributor.display_name}</span>
            {c.co_contributors.length > 0 && <> with {c.co_contributors.map(x => x.display_name).join(', ')}</>}
            <span className="text-muted-foreground/70"> · v{c.version}</span>
          </p>
          <UseCaseBadges contribution={c} compact className="mt-1" />
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
          {c.media.cover_url && (
            <img src={c.media.cover_url} alt="" className="w-full max-h-56 object-cover rounded-lg ring-1 ring-border/50" />
          )}
          <p className="text-ui-sm text-foreground/90">{c.summary}</p>

          {c.certifications.length > 0 && (
            <div className="space-y-2">
              <h6 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">Certification</h6>
              {c.certifications.map(cert => (
                <div key={cert.by.id} className="flex gap-2 text-ui-xs">
                  <BadgeCheck className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                  <div>
                    <p>
                      <span className="font-semibold">{cert.by.display_name}</span> certified v{cert.version} on {cert.date}
                    </p>
                    <p className="text-muted-foreground">{cert.notes}</p>
                    {cert.evidence_url && <ExtLink href={cert.evidence_url}>Evidence</ExtLink>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {c.authors.length > 0 && (
            <div>
              <h6 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Authors</h6>
              <p className="text-ui-xs">{c.authors.map(a => a.name).join(', ')}</p>
            </div>
          )}

          {latest && (
            <div>
              <h6 className="flex items-center gap-1 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <History className="w-3 h-3" aria-hidden="true" /> Version history
              </h6>
              <ul className="space-y-1 text-ui-xs">
                {c.changelog.slice(0, 3).map(e => (
                  <li key={e.version}>
                    <span className="font-mono font-semibold">v{e.version}</span>
                    <span className="text-muted-foreground"> · {e.date} · </span>
                    {e.notes}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.media.screenshot_urls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {c.media.screenshot_urls.map(url => (
                <img key={url} src={url} alt="" className="w-full rounded-md ring-1 ring-border/50" />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-ui-xs">
            {c.source_url && <ExtLink href={c.source_url}>Source in the repository</ExtLink>}
            {c.links.filter(l => l.url !== c.guide_url).map(l => <ExtLink key={l.url} href={l.url}>{l.label}</ExtLink>)}
            {c.contributor.website && <ExtLink href={c.contributor.website}>{c.contributor.display_name}</ExtLink>}
            {!c.sample && c.guide_url && <ExtLink href={c.guide_url}>Contribute your own</ExtLink>}
          </div>

          {c.sample && <ContributeCallout contribution={c} />}
        </div>
      )}
    </section>
  );
}
