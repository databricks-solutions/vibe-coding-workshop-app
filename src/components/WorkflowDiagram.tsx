import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReadOnlyProvider } from '../contexts/ReadOnlyContext';
import { WorkflowStep } from './WorkflowStep';
import { Prerequisites } from './Prerequisites';
import { WorkshopIntro } from './WorkshopIntro';
import { HackathonEntryCard } from './hackathon/HackathonEntryCard';
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
  type MedallionLayer,
  type ChainContext
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
  FileText,
  Table2,
  GitBranch,
  FlaskConical,
  Database,
  Search,
  Sparkles,
  Lock,
  Upload,
  BookOpen
} from 'lucide-react';
import { apiClient } from '../api/client';

import { LakehouseParamsEditor } from './LakehouseParamsEditor';
import { AgentToolInputsEditor } from './AgentToolInputsEditor';
import { CsvUploadPanel } from './CsvUploadPanel';
import { GoldTableTargetEditor, type GoldTableTarget } from './GoldTableTargetEditor';
import { deriveSchemaName } from '../utils/naming';
import { getPreviousOutputsForStep } from '../utils/stepPreviousOutputs';
import type { ColorType } from '../constants/colorClasses';

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
  selectedUseCaseCertified?: boolean;
  customUseCaseLabel?: string;
  customDescription?: string;
  initialBrandUrl?: string;
  workshopLevel?: WorkshopLevel;
  chainContext?: ChainContext;
  onWorkshopLevelChange?: (level: WorkshopLevel) => void;
  levelExplicitlySelected?: boolean;
  disabledSectionTags?: Set<string>;
  /** Workshop levels (LevelSelector buttons) the active coding assistant has
   * disabled. Powers the runtime path-picker grandfather rule: the currently-
   * selected level remains clickable even if it's in this set. */
  disabledWorkshopLevels?: Set<WorkshopLevel>;
  prerequisitesVisible?: boolean;
  onStepPromptGenerated: (stepNumber: number, promptText: string) => void;
  onIndustryChange: (value: string, label: string) => void;
  onUseCaseChange: (value: string, label: string, isCertified?: boolean) => void;
  onCustomUseCaseChange?: (customLabel: string, customDescription: string) => void;
  onBrandUrlChange?: (url: string) => void;
  onCompletedStepsChange: (steps: Set<number>) => void;
  skippedSteps?: Set<number>;
  onSkippedStepsChange?: (steps: Set<number>) => void;
  initialExpandedStep?: number;
  prerequisitesCompleted?: boolean;
  onPrerequisitesComplete?: () => void;
  codingAssistant?: string | null;
  /** True when the assistant reflects an explicit user/session choice (vs a
   *  silent first-load default). Gates the welcome auto-acknowledge and the
   *  selector's "Completed" visual. */
  codingAssistantExplicit?: boolean;
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
  selectedUseCaseCertified,
  customUseCaseLabel = '',
  customDescription = '',
  initialBrandUrl = '',
  workshopLevel = 'end-to-end',
  chainContext = null,
  onWorkshopLevelChange,
  levelExplicitlySelected = false,
  disabledSectionTags = new Set<string>(),
  disabledWorkshopLevels = new Set<WorkshopLevel>(),
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
  codingAssistantExplicit = false,
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
    () => getCumulativeOverrides(workshopLevel, completedSteps, chainContext),
    [workshopLevel, completedSteps, chainContext],
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
    if (isSessionLoaded && (selectedIndustry || selectedUseCase || completedSteps.size > 0 || prerequisitesCompleted || codingAssistantExplicit)) {
      setWelcomeAcknowledged(true);
    }
    if (isSessionLoaded && codingAssistantExplicit && (prerequisitesCompleted || completedSteps.size > 0)) {
      setCodingAssistantConfirmed(true);
    }
    // Only auto-set pathAcknowledged when user has actual workshop progress (step 2+).
    // completedSteps.size === 1 means only Define Intent is done — user still needs to pick a path.
    if (isSessionLoaded && completedSteps.size > 1) {
      setPathAcknowledged(true);
    }
  }, [isSessionLoaded, selectedIndustry, selectedUseCase, completedSteps.size, prerequisitesCompleted, codingAssistantExplicit]);

  const deriveWizardStage = useCallback((): WizardStage => {
    const intentDefined = completedSteps.has(1) || (!!selectedIndustry && !!selectedUseCase);

    // Returning user with workflow progress → jump to Stage 5
    if (completedSteps.size > 1) return 5;
    // Intent defined and path acknowledged → Stage 5 (Workshop)
    if (intentDefined && pathAcknowledged) return 5;
    // Intent defined → Stage 4 (Path & Architecture)
    if (intentDefined) return 4;

    // Walk the wizard forward from Stage 0. Each gate must clear before the
    // next can apply — otherwise switching coding assistants (which refetches
    // prerequisites_visible from the backend) could yank the user past Stage 1
    // the moment they pick an assistant whose prereqs are hidden out-of-the-box
    // (e.g. CoDA). The earlier check ordering let an unconfirmed Stage 1 jump
    // straight to Stage 3 without an explicit Continue click.
    if (!welcomeAcknowledged) return 0;
    if (!codingAssistantConfirmed) return 1;
    // Past Stage 1: auto-skip Stage 2 when prereqs are hidden by admin or
    // already completed — there's nothing for the user to do there.
    if (prerequisitesCompleted || !prerequisitesVisible) return 3;
    return 2;
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

  const handlePromptGenerated = (prompt: string, industry: string, useCase: string, industryLabel?: string, useCaseLabel?: string, customDesc?: string, isCertified?: boolean) => {
    if (readOnly) return;
    onIndustryChange(industry, industryLabel || industry);
    onUseCaseChange(useCase, useCaseLabel || useCase, isCertified);
    
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

  /**
   * Render a uniform workflow step with standard props and previousOutputs from stepPreviousOutputs.ts.
   * Used for ~35+ structurally identical steps that differ only in metadata (title, description, icon, etc.)
   * and chaining rules. This function replaces massive switch case duplication.
   *
   * Explicit cases remain for steps with:
   *  - Complex state machines (tabs, modes) — steps 10, 11, 12, 22
   *  - Custom rendering logic — steps 2 (SetUpProjectStep), 4 (custom header UI)
   *
   * All other steps flow through here, reading metadata from ALL_STEPS and chaining rules
   * from getPreviousOutputsForStep().
   */
  const renderUniformStep = (stepNumber: number): React.ReactNode => {
    const stepMetadata = ALL_STEPS[stepNumber];
    if (!stepMetadata || !stepMetadata.sectionTag) return null;

    // Get previousOutputs from the single source of truth
    const previousOutputsCtx = { goldTableTarget, workshopLevel };
    const previousOutputs = getPreviousOutputsForStep(stepNumber, stepPrompts, previousOutputsCtx);

    // For steps with semi-special needs (customHeaderContent)
    const customHeaderContentMap: Record<number, React.ReactNode> = {
      39: (
        <div onClick={(e) => e.stopPropagation()}>
          <AgentToolInputsEditor
            sessionId={sessionId}
            isExpanded={expandedStep === 39}
          />
        </div>
      ),
    };

    // Extract title, description from ALL_STEPS (single source of truth)
    const title = stepMetadata.title;
    const description = stepMetadata.description;
    // ALL_STEPS already carries the step's icon component, so render it directly.
    // Deriving an icon from the colour class was lossy — colours repeat across steps,
    // which silently gave 30 of 56 steps the wrong icon.
    const IconComponent = stepMetadata.icon;
    const icon = <IconComponent className="w-5 h-5" />;

    // Map tailwind color to ColorType
    const colorMap: Record<string, string> = {
      'text-indigo-400': 'indigo',
      'text-green-400': 'green',
      'text-cyan-400': 'cyan',
      'text-teal-400': 'teal',
      'text-lime-400': 'lime',
      'text-cyan-500': 'cyan',
      'text-amber-400': 'amber',
      'text-yellow-400': 'yellow',
      'text-orange-400': 'orange',
      'text-slate-400': 'slate',
      'text-amber-500': 'amber',
      'text-violet-400': 'violet',
      'text-emerald-400': 'emerald',
      'text-blue-400': 'blue',
      'text-pink-400': 'pink',
      'text-red-400': 'red',
      'text-amber-300': 'amber',
      'text-emerald-500': 'emerald',
      'text-sky-400': 'blue',
      'text-sky-500': 'blue',
      'text-blue-500': 'blue',
      'text-violet-500': 'violet',
      'text-rose-400': 'red',
      'text-primary': 'purple',
    };
    const colorClass = (colorMap[stepMetadata.color] || 'purple') as ColorType;

    // Determine whether this step has onStepReset
    // Early workflow steps (3-9, 13-25, 31) support reset; later steps don't
    const hasResetSupport = [3, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 31].includes(stepNumber);

    return (
      <div key={stepNumber} className="relative mt-5" data-step-number={stepNumber}>
        <StepBadge number={stepNumber} />
        <WorkflowStep
          stepNumber={stepNumber}
          title={title}
          description={description}
          icon={icon}
          color={colorClass}
          isComplete={completedSteps.has(stepNumber)}
          isSkipped={skippedSteps.has(stepNumber)}
          onToggleComplete={() => toggleStepComplete(stepNumber)}
          onToggleSkip={() => toggleStepSkip(stepNumber)}
          onNavigateNext={() => navigateToNextStep(stepNumber)}
          onStepReset={hasResetSupport ? () => resetStepComplete(stepNumber) : undefined}
          sectionTag={stepMetadata.sectionTag}
          industry={selectedIndustry}
          useCase={selectedUseCase}
          onPromptGenerated={onStepPromptGenerated}
          initialPrompt={stepPrompts[stepNumber]}
          previousOutputs={previousOutputs}
          isPreviousStepComplete={isPreviousStepComplete(stepNumber)}
          isExpanded={expandedStep === stepNumber}
          onToggleExpand={() => toggleExpand(stepNumber)}
          sessionId={sessionId}
          customHeaderContent={customHeaderContentMap[stepNumber]}
        />
      </div>
    );
  };

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
                    codingAssistant={codingAssistant}
                    currentUserEmail={
                      // Only forward the email once it's actually resolved to
                      // a real value. We filter:
                      //   * '' / undefined  -> not yet fetched
                      //   * 'user@databricks.com' -> App.tsx synthetic placeholder
                      //     (initialized for header/menu copy before fetch resolves)
                      //   * 'unknown'       -> backend fallback when no OAuth
                      //     headers were present (src/backend/api/routes.py
                      //     _get_session_user)
                      //   * any value without an '@' -> not a real email
                      // so the Genie Code clone command never embeds a
                      // misleading placeholder path. Genie Code body falls
                      // back to the literal '<your_email>' marker in those
                      // cases, which clearly signals the user must edit it.
                      currentUser
                        && currentUser.includes('@')
                        && currentUser !== 'user@databricks.com'
                        ? currentUser
                        : null
                    }
                  />
                </div>
              );
            case 3:

              return renderUniformStep(3);
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

              return renderUniformStep(5);
            // Step 6: Setup Lakebase (Chapter 2)
            case 6:

              return renderUniformStep(6);
            // Step 7: Wire UI to Lakebase (Chapter 2) - LOCAL DEVELOPMENT ONLY
            case 7:

              return renderUniformStep(7);
            // Step 8: Deploy and Test (Chapter 2) - FULL DEPLOYMENT TO DATABRICKS
            case 8:

              return renderUniformStep(8);
            // Step 9: Register Lakebase in Unity Catalog (Chapter 3) - Only visible when Lakebase chapter is included
            case 9:

              return renderUniformStep(9);
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

              return renderUniformStep(13);
            // Step 14: Gold Pipeline (Chapter 3) - depends on step 11 (Gold Design)
            case 14:
              return renderUniformStep(14);
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

              return renderUniformStep(23);
            // Step 15: Use-Case Plan (Chapter 4)
            case 15:

              return renderUniformStep(15);
            // Step 16: Build AI/BI Dashboard (Chapter 4)
            case 16:

              return renderUniformStep(16);
            // Step 17: Build Genie Space (Chapter 4)
            case 17:

              return renderUniformStep(17);
            // Step 24: Deploy AI and Agents Assets (Chapter 4)
            case 24:

              return renderUniformStep(24);
            // Step 25: Optimize Genie (Chapter 4)
            case 25:

              return renderUniformStep(25);
            // Step 18: Build Agent (Chapter 4)
            case 18:

              return renderUniformStep(18);
            // Step 19: Wire UI to Agent (Chapter 4)
            case 19:

              return renderUniformStep(19);
            // Step 20: Iterate & Enhance (Refinement)
            case 20:

              return renderUniformStep(20);

            // Step 26: Explore Existing Skills (Agent Skills Accelerator)
            // Step 26: Explore Existing Skills (Agent Skills Accelerator)
            // Kept explicit because it has specialized customHeaderContent (GoldTableTargetEditor)
            case 26: {
              const stepMetadata = ALL_STEPS[26];
              if (!stepMetadata || !stepMetadata.sectionTag) return null;
              const previousOutputsCtx = { goldTableTarget, workshopLevel };
              const previousOutputs = getPreviousOutputsForStep(26, stepPrompts, previousOutputsCtx);
              return (
                <div key={26} className="relative mt-5" data-step-number="26">
                  <StepBadge number={26} />
                  <WorkflowStep
                    stepNumber={26}
                    title={stepMetadata.title}
                    description={stepMetadata.description}
                    icon={<BookOpen className="w-5 h-5" />}
                    color="violet"
                    isComplete={completedSteps.has(26)}
                    isSkipped={skippedSteps.has(26)}
                    onToggleComplete={() => toggleStepComplete(26)}
                    onToggleSkip={() => toggleStepSkip(26)}
                    onNavigateNext={() => navigateToNextStep(26)}
                    sectionTag={stepMetadata.sectionTag}
                    industry={selectedIndustry}
                    useCase={selectedUseCase}
                    onPromptGenerated={onStepPromptGenerated}
                    initialPrompt={stepPrompts[26]}
                    previousOutputs={previousOutputs}
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
            }

            // Step 27: Define Skill Strategy (Agent Skills Accelerator)
            case 27:

              return renderUniformStep(27);

            // Step 28: Create SKILL.md (Agent Skills Accelerator)
            case 28:

              return renderUniformStep(28);

            // Step 29: Apply & Test Skill (Agent Skills Accelerator)
            case 29:

              return renderUniformStep(29);

            // Step 30: Validate & Automate (Agent Skills Accelerator)
            case 30:

              return renderUniformStep(30);

            // ----------------------------------------------------------------
            // Agents Accelerator — Agents on Apps (Steps 38–48)
            // Section titles match the tracks/A-custom-agent-apps/ folder labels.
            // Steps 38–39 produce design artifacts (docs/agent_spec.yaml,
            // docs/agent_tool_plan.yaml) that gate the rest of the section.
            // ----------------------------------------------------------------

            // Step 38: 00 - Agent Spec Design
            case 38:

              return renderUniformStep(38);

            // Step 39: 01 - Agent Tool Selection
            case 39:

              return renderUniformStep(39);

            // Step 40: 02 - UC Resources Foundation
            case 40:

              return renderUniformStep(40);

            // Step 41: 03 - MLflow Tracing + UC OTel
            case 41:

              return renderUniformStep(41);

            // Step 42: 04 - Knowledge Assistant
            case 42:

              return renderUniformStep(42);

            // Step 43: 05 - Clone + Framework
            case 43:

              return renderUniformStep(43);

            // Step 44: 06 - Tools and MCP
            case 44:

              return renderUniformStep(44);

            // Step 45: 07 - Auth + Memory
            case 45:

              return renderUniformStep(45);

            // Step 46: 08 - Smoke Eval + Deploy
            case 46:

              return renderUniformStep(46);

            // Step 47: 09 - AppKit Agent Proxy
            case 47:

              return renderUniformStep(47);

            // ----------------------------------------------------------------
            // Step 48: 10 - Chat Feedback to MLflow
            // ----------------------------------------------------------------
            case 48:

              return renderUniformStep(48);

            // ----------------------------------------------------------------
            // Agents Accelerator — MLflow for Gen-AI (Steps 49-56)
            // Section titles match the sdlc/ folder labels
            // ----------------------------------------------------------------

            // Step 49: 01 - Prompt Registry
            case 49:

              return renderUniformStep(49);

            // Step 50: 02 - Evaluation Datasets
            case 50:

              return renderUniformStep(50);

            // Step 51: 03 - Scorers and Judges
            case 51:

              return renderUniformStep(51);

            // Step 52: 04 - Evaluation Runs + Iteration
            case 52:

              return renderUniformStep(52);

            // Step 53: 05 - Human Review + Sign-off
            case 53:

              return renderUniformStep(53);

            // Step 54: 06 - Logged Model & UC Registration
            case 54:

              return renderUniformStep(54);

            // Step 55: 07 - AI Gateway + Deployment
            case 55:

              return renderUniformStep(55);

            // Step 56: 08 - Production Monitoring + Debugging
            case 56:

              return renderUniformStep(56);

            // Steps 57-59: data pre-work (Data Source, Data Model, Provision Data).
            // The switch ends in `default: return null`, so a step missing a case here is
            // silently never rendered — it appears in the sidebar and in the step count,
            // but its card never exists. Caught by counting rendered data-step-number
            // attributes in a real browser rather than trusting the section config.
            case 57:
              return renderUniformStep(57);
            case 58:
              return renderUniformStep(58);
            case 59:
              return renderUniformStep(59);

            // Step 21: Redeploy & Test (Refinement)
            case 21:

              return renderUniformStep(21);

            // Step 31: Workspace Clean Up (Clean Up section)
            case 31:

              return renderUniformStep(31);

            // Step 32: Plan Synced Tables (Activation / Reverse ETL)
            case 32:

              return renderUniformStep(32);

            // Step 33: Create Synced Tables (Activation / Reverse ETL)
            case 33:

              return renderUniformStep(33);

            // Step 34: Design Analytics App (Activation / Reverse ETL)
            case 34:

              return renderUniformStep(34);

            // Step 35: Build & Wire App (Activation / Reverse ETL)
            case 35:

              return renderUniformStep(35);

            // Step 36: Wire to Lakebase (Activation / Reverse ETL)
            case 36:

              return renderUniformStep(36);

            // Step 37: Deploy & Validate (Activation / Reverse ETL)
            case 37:

              return renderUniformStep(37);

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
        selectionExplicit={codingAssistantExplicit}
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
        selectedUseCaseCertified={selectedUseCaseCertified}
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
          chainContext={chainContext}
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
          disabledWorkshopLevels={disabledWorkshopLevels}
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

      {/* Hackathons entry point -- bottom of the front page */}
      <HackathonEntryCard />

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
