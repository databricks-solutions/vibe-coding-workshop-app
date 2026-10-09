// Phase 3 T3c: the read-path loading state. When the engine outline
// (GET /api/track/{track}/outline) hasn't resolved yet — or errored and is being
// retried by the poller — the read path renders THIS instead of an empty diagram.
// This is the guardrail-#3 replacement for the old client-side fallback compose:
// never blank the sidebar, never silently re-compose client-side. Purely visual;
// it carries no ordering or membership logic.

const SIDEBAR_ROWS = 6;
const CONTENT_ROWS = 4;

export function WorkflowReadSkeleton() {
  return (
    <div
      className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px] p-4 animate-pulse"
      role="status"
      aria-label="Loading workshop outline"
    >
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-64 flex-shrink-0 h-full flex-col bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="h-4 w-32 rounded bg-secondary" />
          <div className="mt-3 h-2 w-full rounded-full bg-secondary" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          {Array.from({ length: SIDEBAR_ROWS }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-2.5 w-16 rounded bg-secondary" />
                <div className="h-3 w-3/4 rounded bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 min-w-0 h-full">
        <div className="h-full bg-card rounded-xl border border-border p-6 space-y-6 overflow-hidden">
          {Array.from({ length: CONTENT_ROWS }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-48 rounded bg-secondary" />
              <div className="h-24 w-full rounded-lg bg-secondary/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
