export function Thinking({ label, image }: { label: string; image?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4 animate-fade-in" role="status">
      {image ? (
        <img src={image} alt="" width={128} height={128} className="w-32 h-32 rounded-3xl object-cover ring-1 ring-border/60 animate-pulse [animation-duration:2.4s]" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-primary/30 animate-pulse" />
      )}
      <p className="text-ui-md text-muted-foreground">{label}<span className="loading-dots-inline">...</span></p>
    </div>
  );
}
