import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReadOnlyProvider } from '../contexts/ReadOnlyContext';
import { WorkflowStep } from './WorkflowStep';
import { Prerequisites } from './Prerequisites';
import { WorkshopIntro } from './WorkshopIntro';
import { CodingAssistantSelector } from './CodingAssistantSelector';
import { SectionedWorkflowSidebar } from './SectionedWorkflowSidebar';
import { SectionDetailPanel } from './SectionDetailPanel';
import { DefineIntentSection } from './DefineIntentSection';
import { SetUpProjectStep } from './SetUpProjectStep';
import { CelebrationOverlay, type CelebrationData } from './CelebrationOverlay';
import { PathAndArchitecture } from './PathAndArchitecture';
import { 
  WORKFLOW_SECTIONS, 
  getSectionForStep,
  getFilteredSections,
  getCumulativeOverrides,
  ALL_STEPS,
  type WorkshopLevel,
  type WorkflowDirection,
  type AIAgentModule,
  type MedallionLayer
} from '../constants/workflowSections';
import { 
  getStepPoints, 
  getCompletedChapter, 
  calculateTotalScore,
  getLeaderboardMessage 
} from '../constants/scoring';
import { 
  ArrowDown, 
  ChevronDown,
  Code, 
  Palette, 
  RefreshCw,
  FileText,
  Table2,
  GitBranch,
  FlaskConical,
  Shield,
  Merge,
  BarChart3,
  MessageSquareText,
  Bot,
  LayoutDashboard,
  Rocket,
  Server,
  Play,
  Link2,
  Database,
  Plug,
  Search,
  Sparkles,
  Lock,
  Upload,
  BookOpen,
  FileCode,
  Tag,
  ShieldCheck,
  Brain,
  Trash2
} from 'lucide-react';
import { apiClient } from '../api/client';

import { LakehouseParamsEditor } from './LakehouseParamsEditor';
import { CsvUploadPanel } from './CsvUploadPanel';
import { GoldTableTargetEditor, type GoldTableTarget } from './GoldTableTargetEditor';
import { deriveSchemaName } from '../utils/naming';

// Step 2 (Set Up Project) uses a unique ID (2) for completion tracking
const SET_UP_PROJECT_STEP_ID = 2;

interface WorkflowDiagramProps {
  sessionId: string | null;
  stepPrompts: Record<number, string>;
  completedSteps: Set<number>;
  selectedIndustry: string;
  selectedIndustryLabel: string;
  selectedUseCase: string;
  selectedUseCaseLabel: string;
  customUseCaseLabel?: string;
  customDescription?: string;
  initialBrandUrl?: string;
  workshopLevel?: WorkshopLevel;
  onWorkshopLevelChange?: (level: WorkshopLevel) => void;
  levelExplicitlySelected?: boolean;
  disabledSectionTags?: Set<string>;
  prerequisitesVisible?: boolean;
  onStepPromptGenerated: (stepNumber: number, promptText: string) => void;
  onIndustryChange: (value: string, label: string) => void;
  onUseCaseChange: (value: string, label: string) => void;
  onCustomUseCaseChange?: (customLabel: string, customDescription: string) => void;
  onBrandUrlChange?: (url: string) => void;
  onCompletedStepsChange: (steps: Set<number>) => void;
  skippedSteps?: Set<number>;
  onSkippedStepsChange?: (steps: Set<number>) => void;
  initialExpandedStep?: number;
  prerequisitesCompleted?: boolean;
  onPrerequisitesComplete?: () => void;
  codingAssistant?: string | null;
  onCodingAssistantChange?: (id: string) => void;
  dataRefreshKey?: number; // Incremented when data needs to be refreshed (e.g., after config changes)
  isSessionLoaded?: boolean; // True once session data has been fetched from backend
  useCaseLockedLevel?: WorkshopLevel | null;
  currentUser?: string;
  defaultCatalog?: string;
  direction?: WorkflowDirection;
  directionLocked?: boolean;
  onDirectionChange?: (direction: WorkflowDirection) => void;
  aiAgentsModules?: Set<AIAgentModule>;
  onAIModulesChange?: (modules: Set<AIAgentModule>) => void;
  medallionLayers?: Set<MedallionLayer>;
  onMedallionLayersChange?: (layers: Set<MedallionLayer>) => void;
  readOnly?: boolean;
}

// Step badge component for consistent styling
function StepBadge({ number, highlight = false }: { number: number; highlight?: boolean }) {
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-ui-sm font-semibold border-2 shadow-md ${
        highlight 
          ? 'bg-primary text-primary-foreground border-primary shadow-primary/30' 
          : 'bg-card text-foreground border-border'
      }`}>
        {number}
      </div>
    </div>
  );
}

// Section divider component
function SectionDivider({ section }: { section: typeof WORKFLOW_SECTIONS[0] }) {
  const Icon = section.icon;
  return (
    <div className="flex items-center gap-3 py-4 my-2">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${section.bgColor} border ${section.borderColor}`}>
        <Icon className={`w-4 h-4 ${section.color}`} />
        <span className={`text-ui-xs font-semibold uppercase tracking-wider ${section.color}`}>
          {section.chapter}
        </span>
        <span className="text-ui-sm font-medium text-foreground">
          {section.title}
        </span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function WorkflowDiagram({
  sessionId,
  stepPrompts,
  completedSteps,
  selectedIndustry,
  selectedIndustryLabel,
  selectedUseCase,
  selectedUseCaseLabel,
  customUseCaseLabel = '',
  customDescription = '',
  initialBrandUrl = '',
  workshopLevel = 'end-to-end',
  onWorkshopLevelChange,
  levelExplicitlySelected = false,
  disabledSectionTags = new Set<string>(),
  prerequisitesVisible = true,
  onStepPromptGenerated,
  onIndustryChange,
  onUseCaseChange,
  onCustomUseCaseChange,
  onBrandUrlChange,
  onCompletedStepsChange,
  skippedSteps = new Set<number>(),
  onSkippedStepsChange,
  initialExpandedStep = 1,
  prerequisitesCompleted = false,
  onPrerequisitesComplete,
  codingAssistant = null,
  onCodingAssistantChange,
  dataRefreshKey = 0,
  isSessionLoaded = false,
  useCaseLockedLevel,
  currentUser = '',
  defaultCatalog = '',
  direction = 'forward',
  directionLocked = false,
  onDirectionChange,
  aiAgentsModules,
  onAIModulesChange,
  medallionLayers,
  onMedallionLayersChange,
  readOnly = false,
}: WorkflowDiagramProps) {
  // UI option is now always cursor (Figma option removed from UI)
  // Lazy initializers ensure correct state on SPA re-mount (navigate away and back)
  const isReturningUser = isSessionLoaded && completedSteps.size > 0;
  const [expandedStep, setExpandedStep] = useState<number | null>(() =>
    initialExpandedStep && isReturningUser ? initialExpandedStep : null
  );
  
  // Section state
  const initSection = initialExpandedStep ? getSectionForStep(initialExpandedStep) : null;
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    () => initSection?.id ?? null
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => initSection?.id ?? null
  );
  const [showSectionDetail, setShowSectionDetail] = useState(
    () => !(initialExpandedStep && isReturningUser)
  );
  
  // Celebration state for step/chapter completion
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  
  // Parameter refresh -- incremented when session parameters change via the sidebar popover
  const [paramRefreshKey, setParamRefreshKey] = useState(0);
  const effectiveRefreshKey = dataRefreshKey + paramRefreshKey;
  
  // Lakehouse params refresh key -- bumped after auto-set from Step 9 completes
  const [lakehouseParamsRefreshKey, setLakehouseParamsRefreshKey] = useState(0);
  const [lakehouseParamsLoaded, setLakehouseParamsLoaded] = useState(true);
  const [step10Mode, setStep10Mode] = useState<'extract' | 'upload' | 'generate'>('extract');
  const [step12Mode, setStep12Mode] = useState<'clone' | 'generate'>('clone');
  const [step22Mode, setStep22Mode] = useState<'silver' | 'upload' | 'generate'>('silver');

  // Gold table target for Agent Skills Accelerator (Step 26+)
  const [goldTableTarget, setGoldTableTarget] = useState<GoldTableTarget>({
    catalog: '',
    schema: '',
    prefix: '',
  });
  const goldTargetManuallyEdited = useRef(false);

  // Auto-derive gold table target defaults from user email + use case.
  // For skills-accelerator: only set catalog, leave schema blank so user picks
  // their existing gold tables via the editor (prevents creating unwanted schemas).
  useEffect(() => {
    if (goldTargetManuallyEdited.current) return;
    const catalog = defaultCatalog || goldTableTarget.catalog;
    if (workshopLevel === 'skills-accelerator') {
      if (catalog && catalog !== goldTableTarget.catalog) {
        setGoldTableTarget(prev => ({ ...prev, catalog }));
      }
      return;
    }
    const label = customUseCaseLabel || selectedUseCaseLabel;
    const schema = (currentUser && label)
      ? deriveSchemaName(currentUser, label, 'gold')
      : goldTableTarget.schema;
    if (catalog !== goldTableTarget.catalog || schema !== goldTableTarget.schema) {
      setGoldTableTarget(prev => ({ ...prev, catalog, schema }));
    }
  }, [currentUser, customUseCaseLabel, selectedUseCaseLabel, defaultCatalog, workshopLevel]);

  // Track which mode produced the saved output so we don't bleed it into the other tab
  const [step10OutputMode, setStep10OutputMode] = useState<'extract' | 'upload' | 'generate' | null>(null);
  const [step12OutputMode, setStep12OutputMode] = useState<'clone' | 'generate' | null>(null);
  const [step22OutputMode, setStep22OutputMode] = useState<'silver' | 'upload' | 'generate' | null>(null);

  // Wrapped onPromptGenerated that also records which mode produced the output
  const handleStep10ExtractGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep10OutputMode('extract');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep10UploadGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep10OutputMode('upload');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep10GenerateGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep10OutputMode('generate');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep12CloneGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep12OutputMode('clone');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep12GenerateGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep12OutputMode('generate');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep22SilverGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep22OutputMode('silver');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep22UploadGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep22OutputMode('upload');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  const handleStep22GenerateGenerated = useCallback((stepNumber: number, prompt: string) => {
    setStep22OutputMode('generate');
    onStepPromptGenerated(stepNumber, prompt);
  }, [onStepPromptGenerated]);

  // Auto-detect output mode on session load
  useEffect(() => {
    if (isSessionLoaded && stepPrompts[10] && step10OutputMode === null) {
      setStep10OutputMode('extract');
    }
  }, [isSessionLoaded, stepPrompts[10], step10OutputMode]);

  useEffect(() => {
    if (isSessionLoaded && stepPrompts[12] && step12OutputMode === null) {
      setStep12OutputMode('clone');
    }
  }, [isSessionLoaded, stepPrompts[12], step12OutputMode]);

  useEffect(() => {
    if (isSessionLoaded && stepPrompts[22] && step22OutputMode === null) {
      setStep22OutputMode('silver');
    }
  }, [isSessionLoaded, stepPrompts[22], step22OutputMode]);

  // Get filtered sections based on workshop level and disabled steps.
  // When on the app chain and crossing into lakehouse/lakehouse-di, compute
  // cumulative overrides so app + lakebase sections remain visible.
  const cumulativeOverrides = useMemo(
    () => getCumulativeOverrides(workshopLevel, completedSteps),
    [workshopLevel, completedSteps],
  );
  const rawSections = getFilteredSections(
    workshopLevel,
    disabledSectionTags,
    cumulativeOverrides ?? undefined,
    direction,
  );
  const visibleSections = useMemo(() => {
    if (workshopLevel === 'genie-accelerator' && step22Mode === 'upload') {
      return rawSections.map(section => {
        if (section.id === 'lakehouse') {
          const hasStep12 = section.steps.some(s => s.number === 12);
          if (!hasStep12) {
            const step22Idx = section.steps.findIndex(s => s.number === 22);
            const newSteps = [...section.steps];
            newSteps.splice(step22Idx + 1, 0, ALL_STEPS[12]);
            return { ...section, steps: newSteps };
          }
        }
        return section;
      });
    }
    return rawSections;
  }, [rawSections, workshopLevel, step22Mode]);

  // Step 9 (Register Lakebase in UC) means schemas are already in Unity Catalog;
  // lock the CSV upload path in Steps 10 and 12.
  const hasLakebaseRegistration = useMemo(
    () => visibleSections.some(s => s.steps.some(step => step.number === 9)),
    [visibleSections]
  );

  // When Lakebase registration is active, force Step 10 to "extract" mode
  useEffect(() => {
    if (hasLakebaseRegistration && step10Mode === 'upload') {
      setStep10Mode('extract');
    }
  }, [hasLakebaseRegistration]);

  // Auto-sync Step 12 mode with Step 10 mode
  useEffect(() => {
    setStep12Mode(step10Mode === 'extract' ? 'clone' : 'generate');
  }, [step10Mode]);

  // Programmatic expand for Prerequisites (triggered by "Start the Build" button)
  const [forcePrereqExpanded, setForcePrereqExpanded] = useState(false);

  // ---------------------------------------------------------------------------
  // Wizard Stage -- progressive disclosure for new users
  // Stage 0: Welcome (WorkshopIntro expanded)
  // Stage 1: Coding Assistant (CodingAssistantSelector expanded)
  // Stage 2: Prerequisites (Prerequisites expanded)
  // Stage 3: Define Intent (DefineIntentSection expanded)
  // Stage 4: Path & Architecture (PathAndArchitecture expanded)
  // Stage 5: Workflow (main workflow area visible)
  // ---------------------------------------------------------------------------
  type WizardStage = 0 | 1 | 2 | 3 | 4 | 5;

  // Tracks explicit user actions to advance through wizard stages
  const [welcomeAcknowledged, setWelcomeAcknowledged] = useState(false);
  const [codingAssistantConfirmed, setCodingAssistantConfirmed] = useState(false);
  const [pathAcknowledged, setPathAcknowledged] = useState(false);

  // Reset wizard + UI state when session changes (component doesn't unmount on "Start New Session")
  const prevSessionId = useRef(sessionId);
  useEffect(() => {
    if (sessionId !== prevSessionId.current) {
      setWelcomeAcknowledged(false);
      setCodingAssistantConfirmed(false);
      setPathAcknowledged(false);
      setForcePrereqExpanded(false);
      setWorkflowUserOverride(null);
      setExpandedStep(null);
      setShowSectionDetail(true);
      setStep10Mode('extract');
      setStep12Mode('clone');
      setStep22Mode('silver');
      setStep10OutputMode(null);
      setStep12OutputMode(null);
      setStep22OutputMode(null);
      prevSessionId.current = sessionId;
    }
  }, [sessionId]);

  // Auto-acknowledge for returning users (they already have progress)
  useEffect(() => {
    if (isSessionLoaded && (selectedIndustry || selectedUseCase || completedSteps.size > 0 || prerequisitesCompleted || codingAssistant)) {
      setWelcomeAcknowledged(true);
    }
    if (isSessionLoaded && codingAssistant && (prerequisitesCompleted || completedSteps.size > 0)) {
      setCodingAssistantConfirmed(true);
    }
    // Only auto-set pathAcknowledged when user has actual workshop progress (step 2+).
    // completedSteps.size === 1 means only Define Intent is done — user still needs to pick a path.
    if (isSessionLoaded && completedSteps.size > 1) {
      setPathAcknowledged(true);
    }
  }, [isSessionLoaded, selectedIndustry, selectedUseCase, completedSteps.size, prerequisitesCompleted, codingAssistant]);

  const deriveWizardStage = useCallback((): WizardStage => {
    const intentDefined = completedSteps.has(1) || (!!selectedIndustry && !!selectedUseCase);

    // Returning user with workflow progress → jump to Stage 5
    if (completedSteps.size > 1) return 5;
    // Intent defined and path acknowledged → Stage 5 (Workshop)
    if (intentDefined && pathAcknowledged) return 5;
    // Intent defined → Stage 4 (Path & Architecture)
    if (intentDefined) return 4;
    // Prerequisites completed -- OR hidden by admin visibility config, in which
    // case there is nothing for the user to complete and we must auto-advance
    // onto the next visible stage (Define Intent) instead of stranding them.
    if (prerequisitesCompleted || !prerequisitesVisible) return 3;
    // Coding assistant confirmed → Stage 2 (Prerequisites)
    if (codingAssistantConfirmed) return 2;
    // Welcome acknowledged → Stage 1 (Coding Assistant)
    if (welcomeAcknowledged) return 1;
    return 0;
  }, [completedSteps, prerequisitesCompleted, prerequisitesVisible, codingAssistantConfirmed, selectedIndustry, selectedUseCase, welcomeAcknowledged, pathAcknowledged]);

  const wizardStage = deriveWizardStage();
  const prevWizardStage = useRef(wizardStage);

  // Staggered transition: delay the expansion of the next section
  const [stageTransitioning, setStageTransitioning] = useState(false);
  useEffect(() => {
    if (wizardStage !== prevWizardStage.current) {
      setStageTransitioning(true);
      const timer = setTimeout(() => setStageTransitioning(false), 400);
      prevWizardStage.current = wizardStage;
      return () => clearTimeout(timer);
    }
  }, [wizardStage]);

  // Collapsible workflow area state
  const [workflowUserOverride, setWorkflowUserOverride] = useState<boolean | null>(null);
  const workflowAutoExpanded = wizardStage >= 5;
  const isWorkflowExpanded = workflowUserOverride !== null ? workflowUserOverride : workflowAutoExpanded;
  
  // Session restore: when a session finishes loading, jump the returning user
  // back to the exact step they left off on and expand it.
  //
  // Waits for `isSessionLoaded === true` so we never touch state during the
  // in-flight load (App.tsx applies session data in one batch and flips
  // isSessionLoading ~550ms later; acting on the earlier batch would wipe
  // expandedStep/showSectionDetail back to defaults and cause the inner
  // scroll container to unmount mid-scroll -- the root cause of the
  // "only scrolls to top of workflow" regression).
  //
  // Restores exactly once per sessionId (guarded by restoredSessionIdRef), so
  // switching sessions from "My Saved Sessions" also works.
  const restoredSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSessionLoaded) return;
    if (!sessionId) return;
    if (!initialExpandedStep) return;
    if (restoredSessionIdRef.current === sessionId) return;

    // Only restore for returning users with real progress. A brand-new
    // session (nothing completed, step still 1) should follow the normal
    // wizard flow -- don't hijack it.
    const hasProgress = completedSteps.size > 1 || initialExpandedStep > 1;
    if (!hasProgress) {
      restoredSessionIdRef.current = sessionId;
      return;
    }

    restoredSessionIdRef.current = sessionId;

    // Batch the state updates: expand the right section, show the step list
    // (not the section detail panel), and expand the target step.
    const section = getSectionForStep(initialExpandedStep);
    if (section) {
      setExpandedSectionId(section.id);
      setSelectedSectionId(section.id);
    }
    setExpandedStep(initialExpandedStep);
    setShowSectionDetail(false);

    // Scroll in two phases after React has committed and the browser has
    // laid out (RAF x2). Outer smooth-scroll brings the workflow card into
    // view; inner uses 'auto' to avoid racing the outer animation, with a
    // short retry loop so we succeed even if the step DOM mounts late.
    let cancelled = false;
    const outerRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const workflowArea = document.getElementById('workflow-area');
        workflowArea?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const stepNumber = initialExpandedStep;
        const maxAttempts = 6;
        const attemptDelayMs = 120;
        let attempt = 0;
        const tryScroll = () => {
          if (cancelled) return;
          const stepElement = document.querySelector(
            `[data-step-number="${stepNumber}"]`
          ) as HTMLElement | null;
          const contentContainer = document.getElementById('workflow-content');
          if (stepElement && contentContainer) {
            const containerRect = contentContainer.getBoundingClientRect();
            const stepRect = stepElement.getBoundingClientRect();
            const target = Math.max(
              0,
              contentContainer.scrollTop + (stepRect.top - containerRect.top) - 20
            );
            contentContainer.scrollTo({ top: target, behavior: 'auto' });
            // Verify we landed close to the target; if not, retry.
            const drift = Math.abs(contentContainer.scrollTop - target);
            if (drift < 4 || attempt >= maxAttempts - 1) return;
          }
          if (attempt < maxAttempts - 1) {
            attempt += 1;
            setTimeout(tryScroll, attemptDelayMs);
          }
        };
        // Let the outer smooth scroll settle first so getBoundingClientRect
        // reads stable coordinates.
        setTimeout(tryScroll, 350);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
    };
  }, [isSessionLoaded, sessionId, initialExpandedStep, completedSteps.size]);

  // Auto-expand section when a step becomes active
  useEffect(() => {
    if (expandedStep) {
      const section = getSectionForStep(expandedStep);
      if (section && expandedSectionId !== section.id) {
        setExpandedSectionId(section.id);
        setSelectedSectionId(section.id);
      }
      setShowSectionDetail(false);
    }
  }, [expandedStep]);

  // Clamp `expandedStep` to a visible step when AI module toggles (or any other
  // visibility change) hide the currently-expanded one. Lands on the next visible
  // step >= expandedStep, falling back to the previous one. The effect above
  // syncs the section id once `expandedStep` is updated.
  useEffect(() => {
    if (expandedStep == null) return;
    const visible: number[] = [];
    for (const section of visibleSections) {
      for (const step of section.steps) visible.push(step.number);
    }
    if (visible.includes(expandedStep)) return;
    const after  = visible.find(n => n > expandedStep);
    const before = [...visible].reverse().find(n => n < expandedStep);
    setExpandedStep(after ?? before ?? null);
  }, [visibleSections, expandedStep]);

  const scrollToStep = useCallback((stepNumber: number) => {
    setTimeout(() => {
      const stepElement = document.querySelector(`[data-step-number="${stepNumber}"]`);
      const contentContainer = document.getElementById('workflow-content');
      if (stepElement && contentContainer) {
        const containerRect = contentContainer.getBoundingClientRect();
        const stepRect = stepElement.getBoundingClientRect();
        const scrollTop = contentContainer.scrollTop + (stepRect.top - containerRect.top) - 20;
        contentContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 100);
  }, []);

  const handleStartBuild = useCallback(() => {
    setPathAcknowledged(true);
    setWorkflowUserOverride(null);

    // Find the first incomplete step across all visible sections
    let targetStep = SET_UP_PROJECT_STEP_ID;
    for (const section of visibleSections) {
      for (const step of section.steps) {
        if (!completedSteps.has(step.number) && !skippedSteps.has(step.number)) {
          targetStep = step.number;
          break;
        }
      }
      if (targetStep !== SET_UP_PROJECT_STEP_ID || !completedSteps.has(SET_UP_PROJECT_STEP_ID)) break;
    }

    const targetSection = getSectionForStep(targetStep);
    setExpandedSectionId(targetSection?.id ?? visibleSections[0]?.id);
    setSelectedSectionId(targetSection?.id ?? visibleSections[0]?.id);
    setExpandedStep(targetStep);
    setShowSectionDetail(false);

    // First scroll the page to the workflow area, then scroll within the container to the step
    setTimeout(() => {
      const workflowArea = document.getElementById('workflow-area');
      if (workflowArea) {
        workflowArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        scrollToStep(targetStep);
      }, 400);
    }, 350);
  }, [visibleSections, completedSteps, skippedSteps, scrollToStep]);

  const handlePromptGenerated = (prompt: string, industry: string, useCase: string, industryLabel?: string, useCaseLabel?: string, customDesc?: string) => {
    if (readOnly) return;
    onIndustryChange(industry, industryLabel || industry);
    onUseCaseChange(useCase, useCaseLabel || useCase);
    
    // Notify parent of custom use case edits if provided
    if (onCustomUseCaseChange) {
      onCustomUseCaseChange(useCaseLabel || useCase, customDesc || '');
    }
    
    onStepPromptGenerated(1, prompt);
    
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(1);
    onCompletedStepsChange(newCompletedSteps);
    
    // Scroll to the Path & Architecture section so the user picks their path next
    setShowSectionDetail(false);
    setTimeout(() => {
      const pathEl = document.getElementById('path-architecture-section');
      if (pathEl) {
        pathEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 400);
  };

  // Get the next step based on current step and visible sections
  // This handles the new chapter structure where steps may not be contiguous
  const getNextStep = useCallback((stepId: number): number | null => {
    const visibleStepNumbers: number[] = [];
    for (const section of visibleSections) {
      for (const step of section.steps) {
        visibleStepNumbers.push(step.number);
      }
    }
    
    if (stepId === 4) return 5;
    
    const currentIndex = visibleStepNumbers.indexOf(stepId);
    if (currentIndex === -1) return null;
    
    if (stepId === 7) return 8;
    
    const nextIndex = currentIndex + 1;
    if (nextIndex >= visibleStepNumbers.length) return null;
    
    return visibleStepNumbers[nextIndex];
  }, [visibleSections]);

  const handleSetUpProjectComplete = () => {
    const newSet = new Set(completedSteps);
    if (newSet.has(SET_UP_PROJECT_STEP_ID)) {
      newSet.delete(SET_UP_PROJECT_STEP_ID);
    } else {
      newSet.add(SET_UP_PROJECT_STEP_ID);
      const next = getNextStep(SET_UP_PROJECT_STEP_ID);
      if (next !== null) {
        setExpandedStep(next);
        setShowSectionDetail(false);
        scrollToStep(next);
      }
    }
    onCompletedStepsChange(newSet);
  };

  // Helper to get step title for celebration display
  const getStepTitle = useCallback((stepId: number): string => {
    const step = ALL_STEPS[stepId];
    return step?.title || `Step ${stepId}`;
  }, []);

  // Trigger celebration with optional leaderboard comparison for milestones
  const triggerCelebration = useCallback(async (
    stepId: number, 
    newCompletedSteps: Set<number>
  ) => {
    const points = getStepPoints(stepId);
    
    // Build set of visible step numbers so chapter completion only requires visible steps
    const visibleStepNumbers = new Set<number>();
    for (const section of visibleSections) {
      for (const step of section.steps) {
        visibleStepNumbers.add(step.number);
      }
    }
    // Step 1 (Define Your Intent) is always tracked but lives outside workflow sections
    visibleStepNumbers.add(1);
    
    const completedChapter = getCompletedChapter(completedSteps, stepId, skippedSteps, visibleStepNumbers);
    
    if (completedChapter) {
      // Milestone celebration - fetch leaderboard for comparison
      const totalScore = calculateTotalScore(newCompletedSteps, skippedSteps);
      let leaderboardMessage = '';
      
      try {
        const leaderboard = await apiClient.getLeaderboard();
        const topScores = leaderboard.map(entry => entry.score);
        leaderboardMessage = getLeaderboardMessage(totalScore, topScores);
      } catch (err) {
        console.error('Failed to fetch leaderboard for celebration:', err);
        leaderboardMessage = 'Keep going!';
      }
      
      setCelebration({
        type: 'milestone',
        pointsEarned: completedChapter.chapterPoints,
        milestoneTitle: completedChapter.display,
        chapterName: completedChapter.name,
        sessionId: sessionId || undefined,
        totalScore,
        leaderboardMessage,
      });
    } else {
      // Step celebration
      setCelebration({
        type: 'step',
        pointsEarned: points,
        stepTitle: getStepTitle(stepId),
      });
    }
  }, [completedSteps, skippedSteps, visibleSections, getStepTitle, sessionId]);

  const toggleStepComplete = useCallback((stepId: number, shouldExpandNext: boolean = true) => {
    if (readOnly) return;
    const newSet = new Set(completedSteps);
    
    if (newSet.has(stepId)) {
      return;
    }
    
    newSet.add(stepId);
    
    if (skippedSteps.has(stepId)) {
      const newSkipped = new Set(skippedSteps);
      newSkipped.delete(stepId);
      onSkippedStepsChange?.(newSkipped);
    }
    
    if (stepId === 9 && sessionId) {
      setLakehouseParamsLoaded(false);
      apiClient.autoSetLakehouseParamsFromLakebase(sessionId)
        .then(() => {
          setLakehouseParamsRefreshKey(k => k + 1);
        })
        .catch(err => {
          console.warn('Failed to auto-set lakehouse params from Lakebase:', err);
          setLakehouseParamsRefreshKey(k => k + 1);
        })
        .finally(() => {
          setLakehouseParamsLoaded(true);
        });
    }
    
    triggerCelebration(stepId, newSet);
    
    if (shouldExpandNext) {
      const nextStep = getNextStep(stepId);
      if (nextStep) {
        const currentSection = getSectionForStep(stepId);
        const nextSection = getSectionForStep(nextStep);
        
        if (currentSection?.id !== nextSection?.id && nextSection) {
          setExpandedSectionId(nextSection.id);
          setSelectedSectionId(nextSection.id);
        }
        
        setExpandedStep(nextStep);
        setShowSectionDetail(false);
        scrollToStep(nextStep);
      } else {
        setExpandedStep(null);
      }
    }
    onCompletedStepsChange(newSet);
  }, [completedSteps, skippedSteps, sessionId, onCompletedStepsChange, onSkippedStepsChange, triggerCelebration, getNextStep, scrollToStep]);
  
  // Handle celebration complete
  const handleCelebrationComplete = useCallback(() => {
    setCelebration(null);
  }, []);
  
  // Reset a step (mark as incomplete) - called when user re-generates
  const resetStepComplete = useCallback((stepId: number) => {
    if (readOnly) return;
    const newSet = new Set(completedSteps);
    if (newSet.has(stepId)) {
      newSet.delete(stepId);
      onCompletedStepsChange(newSet);
    }
  }, [completedSteps, onCompletedStepsChange]);

  // Navigate to the next visible step (expand it, scroll to it)
  const navigateToNextStep = useCallback((currentStep: number) => {
    const nextStep = getNextStep(currentStep);
    if (nextStep) {
      const nextSection = getSectionForStep(nextStep);
      if (nextSection) {
        setExpandedSectionId(nextSection.id);
        setSelectedSectionId(nextSection.id);
      }
      setExpandedStep(nextStep);
      setShowSectionDetail(false);
      scrollToStep(nextStep);
    }
  }, [getNextStep, getSectionForStep, scrollToStep]);

  // Toggle skip state for a step (Ch3/Ch4 only)
  const toggleStepSkip = useCallback((stepId: number) => {
    if (readOnly) return;
    const newSkipped = new Set(skippedSteps);
    const isUndoing = newSkipped.has(stepId);
    
    if (isUndoing) {
      newSkipped.delete(stepId);
    } else {
      newSkipped.add(stepId);
      const newCompleted = new Set(completedSteps);
      if (newCompleted.has(stepId)) {
        newCompleted.delete(stepId);
        onCompletedStepsChange(newCompleted);
      }
      navigateToNextStep(stepId);
    }
    onSkippedStepsChange?.(newSkipped);
  }, [skippedSteps, completedSteps, onCompletedStepsChange, onSkippedStepsChange, navigateToNextStep]);

  const scrollToStepInContainer = useCallback((stepNumber: number) => {
    setTimeout(() => {
      const stepElement = document.querySelector(`[data-step-number="${stepNumber}"]`);
      const contentContainer = document.getElementById('workflow-content');
      if (stepElement && contentContainer) {
        const containerRect = contentContainer.getBoundingClientRect();
        const stepRect = stepElement.getBoundingClientRect();
        const scrollTop = contentContainer.scrollTop + (stepRect.top - containerRect.top) - 20;
        contentContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 100);
  }, []);

  const toggleExpand = useCallback((stepNumber: number) => {
    setExpandedStep(prev => {
      const newExpandedStep = prev === stepNumber ? null : stepNumber;
      if (newExpandedStep) {
        const section = getSectionForStep(newExpandedStep);
        if (section) {
          setExpandedSectionId(section.id);
          setSelectedSectionId(section.id);
        }
        setShowSectionDetail(false);
        scrollToStepInContainer(newExpandedStep);
      }
      return newExpandedStep;
    });
  }, [scrollToStepInContainer]);

  const handleSidebarStepClick = useCallback((stepNumber: number) => {
    setExpandedStep(stepNumber);
    setShowSectionDetail(false);
    
    const section = getSectionForStep(stepNumber);
    if (section) {
      setExpandedSectionId(section.id);
      setSelectedSectionId(section.id);
    }
    
    scrollToStepInContainer(stepNumber);
  }, [scrollToStepInContainer]);

  const handleSectionClick = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setShowSectionDetail(true);
    setExpandedStep(null);
    
    setExpandedSectionId(sectionId);
  };

  const handleSectionToggle = (sectionId: string) => {
    setExpandedSectionId(prev => prev === sectionId ? null : sectionId);
  };

  const handleStartSection = () => {
    if (!selectedSectionId) return;
    
    const section = visibleSections.find(s => s.id === selectedSectionId);
    if (!section) return;
    
    // Find first incomplete step in this section
    const firstIncomplete = section.steps.find(s => {
      if (s.number === 4) return !completedSteps.has(4);
      return !completedSteps.has(s.number);
    });
    
    if (firstIncomplete) {
      setExpandedStep(firstIncomplete.number);
      setShowSectionDetail(false);
      scrollToStepInContainer(firstIncomplete.number);
    }
  };

  // Check if previous step is complete for enabling current step
  // IMPORTANT: Only returns true if the previous step is MARKED AS DONE (not just generated)
  const isPreviousStepComplete = useCallback((stepNumber: number): boolean => {
    // Step 1 (Define Your Intent) is a universal prerequisite for all steps
    if (!completedSteps.has(1)) return false;

    const visibleStepNumbers: number[] = [];
    for (const section of visibleSections) {
      for (const step of section.steps) {
        visibleStepNumbers.push(step.number);
      }
    }
    
    const currentIndex = visibleStepNumbers.indexOf(stepNumber);
    if (currentIndex <= 0) return true;
    
    for (let i = 0; i < currentIndex; i++) {
      const prevStep = visibleStepNumbers[i];
      if (!completedSteps.has(prevStep) && !skippedSteps.has(prevStep)) {
        return false;
      }
    }
    return true;
  }, [visibleSections, completedSteps, skippedSteps]);

  // Render steps for a specific section (uses filtered visibleSections so hidden steps are excluded)
  const renderSectionSteps = (sectionId: string) => {
    const section = visibleSections.find(s => s.id === sectionId);
    if (!section) return null;

    return (
      <div className="space-y-4">
        {section.steps.map((step) => {
          // Render appropriate component based on step number
          switch (step.number) {
            case 2:
              return (
                <div key={2} className="relative mt-5" data-step-number="2">
                  <StepBadge number={2} />
                  <SetUpProjectStep
                    isComplete={completedSteps.has(SET_UP_PROJECT_STEP_ID)}
                    onMarkComplete={handleSetUpProjectComplete}
                    isExpanded={expandedStep === SET_UP_PROJECT_STEP_ID}
                    onToggleExpand={() => toggleExpand(SET_UP_PROJECT_STEP_ID)}
                    isPreviousStepComplete={completedSteps.has(1)}
                    refreshKey={effectiveRefreshKey}
                    onStepReset={() => {
                      const newSet = new Set(completedSteps);
                      newSet.delete(SET_UP_PROJECT_STEP_ID);
                      onCompletedStepsChange(newSet);
                    }}
                    sessionId={sessionId}
                    useCaseLabel={customUseCaseLabel || selectedUseCaseLabel}
                  />
                </div>
              );
            case 3:
              return (
                <div key={3} className="relative mt-5" data-step-number="3">
                  <StepBadge number={3} />
                  <WorkflowStep
                    icon={<FileText className="w-5 h-5" />}
                    title="Product Requirements Document (PRD)"
                    description="Generate a simple, focused PRD defining your application and its key high-value features"
                    color="indigo"

                    isComplete={completedSteps.has(3)}
                    onToggleComplete={() => toggleStepComplete(3)}
                    onStepReset={() => resetStepComplete(3)}
                    sectionTag="prd_generation"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={3}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[3]}
                    isPreviousStepComplete={isPreviousStepComplete(3)}
                    isExpanded={expandedStep === 3}
                    onToggleExpand={() => toggleExpand(3)}
                    sessionId={sessionId}
                  />
                </div>
              );
            case 4:
              return (
                <div key={4} className="relative mt-5" data-step-number="4">
                  <StepBadge number={4} />
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <div 
                      className="flex items-center gap-3 p-5 cursor-pointer group"
                      onClick={() => toggleExpand(4)}
                    >
                      <div className="bg-purple-500/20 p-2.5 rounded-md text-purple-400">
                        <Palette className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-ui-lg font-semibold text-foreground leading-tight ${completedSteps.has(4) ? 'line-through opacity-50' : ''}`}>
                            UI Design
                          </h3>
                          {completedSteps.has(4) && (
                            <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
                          )}
                        </div>
                        <p className={`text-ui-base text-muted-foreground mt-1 leading-relaxed ${completedSteps.has(4) ? 'line-through opacity-50' : ''}`}>
                          Build UI and backend APIs from PRD, then test locally before deployment
                        </p>
                      </div>
                      <div className={`p-1 rounded transition-colors ${expandedStep === 4 ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {expandedStep === 4 ? <ArrowDown className="w-5 h-5" /> : <Code className="w-5 h-5" />}
                      </div>
                    </div>

                    {expandedStep === 4 && (
                      <div className="p-0 border-t border-border">
                        <WorkflowStep
                          icon={<Code className="w-5 h-5" />}
                          title="UI Design - Build Locally"
                          description="Build UI and backend APIs from PRD, then test locally before deployment"
                          color="teal"
                          input="UI Design"
      
                          isComplete={completedSteps.has(4)}
                          onToggleComplete={() => toggleStepComplete(4)}
                          onStepReset={() => resetStepComplete(4)}
                          sectionTag="cursor_copilot_ui_design"
                          industry={selectedIndustry}
                          useCase={selectedUseCase}
                          embedded={true}
                          stepNumber={4}
                          onPromptGenerated={onStepPromptGenerated}
                          initialPrompt={stepPrompts[4]}
                          isPreviousStepComplete={isPreviousStepComplete(4)}
                          sessionId={sessionId}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            // Step 5: Deploy App (Chapter 1)
            case 5:
              return (
                <div key={5} className="relative mt-5" data-step-number="5">
                  <StepBadge number={5} />
                  <WorkflowStep
                    icon={<Rocket className="w-5 h-5" />}
                    title="Deploy App"
                    description="Deploy your locally-tested application to Databricks Apps"
                    color="green"

                    isComplete={completedSteps.has(5)}
                    onToggleComplete={() => toggleStepComplete(5)}
                    onStepReset={() => resetStepComplete(5)}
                    sectionTag="deploy_databricks_app"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={5}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[5]}
                    isPreviousStepComplete={isPreviousStepComplete(5)}
                    isExpanded={expandedStep === 5}
                    onToggleExpand={() => toggleExpand(5)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 6: Setup Lakebase (Chapter 2)
            case 6:
              return (
                <div key={6} className="relative mt-5" data-step-number="6">
                  <StepBadge number={6} />
                  <WorkflowStep
                    icon={<Server className="w-5 h-5" />}
                    title="Setup Lakebase"
                    description="Create and deploy Lakebase database tables from your UI design document"
                    color="cyan"

                    isComplete={completedSteps.has(6)}
                    onToggleComplete={() => toggleStepComplete(6)}
                    onStepReset={() => resetStepComplete(6)}
                    sectionTag="setup_lakebase"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={6}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[6]}
                    isPreviousStepComplete={isPreviousStepComplete(6)}
                    isExpanded={expandedStep === 6}
                    onToggleExpand={() => toggleExpand(6)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 7: Wire UI to Lakebase (Chapter 2) - LOCAL DEVELOPMENT ONLY
            case 7:
              return (
                <div key={7} className="relative mt-5" data-step-number="7">
                  <StepBadge number={7} />
                  <WorkflowStep
                    icon={<Link2 className="w-5 h-5" />}
                    title="Wire UI to Lakebase"
                    description="Connect frontend to Lakebase backend, build locally, and test at localhost"
                    color="teal"

                    isComplete={completedSteps.has(7)}
                    onToggleComplete={() => toggleStepComplete(7)}
                    onStepReset={() => resetStepComplete(7)}
                    sectionTag="wire_ui_lakebase"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={7}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[7]}
                    isPreviousStepComplete={isPreviousStepComplete(7)}
                    isExpanded={expandedStep === 7}
                    onToggleExpand={() => toggleExpand(7)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 8: Deploy and Test (Chapter 2) - FULL DEPLOYMENT TO DATABRICKS
            case 8:
              return (
                <div key={8} className="relative mt-5" data-step-number="8">
                  <StepBadge number={8} />
                  <WorkflowStep
                    icon={<Play className="w-5 h-5" />}
                    title="Deploy and Test"
                    description="Deploy to Databricks Apps and run full end-to-end testing with live data"
                    color="lime"

                    isComplete={completedSteps.has(8)}
                    onToggleComplete={() => toggleStepComplete(8)}
                    onStepReset={() => resetStepComplete(8)}
                    sectionTag="workspace_setup_deploy"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={8}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[8]}
                    isPreviousStepComplete={isPreviousStepComplete(8)}
                    isExpanded={expandedStep === 8}
                    onToggleExpand={() => toggleExpand(8)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 9: Register Lakebase in Unity Catalog (Chapter 3) - Only visible when Lakebase chapter is included
            case 9:
              // This step only shows when Lakebase (Chapter 2) is in the workflow
              return (
                <div key={9} className="relative mt-5" data-step-number="9">
                  <StepBadge number={9} />
                  <WorkflowStep
                    icon={<Database className="w-5 h-5" />}
                    title="Register Lakebase in Unity Catalog"
                    description="Register Lakebase as a read-only Unity Catalog database catalog"
                    color="cyan"

                    isComplete={completedSteps.has(9)}
                    onToggleComplete={() => toggleStepComplete(9)}
                    onStepReset={() => resetStepComplete(9)}
                    isSkipped={skippedSteps.has(9)}
                    onToggleSkip={() => toggleStepSkip(9)}
                    onNavigateNext={() => navigateToNextStep(9)}
                    sectionTag="sync_from_lakebase"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={9}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[9]}
                    isPreviousStepComplete={isPreviousStepComplete(9)}
                    isExpanded={expandedStep === 9}
                    onToggleExpand={() => toggleExpand(9)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 10: Table Metadata (Chapter 3) - tabbed: Extract from Tables OR Upload CSV
            case 10: {
              const showUploadTab = !disabledSectionTags.has('bronze_table_metadata_upload');
              const showGenerateTab = !disabledSectionTags.has('bronze_table_metadata_generate');
              const step10Done = completedSteps.has(10);
              const step10Skipped = skippedSteps.has(10);
              const extractTabLocked = step10Done && step10Mode !== 'extract';
              const uploadTabLocked = (step10Done && step10Mode !== 'upload') || hasLakebaseRegistration;
              const generateTabLocked = step10Done && step10Mode !== 'generate';
              return (
                <div key={10} className="relative mt-5" data-step-number="10">
                  <StepBadge number={10} />
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    {/* Shared header */}
                    <div
                      className="flex items-center gap-3 p-5 cursor-pointer group"
                      onClick={() => toggleExpand(10)}
                    >
                      <div className="bg-amber-500/20 p-2.5 rounded-md text-amber-400">
                        <Table2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-ui-lg font-semibold text-foreground leading-tight ${step10Done ? 'line-through opacity-50' : ''}`}>
                            Table Metadata & Data Dictionary
                          </h3>
                          {step10Done && (
                            <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
                          )}
                        </div>
                        <p className={`text-ui-base text-muted-foreground mt-1 leading-relaxed ${step10Done ? 'line-through opacity-50' : ''}`}>
                          Extract table schema metadata from Databricks and save as a CSV data dictionary
                        </p>
                      </div>
                      <div className={`p-1 rounded transition-colors ${expandedStep === 10 ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {expandedStep === 10 ? <ArrowDown className="w-5 h-5" /> : <Table2 className="w-5 h-5" />}
                      </div>
                    </div>

                    <div className={`border-t border-border ${expandedStep === 10 ? '' : 'hidden'}`}>
                        {/* Mode tabs */}
                        {(showUploadTab || showGenerateTab) && (
                          <div className="flex border-b border-border">
                            <button
                              onClick={() => !extractTabLocked && setStep10Mode('extract')}
                              disabled={extractTabLocked}
                              className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                step10Mode === 'extract'
                                  ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                  : extractTabLocked
                                    ? 'text-muted-foreground/40 cursor-not-allowed'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                              }`}
                            >
                              <Database className="w-4 h-4" />
                              Extract from Tables
                              {extractTabLocked && <Lock className="w-3 h-3 ml-1" />}
                            </button>
                            {showUploadTab && (
                              <button
                                onClick={() => !uploadTabLocked && setStep10Mode('upload')}
                                disabled={uploadTabLocked}
                                className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                  step10Mode === 'upload'
                                    ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                    : uploadTabLocked
                                      ? 'text-muted-foreground/40 cursor-not-allowed'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                                }`}
                              >
                                <Upload className="w-4 h-4" />
                                Upload CSV
                                {uploadTabLocked && <Lock className="w-3 h-3 ml-1" />}
                              </button>
                            )}
                            {showGenerateTab && (
                              <button
                                onClick={() => !generateTabLocked && setStep10Mode('generate')}
                                disabled={generateTabLocked}
                                className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                  step10Mode === 'generate'
                                    ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                    : generateTabLocked
                                      ? 'text-muted-foreground/40 cursor-not-allowed'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                                }`}
                              >
                                <Sparkles className="w-4 h-4" />
                                Design from PRD
                                {generateTabLocked && <Lock className="w-3 h-3 ml-1" />}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tab content */}
                        <div className="p-0">
                          {step10Mode === 'extract' && (
                            <WorkflowStep
                              icon={<Table2 className="w-5 h-5" />}
                              title="Extract from Tables"
                              description="Extract table schema metadata from Databricks catalog"
                              color="amber"
                              isComplete={step10Done}
                              onToggleComplete={() => toggleStepComplete(10)}
                              onStepReset={() => { resetStepComplete(10); setStep10OutputMode(null); }}
                              isSkipped={step10Skipped}
                              onToggleSkip={() => toggleStepSkip(10)}
                              onNavigateNext={() => navigateToNextStep(10)}
                              sectionTag="bronze_table_metadata"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={10}
                              onPromptGenerated={handleStep10ExtractGenerated}
                              initialPrompt={step10OutputMode === 'extract' ? stepPrompts[10] : undefined}
                              previousOutputs={stepPrompts[3] ? { prd_document: stepPrompts[3] } : undefined}
                              isPreviousStepComplete={isPreviousStepComplete(10)}
                              sessionId={sessionId}
                              customHeaderContent={
                                <div onClick={(e) => e.stopPropagation()}>
                                  <LakehouseParamsEditor
                                    sessionId={sessionId}
                                    isExpanded={true}
                                    refreshKey={lakehouseParamsRefreshKey}
                                    onParamsLoaded={(loaded) => setLakehouseParamsLoaded(loaded)}
                                  />
                                </div>
                              }
                              generateDisabledReason={
                                !lakehouseParamsLoaded ? 'Loading source configuration...' : undefined
                              }
                            />
                          )}
                          {step10Mode === 'upload' && (
                            <div className="p-5">
                              <CsvUploadPanel
                                sessionId={sessionId}
                                industry={selectedIndustry}
                                useCase={selectedUseCase}
                                stepNumber={10}
                                onPromptGenerated={handleStep10UploadGenerated}
                                isPreviousStepComplete={isPreviousStepComplete(10)}
                                initialPrompt={step10OutputMode === 'upload' ? stepPrompts[10] : undefined}
                                isComplete={step10Done}
                                onToggleComplete={() => toggleStepComplete(10)}
                                isSkipped={step10Skipped}
                                onToggleSkip={() => toggleStepSkip(10)}
                                onNavigateNext={() => navigateToNextStep(10)}
                              />
                            </div>
                          )}
                          {step10Mode === 'generate' && (
                            <WorkflowStep
                              icon={<Sparkles className="w-5 h-5" />}
                              title="Design from PRD"
                              description="Design a database schema from your PRD — for when you don't have existing tables or a CSV"
                              color="amber"
                              isComplete={step10Done}
                              onToggleComplete={() => toggleStepComplete(10)}
                              onStepReset={() => { resetStepComplete(10); setStep10OutputMode(null); }}
                              isSkipped={step10Skipped}
                              onToggleSkip={() => toggleStepSkip(10)}
                              onNavigateNext={() => navigateToNextStep(10)}
                              sectionTag="bronze_table_metadata_generate"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={10}
                              onPromptGenerated={handleStep10GenerateGenerated}
                              initialPrompt={step10OutputMode === 'generate' ? stepPrompts[10] : undefined}
                              isPreviousStepComplete={isPreviousStepComplete(10)}
                              sessionId={sessionId}
                            />
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              );
            }
            // Step 11: Gold Layer Design (Chapter 3)
            // For genie-accelerator: uses genie_gold_design prompt with Metadata CSV + PRD
            case 11: {
              const isGenieStep11 = workshopLevel === 'genie-accelerator';
              return (
                <div key={11} className="relative mt-5" data-step-number="11">
                  <StepBadge number={11} />
                  <WorkflowStep
                    icon={<GitBranch className="w-5 h-5" />}
                    title="Gold Layer Design (PRD-aligned)"
                    description="Design Gold layer using project skills with YAML definitions and Mermaid ERD"
                    color="yellow"

                    isComplete={completedSteps.has(11)}
                    onToggleComplete={() => toggleStepComplete(11)}
                    onStepReset={() => resetStepComplete(11)}
                    isSkipped={skippedSteps.has(11)}
                    onToggleSkip={() => toggleStepSkip(11)}
                    onNavigateNext={() => navigateToNextStep(11)}
                    sectionTag={isGenieStep11 ? 'genie_gold_design' : 'gold_layer_design'}
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={11}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[11]}
                    previousOutputs={isGenieStep11
                      ? {
                          ...(stepPrompts[22] ? { table_metadata: stepPrompts[22] } : {}),
                          ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {})
                        }
                      : (stepPrompts[10] ? { table_metadata: stepPrompts[10] } : undefined)
                    }
                    isPreviousStepComplete={isPreviousStepComplete(11)}
                    isExpanded={expandedStep === 11}
                    onToggleExpand={() => toggleExpand(11)}
                    sessionId={sessionId}
                  />
                </div>
              );
            }
            // Step 12: Bronze Layer Creation (Chapter 3) - tabbed: Clone from Source OR Generate from CSV
            case 12: {
              const isGenieFlow = workshopLevel === 'genie-accelerator';
              const effectiveStep12Mode = isGenieFlow ? 'generate' : step12Mode;
              const showCloneTab = true;
              const showGenerateTab = !disabledSectionTags.has('bronze_layer_creation_upload');
              const step12Done = completedSteps.has(12);
              const step12Skipped = skippedSteps.has(12);
              const cloneTabLocked = (step12Done && effectiveStep12Mode !== 'clone') || step10Mode === 'upload' || step10Mode === 'generate' || isGenieFlow;
              const generateTabLocked = (step12Done && effectiveStep12Mode !== 'generate') || (!isGenieFlow && step10Mode === 'extract') || hasLakebaseRegistration;
              const tableMetadata = stepPrompts[10] || stepPrompts[22] || '';
              const step12PrevOutputs = tableMetadata ? { table_metadata: tableMetadata } : undefined;
              return (
                <div key={12} className="relative mt-5" data-step-number="12">
                  <StepBadge number={12} />
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    {/* Shared header */}
                    <div
                      className="flex items-center gap-3 p-5 cursor-pointer group"
                      onClick={() => toggleExpand(12)}
                    >
                      <div className="bg-orange-500/20 p-2.5 rounded-md text-orange-400">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-ui-lg font-semibold text-foreground leading-tight ${step12Done ? 'line-through opacity-50' : ''}`}>
                            Bronze Layer Creation
                          </h3>
                          {step12Done && (
                            <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
                          )}
                        </div>
                        <p className={`text-ui-base text-muted-foreground mt-1 leading-relaxed ${step12Done ? 'line-through opacity-50' : ''}`}>
                          {isGenieFlow
                            ? 'Generate Bronze layer DDLs and sample data from the uploaded schema CSV'
                            : 'Create Bronze layer by cloning from source or generating from uploaded CSV'}
                        </p>
                      </div>
                      <div className={`p-1 rounded transition-colors ${expandedStep === 12 ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {expandedStep === 12 ? <ArrowDown className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                      </div>
                    </div>

                    <div className={`border-t border-border ${expandedStep === 12 ? '' : 'hidden'}`}>
                        {/* Mode tabs -- Clone disabled in Genie flow or Upload CSV mode */}
                        {showCloneTab && showGenerateTab && (
                          <div className="flex border-b border-border">
                            <button
                              onClick={() => !cloneTabLocked && setStep12Mode('clone')}
                              disabled={cloneTabLocked}
                              className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                effectiveStep12Mode === 'clone'
                                  ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                  : cloneTabLocked
                                    ? 'text-muted-foreground/40 cursor-not-allowed'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                              }`}
                            >
                              <GitBranch className="w-4 h-4" />
                              Clone from Source
                              {cloneTabLocked && <Lock className="w-3 h-3 ml-1" />}
                            </button>
                            <button
                              onClick={() => !generateTabLocked && setStep12Mode('generate')}
                              disabled={generateTabLocked}
                              className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                effectiveStep12Mode === 'generate'
                                  ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                  : generateTabLocked
                                    ? 'text-muted-foreground/40 cursor-not-allowed'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              Generate from CSV
                              {generateTabLocked && <Lock className="w-3 h-3 ml-1" />}
                            </button>
                          </div>
                        )}

                        {/* Tab content */}
                        <div className="p-0">
                          {effectiveStep12Mode === 'clone' && (
                            <WorkflowStep
                              icon={<GitBranch className="w-5 h-5" />}
                              title="Clone from Source"
                              description="Create Bronze layer by copying sample data from the landing zone"
                              color="orange"
                              isComplete={step12Done}
                              onToggleComplete={() => toggleStepComplete(12)}
                              onStepReset={() => { resetStepComplete(12); setStep12OutputMode(null); }}
                              isSkipped={step12Skipped}
                              onToggleSkip={() => toggleStepSkip(12)}
                              onNavigateNext={() => navigateToNextStep(12)}
                              sectionTag="bronze_layer_creation"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={12}
                              onPromptGenerated={handleStep12CloneGenerated}
                              initialPrompt={step12OutputMode === 'clone' ? stepPrompts[12] : undefined}
                              previousOutputs={step12PrevOutputs}
                              isPreviousStepComplete={isPreviousStepComplete(12)}
                              sessionId={sessionId}
                            />
                          )}
                          {effectiveStep12Mode === 'generate' && (
                            <WorkflowStep
                              icon={<FileText className="w-5 h-5" />}
                              title="Generate from CSV"
                              description="Generate DDLs and sample data from the uploaded schema CSV"
                              color="orange"
                              isComplete={step12Done}
                              onToggleComplete={() => toggleStepComplete(12)}
                              onStepReset={() => { resetStepComplete(12); setStep12OutputMode(null); }}
                              isSkipped={step12Skipped}
                              onToggleSkip={() => toggleStepSkip(12)}
                              onNavigateNext={() => navigateToNextStep(12)}
                              sectionTag="bronze_layer_creation_upload"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={12}
                              onPromptGenerated={handleStep12GenerateGenerated}
                              initialPrompt={step12OutputMode === 'generate' ? stepPrompts[12] : undefined}
                              previousOutputs={step12PrevOutputs}
                              isPreviousStepComplete={isPreviousStepComplete(12)}
                              sessionId={sessionId}
                            />
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              );
            }
            // Step 13: Silver Layer (Chapter 3)
            case 13:
              return (
                <div key={13} className="relative mt-5" data-step-number="13">
                  <StepBadge number={13} />
                  <WorkflowStep
                    icon={<Shield className="w-5 h-5" />}
                    title="Silver Layer Pipelines"
                    description="Create Silver layer using Spark Declarative Pipelines with centralized data quality rules"
                    color="slate"

                    isComplete={completedSteps.has(13)}
                    onToggleComplete={() => toggleStepComplete(13)}
                    onStepReset={() => resetStepComplete(13)}
                    isSkipped={skippedSteps.has(13)}
                    onToggleSkip={() => toggleStepSkip(13)}
                    onNavigateNext={() => navigateToNextStep(13)}
                    sectionTag="silver_layer_sdp"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={13}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[13]}
                    previousOutputs={stepPrompts[12] ? { synthetic_data: stepPrompts[12] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(13)}
                    isExpanded={expandedStep === 13}
                    onToggleExpand={() => toggleExpand(13)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 14: Gold Pipeline (Chapter 3) - depends on step 11 (Gold Design)
            case 14: {
              return (
                <div key={14} className="relative mt-5" data-step-number="14">
                  <StepBadge number={14} />
                  <WorkflowStep
                    icon={<Merge className="w-5 h-5" />}
                    title="Gold Layer Pipelines"
                    description="Build Gold layer tables from YAML schemas with PK/FK constraints and merge from Silver"
                    color="amber"

                    isComplete={completedSteps.has(14)}
                    onToggleComplete={() => toggleStepComplete(14)}
                    onStepReset={() => resetStepComplete(14)}
                    isSkipped={skippedSteps.has(14)}
                    onToggleSkip={() => toggleStepSkip(14)}
                    onNavigateNext={() => navigateToNextStep(14)}
                    sectionTag="gold_layer_pipeline"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={14}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[14]}
                    previousOutputs={stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(14)}
                    isExpanded={expandedStep === 14}
                    onToggleExpand={() => toggleExpand(14)}
                    sessionId={sessionId}
                  />
                </div>
              );
            }
            // Step 22: Analyze Silver Metadata (Genie Accelerator only) -- tabbed: Point to Silver / Upload CSV / Design from PRD
            case 22: {
              const showUploadTab22 = !disabledSectionTags.has('genie_silver_metadata_upload');
              const showGenerateTab22 = !disabledSectionTags.has('genie_silver_metadata_generate');
              const step22Done = completedSteps.has(22);
              const step22Skipped = skippedSteps.has(22);
              const silverTabLocked = step22Done && step22Mode !== 'silver';
              const uploadTabLocked22 = step22Done && step22Mode !== 'upload';
              const generateTabLocked22 = step22Done && step22Mode !== 'generate';
              return (
                <div key={22} className="relative mt-5" data-step-number="22">
                  <StepBadge number={22} />
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    {/* Shared header */}
                    <div
                      className="flex items-center gap-3 p-5 cursor-pointer group"
                      onClick={() => toggleExpand(22)}
                    >
                      <div className="bg-amber-500/20 p-2.5 rounded-md text-amber-300">
                        <Search className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-ui-lg font-semibold text-foreground leading-tight ${step22Done ? 'line-through opacity-50' : ''}`}>
                            Analyze Silver Metadata
                          </h3>
                          {step22Done && (
                            <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Done</span>
                          )}
                        </div>
                        <p className={`text-ui-base text-muted-foreground mt-1 leading-relaxed ${step22Done ? 'line-through opacity-50' : ''}`}>
                          Extract and analyze table/column metadata from your silver layer schema
                        </p>
                      </div>
                      <div className={`p-1 rounded transition-colors ${expandedStep === 22 ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {expandedStep === 22 ? <ArrowDown className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                      </div>
                    </div>

                    <div className={`border-t border-border ${expandedStep === 22 ? '' : 'hidden'}`}>
                        {/* Mode tabs */}
                        {(showUploadTab22 || showGenerateTab22) && (
                          <div className="flex border-b border-border">
                            <button
                              onClick={() => !silverTabLocked && setStep22Mode('silver')}
                              disabled={silverTabLocked}
                              className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                step22Mode === 'silver'
                                  ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                  : silverTabLocked
                                    ? 'text-muted-foreground/40 cursor-not-allowed'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                              }`}
                            >
                              <Database className="w-4 h-4" />
                              Point to Silver
                              {silverTabLocked && <Lock className="w-3 h-3 ml-1" />}
                            </button>
                            {showUploadTab22 && (
                              <button
                                onClick={() => !uploadTabLocked22 && setStep22Mode('upload')}
                                disabled={uploadTabLocked22}
                                className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                  step22Mode === 'upload'
                                    ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                    : uploadTabLocked22
                                      ? 'text-muted-foreground/40 cursor-not-allowed'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                                }`}
                              >
                                <Upload className="w-4 h-4" />
                                Upload CSV
                                {uploadTabLocked22 && <Lock className="w-3 h-3 ml-1" />}
                              </button>
                            )}
                            {showGenerateTab22 && (
                              <button
                                onClick={() => !generateTabLocked22 && setStep22Mode('generate')}
                                disabled={generateTabLocked22}
                                className={`flex-1 px-4 py-3 text-ui-base font-medium transition-all relative flex items-center justify-center gap-2 ${
                                  step22Mode === 'generate'
                                    ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                                    : generateTabLocked22
                                      ? 'text-muted-foreground/40 cursor-not-allowed'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                                }`}
                              >
                                <Sparkles className="w-4 h-4" />
                                Design from PRD
                                {generateTabLocked22 && <Lock className="w-3 h-3 ml-1" />}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tab content */}
                        <div className="p-0">
                          {step22Mode === 'silver' && (
                            <WorkflowStep
                              icon={<Search className="w-5 h-5" />}
                              title="Point to Silver"
                              description="Extract table/column metadata from your silver layer catalog"
                              color="amber"
                              isComplete={step22Done}
                              onToggleComplete={() => toggleStepComplete(22)}
                              onStepReset={() => { resetStepComplete(22); setStep22OutputMode(null); }}
                              isSkipped={step22Skipped}
                              onToggleSkip={() => toggleStepSkip(22)}
                              onNavigateNext={() => navigateToNextStep(22)}
                              sectionTag="genie_silver_metadata"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={22}
                              onPromptGenerated={handleStep22SilverGenerated}
                              initialPrompt={step22OutputMode === 'silver' ? stepPrompts[22] : undefined}
                              isPreviousStepComplete={isPreviousStepComplete(22)}
                              sessionId={sessionId}
                              customHeaderContent={
                                <div onClick={(e) => e.stopPropagation()}>
                                  <LakehouseParamsEditor
                                    label="Silver Layer:"
                                    sessionId={sessionId}
                                    isExpanded={true}
                                    refreshKey={lakehouseParamsRefreshKey}
                                  />
                                </div>
                              }
                            />
                          )}
                          {step22Mode === 'upload' && (
                            <div className="p-5">
                              <CsvUploadPanel
                                sessionId={sessionId}
                                industry={selectedIndustry}
                                useCase={selectedUseCase}
                                stepNumber={22}
                                onPromptGenerated={handleStep22UploadGenerated}
                                isPreviousStepComplete={isPreviousStepComplete(22)}
                                initialPrompt={step22OutputMode === 'upload' ? stepPrompts[22] : undefined}
                                isComplete={step22Done}
                                onToggleComplete={() => toggleStepComplete(22)}
                                isSkipped={step22Skipped}
                                onToggleSkip={() => toggleStepSkip(22)}
                                onNavigateNext={() => navigateToNextStep(22)}
                                sectionTag="genie_silver_metadata_upload"
                              />
                            </div>
                          )}
                          {step22Mode === 'generate' && (
                            <WorkflowStep
                              icon={<Sparkles className="w-5 h-5" />}
                              title="Design from PRD"
                              description="Design a silver layer schema from your PRD — for when you don't have existing Silver tables or a CSV"
                              color="amber"
                              isComplete={step22Done}
                              onToggleComplete={() => toggleStepComplete(22)}
                              onStepReset={() => { resetStepComplete(22); setStep22OutputMode(null); }}
                              isSkipped={step22Skipped}
                              onToggleSkip={() => toggleStepSkip(22)}
                              onNavigateNext={() => navigateToNextStep(22)}
                              sectionTag="genie_silver_metadata_generate"
                              industry={selectedIndustry}
                              useCase={selectedUseCase}
                              embedded={true}
                              stepNumber={22}
                              onPromptGenerated={handleStep22GenerateGenerated}
                              initialPrompt={step22OutputMode === 'generate' ? stepPrompts[22] : undefined}
                              isPreviousStepComplete={isPreviousStepComplete(22)}
                              sessionId={sessionId}
                            />
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              );
            }
            // Step 23: Deploy Lakehouse Assets (Chapter 3)
            case 23:
              return (
                <div key={23} className="relative mt-5" data-step-number="23">
                  <StepBadge number={23} />
                  <WorkflowStep
                    icon={<Rocket className="w-5 h-5" />}
                    title="Deploy Assets"
                    description="Validate, deploy, and run Bronze, Silver, and Gold layer jobs in dependency order using Asset Bundles"
                    color="emerald"

                    isComplete={completedSteps.has(23)}
                    onToggleComplete={() => toggleStepComplete(23)}
                    onStepReset={() => resetStepComplete(23)}
                    isSkipped={skippedSteps.has(23)}
                    onToggleSkip={() => toggleStepSkip(23)}
                    onNavigateNext={() => navigateToNextStep(23)}
                    sectionTag="deploy_lakehouse_assets"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={23}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[23]}
                    isPreviousStepComplete={isPreviousStepComplete(23)}
                    isExpanded={expandedStep === 23}
                    onToggleExpand={() => toggleExpand(23)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 15: Use-Case Plan (Chapter 4)
            case 15:
              return (
                <div key={15} className="relative mt-5" data-step-number="15">
                  <StepBadge number={15} />
                  <WorkflowStep
                    icon={<BarChart3 className="w-5 h-5" />}
                    title="Create Use-Case Plan"
                    description="Generate operationalization plans for your use cases with YAML manifests and supporting artifacts"
                    color="violet"

                    isComplete={completedSteps.has(15)}
                    onToggleComplete={() => toggleStepComplete(15)}
                    onStepReset={() => resetStepComplete(15)}
                    isSkipped={skippedSteps.has(15)}
                    onToggleSkip={() => toggleStepSkip(15)}
                    onNavigateNext={() => navigateToNextStep(15)}
                    sectionTag="usecase_plan"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={15}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[15]}
                    previousOutputs={{
                      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
                      ...(stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : {})
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(15)}
                    isExpanded={expandedStep === 15}
                    onToggleExpand={() => toggleExpand(15)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 16: Build AI/BI Dashboard (Chapter 4)
            case 16:
              return (
                <div key={16} className="relative mt-5" data-step-number="16">
                  <StepBadge number={16} />
                  <WorkflowStep
                    icon={<LayoutDashboard className="w-5 h-5" />}
                    title="Build AI/BI Dashboard"
                    description="Create an AI/BI Lakeview dashboard with KPIs, charts, and filters from Gold layer data"
                    color="emerald"

                    isComplete={completedSteps.has(16)}
                    onToggleComplete={() => toggleStepComplete(16)}
                    onStepReset={() => resetStepComplete(16)}
                    isSkipped={skippedSteps.has(16)}
                    onToggleSkip={() => toggleStepSkip(16)}
                    onNavigateNext={() => navigateToNextStep(16)}
                    sectionTag="aibi_dashboard"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={16}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[16]}
                    previousOutputs={{
                      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
                      ...(stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : {})
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(16)}
                    isExpanded={expandedStep === 16}
                    onToggleExpand={() => toggleExpand(16)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 17: Build Genie Space (Chapter 4)
            case 17:
              return (
                <div key={17} className="relative mt-5" data-step-number="17">
                  <StepBadge number={17} />
                  <WorkflowStep
                    icon={<MessageSquareText className="w-5 h-5" />}
                    title="Build Genie Space [Metric View/TVF]"
                    description="Build semantic layer with TVFs, Metric Views, and Genie Space for natural language analytics"
                    color="cyan"

                    isComplete={completedSteps.has(17)}
                    onToggleComplete={() => toggleStepComplete(17)}
                    onStepReset={() => resetStepComplete(17)}
                    isSkipped={skippedSteps.has(17)}
                    onToggleSkip={() => toggleStepSkip(17)}
                    onNavigateNext={() => navigateToNextStep(17)}
                    sectionTag="genie_space"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={17}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[17]}
                    previousOutputs={stepPrompts[15] ? { usecase_plan: stepPrompts[15] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(17)}
                    isExpanded={expandedStep === 17}
                    onToggleExpand={() => toggleExpand(17)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 24: Deploy AI and Agents Assets (Chapter 4)
            case 24:
              return (
                <div key={24} className="relative mt-5" data-step-number="24">
                  <StepBadge number={24} />
                  <WorkflowStep
                    icon={<Rocket className="w-5 h-5" />}
                    title="Deploy Assets"
                    description="Deploy TVFs, Metric Views, Genie Spaces, and AI/BI Dashboards in dependency order"
                    color="violet"

                    isComplete={completedSteps.has(24)}
                    onToggleComplete={() => toggleStepComplete(24)}
                    onStepReset={() => resetStepComplete(24)}
                    isSkipped={skippedSteps.has(24)}
                    onToggleSkip={() => toggleStepSkip(24)}
                    onNavigateNext={() => navigateToNextStep(24)}
                    sectionTag="deploy_di_assets"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={24}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[24]}
                    isPreviousStepComplete={isPreviousStepComplete(24)}
                    isExpanded={expandedStep === 24}
                    onToggleExpand={() => toggleExpand(24)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 25: Optimize Genie (Chapter 4)
            case 25:
              return (
                <div key={25} className="relative mt-5" data-step-number="25">
                  <StepBadge number={25} />
                  <WorkflowStep
                    icon={<Sparkles className="w-5 h-5" />}
                    title="Optimize Genie"
                    description="Systematically optimize Genie Space accuracy using benchmark evaluation and 6 control levers"
                    color="amber"

                    isComplete={completedSteps.has(25)}
                    onToggleComplete={() => toggleStepComplete(25)}
                    onStepReset={() => resetStepComplete(25)}
                    isSkipped={skippedSteps.has(25)}
                    onToggleSkip={() => toggleStepSkip(25)}
                    onNavigateNext={() => navigateToNextStep(25)}
                    sectionTag="optimize_genie"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={25}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[25]}
                    isPreviousStepComplete={isPreviousStepComplete(25)}
                    isExpanded={expandedStep === 25}
                    onToggleExpand={() => toggleExpand(25)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 18: Build Agent (Chapter 4)
            case 18:
              return (
                <div key={18} className="relative mt-5" data-step-number="18">
                  <StepBadge number={18} highlight={true} />
                  <WorkflowStep
                    icon={<Bot className="w-5 h-5" />}
                    title="Build Agent"
                    description="Build a multi-agent orchestrator with Genie integration, LLM rewrite, and web search fallback"
                    color="blue"

                    isComplete={completedSteps.has(18)}
                    onToggleComplete={() => toggleStepComplete(18)}
                    onStepReset={() => resetStepComplete(18)}
                    isSkipped={skippedSteps.has(18)}
                    onToggleSkip={() => toggleStepSkip(18)}
                    onNavigateNext={() => navigateToNextStep(18)}
                    sectionTag="agent_framework"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={18}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[18]}
                    previousOutputs={{
                      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
                      ...(stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : {})
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(18)}
                    isExpanded={expandedStep === 18}
                    onToggleExpand={() => toggleExpand(18)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 19: Wire UI to Agent (Chapter 4)
            case 19:
              return (
                <div key={19} className="relative mt-5" data-step-number="19">
                  <StepBadge number={19} />
                  <WorkflowStep
                    icon={<Plug className="w-5 h-5" />}
                    title="Wire UI to Agent"
                    description="Connect your frontend UI to the Agent serving endpoint for end-to-end natural language search"
                    color="teal"

                    isComplete={completedSteps.has(19)}
                    onToggleComplete={() => toggleStepComplete(19)}
                    onStepReset={() => resetStepComplete(19)}
                    isSkipped={skippedSteps.has(19)}
                    onToggleSkip={() => toggleStepSkip(19)}
                    onNavigateNext={() => navigateToNextStep(19)}
                    sectionTag="wire_ui_agent"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={19}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[19]}
                    previousOutputs={stepPrompts[18] ? { agent_framework: stepPrompts[18] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(19)}
                    isExpanded={expandedStep === 19}
                    onToggleExpand={() => toggleExpand(19)}
                    sessionId={sessionId}
                  />
                </div>
              );
            // Step 20: Iterate & Enhance (Refinement)
            case 20:
              return (
                <div key={20} className="relative mt-5" data-step-number="20">
                  <StepBadge number={20} />
                  <WorkflowStep
                    icon={<Rocket className="w-5 h-5" />}
                    title="Iterate & Enhance App"
                    description="Iterate on the application to add new features, update functionality, and improve user experience"
                    color="pink"

                    isComplete={completedSteps.has(20)}
                    onToggleComplete={() => toggleStepComplete(20)}
                    onStepReset={() => resetStepComplete(20)}
                    sectionTag="iterate_enhance"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={20}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[20]}
                    isPreviousStepComplete={isPreviousStepComplete(20)}
                    isExpanded={expandedStep === 20}
                    onToggleExpand={() => toggleExpand(20)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 26: Explore Existing Skills (Agent Skills Accelerator)
            case 26:
              return (
                <div key={26} className="relative mt-5" data-step-number="26">
                  <WorkflowStep
                    stepNumber={26}
                    title="Explore Existing Skills"
                    description="Explore existing skills in your template repo and identify the gap your new skill will fill"
                    icon={<BookOpen className="w-5 h-5" />}
                    color="violet"
                    isComplete={completedSteps.has(26)}
                    isSkipped={skippedSteps.has(26)}
                    onToggleComplete={() => toggleStepComplete(26)}
                    onToggleSkip={() => toggleStepSkip(26)}
                    onNavigateNext={() => navigateToNextStep(26)}
                    sectionTag="skill_install_explore"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[26]}
                    previousOutputs={{ gold_table_target: `Catalog: ${goldTableTarget.catalog}, Schema: ${goldTableTarget.schema}${goldTableTarget.prefix ? `, Table Prefix: ${goldTableTarget.prefix}` : ''}` }}
                    isPreviousStepComplete={isPreviousStepComplete(26)}
                    isExpanded={expandedStep === 26}
                    onToggleExpand={() => toggleExpand(26)}
                    sessionId={sessionId}
                    customHeaderContent={
                      <div onClick={(e) => e.stopPropagation()}>
                        <GoldTableTargetEditor
                          value={goldTableTarget}
                          onChange={(v) => {
                            goldTargetManuallyEdited.current = true;
                            setGoldTableTarget(v);
                          }}
                          defaultValues={{
                            catalog: defaultCatalog,
                            schema: (currentUser && (customUseCaseLabel || selectedUseCaseLabel))
                              ? deriveSchemaName(currentUser, customUseCaseLabel || selectedUseCaseLabel, 'gold')
                              : '',
                          }}
                        />
                      </div>
                    }
                  />
                </div>
              );

            // Step 27: Define Skill Strategy (Agent Skills Accelerator)
            case 27:
              return (
                <div key={27} className="relative mt-5" data-step-number="27">
                  <WorkflowStep
                    stepNumber={27}
                    title="Define Skill Strategy"
                    description="Generate a comprehensive strategy for your Agent Skill based on your use case specification"
                    icon={<FileText className="w-5 h-5" />}
                    color="indigo"
                    isComplete={completedSteps.has(27)}
                    isSkipped={skippedSteps.has(27)}
                    onToggleComplete={() => toggleStepComplete(27)}
                    onToggleSkip={() => toggleStepSkip(27)}
                    onNavigateNext={() => navigateToNextStep(27)}
                    sectionTag="skill_define_strategy"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[27]}
                    previousOutputs={{
                      gold_table_target: `Catalog: ${goldTableTarget.catalog}, Schema: ${goldTableTarget.schema}${goldTableTarget.prefix ? `, Table Prefix: ${goldTableTarget.prefix}` : ''}`,
                      ...(stepPrompts[26] ? { exploration_findings: stepPrompts[26] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(27)}
                    isExpanded={expandedStep === 27}
                    onToggleExpand={() => toggleExpand(27)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 28: Create SKILL.md (Agent Skills Accelerator)
            case 28:
              return (
                <div key={28} className="relative mt-5" data-step-number="28">
                  <WorkflowStep
                    stepNumber={28}
                    title="Create SKILL.md"
                    description="Generate the complete SKILL.md package with references and assets based on your skill strategy"
                    icon={<FileCode className="w-5 h-5" />}
                    color="purple"
                    isComplete={completedSteps.has(28)}
                    isSkipped={skippedSteps.has(28)}
                    onToggleComplete={() => toggleStepComplete(28)}
                    onToggleSkip={() => toggleStepSkip(28)}
                    onNavigateNext={() => navigateToNextStep(28)}
                    sectionTag="skill_create_skillmd"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[28]}
                    previousOutputs={{
                      gold_table_target: `Catalog: ${goldTableTarget.catalog}, Schema: ${goldTableTarget.schema}${goldTableTarget.prefix ? `, Table Prefix: ${goldTableTarget.prefix}` : ''}`,
                      ...(stepPrompts[27] ? { skill_strategy: stepPrompts[27] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(28)}
                    isExpanded={expandedStep === 28}
                    onToggleExpand={() => toggleExpand(28)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 29: Apply & Test Skill (Agent Skills Accelerator)
            case 29:
              return (
                <div key={29} className="relative mt-5" data-step-number="29">
                  <WorkflowStep
                    stepNumber={29}
                    title="Apply & Test Skill"
                    description="Save your generated skill to the project and test it against your target assets"
                    icon={<Tag className="w-5 h-5" />}
                    color="teal"
                    isComplete={completedSteps.has(29)}
                    isSkipped={skippedSteps.has(29)}
                    onToggleComplete={() => toggleStepComplete(29)}
                    onToggleSkip={() => toggleStepSkip(29)}
                    onNavigateNext={() => navigateToNextStep(29)}
                    sectionTag="skill_apply_contracts"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[29]}
                    previousOutputs={{
                      gold_table_target: `Catalog: ${goldTableTarget.catalog}, Schema: ${goldTableTarget.schema}${goldTableTarget.prefix ? `, Table Prefix: ${goldTableTarget.prefix}` : ''}`,
                      ...(stepPrompts[28] ? { skill_definition: stepPrompts[28] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(29)}
                    isExpanded={expandedStep === 29}
                    onToggleExpand={() => toggleExpand(29)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 30: Validate & Automate (Agent Skills Accelerator)
            case 30:
              return (
                <div key={30} className="relative mt-5" data-step-number="30">
                  <WorkflowStep
                    stepNumber={30}
                    title="Validate & Automate"
                    description="Build a validation notebook and scheduled job to automate compliance checking for your skill"
                    icon={<ShieldCheck className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(30)}
                    isSkipped={skippedSteps.has(30)}
                    onToggleComplete={() => toggleStepComplete(30)}
                    onToggleSkip={() => toggleStepSkip(30)}
                    onNavigateNext={() => navigateToNextStep(30)}
                    sectionTag="skill_certify_tables"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[30]}
                    previousOutputs={{
                      gold_table_target: `Catalog: ${goldTableTarget.catalog}, Schema: ${goldTableTarget.schema}${goldTableTarget.prefix ? `, Table Prefix: ${goldTableTarget.prefix}` : ''}`,
                      ...(stepPrompts[29] ? { applied_skill: stepPrompts[29] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(30)}
                    isExpanded={expandedStep === 30}
                    onToggleExpand={() => toggleExpand(30)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // ----------------------------------------------------------------
            // Agents Accelerator — Agents on Apps (Steps 38–45)
            // Section titles match the tracks/A-custom-agent-apps/ folder labels
            // ----------------------------------------------------------------

            // Step 38: 01 - Clone and Run
            case 38:
              return (
                <div key={38} className="relative mt-5" data-step-number="38">
                  <WorkflowStep
                    stepNumber={38}
                    title="01 - Clone and Run"
                    description="Clone the custom-agent-apps template, install dependencies, and run the starter agent locally inside your Databricks App"
                    icon={<GitBranch className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(38)}
                    isSkipped={skippedSteps.has(38)}
                    onToggleComplete={() => toggleStepComplete(38)}
                    onToggleSkip={() => toggleStepSkip(38)}
                    onNavigateNext={() => navigateToNextStep(38)}
                    sectionTag="agents_clone_and_run"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[38]}
                    isPreviousStepComplete={isPreviousStepComplete(38)}
                    isExpanded={expandedStep === 38}
                    onToggleExpand={() => toggleExpand(38)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 39: 02 - Agent Framework
            case 39:
              return (
                <div key={39} className="relative mt-5" data-step-number="39">
                  <WorkflowStep
                    stepNumber={39}
                    title="02 - Agent Framework"
                    description="Build an agent module using the Mosaic AI Agent Framework with the ResponsesAgent interface (auto MLflow signature inference, native Playground/Eval/Apps integration)"
                    icon={<Bot className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(39)}
                    isSkipped={skippedSteps.has(39)}
                    onToggleComplete={() => toggleStepComplete(39)}
                    onToggleSkip={() => toggleStepSkip(39)}
                    onNavigateNext={() => navigateToNextStep(39)}
                    sectionTag="agents_agent_framework"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[39]}
                    previousOutputs={stepPrompts[38] ? { clone_and_run: stepPrompts[38] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(39)}
                    isExpanded={expandedStep === 39}
                    onToggleExpand={() => toggleExpand(39)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 40: 03 - Tools and MCP
            case 40:
              return (
                <div key={40} className="relative mt-5" data-step-number="40">
                  <WorkflowStep
                    stepNumber={40}
                    title="03 - Tools and MCP"
                    description="Register tools via Managed (UC Functions, Vector Search, Genie, Databricks SQL), External, and Custom MCP servers"
                    icon={<Plug className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(40)}
                    isSkipped={skippedSteps.has(40)}
                    onToggleComplete={() => toggleStepComplete(40)}
                    onToggleSkip={() => toggleStepSkip(40)}
                    onNavigateNext={() => navigateToNextStep(40)}
                    sectionTag="agents_tools_and_mcp"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[40]}
                    previousOutputs={stepPrompts[39] ? { agent_framework: stepPrompts[39] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(40)}
                    isExpanded={expandedStep === 40}
                    onToggleExpand={() => toggleExpand(40)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 41: 04 - Authentication
            case 41:
              return (
                <div key={41} className="relative mt-5" data-step-number="41">
                  <WorkflowStep
                    stepNumber={41}
                    title="04 - Authentication"
                    description="Wire on-behalf-of-user auth via Databricks Apps user-token forwarding (X-Forwarded-Access-Token header) so tool calls run with the caller's permissions"
                    icon={<Shield className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(41)}
                    isSkipped={skippedSteps.has(41)}
                    onToggleComplete={() => toggleStepComplete(41)}
                    onToggleSkip={() => toggleStepSkip(41)}
                    onNavigateNext={() => navigateToNextStep(41)}
                    sectionTag="agents_authentication"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[41]}
                    previousOutputs={stepPrompts[40] ? { tools_and_mcp: stepPrompts[40] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(41)}
                    isExpanded={expandedStep === 41}
                    onToggleExpand={() => toggleExpand(41)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 42: 05 - Lakebase Memory
            case 42:
              return (
                <div key={42} className="relative mt-5" data-step-number="42">
                  <WorkflowStep
                    stepNumber={42}
                    title="05 - Lakebase Memory"
                    description="Add short-term memory via a LangGraph checkpointer keyed by thread_id and long-term memory via Vector Search–extracted insights — both backed by Lakebase Postgres"
                    icon={<Brain className="w-5 h-5" />}
                    color="violet"
                    isComplete={completedSteps.has(42)}
                    isSkipped={skippedSteps.has(42)}
                    onToggleComplete={() => toggleStepComplete(42)}
                    onToggleSkip={() => toggleStepSkip(42)}
                    onNavigateNext={() => navigateToNextStep(42)}
                    sectionTag="agents_lakebase_memory"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[42]}
                    previousOutputs={stepPrompts[41] ? { authentication: stepPrompts[41] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(42)}
                    isExpanded={expandedStep === 42}
                    onToggleExpand={() => toggleExpand(42)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 43: 06 - Evaluation
            case 43:
              return (
                <div key={43} className="relative mt-5" data-step-number="43">
                  <WorkflowStep
                    stepNumber={43}
                    title="06 - Evaluation"
                    description="Build an offline evaluation harness using mlflow.genai.evaluate against an initial dataset (foreshadows the MLflow for Gen-AI section)"
                    icon={<FlaskConical className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(43)}
                    isSkipped={skippedSteps.has(43)}
                    onToggleComplete={() => toggleStepComplete(43)}
                    onToggleSkip={() => toggleStepSkip(43)}
                    onNavigateNext={() => navigateToNextStep(43)}
                    sectionTag="agents_evaluation"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[43]}
                    previousOutputs={stepPrompts[42] ? { lakebase_memory: stepPrompts[42] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(43)}
                    isExpanded={expandedStep === 43}
                    onToggleExpand={() => toggleExpand(43)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 44: 07 - Deploy and Query
            case 44:
              return (
                <div key={44} className="relative mt-5" data-step-number="44">
                  <WorkflowStep
                    stepNumber={44}
                    title="07 - Deploy and Query"
                    description="Log the agent as an MLflow model, register it to Unity Catalog, deploy via agents.deploy, and query the serving endpoint"
                    icon={<Rocket className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(44)}
                    isSkipped={skippedSteps.has(44)}
                    onToggleComplete={() => toggleStepComplete(44)}
                    onToggleSkip={() => toggleStepSkip(44)}
                    onNavigateNext={() => navigateToNextStep(44)}
                    sectionTag="agents_deploy_and_query"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[44]}
                    previousOutputs={stepPrompts[43] ? { evaluation: stepPrompts[43] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(44)}
                    isExpanded={expandedStep === 44}
                    onToggleExpand={() => toggleExpand(44)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 45: 08 - Debugging
            case 45:
              return (
                <div key={45} className="relative mt-5" data-step-number="45">
                  <WorkflowStep
                    stepNumber={45}
                    title="08 - Debugging"
                    description="Use MLflow Traces, the Tracing UI, and the Review App to debug the agent's tool calls and prompts"
                    icon={<Search className="w-5 h-5" />}
                    color="blue"
                    isComplete={completedSteps.has(45)}
                    isSkipped={skippedSteps.has(45)}
                    onToggleComplete={() => toggleStepComplete(45)}
                    onToggleSkip={() => toggleStepSkip(45)}
                    onNavigateNext={() => navigateToNextStep(45)}
                    sectionTag="agents_debugging"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[45]}
                    previousOutputs={stepPrompts[44] ? { deploy_and_query: stepPrompts[44] } : undefined}
                    isPreviousStepComplete={isPreviousStepComplete(45)}
                    isExpanded={expandedStep === 45}
                    onToggleExpand={() => toggleExpand(45)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 21: Redeploy & Test (Refinement)
            case 21:
              return (
                <div key={21} className="relative mt-5" data-step-number="21">
                  <StepBadge number={21} highlight={true} />
                  <WorkflowStep
                    icon={<RefreshCw className="w-5 h-5" />}
                    title="Redeploy & Test Application"
                    description="Build, deploy, and test with self-healing operations, then document the full repository"
                    color="red"

                    isComplete={completedSteps.has(21)}
                    onToggleComplete={() => toggleStepComplete(21)}
                    onStepReset={() => resetStepComplete(21)}
                    sectionTag="redeploy_test"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    stepNumber={21}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[21]}
                    isPreviousStepComplete={isPreviousStepComplete(21)}
                    isExpanded={expandedStep === 21}
                    onToggleExpand={() => toggleExpand(21)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 31: Workspace Clean Up (Clean Up section)
            case 31:
              return (
                <div key={31} className="relative mt-5" data-step-number="31">
                  <WorkflowStep
                    stepNumber={31}
                    title="Workspace Clean Up"
                    description="Safely delete all Databricks resources created during the workshop"
                    icon={<Trash2 className="w-5 h-5" />}
                    color="red"
                    isComplete={completedSteps.has(31)}
                    onToggleComplete={() => toggleStepComplete(31)}
                    onStepReset={() => resetStepComplete(31)}
                    sectionTag="workspace_cleanup"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[31]}
                    isPreviousStepComplete={isPreviousStepComplete(31)}
                    isExpanded={expandedStep === 31}
                    onToggleExpand={() => toggleExpand(31)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 32: Plan Synced Tables (Activation / Reverse ETL)
            case 32:
              return (
                <div key={32} className="relative mt-5" data-step-number="32">
                  <WorkflowStep
                    stepNumber={32}
                    title="Plan Synced Tables"
                    description="Design which Gold assets to sync into Lakebase via Synced Tables, including keys, modes, and types"
                    icon={<Table2 className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(32)}
                    isSkipped={skippedSteps.has(32)}
                    onToggleComplete={() => toggleStepComplete(32)}
                    onToggleSkip={() => toggleStepSkip(32)}
                    onNavigateNext={() => navigateToNextStep(32)}
                    sectionTag="activation_table_design"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[32]}
                    previousOutputs={{
                      ...(stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : {}),
                      ...(stepPrompts[15] ? { usecase_plan: stepPrompts[15] } : {}),
                      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(32)}
                    isExpanded={expandedStep === 32}
                    onToggleExpand={() => toggleExpand(32)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 33: Create Synced Tables (Activation / Reverse ETL)
            case 33:
              return (
                <div key={33} className="relative mt-5" data-step-number="33">
                  <WorkflowStep
                    stepNumber={33}
                    title="Create Synced Tables"
                    description="Create Synced Tables from Gold layer into Lakebase using the Databricks REST API"
                    icon={<RefreshCw className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(33)}
                    isSkipped={skippedSteps.has(33)}
                    onToggleComplete={() => toggleStepComplete(33)}
                    onToggleSkip={() => toggleStepSkip(33)}
                    onNavigateNext={() => navigateToNextStep(33)}
                    sectionTag="activation_reverse_sync"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[33]}
                    previousOutputs={undefined}
                    isPreviousStepComplete={isPreviousStepComplete(33)}
                    isExpanded={expandedStep === 33}
                    onToggleExpand={() => toggleExpand(33)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 34: Design Analytics App (Activation / Reverse ETL)
            case 34:
              return (
                <div key={34} className="relative mt-5" data-step-number="34">
                  <WorkflowStep
                    stepNumber={34}
                    title="Design Analytics App"
                    description="Design analytics dashboards and exploration UI on top of synced Lakebase data"
                    icon={<Palette className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(34)}
                    isSkipped={skippedSteps.has(34)}
                    onToggleComplete={() => toggleStepComplete(34)}
                    onToggleSkip={() => toggleStepSkip(34)}
                    onNavigateNext={() => navigateToNextStep(34)}
                    sectionTag="activation_app_design"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[34]}
                    previousOutputs={{
                      ...(stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : {}),
                      ...(stepPrompts[3] ? { prd_document: stepPrompts[3] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(34)}
                    isExpanded={expandedStep === 34}
                    onToggleExpand={() => toggleExpand(34)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 35: Build & Wire App (Activation / Reverse ETL)
            case 35:
              return (
                <div key={35} className="relative mt-5" data-step-number="35">
                  <WorkflowStep
                    stepNumber={35}
                    title="Build Analytics App"
                    description="Build FastAPI + React analytics app with placeholder data and ConnectionStatus indicator"
                    icon={<Plug className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(35)}
                    isSkipped={skippedSteps.has(35)}
                    onToggleComplete={() => toggleStepComplete(35)}
                    onToggleSkip={() => toggleStepSkip(35)}
                    onNavigateNext={() => navigateToNextStep(35)}
                    sectionTag="activation_build_wire"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[35]}
                    previousOutputs={{
                      ...(stepPrompts[34] ? { activation_app_design: stepPrompts[34] } : {}),
                    }}
                    isPreviousStepComplete={isPreviousStepComplete(35)}
                    isExpanded={expandedStep === 35}
                    onToggleExpand={() => toggleExpand(35)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 36: Wire to Lakebase (Activation / Reverse ETL)
            case 36:
              return (
                <div key={36} className="relative mt-5" data-step-number="36">
                  <WorkflowStep
                    stepNumber={36}
                    title="Wire to Lakebase"
                    description="Replace placeholder API data with real PostgreSQL queries against synced Lakebase tables"
                    icon={<Link2 className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(36)}
                    isSkipped={skippedSteps.has(36)}
                    onToggleComplete={() => toggleStepComplete(36)}
                    onToggleSkip={() => toggleStepSkip(36)}
                    onNavigateNext={() => navigateToNextStep(36)}
                    sectionTag="activation_wire_lakebase"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[36]}
                    previousOutputs={undefined}
                    isPreviousStepComplete={isPreviousStepComplete(36)}
                    isExpanded={expandedStep === 36}
                    onToggleExpand={() => toggleExpand(36)}
                    sessionId={sessionId}
                  />
                </div>
              );

            // Step 37: Deploy & Validate (Activation / Reverse ETL)
            case 37:
              return (
                <div key={37} className="relative mt-5" data-step-number="37">
                  <WorkflowStep
                    stepNumber={37}
                    title="Deploy & Validate"
                    description="Deploy analytics app to Databricks Apps and validate the full reverse ETL pipeline"
                    icon={<Rocket className="w-5 h-5" />}
                    color="emerald"
                    isComplete={completedSteps.has(37)}
                    isSkipped={skippedSteps.has(37)}
                    onToggleComplete={() => toggleStepComplete(37)}
                    onToggleSkip={() => toggleStepSkip(37)}
                    onNavigateNext={() => navigateToNextStep(37)}
                    sectionTag="activation_deploy_validate"
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[37]}
                    previousOutputs={undefined}
                    isPreviousStepComplete={isPreviousStepComplete(37)}
                    isExpanded={expandedStep === 37}
                    onToggleExpand={() => toggleExpand(37)}
                    sessionId={sessionId}
                  />
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    );
  };

  // Compute completed step counts for workflow progress badge
  const totalVisibleSteps = useMemo(() => {
    let count = 0;
    for (const section of visibleSections) {
      count += section.steps.length;
    }
    return count;
  }, [visibleSections]);

  const completedVisibleSteps = useMemo(() => {
    let count = 0;
    for (const section of visibleSections) {
      for (const step of section.steps) {
        if (completedSteps.has(step.number)) count++;
      }
    }
    return count;
  }, [visibleSections, completedSteps]);

  return (
    <ReadOnlyProvider value={readOnly}>
    <div className="space-y-5">
      {/* Stage 0: Workshop Introduction */}
      <WorkshopIntro
        key={`intro-${sessionId}`}
        forceCollapsed={wizardStage > 0}
        hasStarted={wizardStage > 0}
        onGetStarted={() => {
          setWelcomeAcknowledged(true);
          setTimeout(() => {
            const el = document.getElementById('coding-assistant-section');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }}
      />

      {/* Stage 1: Choose Your Coding Assistant */}
      <CodingAssistantSelector
        key={`assistant-${sessionId}`}
        selectedAssistant={codingAssistant}
        onSelect={(id) => onCodingAssistantChange?.(id)}
        onConfirm={() => {
          setCodingAssistantConfirmed(true);
          setTimeout(() => {
            const el = document.getElementById('prerequisites-section');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }}
        forceExpanded={wizardStage === 1 && !stageTransitioning}
        forceCollapsed={wizardStage < 1}
        hideConfirm={wizardStage < 1}
        highlightConfirm={!!codingAssistant && wizardStage === 1}
        isLocked={codingAssistantConfirmed || readOnly}
      />

      {/* Stage 2: Prerequisites -- visibility per coding_assistant (admin toggle).
          When hidden, deriveWizardStage() auto-advances past Stage 2 so the
          Define Intent section force-expands and the user is never stranded. */}
      {prerequisitesVisible && (
        <Prerequisites
          key={`prereq-${sessionId}`}
          isComplete={prerequisitesCompleted}
          onMarkComplete={() => {
            onPrerequisitesComplete?.();
            setForcePrereqExpanded(false);
            setTimeout(() => {
              const el = document.getElementById('define-intent-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 400);
          }}
          highlightMarkDone={!prerequisitesCompleted && wizardStage === 2 && !readOnly}
          forceExpanded={forcePrereqExpanded || (wizardStage === 2 && !stageTransitioning)}
          forceCollapsed={wizardStage < 2}
          hideMarkDone={wizardStage < 2 || readOnly}
        />
      )}

      {/* Stage 3: Define Your Intent */}
      <DefineIntentSection
        key={`intent-${sessionId}`}
        selectedIndustry={selectedIndustry}
        selectedUseCase={selectedUseCase}
        selectedIndustryLabel={selectedIndustryLabel}
        selectedUseCaseLabel={selectedUseCaseLabel}
        customUseCaseLabel={customUseCaseLabel}
        customDescription={customDescription}
        initialPrompt={stepPrompts[1]}
        initialBrandUrl={initialBrandUrl}
        isComplete={completedSteps.has(1)}
        isSessionLoaded={isSessionLoaded}
        workshopLevel={workshopLevel}
        dataRefreshKey={effectiveRefreshKey}
        forceCollapsed={wizardStage < 3}
        forceExpanded={wizardStage === 3 && !stageTransitioning}
        onIntentDefined={handlePromptGenerated}
        onBrandUrlChange={onBrandUrlChange}
      />

      {/* Stage 4: Path & Architecture (combined section) */}
      {onWorkshopLevelChange && (
        <PathAndArchitecture
          key={`path-${sessionId}`}
          selectedLevel={workshopLevel}
          onLevelChange={onWorkshopLevelChange}
          completedSteps={completedSteps}
          levelExplicitlySelected={levelExplicitlySelected}
          forceCollapsed={wizardStage < 4 || wizardStage > 4}
          forceExpanded={wizardStage === 4 && !stageTransitioning}
          onContinue={handleStartBuild}
          useCaseLockedLevel={useCaseLockedLevel}
          hasUseCaseSelected={!!selectedUseCase}
          direction={direction}
          directionLocked={directionLocked}
          onDirectionChange={onDirectionChange}
          aiAgentsModules={aiAgentsModules}
          onAIModulesChange={onAIModulesChange}
          medallionLayers={medallionLayers}
          onMedallionLayersChange={onMedallionLayersChange}
        />
      )}

      {/* Stage 5: Main Workflow Area -- collapsible wrapper */}
      <div id="workflow-area" className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Workflow Area Header */}
        <button
          onClick={() => setWorkflowUserOverride(!isWorkflowExpanded)}
          className="group w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
        >
          <div className="p-2 rounded-md bg-primary/20">
            <ArrowDown className={`w-5 h-5 text-primary transition-transform duration-200 ${isWorkflowExpanded ? '' : '-rotate-90'}`} />
          </div>
          <div className="flex-1 text-left">
            <h2 className="text-ui-lg font-semibold text-foreground">
              Workshop Steps
            </h2>
            <p className="text-muted-foreground text-ui-base">
              Follow each step to build your application end-to-end
            </p>
          </div>
          {/* Progress badge */}
          {totalVisibleSteps > 0 && (
            <span className={`text-ui-xs font-medium px-2.5 py-1 rounded-full ${
              completedVisibleSteps === totalVisibleSteps
                ? 'bg-emerald-900/40 text-emerald-300'
                : completedVisibleSteps > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary/60 text-muted-foreground'
            }`}>
              {completedVisibleSteps}/{totalVisibleSteps} done
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isWorkflowExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Collapsible Workflow Content */}
        <div className={`transition-all duration-300 ease-in-out ${
          isWorkflowExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="border-t border-border">
            <div id="workflow-main-area" className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px] p-4">
              {/* Left Sidebar - Sectioned Navigation */}
              <div className="hidden lg:block w-64 flex-shrink-0 h-full overflow-hidden">
                <SectionedWorkflowSidebar 
                  completedSteps={completedSteps}
                  skippedSteps={skippedSteps}
                  expandedStep={expandedStep}
                  expandedSectionId={expandedSectionId}
                  selectedSectionId={selectedSectionId}
                  onSectionClick={handleSectionClick}
                  onSectionToggle={handleSectionToggle}
                  onStepClick={handleSidebarStepClick}
                  visibleSections={visibleSections}
                  sessionId={sessionId}
                  onParametersChanged={() => setParamRefreshKey(k => k + 1)}
                />
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-w-0 h-full">
                {showSectionDetail && selectedSectionId ? (
                  <div className="h-full bg-card rounded-xl border border-border overflow-hidden">
                    <SectionDetailPanel
                      sectionId={selectedSectionId}
                      completedSteps={completedSteps}
                      onStartSection={handleStartSection}
                      onStepClick={handleSidebarStepClick}
                      visibleSections={visibleSections}
                    />
                  </div>
                ) : (
                  <div id="workflow-content" className="h-full overflow-y-auto pr-2 scroll-smooth">
                    {visibleSections.map((section, index) => (
                      <div key={section.id}>
                        <SectionDivider section={section} />
                        {renderSectionSteps(section.id)}
                        {index < visibleSections.length - 1 && (
                          <div className="flex justify-center py-3 my-2">
                            <ArrowDown className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Overlay */}
      {!readOnly && (
        <CelebrationOverlay 
          celebration={celebration} 
          onComplete={handleCelebrationComplete} 
        />
      )}
    </div>
    </ReadOnlyProvider>
  );
}
