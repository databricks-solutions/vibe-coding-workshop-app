import { industryTheme, tintStyle } from '../../library/theme';
import '../../library/library.css';

/** The industry as the library shows it: its icon on the collection's tint. */
export function IndustryBadge({ industry, catalogKey = '', size = 'md' }: { industry: string; catalogKey?: string; size?: 'sm' | 'md' }) {
  if (!industry.trim()) return null;
  const { icon: Icon, tint } = industryTheme(catalogKey, industry);
  return (
    <span
      style={tintStyle(tint)}
      className={`lib-soft lib-ink inline-flex items-center gap-1 rounded-full font-medium max-w-full ${size === 'sm' ? 'px-1.5 py-0.5 text-ui-2xs' : 'px-2 py-0.5 text-ui-xs'}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden />
      <span className="truncate">{industry}</span>
    </span>
  );
}
