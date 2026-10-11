import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, RotateCcw, XCircle } from 'lucide-react';
import { ACADEMY, type AcademyModule } from '../../constants/skillsNavigatorData';
import { splitAcadContent } from './skillsNavUtils';
import {
  MODULE_GROUPS,
  MODULE_MAP,
  MODULE_ORDER,
  NEW_MODULES,
  groupOfModule,
  moduleIcon,
  moduleMinutes,
  readStore,
  relatedSkills,
  tint,
  typeInfo,
  writeStore,
} from './navModel';
import { NewBadge, SectionLabel } from './ui';
import { BTN_PRIMARY, BTN_SECONDARY, cx } from './uiStyles';

interface PlatformAcademyProps {
  moduleId: string | null;
  onOpenModule: (id: string | null) => void;
  onOpenSkill: (id: string) => void;
}

function useCompleted() {
  const [done, setDone] = useState<string[]>(() => readStore<string[]>('lessonsDone', []));
  const mark = (id: string) =>
    setDone((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeStore('lessonsDone', next);
      return next;
    });
  return { done: new Set(done), mark };
}

function ModuleIcon({ m, size = 'md' }: { m: AcademyModule; size?: 'md' | 'lg' }) {
  const color = groupOfModule(m.id)?.color ?? 'var(--cyan)';
  return (
    <span className={cx('sn-tint grid place-items-center shrink-0', size === 'lg' ? 'w-12 h-12 rounded-xl' : 'w-9 h-9 rounded-lg')} style={tint(color)}>
      {createElement(moduleIcon(m.id), { className: size === 'lg' ? 'w-6 h-6' : 'w-[18px] h-[18px]' })}
    </span>
  );
}

// ------------------------------------------------------------ landing

function Landing({ done, onOpen }: { done: Set<string>; onOpen: (id: string) => void }) {
  const next = MODULE_ORDER.find((m) => !done.has(m.id)) ?? MODULE_ORDER[0];
  const started = done.size > 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8 space-y-8">
      {next && (
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
          <ModuleIcon m={next} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-ui-sm font-medium text-primary">{started ? 'Continue with' : 'Start with'}</p>
            <h2 className="mt-0.5 text-ui-xl font-semibold text-foreground">{next.title}</h2>
            <p className="text-ui-sm text-muted-foreground">
              {next.subtitle} · about {moduleMinutes(next)} min
            </p>
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={() => onOpen(next.id)}>
            {started ? 'Continue' : 'Start lesson'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      <p className="text-ui-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {done.size} of {ACADEMY.length}
        </span>{' '}
        lessons completed. Each ends with a short quiz.
      </p>

      {MODULE_GROUPS.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="text-ui-md font-semibold text-foreground">{g.label}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.modules.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpen(m.id)}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-foreground/20 hover:shadow-sm transition-all"
              >
                <ModuleIcon m={m} />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-ui-md font-semibold text-foreground leading-snug">{m.title}</span>
                    {NEW_MODULES.has(m.id) && <NewBadge />}
                  </span>
                  <span className="mt-0.5 block text-ui-sm text-muted-foreground line-clamp-2">{m.subtitle}</span>
                  <span className="mt-2 flex items-center gap-1.5 text-ui-xs text-muted-foreground">
                    {done.has(m.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--green)]" /> Completed
                      </>
                    ) : (
                      <>About {moduleMinutes(m)} min</>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ lesson body

/** A lesson section; long code blocks and tables collapse behind "Show more". */
function LessonSection({ title, html, id }: { title?: string; html: string; id: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('pre, table, .ac-diagram').forEach((el) => {
      if (el.parentElement?.classList.contains('sn-clamp-body') || el.scrollHeight < 320) return;
      const wrap = document.createElement('div');
      wrap.className = 'sn-clamp';
      const body = document.createElement('div');
      body.className = 'sn-clamp-body';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sn-clamp-toggle';
      btn.textContent = 'Show more';
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const open = wrap.classList.toggle('open');
        btn.textContent = open ? 'Show less' : 'Show more';
        btn.setAttribute('aria-expanded', String(open));
      });
      el.replaceWith(wrap);
      body.appendChild(el);
      wrap.append(body, btn);
    });
  }, [html]);
  return (
    <section id={id} className="scroll-mt-6">
      {title && <h3 className="mb-2 text-ui-lg font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: title }} />}
      <div ref={ref} className="sn-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

function Quiz({ quiz, onComplete }: { quiz: NonNullable<AcademyModule['quiz']>; onComplete: () => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const finished = idx >= quiz.length;
  const q = quiz[idx];

  useEffect(() => {
    if (finished) onComplete();
  }, [finished, onComplete]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setIdx((n) => n + 1);
  };
  const retry = () => {
    setIdx(0);
    setPicked(null);
    setScore(0);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Quiz">
      {finished ? (
        <div className="text-center py-2">
          <CheckCircle2 className="mx-auto w-8 h-8 text-[var(--green)]" />
          <p className="mt-2 text-ui-lg font-semibold text-foreground">
            {score} of {quiz.length} correct
          </p>
          <p className="text-ui-sm text-muted-foreground">{score === quiz.length ? 'Nice work. This lesson is complete.' : 'Lesson complete. Retry to lock it in.'}</p>
          {score < quiz.length && (
            <button type="button" onClick={retry} className={cx(BTN_SECONDARY, 'mt-3')}>
              <RotateCcw className="w-4 h-4" />
              Retry quiz
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <SectionLabel>Check your understanding</SectionLabel>
            <span className="text-ui-xs text-muted-foreground">
              Question {idx + 1} of {quiz.length}
            </span>
          </div>
          <p className="mt-3 text-ui-md font-semibold text-foreground">{q.q}</p>
          <div className="mt-3 space-y-2">
            {q.opts.map((o, i) => {
              const revealed = picked !== null;
              const correct = i === q.answer;
              const chosen = i === picked;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(i)}
                  disabled={revealed}
                  className={cx(
                    'w-full flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-ui-sm transition-colors',
                    !revealed && 'border-border bg-background hover:bg-secondary text-foreground',
                    revealed && correct && 'border-[var(--green)] bg-[var(--green-dim)] text-foreground',
                    revealed && chosen && !correct && 'border-[var(--red)] bg-[var(--red-dim)] text-foreground',
                    revealed && !correct && !chosen && 'border-border text-muted-foreground opacity-70'
                  )}
                >
                  <span className="flex-1">{o}</span>
                  {revealed && correct && <Check className="w-4 h-4 text-[var(--green)]" />}
                  {revealed && chosen && !correct && <XCircle className="w-4 h-4 text-[var(--red)]" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-ui-sm text-muted-foreground">{picked === q.answer ? 'Correct.' : 'Not quite; the highlighted answer is right.'}</p>
              <button type="button" onClick={next} className={BTN_PRIMARY}>
                {idx + 1 < quiz.length ? 'Next question' : 'See result'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Lesson({
  m,
  done,
  onComplete,
  onOpen,
  onBack,
  onOpenSkill,
}: {
  m: AcademyModule;
  done: boolean;
  onComplete: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onOpenSkill: (id: string) => void;
}) {
  const sections = useMemo(() => splitAcadContent(m.content), [m.content]);
  const pos = MODULE_ORDER.findIndex((x) => x.id === m.id);
  const nextModule = MODULE_ORDER[pos + 1];
  const related = relatedSkills(m.id);
  const titled = sections.filter((s) => s.title);
  const group = groupOfModule(m.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-ui-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        All lessons
      </button>

      <header className="mt-4 flex items-start gap-4">
        <ModuleIcon m={m} size="lg" />
        <div className="min-w-0">
          <p className="text-ui-xs font-medium text-muted-foreground">{group?.label}</p>
          <h2 className="text-ui-2xl font-semibold text-foreground leading-tight">{m.title}</h2>
          <p className="mt-1 text-ui-base text-muted-foreground">{m.subtitle}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-ui-xs text-muted-foreground">
            {titled.length} sections · about {moduleMinutes(m)} min
            {done && (
              <>
                {' · '}
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--green)]" /> Completed
              </>
            )}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="min-w-0 space-y-8">
          {sections.map((s, i) => (
            <LessonSection key={`${m.id}-${i}`} id={`sn-sec-${i}`} title={s.title} html={s.html} />
          ))}
          {m.quiz && m.quiz.length > 0 && <Quiz key={m.id} quiz={m.quiz} onComplete={onComplete} />}

          {related.length > 0 && (
            <section>
              <SectionLabel>Skills that use this</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {related.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenSkill(s.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-ui-sm text-foreground hover:bg-secondary"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: typeInfo(s.type).color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {nextModule && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
              <p className="text-ui-sm text-muted-foreground">
                Next: <span className="font-medium text-foreground">{nextModule.title}</span>
              </p>
              <button type="button" className={BTN_PRIMARY} onClick={() => onOpen(nextModule.id)}>
                Next lesson
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {titled.length > 2 && (
          <nav className="hidden lg:block" aria-label="On this page">
            <div className="sticky top-6">
              <SectionLabel>On this page</SectionLabel>
              <ul className="mt-2 space-y-1">
                {sections.map((s, i) =>
                  s.title ? (
                    <li key={i}>
                      <a
                        href={`#sn-sec-${i}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(`sn-sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="flex items-start gap-1 text-ui-sm text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: s.title }} />
                      </a>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

/** Learn: a landing page of grouped lessons, then one lesson at a time. */
export function PlatformAcademy({ moduleId, onOpenModule, onOpenSkill }: PlatformAcademyProps) {
  const { done, mark } = useCompleted();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const active = moduleId ? MODULE_MAP[moduleId] : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [moduleId]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {active ? (
        <Lesson
          key={active.id}
          m={active}
          done={done.has(active.id)}
          onComplete={() => mark(active.id)}
          onOpen={onOpenModule}
          onBack={() => onOpenModule(null)}
          onOpenSkill={onOpenSkill}
        />
      ) : (
        <Landing done={done} onOpen={onOpenModule} />
      )}
    </div>
  );
}
