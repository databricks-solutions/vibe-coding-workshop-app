import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ThemeToggle } from './components/ThemeToggle';
import { ConfigurationPage } from './components/config/ConfigurationPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { HackathonsPage } from './components/hackathon/HackathonsPage';
import { HackathonDetailPage } from './components/hackathon/HackathonDetailPage';
import { HackathonPlaybook } from './components/hackathon/HackathonPlaybook';
import { ReleaseNotesPage } from './components/ReleaseNotesPage';
import { AppSidebar } from './components/layout/AppSidebar';
// Agent Skills Navigator is a large, self-contained feature (galaxy map + tours +
// academy with a big static data module). Lazy-load it so it never weighs down
// the initial workflow bundle that every workshop participant hits first.
const SkillsNavigatorPage = lazy(() => import('./components/skills/SkillsNavigatorPage'));
// Ideate (beta) is self-contained and lazy-loaded so it never affects the workflow bundle.
const IdeateApp = lazy(() => import('./components/ideate/IdeateApp'));
import { 
  HeaderSessionMenu,
  SaveSessionDialog, 
  FeedbackDialog, 
  SessionListDialog 
} from './components/session';
import { apiClient } from './api/client';
import { MessageSquare, Plus, Menu, Eye } from 'lucide-react';
import { normalizeLevel, getFilteredSections, getCumulativeOverrides, USE_CASE_LEVEL_LOCK, isForwardProgression, getDisabledTagsForAIModules, ALL_AI_MODULES, getDisabledTagsForMedallionLayers, normalizeMedallionLayers, ALL_MEDALLION_LAYERS, getDisabledTagsForLakehouse, getDisabledTagsForGenieOntology, computeChainContext, deriveInitialChainContext, type WorkshopLevel, type WorkflowDirection, type AIAgentModule, type MedallionLayer, type ChainContext } from './constants/workflowSections';
import { DEFAULT_LEVEL_BY_ASSISTANT, parseCodingAssistantsConfig } from './constants/codingAssistants';

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
  const isHackathonsPage = location.pathname.startsWith('/hackathons');
  const isSkillsPage = location.pathname === '/skills';
  const isReleaseNotesPage = location.pathname === '/release-notes';
  const isIdeatePage = location.pathname === '/ideate' || location.pathname.startsWith('/ideate/');
  const isWorkflowPage = !isConfigPage && !isLeaderboardPage && !isAnalyticsPage && !isHackathonsPage && !isSkillsPage && !isReleaseNotesPage && !isIdeatePage;  
  // Data refresh key - incremented when navigating from Config to Workflow
  // This forces PromptGenerator and other components to re-fetch data
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [wasOnConfigPage, setWasOnConfigPage] = useState(false);
  
  // Detect navigation from Config to Workflow and trigger data refresh
  useEffect(() => {
    if (isConfigPage) {
      setWasOnConfigPage(true);
    } else if (wasOnConfigPage) {
      // Just left config page - increment refresh key to force data re-fetch.
      // Visibility (disabled steps + prerequisites_visible) is refreshed by the
      // codingAssistant/dataRefreshKey effect below.
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
  const [codingAssistant, setCodingAssistant] = useState<string | null>(null);
  // Whether the current coding assistant reflects an explicit user/session
  // choice (true) vs a silent first-load default (false). Gates the "Completed"
  // visual and the welcome-screen auto-acknowledge so a defaulted assistant is
  // pre-selected without looking confirmed or skipping the welcome step.
  const [codingAssistantExplicit, setCodingAssistantExplicit] = useState(false);
  // First-load default target, resolved from the admin "preferred list"
  // (coding_assistants_config). Falls back to 'cursor' until/if config loads.
  const [defaultAssistantId, setDefaultAssistantId] = useState<string>('cursor');
  const [assistantConfigLoaded, setAssistantConfigLoaded] = useState(false);
  // Default to end-to-end which includes all chapters (complete workshop)
  const [workshopLevel, setWorkshopLevel] = useState<WorkshopLevel>('end-to-end');
  // Explicit chain context for additive path selection. See ChainContext docs
  // in workflowSections.ts. Tracks whether the user is climbing APP_CHAIN
  // (Apps → +Lakebase → +Lakehouse → +AI/Agents) versus a standalone Lakehouse
  // chain or a reverse-direction chain. Starts as null (no chain locked in);
  // the first level click computes the proper context via computeChainContext.
  const [chainContext, setChainContext] = useState<ChainContext>(null);
  const [direction, setDirection] = useState<WorkflowDirection>('forward');
  const [levelExplicitlySelected, setLevelExplicitlySelected] = useState(false);
  const [useCaseLockedLevel, setUseCaseLockedLevel] = useState<WorkshopLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState('user@databricks.com');
  const [currentUserResolved, setCurrentUserResolved] = useState(false);
  const [sessionOwner, setSessionOwner] = useState<string | null>(null);
  const [defaultCatalog, setDefaultCatalog] = useState('');
  const [initialExpandedStep, setInitialExpandedStep] = useState<number>(1);

  // Visibility state (fetched per coding_assistant from backend). The Set is
  // the list of disabled section_tags. `prerequisitesVisible` controls whether
  // the Prerequisites block renders in the wizard. `disabledWorkshopLevels`
  // lists the LevelSelector buttons that should be greyed out for the active
  // coding assistant — populated from `disabled_paths` in the same fetch.
  const [disabledSectionTags, setDisabledSectionTags] = useState<Set<string>>(new Set());
  const [prerequisitesVisible, setPrerequisitesVisible] = useState<boolean>(true);
  const [disabledWorkshopLevels, setDisabledWorkshopLevels] = useState<Set<WorkshopLevel>>(new Set());

  // Client-side AI sub-module selection (Genie / Agent / Dashboard chips).
  // Kept SEPARATE from `disabledSectionTags` so the per-coding-assistant visibility
  // refresh cannot clobber user toggles. Both sets are unioned via `effectiveDisabledTags`.
  const [aiAgentsModules, setAiAgentsModules] = useState<Set<AIAgentModule>>(
    () => new Set(ALL_AI_MODULES),
  );

  // Client-side Bronze/Silver/Gold medallion layer chips. Same separation rationale
  // as `aiAgentsModules`. Cascading invariant (Gold->Silver->Bronze) is enforced by
  // `normalizeMedallionLayers` at the setter level.
  const [medallionLayersRaw, setMedallionLayersRaw] = useState<Set<MedallionLayer>>(
    () => new Set(ALL_MEDALLION_LAYERS),
  );
  const medallionLayers = useMemo(() => normalizeMedallionLayers(medallionLayersRaw), [medallionLayersRaw]);
  const setMedallionLayers = useCallback((next: Set<MedallionLayer>) => {
    setMedallionLayersRaw(normalizeMedallionLayers(next));
  }, []);

  // Genie Accelerator only: opt-in Lakehouse (Bronze -> Gold) block. Defaults OFF
  // so the default Genie path starts from existing / uploaded / synthetic data.
  const [includeLakehouse, setIncludeLakehouse] = useState<boolean>(false);

  // Genie Accelerator only: opt-in Genie Ontology block. Defaults OFF so the
  // default Genie path skips the Beta Discover ontology arc.
  const [includeGenieOntology, setIncludeGenieOntology] = useState<boolean>(false);

  // Combined disabled-tag set used everywhere downstream. The backend visibility
  // set is unioned with tags derived from chip state; this keeps both sources of
  // truth independent and idempotent.
  const effectiveDisabledTags = useMemo(() => {
    const aiTags = getDisabledTagsForAIModules(workshopLevel, aiAgentsModules);
    const medTags = getDisabledTagsForMedallionLayers(workshopLevel, medallionLayers);
    const lakeTags = getDisabledTagsForLakehouse(workshopLevel, includeLakehouse);
    const ontologyTags = getDisabledTagsForGenieOntology(workshopLevel, includeGenieOntology);
    if (aiTags.length === 0 && medTags.length === 0 && lakeTags.length === 0 && ontologyTags.length === 0) return disabledSectionTags;
    return new Set<string>([...disabledSectionTags, ...aiTags, ...medTags, ...lakeTags, ...ontologyTags]);
  }, [workshopLevel, aiAgentsModules, medallionLayers, includeLakehouse, includeGenieOntology, disabledSectionTags]);

  // Selected options
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedIndustryLabel, setSelectedIndustryLabel] = useState<string>('');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('');
  const [selectedUseCaseLabel, setSelectedUseCaseLabel] = useState<string>('');
  // Whether the selected use case is certified (drives the Certified badge on
  // the workflow steps). Set when the use case is picked in Define Intent.
  const [selectedUseCaseCertified, setSelectedUseCaseCertified] = useState<boolean>(false);
  
  // Custom use case overrides (user-edited name/description)
  const [customUseCaseLabel, setCustomUseCaseLabel] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');

  // Company brand URL (optional, session-level override)
  const [brandUrl, setBrandUrl] = useState<string>('');

  // Build-time brand config (extracted during install from customer website)
  const [brandConfig, setBrandConfig] = useState<{
    company_name?: string; logo_url?: string;
    primary_color_hsl?: string; secondary_color_hsl?: string;
  } | null>(null);

  // Dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [pendingNewSession, setPendingNewSession] = useState(false);

  // Read-only when viewing another user's session (ownership-based)
  const readOnly = currentUserResolved
    && sessionOwner !== null
    && sessionOwner !== ''
    && currentUser !== sessionOwner;

  // Session loading state - for professional loading overlay
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCreatingNewSession, setIsCreatingNewSession] = useState(false);
  const [isCreatingFadingOut, setIsCreatingFadingOut] = useState(false);

  const directionLocked = Object.keys(stepPrompts).some(
    k => parseInt(k) >= 4 && stepPrompts[parseInt(k)]?.trim()
  ) || Array.from(completedSteps).some(s => s >= 4);

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

    // Visibility (disabled steps + prerequisites) is fetched by the dedicated
    // codingAssistant/dataRefreshKey effect further down — keeping a single
    // authority avoids the double-fetch + race window that existed before.

    // Load build-time brand config (generated during install from customer website)
    fetch('/brand-config.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(brand => {
        if (!brand) return;
        setBrandConfig(brand);
        const root = document.documentElement;
        if (brand.primary_color_hsl) {
          const parts = brand.primary_color_hsl.split(' ');
          if (parts.length >= 2) {
            root.style.setProperty('--brand-h', parts[0]);
            root.style.setProperty('--brand-s', parts[1]);
          }
        }
        if (brand.company_name) {
          document.title = `${brand.company_name} — Vibe Coding Workshop`;
        }
      });
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.user) {
        setCurrentUser(response.user);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    } finally {
      setCurrentUserResolved(true);
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

  // Resolve the first-load default coding assistant from the admin "preferred
  // list" (coding_assistants_config): the first recommended entry, else the
  // first entry, else 'cursor'. Runs once on mount; keeps the 'cursor' fallback
  // on any parse/fetch failure.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getWorkshopParametersDict()
      .then(dict => {
        if (cancelled) return;
        const config = parseCodingAssistantsConfig(dict?.coding_assistants_config);
        if (config && config.length > 0) {
          const resolved = config.find(c => c.recommended)?.id ?? config[0].id;
          setDefaultAssistantId(resolved);
        }
        setAssistantConfigLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAssistantConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the default coding assistant on a fresh session (no saved/explicit
  // choice). Gated on config load so we pick the true preferred default rather
  // than prematurely seeding 'cursor'. `explicit` stays false so the selection
  // is pre-highlighted without marking the step complete or skipping welcome.
  // Skipped in read-only shared views so they stay identical to the owner's
  // saved state (no seeded value the owner never chose).
  useEffect(() => {
    if (!readOnly && !isSessionLoading && assistantConfigLoaded && !codingAssistantExplicit && !codingAssistant) {
      setCodingAssistant(defaultAssistantId);
    }
  }, [readOnly, isSessionLoading, assistantConfigLoaded, codingAssistantExplicit, codingAssistant, defaultAssistantId]);

  // Get or create the user's default session (continues where they left off)
  const getOrCreateDefaultSession = async () => {
    try {
      const response = await apiClient.getDefaultSession();
      if (response.success) {
        setSessionId(response.session_id);
        setSessionOwner(null);
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
        setWorkshopLevel(!restoredLock && restoredLevel === 'skills-accelerator' ? 'end-to-end' : restoredLevel);
        
        // Restore completed steps and skipped steps
        const completedStepsArray: number[] = response.completed_steps || [];
        const restoredCompleted = new Set(completedStepsArray);
        // Intent is defined when industry + use case are selected — ensure step 1 is in completedSteps
        if (response.industry && response.use_case) {
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
        if (sessionParams.direction) {
          setDirection(sessionParams.direction as WorkflowDirection);
        }
        setIncludeLakehouse(!!sessionParams.include_lakehouse);
        setIncludeGenieOntology(!!sessionParams.include_genie_ontology);
        setCodingAssistant(sessionParams.coding_assistant || null);
        setCodingAssistantExplicit(!!sessionParams.coding_assistant);
        
        // Find the next incomplete step using the actual section order for this workshop level
        const nextStep = getNextIncompleteStep(Array.from(restoredCompleted), skippedStepsArray, restoredLevel);
        setInitialExpandedStep(nextStep);
        
        window.history.replaceState({}, '', `?sessionId=${response.session_id}${window.location.hash}`);
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
      window.history.replaceState({}, '', `?sessionId=${localSessionId}${window.location.hash}`);
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
      setSessionOwner(null);
      setSessionSaved(false);
      setSessionName(undefined);
      setSessionDescription(undefined);
      setShareUrl(null);
      setStepPrompts({});
      setCompletedSteps(new Set());
      setSkippedSteps(new Set());
      setPrerequisitesCompleted(false);
      setCodingAssistant(null);
      setLevelExplicitlySelected(false);
      setUseCaseLockedLevel(null);
      setWorkshopLevel('end-to-end');
      setChainContext(null);
      setAiAgentsModules(new Set(ALL_AI_MODULES));
      setMedallionLayers(new Set(ALL_MEDALLION_LAYERS));
      setInitialExpandedStep(1);
      setSelectedIndustry('');
      setSelectedIndustryLabel('');
      setSelectedUseCase('');
      setSelectedUseCaseLabel('');
      setCustomUseCaseLabel('');
      setCustomDescription('');
      setDirection('forward');
      setIncludeLakehouse(false);
      setIncludeGenieOntology(false);
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
  const getNextIncompleteStep = (
    completed: number[],
    skipped: number[] = [],
    level?: WorkshopLevel,
    chainOverride?: ChainContext,
  ): number => {
    const completedSet = new Set(completed);
    const skippedSet = new Set(skipped);
    const effectiveLevel = level || workshopLevel;
    const effectiveChain = chainOverride ?? chainContext;
    // Use cumulative overrides so app-chain users who progressed to lakehouse
    // see the full step list (including step 9 which requires ch2 visibility)
    const cumOverrides = getCumulativeOverrides(effectiveLevel, completedSet, effectiveChain);
    const sections = getFilteredSections(
      effectiveLevel,
      effectiveDisabledTags,
      cumOverrides ?? undefined,
      direction,
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
        setSessionOwner(response.created_by || null);
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
        if (response.industry && response.use_case) {
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
        const effectiveRestoredLevel: WorkshopLevel =
          !loadedLock && loadedLevel === 'skills-accelerator' ? 'end-to-end' : loadedLevel;
        setWorkshopLevel(effectiveRestoredLevel);
        // Reconstruct the additive-chain context from the saved level + completed
        // steps. Without an explicit persisted chainContext we fall back to the
        // legacy "any APP_LAKEBASE_STEPS completed → APP_CHAIN" heuristic for
        // ambiguous lakehouse/lakehouse-di states.
        const restoredChain = deriveInitialChainContext(effectiveRestoredLevel, loadedCompleted);
        setChainContext(restoredChain);
        
        // Restore custom use case overrides from session_parameters
        const sessionParams = response.session_parameters || {};
        setCustomUseCaseLabel(sessionParams.custom_use_case_label || '');
        setCustomDescription(sessionParams.custom_use_case_description || '');
        setLevelExplicitlySelected(!!sessionParams.level_explicitly_selected);
        setBrandUrl(sessionParams.company_brand_url || '');
        if (sessionParams.direction) {
          setDirection(sessionParams.direction as WorkflowDirection);
        }
        setIncludeLakehouse(!!sessionParams.include_lakehouse);
        setIncludeGenieOntology(!!sessionParams.include_genie_ontology);
        setCodingAssistant(sessionParams.coding_assistant || null);
        setCodingAssistantExplicit(!!sessionParams.coding_assistant);
        
        // Navigate to the next incomplete step using the actual section order
        const nextStep = getNextIncompleteStep(
          Array.from(loadedCompleted),
          loadedSkippedSteps,
          loadedLevel,
          restoredChain,
        );
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
    if (readOnly) return;
    if (!force) {
      const hasStartedWorkflow = Array.from(completedSteps).some(s => s >= 2);
      if (hasStartedWorkflow && level !== workshopLevel) {
        if (!isForwardProgression(workshopLevel, level)) return;
      }
    }
    setWorkshopLevel(level);
    // Update the additive chain context. Climbing APP_CHAIN
    // (Apps → +Lakebase → +Lakehouse → +AI/Agents) is preserved when the next
    // level continues that chain; standalone Lakehouse / accelerator / reverse
    // clicks reset/swap the context appropriately.
    const nextChain = computeChainContext(chainContext, workshopLevel, level);
    setChainContext(nextChain);
    // Whenever the user changes paths, reset the AI sub-module chips back to
    // the inclusive default. Keeps re-entering AI predictable ("all on by default").
    if (level !== workshopLevel) {
      setAiAgentsModules(new Set(ALL_AI_MODULES));
      setMedallionLayers(new Set(ALL_MEDALLION_LAYERS));
      // Genie Accelerator's optional Lakehouse defaults OFF on (re)entry.
      setIncludeLakehouse(false);
      // Genie Accelerator's optional Genie Ontology defaults OFF on (re)entry.
      setIncludeGenieOntology(false);
    }
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
  }, [sessionId, levelExplicitlySelected, completedSteps, workshopLevel, readOnly, setMedallionLayers, chainContext]);

  const handleStepPromptGenerated = useCallback((stepNumber: number, promptText: string) => {
    if (readOnly) return;
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
  }, [sessionId, workshopLevel, readOnly]);

  // Handle completed steps change and auto-save to backend
  const handleCompletedStepsChange = useCallback((newSteps: Set<number>) => {
    if (readOnly) return;
    setCompletedSteps(newSteps);
    
    // Auto-save completed steps to backend (piggyback workshop level)
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        completed_steps: Array.from(newSteps),
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
      }).catch(err => console.error('Error saving completed steps:', err));
    }
  }, [sessionId, workshopLevel, readOnly]);

  // Handle skipped steps change and auto-save to backend
  const handleSkippedStepsChange = useCallback((newSkipped: Set<number>) => {
    if (readOnly) return;
    setSkippedSteps(newSkipped);
    
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        skipped_steps: Array.from(newSkipped),
      }).catch(err => console.error('Error saving skipped steps:', err));
    }
  }, [sessionId, readOnly]);

  // Handle prerequisites completion
  const handlePrerequisitesComplete = useCallback(() => {
    if (readOnly) return;
    setPrerequisitesCompleted(true);
    
    // Auto-save to backend (piggyback workshop level)
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        prerequisites_completed: true,
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
      }).catch(err => console.error('Error saving prerequisites:', err));
    }
  }, [sessionId, workshopLevel, readOnly]);

  // Handle coding assistant selection.
  //
  // Per-assistant cold-start default: some assistants (currently Genie Code,
  // which is in active beta and can't yet drive the full Apps + Lakebase
  // chapters) prefer a narrower default workshop level than the generic
  // `end-to-end`. We apply that override ONLY when the user hasn't yet
  // explicitly chosen a level — saved sessions and any explicit pick win.
  const handleCodingAssistantChange = useCallback((assistantId: string) => {
    if (readOnly) return;
    setCodingAssistant(assistantId);
    setCodingAssistantExplicit(true);
    const assistantDefault = DEFAULT_LEVEL_BY_ASSISTANT[assistantId as keyof typeof DEFAULT_LEVEL_BY_ASSISTANT];
    const shouldApplyAssistantDefault =
      !levelExplicitlySelected &&
      assistantDefault !== undefined &&
      assistantDefault !== workshopLevel;
    if (shouldApplyAssistantDefault) {
      const nextLevel = assistantDefault as WorkshopLevel;
      setWorkshopLevel(nextLevel);
      // Mirror the non-explicit chain reset that `computeChainContext` would
      // produce: a cold-start switch into the lakehouse/AI flow lives on the
      // LAKEHOUSE_CHAIN, not the APP_CHAIN.
      setChainContext(computeChainContext(chainContext, workshopLevel, nextLevel));
      if (sessionId) {
        apiClient.updateSessionMetadata({
          session_id: sessionId,
          workshop_level: nextLevel,
        }).catch(err => console.error('Error saving assistant-default workshop level:', err));
      }
    }
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        coding_assistant: assistantId,
      }).catch(err => console.error('Error saving coding assistant:', err));
    }
  }, [sessionId, readOnly, levelExplicitlySelected, workshopLevel, chainContext]);

  const handleDirectionChange = useCallback((newDirection: WorkflowDirection) => {
    if (directionLocked) return;
    setDirection(newDirection);
    // Accelerators are forward-progression flows and the whole Accelerators
    // column is hidden in Reverse ETL direction. If the user flips to reverse
    // while any accelerator level is currently selected, fall back to the
    // Apps + Lakebase baseline so the path selection doesn't silently point
    // to a no-longer-visible column.
    const ACCELERATOR_LEVELS: WorkshopLevel[] = [
      'accelerator',
      'genie-accelerator',
      'data-engineering-accelerator',
      'skills-accelerator',
      'agents-accelerator',
    ];
    if (newDirection === 'reverse' && ACCELERATOR_LEVELS.includes(workshopLevel)) {
      setWorkshopLevel('app-database');
    }
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        direction: newDirection,
      }).catch(err => console.error('Error persisting direction:', err));
    }
  }, [directionLocked, sessionId, workshopLevel]);

  // Genie Accelerator: toggle the optional Lakehouse (Bronze -> Gold) block.
  const handleIncludeLakehouseChange = useCallback((next: boolean) => {
    if (readOnly) return;
    setIncludeLakehouse(next);
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        include_lakehouse: next,
      }).catch(err => console.error('Error persisting include_lakehouse:', err));
    }
  }, [readOnly, sessionId]);

  // Genie Accelerator: toggle the optional Genie Ontology block.
  const handleIncludeGenieOntologyChange = useCallback((next: boolean) => {
    if (readOnly) return;
    setIncludeGenieOntology(next);
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        include_genie_ontology: next,
      }).catch(err => console.error('Error persisting include_genie_ontology:', err));
    }
  }, [readOnly, sessionId]);

  const handleSaveSession = async (name: string, description: string, rating?: 'thumbs_up' | 'thumbs_down', comment?: string) => {
    if (!sessionId || readOnly) return;
    
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
        direction,
        include_lakehouse: includeLakehouse,
        include_genie_ontology: includeGenieOntology,
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

  // Visibility fetch: runs on mount, whenever the active coding assistant
  // changes, and after every Config->Workflow navigation (dataRefreshKey bump).
  // A local `cancelled` flag drops stale responses so a quick assistant swap
  // never leaves a stale result applied.
  //
  // Critically, this effect NEVER calls setWorkshopLevel — the runtime grandfather
  // rule lives in LevelSelector.isButtonDisabled (the currently-selected level
  // is always clickable, even if it's now in disabledWorkshopLevels). This
  // eliminates the entire class of "saved session silently mutated" bugs: a
  // user's stored workshop_level is never overwritten just because their
  // coding-assistant choice or admin config changed underneath them.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getVisibility(codingAssistant ?? undefined)
      .then(v => {
        if (cancelled) return;
        setDisabledSectionTags(new Set(v.disabled_steps));
        setPrerequisitesVisible(v.prerequisites_visible);
        setDisabledWorkshopLevels(new Set((v.disabled_paths ?? []) as WorkshopLevel[]));
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Error fetching visibility:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [codingAssistant, dataRefreshKey]);

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

  // Hash link: expand + scroll to a section (e.g. #path-architecture-section)
  useEffect(() => {
    if (isSessionLoading || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const btn = el.querySelector<HTMLButtonElement>(':scope > button, :scope > div > button');
      if (btn) {
        const collapsed = el.querySelector('[class*="max-h-0"]');
        if (collapsed) btn.click();
      }
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }, 800);
    return () => clearTimeout(timer);
  }, [isSessionLoading]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile navigation drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden animate-backdrop-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <AppSidebar
            variant="mobile"
            brand={brandConfig}
            sessionId={sessionId}
            onClose={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* Desktop navigation (collapsible, hidden on mobile) */}
      <AppSidebar
        variant="desktop"
        brand={brandConfig}
        sessionId={sessionId}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        showConfigHint={showConfigHint}
        onDismissConfigHint={() => {
          setShowConfigHint(false);
          setHintDismissed(true);
        }}
      />

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
                      <p className="text-ui-md font-medium text-foreground">
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
                      <p className="text-ui-md font-medium text-foreground">
                        Creating new session<span className="loading-dots-inline">...</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Header Bar - Clean minimal styling */}
              <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-3 sm:px-6 xl:px-10 2xl:px-14 py-3">
                <div className="max-w-7xl xl:max-w-[88rem] 2xl:max-w-[96rem] mx-auto flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile hamburger button */}
                    <button
                      onClick={() => setMobileSidebarOpen(true)}
                      className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors flex-shrink-0"
                      title="Open navigation"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    <Link to="/" className="min-w-0 cursor-pointer">
                      <h1 className="text-ui-lg sm:text-ui-xl font-semibold text-foreground tracking-tight truncate">V2V: Vibe-to-Value - Vibe Coding Workshop</h1>
                      <p className="hidden sm:block text-ui-base text-muted-foreground">Turning ideas into measurable business outcomes faster with reusable patterns, and guided best practices</p>
                    </Link>
                  </div>
                  
                  {/* Theme Toggle & Session Menu in Header */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <ThemeToggle />
                    {readOnly ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-ui-base">
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          <span className="font-medium text-foreground/80">
                            {sessionOwner ? sessionOwner.split('@')[0].replace('.', ' ') : 'User'}
                          </span>
                          {sessionName && sessionName !== 'New Session' && (
                            <span className="text-muted-foreground/60"> — {sessionName}</span>
                          )}
                          <span className="ml-1.5 text-muted-foreground/50">(read-only)</span>
                        </span>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
              
              {/* Content Area */}
              <div className="p-3 sm:p-6 xl:px-10 2xl:px-14">
                <div className="max-w-7xl xl:max-w-[88rem] 2xl:max-w-[96rem] mx-auto">
                  <WorkflowDiagram
                    sessionId={sessionId}
                    stepPrompts={stepPrompts}
                    completedSteps={completedSteps}
                    selectedIndustry={selectedIndustry}
                    selectedIndustryLabel={selectedIndustryLabel}
                    selectedUseCase={selectedUseCase}
                    selectedUseCaseLabel={selectedUseCaseLabel}
                    selectedUseCaseCertified={selectedUseCaseCertified}
                    customUseCaseLabel={customUseCaseLabel}
                    customDescription={customDescription}
                    initialBrandUrl={brandUrl}
                    workshopLevel={workshopLevel}
                    chainContext={chainContext}
                    onWorkshopLevelChange={handleWorkshopLevelChange}
                    levelExplicitlySelected={levelExplicitlySelected}
                    disabledSectionTags={effectiveDisabledTags}
                    disabledWorkshopLevels={disabledWorkshopLevels}
                    prerequisitesVisible={prerequisitesVisible}
                    useCaseLockedLevel={useCaseLockedLevel}
                    direction={direction}
                    directionLocked={directionLocked}
                    onDirectionChange={handleDirectionChange}
                    aiAgentsModules={aiAgentsModules}
                    onAIModulesChange={setAiAgentsModules}
                    medallionLayers={medallionLayers}
                    onMedallionLayersChange={setMedallionLayers}
                    includeLakehouse={includeLakehouse}
                    onIncludeLakehouseChange={handleIncludeLakehouseChange}
                    includeGenieOntology={includeGenieOntology}
                    onIncludeGenieOntologyChange={handleIncludeGenieOntologyChange}
                    dataRefreshKey={dataRefreshKey}
                    onStepPromptGenerated={handleStepPromptGenerated}
                    onIndustryChange={(val, label) => { 
                      if (readOnly) return;
                      setSelectedIndustry(val); 
                      setSelectedIndustryLabel(label);
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          industry: val,
                          industry_label: label,
                        }).catch(err => console.error('Error saving industry:', err));
                      }
                    }}
                    onUseCaseChange={(val, label, isCertified) => { 
                      if (readOnly) return;
                      setSelectedUseCase(val); 
                      setSelectedUseCaseLabel(label);
                      setSelectedUseCaseCertified(!!isCertified);
                      const lockLevel = USE_CASE_LEVEL_LOCK[val];
                      if (lockLevel) {
                        setUseCaseLockedLevel(lockLevel);
                        handleWorkshopLevelChange(lockLevel, true);
                      } else {
                        setUseCaseLockedLevel(null);
                        if (workshopLevel === 'skills-accelerator') handleWorkshopLevelChange('end-to-end', true);
                      }
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          use_case: val,
                          use_case_label: label,
                        }).catch(err => console.error('Error saving use case:', err));
                      }
                    }}
                    onCustomUseCaseChange={(label, desc) => {
                      if (readOnly) return;
                      setCustomUseCaseLabel(label);
                      setCustomDescription(desc);
                      if (sessionId) {
                        apiClient.updateSessionMetadata({
                          session_id: sessionId,
                          custom_use_case_label: label || undefined,
                          custom_use_case_description: desc || undefined,
                        }).catch(err => console.error('Error saving custom use case:', err));
                      }
                    }}
                    onBrandUrlChange={(url) => {
                      if (readOnly) return;
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
                    codingAssistant={codingAssistant}
                    codingAssistantExplicit={codingAssistantExplicit}
                    onCodingAssistantChange={handleCodingAssistantChange}
                    isSessionLoaded={!isSessionLoading}
                    currentUser={currentUser}
                    defaultCatalog={defaultCatalog}
                    readOnly={readOnly}
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

          <Route path="/release-notes" element={<ReleaseNotesPage />} />
          
          {/* Analytics Page */}
          <Route path="/analytics" element={<AnalyticsDashboard />} />

          {/* Hackathons (playbook before :id so it isn't captured as an id) */}
          <Route path="/hackathons" element={<HackathonsPage />} />
          <Route path="/hackathons/playbook" element={<HackathonPlaybook />} />
          <Route path="/hackathons/:id" element={<HackathonDetailPage />} />
          {/* Agent Skills Navigator Page (lazy-loaded) */}
          <Route
            path="/skills"
            element={
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center bg-background">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <span className="text-ui-md font-medium">Loading Agent Skills Navigator…</span>
                    </div>
                  </div>
                }
              >
                <SkillsNavigatorPage onOpenMobileNav={() => setMobileSidebarOpen(true)} />
              </Suspense>
            }
          />

          <Route
            path="/ideate/*"
            element={
              <Suspense fallback={<div className="flex-1 bg-background" />}>
                <IdeateApp onOpenMobileNav={() => setMobileSidebarOpen(true)} />
              </Suspense>
            }
          />

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
                  <p className="text-ui-base text-muted-foreground">This will reset all your current progress</p>
                </div>
              </div>
              <p className="text-ui-md text-muted-foreground leading-relaxed mt-2">
                Would you like to save your current session before starting a new one, or discard it and start fresh?
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 bg-secondary/30 border-t border-border">
              <button
                onClick={() => setShowNewSessionConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-ui-base font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndNewSession}
                className="flex-1 px-4 py-2 rounded-lg text-ui-base font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Save &amp; Start New
              </button>
              <button
                onClick={handleDiscardAndNewSession}
                className="flex-1 px-4 py-2 rounded-lg text-ui-base font-medium bg-red-600/80 hover:bg-red-500 text-white transition-colors"
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
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-primary hover:from-purple-500 hover:to-primary/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-ui-base font-medium group"
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
