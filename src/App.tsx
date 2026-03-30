import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ThemeToggle } from './components/ThemeToggle';
import { ConfigurationPage } from './components/config/ConfigurationPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { 
  HeaderSessionMenu,
  SaveSessionDialog, 
  FeedbackDialog, 
  SessionListDialog 
} from './components/session';
import { apiClient } from './api/client';
import { Zap, MessageSquare, Trophy, Plus, PanelLeftClose, PanelLeft, Menu, X, BarChart3 } from 'lucide-react';
import { normalizeLevel, getFilteredSections, getCumulativeOverrides, USE_CASE_LEVEL_LOCK, isForwardProgression, type WorkshopLevel } from './constants/workflowSections';

export default function App() {
  const location = useLocation();
  const [showConfigHint, setShowConfigHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  // Sidebar collapse state (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  // Mobile sidebar overlay state (for screens < md)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Determine current page from URL
  const isConfigPage = location.pathname.startsWith('/config');
  const isLeaderboardPage = location.pathname === '/leaderboard';
  const isAnalyticsPage = location.pathname === '/analytics';
  const isWorkflowPage = !isConfigPage && !isLeaderboardPage && !isAnalyticsPage;
  
  // Data refresh key - incremented when navigating from Config to Workflow
  // This forces PromptGenerator and other components to re-fetch data
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [wasOnConfigPage, setWasOnConfigPage] = useState(false);
  
  // Detect navigation from Config to Workflow and trigger data refresh
  useEffect(() => {
    if (isConfigPage) {
      setWasOnConfigPage(true);
    } else if (wasOnConfigPage) {
      // Just left config page - increment refresh key to force data re-fetch
      setDataRefreshKey(prev => prev + 1);
      setWasOnConfigPage(false);
    }
  }, [isConfigPage, wasOnConfigPage]);

  // Session state - lifted from WorkflowDiagram
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionName, setSessionName] = useState<string | undefined>();
  const [sessionDescription, setSessionDescription] = useState<string | undefined>();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [stepPrompts, setStepPrompts] = useState<Record<number, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [prerequisitesCompleted, setPrerequisitesCompleted] = useState(false);
  // Default to end-to-end which includes all chapters (complete workshop)
  const [workshopLevel, setWorkshopLevel] = useState<WorkshopLevel>('end-to-end');
  const [levelExplicitlySelected, setLevelExplicitlySelected] = useState(false);
  const [useCaseLockedLevel, setUseCaseLockedLevel] = useState<WorkshopLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState('user@databricks.com');
  const [defaultCatalog, setDefaultCatalog] = useState('');
  const [initialExpandedStep, setInitialExpandedStep] = useState<number>(1);

  // Disabled steps (fetched once on mount from backend)
  const [disabledSectionTags, setDisabledSectionTags] = useState<Set<string>>(new Set());

  // Selected options
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedIndustryLabel, setSelectedIndustryLabel] = useState<string>('');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('');
  const [selectedUseCaseLabel, setSelectedUseCaseLabel] = useState<string>('');
  
  // Custom use case overrides (user-edited name/description)
  const [customUseCaseLabel, setCustomUseCaseLabel] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');

  // Company brand URL (optional, session-level override)
  const [brandUrl, setBrandUrl] = useState<string>('');

  // Dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [pendingNewSession, setPendingNewSession] = useState(false);

  // Session loading state - for professional loading overlay
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCreatingNewSession, setIsCreatingNewSession] = useState(false);
  const [isCreatingFadingOut, setIsCreatingFadingOut] = useState(false);

  // Initialize or load session on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('sessionId');

    if (urlSessionId) {
      // Load specific session from URL
      loadSession(urlSessionId);
    } else {
      // Get or create default session (continues where user left off)
      getOrCreateDefaultSession();
    }

    // Fetch current user
    fetchCurrentUser();

    // Fetch default catalog from workshop parameters
    apiClient.getWorkshopParameter('lakehouse_default_catalog')
      .then(param => { if (param?.param_value) setDefaultCatalog(param.param_value); })
      .catch(() => {});

    // Fetch disabled steps
    apiClient.getDisabledSteps()
      .then(tags => setDisabledSectionTags(new Set(tags)))
      .catch(err => console.error('Error fetching disabled steps:', err));
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.user) {
        setCurrentUser(response.user);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  // Helper to trigger smooth fade-out of loading overlay
  const finishSessionLoading = () => {
    // Small delay to ensure React has rendered the final state
    setTimeout(() => {
      setIsFadingOut(true);
      // Remove overlay from DOM after animation completes
      setTimeout(() => {
        setIsSessionLoading(false);
        setIsFadingOut(false);
      }, 400); // Match animation duration
    }, 150);
  };

  // Get or create the user's default session (continues where they left off)
  const getOrCreateDefaultSession = async () => {
    try {
      const response = await apiClient.getDefaultSession();
      if (response.success) {
        setSessionId(response.session_id);
        setSessionSaved(response.is_saved || false);
        setSessionName(response.session_name);
        setSessionDescription(response.session_description);
        setSelectedIndustry(response.industry || '');
        setSelectedIndustryLabel(response.industry_label || '');
        setSelectedUseCase(response.use_case || '');
        setSelectedUseCaseLabel(response.use_case_label || '');
        setPrerequisitesCompleted(response.prerequisites_completed || false);
        
        // Re-derive use-case-driven path lock from restored use case
        const restoredLock = USE_CASE_LEVEL_LOCK[response.use_case || ''];
        setUseCaseLockedLevel(restoredLock ?? null);

        // Restore workshop level — use-case lock takes precedence over saved value
        const restoredLevel = restoredLock ?? normalizeLevel(response.workshop_level || 'end-to-end');
        setWorkshopLevel(restoredLevel);
        
        // Restore completed steps and skipped steps
        const completedStepsArray: number[] = response.completed_steps || [];
        const restoredCompleted = new Set(completedStepsArray);
        // Intent is defined when industry + use case are selected — ensure step 1 is in completedSteps
        if ((response.industry && response.use_case) || response.prerequisites_completed) {
          restoredCompleted.add(1);
        }
        setCompletedSteps(restoredCompleted);
        const skippedStepsArray = response.skipped_steps || [];
        setSkippedSteps(new Set(skippedStepsArray));
        
        // Restore step prompts
        setStepPrompts(response.step_prompts || {});
        
        // Restore custom use case overrides from session_parameters
        const sessionParams = response.session_parameters || {};
        setCustomUseCaseLabel(sessionParams.custom_use_case_label || '');
        setCustomDescription(sessionParams.custom_use_case_description || '');
        setLevelExplicitlySelected(!!sessionParams.level_explicitly_selected);
        setBrandUrl(sessionParams.company_brand_url || '');
        
        // Find the next incomplete step using the actual section order for this workshop level
        const nextStep = getNextIncompleteStep(Array.from(restoredCompleted), skippedStepsArray, restoredLevel);
        setInitialExpandedStep(nextStep);
        
        window.history.replaceState({}, '', `?sessionId=${response.session_id}`);
      }
      // Trigger fade-out animation
      finishSessionLoading();
    } catch (err) {
      console.error('Error getting default session:', err);
      // IMPORTANT: Do NOT call createNewSession() here! That would delete existing sessions.
      // Instead, create a local-only session ID. The backend will persist it when user makes progress.
      const localSessionId = crypto.randomUUID();
      setSessionId(localSessionId);
      setSessionSaved(false);
      setInitialExpandedStep(1);
      window.history.replaceState({}, '', `?sessionId=${localSessionId}`);
      // Still finish loading even on error
      finishSessionLoading();
    }
  };

  // Create a brand new session (user explicitly wants to start fresh)
  const createNewSession = async () => {
    setIsCreatingNewSession(true);
    try {
      const response = await apiClient.createNewSession();
      setSessionId(response.session_id);
      setSessionSaved(false);
      setSessionName(undefined);
      setSessionDescription(undefined);
      setShareUrl(null);
      setStepPrompts({});
      setCompletedSteps(new Set());
      setSkippedSteps(new Set());
      setPrerequisitesCompleted(false);
      setLevelExplicitlySelected(false);
      setUseCaseLockedLevel(null);
      setWorkshopLevel('end-to-end');
      setInitialExpandedStep(1);
      setSelectedIndustry('');
      setSelectedIndustryLabel('');
      setSelectedUseCase('');
      setSelectedUseCaseLabel('');
      setCustomUseCaseLabel('');
      setCustomDescription('');
      window.history.replaceState({}, '', `?sessionId=${response.session_id}`);
    } catch (err) {
      console.error('Error creating session:', err);
    } finally {
      setTimeout(() => {
        setIsCreatingFadingOut(true);
        setTimeout(() => {
          setIsCreatingNewSession(false);
          setIsCreatingFadingOut(false);
        }, 400);
      }, 300);
    }
  };

  // Helper to find the next incomplete step
  const getNextIncompleteStep = (completed: number[], skipped: number[] = [], level?: WorkshopLevel): number => {
    const completedSet = new Set(completed);
    const skippedSet = new Set(skipped);
    const effectiveLevel = level || workshopLevel;
    // Use cumulative overrides so app-chain users who progressed to lakehouse
    // see the full step list (including step 9 which requires ch2 visibility)
    const cumOverrides = getCumulativeOverrides(effectiveLevel, completedSet);
    const sections = getFilteredSections(
      effectiveLevel,
      disabledSectionTags,
      cumOverrides ?? undefined,
    );
    const stepOrder = sections.flatMap(s => s.steps.map(st => st.number));
    
    for (const step of stepOrder) {
      if (!completedSet.has(step) && !skippedSet.has(step)) {
        return step;
      }
    }
    // All steps complete - return last visible step
    return stepOrder[stepOrder.length - 1] || 1;
  };

  const loadSession = async (id: string) => {
    try {
      const response = await apiClient.loadSession(id);
      if (response.success) {
        setSessionId(id);
        setSessionSaved(response.is_saved);
        setSessionName(response.session_name);
        setSessionDescription(response.session_description);
        setSelectedIndustry(response.industry || '');
        setSelectedIndustryLabel(response.industry_label || '');
        setSelectedUseCase(response.use_case || '');
        setSelectedUseCaseLabel(response.use_case_label || '');
        setStepPrompts(response.step_prompts || {});
        const loadedCompletedSteps: number[] = response.completed_steps || [];
        const loadedCompleted = new Set(loadedCompletedSteps);
        // Intent is defined when industry + use case are selected — ensure step 1 is in completedSteps
        if ((response.industry && response.use_case) || response.prerequisites_completed) {
          loadedCompleted.add(1);
        }
        setCompletedSteps(loadedCompleted);
        const loadedSkippedSteps = response.skipped_steps || [];
        setSkippedSteps(new Set(loadedSkippedSteps));
        setPrerequisitesCompleted(response.prerequisites_completed || false);
        
        // Re-derive use-case-driven path lock from restored use case
        const loadedLock = USE_CASE_LEVEL_LOCK[response.use_case || ''];
        setUseCaseLockedLevel(loadedLock ?? null);

        // Restore workshop level — use-case lock takes precedence over saved value
        const loadedLevel = loadedLock ?? normalizeLevel(response.workshop_level || 'end-to-end');
        setWorkshopLevel(loadedLevel);
        
        // Restore custom use case overrides from session_parameters
        const sessionParams = response.session_parameters || {};
        setCustomUseCaseLabel(sessionParams.custom_use_case_label || '');
        setCustomDescription(sessionParams.custom_use_case_description || '');
        setLevelExplicitlySelected(!!sessionParams.level_explicitly_selected);
        setBrandUrl(sessionParams.company_brand_url || '');
        
        // Navigate to the next incomplete step using the actual section order
        const nextStep = getNextIncompleteStep(Array.from(loadedCompleted), loadedSkippedSteps, loadedLevel);
        setInitialExpandedStep(nextStep);
        
        // Trigger fade-out animation
        finishSessionLoading();
      } else {
        // Session ID not found - try to load user's default session instead
        console.warn(`Session ${id} not found, loading default session`);
        getOrCreateDefaultSession(); // This will handle finishSessionLoading
      }
    } catch (err) {
      console.error('Error loading session:', err);
      // On error, try to load default session (preserves existing progress)
      getOrCreateDefaultSession(); // This will handle finishSessionLoading
    }
  };

  // Wrap setWorkshopLevel to also mark the selection as explicit.
  // `force` bypasses the started-workflow guard (used by use-case-driven locks).
  const handleWorkshopLevelChange = useCallback((level: WorkshopLevel, force = false) => {
    if (!force) {
      const hasStartedWorkflow = Array.from(completedSteps).some(s => s >= 2);
      if (hasStartedWorkflow && level !== workshopLevel) {
        if (!isForwardProgression(workshopLevel, level)) return;
      }
    }
    setWorkshopLevel(level);
    if (!levelExplicitlySelected) {
      setLevelExplicitlySelected(true);
      if (sessionId) {
        apiClient.updateSessionMetadata({
          session_id: sessionId,
          level_explicitly_selected: true,
        }).catch(err => console.error('Error persisting level_explicitly_selected:', err));
      }
    }
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        workshop_level: level,
      }).catch(err => console.error('Error saving workshop level:', err));
    }
  }, [sessionId, levelExplicitlySelected, completedSteps, workshopLevel]);

  const handleStepPromptGenerated = useCallback((stepNumber: number, promptText: string) => {
    setStepPrompts(prev => ({
      ...prev,
      [stepNumber]: promptText
    }));
    
    if (sessionId) {
      apiClient.updateStepPrompt({
        session_id: sessionId,
        step_number: stepNumber,
        prompt_text: promptText,
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
      }).catch(err => console.error('Error updating step prompt:', err));
    }
  }, [sessionId, workshopLevel]);

  // Handle completed steps change and auto-save to backend
  const handleCompletedStepsChange = useCallback((newSteps: Set<number>) => {
    setCompletedSteps(newSteps);
    
    // Auto-save completed steps to backend (piggyback workshop level)
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        completed_steps: Array.from(newSteps),
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
      }).catch(err => console.error('Error saving completed steps:', err));
    }
  }, [sessionId, workshopLevel]);

  // Handle skipped steps change and auto-save to backend
  const handleSkippedStepsChange = useCallback((newSkipped: Set<number>) => {
    setSkippedSteps(newSkipped);
    
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        skipped_steps: Array.from(newSkipped),
      }).catch(err => console.error('Error saving skipped steps:', err));
    }
  }, [sessionId]);

  // Handle prerequisites completion
  const handlePrerequisitesComplete = useCallback(() => {
    setPrerequisitesCompleted(true);
    
    // Auto-save to backend (piggyback workshop level)
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        prerequisites_completed: true,
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
      }).catch(err => console.error('Error saving prerequisites:', err));
    }
  }, [sessionId, workshopLevel]);

  const handleSaveSession = async (name: string, description: string, rating?: 'thumbs_up' | 'thumbs_down', comment?: string) => {
    if (!sessionId) return;
    
    setIsSaving(true);
    try {
      const response = await apiClient.saveSession({
        session_id: sessionId,
        industry: selectedIndustry,
        industry_label: selectedIndustryLabel,
        use_case: selectedUseCase,
        use_case_label: selectedUseCaseLabel,
        session_name: name,
        session_description: description,
        feedback_rating: rating || null,
        feedback_comment: comment,
        current_step: Math.max(...Array.from(completedSteps), 1),
        workshop_level: workshopLevel,
        completed_steps: Array.from(completedSteps),
        step_prompts: stepPrompts
      });
      
      if (response.success) {
        setSessionSaved(true);
        setSessionName(name);
        setSessionDescription(description);
        setShareUrl(response.share_url || null);
        setShowSaveDialog(false);
        if (pendingNewSession) {
          setPendingNewSession(false);
          window.history.replaceState({}, '', window.location.pathname);
          createNewSession();
        }
      }
    } catch (err) {
      console.error('Error saving session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFeedback = async (rating: 'thumbs_up' | 'thumbs_down', comment: string, requestFollowup: boolean) => {
    if (!sessionId) return;
    
    setIsSubmittingFeedback(true);
    try {
      await apiClient.submitFeedback({
        session_id: sessionId,
        feedback_rating: rating,
        feedback_comment: comment,
        feedback_request_followup: requestFollowup
      });
      setShowFeedbackDialog(false);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleShare = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleLoadSession = (id: string) => {
    window.history.replaceState({}, '', `?sessionId=${id}`);
    loadSession(id);
    setShowSessionList(false);
  };

  const handleSaveAndNewSession = async () => {
    setShowNewSessionConfirm(false);
    setPendingNewSession(true);
    setShowSaveDialog(true);
  };

  const handleDiscardAndNewSession = () => {
    setShowNewSessionConfirm(false);
    window.history.replaceState({}, '', window.location.pathname);
    createNewSession();
  };

  // Show config hint after scrolling past step 3
  useEffect(() => {
    if (isConfigPage || hintDismissed) return;

    const handleScroll = () => {
      const step3Element = document.querySelector('[data-step-number="3"]');
      if (step3Element) {
        const rect = step3Element.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.3) {
          setShowConfigHint(true);
        }
      }
    };

    const scrollContainer = document.querySelector('main .overflow-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [isConfigPage, hintDismissed]);

  // Auto-hide hint after 5 seconds
  useEffect(() => {
    if (showConfigHint) {
      const timer = setTimeout(() => {
        setShowConfigHint(false);
        setHintDismissed(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfigHint]);

  // Hide hint when navigating to configuration
  useEffect(() => {
    if (isConfigPage) {
      setShowConfigHint(false);
      setHintDismissed(true);
    }
  }, [isConfigPage]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden animate-backdrop-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-52 h-full bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-left">
            <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-semibold text-sidebar-foreground text-[13px] tracking-tight whitespace-nowrap">V2V: Vibe-to-Value</h1>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">Vibe Coding Workshop</p>
                </div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-2.5 py-3">
              <div className="space-y-0.5">
                <Link to={sessionId ? `/?sessionId=${sessionId}` : '/'} onClick={() => setMobileSidebarOpen(false)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-200 ${isWorkflowPage ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${isWorkflowPage ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                  <span>Workflow</span>
                </Link>
                <Link to="/leaderboard" onClick={() => setMobileSidebarOpen(false)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-200 ${isLeaderboardPage ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <Trophy className={`w-4 h-4 flex-shrink-0 ${isLeaderboardPage ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>Leaderboard</span>
                </Link>
                <Link to="/analytics" onClick={() => setMobileSidebarOpen(false)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-200 ${isAnalyticsPage ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <BarChart3 className={`w-4 h-4 flex-shrink-0 ${isAnalyticsPage ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>Analytics</span>
                </Link>
                <Link to="/config" onClick={() => setMobileSidebarOpen(false)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-200 ${isConfigPage ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${isConfigPage ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  <span>Configuration</span>
                </Link>
              </div>
            </nav>
            <div className="px-4 py-3 border-t border-sidebar-border">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                <span>Connected</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Left Sidebar Navigation - Collapsible (hidden on mobile) */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-14' : 'w-52'} bg-sidebar border-r border-sidebar-border flex-col flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
        {/* Logo/Brand + Toggle */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-4'} py-4 border-b border-sidebar-border transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="font-semibold text-sidebar-foreground text-[13px] tracking-tight whitespace-nowrap">V2V: Vibe-to-Value</h1>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">Vibe Coding Workshop</p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
          {sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full mt-2 p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors flex items-center justify-center"
              title="Expand sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-1.5' : 'px-2.5'} py-3 transition-all duration-300`}>
          <div className="space-y-0.5">
            <Link
              to={sessionId ? `/?sessionId=${sessionId}` : '/'}
              title="Workflow"
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'} rounded-md text-[12px] font-medium transition-all duration-200 ${
                isWorkflowPage
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <svg className={`w-4 h-4 flex-shrink-0 ${isWorkflowPage ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              {!sidebarCollapsed && <span className="whitespace-nowrap">Workflow</span>}
            </Link>

            <Link
              to="/leaderboard"
              title="Leaderboard"
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'} rounded-md text-[12px] font-medium transition-all duration-200 ${
                isLeaderboardPage
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <Trophy className={`w-4 h-4 flex-shrink-0 ${isLeaderboardPage ? 'text-primary' : 'text-muted-foreground'}`} />
              {!sidebarCollapsed && <span className="whitespace-nowrap">Leaderboard</span>}
            </Link>

            <Link
              to="/analytics"
              title="Analytics"
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'} rounded-md text-[12px] font-medium transition-all duration-200 ${
                isAnalyticsPage
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <BarChart3 className={`w-4 h-4 flex-shrink-0 ${isAnalyticsPage ? 'text-primary' : 'text-muted-foreground'}`} />
              {!sidebarCollapsed && <span className="whitespace-nowrap">Analytics</span>}
            </Link>

            <div className="relative">
              <Link
                to="/config"
                title="Configuration"
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'} rounded-md text-[12px] font-medium transition-all duration-200 ${
                  isConfigPage
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 ${isConfigPage ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {!sidebarCollapsed && <span className="whitespace-nowrap">Configuration</span>}
              </Link>
              
              {/* Bouncing Arrow Hint */}
              {showConfigHint && !sidebarCollapsed && (
                <Link 
                  to="/config"
                  className="absolute -right-1 top-1/2 animate-bounce-horizontal flex items-center gap-1.5 cursor-pointer z-20"
                  onClick={() => {
                    setShowConfigHint(false);
                    setHintDismissed(true);
                  }}
                >
                  <div className="relative">
                    <div className="bg-primary rounded-full p-0.5 animate-pulse-glow">
                      <svg 
                        className="w-4 h-4 text-primary-foreground transform rotate-180" 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-medium px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-primary"></div>
                    Configure prompts here!
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Resources Section - hidden when collapsed */}
          {!sidebarCollapsed && (
            <div className="mt-6 pt-4 border-t border-sidebar-border">
              <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider mb-2 px-2.5">Resources</p>
              <div className="space-y-0">
                <a
                  href="https://github.com/databricks-solutions/vibe-coding-workshop-template"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span className="whitespace-nowrap">Repository template</span>
                </a>
                <a
                  href="https://docs.databricks.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="whitespace-nowrap">Databricks Docs</span>
                </a>
                <a
                  href="https://github.com/databricks-solutions/vibe-coding-workshop-app/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="whitespace-nowrap">Submit Feature Request</span>
                </a>
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className={`${sidebarCollapsed ? 'px-2 flex justify-center' : 'px-4'} py-3 border-t border-sidebar-border transition-all duration-300`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-1.5'} text-[10px] text-muted-foreground`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            {!sidebarCollapsed && <span className="whitespace-nowrap">Connected</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          {/* Workflow Page (Home) */}
          <Route path="/" element={
            <div className="flex-1 overflow-auto gradient-mesh relative">
              {/* Session Loading Overlay - Glassy backdrop with floating banner */}
              {(isSessionLoading || isFadingOut) && (
                <div 
                  className={`absolute inset-0 z-50 ${isFadingOut ? 'animate-overlay-fade-out' : ''}`}
                >
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                  <div className="relative flex items-center justify-center h-full">
                    <div className="bg-card/90 backdrop-blur-md rounded-xl border border-border/50 shadow-xl px-6 py-3.5 flex items-center gap-4">
                      <div className="relative">
                        <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      </div>
                      <p className="text-[13px] font-medium text-foreground">
                        Restoring your session<span className="loading-dots-inline">...</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* New Session Creation Overlay - Same translucent style */}
              {(isCreatingNewSession || isCreatingFadingOut) && (
                <div 
                  className={`absolute inset-0 z-50 ${isCreatingFadingOut ? 'animate-overlay-fade-out' : ''}`}
                >
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                  <div className="relative flex items-center justify-center h-full">
                    <div className="bg-card/90 backdrop-blur-md rounded-xl border border-border/50 shadow-xl px-6 py-3.5 flex items-center gap-4">
                      <div className="relative">
                        <div className="w-5 h-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                      </div>
                      <p className="text-[13px] font-medium text-foreground">
                        Creating new session<span className="loading-dots-inline">...</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Header Bar - Clean minimal styling */}
              <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-3 sm:px-6 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile hamburger button */}
                    <button
                      onClick={() => setMobileSidebarOpen(true)}
                      className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors flex-shrink-0"
                      title="Open navigation"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h1 className="text-[15px] sm:text-[17px] font-semibold text-foreground tracking-tight truncate">V2V: Vibe-to-Value - Vibe Coding Workshop</h1>
                      <p className="hidden sm:block text-[12px] text-muted-foreground">Turning ideas into measurable business outcomes faster with reusable patterns, and guided best practices</p>
                    </div>
                  </div>
                  
                  {/* Theme Toggle & Session Menu in Header */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <ThemeToggle />
                      <HeaderSessionMenu
                      sessionId={sessionId}
                      sessionSaved={sessionSaved}
                      sessionName={sessionName}
                      shareUrl={shareUrl}
                      isSaving={isSaving}
                      currentUser={currentUser}
                      completedSteps={completedSteps.size}
                      totalSteps={20}
                      onSave={() => setShowSaveDialog(true)}
                      onLoadSession={() => setShowSessionList(true)}
                      onNewSession={() => setShowNewSessionConfirm(true)}
                      onShare={handleShare}
                    />
                  </div>
                </div>
              </div>
              
              {/* Content Area */}
              <div className="p-3 sm:p-6">
                <div className="max-w-7xl mx-auto">
                  <WorkflowDiagram
                    sessionId={sessionId}
                    stepPrompts={stepPrompts}
                    completedSteps={completedSteps}
                    selectedIndustry={selectedIndustry}
                    selectedIndustryLabel={selectedIndustryLabel}
                    selectedUseCase={selectedUseCase}
                    selectedUseCaseLabel={selectedUseCaseLabel}
                    customUseCaseLabel={customUseCaseLabel}
                    customDescription={customDescription}
                    initialBrandUrl={brandUrl}
                    workshopLevel={workshopLevel}
                    onWorkshopLevelChange={handleWorkshopLevelChange}
                    levelExplicitlySelected={levelExplicitlySelected}
                    disabledSectionTags={disabledSectionTags}
                    useCaseLockedLevel={useCaseLockedLevel}
                    dataRefreshKey={dataRefreshKey}
                    onStepPromptGenerated={handleStepPromptGenerated}
                    onIndustryChange={(val, label) => { 
                      setSelectedIndustry(val); 
                      setSelectedIndustryLabel(label);
                      // Auto-save industry selection to session
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          industry: val,
                          industry_label: label,
                        }).catch(err => console.error('Error saving industry:', err));
                      }
                    }}
                    onUseCaseChange={(val, label) => { 
                      setSelectedUseCase(val); 
                      setSelectedUseCaseLabel(label);
                      // Check for use-case-driven path lock
                      const lockLevel = USE_CASE_LEVEL_LOCK[val];
                      if (lockLevel) {
                        setUseCaseLockedLevel(lockLevel);
                        handleWorkshopLevelChange(lockLevel, true);
                      } else {
                        setUseCaseLockedLevel(null);
                      }
                      // Auto-save use case selection to session
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          use_case: val,
                          use_case_label: label,
                        }).catch(err => console.error('Error saving use case:', err));
                      }
                    }}
                    onCustomUseCaseChange={(label, desc) => {
                      setCustomUseCaseLabel(label);
                      setCustomDescription(desc);
                      // Save custom use case overrides directly to session
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          custom_use_case_label: label || undefined,
                          custom_use_case_description: desc || undefined,
                        }).catch(err => console.error('Error saving custom use case:', err));
                      }
                    }}
                    onBrandUrlChange={(url) => {
                      setBrandUrl(url);
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          company_brand_url: url,
                        }).catch(err => console.error('Error saving brand URL:', err));
                      }
                    }}
                    onCompletedStepsChange={handleCompletedStepsChange}
                    skippedSteps={skippedSteps}
                    onSkippedStepsChange={handleSkippedStepsChange}
                    initialExpandedStep={initialExpandedStep}
                    prerequisitesCompleted={prerequisitesCompleted}
                    onPrerequisitesComplete={handlePrerequisitesComplete}
                    isSessionLoaded={!isSessionLoading}
                    currentUser={currentUser}
                    defaultCatalog={defaultCatalog}
                  />
                </div>
              </div>
            </div>
          } />
          
          {/* Configuration Pages with tab-based routing */}
          <Route path="/config" element={<ConfigurationPage />} />
          <Route path="/config/:tab" element={<ConfigurationPage />} />
          
          {/* Leaderboard Page */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          
          {/* Analytics Page */}
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          
          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Dialogs */}
      <SaveSessionDialog
        isOpen={showSaveDialog}
        onClose={() => { setShowSaveDialog(false); setPendingNewSession(false); }}
        onSave={handleSaveSession}
        isSaving={isSaving}
        initialName={sessionName}
        initialDescription={sessionDescription}
        showFeedback={true}
      />

      <FeedbackDialog
        isOpen={showFeedbackDialog}
        onClose={() => setShowFeedbackDialog(false)}
        onSubmit={handleSubmitFeedback}
        isSubmitting={isSubmittingFeedback}
      />

      <SessionListDialog
        isOpen={showSessionList}
        onClose={() => setShowSessionList(false)}
        onSelectSession={handleLoadSession}
        currentSessionId={sessionId || undefined}
      />

      {/* New Session Confirmation Modal */}
      {showNewSessionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Start New Session</h3>
                  <p className="text-[12px] text-muted-foreground">This will reset all your current progress</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">
                Would you like to save your current session before starting a new one, or discard it and start fresh?
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 bg-secondary/30 border-t border-border">
              <button
                onClick={() => setShowNewSessionConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-[12px] font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndNewSession}
                className="flex-1 px-4 py-2 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Save &amp; Start New
              </button>
              <button
                onClick={handleDiscardAndNewSession}
                className="flex-1 px-4 py-2 rounded-lg text-[12px] font-medium bg-red-600/80 hover:bg-red-500 text-white transition-colors"
              >
                Discard &amp; Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Button - Bottom Center (only on workflow page) */}
      {isWorkflowPage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setShowFeedbackDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-primary hover:from-purple-500 hover:to-primary/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-[12px] font-medium group"
            title="Share your feedback"
          >
            <MessageSquare className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Share Feedback</span>
          </button>
        </div>
      )}
    </div>
  );
}
