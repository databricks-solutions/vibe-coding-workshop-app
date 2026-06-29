import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { SKILLS, type NavSkill } from '../../constants/skillsNavigatorData';
import { typeColor, stripHtml } from './skillsNavUtils';
import { GalaxyMap } from './GalaxyMap';
import { GuidedTours } from './GuidedTours';
import { PlatformAcademy } from './PlatformAcademy';
import { SkillDetailDrawer } from './SkillDetailDrawer';
import './skillsNavigator.css';

type Mode = 'galaxy' | 'tours' | 'academy';

const MODES: { id: Mode; label: string }[] = [
  { id: 'galaxy', label: 'Galaxy Map' },
  { id: 'tours', label: 'Guided Tours' },
  { id: 'academy', label: 'Platform Academy' },
];

interface SkillsNavigatorPageProps {
  /** Opens the mobile sidebar (lives in App). */
  onOpenMobileNav?: () => void;
}

export function SkillsNavigatorPage({ onOpenMobileNav }: SkillsNavigatorPageProps) {
  const [mode, setMode] = useState<Mode>('galaxy');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [requestedModule, setRequestedModule] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo<NavSkill[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SKILLS.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      if (s.desc && stripHtml(s.desc).toLowerCase().includes(q)) return true;
      return false;
    }).slice(0, 30);
  }, [query]);

  // Close search dropdown on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const openSkill = useCallback((id: string) => {
    setActiveSkillId(id);
  }, []);

  const handleResultClick = useCallback((id: string) => {
    setQuery('');
    setSearchOpen(false);
    setActiveSkillId(id);
  }, []);

  const handleLearn = useCallback((platform: string) => {
    setActiveSkillId(null);
    setRequestedModule(platform);
    setMode('academy');
  }, []);

  return (
    <div className="skills-navigator">
      <header className="app-header">
        <button
          onClick={onOpenMobileNav}
          className="sn-hamburger md:hidden"
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1>
          Agent Skills <span>Navigator</span>
        </h1>
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-tab${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="search-box" ref={searchRef}>
          <input
            type="text"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          <div className={`search-results${searchOpen && results.length > 0 ? ' open' : ''}`}>
            {results.map((s) => {
              const tc = typeColor(s.type);
              return (
                <div key={s.id} className="sr-item" onClick={() => handleResultClick(s.id)}>
                  <span className="sr-type" style={{ background: tc.bg, color: tc.fg }}>
                    {s.type}
                  </span>
                  <span>{s.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sn-theme-toggle">
          <ThemeToggle />
        </div>
      </header>

      <div className="sn-body">
        {mode === 'galaxy' && <GalaxyMap onOpenSkill={openSkill} />}
        {mode === 'tours' && <GuidedTours onLearn={handleLearn} />}
        {mode === 'academy' && (
          <PlatformAcademy
            requestedModuleId={requestedModule}
            onModuleConsumed={() => setRequestedModule(null)}
          />
        )}
      </div>

      <SkillDetailDrawer
        skillId={activeSkillId}
        onClose={() => setActiveSkillId(null)}
        onNavigate={(id) => setActiveSkillId(id)}
        onLearn={handleLearn}
      />
    </div>
  );
}

export default SkillsNavigatorPage;
