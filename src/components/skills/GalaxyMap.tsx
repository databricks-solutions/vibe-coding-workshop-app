import { useEffect, useRef } from 'react';
import { SKILLS, SKILL_MAP, STAGES, PHASES, ACADEMY, TOURS } from '../../constants/skillsNavigatorData';
import { stripHtml } from './skillsNavUtils';

interface GalaxyMapProps {
  onOpenSkill: (skillId: string) => void;
}

/** Mode 1 — Galaxy Map: pipeline stages, common spine, app phases, agentic nodes. */
export function GalaxyMap({ onOpenSkill }: GalaxyMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated starfield background (ported from initStarfield), theme-aware.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number }[] = [];

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setup = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random(),
        s: Math.random() * 0.005 + 0.002,
      }));
    };

    const draw = () => {
      const isLight = document.documentElement.classList.contains('light');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((st) => {
        if (!reduceMotion) {
          st.a += st.s;
          if (st.a > 1) st.s = -Math.abs(st.s);
          if (st.a < 0.1) st.s = Math.abs(st.s);
        }
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(30,40,80,${st.a * 0.12})`
          : `rgba(200,220,255,${st.a * 0.5})`;
        ctx.fill();
      });
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };

    setup();
    draw();

    const onResize = () => {
      setup();
      if (reduceMotion) draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const commons = SKILLS.filter((s) => s.type === 'common');
  const agentic = SKILLS.filter((s) => s.component === 'agentic');

  return (
    <div className="sn-galaxy-root" id="galaxy">
      <canvas id="starfield" ref={canvasRef} />
      <div className="galaxy-content">
        <div className="stats-bar">
          <div className="stat"><div className="stat-num">{SKILLS.length}</div><div className="stat-label">Agent Skills</div></div>
          <div className="stat"><div className="stat-num">{STAGES.length}</div><div className="stat-label">Pipeline Stages</div></div>
          <div className="stat"><div className="stat-num">{PHASES.length}</div><div className="stat-label">App Phases</div></div>
          <div className="stat"><div className="stat-num">{ACADEMY.length}</div><div className="stat-label">Platform Modules</div></div>
          <div className="stat"><div className="stat-num">{Object.keys(TOURS).length}</div><div className="stat-label">Guided Tours</div></div>
        </div>

        {/* DPA pipeline */}
        <div className="galaxy-section" style={{ textAlign: 'center' }}>
          <div className="galaxy-label" style={{ textAlign: 'center' }}>Data Product Accelerator</div>
          <h2>The 9-Stage Design-First Pipeline</h2>
          <div className="subtitle">Click any stage to explore. Dots below show worker skills.</div>
          <div className="pipeline-flow">
            {STAGES.map((st, i) => {
              const orch = SKILL_MAP[st.orch];
              const workers = orch?.workers ?? [];
              return (
                <div key={st.num} style={{ display: 'contents' }}>
                  {i > 0 && <div className="stage-arrow">›</div>}
                  <div className="stage-cluster">
                    <div
                      className={`stage-node ${st.sc}`}
                      onClick={() => onOpenSkill(st.orch)}
                      title={stripHtml(orch?.desc)}
                    >
                      <div className="sn-num">{st.num}</div>
                      <div className="sn-label">{st.label}</div>
                    </div>
                    <div className="worker-dots">
                      {workers.map((wid) => (
                        <div
                          key={wid}
                          className="worker-dot"
                          title={SKILL_MAP[wid]?.name || ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSkill(wid);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="galaxy-label" style={{ textAlign: 'center' }}>
            Cross-Cutting Common Skills ({commons.length})
          </div>
          <div className="common-spine">
            {commons.map((s) => (
              <div
                key={s.id}
                className="common-chip"
                onClick={() => onOpenSkill(s.id)}
                title={stripHtml(s.desc)}
              >
                {s.name.replace('Databricks ', '').replace('databricks-', '')}
              </div>
            ))}
          </div>
        </div>

        {/* AppKit phases */}
        <div className="galaxy-section" style={{ textAlign: 'center' }}>
          <div className="galaxy-label" style={{ textAlign: 'center' }}>AppKit + Lakebase</div>
          <h2>The 5-Phase App Lifecycle</h2>
          <div className="subtitle">From scaffold to production with live data.</div>
          <div className="phase-flow">
            {PHASES.map((p, i) => (
              <div key={p.num} style={{ display: 'contents' }}>
                {i > 0 && <div className="stage-arrow" style={{ color: 'var(--green)', marginTop: 0 }}>›</div>}
                <div className="phase-node" onClick={() => onOpenSkill(p.skills[0] || 'appkit-00')} title={`Phase ${p.num}`}>
                  <div className="pn-num">{p.num}</div>
                  <div className="pn-label">{p.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agentic framework */}
        <div className="galaxy-section" style={{ textAlign: 'center' }}>
          <div className="galaxy-label" style={{ textAlign: 'center' }}>Agentic Framework</div>
          <h2>Multi-Agent Build Framework</h2>
          <div className="subtitle">Agent prompts for building multi-agent systems.</div>
          <div className="agentic-nodes">
            {agentic.map((s) => (
              <div key={s.id} className="agentic-node" onClick={() => onOpenSkill(s.id)} title={stripHtml(s.desc)}>
                <strong>{s.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
