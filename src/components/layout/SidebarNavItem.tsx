import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SidebarNavItemProps {
  /** Internal route; renders a react-router Link. */
  to?: string;
  /** External URL; opens in a new tab. */
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  /** Inline chip after the label (e.g. Beta). Hidden when collapsed. */
  badge?: ReactNode;
  /** Right-aligned control rendered outside the link (e.g. an expand chevron). Hidden when collapsed. */
  trailing?: ReactNode;
  /** 'sm' is the quieter style used for the bottom Resources group. */
  size?: 'md' | 'sm';
}

export function SidebarNavItem({
  to,
  href,
  onClick,
  icon,
  label,
  active = false,
  collapsed = false,
  badge,
  trailing,
  size = 'md',
}: SidebarNavItemProps) {
  const sizing = size === 'sm' ? 'h-8 text-ui-sm' : 'h-9 text-ui-base font-medium';
  const layout = collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5';
  const tone = active
    ? 'bg-sidebar-accent text-sidebar-primary [&_svg]:text-primary'
    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground';
  const iconBox = size === 'sm'
    ? 'flex-shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5'
    : 'flex-shrink-0 [&_svg]:w-4 [&_svg]:h-4';

  const content = (
    <>
      <span className={`${iconBox} flex items-center justify-center`} aria-hidden="true">{icon}</span>
      {!collapsed && (
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{label}</span>
          {badge}
        </span>
      )}
    </>
  );

  const linkClass = `relative flex flex-1 min-w-0 items-center ${layout} ${sizing} rounded-md transition-colors duration-150`;
  const activeBar = active && !collapsed && (
    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" aria-hidden="true" />
  );

  let element: ReactNode;
  if (href) {
    element = (
      <a href={href} target="_blank" rel="noopener noreferrer" title={label} onClick={onClick} className={linkClass}>
        {content}
      </a>
    );
  } else if (to) {
    element = (
      <Link to={to} title={label} onClick={onClick} aria-current={active ? 'page' : undefined} className={linkClass}>
        {activeBar}
        {content}
      </Link>
    );
  } else {
    element = (
      <button type="button" title={label} onClick={onClick} className={`${linkClass} text-left`}>
        {content}
      </button>
    );
  }

  return (
    <div className={`flex items-center rounded-md ${tone}`}>
      {element}
      {trailing && !collapsed && <div className="pr-1.5 flex-shrink-0">{trailing}</div>}
    </div>
  );
}

export function SidebarSectionLabel({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="mx-2 my-2 border-t border-sidebar-border" aria-hidden="true" />;
  }
  return (
    <p className="px-2.5 pt-3 pb-1.5 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
    </p>
  );
}

export function BetaChip() {
  return (
    <span className="text-ui-2xs font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/15 rounded px-1 py-0.5 leading-none">
      Beta
    </span>
  );
}
