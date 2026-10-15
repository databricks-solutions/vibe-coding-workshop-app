import { useState, type ReactNode } from 'react';

export function Thinking({ label, image, art, helper }: { label: string; image?: string; art?: ReactNode; helper?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4 animate-fade-in" role="status">
      {art ? (
        art
      ) : image && !imageFailed ? (
        <img
          src={image}
          alt=""
          width={128}
          height={128}
          onError={() => setImageFailed(true)}
          className="w-32 h-32 rounded-3xl object-cover ring-1 ring-border/60 animate-pulse [animation-duration:2.4s] motion-reduce:animate-none"
        />
      ) : (
        <span className="relative w-24 h-24 rounded-3xl border border-primary/20 bg-primary/[0.06] flex items-center justify-center">
          <span className="w-9 h-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin motion-reduce:animate-none" />
        </span>
      )}
      <div className="text-center space-y-1">
        <p className="text-ui-md text-foreground font-medium">{label}<span className="loading-dots-inline">...</span></p>
        {helper && <p className="text-ui-sm text-muted-foreground max-w-md">{helper}</p>}
      </div>
    </div>
  );
}
