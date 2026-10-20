import { BadgeCheck, Building2, FlaskConical, Handshake, Home, User, Users, type LucideIcon } from 'lucide-react';
import type { Contribution, ContributorType, Provenance } from '../../api/contrib';

const CHIP = 'inline-flex items-center gap-1 max-w-full rounded-full px-2 py-[2px] text-[10.5px] font-semibold tracking-wide ring-1';

const CONTRIBUTOR_ICON: Record<ContributorType, LucideIcon> = {
  partner: Handshake,
  company: Building2,
  individual: User,
  group: Users,
};

const PROVENANCE_LABEL: Record<Provenance, string> = {
  native: 'Native',
  partner: 'Partner',
  third_party: 'Third-party',
};

const PROVENANCE_STYLE: Record<Provenance, string> = {
  native: 'bg-muted/60 text-muted-foreground ring-border/60',
  partner: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300',
  third_party: 'bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300',
};

/** Where a use case comes from: native, a partner, or a third party (company, individual or group). */
export function ProvenanceBadge({ provenance = 'native', contribution, compact = false }: {
  provenance?: Provenance;
  contribution?: Contribution;
  compact?: boolean;
}) {
  const contributor = contribution?.contributor;
  const Icon = contributor ? CONTRIBUTOR_ICON[contributor.type] : Home;
  const label = PROVENANCE_LABEL[provenance];
  const title = contributor
    ? `${label} contribution by ${contributor.display_name}`
    : 'Native use case maintained with the app';
  return (
    <span className={`${CHIP} ${PROVENANCE_STYLE[provenance]}`} title={title}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {contributor && !compact ? `${label} · ${contributor.display_name}` : label}
      </span>
    </span>
  );
}

/** "Certified by X": certification declared in contrib/certifications for the current version. */
export function ContributorCertifiedBadge({ contribution }: { contribution: Contribution }) {
  const certs = contribution.certifications;
  if (!certs.length) return null;
  const names = certs.map(c => c.by.display_name);
  const shown = names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
  return (
    <span
      className={`${CHIP} bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300`}
      title={`Certified by ${names.join(', ')} for version ${contribution.version}`}
    >
      <BadgeCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="truncate">Certified by {shown}</span>
    </span>
  );
}

export function SampleContributionBadge() {
  return (
    <span
      className={`${CHIP} bg-transparent text-muted-foreground ring-0 border border-dashed border-muted-foreground/50`}
      title="Reference contribution. Clone it to contribute your own."
    >
      <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />
      Sample
    </span>
  );
}

export function DeprecatedBadge() {
  return (
    <span className={`${CHIP} bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300`} title="The contributor has deprecated this use case">
      Deprecated
    </span>
  );
}

/**
 * Provenance row for a use case. Contributed use cases always get their chips;
 * native ones get a muted "Native" chip only when ``showNative`` is set (lists
 * that mix native and contributed use cases).
 */
export function UseCaseBadges({ provenance, contribution, showNative = false, compact = false, className = '' }: {
  provenance?: Provenance;
  contribution?: Contribution;
  showNative?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!contribution) {
    if (!showNative) return null;
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        <ProvenanceBadge provenance="native" />
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {contribution.sample && <SampleContributionBadge />}
      <ProvenanceBadge provenance={provenance ?? contribution.provenance} contribution={contribution} compact={compact} />
      <ContributorCertifiedBadge contribution={contribution} />
      {contribution.status === 'deprecated' && <DeprecatedBadge />}
    </div>
  );
}
