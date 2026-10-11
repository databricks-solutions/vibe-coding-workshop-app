import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { SKILLS, type NavSkill } from '../../constants/skillsNavigatorData';
import {
  NEW_SKILLS,
  TRACKS,
  TRACK_MAP,
  canCopyPrompt,
  isNewSkill,
  placeOf,
  plainText,
  summaryOf,
  tint,
  typeInfo,
  type TrackId,
} from './navModel';
import { CopyButton, NewBadge } from './ui';
import { BTN_GHOST, BTN_SECONDARY, cx } from './uiStyles';

interface SkillLibraryProps {
  filter: string | null;
  onFilter: (filter: string | null) => void;
  onOpenSkill: (id: string) => void;
}

const TYPES = ['orchestrator', 'worker', 'common'] as const;

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-ui-sm font-medium whitespace-nowrap transition-colors',
        active ? 'border-primary bg-primary/12 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
      )}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function SkillCard({ skill, onOpen }: { skill: NavSkill; onOpen: () => void }) {
  const info = typeInfo(skill.type);
  const place = placeOf(skill);
  return (
    <div className="group relative rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all">
      <button type="button" onClick={onOpen} className="block w-full p-4 pr-11 text-left">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: info.color }} title={info.label} />
          <span className="text-ui-md font-semibold text-foreground leading-snug">{skill.name}</span>
          {isNewSkill(skill.id) && <NewBadge />}
        </span>
        <span className="mt-1 block text-ui-sm text-muted-foreground line-clamp-2">{summaryOf(skill)}</span>
        <span className="mt-2 block text-ui-xs text-muted-foreground/80">
          {info.label}
          {place ? ` · ${place}` : ''}
        </span>
      </button>
      {canCopyPrompt(skill) && (
        <CopyButton
          text={skill.prompt!}
          variant="icon"
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        />
      )}
    </div>
  );
}

/** Skills library: every skill, filterable, grouped by track. */
export function SkillLibrary({ filter, onFilter, onOpenSkill }: SkillLibraryProps) {
  const [q, setQ] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [promptOnly, setPromptOnly] = useState(false);

  const trackFilter = filter && TRACK_MAP[filter as TrackId] ? (filter as TrackId) : null;
  const newOnly = filter === 'new';
  const extraCount = types.size + (promptOnly ? 1 : 0);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (s: NavSkill) =>
      (!trackFilter || s.component === trackFilter) &&
      (!newOnly || NEW_SKILLS.has(s.id)) &&
      (!types.size || types.has(s.type)) &&
      (!promptOnly || canCopyPrompt(s)) &&
      (!term ||
        s.name.toLowerCase().includes(term) ||
        s.keywords?.some((k) => k.toLowerCase().includes(term)) ||
        plainText(s.desc).toLowerCase().includes(term));
    return TRACKS.map((t) => ({ track: t, skills: SKILLS.filter((s) => s.component === t.id && match(s)) })).filter((g) => g.skills.length);
  }, [q, trackFilter, newOnly, types, promptOnly]);

  const total = groups.reduce((n, g) => n + g.skills.length, 0);
  const anyFilter = !!(q || filter || extraCount);
  const clearAll = () => {
    setQ('');
    setTypes(new Set());
    setPromptOnly(false);
    onFilter(null);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter skills by name, task, or keyword"
                aria-label="Filter skills"
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-ui-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </label>
            <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className={BTN_SECONDARY}>
              <SlidersHorizontal className="w-4 h-4" />
              More filters
              {extraCount > 0 && <span className="rounded-full bg-primary px-1.5 text-ui-2xs font-semibold text-primary-foreground">{extraCount}</span>}
            </button>
          </div>

          <div className="sn-scroll-x flex gap-2 overflow-x-auto pb-1">
            <Chip active={!filter} onClick={() => onFilter(null)}>
              All
            </Chip>
            {NEW_SKILLS.size > 0 && (
              <Chip active={newOnly} onClick={() => onFilter(newOnly ? null : 'new')}>
                New
              </Chip>
            )}
            {TRACKS.map((t) => (
              <Chip key={t.id} active={trackFilter === t.id} onClick={() => onFilter(trackFilter === t.id ? null : t.id)} color={t.color}>
                {t.label}
              </Chip>
            ))}
          </div>

          {moreOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 animate-fade-in">
              <span className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Type</span>
              {TYPES.map((t) => (
                <Chip
                  key={t}
                  active={types.has(t)}
                  color={typeInfo(t).color}
                  onClick={() =>
                    setTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                >
                  {typeInfo(t).label}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              <Chip active={promptOnly} onClick={() => setPromptOnly((p) => !p)}>
                Has a ready prompt
              </Chip>
            </div>
          )}

          <div className="flex items-center gap-2 text-ui-sm text-muted-foreground">
            <span>
              {total} {total === 1 ? 'skill' : 'skills'}
            </span>
            {anyFilter && (
              <button type="button" onClick={clearAll} className={cx(BTN_GHOST, 'px-1.5 py-0.5')}>
                <X className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {total === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-ui-md font-semibold text-foreground">No skills match these filters</p>
            <p className="mt-1 text-ui-sm text-muted-foreground">Try a broader word, or clear the filters to see everything.</p>
            <button type="button" onClick={clearAll} className={cx(BTN_SECONDARY, 'mt-4')}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {groups.map(({ track, skills }) => (
              <section key={track.id} aria-label={track.label}>
                <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur" style={tint(track.color)}>
                  <track.icon className="sn-tint-text w-4 h-4" />
                  <h3 className="text-ui-md font-semibold text-foreground">{track.label}</h3>
                  <span className="text-ui-sm text-muted-foreground">{skills.length}</span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {skills.map((s) => (
                    <SkillCard key={s.id} skill={s} onOpen={() => onOpenSkill(s.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
