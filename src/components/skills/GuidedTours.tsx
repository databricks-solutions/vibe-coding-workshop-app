import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Route,
} from 'lucide-react';
import { SKILL_MAP, TOURS, type TourId, type TourStep } from '../../constants/skillsNavigatorData';
import { highlightCode } from './skillsNavUtils';
import { NEW_TOURS, TOUR_LIST, plainText, readStore, tint, tourMinutes, typeInfo, writeStore } from './navModel';
import { SkillDetail } from './SkillDetail';
import { Disclosure, Html, NewBadge, Popover, SectionLabel, TypeBadge } from './ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, cx } from './uiStyles';

interface GuidedToursProps {
  tourId: TourId | null;
  step: number;
  onSelectTour: (id: TourId | null) => void;
  onStep: (step: number) => void;
  onLearn: (moduleId: string) => void;
}

const SPEEDS = [
  { label: '0.5x', ms: 4000 },
  { label: '1x', ms: 2000 },
  { label: '1.5x', ms: 1200 },
  { label: '2x', ms: 700 },
];

const useToursDone = () => readStore<string[]>('toursDone', []);

// ------------------------------------------------------------ chooser

function Chooser({ onSelect }: { onSelect: (id: TourId) => void }) {
  const done = new Set(useToursDone());
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <h2 className="text-ui-xl font-semibold text-foreground">Choose a tour</h2>
        <p className="mt-1 text-ui-sm text-muted-foreground">Each tour lights up the path through the skills and explains every step, including why it exists.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="sn-tint-ring group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-shadow"
              style={tint(t.color)}
            >
              <span className="flex w-full items-center gap-2">
                <span className="sn-tint grid place-items-center w-9 h-9 rounded-lg text-ui-md font-bold">{t.id.toUpperCase()}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {NEW_TOURS.has(t.id) && <NewBadge />}
                  {done.has(t.id) && (
                    <span className="inline-flex items-center gap-1 text-ui-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--green)]" /> Done
                    </span>
                  )}
                </span>
              </span>
              <span>
                <span className="block text-ui-lg font-semibold text-foreground">{t.title}</span>
                <span className="mt-1 block text-ui-sm text-muted-foreground">{t.outcome}</span>
              </span>
              <span className="mt-auto flex w-full items-center justify-between text-ui-xs text-muted-foreground">
                <span>
                  {TOURS[t.id].steps.length} steps · about {tourMinutes(t.id)} min
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary opacity-80 group-hover:opacity-100">
                  Start <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ player helpers

function cumulative(steps: TourStep[], target: number) {
  const expanded = new Set<string>();
  const visited = new Set<string>();
  const lit = new Set<string>();
  for (let i = 0; i <= target; i++) {
    steps[i]?.expand?.forEach((id) => expanded.add(id));
    steps[i]?.lit?.forEach((id) => lit.add(id));
    if (i < target) steps[i]?.activate?.forEach((id) => visited.add(id));
  }
  return { expanded, visited, lit, active: steps[target]?.activate ?? [] };
}

type Selection = { kind: 'skill'; id: string } | { kind: 'label'; domId: string; label: string; type: string } | null;

function StepView({ step, onSkill }: { step: TourStep; onSkill: (id: string) => void }) {
  const [more, setMore] = useState(false);
  const skills = (step.skillIds ?? []).map((id) => SKILL_MAP[id]).filter(Boolean);
  const primary = skills[0];
  const rationale = step.designRationale || primary?.rationale;
  const long = plainText(rationale).length > 320 || /<(table|pre|div)/.test(rationale ?? '');
  const stepSkills = skills.length > 1 ? skills : (primary?.workers ?? []).map((id) => SKILL_MAP[id]).filter(Boolean);

  return (
    <div className="animate-fade-in">
      {step.tier && <SectionLabel>{step.tier[1]}</SectionLabel>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-ui-xl font-semibold text-foreground leading-tight">{primary ? primary.name : step.tier?.[1] ?? 'This step'}</h2>
        {primary && <TypeBadge type={primary.type} />}
      </div>

      <div className="mt-4 rounded-xl border border-primary/25 bg-primary/8 p-4">
        <Html html={step.narration} className="text-foreground" />
      </div>

      {rationale && (
        <div className="mt-5">
          <SectionLabel>Why this pattern</SectionLabel>
          <Html html={rationale} className={cx('mt-1.5', long && !more && 'line-clamp-4')} />
          {long && (
            <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 text-ui-sm font-semibold text-primary hover:underline">
              {more ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        {step.inputOutput && (
          <Disclosure title="Inputs and outputs">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {step.inputOutput.inputs.map((x) => (
                  <span key={x} className="sn-tint px-2 py-1 rounded-md text-ui-xs font-medium" style={tint('var(--purple)')}>
                    {x}
                  </span>
                ))}
              </div>
              <ArrowRight className="hidden sm:block w-4 h-4 text-muted-foreground" />
              <div className="flex flex-wrap gap-1.5">
                {step.inputOutput.outputs.map((x) => (
                  <span key={x} className="sn-tint px-2 py-1 rounded-md text-ui-xs font-medium" style={tint('var(--green)')}>
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </Disclosure>
        )}
        {primary?.code && (
          <Disclosure title="Code pattern">
            <div className="sn-code" dangerouslySetInnerHTML={{ __html: highlightCode(primary.code) }} />
          </Disclosure>
        )}
        {stepSkills.length > 0 && (
          <Disclosure title={skills.length > 1 ? 'Skills in this step' : 'Its steps'} count={stepSkills.length}>
            <div className="flex flex-wrap gap-1.5">
              {stepSkills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSkill(s.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-ui-sm text-foreground hover:bg-secondary"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: typeInfo(s.type).color }} />
                  {s.name}
                </button>
              ))}
            </div>
          </Disclosure>
        )}
      </div>

      {primary && (
        <button type="button" onClick={() => onSkill(primary.id)} className={cx(BTN_GHOST, 'mt-3 -ml-2.5 text-primary hover:text-primary')}>
          Open full skill details
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------ player

function Player({ tourId, initialStep, onStep, onExit, onSwitch, onLearn }: {
  tourId: TourId;
  initialStep: number;
  onStep: (step: number) => void;
  onExit: () => void;
  onSwitch: (id: TourId) => void;
  onLearn: (moduleId: string) => void;
}) {
  const tour = TOURS[tourId];
  const meta = TOUR_LIST.find((t) => t.id === tourId)!;
  const steps = tour.steps;
  const last = steps.length - 1;
  const start = Math.min(Math.max(initialStep, 0), last);

  const [stepIdx, setStepIdx] = useState(start);
  const [expanded, setExpanded] = useState<Set<string>>(() => cumulative(steps, start).expanded);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sel, setSel] = useState<Selection>(null);
  const [pane, setPane] = useState<'details' | 'tree'>('details');
  const treeRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const deco = useMemo(() => cumulative(steps, stepIdx), [steps, stepIdx]);
  const step = steps[stepIdx];

  const goTo = useCallback(
    (target: number) => {
      const t = Math.min(Math.max(target, 0), last);
      setStepIdx(t);
      setExpanded(cumulative(steps, t).expanded);
      setSel(null);
      onStep(t);
      if (steps[t]?.summary) {
        const done = readStore<string[]>('toursDone', []);
        if (!done.includes(tourId)) writeStore('toursDone', [...done, tourId]);
      }
    },
    [last, steps, onStep, tourId]
  );

  const next = useCallback(() => goTo(stepIdx + 1), [goTo, stepIdx]);
  const back = useCallback(() => {
    setPlaying(false);
    goTo(stepIdx - 1);
  }, [goTo, stepIdx]);
  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false);
    if (stepIdx >= last) goTo(0);
    setPlaying(true);
  }, [playing, stepIdx, last, goTo]);

  // Autoplay advances one step per tick and stops at the end.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (stepIdx >= last) setPlaying(false);
      else goTo(stepIdx + 1);
    }, SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [playing, stepIdx, last, speed, goTo]);

  // Re-apply tree decorations to the static, trusted tree HTML after every commit.
  useLayoutEffect(() => {
    const t = treeRef.current;
    if (!t) return;
    t.querySelectorAll<HTMLElement>('li[id]').forEach((li) => {
      const chev = li.querySelector<HTMLElement>(':scope > .tnode .chevron');
      if (!chev) return;
      const on = expanded.has(li.id);
      li.classList.toggle('expanded', on);
      li.classList.toggle('collapsed', !on);
      chev.classList.toggle('open', on);
      li.querySelector<HTMLElement>(':scope > .tnode')?.setAttribute('aria-expanded', String(on));
    });
    t.querySelectorAll<HTMLElement>('.tnode').forEach((n) => {
      n.classList.remove('active-node', 'visited', 'user-selected');
      if (!n.hasAttribute('tabindex')) {
        n.tabIndex = 0;
        n.setAttribute('role', 'button');
      }
    });
    deco.visited.forEach((id) => t.querySelector('#' + CSS.escape(id))?.classList.add('visited'));
    deco.active.forEach((id) => {
      const el = t.querySelector('#' + CSS.escape(id));
      el?.classList.remove('visited');
      el?.classList.add('active-node');
    });
    t.querySelectorAll('li.lit').forEach((el) => el.classList.remove('lit'));
    deco.lit.forEach((id) => t.querySelector('#' + CSS.escape(id))?.classList.add('lit'));
    if (sel?.kind === 'skill') t.querySelector(`.tnode[data-skill="${CSS.escape(sel.id)}"]`)?.classList.add('user-selected');
    if (sel?.kind === 'label') t.querySelector('#' + CSS.escape(sel.domId))?.classList.add('user-selected');
  });

  useEffect(() => {
    const id = deco.active[0];
    if (id) treeRef.current?.querySelector('#' + CSS.escape(id))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    detailRef.current?.scrollTo({ top: 0 });
  }, [deco.active]);

  const showSkill = useCallback((skillId: string) => {
    const t = treeRef.current;
    const node = t?.querySelector<HTMLElement>(`.tnode[data-skill="${CSS.escape(skillId)}"]`);
    if (node) {
      const ancestors: string[] = [];
      let li = node.closest('li')?.parentElement?.closest('li') as HTMLElement | null;
      while (li) {
        if (li.id) ancestors.push(li.id);
        li = li.parentElement?.closest('li') as HTMLElement | null;
      }
      if (ancestors.length) setExpanded((p) => new Set([...p, ...ancestors]));
      setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
    setPlaying(false);
    setSel({ kind: 'skill', id: skillId });
    setPane('details');
    detailRef.current?.scrollTo({ top: 0 });
  }, []);

  const activateNode = useCallback(
    (tnode: HTMLElement) => {
      const toggleId = tnode.getAttribute('data-toggle');
      if (toggleId) {
        setExpanded((p) => {
          const n = new Set(p);
          if (n.has(toggleId)) n.delete(toggleId);
          else n.add(toggleId);
          return n;
        });
      }
      const skillId = tnode.getAttribute('data-skill');
      if (skillId && SKILL_MAP[skillId]) {
        setPlaying(false);
        setSel({ kind: 'skill', id: skillId });
      } else if (!toggleId && tnode.id) {
        const type = (Array.from(tnode.classList).find((c) => c.startsWith('type-')) || 'type-node').slice(5);
        setSel({ kind: 'label', domId: tnode.id, label: tnode.querySelector('.name')?.textContent || '', type });
      }
    },
    []
  );

  const onTreeClick = (e: React.MouseEvent) => {
    const tnode = (e.target as HTMLElement).closest('.tnode') as HTMLElement | null;
    if (tnode && treeRef.current?.contains(tnode)) activateNode(tnode);
  };
  const onTreeKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tnode = (e.target as HTMLElement).closest('.tnode') as HTMLElement | null;
    if (!tnode) return;
    e.preventDefault();
    e.stopPropagation();
    activateNode(tnode);
  };

  // Arrow keys step through the tour; P toggles autoplay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[aria-modal="true"]:not([aria-hidden="true"])')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'p' || e.key === 'P') {
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, togglePlay]);

  const allIds = useCallback(() => {
    const ids: string[] = [];
    treeRef.current?.querySelectorAll<HTMLElement>('li[id]').forEach((li) => {
      if (li.querySelector(':scope > .tnode .chevron')) ids.push(li.id);
    });
    return ids;
  }, []);

  const doneSet = new Set(readStore<string[]>('toursDone', []));
  const nextTour = TOUR_LIST.find((t) => t.id !== tourId && !doneSet.has(t.id)) ?? TOUR_LIST.find((t) => t.id !== tourId);
  const selSkill = sel?.kind === 'skill' ? SKILL_MAP[sel.id] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border bg-card/60 px-4 md:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" onClick={onExit} className={cx(BTN_GHOST, '-ml-2.5')} title="All tours">
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">All tours</span>
          </button>
          <span className="sn-tint grid place-items-center w-7 h-7 rounded-lg text-ui-sm font-bold" style={tint(meta.color)}>
            {tourId.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-ui-md font-semibold text-foreground">{meta.title}</p>
            <p className="text-ui-xs text-muted-foreground">
              Step {stepIdx + 1} of {steps.length}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={back} disabled={stepIdx === 0} className={cx(BTN_SECONDARY, 'px-2.5')} aria-label="Previous step">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Back</span>
            </button>
            <button type="button" onClick={togglePlay} className={cx(BTN_SECONDARY, 'px-2.5')} aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => { setPlaying(false); next(); }} disabled={stepIdx >= last} className={BTN_PRIMARY}>
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
            <Popover label="More tour options" align="right" trigger={<MoreHorizontal className="w-4 h-4" />}>
              {(close) => (
                <div className="space-y-3">
                  <div>
                    <SectionLabel>Autoplay speed</SectionLabel>
                    <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-secondary p-1" role="radiogroup" aria-label="Autoplay speed">
                      {SPEEDS.map((s, i) => (
                        <button
                          key={s.label}
                          type="button"
                          role="radio"
                          aria-checked={speed === i}
                          onClick={() => setSpeed(i)}
                          className={cx('rounded-md py-1 text-ui-xs font-semibold', speed === i ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-0.5 border-t border-border pt-2">
                    <button type="button" className={cx(BTN_GHOST, 'w-full justify-start')} onClick={() => { setExpanded(new Set(allIds())); close(); }}>
                      <ChevronsUpDown className="w-4 h-4" /> Expand the whole tree
                    </button>
                    <button type="button" className={cx(BTN_GHOST, 'w-full justify-start')} onClick={() => { setExpanded(cumulative(steps, stepIdx).expanded); close(); }}>
                      <ChevronsDownUp className="w-4 h-4" /> Collapse to this step
                    </button>
                    <button type="button" className={cx(BTN_GHOST, 'w-full justify-start')} onClick={() => { setPlaying(false); goTo(0); close(); }}>
                      <RotateCcw className="w-4 h-4" /> Restart tour
                    </button>
                  </div>
                  <p className="border-t border-border pt-2 text-ui-xs text-muted-foreground">
                    Keyboard: <kbd className="rounded border border-border px-1">←</kbd> <kbd className="rounded border border-border px-1">→</kbd> to step,{' '}
                    <kbd className="rounded border border-border px-1">P</kbd> to play or pause.
                  </p>
                </div>
              )}
            </Popover>
          </div>
        </div>
        <div className="mt-3 flex gap-1" role="group" aria-label="Tour progress">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setPlaying(false); goTo(i); }}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === stepIdx ? 'step' : undefined}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < stepIdx ? 'bg-primary/60 hover:bg-primary' : i === stepIdx ? 'bg-primary' : 'bg-secondary hover:bg-muted-foreground/40'
              )}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 lg:hidden" role="tablist" aria-label="Tour panes">
          {(['details', 'tree'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pane === p}
              onClick={() => setPane(p)}
              className={cx('rounded-md py-1.5 text-ui-sm font-medium', pane === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {p === 'details' ? 'Explanation' : 'Skill tree'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <div className={cx('min-h-0 overflow-auto border-border p-4 md:p-5 lg:block lg:border-r', pane === 'tree' ? 'block' : 'hidden')}>
          <div
            ref={treeRef}
            className="ttree"
            onClick={onTreeClick}
            onKeyDown={onTreeKey}
            dangerouslySetInnerHTML={{ __html: tour.tree }}
          />
        </div>
        <div ref={detailRef} className={cx('min-h-0 overflow-y-auto lg:block', pane === 'details' ? 'block' : 'hidden')}>
          <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-6">
            {selSkill ? (
              <>
                <button type="button" onClick={() => setSel(null)} className={cx(BTN_GHOST, '-ml-2.5 mb-3')}>
                  <ArrowLeft className="w-4 h-4" />
                  Back to step {stepIdx + 1}
                </button>
                <SkillDetail key={selSkill.id} skill={selSkill} onNavigate={showSkill} onLearn={onLearn} />
              </>
            ) : sel?.kind === 'label' ? (
              <>
                <button type="button" onClick={() => setSel(null)} className={cx(BTN_GHOST, '-ml-2.5 mb-3')}>
                  <ArrowLeft className="w-4 h-4" />
                  Back to step {stepIdx + 1}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-ui-xl font-semibold text-foreground">{sel.label}</h2>
                  <TypeBadge type={sel.type} />
                </div>
                <p className="mt-2 text-ui-base text-muted-foreground">This is a group in the skill tree. Open it in the tree to see the skills inside, then select one for details.</p>
              </>
            ) : step.summary ? (
              <div className="py-6 text-center animate-fade-in">
                <CheckCircle2 className="mx-auto w-10 h-10 text-[var(--green)]" />
                <Html html={step.narration} className="mt-3 text-ui-xl font-semibold text-foreground" />
                <Html
                  html={step.designRationale || 'You finished this tour. Try another one, or open the map to explore any stage on your own.'}
                  className="mx-auto mt-2 max-w-md"
                />
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {nextTour && (
                    <button type="button" onClick={() => onSwitch(nextTour.id)} className={BTN_PRIMARY}>
                      <Route className="w-4 h-4" />
                      Start Tour {nextTour.id.toUpperCase()}: {nextTour.title}
                    </button>
                  )}
                  <button type="button" onClick={onExit} className={BTN_SECONDARY}>
                    All tours
                  </button>
                </div>
              </div>
            ) : (
              <StepView key={`${tourId}-${stepIdx}`} step={step} onSkill={showSkill} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tours: choose a tour first; then walk it one step at a time. */
export function GuidedTours({ tourId, step, onSelectTour, onStep, onLearn }: GuidedToursProps) {
  if (!tourId) return <Chooser onSelect={onSelectTour} />;
  return (
    <Player
      key={tourId}
      tourId={tourId}
      initialStep={step}
      onStep={onStep}
      onExit={() => onSelectTour(null)}
      onSwitch={onSelectTour}
      onLearn={onLearn}
    />
  );
}
