import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { ConfigurationPage } from './components/config/ConfigurationPage';
import { LibraryPage } from './components/library/LibraryPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { HackathonsPage } from './components/hackathon/HackathonsPage';
import { HackathonDetailPage } from './components/hackathon/HackathonDetailPage';
import { HackathonPlaybook } from './components/hackathon/HackathonPlaybook';
import { ReleaseNotesPage } from './components/ReleaseNotesPage';
import { AppSidebar } from './components/layout/AppSidebar';
import { BundleUpdateNotice } from './components/BundleUpdateNotice';
// Learning Academy is a large, self-contained feature (map + tours + lessons +
// skill library with a big static data module). Lazy-load it so it never weighs down
// the initial workflow bundle that every workshop participant hits first.
const SkillsNavigatorPage = lazy(() => import('./components/skills/SkillsNavigatorPage'));
// Ideate (beta) is self-contained and lazy-loaded so it never affects the workflow bundle.
const IdeateApp = lazy(() => import('./components/ideate/IdeateApp'));
// Insights is an opt-in, simpler view of the workflow; lazy so the default view's bundle is unchanged.
const InsightsFlow = lazy(() => import('./components/insights/InsightsFlow'));
import { ViewModeToggle } from './components/insights/ViewModeToggle';
import type { InsightsSetup } from './components/insights/types';
import { isInsightsSession, useWorkflowViewMode, type WorkflowViewMode } from './hooks/useWorkflowViewMode';
import { useIdeas } from './components/journeykit/engine/useIdeas';
import { buildContext } from './components/journeykit/engine/ideaContext';
import { buildDescription, buildTargetFor, slugOf, useLinkedIdea } from './components/journeykit/engine/handoff';
import type { Idea, QuestionSource } from './components/journeykit/engine/types';
import { BuildLinkBar } from './components/journeykit/stage/BuildLinkBar';
import { 
  HeaderSessionMenu,
  SaveSessionDialog, 
  FeedbackDialog, 
  SessionListDialog 
} from './components/session';
import { apiClient, FALLBACK_WORKSHOP_DEFAULTS, isPristineSession, newSessionMetadata, type WorkshopDefaults } from './api/client';
import { MessageSquare, Plus, Menu, Eye } from 'lucide-react';
import { orderedSectionsForRead, WORKSHOP_LEVELS, getCumulativeOverrides, USE_CASE_LEVEL_LOCK, isForwardProgression, getDisabledTagsForAIModules, ALL_AI_MODULES, getDisabledTagsForMedallionLayers, normalizeMedallionLayers, ALL_MEDALLION_LAYERS, getDisabledTagsForLakehouse, getDisabledTagsForGenieOntology, computeChainContext, deriveInitialChainContext, stepNumbersToGates, SECTION_TAG_TO_STEP_NUMBER, type WorkshopLevel, type WorkflowDirection, type AIAgentModule, type MedallionLayer, type ChainContext } from './constants/workflowSections';
import { mergeStatus } from './constants/mergeStatus';
import type { TrackOutlineItem } from './api/client';
import { DEFAULT_LEVEL_BY_ASSISTANT, parseCodingAssistantsConfig } from './constants/codingAssistants';
import { resolveRestoredLevel } from './constants/restoreLevel';
import { deriveCompletedStepNumbers, deriveSkippedStepNumbers } from './constants/deriveProgress';
import { emptyGateBase, hydrateGateBase, gateBaseFields, applyGateWriteResult, type GateBase, type GateWrite } from './utils/gateBase';

/** The step prompt API only stores steps 1 to 30. */
const MAX_SAVED_STEP = 30;

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
  const isConfigPage = location.pathname.startsWith('/config') || location.pathname.startsWith('/library');
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

  // Visibility state (fetched per coding_assistant from backend). The Set is
  // the list of disabled section_tags. `prerequisitesVisible` controls whether
  // the Prerequisites block renders in the wizard. `disabledWorkshopLevels`
  // lists the LevelSelector buttons that should be greyed out for the active
  // coding assistant — populated from `disabled_paths` in the same fetch.
  const [disabledSectionTags, setDisabledSectionTags] = useState<Set<string>>(new Set());
  const [prerequisitesVisible, setPrerequisitesVisible] = useState<boolean>(true);
  const [disabledWorkshopLevels, setDisabledWorkshopLevels] = useState<Set<WorkshopLevel>>(new Set());

  // Engine-composed outline for the active track (Phase 3 T3c; extended in T5 PR2
  // Work B). The full ordered TrackOutlineItem[] from GET /api/track/{track}/outline
  // — carrying per-step `status` — or null until it first resolves (kept on
  // transient error). While null the read path renders a loading skeleton (never
  // blanks, never re-composes client-side).
  const [outline, setOutline] = useState<TrackOutlineItem[] | null>(null);

  // ORDER source for the read path (T3c), derived from the full outline: the flat
  // `sectionTag` sequence, unchanged. ORDER still comes from the endpoint outline;
  // Work B adds STATUS consumption (projectedCompletedSteps below), not ordering.
  const outlineTags = useMemo(
    () => (outline ? outline.map(item => item.sectionTag) : null),
    [outline],
  );

  // Engine outline fetch (Phase 3 T3c). `fetchOutline` is the single shared fetch
  // used by (a) the dep-driven effect, (b) refetch-after-persist in the write
  // handlers, and (c) the poller — all defined below. A monotonic sequence guard
  // makes the LATEST-issued request win, so a refetch-after-persist (issued after
  // the PUT resolves) always supersedes the effect's earlier, possibly-stale
  // request — this is what lets the endpoint order reflect just-persisted
  // direction/variant BEFORE render and closes the old reverse/coverage fallbacks.
  // Errors keep the prior outline (log, never blank); an unresolved outline
  // degrades to the read-path skeleton.
  const outlineReqSeq = useRef(0);
  // The gate sets the SPA last received from or successfully wrote to the
  // server (D-12). Every gate write sends them as base_* so the server removes
  // only gates the App saw and dropped, never one an MCP tool added meanwhile.
  const lastServerGatesRef = useRef<GateBase>(emptyGateBase());
  const fetchOutline = useCallback((track: string, sid: string) => {
    const seq = ++outlineReqSeq.current;
    return apiClient
      .getTrackOutline(track, sid)
      .then(resp => {
        if (seq !== outlineReqSeq.current) return; // superseded by a newer request
        setOutline(resp.outline);
      })
      .catch(err => {
        if (seq !== outlineReqSeq.current) return;
        console.error('Error fetching track outline:', err);
        // Keep the prior outline; the read path shows a skeleton if none has
        // resolved and the poller retries. Never blank the sidebar.
      });
  }, []);

  // outlineReady gates the returning-user restore (WorkflowDiagram) so it navigates
  // using the engine order, not a provisional pre-fetch value.
  const outlineReady = outlineTags != null;

  // Work B (Phase 3 T5 PR2): project the endpoint's per-step `status: 'done'`
  // onto the Set<number> done-set the sidebar/step surfaces render from, UNIONed
  // with the LOCAL optimistic `completedSteps` so a just-completed step never
  // flickers back to not-done in the persist -> refetch window. Endpoint status is
  // the truth; the local optimistic overlay only ADDS on top and converges to the
  // endpoint set once the refetch lands (see mergeStatus).
  //
  // NOTE: `projectedCompletedSteps` is passed as WorkflowDiagram's `completedSteps`
  // prop, which is BOTH the render source AND the mutation seed its toggle handlers
  // read (`new Set(completedSteps)` at WorkflowDiagram.tsx ~715/753/828). So the
  // union — not the raw local set — is what a toggle grows/shrinks and then
  // persists back as the gate set (mapped from the step numbers via
  // stepNumbersToGates). This is BENIGN CONVERGENCE: the endpoint `done` set is
  // derived from the authoritative `completed_gates`, so only genuinely-completed
  // steps can enter the union and nothing false/foreign is ever written.
  const projectedCompletedSteps = useMemo(
    () => mergeStatus(completedSteps, outline ?? [], SECTION_TAG_TO_STEP_NUMBER),
    [completedSteps, outline],
  );

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

  // Genie Accelerator only: the optional Genie Ontology block. A new session and
  // a switch into Genie Accelerator take the facilitator default
  // (VIBE_DEFAULT_GENIE_ONTOLOGY); a resumed session keeps what it stored
  // (absent = off), so the initial value stays false until a session loads.
  const [includeGenieOntology, setIncludeGenieOntology] = useState<boolean>(false);

  // New-session defaults from GET /config/workshop-defaults. Until (or unless)
  // they load, the template defaults apply: Genie Accelerator, ontology ON.
  const [workshopDefaults, setWorkshopDefaults] = useState<WorkshopDefaults>(FALLBACK_WORKSHOP_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    apiClient.getWorkshopDefaults().then(d => { if (!cancelled) setWorkshopDefaults(d); });
    return () => { cancelled = true; };
  }, []);

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

  // Build the COMPLETE engine `flags` object (Phase 3 T3b-2b write path) from the
  // explicit axis values. The backend replaces the nested flags object wholesale
  // (routes.py), so every persist sends all keys. A module/layer present in the
  // set => its flag is ON (step included); the engine ignores flags a track's
  // steps don't reference, so the full set is safe on every track. Genie-only
  // includeLakehouse / includeGenieOntology are carried camelCase alongside.
  const engineFlagsFrom = useCallback((
    ai: Set<AIAgentModule>,
    med: Set<MedallionLayer>,
    lakehouse: boolean,
    ontology: boolean,
  ): Record<string, boolean> => ({
    includeLakehouse: lakehouse,
    includeGenieOntology: ontology,
    'ai.genie': ai.has('genie'),
    'ai.agent': ai.has('agent'),
    'ai.dashboard': ai.has('dashboard'),
    'medallion.bronze': med.has('bronze'),
    'medallion.silver': med.has('silver'),
    'medallion.gold': med.has('gold'),
  }), []);

  // The composition payload from CURRENT live state — spread into save/progress
  // writes so GET /outline composes the same variant/sub-toggle outline the UI
  // shows. `chain_context` is sent only when non-null (accelerators have no chain;
  // the only variant-selecting tracks, lakehouse/lakehouse-di, always carry a
  // non-null chain). Handlers that change an axis build the payload explicitly
  // from the NEW value instead (state isn't updated yet within the handler).
  const compositionParams = useMemo(() => ({
    ...(chainContext ? { chain_context: chainContext } : {}),
    flags: engineFlagsFrom(aiAgentsModules, medallionLayers, includeLakehouse, includeGenieOntology),
  }), [chainContext, aiAgentsModules, medallionLayers, includeLakehouse, includeGenieOntology, engineFlagsFrom]);

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

  // The learner's own view switch is stored on the session (D-143) so it
  // reopens in that view; programmatic view changes go through setViewMode.
  const persistView = useCallback((view: WorkflowViewMode) => {
    if (readOnly || !sessionId) return;
    apiClient.updateSessionMetadata({ session_id: sessionId, view })
      .catch(err => console.error('Error saving the session view:', err));
  }, [readOnly, sessionId]);
  const [viewMode, setViewMode, adoptSessionView, switchViewMode] = useWorkflowViewMode(persistView);

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
    } else if (urlParams.get('openSession') || urlParams.get('buildIdea')) {
      // Opening an idea's project, or starting one, is handled by the navigation effect below.
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

        // Restore workshop level via the single precedence resolver: use-case
        // lock > real persisted workshop_level > corrected assistant fallback >
        // system default. See resolveRestoredLevel for the full contract.
        const restoredLevel = resolveRestoredLevel(response, restoredLock);
        setWorkshopLevel(restoredLevel);
        
        // Restore completed steps and skipped steps (gate-first, R4b).
        const completedStepsArray: number[] = deriveCompletedStepNumbers(
          response.completed_gates,
        );
        const restoredCompleted = new Set(completedStepsArray);
        // Intent is defined when industry + use case are selected — ensure step 1 is in completedSteps
        if (response.industry && response.use_case) {
          restoredCompleted.add(1);
        }
        setCompletedSteps(restoredCompleted);
        // Gate-first skipped hydration (PR3b′), mirroring completedSteps above:
        // map the sectionTag-keyed skipped_gates to global numbers.
        const skippedStepsArray = deriveSkippedStepNumbers(
          response.skipped_gates,
        );
        setSkippedSteps(new Set(skippedStepsArray));
        lastServerGatesRef.current = hydrateGateBase(
          response.session_id, response.completed_gates, response.skipped_gates,
        );
        
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
        adoptSessionView(isInsightsSession(sessionParams.view));
        // A first-time user's default session has nothing stored yet, so it starts
        // on the new-session defaults like an explicitly created one.
        if (isPristineSession(response)) {
          applyNewSessionDefaults(response.session_id, await apiClient.getWorkshopDefaults(), 'technical');
        }

        // initialExpandedStep is a memo (T3c) derived from the engine outline; it
        // resolves once the outline lands, so no imperative set here.

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
      // New-session track with ontology and lakehouse off, and no metadata write
      // (D-165): once the backend recovers, progress saves store only the level,
      // and a session without a stored ontology reloads with it off.
      applyNewSessionState(newSessionLevel(FALLBACK_WORKSHOP_DEFAULTS), false);
      window.history.replaceState({}, '', `?sessionId=${localSessionId}${window.location.hash}`);
      // Still finish loading even on error
      finishSessionLoading();
    }
  };

  /**
   * New-session defaults (R2/R3, every assistant): the facilitator's default
   * track with its ontology default, persisted at once with the complete engine
   * flags and the view marker, so a reload and GET /outline match what the UI
   * shows. Not an explicit level pick: path-lock semantics are unchanged.
   */
  const newSessionLevel = (defaults: WorkshopDefaults): WorkshopLevel => (
    defaults.defaultTrack in WORKSHOP_LEVELS ? defaults.defaultTrack as WorkshopLevel : 'genie-accelerator'
  );
  /** The UI half of the new-session defaults, shared with the failed-default-session path. */
  const applyNewSessionState = (level: WorkshopLevel, ontology: boolean) => {
    setWorkshopLevel(level);
    setIncludeLakehouse(false);
    setIncludeGenieOntology(ontology);
  };
  const applyNewSessionDefaults = (id: string, defaults: WorkshopDefaults, view: WorkflowViewMode): WorkshopLevel => {
    const level = newSessionLevel(defaults);
    const ontology = level === 'genie-accelerator' && defaults.includeGenieOntology;
    applyNewSessionState(level, ontology);
    apiClient.updateSessionMetadata(newSessionMetadata(
      id,
      { defaultTrack: level, includeGenieOntology: ontology },
      engineFlagsFrom(new Set(ALL_AI_MODULES), new Set(ALL_MEDALLION_LAYERS), false, ontology),
      view,
    ))
      .then(() => fetchOutline(level, id))
      .catch(err => console.error('Error saving the new-session defaults:', err));
    return level;
  };

  // Create a brand new session (user explicitly wants to start fresh)
  /** `onCreated` runs with the new id before any state changes, so linked ideas are ready when the view renders. */
  const createNewSession = async (onCreated?: (id: string) => void, view: WorkflowViewMode = 'technical'): Promise<string | null> => {
    setIsCreatingNewSession(true);
    setViewMode(view);
    try {
      const [response, defaults] = await Promise.all([apiClient.createNewSession(), apiClient.getWorkshopDefaults()]);
      onCreated?.(response.session_id);
      setSessionId(response.session_id);
      setSessionOwner(null);
      setSessionSaved(false);
      setSessionName(undefined);
      setSessionDescription(undefined);
      setShareUrl(null);
      setStepPrompts({});
      setCompletedSteps(new Set());
      setSkippedSteps(new Set());
      lastServerGatesRef.current = emptyGateBase(response.session_id);
      setPrerequisitesCompleted(false);
      setCodingAssistant(null);
      setLevelExplicitlySelected(false);
      setUseCaseLockedLevel(null);
      setChainContext(null);
      setAiAgentsModules(new Set(ALL_AI_MODULES));
      setMedallionLayers(new Set(ALL_MEDALLION_LAYERS));
      setSelectedIndustry('');
      setSelectedIndustryLabel('');
      setSelectedUseCase('');
      setSelectedUseCaseLabel('');
      setCustomUseCaseLabel('');
      setCustomDescription('');
      setDirection('forward');
      applyNewSessionDefaults(response.session_id, defaults, view);
      window.history.replaceState({}, '', `?sessionId=${response.session_id}`);
      return response.session_id;
    } catch (err) {
      console.error('Error creating session:', err);
      return null;
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

  // Helper to find the next incomplete step. ORDER is engine-authoritative (T3c):
  // the step order comes from the endpoint outline (via orderedSectionsForRead),
  // never the legacy client-side composer. While the outline is unresolved it
  // returns [] and this yields 1 — the `initialExpandedStep` memo recomputes once
  // the outline lands, and the returning-user restore is gated on `outlineReady` so
  // it never navigates off that provisional value.
  const getNextIncompleteStep = useCallback((
    completed: number[],
    skipped: number[] = [],
    level?: WorkshopLevel,
    chainOverride?: ChainContext,
  ): number => {
    const completedSet = new Set(completed);
    const skippedSet = new Set(skipped);
    const effectiveLevel = level || workshopLevel;
    const effectiveChain = chainOverride ?? chainContext;
    // Cumulative overrides supply the section chrome for climbed columns so an
    // app-chain user who progressed into lakehouse resolves those tags' sections.
    const cumOverrides = getCumulativeOverrides(effectiveLevel, completedSet, effectiveChain);
    const sections = orderedSectionsForRead(
      outlineTags,
      effectiveDisabledTags,
      effectiveLevel,
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
  }, [workshopLevel, chainContext, outlineTags, effectiveDisabledTags]);

  // The step to auto-expand/restore. Derived (T3c) rather than snapshot-at-load so
  // it recomputes SYNCHRONOUSLY once the engine outline resolves — the returning-
  // user restore effect (gated on outlineReady) then reads the correct value in the
  // same render, never a stale provisional. Recomputing as the user progresses is
  // harmless: the restore effect is one-shot per session.
  const initialExpandedStep = useMemo(
    () => getNextIncompleteStep(Array.from(completedSteps), Array.from(skippedSteps), workshopLevel, chainContext),
    [getNextIncompleteStep, completedSteps, skippedSteps, workshopLevel, chainContext],
  );

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
        // Sessions carry sectionTag-keyed completed_gates (the cross-surface
        // source of truth); map them to global step numbers (gate-first, R4b).
        const loadedCompletedSteps: number[] = deriveCompletedStepNumbers(
          response.completed_gates,
        );
        const loadedCompleted = new Set(loadedCompletedSteps);
        // Intent is defined when industry + use case are selected — ensure step 1 is in completedSteps
        if (response.industry && response.use_case) {
          loadedCompleted.add(1);
        }
        setCompletedSteps(loadedCompleted);
        // Gate-first skipped hydration (PR3b′), mirroring loadedCompletedSteps:
        // map the sectionTag-keyed skipped_gates to global numbers.
        const loadedSkippedSteps = deriveSkippedStepNumbers(
          response.skipped_gates,
        );
        setSkippedSteps(new Set(loadedSkippedSteps));
        lastServerGatesRef.current = hydrateGateBase(
          id, response.completed_gates, response.skipped_gates,
        );
        setPrerequisitesCompleted(response.prerequisites_completed || false);
        
        // Re-derive use-case-driven path lock from restored use case
        const loadedLock = USE_CASE_LEVEL_LOCK[response.use_case || ''];
        setUseCaseLockedLevel(loadedLock ?? null);

        // Restore workshop level via the single precedence resolver: use-case
        // lock > real persisted workshop_level > corrected assistant fallback >
        // system default. See resolveRestoredLevel for the full contract.
        const effectiveRestoredLevel: WorkshopLevel = resolveRestoredLevel(response, loadedLock);
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
        adoptSessionView(isInsightsSession(sessionParams.view));

        // initialExpandedStep is a memo (T3c) derived from the engine outline; the
        // returning-user restore (gated on outlineReady) navigates once it lands.

        // Trigger fade-out animation
        finishSessionLoading();
      } else {
        // An idea whose project is gone (e.g. never saved) gets a new project instead of the start screen.
        const orphan = response.missing ? ideas.find(i => i.sessionId === id) : undefined;
        if (orphan && !readOnly) {
          console.warn(`Project ${id} for "${orphan.title}" was not found; starting a new one`);
          void startBuildFromIdea({ ...orphan, sessionId: undefined });
          return;
        }
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
    // Genie Accelerator's optional Genie Ontology takes the facilitator default on
    // (re)entry; every other path has no ontology.
    const entryOntology = level === 'genie-accelerator' && workshopDefaults.includeGenieOntology;
    if (level !== workshopLevel) {
      setAiAgentsModules(new Set(ALL_AI_MODULES));
      setMedallionLayers(new Set(ALL_MEDALLION_LAYERS));
      // Genie Accelerator's optional Lakehouse defaults OFF on (re)entry.
      setIncludeLakehouse(false);
      setIncludeGenieOntology(entryOntology);
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
      // Persist the NEW level's composition (T3b-2b): chain_context = nextChain,
      // and the complete flags for the post-change chip state (a path switch
      // resets chips to the inclusive default; otherwise they carry over) so GET
      // /outline composes the level the UI now shows.
      const levelChanged = level !== workshopLevel;
      const nextAi = levelChanged ? new Set<AIAgentModule>(ALL_AI_MODULES) : aiAgentsModules;
      const nextMed = levelChanged ? new Set<MedallionLayer>(ALL_MEDALLION_LAYERS) : medallionLayers;
      const nextLake = levelChanged ? false : includeLakehouse;
      const nextOnto = levelChanged ? entryOntology : includeGenieOntology;
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        workshop_level: level,
        ...(nextChain ? { chain_context: nextChain } : {}),
        flags: engineFlagsFrom(nextAi, nextMed, nextLake, nextOnto),
      })
        // Refetch AFTER the persist resolves so GET /outline composes the NEW
        // level/variant (T3c). Sequenced via the seq guard in fetchOutline.
        .then(() => fetchOutline(level, sid))
        .catch(err => console.error('Error saving workshop level:', err));
    }
  }, [sessionId, levelExplicitlySelected, completedSteps, workshopLevel, readOnly, setMedallionLayers, chainContext, aiAgentsModules, medallionLayers, includeLakehouse, includeGenieOntology, engineFlagsFrom, fetchOutline, workshopDefaults]);

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
    
    // Auto-save completed steps to backend (piggyback workshop level + the
    // complete composition from live state, T3b-2b, so GET /outline stays in sync
    // even for users who never touch a composition chip explicitly).
    if (sessionId) {
      const sid = sessionId;
      // Gate write (T5): the COMPLETE completed gate set, derived from the live
      // completed-step numbers. The legacy numeric progress write was retired in
      // R4a. This write must ALSO carry the complete skipped_gates (from live
      // skippedSteps): the backend read path keys off gates, so a completion
      // write that omitted skipped_gates would drop skipped progress.
      const gateWrite: GateWrite = {
        completed_gates: stepNumbersToGates(Array.from(newSteps)),
        skipped_gates: stepNumbersToGates(Array.from(skippedSteps)),
      };
      apiClient.updateSessionMetadata({
        session_id: sid,
        ...gateWrite,
        ...gateBaseFields(lastServerGatesRef.current, sid, gateWrite),
        workshop_level: workshopLevel,  // Piggyback workshop level save on progress
        ...compositionParams,
      })
        // Refetch after the STATUS-changing persist so a climb that admits new
        // steps is reflected in the outline order (T3c; closes the old coverage
        // fallback). Optimistic checkmarks already updated above.
        .then((res) => {
          lastServerGatesRef.current = applyGateWriteResult(lastServerGatesRef.current, sid, gateWrite, res.success);
          return fetchOutline(workshopLevel, sid);
        })
        .catch(err => console.error('Error saving completed steps:', err));
    }
  }, [sessionId, workshopLevel, readOnly, skippedSteps, compositionParams, fetchOutline]);

  // Handle skipped steps change and auto-save to backend
  const handleSkippedStepsChange = useCallback((newSkipped: Set<number>) => {
    if (readOnly) return;
    setSkippedSteps(newSkipped);
    
    if (sessionId) {
      const sid = sessionId;
      // Gate write (T5): the COMPLETE skipped gate set, derived from the live
      // skipped-step numbers (persisted under session_parameters.skipped_gates,
      // where the read path reads it). The legacy numeric progress write was
      // retired in R4a. completed_gates is intentionally omitted here so the
      // existing completed gates are COALESCE-preserved.
      const gateWrite: GateWrite = {
        skipped_gates: stepNumbersToGates(Array.from(newSkipped)),
      };
      apiClient.updateSessionMetadata({
        session_id: sid,
        ...gateWrite,
        ...gateBaseFields(lastServerGatesRef.current, sid, gateWrite),
      })
        .then((res) => {
          lastServerGatesRef.current = applyGateWriteResult(lastServerGatesRef.current, sid, gateWrite, res.success);
        })
        .catch(err => console.error('Error saving skipped steps:', err));
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
  // `end-to-end`. We apply that override ONLY on a legacy `end-to-end` session
  // where the user hasn't explicitly chosen a level — saved sessions, any
  // explicit pick and the new-session default (genie-accelerator) all win.
  const handleCodingAssistantChange = useCallback((assistantId: string) => {
    if (readOnly) return;
    setCodingAssistant(assistantId);
    setCodingAssistantExplicit(true);
    const assistantDefault = DEFAULT_LEVEL_BY_ASSISTANT[assistantId as keyof typeof DEFAULT_LEVEL_BY_ASSISTANT];
    const shouldApplyAssistantDefault =
      !levelExplicitlySelected &&
      workshopLevel === 'end-to-end' &&
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
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        direction: newDirection,
        // Complete composition (T3b-2b) so GET /outline recomposes for the new
        // direction. The engine reads persisted `direction` to select the reverse
        // variant; flags/chain_context reflect current live state.
        ...compositionParams,
      })
        // Refetch after direction persists so the reverse order lands BEFORE the
        // next render (T3c; closes the old reverse-order fallback).
        .then(() => fetchOutline(workshopLevel, sid))
        .catch(err => console.error('Error persisting direction:', err));
    }
  }, [directionLocked, sessionId, workshopLevel, compositionParams, fetchOutline]);

  // Genie Accelerator: toggle the optional Lakehouse (Bronze -> Gold) block.
  const handleIncludeLakehouseChange = useCallback((next: boolean) => {
    if (readOnly) return;
    setIncludeLakehouse(next);
    if (sessionId) {
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        include_lakehouse: next,
        // Complete flags (T3b-2b) built with the NEW lakehouse value so GET
        // /outline re-admits/drops the opt-in Lakehouse arc to match the UI.
        ...(chainContext ? { chain_context: chainContext } : {}),
        flags: engineFlagsFrom(aiAgentsModules, medallionLayers, next, includeGenieOntology),
      })
        .then(() => fetchOutline(workshopLevel, sid)) // T3c: refetch after persist
        .catch(err => console.error('Error persisting include_lakehouse:', err));
    }
  }, [readOnly, sessionId, workshopLevel, chainContext, aiAgentsModules, medallionLayers, includeGenieOntology, engineFlagsFrom, fetchOutline]);

  // Genie Accelerator: toggle the optional Genie Ontology block.
  const handleIncludeGenieOntologyChange = useCallback((next: boolean) => {
    if (readOnly) return;
    setIncludeGenieOntology(next);
    if (sessionId) {
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        include_genie_ontology: next,
        // Complete flags (T3b-2b) built with the NEW ontology value.
        ...(chainContext ? { chain_context: chainContext } : {}),
        flags: engineFlagsFrom(aiAgentsModules, medallionLayers, includeLakehouse, next),
      })
        .then(() => fetchOutline(workshopLevel, sid)) // T3c: refetch after persist
        .catch(err => console.error('Error persisting include_genie_ontology:', err));
    }
  }, [readOnly, sessionId, workshopLevel, chainContext, aiAgentsModules, medallionLayers, includeLakehouse, engineFlagsFrom, fetchOutline]);

  // AI-module chips (Genie / Agent / Dashboard). Previously client-only; now also
  // persist the complete flags (T3b-2b) so GET /outline drops/keeps the gated AI
  // steps to match the UI. Built with the NEW module set (state not yet updated).
  const handleAIModulesChange = useCallback((next: Set<AIAgentModule>) => {
    if (readOnly) return;
    setAiAgentsModules(next);
    if (sessionId) {
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        ...(chainContext ? { chain_context: chainContext } : {}),
        flags: engineFlagsFrom(next, medallionLayers, includeLakehouse, includeGenieOntology),
      })
        .then(() => fetchOutline(workshopLevel, sid)) // T3c: refetch after persist
        .catch(err => console.error('Error persisting AI modules:', err));
    }
  }, [readOnly, sessionId, workshopLevel, chainContext, medallionLayers, includeLakehouse, includeGenieOntology, engineFlagsFrom, fetchOutline]);

  // Bronze/Silver/Gold medallion chips. Same rationale; the set is normalized
  // (Gold->Silver->Bronze cascade) before both the setter and the persisted flags.
  const handleMedallionLayersChange = useCallback((next: Set<MedallionLayer>) => {
    if (readOnly) return;
    const normalized = normalizeMedallionLayers(next);
    setMedallionLayers(next); // setter normalizes internally; keep behavior
    if (sessionId) {
      const sid = sessionId;
      apiClient.updateSessionMetadata({
        session_id: sid,
        ...(chainContext ? { chain_context: chainContext } : {}),
        flags: engineFlagsFrom(aiAgentsModules, normalized, includeLakehouse, includeGenieOntology),
      })
        .then(() => fetchOutline(workshopLevel, sid)) // T3c: refetch after persist
        .catch(err => console.error('Error persisting medallion layers:', err));
    }
  }, [readOnly, sessionId, workshopLevel, chainContext, aiAgentsModules, includeLakehouse, includeGenieOntology, engineFlagsFrom, setMedallionLayers, fetchOutline]);

  // Updating a build from its idea: every prompt after the brief was written from the old
  // answers, so it is emptied and regenerates when opened. Completed steps stay completed.
  const clearLaterPrompts = (id: string, prompts: Record<number, string>) => Promise.all(
    Object.entries(prompts)
      .filter(([step, text]) => Number(step) > 1 && Number(step) <= MAX_SAVED_STEP && text)
      .map(([step]) => apiClient.updateStepPrompt({ session_id: id, step_number: Number(step), prompt_text: '' })
        .catch(err => console.error(`Error clearing the prompt for step ${step}:`, err))),
  );

  // Insights view: one tap configures the whole session for the Genie path.
  // Saved in a single metadata call so the backend never sees an intermediate level.
  const handleInsightsStart = useCallback((setup: InsightsSetup) => {
    if (readOnly) return;
    setSelectedIndustry(setup.industry);
    setSelectedIndustryLabel(setup.industryLabel);
    setSelectedUseCase(setup.useCase);
    setSelectedUseCaseLabel(setup.useCaseLabel);
    setSelectedUseCaseCertified(false);
    setUseCaseLockedLevel(null);
    setCustomUseCaseLabel(setup.useCaseLabel);
    setCustomDescription(setup.description);
    setCodingAssistant('genie-code');
    setCodingAssistantExplicit(true);
    setWorkshopLevel('genie-accelerator');
    setChainContext(null);
    setLevelExplicitlySelected(true);
    setDirection('forward');
    setIncludeLakehouse(false);
    setIncludeGenieOntology(false);
    setAiAgentsModules(new Set(ALL_AI_MODULES));
    setMedallionLayers(new Set(ALL_MEDALLION_LAYERS));
    setStepPrompts(prev => (setup.resetPrompts ? { 1: setup.description } : { ...prev, 1: setup.description }));
    if (setup.resetPrompts && sessionId) clearLaterPrompts(sessionId, stepPrompts);
    const nextCompleted = new Set(completedSteps);
    nextCompleted.add(1);
    setCompletedSteps(nextCompleted);
    if (sessionId) {
      apiClient.updateSessionMetadata({
        session_id: sessionId,
        industry: setup.industry,
        industry_label: setup.industryLabel,
        use_case: setup.useCase,
        use_case_label: setup.useCaseLabel,
        custom_use_case_label: setup.useCaseLabel,
        custom_use_case_description: setup.description,
        coding_assistant: 'genie-code',
        workshop_level: 'genie-accelerator',
        level_explicitly_selected: true,
        direction: 'forward',
        include_lakehouse: false,
        include_genie_ontology: false,
        view: 'insights',
        completed_gates: stepNumbersToGates(Array.from(nextCompleted)),
      }).catch(err => console.error('Error saving Insights setup:', err));
      apiClient.updateStepPrompt({
        session_id: sessionId,
        step_number: 1,
        prompt_text: setup.description,
        workshop_level: 'genie-accelerator',
      }).catch(err => console.error('Error saving Insights brief:', err));
    }
  }, [readOnly, sessionId, completedSteps, stepPrompts, setMedallionLayers]);

  const handleSaveSession = async (name: string, description: string, rating?: 'thumbs_up' | 'thumbs_down', comment?: string) => {
    if (!sessionId || readOnly) return;
    
    setIsSaving(true);
    const sid = sessionId;
    // Gate write (T5): the COMPLETE completed/skipped gate sets, derived from
    // the live step numbers, so a saved web session reads back through the
    // gates-present path with no progress loss. The legacy numeric progress
    // writes were retired in R4a.
    const gateWrite: GateWrite = {
      completed_gates: stepNumbersToGates(Array.from(completedSteps)),
      skipped_gates: stepNumbersToGates(Array.from(skippedSteps)),
    };
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
        workshop_level: workshopLevel,
        direction,
        include_lakehouse: includeLakehouse,
        include_genie_ontology: includeGenieOntology,
        // Engine composition inputs (T3b-2b) so GET /outline composes the same
        // climb/reverse/AI/medallion outline the UI shows. Snake_case direction/
        // include_* stay above for other consumers.
        ...compositionParams,
        ...gateWrite,
        ...gateBaseFields(lastServerGatesRef.current, sid, gateWrite),
        step_prompts: stepPrompts
      });
      lastServerGatesRef.current = applyGateWriteResult(lastServerGatesRef.current, sid, gateWrite, response.success);
      
      if (response.success) {
        setSessionSaved(true);
        setSessionName(name);
        setSessionDescription(description);
        setShareUrl(response.share_url || null);
        setShowSaveDialog(false);
        // T3c: refetch the outline after the save persists the full composition.
        fetchOutline(workshopLevel, sessionId);
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

  const { ideas, updateIdea } = useIdeas();
  const linkedIdea = useLinkedIdea(sessionId);

  const technicalUseCaseOf = (idea: Idea) => ({
    industry: idea.spark?.catalogIndustry || 'general',
    industryLabel: idea.spark?.catalogIndustryLabel || idea.spark?.industry || idea.industry || 'General',
    label: idea.title.slice(0, 30),
  });

  /** Saves the idea as a Technical project's use case and step 1 brief. */
  const writeTechnicalBrief = (idea: Idea, id: string, completed: number[], level: string | undefined = 'end-to-end') => {
    const { industry, industryLabel, label } = technicalUseCaseOf(idea);
    const description = buildDescription(idea);
    return Promise.all([
      apiClient.updateSessionMetadata({
        session_id: id,
        industry,
        industry_label: industryLabel,
        use_case: slugOf(idea.title),
        use_case_label: label,
        custom_use_case_label: label,
        custom_use_case_description: description,
        completed_gates: stepNumbersToGates(completed),
      }).catch(err => console.error('Error saving the idea as the use case:', err)),
      apiClient.updateStepPrompt({ session_id: id, step_number: 1, prompt_text: description, workshop_level: level })
        .catch(err => console.error('Error saving the idea brief:', err)),
    ]);
  };

  /**
   * Hands an idea to a build: saves the current project if it has unsaved progress
   * (a new session clears unsaved ones), starts a fresh project linked to the idea,
   * and opens it in the view that builds it. An idea that already has a project reopens it.
   */
  const startBuildFromIdea = async (idea: Idea, targetOverride?: 'insights' | 'technical', fresh = false) => {
    const target = targetOverride ?? buildTargetFor(idea);
    const linkedSession = fresh ? undefined : idea.sessionId;
    if (linkedSession) {
      updateIdea(idea.id, {
        buildTarget: target,
        buildStatus: 'building',
        status: 'committed',
        ...(target === 'insights' ? {
          lockedAt: idea.lockedAt ?? new Date().toISOString(),
          buildStage: 'data' as const,
        } : {}),
      });
      handleLoadSession(linkedSession);
      setViewMode(target);
      return;
    }
    setIsCreatingNewSession(true);
    try {
      const current = await apiClient.getDefaultSession();
      const steps: number[] = deriveCompletedStepNumbers(current.completed_gates);
      if (current.success && !current.is_saved && (steps.length > 0 || current.use_case)) {
        await apiClient.saveSession({
          session_id: current.session_id,
          industry: current.industry,
          industry_label: current.industry_label,
          use_case: current.use_case,
          use_case_label: current.use_case_label,
          session_name: current.session_name && current.session_name !== 'New Session' ? current.session_name : `${current.use_case_label || 'My project'} (autosaved)`,
          session_description: current.session_description,
          workshop_level: current.workshop_level,
          // Gates-only progress (T5): carry the session's own gates through unchanged.
          completed_gates: current.completed_gates || [],
          skipped_gates: current.skipped_gates || [],
          step_prompts: current.step_prompts || {},
        });
      }
    } catch (err) {
      // Preserving the old draft is best-effort; it must not strand someone who
      // explicitly asked to continue from their idea into the build.
      console.error('Could not save the current project before building; continuing with the handoff:', err);
    }

    let questions = idea.genieQuestions ?? [];
    let sources: Record<string, QuestionSource> = idea.genieQuestionSources ?? {};
    let alternates = idea.genieAlternates;
    if (target === 'insights' && !questions.length) {
      try {
        const r = await apiClient.ideateStep<{ questions: string[]; alternates?: string[] }>('questions', { ...buildContext(idea), providedQuestions: [] });
        questions = r.questions.slice(0, 6);
        sources = Object.fromEntries(questions.map(q => [q, 'ai' as const]));
        alternates = r.alternates;
      } catch {
        // Insights asks for the questions on the locked screen instead.
      }
    }

    const now = new Date().toISOString();
    const newId = await createNewSession(id => updateIdea(idea.id, {
      sessionId: id,
      buildTarget: target,
      buildStatus: 'building',
      status: 'committed',
      ...(target === 'insights' ? { lockedAt: idea.lockedAt ?? now, buildStage: 'data' as const, genieQuestions: questions, genieQuestionSources: sources, genieAlternates: alternates } : {}),
      decisions: [...idea.decisions, { at: now, text: `Started building in ${target === 'insights' ? 'Insights' : 'the Technical workflow'}` }],
    }), target);
    finishSessionLoading();
    if (!newId) return;
    setViewMode(target);
    // The new project keeps the new-session default track.
    const level = newSessionLevel(await apiClient.getWorkshopDefaults());

    const { industry, industryLabel, label } = technicalUseCaseOf(idea);
    const description = buildDescription(idea);
    const technical = target === 'technical';
    if (technical) {
      setSelectedIndustry(industry);
      setSelectedIndustryLabel(industryLabel);
      setSelectedUseCase(slugOf(idea.title));
      setSelectedUseCaseLabel(label);
      setSelectedUseCaseCertified(false);
      setCustomUseCaseLabel(label);
      setCustomDescription(description);
      setStepPrompts({ 1: description });
      setCompletedSteps(new Set([1]));
      void writeTechnicalBrief(idea, newId, [1], level);
      updateIdea(idea.id, { builtRevision: idea.revision ?? 0 });
    }
    apiClient.saveSession({
      session_id: newId,
      industry: technical ? industry : undefined,
      industry_label: technical ? industryLabel : undefined,
      use_case: technical ? slugOf(idea.title) : undefined,
      use_case_label: technical ? label : undefined,
      session_name: idea.title,
      session_description: idea.spark?.statement ?? idea.seed,
      workshop_level: level,
      completed_gates: stepNumbersToGates(technical ? [1] : []),
      step_prompts: technical ? { 1: description } : {},
    }).then(r => {
      if (!r.success) return;
      setSessionSaved(true);
      setSessionName(idea.title);
      setShareUrl(r.share_url || null);
    }).catch(err => console.error('Error saving the new project:', err));
  };

  /**
   * Re-applies an idea to the project already building it. Technical projects get the new
   * brief as their use case and regenerate later prompts; Insights projects open on their
   * update screen, which keeps the data choices.
   */
  const updateBuildFromIdea = async (idea: Idea) => {
    if (!idea.sessionId) return startBuildFromIdea(idea);
    const target = buildTargetFor(idea);
    if (target === 'technical') {
      setIsSessionLoading(true);
      try {
        const current = await apiClient.loadSession(idea.sessionId);
        const loadedDone = deriveCompletedStepNumbers(current.completed_gates);
        const done: number[] = loadedDone.length ? loadedDone : [1];
        await clearLaterPrompts(idea.sessionId, current.step_prompts || {});
        await writeTechnicalBrief(idea, idea.sessionId, done.includes(1) ? done : [1, ...done], current.workshop_level || undefined);
        updateIdea(idea.id, i => ({
          builtRevision: i.revision ?? 0,
          buildStatus: 'building',
          decisions: [...i.decisions, { at: new Date().toISOString(), text: 'Updated the build with the latest answers' }],
        }));
      } catch (err) {
        console.error('Could not update the build from the idea:', err);
      }
    } else {
      updateIdea(idea.id, { buildStatus: 'building' });
    }
    handleLoadSession(idea.sessionId);
    setViewMode(target);
  };

  // Links from Ideate: `?buildIdea=` starts (or reopens) a build, `?updateBuild=` re-applies a changed idea,
  // `?openSession=` opens an idea's project.
  const handledNav = useRef<string | null>(null);
  useEffect(() => {
    if (location.pathname !== '/' || handledNav.current === location.key) return;
    const params = new URLSearchParams(location.search);
    const build = params.get('buildIdea');
    const update = params.get('updateBuild');
    const open = params.get('openSession');
    const target = params.get('target') === 'insights' ? 'insights' : params.get('target') === 'technical' ? 'technical' : undefined;
    const fresh = params.get('fresh') === '1';
    if (!build && !update && !open) return;
    handledNav.current = location.key;
    if (update) {
      const idea = ideas.find(i => i.id === update);
      if (idea && !readOnly) void updateBuildFromIdea(idea);
      else if (!sessionId) getOrCreateDefaultSession();
      return;
    }
    if (build) {
      const idea = ideas.find(i => i.id === build);
      if (idea && !readOnly) void startBuildFromIdea(idea, target, fresh);
      else if (!sessionId) getOrCreateDefaultSession();
      return;
    }
    if (open && open !== sessionId) handleLoadSession(open);
    setViewMode(params.get('view') === 'insights' ? 'insights' : 'technical');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per navigation
  }, [location.key]);

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

  // Dep-driven fetch: refires when the track (workshopLevel) or persisted direction
  // changes. Live sub-toggle chips are NOT a dep — the endpoint reflects persisted
  // flags and orderedSectionsForRead applies the live disabled-tag filter on top.
  useEffect(() => {
    if (!sessionId) {
      outlineReqSeq.current++; // invalidate any in-flight request
      setOutline(null);
      return;
    }
    fetchOutline(workshopLevel, sessionId);
  }, [sessionId, workshopLevel, direction, fetchOutline]);

  // Polling v1 (NOT SSE): keep the outline live so cross-surface (MCP) progress and
  // any server-side recomposition surface without a manual refresh. Pauses while
  // the tab is hidden; refetches (debounced) on focus / visibility regain.
  useEffect(() => {
    if (!sessionId) return;
    const POLL_MS = 30000;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      if (document.hidden) return;
      fetchOutline(workshopLevel, sessionId);
    };
    const kick = () => {
      if (document.hidden) return;
      clearTimeout(debounceId);
      debounceId = setTimeout(() => fetchOutline(workshopLevel, sessionId), 300);
    };
    const startInterval = () => {
      clearInterval(intervalId);
      intervalId = setInterval(poll, POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId); // pause when hidden
      } else {
        kick();          // catch up immediately
        startInterval(); // resume steady polling
      }
    };
    startInterval();
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      clearTimeout(debounceId);
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sessionId, workshopLevel, fetchOutline]);

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
                      <p className="hidden sm:block text-ui-base text-muted-foreground">
                        {viewMode === 'insights'
                          ? 'Turn the data you already have into answers your team can trust'
                          : 'Turning ideas into measurable business outcomes faster with reusable patterns, and guided best practices'}
                      </p>
                    </Link>
                  </div>
                  
                  {/* View mode & Session Menu in Header */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <ViewModeToggle mode={viewMode} onChange={switchViewMode} />
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
                  {linkedIdea && !isSessionLoading && <BuildLinkBar idea={linkedIdea} readOnly={readOnly} />}
                  {viewMode === 'insights' ? (
                    <Suspense fallback={<div className="min-h-[50vh]" />}>
                      <InsightsFlow
                        sessionId={sessionId}
                        isSessionLoaded={!isSessionLoading}
                        readOnly={readOnly}
                        currentUser={currentUser}
                        workshopLevel={workshopLevel}
                        codingAssistant={codingAssistant}
                        selectedIndustry={selectedIndustry}
                        selectedIndustryLabel={selectedIndustryLabel}
                        selectedUseCase={selectedUseCase}
                        selectedUseCaseLabel={selectedUseCaseLabel}
                        customUseCaseLabel={customUseCaseLabel}
                        customDescription={customDescription}
                        stepPrompts={stepPrompts}
                        completedSteps={completedSteps}
                        skippedSteps={skippedSteps}
                        onStepPromptGenerated={handleStepPromptGenerated}
                        onCompletedStepsChange={handleCompletedStepsChange}
                        onSkippedStepsChange={handleSkippedStepsChange}
                        onStart={handleInsightsStart}
                        onNewSession={() => setShowNewSessionConfirm(true)}
                        onSwitchToTechnical={() => switchViewMode('technical')}
                      />
                    </Suspense>
                  ) : (
                  <WorkflowDiagram
                    sessionId={sessionId}
                    stepPrompts={stepPrompts}
                    completedSteps={projectedCompletedSteps}
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
                    onAIModulesChange={handleAIModulesChange}
                    medallionLayers={medallionLayers}
                    onMedallionLayersChange={handleMedallionLayersChange}
                    outlineTags={outlineTags}
                    outlineReady={outlineReady}
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
                  )}
                </div>
              </div>
            </div>
          } />
          
          <Route path="/library/*" element={<LibraryPage />} />

          {/* Configuration Pages with tab-based routing */}
          <Route path="/config" element={<Navigate to="/config/section-inputs" replace />} />
          <Route path="/config/prompts" element={<Navigate to="/library" replace />} />
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
          {/* Learning Academy page (lazy-loaded) */}
          <Route
            path="/skills"
            element={
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center bg-background">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <span className="text-ui-md font-medium">Loading Learning Academy…</span>
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
      <BundleUpdateNotice />
    </div>
  );
}
