import { ideaTierFor } from '../../../constants/scoring';
import { TIER_TOKENS } from '../tokens';

/** The idea's tier as a small chip: Spark, Shaped, Investable, Boardroom-ready. */
export function TierBadge({ total, size = 'sm' }: { total: number; size?: 'xs' | 'sm' }) {
  const tier = ideaTierFor(total);
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${TIER_TOKENS[tier.key].chip} ${size === 'xs' ? 'px-1.5 py-px text-ui-3xs' : 'px-2 py-0.5 text-ui-2xs'}`}>
      {tier.label}
    </span>
  );
}
