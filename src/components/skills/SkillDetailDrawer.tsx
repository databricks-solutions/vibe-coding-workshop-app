import { useEffect, useState } from 'react';
import { SKILL_MAP } from '../../constants/skillsNavigatorData';
import { typeColor, stripHtml, highlightCode } from './skillsNavUtils';

interface SkillDetailDrawerProps {
  skillId: string | null;
  onClose: () => void;
  onNavigate: (skillId: string) => void;
  onLearn: (platform: string) => void;
}

/** Mode 3 — slide-in skill deep-dive panel (ported from openDetail()). */
export function SkillDetailDrawer({ skillId, onClose, onNavigate, onLearn }: SkillDetailDrawerProps) {
  const s = skillId ? SKILL_MAP[skillId] : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [skillId]);

  // Escape closes the panel while it's open.
  useEffect(() => {
    if (!skillId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skillId, onClose]);

  // Lock body scroll + Escape handled by parent; this only renders when open.
  const open = !!s;

  const stageLabel = s
    ? s.stage
      ? `Stage ${s.stage}`
      : s.phase !== undefined
        ? `Phase ${s.phase}`
        : ''
    : '';

  const copyPrompt = () => {
    if (!s?.prompt) return;
    navigator.clipboard.writeText(s.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div
        className={`detail-overlay${open ? ' open' : ''}`}
        onClick={onClose}
      />
      <div className={`detail-panel${open ? ' open' : ''}`}>
        {s && (
          <>
            <div className="dp-header">
              <button className="dp-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
              <div className="dp-title">{s.name}</div>
              <div className="dp-badges">
                <span className="dp-badge" style={{ background: typeColor(s.type).bg, color: typeColor(s.type).fg }}>
                  {s.type}
                </span>
                {stageLabel && (
                  <span className="dp-badge" style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
                    {stageLabel}
                  </span>
                )}
                {s.component && (
                  <span className="dp-badge" style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
                    {s.component}
                  </span>
                )}
              </div>
              <div className="dp-desc" dangerouslySetInnerHTML={{ __html: s.desc || '' }} />
            </div>

            {s.keywords && s.keywords.length > 0 && (
              <div className="dp-section">
                <h4>Keywords (Routing Triggers)</h4>
                <div className="dp-keywords">
                  {s.keywords.map((k) => (
                    <span className="dp-kw" key={k}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {s.workers && s.workers.length > 0 && (
              <div className="dp-section">
                <h4>Workers ({s.workers.length})</h4>
                <div className="dp-deps">
                  {s.workers.map((wid) => {
                    const w = SKILL_MAP[wid];
                    if (!w) return null;
                    return (
                      <div className="dp-dep" key={wid} onClick={() => onNavigate(wid)}>
                        <div className="dd-icon" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                          W
                        </div>
                        {w.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {s.commonDeps && s.commonDeps.length > 0 && (
              <div className="dp-section">
                <h4>Common Dependencies</h4>
                <div className="dp-deps">
                  {s.commonDeps.map((did) => {
                    const d = SKILL_MAP[did];
                    if (!d) return null;
                    return (
                      <div className="dp-dep" key={did} onClick={() => onNavigate(did)}>
                        <div className="dd-icon" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                          C
                        </div>
                        {d.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {s.emits && s.emits.length > 0 && (
              <div className="dp-section">
                <h4>Emits</h4>
                <div className="dp-keywords">
                  {s.emits.map((e) => (
                    <span className="dp-kw" key={e}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {s.code && (
              <div className="dp-section">
                <h4>Key Code Pattern</h4>
                <div className="dp-code" dangerouslySetInnerHTML={{ __html: highlightCode(s.code) }} />
              </div>
            )}

            {(s.prompt || s.platform) && (
              <div className="dp-actions">
                {s.prompt && (
                  <button className="dp-btn primary" onClick={copyPrompt}>
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                )}
                {s.platform && (
                  <button
                    className="dp-btn secondary"
                    onClick={() => {
                      onClose();
                      onLearn(s.platform!);
                    }}
                    title={stripHtml(s.desc)}
                  >
                    Learn: {s.platform}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
