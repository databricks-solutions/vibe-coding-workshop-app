import type { ReactNode, MouseEvent } from 'react';

interface BorderBeamButtonProps {
  /** When true AND not disabled, the orbiting beam animation plays */
  active: boolean;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  children: ReactNode;
  /** Extra classes applied to the inner <button> element */
  className?: string;
}

/**
 * A button wrapped in an orbiting emerald border-beam effect.
 * When `active` is true the beam rotates around the button perimeter;
 * when inactive or disabled the button renders with muted styling and no animation.
 */
export function BorderBeamButton({ active, onClick, disabled = false, children, className = '' }: BorderBeamButtonProps) {
  const showBeam = active && !disabled;

  if (showBeam) {
    return (
      <div className="border-beam-wrapper">
        <button
          onClick={onClick}
          className={`relative z-10 rounded-[calc(0.5rem-2px)] bg-emerald-600 text-white hover:bg-emerald-500 text-[12px] font-medium px-4 py-2 transition-colors ${className}`}
        >
          {children}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[12px] font-medium px-4 py-2 rounded-lg transition-all ${
        disabled
          ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed opacity-50'
          : 'bg-emerald-600 text-white hover:bg-emerald-500'
      } ${className}`}
    >
      {children}
    </button>
  );
}
