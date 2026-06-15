interface CertifiedBadgeProps {
  /** Extra classes appended to the outer element */
  className?: string;
  /** Emblem diameter preset */
  size?: 'sm' | 'md' | 'lg';
  /** Render a "Certified" text label beside the seal (inline/summary contexts) */
  withLabel?: boolean;
}

const SIZE_PX: Record<NonNullable<CertifiedBadgeProps['size']>, number> = {
  sm: 20,
  md: 28,
  lg: 34,
};

/**
 * "Certified" emblem — a gold seal-of-approval rendered as a self-contained SVG
 * (scalloped rosette + ribbon tails + check), modelled on a physical award seal.
 *
 * Designed to sit in the TOP-RIGHT corner of a use-case card. The gold gradient
 * fill keeps it vivid on dark surfaces, while the baked-in darker-gold outline
 * (amber-700) and soft drop-shadow give it definition on light surfaces — so it
 * reads equally well on both black and white backgrounds without relying on
 * theme-flipping `dark:` variants.
 *
 * Gold is deliberately distinct from the emerald used by the "New"/"Selected"
 * states so certification reads as its own thing.
 */
export function CertifiedBadge({
  className = '',
  size = 'md',
  withLabel = false,
}: CertifiedBadgeProps) {
  const px = SIZE_PX[size];

  const seal = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Certified"
      className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
    >
      <title>Certified use case</title>
      <defs>
        <linearGradient id="certSealFill" x1="12" y1="1" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="certRibbon" x1="12" y1="16" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d97706" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>

      {/* Ribbon tails (behind the seal) */}
      <path
        d="M7.5 17 L10.5 18 L9.6 23.2 L8.2 21.4 L6.6 23.2 Z"
        fill="url(#certRibbon)"
        stroke="#92400e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 17 L13.5 18 L14.4 23.2 L15.8 21.4 L17.4 23.2 Z"
        fill="url(#certRibbon)"
        stroke="#92400e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* Scalloped rosette seal */}
      <path
        d="M21.5 10.5 L19.34 12.47 L20.23 15.25 L17.37 15.87 L16.75 18.73 L13.97 17.84 L12 20 L10.03 17.84 L7.25 18.73 L6.63 15.87 L3.77 15.25 L4.66 12.47 L2.5 10.5 L4.66 8.53 L3.77 5.75 L6.63 5.13 L7.25 2.27 L10.03 3.16 L12 1 L13.97 3.16 L16.75 2.27 L17.37 5.13 L20.23 5.75 L19.34 8.53 Z"
        fill="url(#certSealFill)"
        stroke="#b45309"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Inner ring for the seal */}
      <circle cx="12" cy="10.5" r="6.6" fill="none" stroke="#fff8e1" strokeOpacity="0.55" strokeWidth="0.7" />

      {/* Check mark */}
      <path
        d="M8.2 10.7 L10.8 13.3 L15.8 7.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!withLabel) {
    return <span className={`inline-flex ${className}`}>{seal}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {seal}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Certified
      </span>
    </span>
  );
}
