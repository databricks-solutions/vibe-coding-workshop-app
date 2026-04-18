import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, BookOpen, ArrowRight, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';
import { BorderBeamButton } from './BorderBeamButton';

const YOUTUBE_VIDEO_ID = 'MUa5kbIV1Lc';
const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`;
const YOUTUBE_WATCH_URL = `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`;
const YOUTUBE_THUMBNAIL = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`;

type VideoState = 'loading' | 'loaded' | 'error';

function WorkshopVideo() {
  const [state, setState] = useState<VideoState>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRetry = useCallback(() => {
    setState('loading');
    setRetryKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (state === 'loading') {
      timeoutRef.current = setTimeout(() => {
        setState(prev => prev === 'loading' ? 'error' : prev);
      }, 8000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [state, retryKey]);

  if (state === 'error') {
    return (
      <a
        href={YOUTUBE_WATCH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block w-full aspect-video bg-slate-900 group"
      >
        <img
          src={YOUTUBE_THUMBNAIL}
          alt="Workshop Walkthrough"
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-11 bg-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:bg-red-500 transition-colors">
            <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span className="text-ui-xs text-white/80 bg-black/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" />
            Watch on YouTube
          </span>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRetry(); }}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          title="Retry embed"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </a>
    );
  }

  return (
    <div className="relative w-full aspect-video">
      {state === 'loading' && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-2 z-10">
          <img
            src={YOUTUBE_THUMBNAIL}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="relative flex items-center gap-2 text-ui-sm text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading video...
          </div>
        </div>
      )}
      <iframe
        key={retryKey}
        src={YOUTUBE_EMBED_URL}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Workshop Walkthrough Video"
        loading="lazy"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </div>
  );
}

interface WorkshopIntroProps {
  /** When true, collapses the section by default. User can still manually expand. */
  forceCollapsed?: boolean;
  /** Callback fired when user clicks the "Get Started" CTA. */
  onGetStarted?: () => void;
  /** When true, the user has already moved past the welcome stage. Shows a "Started" badge instead of the CTA. */
  hasStarted?: boolean;
}

/**
 * WorkshopIntro Component
 * 
 * A self-contained, collapsible section that introduces the workshop.
 *
 * Uses derived state for expand/collapse to eliminate timing issues:
 * - autoExpanded is computed from forceCollapsed on every render
 * - userOverride only tracks manual toggles, reset when forceCollapsed transitions to true
 */
export function WorkshopIntro({ forceCollapsed = false, onGetStarted, hasStarted = false }: WorkshopIntroProps) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceCollapsed = useRef(forceCollapsed);

  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) {
      setUserOverride(null);
    }
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  // forceCollapsed sets the default; user can still manually expand
  const isExpanded = userOverride ?? (forceCollapsed ? false : true);

  const handleToggle = () => setUserOverride(!isExpanded);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={handleToggle}
        className="group w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      >
        <div className="p-2 rounded-md bg-primary/20">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-ui-md2 font-semibold text-foreground">
            Workshop Overview
          </h2>
          <p className="text-muted-foreground text-ui-base">
            What you'll learn and build in this hands-on workshop
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
          <div className="px-4 sm:px-6 pb-6">
            {/* Two-column layout: Intro + Key Learnings | Video -- stacks on small screens */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Column: Professional intro + 3 key learnings */}
              <div className="flex-1 min-w-0">
                <p className="text-ui-md text-foreground leading-relaxed mb-5">
                  In this workshop, you will learn <strong className="text-foreground">vibe engineering techniques</strong> to 
                  effectively leverage AI coding assistant tools, combined with <strong className="text-foreground">Databricks 
                  best practices</strong> embedded as AI agent skills, to take an idea or intent into an end-to-end 
                  application that is production-ready.
                </p>
                
                <p className="text-ui-md font-semibold text-foreground mb-3">3 Key Learnings:</p>
                
                <ul className="space-y-3 text-ui-base text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 font-bold">1.</span>
                    <span>
                      How to <strong className="text-foreground">vibe code with intent</strong> — fast, structured, and repeatable
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 font-bold">2.</span>
                    <span>
                      Take an idea through the <strong className="text-foreground">full lifecycle</strong> in a gamified, engaging experience—from defining the concept to building, deploying, and iterating on a real solution.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 font-bold">3.</span>
                    <span>
                      How to apply <strong className="text-foreground">Databricks best practices</strong> through embedded <a href="https://agentskills.io/home" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">agent skills</a>, ensuring that AI-generated code stays governed, trusted, and production-ready.
                    </span>
                  </li>
                </ul>
              </div>
              
              {/* Right Column: Workshop Video */}
              <div className="w-full lg:w-[23.75rem] lg:flex-shrink-0">
                <div className="rounded-xl overflow-hidden border border-border bg-slate-900/50 shadow-lg">
                  <div className="px-3 py-2 bg-slate-800/80 border-b border-border">
                    <p className="text-ui-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      Workshop Walkthrough
                    </p>
                  </div>
                  <WorkshopVideo />
                </div>
                <p className="text-ui-xs text-muted-foreground mt-2 text-center">
                  Watch the full workshop walkthrough
                </p>
              </div>
            </div>

            {/* Get Started CTA / Started badge */}
            {onGetStarted && (
              <div className="flex justify-center pt-4 pb-1">
                {hasStarted ? (
                  <div className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-ui-base font-medium animate-fade-in">
                    <CheckCircle className="w-4 h-4" /> Started
                  </div>
                ) : (
                  <BorderBeamButton
                    active
                    onClick={onGetStarted}
                    className="px-8 py-3 text-ui-md2 font-semibold inline-flex items-center gap-2.5"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5" />
                  </BorderBeamButton>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
