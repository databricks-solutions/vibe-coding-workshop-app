import { Lightbulb } from 'lucide-react';
import type { LibraryUseCase } from '../../api/library';
import { UseCaseBadges } from '../provenance/ProvenanceBadges';
import { contributorName, isContributed } from './curation';

/** Who contributed a use case: partner/community chips for contrib/, an Ideate chip for submitted ideas. */
export function ContributedBadge({ uc, compact = false, className = '' }: { uc: LibraryUseCase; compact?: boolean; className?: string }) {
  if (uc.contribution) return <UseCaseBadges provenance={uc.provenance} contribution={uc.contribution} compact={compact} className={className} />;
  if (!isContributed(uc)) return null;
  const name = contributorName(uc);
  const pending = !uc.is_active && (uc.source === 'ideate' || uc.source === 'ideate_pending');
  const label = compact || !name ? (pending ? 'Ideate · review' : 'Ideate') : `Ideate · ${name}`;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span
        className="inline-flex items-center gap-1 max-w-full rounded-full px-2 py-[2px] text-[10.5px] font-semibold tracking-wide ring-1 bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300"
        title={`Contributed through Ideate${uc.created_by ? ` by ${uc.created_by}` : ''}${pending ? ' · awaiting review' : ''}`}
      >
        <Lightbulb className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
    </div>
  );
}
