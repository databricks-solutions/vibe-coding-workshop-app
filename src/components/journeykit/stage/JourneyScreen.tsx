import type { ReactNode } from 'react';

interface JourneyScreenProps {
  /** Optional row above the progress, e.g. a back link and title. */
  header?: ReactNode;
  /** Left of the top row, usually JourneyProgress. */
  progress?: ReactNode;
  /** Right of the top row: compact tools such as Compare paths or the clarity ring. */
  tools?: ReactNode;
  /** Pin the top rows while scrolling (used where the screen owns its scroll area). */
  sticky?: boolean;
  /** `wide` gives explorers like the industry model room. */
  width?: 'default' | 'wide';
  children: ReactNode;
}

const WIDTH = { default: 'max-w-4xl', wide: 'max-w-5xl' };

/** The frame every guided screen shares: progress row, then the screen's header, body and ActionBar. */
export function JourneyScreen({ header, progress, tools, sticky = false, width = 'default', children }: JourneyScreenProps) {
  const column = `${WIDTH[width]} mx-auto`;
  const rows = (header || progress || tools) && (
    <div className={`${column} ${sticky ? 'py-3 space-y-2.5' : 'px-1 pt-6 sm:pt-10 pb-2 space-y-4'}`}>
      {header}
      {(progress || tools) && (
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">{progress}</div>
          {tools && <div className="flex items-center gap-2 shrink-0">{tools}</div>}
        </div>
      )}
    </div>
  );
  return (
    <div>
      {rows && (sticky
        ? <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60 px-5">{rows}</div>
        : rows)}
      <div className={`${column} ${sticky ? 'px-5 py-8' : 'px-1 py-6'} space-y-8`}>{children}</div>
    </div>
  );
}
