import { useEffect, useMemo, useRef, useState } from 'react';
import { ACADEMY, type AcademyModule } from '../../constants/skillsNavigatorData';
import { splitAcadContent } from './skillsNavUtils';

interface PlatformAcademyProps {
  /** Module id to auto-select (e.g. when arriving via a "Learn:" button). */
  requestedModuleId?: string | null;
  onModuleConsumed?: () => void;
}

function Quiz({ quiz }: { quiz: NonNullable<AcademyModule['quiz']> }) {
  // Track the selected option per question (once chosen, the row reveals).
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div className="acad-quiz">
      <h4>Test Your Knowledge</h4>
      {quiz.map((q, qi) => {
        const chosen = picked[qi];
        const revealed = chosen !== undefined;
        return (
          <div className="quiz-q" key={qi}>
            <p>
              {qi + 1}. {q.q}
            </p>
            <div className="quiz-opts">
              {q.opts.map((o, oi) => {
                let cls = 'quiz-opt';
                if (revealed) {
                  cls += ' revealed ' + (oi === q.answer ? 'correct' : 'wrong');
                }
                return (
                  <div
                    className={cls}
                    key={oi}
                    onClick={() => {
                      if (!revealed) setPicked((p) => ({ ...p, [qi]: oi }));
                    }}
                  >
                    {o}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mode 4 — Platform Academy: module sidebar + sectioned content + quiz. */
export function PlatformAcademy({ requestedModuleId, onModuleConsumed }: PlatformAcademyProps) {
  // Honor external requests to open a specific module: open it during render
  // (or at mount), then tell the parent the request was consumed from an
  // effect, since that updates the parent's state.
  const isValidRequest = !!requestedModuleId && ACADEMY.some((m) => m.id === requestedModuleId);
  const [activeId, setActiveId] = useState<string | null>(isValidRequest ? requestedModuleId : null);
  const mainRef = useRef<HTMLDivElement | null>(null);

  const [prevRequestedModuleId, setPrevRequestedModuleId] = useState(requestedModuleId);
  if (requestedModuleId !== prevRequestedModuleId) {
    setPrevRequestedModuleId(requestedModuleId);
    if (isValidRequest) setActiveId(requestedModuleId);
  }

  useEffect(() => {
    if (isValidRequest) onModuleConsumed?.();
  }, [isValidRequest, requestedModuleId, onModuleConsumed]);

  const active = useMemo(() => ACADEMY.find((m) => m.id === activeId) || null, [activeId]);
  const sections = useMemo(() => (active ? splitAcadContent(active.content) : []), [active]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeId]);

  return (
    <div className="sn-academy-root">
      <div className="acad-sidebar">
        <h3>Platform Academy</h3>
        <div className="acad-nav">
          {ACADEMY.map((m) => (
            <div
              key={m.id}
              className={`acad-nav-item${activeId === m.id ? ' active' : ''}`}
              onClick={() => setActiveId(m.id)}
            >
              <div className="acad-nav-icon" style={{ background: `${m.color}15`, color: m.color }}>
                {m.icon}
              </div>
              <div>
                <div className="acad-nav-title">{m.title}</div>
                <div className="acad-nav-sub">{m.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="acad-main" ref={mainRef}>
        {!active ? (
          <div className="acad-empty">
            <h2>Select a module</h2>
            <p>Choose a topic from the sidebar to start learning.</p>
          </div>
        ) : (
          <>
            <div className="acad-hero">
              <div className="acad-hero-top">
                <div className="acad-hero-icon" style={{ background: `${active.color}15`, color: active.color }}>
                  {active.icon}
                </div>
                <div>
                  <h2>{active.title}</h2>
                  <div className="acad-hero-sub">{active.subtitle}</div>
                </div>
              </div>
            </div>
            <div className="acad-sections">
              {sections.map((sec, i) => (
                <div className="acad-section" key={i}>
                  {sec.title !== undefined && <h5 dangerouslySetInnerHTML={{ __html: sec.title }} />}
                  <div dangerouslySetInnerHTML={{ __html: sec.html }} />
                </div>
              ))}
              {active.quiz && <Quiz quiz={active.quiz} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
