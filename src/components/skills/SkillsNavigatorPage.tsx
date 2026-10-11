import { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, GraduationCap, LayoutGrid, Map as MapIcon, Menu, Route, Search } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import type { TourId } from '../../constants/skillsNavigatorData';
import { GalaxyMap } from './GalaxyMap';
import { GuidedTours } from './GuidedTours';
import { PlatformAcademy } from './PlatformAcademy';
import { SkillLibrary } from './SkillLibrary';
import { SkillDetailDrawer } from './SkillDetailDrawer';
import { SearchPalette } from './SearchPalette';
import { useNavigatorParams } from './useNavigatorParams';
import { VIEW_HINTS, pushRecent, type TrackId, type View } from './navModel';
import { cx } from './uiStyles';
import './skillsNavigator.css';

const VIEWS: { id: View; label: string; icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'tours', label: 'Tours', icon: Route },
  { id: 'skills', label: 'Skills', icon: LayoutGrid },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
];

interface SkillsNavigatorPageProps {
  /** Opens the mobile sidebar (lives in App). */
  onOpenMobileNav?: () => void;
}

export function SkillsNavigatorPage({ onOpenMobileNav }: SkillsNavigatorPageProps) {
  const nav = useNavigatorParams();
  const { update } = nav;
  const [searchOpen, setSearchOpen] = useState(false);
  const [stack, setStack] = useState<string[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setView = useCallback((view: View, filter?: string) => {
    update({ view, skill: null, ...(filter !== undefined ? { filter } : {}) });
  }, [update]);

  const openSkill = useCallback((id: string) => {
    pushRecent(id);
    setStack([]);
    update({ skill: id });
  }, [update]);

  const navigateInDrawer = useCallback((id: string) => {
    pushRecent(id);
    if (nav.skill) setStack((s) => [...s, nav.skill!]);
    update({ skill: id }, { replace: true });
  }, [nav.skill, update]);

  const drawerBack = useCallback(() => {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    if (prev) update({ skill: prev }, { replace: true });
  }, [stack, update]);

  const closeDrawer = useCallback(() => {
    setStack([]);
    update({ skill: null });
  }, [update]);

  const openModule = useCallback((id: string | null) => {
    setStack([]);
    update({ view: 'learn', module: id, skill: null });
  }, [update]);

  const openTour = useCallback((tour: TourId | null, step = 0) => {
    setStack([]);
    update({ view: 'tours', tour, step: tour ? step : null, skill: null });
  }, [update]);

  const onStep = useCallback((step: number) => update({ step }, { replace: true }), [update]);
  const onToggleTrack = useCallback((track: TrackId | null) => update({ track }, { replace: true }), [update]);
  const onFilter = useCallback((filter: string | null) => update({ filter }, { replace: true }), [update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      const el = e.target as HTMLElement;
      if (e.key === '/' && !el?.closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    e.stopPropagation();
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length;
    setView(VIEWS[n].id);
    tabRefs.current[n]?.focus();
  };

  return (
    <div className="skills-navigator flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 pt-3 md:px-6">
          <button onClick={onOpenMobileNav} className="md:hidden -ml-2 p-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-lg shadow-primary/30 shrink-0">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-ui-xl font-bold tracking-tight text-foreground">Agent Skills Navigator</h1>
            <p className="truncate text-ui-xs text-muted-foreground">{VIEW_HINTS[nav.view]}</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:min-w-[200px]"
            aria-label="Search skills, tours, and lessons"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline flex-1 text-left">Search</span>
            <kbd className="hidden md:inline rounded border border-border px-1.5 text-ui-2xs">⌘K</kbd>
          </button>
          <ThemeToggle />
        </div>
        <div className="px-4 pb-3 pt-3 md:px-6">
          <div role="tablist" aria-label="Navigator views" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
            {VIEWS.map((v, i) => {
              const active = nav.view === v.id;
              return (
                <button
                  key={v.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setView(v.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-ui-sm font-medium whitespace-nowrap transition-colors',
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <v.icon className={cx('w-4 h-4', active && 'text-primary')} />
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1" role="tabpanel" aria-label={VIEWS.find((v) => v.id === nav.view)?.label}>
        {nav.view === 'map' && (
          <GalaxyMap
            openTrack={nav.track}
            onToggleTrack={onToggleTrack}
            onOpenSkill={openSkill}
            onStartTour={(t) => openTour(t)}
            onGo={setView}
          />
        )}
        {nav.view === 'tours' && (
          <GuidedTours tourId={nav.tour} step={nav.step} onSelectTour={(t) => openTour(t)} onStep={onStep} onLearn={openModule} />
        )}
        {nav.view === 'skills' && <SkillLibrary filter={nav.filter} onFilter={onFilter} onOpenSkill={openSkill} />}
        {nav.view === 'learn' && <PlatformAcademy moduleId={nav.module} onOpenModule={openModule} onOpenSkill={openSkill} />}
      </main>

      <SkillDetailDrawer
        skillId={nav.skill}
        backTo={stack[stack.length - 1] ?? null}
        onBack={drawerBack}
        onClose={closeDrawer}
        onNavigate={navigateInDrawer}
        onLearn={openModule}
        onOpenTour={(t, s) => openTour(t, s)}
      />

      {searchOpen && (
        <SearchPalette
          onClose={() => setSearchOpen(false)}
          onSkill={openSkill}
          onTour={(t) => openTour(t)}
          onModule={openModule}
        />
      )}
    </div>
  );
}

export default SkillsNavigatorPage;
