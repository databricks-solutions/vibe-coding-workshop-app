import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Compass, Map as MapIcon, Route, Sparkles, X } from 'lucide-react';
import { NAV_META, PHASES, SKILLS, SKILL_MAP, type NavStage, type TourId } from '../../constants/skillsNavigatorData';
import {
  TRACKS,
  isNewSkill,
  newTracks,
  readStore,
  skillsInTrack,
  stageLabel,
  STAGE_TINT,
  summaryOf,
  tint,
  writeStore,
  type Track,
  type TrackId,
  type View,
} from './navModel';
import { Disclosure, Legend, NewBadge } from './ui';
import { BTN_GHOST, cx } from './uiStyles';

interface GalaxyMapProps {
  openTrack: TrackId | null;
  onToggleTrack: (id: TrackId | null) => void;
  onOpenSkill: (skillId: string) => void;
  onStartTour: (tour: TourId) => void;
  onGo: (view: View, filter?: string) => void;
}

// ------------------------------------------------------------ theme + starfield

const subscribeTheme = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
};
const isLightTheme = () => document.documentElement.classList.contains('light');

/** Faint twinkling backdrop, dark theme only. Pauses when the tab is hidden. */
function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number }[] = [];
    const setup = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.1 + 0.3,
        a: Math.random(),
        s: Math.random() * 0.004 + 0.002,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) {
        if (!still) {
          st.a += st.s;
          if (st.a > 1 || st.a < 0.1) st.s = -st.s;
        }
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${st.a * 0.35})`;
        ctx.fill();
      }
      if (!still && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const onVisible = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) draw();
    };
    const ro = new ResizeObserver(() => {
      setup();
      if (still) draw();
    });
    ro.observe(parent);
    setup();
    draw();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}

// ------------------------------------------------------------ pieces

function StartHere({ onDismiss, onPick }: { onDismiss: () => void; onPick: (choice: 'map' | 'tours' | 'learn') => void }) {
  const options = [
    { id: 'map' as const, icon: MapIcon, title: 'See the big picture', body: 'Open a track and see how its skills fit together.' },
    { id: 'tours' as const, icon: Route, title: 'Walk me through it', body: 'A guided tour explains each step and why it exists.' },
    { id: 'learn' as const, icon: BookOpen, title: 'Learn a concept', body: 'Short lessons on Apps, Lakebase, Genie, agents, and more.' },
  ];
  return (
    <section className="relative rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm animate-fade-in" aria-label="Start here">
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
        <X className="w-4 h-4" />
      </button>
      <p className="text-ui-sm font-medium text-primary">New here?</p>
      <h2 className="mt-1 text-ui-xl font-semibold text-foreground">Pick how you want to start</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-background p-4 text-left hover:border-primary/60 hover:bg-secondary/40 transition-colors"
          >
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-primary/12 text-primary">
              <o.icon className="w-5 h-5" />
            </span>
            <span className="text-ui-md font-semibold text-foreground">{o.title}</span>
            <span className="text-ui-sm text-muted-foreground">{o.body}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WhatsNew({ onDismiss, onBrowse }: { onDismiss: () => void; onBrowse: () => void }) {
  const tracks = newTracks().map((t) => t.label);
  const parts = [
    tracks.length ? `the ${tracks.join(' and ')} ${tracks.length > 1 ? 'tracks' : 'track'}` : null,
    NAV_META.newTourIds.length ? `${NAV_META.newTourIds.length} new ${NAV_META.newTourIds.length > 1 ? 'tours' : 'tour'}` : null,
    NAV_META.newModuleIds.length ? `${NAV_META.newModuleIds.length} new ${NAV_META.newModuleIds.length > 1 ? 'lessons' : 'lesson'}` : null,
  ].filter(Boolean) as string[];
  if (!parts.length && !NAV_META.newSkillIds.length) return null;
  const sentence = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5 text-ui-sm animate-fade-in">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      <p className="flex-1 text-foreground">
        <span className="font-semibold">New:</span> {sentence ?? `${NAV_META.newSkillIds.length} new skills`}.
      </p>
      <button type="button" onClick={onBrowse} className="shrink-0 font-semibold text-primary hover:underline">
        See what's new
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function FlowArrow() {
  return <ChevronRight className="w-4 h-4 shrink-0 self-center text-muted-foreground/60" aria-hidden="true" />;
}

function FlowNode({
  num,
  label,
  meta,
  color,
  isNew,
  onClick,
}: {
  num: string | number;
  label: string;
  meta?: string;
  color: string;
  isNew?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sn-tint-ring shrink-0 snap-start w-[132px] rounded-xl border border-border bg-background p-3 text-left transition-shadow"
      style={tint(color)}
    >
      <span className="flex items-center justify-between">
        <span className="sn-tint grid place-items-center min-w-7 h-7 px-1.5 rounded-lg text-ui-sm font-bold">{num}</span>
        {isNew && <NewBadge />}
      </span>
      <span className="mt-2 block text-ui-sm font-semibold leading-snug text-foreground">{label}</span>
      {meta && <span className="mt-0.5 block text-ui-xs text-muted-foreground">{meta}</span>}
    </button>
  );
}

function StageFlow({ stages, onOpenSkill }: { stages: NavStage[]; onOpenSkill: (id: string) => void }) {
  return (
    <div className="sn-scroll-x -mx-1 flex gap-2 overflow-x-auto snap-x px-1 pb-2">
      {stages.map((st, i) => {
        const orch = SKILL_MAP[st.orch];
        const n = orch?.workers?.length ?? 0;
        return (
          <div key={st.num} className="flex gap-2">
            {i > 0 && <FlowArrow />}
            <FlowNode
              num={st.num}
              label={stageLabel(st)}
              meta={n ? `${n} ${n === 1 ? 'step' : 'steps'}` : 'Plans the next stages'}
              color={STAGE_TINT[st.sc] ?? 'var(--cyan)'}
              isNew={isNewSkill(st.orch)}
              onClick={() => onOpenSkill(st.orch)}
            />
          </div>
        );
      })}
    </div>
  );
}

function PhaseFlow({ onOpenSkill }: { onOpenSkill: (id: string) => void }) {
  return (
    <div className="sn-scroll-x -mx-1 flex gap-2 overflow-x-auto snap-x px-1 pb-2">
      {PHASES.map((p, i) => (
        <div key={p.num} className="flex gap-2">
          {i > 0 && <FlowArrow />}
          <FlowNode
            num={p.num}
            label={p.label}
            meta={`${p.skills.length} ${p.skills.length === 1 ? 'skill' : 'skills'}`}
            color="var(--green)"
            onClick={() => onOpenSkill(p.skills[0] || 'appkit-00')}
          />
        </div>
      ))}
    </div>
  );
}

function SkillTiles({ ids, onOpenSkill }: { ids: string[]; onOpenSkill: (id: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ids.map((id) => {
        const s = SKILL_MAP[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpenSkill(id)}
            className="rounded-xl border border-border bg-background p-3 text-left hover:bg-secondary/50 transition-colors"
          >
            <span className="block text-ui-sm font-semibold text-foreground">{s.name}</span>
            <span className="mt-0.5 block text-ui-xs text-muted-foreground line-clamp-2">{summaryOf(s)}</span>
          </button>
        );
      })}
    </div>
  );
}

function trackMeta(t: Track): string {
  const skills = skillsInTrack(t.id).length;
  const n = t.id === 'appkit' ? PHASES.length : t.stages ? t.stages.filter((s) => /^\d+$/.test(s.num)).length : 0;
  const unit = t.id === 'appkit' ? 'phases' : 'stages';
  return n ? `${n} ${unit} · ${skills} skills` : `${skills} skills`;
}

function TrackCard({
  track,
  open,
  onToggle,
  onOpenSkill,
  onStartTour,
}: {
  track: Track;
  open: boolean;
  onToggle: () => void;
  onOpenSkill: (id: string) => void;
  onStartTour: (tour: TourId) => void;
}) {
  const all = skillsInTrack(track.id);
  const isNew = all.length > 0 && all.every((s) => isNewSkill(s.id));
  const commons = track.id === 'dpa' ? SKILLS.filter((s) => s.type === 'common') : [];
  const Icon = track.icon;
  const panelId = `sn-track-${track.id}`;

  return (
    <section
      className={cx('rounded-2xl border bg-card transition-shadow', open ? 'border-border shadow-md' : 'border-border hover:shadow-sm')}
      style={tint(track.color)}
    >
      <div className="flex items-start gap-3 p-4 md:p-5">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex flex-1 min-w-0 items-start gap-3 text-left">
          <span className="sn-tint grid place-items-center w-10 h-10 rounded-xl shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-ui-lg font-semibold text-foreground">{track.label}</span>
              {isNew && <NewBadge />}
            </span>
            <span className="mt-0.5 block text-ui-sm text-muted-foreground">{track.outcome}</span>
            <span className="mt-1.5 block text-ui-xs font-medium text-muted-foreground">{trackMeta(track)}</span>
          </span>
          <ChevronDown className={cx('mt-2.5 w-5 h-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div id={panelId} className="px-4 md:px-5 pb-5 animate-fade-in">
          <div className="border-t border-border pt-4">
            {track.stages && <StageFlow stages={track.stages} onOpenSkill={onOpenSkill} />}
            {track.id === 'appkit' && <PhaseFlow onOpenSkill={onOpenSkill} />}
            {track.id === 'agentic' && <SkillTiles ids={all.map((s) => s.id)} onOpenSkill={onOpenSkill} />}
            {commons.length > 0 && (
              <div className="mt-2">
                <Disclosure title={`Uses ${commons.length} shared skills in every stage`}>
                  <div className="flex flex-wrap gap-1.5">
                    {commons.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onOpenSkill(s.id)}
                        className="sn-tint px-2.5 py-1 rounded-full text-ui-xs font-semibold hover:opacity-80"
                        style={tint('var(--green)')}
                      >
                        {s.name.replace('Databricks ', '')}
                      </button>
                    ))}
                  </div>
                </Disclosure>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-ui-sm text-muted-foreground">
              <span>Select a {track.id === 'agentic' ? 'prompt' : track.id === 'appkit' ? 'phase' : 'stage'} to see what it does.</span>
              {track.tour && (
                <button type="button" onClick={() => onStartTour(track.tour!)} className={cx(BTN_GHOST, 'ml-auto text-primary hover:text-primary')}>
                  <Route className="w-4 h-4" />
                  Take the tour
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------ view

/** Map: five tracks at a glance; expand one to see its stages; click a stage for details. */
export function GalaxyMap({ openTrack, onToggleTrack, onOpenSkill, onStartTour, onGo }: GalaxyMapProps) {
  const light = useSyncExternalStore(subscribeTheme, isLightTheme);
  const [showStart, setShowStart] = useState(() => !readStore('startDismissed', false));
  const [showNew, setShowNew] = useState(() => readStore('newDismissed', '') !== NAV_META.sourceCommit);

  const dismissStart = () => {
    writeStore('startDismissed', true);
    setShowStart(false);
  };
  const dismissNew = () => {
    writeStore('newDismissed', NAV_META.sourceCommit);
    setShowNew(false);
  };

  return (
    <div className="relative h-full overflow-y-auto">
      {!light && <Starfield />}
      <div className="relative mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8">
        {showStart && (
          <StartHere
            onDismiss={dismissStart}
            onPick={(choice) => {
              dismissStart();
              if (choice === 'map') onToggleTrack('dpa');
              else onGo(choice);
            }}
          />
        )}
        {showNew && (
          <WhatsNew
            onDismiss={dismissNew}
            onBrowse={() => {
              dismissNew();
              onGo('skills', 'new');
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Compass className="w-4 h-4 text-muted-foreground" />
          <p className="flex-1 text-ui-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{SKILLS.length} skills</span> across {TRACKS.length} tracks
          </p>
          <Legend />
        </div>

        <div className="space-y-3">
          {TRACKS.map((t) => (
            <TrackCard
              key={t.id}
              track={t}
              open={openTrack === t.id}
              onToggle={() => onToggleTrack(openTrack === t.id ? null : t.id)}
              onOpenSkill={onOpenSkill}
              onStartTour={onStartTour}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
