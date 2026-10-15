/**
 * CelebrationOverlay - Kahoot-style celebration animations
 * 
 * Shows celebratory feedback when users complete steps or chapters:
 * - Step completion: Quick confetti burst with points (auto-dismiss)
 * - Chapter/Milestone: Persistent modal with score, typing learning summary,
 *   clickable Databricks service popovers, thumbs up/down feedback, and Close button
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { 
  Trophy, Sparkles, Star, ThumbsUp, ThumbsDown, X,
  Globe, HardDrive, Database, Layers, Zap, Bot, LayoutDashboard, Brain,
  type LucideIcon
} from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { CHAPTER_LEARNING } from '../constants/chapterLearning';
import { buildServiceNameMap, renderTextWithServices } from './TypingText';
import { ServicePopover, serviceData } from './ServicePopover';
import type { ServiceKey } from './ServicePopover';
import { apiClient } from '../api/client';
import { ConfettiBurst } from './celebration/ConfettiBurst';
import { AnimatedPoints } from './celebration/AnimatedPoints';

// ============== Service Icon Mapping ==============
// Maps each service key to its lucide icon + color (matching Architecture Overview)

const SERVICE_ICONS: Record<string, { icon: LucideIcon; colorClass: string }> = {
  databricksApp:  { icon: Globe,           colorClass: 'text-[#FF3621]' },
  lakebase:       { icon: HardDrive,       colorClass: 'text-violet-400' },
  dataIngestion:  { icon: Database,        colorClass: 'text-teal-400' },
  bronze:         { icon: Layers,          colorClass: 'text-orange-400' },
  silver:         { icon: Sparkles,        colorClass: 'text-slate-300' },
  gold:           { icon: Zap,             colorClass: 'text-yellow-400' },
  sdp:            { icon: Layers,          colorClass: 'text-teal-300' },
  tvf:            { icon: Database,        colorClass: 'text-amber-400' },
  metricViews:    { icon: LayoutDashboard, colorClass: 'text-amber-400' },
  genieSpaces:    { icon: Brain,           colorClass: 'text-blue-400' },
  aiBIDashboards: { icon: LayoutDashboard, colorClass: 'text-green-400' },
  agents:         { icon: Bot,             colorClass: 'text-blue-400' },
};

function ServiceIcon({ serviceKey }: { serviceKey: ServiceKey }) {
  const config = SERVICE_ICONS[serviceKey];
  if (!config) return null;
  const Icon = config.icon;
  return <Icon className={`w-4 h-4 ${config.colorClass}`} />;
}

// ============== Types ==============

export interface CelebrationData {
  type: 'step' | 'milestone';
  pointsEarned: number;
  stepTitle?: string;
  milestoneTitle?: string;  // Chapter display name for milestones
  chapterName?: string;     // Chapter key for learning content lookup (e.g. "Chapter 1")
  sessionId?: string;       // Session ID for feedback submission
  totalScore?: number;
  leaderboardMessage?: string;  // e.g., "5 points to Top 10!"
  // Optional milestone slots for other flows; omitted, the modal looks exactly as it does in the workshop.
  icon?: LucideIcon;            // replaces the trophy
  image?: string;               // illustration above the title, instead of the trophy tile
  congratsTitle?: string;       // overrides "<Chapter> Complete!"
  body?: ReactNode;             // replaces "What you learned" and the services list
  hideFeedback?: boolean;
  primaryAction?: { label: string; onClick: () => void };
  closeLabel?: string;
}

interface CelebrationOverlayProps {
  celebration: CelebrationData | null;
  onComplete: () => void;
}

// ============== Step Celebration (Quick) ==============
// Untouched from original - auto-dismiss after 1.6s

function StepCelebration({ 
  pointsEarned, 
  stepTitle,
  onComplete 
}: { 
  pointsEarned: number; 
  stepTitle?: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  
  useEffect(() => {
    const showTimer = setTimeout(() => setPhase('show'), 100);
    const exitTimer = setTimeout(() => setPhase('exit'), 1200);
    const completeTimer = setTimeout(onComplete, 1600);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);
  
  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center pointer-events-none
        transition-opacity duration-300
        ${phase === 'enter' ? 'opacity-0' : ''}
        ${phase === 'show' ? 'opacity-100' : ''}
        ${phase === 'exit' ? 'opacity-0' : ''}
      `}
    >
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
      <ConfettiBurst count={35} centerX={50} centerY={45} spread={40} />
      <div 
        className={`relative z-10 flex flex-col items-center gap-2
          transition-all duration-500
          ${phase === 'enter' ? 'scale-50 opacity-0' : ''}
          ${phase === 'show' ? 'scale-100 opacity-100 animate-points-pop' : ''}
          ${phase === 'exit' ? 'scale-95 opacity-0 -translate-y-4' : ''}
        `}
      >
        <div className="relative">
          <div className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-green-400 to-teal-400 animate-glow-pulse-green">
            <AnimatedPoints points={pointsEarned} duration={600} suffix=" pts" />
          </div>
          <Sparkles className="absolute -top-2 -right-4 w-6 h-6 text-amber-400 animate-spin-slow" />
          <Star className="absolute -bottom-1 -left-3 w-5 h-5 text-amber-300 animate-pulse" />
        </div>
        {stepTitle && (
          <div className="text-sm text-muted-foreground/80 font-medium mt-1 animate-fade-in-up">
            {stepTitle}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Milestone Celebration (Redesigned) ==============
// Persistent modal with typing animation, service popovers, feedback, and Close button

function MilestoneCelebration({ 
  pointsEarned,
  milestoneTitle,
  chapterName,
  sessionId,
  totalScore,
  leaderboardMessage,
  icon: Icon = Trophy,
  image,
  congratsTitle,
  body,
  hideFeedback,
  primaryAction,
  closeLabel = 'Close',
  onComplete 
}: Omit<CelebrationData, 'type'> & { 
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const typingComplete = true;
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useEscapeKey(true, onComplete);

  // Look up chapter learning content
  const chapterKey = chapterName || milestoneTitle || '';
  const learning = body ? undefined : CHAPTER_LEARNING[chapterKey];
  
  // Smooth entrance
  useEffect(() => {
    const timer = setTimeout(() => setPhase('visible'), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle feedback submission
  const handleFeedback = useCallback(async (rating: 'up' | 'down') => {
    if (feedbackGiven || feedbackSubmitting) return;
    
    setFeedbackGiven(rating);
    setFeedbackSubmitting(true);
    
    if (sessionId && chapterKey) {
      try {
        await apiClient.submitChapterFeedback({
          session_id: sessionId,
          chapter_name: chapterKey,
          rating,
        });
      } catch (err) {
        console.error('Failed to submit chapter feedback:', err);
      }
    }
    
    setFeedbackSubmitting(false);
  }, [feedbackGiven, feedbackSubmitting, sessionId, chapterKey]);

  // Handle close with exit animation
  const handleClose = useCallback(() => {
    setPhase('exit');
    setTimeout(onComplete, 350);
  }, [onComplete]);

  const isVisible = phase === 'visible';
  const isExiting = phase === 'exit';
  
  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity
        ${phase === 'enter' ? 'opacity-0 duration-100' : ''}
        ${isVisible ? 'opacity-100 duration-400' : ''}
        ${isExiting ? 'opacity-0 duration-300' : ''}
      `}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-400
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />
      
      {/* Confetti (gentler, delayed) */}
      {isVisible && (
        <>
          <ConfettiBurst count={50} centerX={50} centerY={20} spread={50} />
          <ConfettiBurst count={25} centerX={30} centerY={30} spread={25} />
          <ConfettiBurst count={25} centerX={70} centerY={30} spread={25} />
        </>
      )}
      
      {/* Modal Card */}
      <div 
        ref={modalRef}
        className={`relative z-10 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto
          bg-card border border-border rounded-2xl shadow-2xl
          transition-all
          ${phase === 'enter' ? 'opacity-0 translate-y-8 scale-95 duration-100' : ''}
          ${isVisible ? 'opacity-100 translate-y-0 scale-100 duration-500 ease-out' : ''}
          ${isExiting ? 'opacity-0 translate-y-4 scale-98 duration-300' : ''}
        `}
      >
        {/* Close button (top right) */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Trophy Header */}
        <div className="pt-6 pb-4 px-6 text-center">
          <div className={`inline-flex transition-all duration-500 delay-200
            ${isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
          `}>
            {image ? (
              <img src={image} alt="" width={180} height={120} className="w-44 rounded-2xl" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-milestone-trophy">
                <Icon className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          
          <div className={`mt-3 transition-all duration-500 delay-300
            ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}
          `}>
            <div className="inline-block px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/25">
              <span className="text-base font-bold text-amber-400">
                {congratsTitle || learning?.congratsTitle || `${milestoneTitle || 'Chapter'} Complete!`}
              </span>
            </div>
          </div>
        </div>

        {/* Score Section */}
        <div className={`px-6 pb-4 text-center transition-all duration-500 delay-400
          ${isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}
        `}>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400 animate-glow-pulse-gold">
            <AnimatedPoints points={pointsEarned} duration={800} suffix=" pts" />
          </div>
          
          {totalScore !== undefined && (
            <div className="text-sm text-muted-foreground mt-1">
              Total: <span className="font-semibold text-foreground">{totalScore} pts</span>
            </div>
          )}
          
          {leaderboardMessage && (
            <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary/10 border border-primary/15">
              <span className="text-sm font-medium text-primary">
                {leaderboardMessage}
              </span>
            </div>
          )}
        </div>
        
        {/* Divider */}
        <div className="mx-6 border-t border-border" />
        
        {body && (
          <div className={`px-6 py-5 transition-all duration-500 delay-500
            ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}>
            {body}
          </div>
        )}

        {/* Learning Content - Static Display */}
        {learning && (
          <div className={`px-6 py-5 transition-all duration-500 delay-500
            ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              What you learned
            </h4>
            {(() => {
              const serviceNameMap = buildServiceNameMap(learning.services);
              return (
                <div className="space-y-2">
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {renderTextWithServices(learning.summary, serviceNameMap)}
                  </p>
                  <ul className="space-y-1.5 mt-2">
                    {learning.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80 leading-relaxed">
                        <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                        <span>{renderTextWithServices(bullet, serviceNameMap)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}

        {/* Databricks Services Used - Fades in after typing completes */}
        {learning && learning.services.length > 0 && (
          <div className={`px-6 pb-4 transition-all duration-500
            ${typingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
          `}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Databricks Services Used
            </h4>
            <div className="space-y-1">
              {learning.services.map((key) => {
                const service = serviceData[key];
                if (!service) return null;
                return (
                  <ServicePopover key={key} serviceKey={key} position="right">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-secondary/40 transition-all duration-150 cursor-pointer group">
                      <div className="p-1.5 rounded-md bg-secondary/60 group-hover:bg-secondary transition-colors">
                        <ServiceIcon serviceKey={key} />
                      </div>
                      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                        {service.name}
                      </span>
                      <span className="ml-auto text-ui-2xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                        Click for details
                      </span>
                    </div>
                  </ServicePopover>
                );
              })}
            </div>
          </div>
        )}

        {/* Feedback Section - Fades in after typing completes */}
        {!hideFeedback && <div className={`px-6 pb-4 transition-all duration-500
          ${typingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
        `}>
          <div className="flex items-center justify-center gap-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">How was this chapter?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFeedback('up')}
                disabled={feedbackGiven !== null}
                className={`p-2 rounded-lg transition-all duration-200
                  ${feedbackGiven === 'up' 
                    ? 'bg-emerald-500/20 text-emerald-400 scale-110' 
                    : feedbackGiven === 'down'
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400'
                  }
                `}
                title="Thumbs up"
              >
                <ThumbsUp className={`w-5 h-5 ${feedbackGiven === 'up' ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => handleFeedback('down')}
                disabled={feedbackGiven !== null}
                className={`p-2 rounded-lg transition-all duration-200
                  ${feedbackGiven === 'down' 
                    ? 'bg-red-500/20 text-red-400 scale-110' 
                    : feedbackGiven === 'up'
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'hover:bg-red-500/10 text-muted-foreground hover:text-red-400'
                  }
                `}
                title="Thumbs down"
              >
                <ThumbsDown className={`w-5 h-5 ${feedbackGiven === 'down' ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>}

        {/* Close Button */}
        <div className="px-6 pb-6 flex gap-2">
          {primaryAction && (
            <button
              onClick={() => { primaryAction.onClick(); handleClose(); }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm
                hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {primaryAction.label}
            </button>
          )}
          <button
            onClick={handleClose}
            className={primaryAction
              ? 'flex-1 py-2.5 px-4 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
              : `w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm
              hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50`}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Main Export ==============

export function CelebrationOverlay({ celebration, onComplete }: CelebrationOverlayProps) {
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);
  
  if (!celebration) return null;
  
  if (celebration.type === 'milestone') {
    return (
      <MilestoneCelebration {...celebration} onComplete={handleComplete} />
    );
  }
  
  return (
    <StepCelebration
      pointsEarned={celebration.pointsEarned}
      stepTitle={celebration.stepTitle}
      onComplete={handleComplete}
    />
  );
}

export default CelebrationOverlay;
