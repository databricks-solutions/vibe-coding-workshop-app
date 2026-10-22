import { ExternalLink, FileSpreadsheet, FileText, Link2, Play, Presentation, Video } from 'lucide-react';
import { resourcePresentation, type SupportingResource } from './supportingResource';

export function SupportingResourceCard({
  resource,
  compact = false,
}: {
  resource: SupportingResource | null | undefined;
  compact?: boolean;
}) {
  if (!resource) return null;
  const presentation = resourcePresentation(resource);
  if (!presentation) return null;

  const Icon = presentation.kind === 'google_doc'
    ? FileText
    : presentation.kind === 'google_sheet'
      ? FileSpreadsheet
      : presentation.kind === 'google_slide'
        ? Presentation
        : presentation.kind === 'youtube'
          ? Play
          : presentation.kind === 'video'
            ? Video
            : Link2;

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${presentation.title} · ${presentation.provider}`}
      className={`group flex overflow-hidden rounded-2xl border border-border bg-background/45 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        compact ? 'min-h-[4.5rem]' : 'min-h-[5.5rem]'
      }`}
    >
      <span className={`relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-primary/12 via-primary/[0.055] to-sky-500/10 ${compact ? 'w-24' : 'w-32 sm:w-36'}`}>
        {presentation.thumbnailUrl ? (
          <>
            <img src={presentation.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 bg-black/10" />
            <span className="absolute grid h-9 w-9 place-items-center rounded-full bg-white/95 text-red-600 shadow-lg">
              <Play className="h-4 w-4 translate-x-px fill-current" />
            </span>
          </>
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-card/90 text-primary shadow-sm ring-1 ring-border/60">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">Supporting resource</span>
          <span className="mt-0.5 block truncate text-ui-sm font-semibold text-foreground">{presentation.title}</span>
          <span className="mt-0.5 block truncate text-ui-xs text-muted-foreground">{presentation.provider} · {presentation.hostname}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </span>
    </a>
  );
}
