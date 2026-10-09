/**
 * AppSidebar - left navigation shared by the desktop rail and the mobile drawer.
 *
 * Layout: brand header, Workshop and Admin groups, a pinned Resources group,
 * and a footer with connection status, version, and the collapse toggle.
 */

import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  ChevronDown,
  Compass,
  Lightbulb,
  List,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Rocket,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { BetaChip, SidebarNavItem, SidebarSectionLabel } from './SidebarNavItem';

export interface SidebarBrand {
  company_name?: string;
  logo_url?: string;
}

interface AppSidebarProps {
  variant: 'desktop' | 'mobile';
  brand: SidebarBrand | null;
  sessionId: string | null;
  /** Desktop only. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Mobile only: close the drawer (X button and after navigating). */
  onClose?: () => void;
  showConfigHint?: boolean;
  onDismissConfigHint?: () => void;
}

const WorkflowIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const ConfigIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const GithubIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const DocsIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IdeaIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

function BrandMark({ brand }: { brand: SidebarBrand | null }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {brand?.logo_url ? (
        <img
          src={brand.logo_url}
          alt=""
          className="w-full h-full object-contain"
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.removeAttribute('style'); }}
        />
      ) : null}
      <Zap className="w-4 h-4 text-white" style={brand?.logo_url ? { display: 'none' } : undefined} />
    </div>
  );
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors flex-shrink-0"
      aria-label={label}
      title={label}
    >
      {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
    </button>
  );
}

function ConfigHint({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <Link
      to="/config"
      className="absolute right-1 top-1/2 -translate-y-1/2 animate-bounce-horizontal flex items-center cursor-pointer z-20"
      onClick={onDismiss}
      title="Configure prompts here!"
    >
      <div className="bg-primary rounded-full p-0.5 animate-pulse-glow">
        <svg className="w-4 h-4 text-primary-foreground transform rotate-180" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </div>
    </Link>
  );
}

export function AppSidebar({
  variant,
  brand,
  sessionId,
  collapsed: collapsedProp = false,
  onToggleCollapsed,
  onClose,
  showConfigHint = false,
  onDismissConfigHint,
}: AppSidebarProps) {
  const location = useLocation();
  const path = location.pathname;
  const isMobile = variant === 'mobile';
  const collapsed = !isMobile && collapsedProp;
  const onNavigate = isMobile ? onClose : undefined;

  const isHackathons = path.startsWith('/hackathons');
  // Open by default on hackathon routes until the user toggles it.
  const [hackathonsToggled, setHackathonsToggled] = useState<boolean | null>(null);
  const hackathonsExpanded = hackathonsToggled ?? isHackathons;

  const item = (props: {
    to: string;
    icon: ReactNode;
    label: string;
    active: boolean;
    badge?: ReactNode;
    trailing?: ReactNode;
  }) => <SidebarNavItem {...props} collapsed={collapsed} onClick={onNavigate} />;

  const subLink = (to: string, icon: ReactNode, label: string, active: boolean) => (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-2 h-8 px-2.5 rounded-md text-ui-sm transition-colors duration-150 ${
        active ? 'text-sidebar-primary font-medium' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
      }`}
    >
      <span className="flex-shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );

  const brandName = brand?.company_name || 'V2V: Vibe-to-Value';

  return (
    <aside
      className={
        isMobile
          ? 'relative w-60 h-full bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-left'
          : `hidden md:flex sticky top-0 h-screen ${collapsed ? 'w-14' : 'w-60'} bg-sidebar border-r border-sidebar-border flex-col flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden`
      }
    >
      {/* Brand */}
      <div
        className={`${collapsed ? 'px-2 py-3 flex-col justify-center' : 'pl-4 pr-2 h-16'} flex items-center gap-2 border-b border-sidebar-border flex-shrink-0`}
      >
        <Link
          to="/"
          onClick={onNavigate}
          title={brandName}
          className={`flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-2.5 flex-1'}`}
        >
          <BrandMark brand={brand} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-sidebar-foreground text-ui-md tracking-tight truncate leading-tight">{brandName}</p>
              <p className="text-ui-xs text-muted-foreground truncate leading-tight mt-0.5">Vibe Coding Workshop</p>
            </div>
          )}
        </Link>
        {!isMobile && onToggleCollapsed && (
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
        )}
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main navigation */}
      <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-1.5' : 'px-2.5'} pb-3`}>
        <SidebarSectionLabel label="Workshop" collapsed={collapsed} />
        <div className="space-y-0.5">
          {item({ to: sessionId ? `/?sessionId=${sessionId}` : '/', icon: WorkflowIcon, label: 'Workflow', active: path === '/' })}
          {item({ to: '/leaderboard', icon: <Trophy />, label: 'Leaderboard', active: path === '/leaderboard' })}
          {item({ to: '/skills', icon: <Compass />, label: 'Agent Skills Navigator', active: path === '/skills' })}
          {item({
            to: '/hackathons',
            icon: <Award />,
            label: 'Hackathons',
            active: isHackathons,
            badge: <BetaChip />,
            trailing: isMobile ? undefined : (
              <button
                type="button"
                onClick={() => setHackathonsToggled(!hackathonsExpanded)}
                className="p-1 rounded hover:bg-sidebar-accent/60 transition-colors"
                aria-label={hackathonsExpanded ? 'Collapse Hackathons' : 'Expand Hackathons'}
                aria-expanded={hackathonsExpanded}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${hackathonsExpanded ? 'rotate-180' : ''}`} />
              </button>
            ),
          })}
          {!isMobile && !collapsed && hackathonsExpanded && (
            <div className="ml-4 pl-2 border-l border-sidebar-border space-y-0.5">
              {subLink('/hackathons', <List />, 'All Hackathons', path === '/hackathons')}
              {subLink('/hackathons?create=1', <Plus />, 'Create Hackathon', false)}
              {subLink('/hackathons/playbook', <BookOpen />, 'Playbook', path === '/hackathons/playbook')}
            </div>
          )}
          {item({ to: '/ideate', icon: <Lightbulb />, label: 'Ideate', active: path === '/ideate' || path.startsWith('/ideate/'), badge: <BetaChip /> })}
        </div>

        <SidebarSectionLabel label="Admin" collapsed={collapsed} />
        <div className="space-y-0.5">
          {item({ to: '/analytics', icon: <BarChart3 />, label: 'Analytics', active: path === '/analytics' })}
          <div className="relative">
            {item({ to: '/config', icon: ConfigIcon, label: 'Configuration', active: path.startsWith('/config') })}
            {showConfigHint && !collapsed && !isMobile && <ConfigHint onDismiss={onDismissConfigHint} />}
          </div>
        </div>
      </nav>

      {/* Resources */}
      <div className={`${collapsed ? 'px-1.5' : 'px-2.5'} py-2 border-t border-sidebar-border flex-shrink-0`}>
        {!collapsed && (
          <p className="px-2.5 pt-1 pb-1 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">Resources</p>
        )}
        <div className="space-y-0.5">
          {!collapsed && (
            <>
              <SidebarNavItem size="sm" href="https://github.com/databricks-solutions/vibe-coding-workshop-template" icon={GithubIcon} label="Repository template" />
              <SidebarNavItem size="sm" href="https://docs.databricks.com" icon={DocsIcon} label="Databricks Docs" />
              <SidebarNavItem size="sm" href="https://github.com/databricks-solutions/vibe-coding-workshop-app/issues/new" icon={IdeaIcon} label="Submit Feature Request" />
            </>
          )}
          <SidebarNavItem
            size="sm"
            to="/release-notes"
            icon={<Rocket />}
            label="Release Notes"
            active={path === '/release-notes'}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={`${collapsed ? 'px-1.5 justify-center' : 'pl-4 pr-2 justify-between'} h-11 flex items-center gap-2 border-t border-sidebar-border flex-shrink-0`}>
        {!collapsed && (
          <div className="flex items-center gap-1.5 min-w-0 text-ui-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Connected</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground/80 tabular-nums">v{__APP_VERSION__}</span>
          </div>
        )}
        {!isMobile && onToggleCollapsed && (
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
        )}
      </div>
    </aside>
  );
}
