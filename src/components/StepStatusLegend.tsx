import { Check, Circle, SkipForward } from 'lucide-react';

export function StepStatusLegend() {
  return (
    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-2 h-2 text-white" strokeWidth={3} />
        </div>
        <span>Done</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded-full bg-amber-500/30 flex items-center justify-center">
          <SkipForward className="w-2 h-2 text-amber-400" />
        </div>
        <span>Skipped</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded-full bg-primary/30 border border-primary/50" />
        <span>Active</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Circle className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span>Pending</span>
      </div>
    </div>
  );
}
