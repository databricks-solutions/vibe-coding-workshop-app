import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Cpu,
  Cog,
  Shield,
  Bot,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  Compass,
  BookOpen,
  Package,
  Upload,
  Download,
  Eye,
  Maximize2,
  X,
} from 'lucide-react';
import {
  TIER1_FOUNDATION,
  type SkillBlueprintConfig,
  type SkillItem,
  type SkillSection,
  type SkillType,
} from '../constants/skillTreeMapping';
import { SkillContentModal, isSkillViewable } from './SkillContentModal';

interface SkillBlueprintTabProps {
  config: SkillBlueprintConfig;
  shouldAnimate: boolean;
  onMounted?: () => void;
}

/* =============================================================================
   TYPE → VISUAL MAPPING
   ============================================================================= */

const TYPE_STYLES: Record<SkillType, {
  icon: typeof FileText;
  bg: string;
  border: string;
  text: string;
  badge: string;
  label: string;
}> = {
  entry:        { icon: Compass,  bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',   text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300',    label: 'Entry' },
  router:       { icon: Compass,  bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',   text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300',    label: 'Router' },
  orchestrator: { icon: Cpu,      bg: 'bg-purple-500/10',  border: 'border-purple-500/30', text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300', label: 'Orchestrator' },
  worker:       { icon: Cog,      bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300',   label: 'Worker' },
  common:       { icon: Shield,   bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300',label: 'Shared' },
  admin:        { icon: FileText, bg: 'bg-slate-500/10',   border: 'border-slate-500/30',  text: 'text-slate-400',   badge: 'bg-slate-500/20 text-slate-300',   label: 'Admin' },
  'agent-prompt':{ icon: Bot,     bg: 'bg-violet-500/10',  border: 'border-violet-500/30', text: 'text-violet-400',  badge: 'bg-violet-500/20 text-violet-300', label: 'Agent Prompt' },
  reference:    { icon: BookOpen, bg: 'bg-orange-500/10',  border: 'border-orange-500/30', text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300', label: 'Reference' },
  manifest:     { icon: Package,  bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300',   label: 'Manifest' },
  input:        { icon: Upload,   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300',   label: 'Input' },
};

const SECTION_ACCENT_MAP: Record<string, {
  border: string;
  bg: string;
  text: string;
  headerBg: string;
}> = {
  cyan:    { border: 'border-l-cyan-500',    bg: 'bg-cyan-500/5',    text: 'text-cyan-400',    headerBg: 'bg-cyan-500/8' },
  purple:  { border: 'border-l-purple-500',  bg: 'bg-purple-500/5',  text: 'text-purple-400',  headerBg: 'bg-purple-500/8' },
  indigo:  { border: 'border-l-indigo-500',  bg: 'bg-indigo-500/5',  text: 'text-indigo-400',  headerBg: 'bg-indigo-500/8' },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-400', headerBg: 'bg-emerald-500/8' },
  gold:    { border: 'border-l-amber-500',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   headerBg: 'bg-amber-500/8' },
  amber:   { border: 'border-l-amber-500',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   headerBg: 'bg-amber-500/8' },
  violet:  { border: 'border-l-violet-500',  bg: 'bg-violet-500/5',  text: 'text-violet-400',  headerBg: 'bg-violet-500/8' },
  orange:  { border: 'border-l-orange-500',  bg: 'bg-orange-500/5',  text: 'text-orange-400',  headerBg: 'bg-orange-500/8' },
};

const TIER_BADGES: Record<number, { label: string; color: string }> = {
  1: { label: 'Tier 1', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  2: { label: 'Tier 2', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  3: { label: 'Tier 3', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  4: { label: 'Tier 4', color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
};

/* =============================================================================
   SUB-COMPONENTS
   ============================================================================= */

function SkillCard({ skill, compact, shouldAnimate, animDelay, onView }: {
  skill: SkillItem;
  compact?: boolean;
  shouldAnimate: boolean;
  animDelay: number;
  onView?: (skill: SkillItem) => void;
}) {
  const styles = TYPE_STYLES[skill.type];
  const Icon = styles.icon;
  const isOrchestrator = skill.type === 'orchestrator';
  const viewable = isSkillViewable(skill.type);

  return (
    <div
      className={`
        rounded-lg border transition-all duration-200
        ${styles.bg} ${styles.border}
        ${isOrchestrator ? 'animate-skill-orchestrator-glow' : ''}
        ${compact ? 'p-2' : 'p-3'}
        ${shouldAnimate ? 'animate-skill-worker-materialize' : ''}
        ${viewable ? 'cursor-pointer hover:brightness-125 hover:scale-[1.01]' : 'hover:brightness-110'}
        group
      `}
      style={shouldAnimate ? { animationDelay: `${animDelay}ms` } : undefined}
      onClick={viewable && onView ? () => onView(skill) : undefined}
    >
      <div className="flex items-start gap-2">
        <div className={`
          flex-shrink-0 rounded-md flex items-center justify-center
          ${styles.bg} border ${styles.border}
          ${compact ? 'w-6 h-6' : 'w-7 h-7'}
        `}>
          <Icon className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${styles.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold ${styles.text} truncate`}>
              {skill.name}
            </span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${styles.badge} flex-shrink-0 leading-tight`}>
              {styles.label}
            </span>
            {viewable && (
              <Eye className={`w-3 h-3 ${styles.text} opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0`} />
            )}
          </div>
          <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-muted-foreground/50 font-mono truncate`}>
            {skill.shortPath}
          </div>
          {skill.description && !compact && (
            <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
              {skill.description}
            </p>
          )}
          {skill.description && compact && (
            <p className={`text-[11px] text-muted-foreground/70 mt-1 leading-relaxed ${
              skill.type === 'common'
                ? ''
                : 'opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-20 transition-all duration-200 overflow-hidden'
            }`}>
              {skill.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowConnector({ shouldAnimate, delay }: { shouldAnimate: boolean; delay: number }) {
  return (
    <div
      className={`flex justify-center py-1 ${shouldAnimate ? 'animate-skill-section-reveal' : ''}`}
      style={shouldAnimate ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex flex-col items-center">
        <div className={`w-[2px] h-3 ${shouldAnimate ? 'animate-skill-path-pulse' : 'bg-border'} rounded-full`} />
        <ArrowDown className="w-3 h-3 text-muted-foreground/40 -mt-0.5" />
      </div>
    </div>
  );
}

const WORKER_COLLAPSE_THRESHOLD = 4;

function SectionBlock({ section, sectionIndex, shouldAnimate, baseDelay, onViewSkill }: {
  section: SkillSection;
  sectionIndex: number;
  shouldAnimate: boolean;
  baseDelay: number;
  onViewSkill?: (skill: SkillItem) => void;
}) {
  const accent = SECTION_ACCENT_MAP[section.accent] ?? SECTION_ACCENT_MAP.cyan;
  const tierBadge = TIER_BADGES[section.tier];
  const hasWorkerGrid = section.skills.length > 1 &&
    section.skills.every(s => s.type === 'worker' || s.type === 'common' || s.type === 'reference');
  const isCollapsible = section.skills.length > WORKER_COLLAPSE_THRESHOLD;
  const [isExpanded, setIsExpanded] = useState(!isCollapsible);

  const displaySkills = isExpanded ? section.skills : section.skills.slice(0, WORKER_COLLAPSE_THRESHOLD);
  const hiddenCount = section.skills.length - WORKER_COLLAPSE_THRESHOLD;
  const sectionDelay = baseDelay + sectionIndex * 140;

  return (
    <div
      className={`
        border-l-[3px] ${accent.border} rounded-r-lg overflow-hidden
        ${shouldAnimate ? 'animate-skill-section-reveal' : ''}
      `}
      style={shouldAnimate ? { animationDelay: `${sectionDelay}ms` } : undefined}
    >
      <div className={`px-3 py-2 ${accent.headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${accent.text}`}>
              {section.label}
            </span>
            <span className="text-[10px] text-muted-foreground/40">
              {section.skills.length} {section.skills.length === 1 ? 'skill' : 'skills'}
            </span>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tierBadge.color}`}>
            {tierBadge.label}
          </span>
        </div>
        {section.description && (
          <p className="text-[10px] text-muted-foreground/50 italic mt-1 leading-relaxed">
            {section.description}
          </p>
        )}
      </div>

      <div className={`p-2.5 ${accent.bg}`}>
        {hasWorkerGrid && section.skills.length > 2 ? (
          <div className="grid grid-cols-2 gap-2">
            {displaySkills.map((skill, i) => (
              <SkillCard
                key={skill.shortPath + i}
                skill={skill}
                compact
                shouldAnimate={shouldAnimate}
                animDelay={sectionDelay + 80 + i * 50}
                onView={onViewSkill}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displaySkills.map((skill, i) => (
              <SkillCard
                key={skill.shortPath + i}
                skill={skill}
                compact={section.skills.length > 2}
                shouldAnimate={shouldAnimate}
                animDelay={sectionDelay + 80 + i * 50}
                onView={onViewSkill}
              />
            ))}
          </div>
        )}

        {isCollapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              mt-2 w-full flex items-center justify-center gap-1
              text-[11px] font-medium py-1.5 rounded-md
              ${accent.text} hover:bg-white/5 transition-colors
            `}
          >
            {isExpanded ? (
              <><ChevronDown className="w-3 h-3" /> Show less</>
            ) : (
              <><ChevronRight className="w-3 h-3" /> Show {hiddenCount} more</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function FoundationBar({ shouldAnimate, onViewSkill }: { shouldAnimate: boolean; onViewSkill?: (skill: SkillItem) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const foundation = TIER1_FOUNDATION;

  return (
    <div
      className={`
        rounded-lg border border-cyan-500/20 overflow-hidden
        ${shouldAnimate ? 'animate-skill-section-reveal' : ''}
      `}
      style={shouldAnimate ? { animationDelay: '0ms' } : undefined}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 bg-cyan-500/5 hover:bg-cyan-500/8 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-400 border-cyan-500/25`}>
            Tier 1
          </span>
          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
            Foundation — Always Loaded
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            {foundation.skills.length} skills
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            {foundation.skills.map((s, i) => (
              <span
                key={i}
                className={`
                  text-[9px] px-1.5 py-0.5 rounded-full
                  ${TYPE_STYLES[s.type].badge}
                  ${shouldAnimate ? 'animate-skill-node-pop' : ''}
                `}
                style={shouldAnimate ? { animationDelay: `${i * 100}ms` } : undefined}
              >
                {s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name}
              </span>
            ))}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-cyan-400/60" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-cyan-400/60" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-2.5 bg-cyan-500/3 border-t border-cyan-500/10 space-y-2">
          {foundation.skills.map((skill, i) => (
            <SkillCard
              key={skill.shortPath}
              skill={skill}
              compact={false}
              shouldAnimate={shouldAnimate}
              animDelay={i * 60}
              onView={onViewSkill}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManifestBadge({ type, path, shouldAnimate, delay }: {
  type: 'consumes' | 'emits';
  path: string;
  shouldAnimate: boolean;
  delay: number;
}) {
  const isConsumes = type === 'consumes';
  return (
    <div
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium
        ${isConsumes
          ? 'bg-blue-500/8 text-blue-400 border border-blue-500/20'
          : 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/20'
        }
        ${shouldAnimate ? 'animate-skill-worker-materialize' : ''}
      `}
      style={shouldAnimate ? { animationDelay: `${delay}ms` } : undefined}
    >
      {isConsumes ? <Download className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
      <span className="font-semibold">{isConsumes ? 'Consumes:' : 'Emits:'}</span>
      <span className="font-mono opacity-80 truncate">{path}</span>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export function SkillBlueprintTab({ config, shouldAnimate, onMounted }: SkillBlueprintTabProps) {
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  useEffect(() => {
    onMounted?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSkills = TIER1_FOUNDATION.skills.length +
    config.sections.reduce((sum, s) => sum + s.skills.length, 0);

  const handleViewSkill = (skill: SkillItem) => setSelectedSkill(skill);

  return (
    <div className="space-y-0">
      {/* Summary header */}
      <div
        className={`mb-3 ${shouldAnimate ? 'animate-skill-section-reveal' : ''}`}
        style={shouldAnimate ? { animationDelay: '0ms' } : undefined}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
            {config.stageLabel}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            {totalSkills} skills in traversal
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          {config.summary}
        </p>
        <p className="text-[10px] text-muted-foreground/40 mt-1 italic">
          Click any skill card to view its full content
        </p>
      </div>

      {/* Manifest: Consumes */}
      {config.consumes && (
        <>
          <ManifestBadge
            type="consumes"
            path={config.consumes}
            shouldAnimate={shouldAnimate}
            delay={50}
          />
          <div className="h-2" />
        </>
      )}

      {/* Tier 1: Foundation — always rendered */}
      <FoundationBar shouldAnimate={shouldAnimate} onViewSkill={handleViewSkill} />

      {/* Flow connector: Tier 1 → Tier 2 */}
      <FlowConnector shouldAnimate={shouldAnimate} delay={120} />

      {/* Step-specific sections with flow connectors between them */}
      {config.sections.map((section, i) => (
        <div key={section.label + i}>
          <SectionBlock
            section={section}
            sectionIndex={i}
            shouldAnimate={shouldAnimate}
            baseDelay={200}
            onViewSkill={handleViewSkill}
          />
          {i < config.sections.length - 1 && (
            <FlowConnector shouldAnimate={shouldAnimate} delay={200 + (i + 1) * 140} />
          )}
        </div>
      ))}

      {/* Manifest: Emits */}
      {config.emits && config.emits.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <FlowConnector shouldAnimate={shouldAnimate} delay={200 + config.sections.length * 140} />
          {config.emits.map((path, i) => (
            <ManifestBadge
              key={path}
              type="emits"
              path={path}
              shouldAnimate={shouldAnimate}
              delay={200 + config.sections.length * 140 + 100 + i * 60}
            />
          ))}
        </div>
      )}

      {/* Skill content viewer modal */}
      {selectedSkill && (
        <SkillContentModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
    </div>
  );
}

/* =============================================================================
   FULL-SCREEN MODAL WRAPPER
   ============================================================================= */

interface SkillBlueprintFullScreenModalProps {
  config: SkillBlueprintConfig;
  title?: string;
}

export function SkillBlueprintFullScreenModal({
  config,
  title = 'Agent Skills',
}: SkillBlueprintFullScreenModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalSkills = TIER1_FOUNDATION.skills.length +
    config.sections.reduce((sum, s) => sum + s.skills.length, 0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-all hover:scale-105 text-cyan-400 hover:bg-cyan-900/30 border-cyan-500/30"
        title="View in full screen"
      >
        <Maximize2 className="w-3 h-3" />
        <span>View full screen</span>
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, width: '100vw', height: '100vh' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="absolute inset-0 bg-black/90"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />

          <div
            className="relative bg-card border border-border rounded-lg shadow-2xl flex flex-col"
            style={{ width: 'calc(100vw - 48px)', height: 'calc(100vh - 48px)', maxWidth: 'none', zIndex: 100000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
              <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                {title}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="max-w-3xl mx-auto">
                <SkillBlueprintTab config={config} shouldAnimate={false} />
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-[11px] text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">Esc</kbd> to close
              </span>
              <span className="text-[11px] text-muted-foreground">
                {totalSkills} skills • {config.sections.length} tiers
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
