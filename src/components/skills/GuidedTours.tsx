import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SKILL_MAP, TOURS, type Tour, type TourStep } from '../../constants/skillsNavigatorData';
import { typeColor, stripHtml, highlightCode, escHtml } from './skillsNavUtils';

type TourId = 'a' | 'b' | 'c';

const TOUR_META: { id: TourId; title: string; blurb: string }[] = [
  { id: 'a', title: 'Tour A: Schema to Production', blurb: 'Walk through all 9 DPA stages — from schema CSV to GenAI agents' },
  { id: 'b', title: 'Tour B: PRD to Deployed App', blurb: 'Build and deploy a Databricks App through the branch-aware AppKit lifecycle' },
  { id: 'c', title: 'Tour C: The Full Picture', blurb: 'Both paths converge — data pipeline meets the application layer' },
];

const SPEED_MS: Record<number, number> = { 1: 4000, 2: 3000, 3: 2000, 4: 1200, 5: 700 };
const SPEED_LBL: Record<number, string> = { 1: '0.5x', 2: '0.75x', 3: '1x', 4: '1.5x', 5: '2x' };
const TIER_COLORS: Record<number, string> = { 1: 'var(--cyan)', 2: 'var(--purple)', 3: 'var(--gold)', 4: 'var(--orange)' };

interface GuidedToursProps {
  onLearn: (platform: string) => void;
}

// ---- detail HTML builders (ported from renderTourDetail / renderNodeDetail) ----

function codeBlockHtml(code: string): string {
  return `<div class="td-code"><h4>Key Code Pattern</h4><div class="td-code-block">${highlightCode(
    code
  )}</div><button class="td-code-copy" data-copy-code="1">Copy</button></div>`;
}

function renderTourDetailHtml(step: TourStep, idx: number, total: number): string {
  if (step.summary) {
    const dots = Array.from({ length: total }, (_, i) =>
      `<div class="td-progress-dot${i < idx ? ' done' : ''}${i === idx ? ' current' : ''}"></div>`
    ).join('');
    return `<div class="td-summary"><h3>${step.narration}</h3><p>${
      step.designRationale ||
      "You've completed this tour! Try another tour, explore the Galaxy Map, or dive into Platform Academy to learn the building blocks."
    }</p><div class="td-progress">${dots}</div></div>`;
  }
  const skills = (step.skillIds || []).map((id) => SKILL_MAP[id]).filter(Boolean);
  const primary = skills[0];
  const rationale = step.designRationale || (primary && primary.rationale) || null;
  const io = step.inputOutput;
  const code = primary && primary.code;
  const tierLabel = step.tier ? step.tier[1] : '';
  const tierNum = step.tier ? step.tier[0] : 1;
  const tierColor = TIER_COLORS[tierNum] || 'var(--cyan)';

  let html = '<div class="td-inner">';
  html += '<div class="td-header"><div class="td-header-top">';
  if (primary) {
    const tc = typeColor(primary.type);
    html += `<span class="td-name">${primary.name}</span>`;
    html += `<span class="td-badge" style="background:${tc.bg};color:${tc.fg}">${primary.type}</span>`;
    if (primary.stage) html += `<span class="td-badge" style="background:var(--surface2);color:var(--text-dim)">Stage ${primary.stage}</span>`;
    if (primary.phase !== undefined) html += `<span class="td-badge" style="background:var(--surface2);color:var(--text-dim)">Phase ${primary.phase}</span>`;
    html += `<span class="td-badge" style="background:${tierColor}22;color:${tierColor}">${tierLabel}</span>`;
  } else {
    html += `<span class="td-name" style="font-size:16px">${tierLabel}</span>`;
    html += `<span class="td-badge" style="background:${tierColor}22;color:${tierColor}">Step ${idx + 1}/${total}</span>`;
  }
  html += '</div>';
  if (primary) html += `<div class="td-desc">${primary.desc}</div>`;
  html += `<div class="td-narration">${step.narration}</div></div>`;

  if (rationale) html += `<div class="td-rationale"><h4>Why This Pattern</h4><p>${rationale}</p></div>`;

  if (io) {
    html += '<div class="td-flow"><h4>Data Flow</h4><div class="td-flow-diagram">';
    html += '<div class="td-flow-col inputs">' + io.inputs.map((i) => `<div class="td-pill">${i}</div>`).join('') + '</div>';
    html += '<div class="td-flow-arrow">→</div>';
    html += '<div class="td-flow-col outputs">' + io.outputs.map((o) => `<div class="td-pill">${o}</div>`).join('') + '</div>';
    html += '</div></div>';
  }

  if (code) html += codeBlockHtml(code);

  if (primary && primary.workers && primary.workers.length) {
    html += '<div class="td-workers"><h4>Workers (' + primary.workers.length + ')</h4><div class="td-worker-map">';
    html += `<div class="td-hub">${primary.stage || 'O'}</div>`;
    html += primary.workers
      .map((wid) => {
        const w = SKILL_MAP[wid];
        return w ? `<div class="td-worker-chip" data-nav="${wid}" title="${stripHtml(w.desc)}">${w.name}</div>` : '';
      })
      .join('');
    html += '</div>';
    if (primary.commonDeps && primary.commonDeps.length) {
      html += '<div class="td-deps-row"><span class="td-dep-label">Deps:</span>';
      html += primary.commonDeps
        .map((did) => {
          const d = SKILL_MAP[did];
          return d ? `<div class="td-dep-chip" data-nav="${did}">${d.name}</div>` : '';
        })
        .join('');
      html += '</div>';
    }
    html += '</div>';
  } else if (skills.length > 1) {
    html += '<div class="td-workers"><h4>Skills in this step (' + skills.length + ')</h4><div class="td-worker-map">';
    html += skills
      .map((s) => {
        const tc = typeColor(s.type);
        return `<div class="td-worker-chip" style="background:${tc.bg};border-color:${tc.fg}40;color:${tc.fg}" data-nav="${s.id}" title="${stripHtml(s.desc)}">${s.name}</div>`;
      })
      .join('');
    html += '</div></div>';
  }

  if (primary) {
    html += '<div class="td-actions">';
    if (primary.prompt) html += `<button class="dp-btn primary" data-copy-prompt="${primary.id}">Copy Prompt</button>`;
    if (primary.platform) html += `<button class="dp-btn secondary" data-academy="${primary.platform}">Learn: ${primary.platform}</button>`;
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderNodeDetailHtml(skillId: string): string {
  const s = SKILL_MAP[skillId];
  if (!s) return '';
  const tc = typeColor(s.type);
  let html = '<div class="td-inner"><div class="td-header"><div class="td-header-top">';
  html += `<span class="td-name">${s.name}</span>`;
  html += `<span class="td-badge" style="background:${tc.bg};color:${tc.fg}">${s.type}</span>`;
  if (s.stage) html += `<span class="td-badge" style="background:var(--surface2);color:var(--text-dim)">Stage ${s.stage}</span>`;
  if (s.phase !== undefined) html += `<span class="td-badge" style="background:var(--surface2);color:var(--text-dim)">Phase ${s.phase}</span>`;
  if (s.component) html += `<span class="td-badge" style="background:var(--surface2);color:var(--text-dim)">${s.component}</span>`;
  html += '</div>';
  html += `<div class="td-desc">${s.desc || ''}</div></div>`;

  if (s.rationale) html += `<div class="td-rationale"><h4>Design Rationale</h4><p>${s.rationale}</p></div>`;

  if (s.emits) {
    html += '<div class="td-flow"><h4>Emits (Output Artifacts)</h4><div class="td-flow-diagram"><div class="td-flow-col outputs">';
    html += s.emits.map((e) => `<div class="td-pill">${e}</div>`).join('');
    html += '</div></div></div>';
  }

  if (s.code) html += codeBlockHtml(s.code);

  if (s.workers && s.workers.length) {
    html += '<div class="td-workers"><h4>Workers (' + s.workers.length + ')</h4><div class="td-worker-map">';
    s.workers.forEach((wid) => {
      const w = SKILL_MAP[wid];
      if (!w) return;
      const wc = typeColor(w.type);
      html += `<div class="td-worker-chip" style="background:${wc.bg};border-color:${wc.fg}40;color:${wc.fg}" data-nav="${wid}" title="${stripHtml(w.desc)}">${w.name}</div>`;
    });
    html += '</div></div>';
  }

  if (s.commonDeps && s.commonDeps.length) {
    html += '<div class="td-workers"><h4>Common Dependencies</h4><div class="td-worker-map">';
    s.commonDeps.forEach((did) => {
      const d = SKILL_MAP[did];
      if (!d) return;
      html += `<div class="td-worker-chip" style="background:var(--green-dim);border-color:var(--green)40;color:var(--green)" data-nav="${did}" title="${stripHtml(d.desc)}">${d.name}</div>`;
    });
    html += '</div></div>';
  }

  if (s.keywords && s.keywords.length) {
    html += '<div class="td-flow"><h4>Routing Keywords</h4><div class="td-flow-diagram"><div class="td-flow-col">';
    html += s.keywords.map((k) => `<div class="td-pill" style="background:var(--surface2);border-color:var(--border);color:var(--text-dim)">${k}</div>`).join('');
    html += '</div></div></div>';
  }

  if (s.platform) html += `<div class="td-actions"><button class="dp-btn secondary" data-academy="${s.platform}">Learn: ${s.platform}</button></div>`;
  if (s.prompt) html += `<div class="td-actions"><button class="dp-btn primary" data-copy-prompt="${s.id}">Copy Prompt</button></div>`;

  html += '</div>';
  return html;
}

function renderNodeLabelHtml(label: string, typeName: string): string {
  const tc = typeColor(typeName);
  return `<div class="td-inner"><div class="td-header"><div class="td-header-top"><span class="td-name">${escHtml(
    label
  )}</span><span class="td-badge" style="background:${tc.bg};color:${tc.fg}">${typeName}</span></div><div class="td-desc" style="margin-top:8px">Click on child nodes to explore what is inside, or use the Guided Tour controls above to walk through step by step.</div></div></div>`;
}

const WELCOME = (name: string) =>
  `<div class="td-welcome"><h3>${name}</h3><p>Press <strong>Play</strong> or <strong>Next</strong> to walk through. Each step reveals design choices, code patterns, and rationale in this panel.</p></div>`;

/**
 * Mode 2 — Guided Tours.
 *
 * The tour tree is rendered once from a trusted static HTML string via
 * dangerouslySetInnerHTML. All visual decorations (expand/collapse, the
 * active/visited/lit step highlights, and the user-selected node) are kept in
 * React state and re-applied to that static DOM inside a useLayoutEffect that
 * runs after every commit. This is deliberate: imperative DOM mutations don't
 * survive React re-renders (every narration `setState` re-commits the panel),
 * so decorations must be derived from state and re-applied each frame.
 */
export function GuidedTours({ onLearn }: GuidedToursProps) {
  const [curTour, setCurTour] = useState<TourId>('a');
  const [stepIdx, setStepIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [allExpanded, setAllExpanded] = useState(false);

  // Decoration state (all derived → re-applied by the layout effect).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [lit, setLit] = useState<Set<string>>(new Set());
  const [userSel, setUserSel] = useState<string | null>(null);
  const [detailHtml, setDetailHtml] = useState<string>(WELCOME(TOURS.a.name));

  const treeRef = useRef<HTMLDivElement | null>(null);
  const stepIdxRef = useRef(-1);
  const activeIdsRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(SPEED_MS[3]);
  const tickRef = useRef<() => void>(() => {});
  const lastScrollRef = useRef<string | null>(null);

  const tour: Tour = TOURS[curTour];
  const steps = tour.steps;

  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { activeIdsRef.current = activeIds; }, [activeIds]);
  useEffect(() => { speedRef.current = SPEED_MS[speed]; }, [speed]);

  // Re-apply all tree decorations after every commit. Idempotent + cheap.
  useLayoutEffect(() => {
    const t = treeRef.current;
    if (!t) return;
    t.querySelectorAll<HTMLElement>('li[id]').forEach((li) => {
      const chev = li.querySelector<HTMLElement>(':scope > .tnode .chevron');
      if (!chev) return; // leaf row, nothing to expand
      const on = expanded.has(li.id);
      li.classList.toggle('expanded', on);
      li.classList.toggle('collapsed', !on);
      chev.classList.toggle('open', on);
    });
    t.querySelectorAll('.tnode').forEach((n) => n.classList.remove('active-node', 'visited', 'user-selected'));
    visited.forEach((id) => t.querySelector('#' + CSS.escape(id))?.classList.add('visited'));
    activeIds.forEach((id) => {
      const el = t.querySelector('#' + CSS.escape(id));
      if (el) {
        el.classList.remove('visited');
        el.classList.add('active-node');
      }
    });
    t.querySelectorAll('li.lit').forEach((el) => el.classList.remove('lit'));
    lit.forEach((id) => t.querySelector('#' + CSS.escape(id))?.classList.add('lit'));
    if (userSel) t.querySelector(userSel)?.classList.add('user-selected');
  });

  // Scroll the active step (or a navigated node) into view when it changes.
  useEffect(() => {
    const id = activeIds[0] ?? null;
    if (!id || id === lastScrollRef.current) return;
    lastScrollRef.current = id;
    treeRef.current?.querySelector('#' + CSS.escape(id))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIds]);

  useEffect(() => {
    if (!userSel) return;
    treeRef.current?.querySelector(userSel)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [userSel]);

  const stopPlay = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const clearDecorations = useCallback(() => {
    setExpanded(new Set());
    setActiveIds([]);
    setVisited(new Set());
    setLit(new Set());
    setUserSel(null);
    setAllExpanded(false);
    lastScrollRef.current = null;
  }, []);

  const selectTour = useCallback(
    (id: TourId) => {
      stopPlay();
      setCurTour(id);
      setStepIdx(-1);
      stepIdxRef.current = -1;
      activeIdsRef.current = [];
      clearDecorations();
      setDetailHtml(WELCOME(TOURS[id].name));
    },
    [stopPlay, clearDecorations]
  );

  // Forward one step using refs (safe inside the play timer). Returns whether
  // it advanced.
  const advance = useCallback((): boolean => {
    const idx = stepIdxRef.current;
    if (idx >= steps.length - 1) return false;
    const newIdx = idx + 1;
    const step = steps[newIdx];
    const prevActive = activeIdsRef.current;
    if (step.expand?.length) setExpanded((p) => new Set([...p, ...step.expand!]));
    if (prevActive.length) setVisited((p) => new Set([...p, ...prevActive]));
    setActiveIds(step.activate || []);
    activeIdsRef.current = step.activate || [];
    if (step.lit?.length) setLit((p) => new Set([...p, ...step.lit!]));
    setStepIdx(newIdx);
    stepIdxRef.current = newIdx;
    setDetailHtml(renderTourDetailHtml(step, newIdx, steps.length));
    return true;
  }, [steps]);

  const next = useCallback(() => {
    if (!advance()) stopPlay();
  }, [advance, stopPlay]);

  // Rebuild cumulative decorations for an arbitrary target index (used by Prev).
  const goTo = useCallback(
    (target: number) => {
      const exp = new Set<string>();
      const vis = new Set<string>();
      const litSet = new Set<string>();
      for (let i = 0; i <= target; i++) {
        steps[i].expand?.forEach((id) => exp.add(id));
        steps[i].lit?.forEach((id) => litSet.add(id));
        if (i < target) steps[i].activate?.forEach((id) => vis.add(id));
      }
      setExpanded(exp);
      setVisited(vis);
      setLit(litSet);
      const act = steps[target]?.activate || [];
      setActiveIds(act);
      activeIdsRef.current = act;
      setStepIdx(target);
      stepIdxRef.current = target;
      setDetailHtml(target < 0 ? WELCOME(tour.name) : renderTourDetailHtml(steps[target], target, steps.length));
    },
    [steps, tour.name]
  );

  const prev = useCallback(() => {
    stopPlay();
    if (stepIdxRef.current <= 0) {
      goTo(-1);
      clearDecorations();
      setDetailHtml(WELCOME(tour.name));
      return;
    }
    goTo(stepIdxRef.current - 1);
  }, [stopPlay, goTo, clearDecorations, tour.name]);

  const reset = useCallback(() => {
    stopPlay();
    setStepIdx(-1);
    stepIdxRef.current = -1;
    activeIdsRef.current = [];
    clearDecorations();
    setDetailHtml(WELCOME(tour.name));
  }, [stopPlay, clearDecorations, tour.name]);

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const advanced = advance();
    if (!advanced || stepIdxRef.current >= steps.length - 1) {
      stopPlay();
      return;
    }
    timerRef.current = setTimeout(() => tickRef.current(), speedRef.current);
  }, [advance, steps.length, stopPlay]);

  useEffect(() => { tickRef.current = tick; }, [tick]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      stopPlay();
      return;
    }
    if (stepIdxRef.current >= steps.length - 1) {
      // restart from the top
      setStepIdx(-1);
      stepIdxRef.current = -1;
      activeIdsRef.current = [];
      clearDecorations();
    }
    playingRef.current = true;
    setPlaying(true);
    tickRef.current();
  }, [stopPlay, steps.length, clearDecorations]);

  const toggleTreeAll = useCallback(() => {
    const t = treeRef.current;
    if (!t) return;
    const nextAll = !allExpanded;
    setAllExpanded(nextAll);
    if (!nextAll) {
      setExpanded(new Set());
      return;
    }
    const ids: string[] = [];
    t.querySelectorAll<HTMLElement>('li[id]').forEach((li) => {
      if (li.querySelector(':scope > .tnode .chevron')) ids.push(li.id);
    });
    setExpanded(new Set(ids));
  }, [allExpanded]);

  // Expand all ancestors of a skill node and select it (from a detail chip).
  const navigateToSkill = useCallback((skillId: string) => {
    const t = treeRef.current;
    if (t) {
      const node = t.querySelector<HTMLElement>(`.tnode[data-skill="${CSS.escape(skillId)}"]`);
      if (node) {
        const ancestors: string[] = [];
        let parentLi = node.closest('li')?.parentElement?.closest('li') as HTMLElement | null;
        while (parentLi) {
          if (parentLi.id) ancestors.push(parentLi.id);
          parentLi = parentLi.parentElement?.closest('li') as HTMLElement | null;
        }
        if (ancestors.length) setExpanded((p) => new Set([...p, ...ancestors]));
      }
    }
    setUserSel(`.tnode[data-skill="${CSS.escape(skillId)}"]`);
    setDetailHtml(renderNodeDetailHtml(skillId));
  }, []);

  // Cleanup timer on unmount.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Keyboard shortcuts (component only mounts while Tours mode is active).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'p' || e.key === 'P') {
        togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, togglePlay, reset]);

  // Tree click delegation (chevron toggle + node selection).
  const onTreeClick = useCallback((e: React.MouseEvent) => {
    const tnode = (e.target as HTMLElement).closest('.tnode') as HTMLElement | null;
    if (!tnode || !treeRef.current?.contains(tnode)) return;
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
      setUserSel(`.tnode[data-skill="${CSS.escape(skillId)}"]`);
      setDetailHtml(renderNodeDetailHtml(skillId));
    } else if (!skillId) {
      const nameEl = tnode.querySelector('.name');
      if (nameEl && tnode.id) {
        const typeClass = Array.from(tnode.classList).find((c) => c.startsWith('type-')) || '';
        const typeName = typeClass.replace('type-', '') || 'node';
        setUserSel('#' + CSS.escape(tnode.id));
        setDetailHtml(renderNodeLabelHtml(nameEl.textContent || '', typeName));
      }
    }
  }, []);

  // Detail-pane click delegation (nav chips, copy prompt, learn, copy code).
  const onDetailClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const navEl = target.closest('[data-nav]') as HTMLElement | null;
      if (navEl) {
        navigateToSkill(navEl.getAttribute('data-nav')!);
        return;
      }
      const promptEl = target.closest('[data-copy-prompt]') as HTMLElement | null;
      if (promptEl) {
        const s = SKILL_MAP[promptEl.getAttribute('data-copy-prompt')!];
        if (s?.prompt) {
          navigator.clipboard.writeText(s.prompt).then(() => {
            const orig = promptEl.textContent;
            promptEl.textContent = 'Copied!';
            setTimeout(() => { promptEl.textContent = orig; }, 2000);
          });
        }
        return;
      }
      const academyEl = target.closest('[data-academy]') as HTMLElement | null;
      if (academyEl) {
        onLearn(academyEl.getAttribute('data-academy')!);
        return;
      }
      const copyCodeEl = target.closest('[data-copy-code]') as HTMLElement | null;
      if (copyCodeEl) {
        const block = copyCodeEl.previousElementSibling as HTMLElement | null;
        if (block) {
          navigator.clipboard.writeText(block.textContent || '').then(() => {
            copyCodeEl.textContent = 'Copied!';
            copyCodeEl.classList.add('copied');
            setTimeout(() => {
              copyCodeEl.textContent = 'Copy';
              copyCodeEl.classList.remove('copied');
            }, 2000);
          });
        }
      }
    },
    [navigateToSkill, onLearn]
  );

  const stepDisplay = useMemo(() => `${stepIdx + 1} / ${steps.length}`, [stepIdx, steps.length]);

  return (
    <div className="sn-tours-root">
      <div className="tour-picker">
        {TOUR_META.map((t) => (
          <div
            key={t.id}
            className={`tour-card${curTour === t.id ? ' active' : ''}`}
            onClick={() => selectTour(t.id)}
          >
            <h3>{t.title}</h3>
            <p>{t.blurb}</p>
          </div>
        ))}
      </div>
      <div className="tour-controls">
        <button className={playing ? 'active' : ''} onClick={togglePlay}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={reset}>↺ Reset</button>
        <button onClick={prev}>◀ Prev</button>
        <button onClick={next}>Next ▶</button>
        <span className="tour-sep" />
        <button onClick={toggleTreeAll}>{allExpanded ? '⊟ Collapse All' : '⊞ Expand All'}</button>
        <div className={`tour-step-info${stepIdx >= 0 ? ' hl' : ''}`}>{stepDisplay}</div>
        <div className="speed-ctl">
          <label>Speed</label>
          <input
            type="range"
            min={1}
            max={5}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
          />
          <span>{SPEED_LBL[speed]}</span>
        </div>
      </div>
      <div className="tour-body">
        <div className="tour-tree-wrap">
          <div
            className="ttree"
            ref={treeRef}
            onClick={onTreeClick}
            key={curTour}
            dangerouslySetInnerHTML={{ __html: tour.tree }}
          />
        </div>
        <div
          className="tour-detail"
          onClick={onDetailClick}
          dangerouslySetInnerHTML={{ __html: detailHtml }}
        />
      </div>
    </div>
  );
}
