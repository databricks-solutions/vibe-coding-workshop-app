import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, CornerDownLeft, Route, Search } from 'lucide-react';
import { ACADEMY, SKILLS, SKILL_MAP, type TourId } from '../../constants/skillsNavigatorData';
import { TOUR_LIST, plainText, readStore, summaryOf, tint, trackOf, typeInfo } from './navModel';
import { cx } from './uiStyles';

type Result =
  | { kind: 'skill'; id: string; title: string; sub: string; color: string }
  | { kind: 'tour'; id: TourId; title: string; sub: string; color: string }
  | { kind: 'module'; id: string; title: string; sub: string; color: string };

const GROUP_LABEL: Record<Result['kind'], string> = { skill: 'Skills', tour: 'Tours', module: 'Lessons' };

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-primary/20 text-foreground rounded-sm">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const skillResult = (id: string): Result => {
  const s = SKILL_MAP[id];
  return { kind: 'skill', id, title: s.name, sub: trackOf(s)?.label ?? typeInfo(s.type).label, color: typeInfo(s.type).color };
};

/** Command-style search. Mount only while open so each opening starts fresh. */
export function SearchPalette({
  onClose,
  onSkill,
  onTour,
  onModule,
}: {
  onClose: () => void;
  onSkill: (id: string) => void;
  onTour: (id: TourId) => void;
  onModule: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => restore?.focus?.();
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      const recent = readStore<string[]>('recent', []).filter((id) => SKILL_MAP[id]).map(skillResult);
      const tours = TOUR_LIST.slice(0, 3).map<Result>((t) => ({ kind: 'tour', id: t.id, title: `Tour ${t.id.toUpperCase()}: ${t.title}`, sub: t.outcome, color: t.color }));
      return [...recent, ...tours];
    }
    const skills = SKILLS.map((s) => {
      const name = s.name.toLowerCase();
      let score = 0;
      if (name.startsWith(term)) score = 4;
      else if (name.includes(term)) score = 3;
      else if (s.keywords?.some((k) => k.toLowerCase().includes(term))) score = 2;
      else if (plainText(s.desc).toLowerCase().includes(term)) score = 1;
      return { s, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ s }) => ({ ...skillResult(s.id), sub: summaryOf(s) }));
    const tours = TOUR_LIST.filter((t) => `${t.title} ${t.outcome}`.toLowerCase().includes(term)).map<Result>((t) => ({
      kind: 'tour',
      id: t.id,
      title: `Tour ${t.id.toUpperCase()}: ${t.title}`,
      sub: t.outcome,
      color: t.color,
    }));
    const modules = ACADEMY.filter((m) => `${m.title} ${m.subtitle}`.toLowerCase().includes(term))
      .slice(0, 5)
      .map<Result>((m) => ({ kind: 'module', id: m.id, title: m.title, sub: m.subtitle, color: 'var(--cyan)' }));
    return [...skills, ...tours, ...modules];
  }, [q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: Result) => {
    onClose();
    if (r.kind === 'skill') onSkill(r.id);
    else if (r.kind === 'tour') onTour(r.id);
    else onModule(r.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  let lastKind: string | null = null;
  const emptyQuery = !q.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Search skills, tours, and lessons"
            className="flex-1 bg-transparent py-4 text-ui-base text-foreground placeholder:text-muted-foreground outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="sn-search-results"
            aria-activedescendant={results[active] ? `sn-r-${active}` : undefined}
          />
          <kbd className="hidden sm:inline text-ui-2xs text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listRef} id="sn-search-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-ui-sm text-muted-foreground">No matches for “{q}”. Try a stage, product, or task, like “Genie” or “deploy”.</p>
          )}
          {results.map((r, i) => {
            const header =
              r.kind !== lastKind ? (emptyQuery && r.kind === 'skill' ? 'Recently opened' : emptyQuery && r.kind === 'tour' ? 'Start a tour' : GROUP_LABEL[r.kind]) : null;
            lastKind = r.kind;
            const Icon = r.kind === 'tour' ? Route : r.kind === 'module' ? BookOpen : null;
            return (
              <div key={`${r.kind}-${r.id}`}>
                {header && <p className="px-3 pt-3 pb-1 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</p>}
                <button
                  type="button"
                  id={`sn-r-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cx('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left', i === active ? 'bg-secondary' : 'hover:bg-secondary/60')}
                >
                  {Icon ? (
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-ui-sm font-medium text-foreground truncate">
                      <Highlight text={r.title} q={q.trim()} />
                    </span>
                    <span className="block text-ui-xs text-muted-foreground truncate" style={tint(r.color)}>
                      {r.sub}
                    </span>
                  </span>
                  {i === active && <CornerDownLeft className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
