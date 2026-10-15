import { Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../lib/theme';

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * The app's one appearance control, shown in the left sidebar on every page.
 * Expanded: a Light | Dark segmented switch. Collapsed: one icon button.
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  if (collapsed) {
    const label = `Switch to ${next} mode`;
    const Icon = theme === 'dark' ? Moon : Sun;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        title={label}
        aria-label={label}
        className="w-full h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 h-8 pl-2.5">
      <span className="text-ui-sm text-muted-foreground">Appearance</span>
      <div role="radiogroup" aria-label="Appearance" className="flex items-center p-0.5 rounded-md bg-sidebar-accent/50 border border-sidebar-border">
        {OPTIONS.map(({ id, label, Icon }) => {
          const on = theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(id)}
              title={`${label} mode`}
              className={`flex items-center gap-1 h-6 px-2 rounded text-ui-xs font-medium transition-colors ${
                on ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-muted-foreground hover:text-sidebar-foreground'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${on ? (id === 'light' ? 'text-amber-500' : 'text-blue-400') : ''}`} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
