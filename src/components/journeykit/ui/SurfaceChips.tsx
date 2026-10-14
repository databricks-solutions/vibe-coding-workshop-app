import { AppWindow, Bot, Database, Layers, LayoutDashboard, MessagesSquare, type LucideIcon } from 'lucide-react';
import { SURFACE_JOB, canonicalSurface, type Surface } from '../engine/surfaces';

const SURFACE_ICON: Record<Surface, LucideIcon> = {
  App: AppWindow,
  Agent: Bot,
  Genie: MessagesSquare,
  Dashboard: LayoutDashboard,
  Lakebase: Database,
  Lakehouse: Layers,
};

const TONE: Record<Surface, string> = {
  App: 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/20',
  Agent: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/20',
  Genie: 'text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25',
  Dashboard: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Lakebase: 'text-foreground/80 bg-secondary border-border',
  Lakehouse: 'text-foreground/80 bg-secondary border-border',
};

/** One look for Databricks surfaces everywhere: icon, name, and what it does on hover. */
export function SurfaceChips({ surfaces, size = 'md' }: { surfaces: (Surface | string)[]; size?: 'sm' | 'md' }) {
  const list = surfaces.map(s => canonicalSurface(s)).filter((s, i, a): s is Surface => !!s && a.indexOf(s) === i);
  if (!list.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What you'll build">
      {list.map(s => {
        const Icon = SURFACE_ICON[s];
        return (
          <li
            key={s}
            title={SURFACE_JOB[s]}
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${TONE[s]} ${size === 'sm' ? 'px-1.5 py-0.5 text-ui-2xs' : 'px-2 py-1 text-ui-xs'}`}
          >
            <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden /> {s}
          </li>
        );
      })}
    </ul>
  );
}
