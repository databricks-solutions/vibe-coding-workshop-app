import { CheckCircle2, CheckCircle, Terminal, GitBranch, Download, Database, Loader2, ChevronDown, Copy, Check, Apple } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, type Prerequisite, type PrerequisiteCommand } from '../api/client';
import { BorderBeamButton } from './BorderBeamButton';

type SelectedOS = 'macos' | 'windows';

// Simple Windows icon (lucide-react doesn't include brand icons)
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5.548l7.024-.96v6.786H3V5.548zm0 12.904l7.024.96v-6.786H3v5.826zm7.89 1.077L22 21v-7.374H10.89v6.903zm0-14.058v6.903H22V3L10.89 5.471z"/>
    </svg>
  );
}

// Icon mapping for dynamic icons from backend
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Terminal,
  code: Terminal,
  GitBranch,
  Download,
  Database,
  CheckCircle2,
};

// Color mapping for icon backgrounds - subtle dark theme
const iconColorMap: Record<string, string> = {
  blue: 'bg-blue-900/40 text-blue-300',
  purple: 'bg-purple-900/40 text-purple-300',
  green: 'bg-emerald-900/40 text-emerald-300',
  orange: 'bg-orange-900/40 text-orange-300',
  pink: 'bg-pink-900/40 text-pink-300',
  yellow: 'bg-yellow-900/40 text-yellow-300',
  slate: 'bg-slate-800/60 text-slate-300',
};

// Helper function to render description with basic formatting
function renderDescription(text: string): React.ReactNode {
  // Guard against null/undefined
  if (!text) return null;
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  return paragraphs.map((paragraph, pIdx) => {
    // Split by single newlines for lines within paragraph
    const lines = paragraph.split('\n');
    
    return (
      <div key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
        {lines.map((line, lIdx) => {
          // Process bold text (**text**)
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const processedLine = parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIdx} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
            }
            // Process inline code (`code`)
            const codeParts = part.split(/(`[^`]+`)/g);
            return codeParts.map((codePart, codeIdx) => {
              if (codePart.startsWith('`') && codePart.endsWith('`')) {
                return (
                  <code key={`${partIdx}-${codeIdx}`} className="bg-background/80 px-1 py-0.5 rounded text-primary font-mono text-[11px]">
                    {codePart.slice(1, -1)}
                  </code>
                );
              }
              return codePart;
            });
          });
          
          return (
            <span key={lIdx}>
              {processedLine}
              {lIdx < lines.length - 1 && <br />}
            </span>
          );
        })}
      </div>
    );
  });
}

// Link color mapping - subtle dark theme
const linkColorMap: Record<string, string> = {
  blue: 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700/30',
  purple: 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border border-purple-700/30',
  green: 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-700/30',
  orange: 'bg-orange-900/30 text-orange-300 hover:bg-orange-900/50 border border-orange-700/30',
  pink: 'bg-pink-900/30 text-pink-300 hover:bg-pink-900/50 border border-pink-700/30',
  slate: 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/30',
};

interface PrerequisitesProps {
  /** Whether all prerequisites are marked as complete */
  isComplete?: boolean;
  /** Callback when user marks prerequisites as complete */
  onMarkComplete?: () => void;
  /** Whether to highlight the Mark Done button (for new sessions) */
  highlightMarkDone?: boolean;
  /** When set to true, programmatically expands the section */
  forceExpanded?: boolean;
  /** When true, forces the section collapsed. User can still manually expand. */
  forceCollapsed?: boolean;
  /** When true, hides the "Mark All Done" button entirely (used before user clicks "Get Started") */
  hideMarkDone?: boolean;
}

export function Prerequisites({ isComplete = false, onMarkComplete, highlightMarkDone = false, forceExpanded = false, forceCollapsed = false, hideMarkDone = false }: PrerequisitesProps) {
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [readyToComplete, setReadyToComplete] = useState(false);
  const prevForceCollapsed = useRef(forceCollapsed);

  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) setUserOverride(null);
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  // forceExpanded is authoritative; forceCollapsed sets the default (user can still override)
  const isExpanded = forceExpanded ? true : (userOverride ?? false);

  useEffect(() => {
    if (!isExpanded || isComplete) {
      setReadyToComplete(false);
      return;
    }
    setReadyToComplete(true);
  }, [isExpanded, isComplete]);
  const [selectedOS, setSelectedOS] = useState<SelectedOS>('macos');
  // Track selected commands per prerequisite: { [prereqId]: Set<commandIndex> }
  const [selectedCommands, setSelectedCommands] = useState<Record<number, Set<number>>>({});

  // Filter commands by selected OS: show if no os tag, os === 'all', or os matches selectedOS
  const getFilteredCommands = useCallback((commands?: PrerequisiteCommand[]): PrerequisiteCommand[] => {
    if (!commands) return [];
    return commands.filter(cmd => !cmd.os || cmd.os === 'all' || cmd.os === selectedOS);
  }, [selectedOS]);

  // Copy command to clipboard - now uses unique key
  const handleCopyCommand = async (uniqueKey: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(uniqueKey);
      // Reset after 2 seconds
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle mark complete - collapse and trigger callback
  const handleMarkComplete = () => {
    setUserOverride(false);
    if (onMarkComplete) {
      onMarkComplete(); // Trigger the parent callback (which navigates to Step 1)
    }
  };

  // Copy all selected commands for a prerequisite, joined by newlines
  const handleCopyAllCommands = async (prereqId: number, commands: PrerequisiteCommand[]) => {
    const selected = selectedCommands[prereqId];
    if (!selected || selected.size === 0) return;
    const combined = commands
      .filter((_, i) => selected.has(i))
      .map(c => c.cmd)
      .join('\n');
    try {
      await navigator.clipboard.writeText(combined);
      setCopiedCommand(`${prereqId}-all`);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Toggle a single command's selection within a prerequisite
  const toggleCommandSelection = (prereqId: number, idx: number) => {
    setSelectedCommands(prev => {
      const current = new Set(prev[prereqId] || []);
      if (current.has(idx)) {
        current.delete(idx);
      } else {
        current.add(idx);
      }
      return { ...prev, [prereqId]: current };
    });
  };

  // Select all or deselect all commands for a prerequisite
  const toggleSelectAll = (prereqId: number, totalCommands: number) => {
    setSelectedCommands(prev => {
      const current = prev[prereqId];
      const allSelected = current && current.size === totalCommands;
      if (allSelected) {
        return { ...prev, [prereqId]: new Set<number>() };
      } else {
        return { ...prev, [prereqId]: new Set(Array.from({ length: totalCommands }, (_, i) => i)) };
      }
    });
  };

  // Render a single command box with copy button and optional checkbox
  const renderCommandBox = (
    cmd: string,
    label: string | undefined,
    uniqueKey: string,
    isCompleted: boolean,
    selectable?: boolean,
    isSelected?: boolean,
    onToggle?: () => void
  ) => (
    <div 
      key={uniqueKey}
      className={`bg-background rounded p-2 font-mono text-[11px] text-foreground border transition-colors ${
        isCompleted ? 'opacity-50 border-border' : selectable && isSelected ? 'border-primary/40' : 'border-border'
      }`}
    >
      {label && (
        <div className={`text-muted-foreground text-[10px] mb-1 font-sans ${selectable ? 'ml-6' : ''}`}>{label}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        {selectable && (
          <button
            onClick={onToggle}
            className="flex-shrink-0 p-0.5 rounded transition-all"
            title={isSelected ? 'Deselect command' : 'Select command'}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-primary border-primary'
                : 'border-muted-foreground/50 hover:border-muted-foreground'
            }`}>
              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </div>
          </button>
        )}
        <code className="overflow-x-auto flex-1 whitespace-pre-wrap break-all">{cmd}</code>
        <button
          onClick={() => handleCopyCommand(uniqueKey, cmd)}
          className={`flex-shrink-0 p-1.5 rounded transition-all ${
            copiedCommand === uniqueKey
              ? 'bg-emerald-900/40 text-emerald-400'
              : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          title={copiedCommand === uniqueKey ? 'Copied!' : 'Copy command'}
        >
          {copiedCommand === uniqueKey ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getPrerequisites();
        // Filter out Figma prerequisite from UI (kept in backend config)
        const filteredData = data.filter(p => p.icon?.toLowerCase() !== 'figma');
        setPrerequisites(filteredData);
      } catch (err) {
        console.error('Failed to fetch prerequisites:', err);
        setError('Failed to load prerequisites');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrerequisites();
  }, []);

  // Re-initialize selectedCommands when OS changes or prerequisites load
  useEffect(() => {
    if (prerequisites.length === 0) return;
    const initialSelected: Record<number, Set<number>> = {};
    prerequisites.forEach(p => {
      const filtered = getFilteredCommands(p.commands);
      if (filtered.length > 1) {
        initialSelected[p.id] = new Set(filtered.map((_, i) => i));
      }
    });
    setSelectedCommands(initialSelected);
  }, [selectedOS, prerequisites, getFilteredCommands]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-5 border border-border">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-muted-foreground text-[13px]">Loading prerequisites...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg p-5 border border-red-700/30">
        <div className="text-center">
          <p className="text-red-400 mb-3 text-[13px]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-red-900/30 text-red-300 rounded text-[13px] hover:bg-red-900/50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalCount = prerequisites.length;

  return (
    <div id="prerequisites-section" className={`bg-card rounded-lg border overflow-hidden ${isComplete ? 'border-emerald-700/50' : highlightMarkDone ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-border'}`}>
      {/* Clickable Header */}
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={() => setUserOverride(!isExpanded)}
          className="flex items-center gap-3 flex-1 hover:bg-secondary/30 transition-colors cursor-pointer rounded-md -m-2 p-2"
        >
          <div className={`p-2 rounded-md ${isComplete ? 'bg-emerald-900/40' : 'bg-amber-900/40'}`}>
            <CheckCircle2 className={`w-5 h-5 ${isComplete ? 'text-emerald-300' : 'text-amber-300'}`} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <h2 className={`text-[15px] font-semibold text-foreground ${isComplete ? 'line-through opacity-60' : ''}`}>
                Prerequisites to Get Started
              </h2>
              {isComplete && (
                <span className="text-emerald-400 text-[11px] font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
              )}
            </div>
            <p className={`text-muted-foreground text-[13px] ${isComplete ? 'line-through opacity-60' : ''}`}>
              Complete these steps before beginning the workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Steps count */}
            {totalCount > 0 && !isComplete && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-300">
                {totalCount} steps
              </span>
            )}
            {/* Chevron */}
            <ChevronDown 
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
            />
          </div>
        </button>
        
        {/* Mark Complete Button in Header -- hidden before "Get Started", disabled until 3s after expand */}
        {onMarkComplete && !hideMarkDone && (
          isComplete ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[12px] font-medium animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" /> Completed
            </div>
          ) : (
            <BorderBeamButton
              active={readyToComplete && highlightMarkDone}
              onClick={handleMarkComplete}
              disabled={!readyToComplete}
              className="text-[12px] font-medium px-4 py-2"
            >
              All Done
            </BorderBeamButton>
          )
        )}
      </div>

      {/* Collapsible Content with Fixed Height and Scrolling */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-4 pb-4 space-y-2 max-h-[460px] overflow-y-auto">
          {/* OS Toggle */}
          <div className="flex items-center justify-center gap-4 pb-2 mb-1 border-b border-border/50">
            <span className="text-[11px] text-muted-foreground font-medium">Select your operating system:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setSelectedOS('macos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all ${
                  selectedOS === 'macos'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                macOS
              </button>
              <button
                onClick={() => setSelectedOS('windows')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all border-l border-border ${
                  selectedOS === 'windows'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <WindowsIcon className="w-3.5 h-3.5" />
                Windows
              </button>
            </div>
          </div>

          {prerequisites.map((prereq) => {
            const IconComponent = iconMap[prereq.icon] || Terminal;
            const iconColorClass = iconColorMap[prereq.icon_color] || iconColorMap.slate;
            const isCodeAssistantStep = prereq.id === 1;

            return (
              <div 
                key={prereq.id}
                className="bg-secondary/30 rounded-md p-3 border border-border/50 hover:border-border transition-colors"
              >
                <div className={`flex gap-2.5 ${isCodeAssistantStep ? 'flex-col md:flex-row' : 'items-start'}`}>
                  {/* Main content */}
                  <div className={`flex items-start gap-2.5 ${isCodeAssistantStep ? 'flex-1' : ''}`}>
                    <div className={`p-1.5 rounded ${iconColorClass}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[13px] font-medium text-foreground">
                          {prereq.id}. {prereq.title}
                        </h3>
                        {prereq.is_optional && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded">
                            Optional
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-[12px] leading-relaxed mb-2">
                        {renderDescription(prereq.description)}
                      </div>
                      
                      {/* Commands section - filtered by selected OS */}
                      {(() => {
                        const filteredCmds = getFilteredCommands(prereq.commands);
                        const hasCommands = prereq.command || filteredCmds.length > 0;
                        if (!hasCommands) return null;
                        return (
                          <div className="space-y-1.5 mb-2">
                            {/* Single command (legacy support) - no checkboxes */}
                            {prereq.command && !prereq.commands && (
                              renderCommandBox(prereq.command, undefined, `${prereq.id}-main`, false)
                            )}
                            
                            {/* Multiple filtered commands with multi-select copy */}
                            {filteredCmds.length > 1 && (
                              <>
                                {/* Copy All header row */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <button
                                    onClick={() => toggleSelectAll(prereq.id, filteredCmds.length)}
                                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-sans"
                                  >
                                    {selectedCommands[prereq.id]?.size === filteredCmds.length
                                      ? 'Deselect all'
                                      : 'Select all'}
                                  </button>
                                  <button
                                    onClick={() => handleCopyAllCommands(prereq.id, filteredCmds)}
                                    disabled={!selectedCommands[prereq.id] || selectedCommands[prereq.id].size === 0}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-sans font-medium transition-all ${
                                      copiedCommand === `${prereq.id}-all`
                                        ? 'bg-emerald-900/40 text-emerald-400'
                                        : !selectedCommands[prereq.id] || selectedCommands[prereq.id].size === 0
                                        ? 'bg-secondary/30 text-muted-foreground/50 cursor-not-allowed'
                                        : 'bg-primary/20 text-primary hover:bg-primary/30'
                                    }`}
                                    title={copiedCommand === `${prereq.id}-all` ? 'Copied!' : 'Copy selected commands'}
                                  >
                                    {copiedCommand === `${prereq.id}-all` ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>
                                          {selectedCommands[prereq.id]?.size === filteredCmds.length
                                            ? `Copy All (${filteredCmds.length})`
                                            : `Copy Selected (${selectedCommands[prereq.id]?.size || 0} of ${filteredCmds.length})`}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {/* Command boxes with checkboxes */}
                                {filteredCmds.map((cmd, idx) => (
                                  renderCommandBox(
                                    cmd.cmd,
                                    cmd.label,
                                    `${prereq.id}-${idx}`,
                                    false,
                                    true,
                                    selectedCommands[prereq.id]?.has(idx) ?? true,
                                    () => toggleCommandSelection(prereq.id, idx)
                                  )
                                ))}
                              </>
                            )}

                            {/* Single filtered command - no checkboxes needed */}
                            {filteredCmds.length === 1 && !prereq.command && (
                              renderCommandBox(filteredCmds[0].cmd, filteredCmds[0].label, `${prereq.id}-0`, false)
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Links */}
                      {prereq.links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {prereq.links.map((link, idx) => {
                            const linkColorClass = linkColorMap[link.color] || linkColorMap.slate;
                            return (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${linkColorClass}`}
                              >
                                {link.label}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Video embed for Install Code Assistant (Step 1) */}
                  {isCodeAssistantStep && (
                    <div className="md:w-[280px] flex-shrink-0">
                      <div className="rounded-lg overflow-hidden border border-border bg-slate-900/50">
                        <iframe
                          src="https://www.youtube.com/embed/LR04bU_yV5k"
                          title="How to use Cursor - AI Code Assistant Tutorial"
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        <div className="px-2 py-1.5 bg-slate-800/50 text-[10px] text-slate-400">
                          📺 Watch: How to use Cursor
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mark Complete Button - At the bottom right after all steps */}
          {onMarkComplete && !isComplete && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[12px]">Move to the Workshop steps below.</span>
              </div>
              <BorderBeamButton
                active={highlightMarkDone}
                onClick={handleMarkComplete}
                className="text-[12px] font-medium px-5 py-2"
              >
                All Done
              </BorderBeamButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
