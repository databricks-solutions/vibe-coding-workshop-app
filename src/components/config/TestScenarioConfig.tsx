/**
 * Test Scenario Tab
 *
 * Lightweight, fully-ephemeral tab for testing the prompt-generation flow
 * end-to-end. Reuses PromptGenerator and PathAndArchitecture verbatim so any
 * changes to those propagate automatically. Does NOT mount WorkflowDiagram,
 * WorkflowStep, LakehouseParamsEditor, AgentToolInputsEditor, or any
 * session-aware editor. Calls only the read-only `/generate-prompt-stream`
 * endpoint with sessionId=null. Zero backend writes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  FlaskConical,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { PromptGenerator } from '../PromptGenerator';
import { PathAndArchitecture } from '../PathAndArchitecture';
import { CodingAssistantSelector } from '../CodingAssistantSelector';
import { apiClient } from '../../api/client';
import {
  ALL_AI_MODULES,
  ALL_MEDALLION_LAYERS,
  ALL_STEPS,
  getDisabledTagsForAIModules,
  getDisabledTagsForMedallionLayers,
  getFilteredSections,
  normalizeMedallionLayers,
  type AIAgentModule,
  type MedallionLayer,
  type WorkflowDirection,
  type WorkshopLevel,
} from '../../constants/workflowSections';
import type { AssistantId } from '../../constants/codingAssistants';
import { getPreviousOutputsForStep, type GoldTableTarget } from '../../utils/stepPreviousOutputs';
import { SetUpProjectStep } from '../SetUpProjectStep';

// Steps that never call the LLM in the real workflow either; we skip these in
// Run All. Step 1 is intent (owned by PromptGenerator at the top of the tab).
// Step 2 is the SetUpProjectStep instructional card — we render the real
// component verbatim in the step list below so any change to it propagates
// here automatically; there is no LLM prompt to generate.
const NON_LLM_STEPS = new Set<number>([1, 2]);
const SET_UP_PROJECT_STEP_NUMBER = 2;

interface RunState {
  status: 'idle' | 'running' | 'error' | 'cancelled' | 'done';
  currentStep: number | null;
  totalSteps: number;
  completedSteps: number;
  error: string | null;
  failedStep: number | null;
}

const INITIAL_RUN_STATE: RunState = {
  status: 'idle',
  currentStep: null,
  totalSteps: 0,
  completedSteps: 0,
  error: null,
  failedStep: null,
};

const INITIAL_GOLD_TARGET: GoldTableTarget = { catalog: '', schema: '', prefix: '' };

interface TestScenarioConfigProps {
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export function TestScenarioConfig({ onToast }: TestScenarioConfigProps) {
  // Intent
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedIndustryLabel, setSelectedIndustryLabel] = useState('');
  const [selectedUseCase, setSelectedUseCase] = useState('');
  const [selectedUseCaseLabel, setSelectedUseCaseLabel] = useState('');
  const [customUseCaseLabel, setCustomUseCaseLabel] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [brandUrl, setBrandUrl] = useState('');

  // Coding assistant choice — drives the prompt fork the backend serves and
  // (via getVisibility) any admin-configured per-assistant step hides.
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantId | null>(null);
  const [assistantDisabledTags, setAssistantDisabledTags] = useState<Set<string>>(new Set());

  // Signed-in user's email — only used to feed the Genie Code variant of
  // SetUpProjectStep so the /Workspace/Users/<email>/... clone path is
  // pre-filled exactly like the real workflow. SetUpProjectStep itself
  // fetches workspace_url, so we don't duplicate that fetch.
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Architecture
  const [workshopLevel, setWorkshopLevel] = useState<WorkshopLevel>('end-to-end');
  const [direction, setDirection] = useState<WorkflowDirection>('forward');
  const [aiAgentsModules, setAiAgentsModules] = useState<Set<AIAgentModule>>(
    () => new Set(ALL_AI_MODULES),
  );
  const [medallionLayersRaw, setMedallionLayersRaw] = useState<Set<MedallionLayer>>(
    () => new Set(ALL_MEDALLION_LAYERS),
  );
  const medallionLayers = useMemo(
    () => normalizeMedallionLayers(medallionLayersRaw),
    [medallionLayersRaw],
  );
  const setMedallionLayers = useCallback((next: Set<MedallionLayer>) => {
    setMedallionLayersRaw(normalizeMedallionLayers(next));
  }, []);

  // Goldlayer target (only consumed by steps 26-30 chaining)
  const [goldTableTarget] = useState<GoldTableTarget>(INITIAL_GOLD_TARGET);

  // Run options + run state. Both refinement toggles default to OFF — same
  // policy as cleanup — so a fresh test scenario only generates the core
  // build flow, and the user opts in to refinement + cleanup explicitly.
  const [includeCleanup, setIncludeCleanup] = useState(false);
  const [includeIterateRedeploy, setIncludeIterateRedeploy] = useState(false);
  const [stepPrompts, setStepPrompts] = useState<Record<number, string>>({});
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // UI state for cards
  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Ephemeral wiring for the embedded SetUpProjectStep component. The real
  // workflow drives these from session state; here they're local-only.
  const [setupStepComplete, setSetupStepComplete] = useState(false);
  const [setupStepExpanded, setSetupStepExpanded] = useState(true);

  // Effective disabled tags — mirrors App.tsx effectiveDisabledTags exactly,
  // except we never include backend session-level overrides (no session) and
  // we add the tail-section tags when their respective opt-in checkboxes are
  // off:
  //   - workspace_cleanup    → step 31 (Workspace Clean Up)
  //   - iterate_enhance      → step 20 (Iterate & Enhance)
  //   - redeploy_test        → step 21 (Redeploy & Test)
  // The per-assistant `assistantDisabledTags` set is unioned in so the visible
  // step list matches whatever the admin has configured for that assistant.
  const effectiveDisabledTags = useMemo(() => {
    const aiTags = getDisabledTagsForAIModules(workshopLevel, aiAgentsModules);
    const medTags = getDisabledTagsForMedallionLayers(workshopLevel, medallionLayers);
    const tags = new Set<string>([
      ...aiTags,
      ...medTags,
      ...assistantDisabledTags,
    ]);
    if (!includeCleanup) tags.add('workspace_cleanup');
    if (!includeIterateRedeploy) {
      tags.add('iterate_enhance');
      tags.add('redeploy_test');
    }
    return tags;
  }, [
    workshopLevel,
    aiAgentsModules,
    medallionLayers,
    includeCleanup,
    includeIterateRedeploy,
    assistantDisabledTags,
  ]);

  // Visible step list, derived from architecture choices.
  const visibleSections = useMemo(
    () => getFilteredSections(workshopLevel, effectiveDisabledTags, undefined, direction),
    [workshopLevel, effectiveDisabledTags, direction],
  );

  // Flatten visible steps, in section order, for Run All. Non-LLM steps
  // (intent + Set Up Project) are excluded — they're rendered inline above /
  // inside the step list using the real components, but they don't produce
  // a prompt for the backend.
  const runnableSteps = useMemo(() => {
    const out: number[] = [];
    for (const section of visibleSections) {
      for (const step of section.steps) {
        if (NON_LLM_STEPS.has(step.number)) continue;
        if (!step.sectionTag) continue;
        out.push(step.number);
      }
    }
    return out;
  }, [visibleSections]);

  // All visible steps (including non-LLM ones) for display below the toolbar.
  const displaySteps = useMemo(() => {
    const out: number[] = [];
    for (const section of visibleSections) {
      for (const step of section.steps) {
        out.push(step.number);
      }
    }
    return out;
  }, [visibleSections]);

  const intentDefined = !!selectedIndustry && !!selectedUseCase;
  const assistantPicked = !!selectedAssistant;
  const canRun =
    intentDefined && assistantPicked && runnableSteps.length > 0 && runState.status !== 'running';

  const handleIntentDefined = useCallback(
    (
      _prompt: string,
      industry: string,
      useCase: string,
      industryLabel?: string,
      useCaseLabel?: string,
      customDesc?: string,
    ) => {
      setSelectedIndustry(industry);
      setSelectedIndustryLabel(industryLabel || industry);
      setSelectedUseCase(useCase);
      setSelectedUseCaseLabel(useCaseLabel || useCase);
      if (customDesc !== undefined) setCustomDescription(customDesc);
      if (useCaseLabel !== undefined) setCustomUseCaseLabel(useCaseLabel);
    },
    [],
  );

  // Run a single step. Returns the assembled prompt text.
  const runOneStep = useCallback(
    (stepNumber: number, signal: AbortSignal): Promise<string> => {
      const step = ALL_STEPS[stepNumber];
      if (!step || !step.sectionTag) {
        return Promise.reject(new Error(`Step ${stepNumber} has no sectionTag`));
      }
      const sectionTag = step.sectionTag;

      // Use the current stepPrompts snapshot via setState callback to avoid
      // stale-closure bugs in long-running loops.
      let previousOutputs: Record<string, string> | undefined;
      setStepPrompts((current) => {
        previousOutputs = getPreviousOutputsForStep(stepNumber, current, {
          goldTableTarget,
          workshopLevel,
        });
        return current;
      });

      return new Promise<string>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }

        let buffer = '';
        const onAbort = () => {
          controller.abort();
          reject(new DOMException('aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort);

        const controller = apiClient.generatePromptStream(
          selectedIndustry,
          selectedUseCase,
          sectionTag,
          (content) => {
            buffer += content;
            // Live update so the user sees the prompt populate as it streams.
            setStepPrompts((prev) => ({ ...prev, [stepNumber]: buffer }));
          },
          () => {
            signal.removeEventListener('abort', onAbort);
            resolve(buffer);
          },
          (errMsg) => {
            signal.removeEventListener('abort', onAbort);
            reject(new Error(errMsg));
          },
          previousOutputs,
          null, // sessionId — explicit null, ephemeral
          undefined, // onRetry — unused in the test tab
          selectedAssistant ?? undefined, // coding_assistant override for fork selection
        );

        // Hook the per-step controller's abort to the outer signal too, so
        // a global Stop also tears down the in-flight fetch immediately.
        signal.addEventListener(
          'abort',
          () => {
            try {
              controller.abort();
            } catch {
              // ignore
            }
          },
          { once: true },
        );
      });
    },
    [selectedIndustry, selectedUseCase, goldTableTarget, workshopLevel, selectedAssistant],
  );

  const handleRunAll = useCallback(async () => {
    if (!canRun) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    cancelledRef.current = false;

    setStepPrompts({});
    setCollapsedCards(new Set());
    setRunState({
      status: 'running',
      currentStep: runnableSteps[0] ?? null,
      totalSteps: runnableSteps.length,
      completedSteps: 0,
      error: null,
      failedStep: null,
    });

    for (let i = 0; i < runnableSteps.length; i++) {
      const stepNumber = runnableSteps[i];
      if (cancelledRef.current || controller.signal.aborted) break;

      setRunState((prev) => ({
        ...prev,
        currentStep: stepNumber,
        completedSteps: i,
      }));

      try {
        await runOneStep(stepNumber, controller.signal);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || cancelledRef.current) {
          setRunState({
            status: 'cancelled',
            currentStep: null,
            totalSteps: runnableSteps.length,
            completedSteps: i,
            error: null,
            failedStep: null,
          });
          abortControllerRef.current = null;
          return;
        }
        const message = (err as Error).message || 'Unknown error';
        setRunState({
          status: 'error',
          currentStep: null,
          totalSteps: runnableSteps.length,
          completedSteps: i,
          error: message,
          failedStep: stepNumber,
        });
        abortControllerRef.current = null;
        onToast?.(`Run failed at step ${stepNumber}: ${message}`, 'error');
        return;
      }
    }

    setRunState({
      status: 'done',
      currentStep: null,
      totalSteps: runnableSteps.length,
      completedSteps: runnableSteps.length,
      error: null,
      failedStep: null,
    });
    abortControllerRef.current = null;
    onToast?.(`Generated ${runnableSteps.length} prompts`, 'success');
  }, [canRun, runnableSteps, runOneStep, onToast]);

  const handleStop = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const handleReset = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStepPrompts({});
    setRunState(INITIAL_RUN_STATE);
    setCollapsedCards(new Set());
    setCopiedStep(null);
    setCopiedAll(false);
  }, []);

  // Build the Copy All markdown blob.
  const copyAllMarkdown = useMemo(() => {
    const sections: string[] = [];
    const intentHeader =
      `# Test Scenario\n\n` +
      `- **Coding Assistant**: ${selectedAssistant || '(none)'}\n` +
      `- **Industry**: ${selectedIndustryLabel || selectedIndustry || '(none)'}\n` +
      `- **Use Case**: ${customUseCaseLabel || selectedUseCaseLabel || selectedUseCase || '(none)'}\n` +
      `- **Workshop Level**: ${workshopLevel}\n` +
      `- **Direction**: ${direction}\n`;
    sections.push(intentHeader);

    for (const stepNumber of displaySteps) {
      const text = stepPrompts[stepNumber];
      if (!text) continue;
      const step = ALL_STEPS[stepNumber];
      const title = step?.title || `Step ${stepNumber}`;
      sections.push(`## Step ${stepNumber} — ${title}\n\n${text.trim()}\n`);
    }
    return sections.join('\n---\n\n');
  }, [
    displaySteps,
    stepPrompts,
    selectedIndustry,
    selectedIndustryLabel,
    selectedUseCase,
    selectedUseCaseLabel,
    customUseCaseLabel,
    workshopLevel,
    direction,
    selectedAssistant,
  ]);

  const promptsAvailable = Object.values(stepPrompts).some((p) => !!p && p.trim().length > 0);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyAllMarkdown);
      setCopiedAll(true);
      onToast?.('All prompts copied to clipboard', 'success');
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch (err) {
      onToast?.(`Copy failed: ${(err as Error).message || 'clipboard error'}`, 'error');
    }
  }, [copyAllMarkdown, onToast]);

  const handleCopyStep = useCallback(
    async (stepNumber: number) => {
      const text = stepPrompts[stepNumber];
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopiedStep(stepNumber);
        window.setTimeout(() => setCopiedStep((s) => (s === stepNumber ? null : s)), 1500);
      } catch (err) {
        onToast?.(`Copy failed: ${(err as Error).message || 'clipboard error'}`, 'error');
      }
    },
    [stepPrompts, onToast],
  );

  const toggleCard = useCallback((stepNumber: number) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) next.delete(stepNumber);
      else next.add(stepNumber);
      return next;
    });
  }, []);

  // Cleanup any in-flight stream if the tab unmounts.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  // One-time read of signed-in user email — fed as a prop to SetUpProjectStep
  // so its Genie Code variant pre-fills /Workspace/Users/<email>/... exactly
  // like the real workflow does. Read-only endpoint, no session needed.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        if (u?.user) setCurrentUserEmail(u.user);
      })
      .catch(() => {
        // ignore — SetUpProjectStep falls back to <your_email>
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch per-assistant step visibility whenever the chosen assistant changes.
  // We only consume `disabled_steps` (section tags) — the wider `disabled_paths`
  // (workshop level lockouts) doesn't apply to an ephemeral test, since the
  // user is explicitly opting into a particular architecture.
  useEffect(() => {
    if (!selectedAssistant) {
      setAssistantDisabledTags(new Set());
      return;
    }
    let cancelled = false;
    apiClient
      .getVisibility(selectedAssistant)
      .then((v) => {
        if (cancelled) return;
        setAssistantDisabledTags(new Set(v.disabled_steps ?? []));
      })
      .catch(() => {
        if (cancelled) return;
        setAssistantDisabledTags(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAssistant]);

  const progressPct =
    runState.totalSteps > 0 ? Math.round((runState.completedSteps / runState.totalSteps) * 100) : 0;

  return (
    <div className="h-full overflow-auto pr-2">
      {/* Sandbox banner */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <FlaskConical className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-ui-base font-semibold text-foreground">Test Scenario Sandbox</div>
          <div className="text-ui-xs text-muted-foreground mt-0.5 leading-relaxed">
            Ephemeral, in-memory only. Nothing here is saved to your session or the backend.
            Refresh the page to reset. Use this tab to run the full prompt-generation flow
            end-to-end and copy the generated prompts.
          </div>
        </div>
      </div>

      {/* Coding assistant picker (CodingAssistantSelector reused) */}
      <div className="mb-4">
        <CodingAssistantSelector
          selectedAssistant={selectedAssistant}
          onSelect={(id) => setSelectedAssistant(id as AssistantId)}
          onConfirm={() => {/* no-op in test tab — selection alone is enough */}}
          hideConfirm={true}
          forceExpanded={!selectedAssistant}
        />
      </div>

      {/* Intent picker (PromptGenerator reused) */}
      <div className="mb-4">
        <PromptGenerator
          onPromptGenerated={handleIntentDefined}
          onBrandUrlChange={setBrandUrl}
          initialIndustry={selectedIndustry}
          initialUseCase={selectedUseCase}
          initialCustomUseCaseLabel={customUseCaseLabel}
          initialCustomDescription={customDescription}
          initialBrandUrl={brandUrl}
          isExpanded={true}
          prerequisitesCompleted={true}
          workshopLevel={workshopLevel}
        />
      </div>

      {/* Architecture picker (PathAndArchitecture reused) */}
      <div className="mb-4">
        <PathAndArchitecture
          selectedLevel={workshopLevel}
          chainContext={null}
          onLevelChange={setWorkshopLevel}
          completedSteps={new Set()}
          levelExplicitlySelected={true}
          forceExpanded={true}
          hasUseCaseSelected={intentDefined}
          direction={direction}
          directionLocked={false}
          onDirectionChange={setDirection}
          aiAgentsModules={aiAgentsModules}
          onAIModulesChange={setAiAgentsModules}
          medallionLayers={medallionLayers}
          onMedallionLayersChange={setMedallionLayers}
        />
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 mb-4 rounded-lg border border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          {runState.status === 'running' ? (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-ui-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRunAll}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-ui-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !intentDefined
                  ? 'Pick an industry and use case first'
                  : !assistantPicked
                    ? 'Pick a coding assistant first'
                    : runnableSteps.length === 0
                      ? 'No runnable steps for this architecture'
                      : `Generate prompts for ${runnableSteps.length} steps`
              }
            >
              <Play className="w-4 h-4" />
              Run All ({runnableSteps.length} steps)
            </button>
          )}

          <button
            onClick={handleCopyAll}
            disabled={!promptsAvailable}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-ui-sm font-medium text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            Copy All
          </button>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-ui-sm font-medium text-foreground hover:bg-secondary/70 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <label className="inline-flex items-center gap-2 text-ui-sm text-foreground cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={includeIterateRedeploy}
              onChange={(e) => setIncludeIterateRedeploy(e.target.checked)}
              disabled={runState.status === 'running'}
              className="rounded border-border"
            />
            Include Iterate &amp; Redeploy Steps
          </label>

          <label className="inline-flex items-center gap-2 text-ui-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeCleanup}
              onChange={(e) => setIncludeCleanup(e.target.checked)}
              disabled={runState.status === 'running'}
              className="rounded border-border"
            />
            Include Cleanup Step
          </label>
        </div>

        {/* Progress / status row */}
        {runState.status !== 'idle' && (
          <div className="mt-3 flex items-center gap-3">
            {runState.status === 'running' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-ui-sm text-foreground">
                  Generating step {runState.completedSteps + 1} of {runState.totalSteps}
                  {runState.currentStep != null && (
                    <span className="text-muted-foreground ml-1">
                      — {ALL_STEPS[runState.currentStep]?.title || `Step ${runState.currentStep}`}
                    </span>
                  )}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-ui-xs text-muted-foreground tabular-nums">{progressPct}%</span>
                </div>
              </>
            )}
            {runState.status === 'done' && (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-ui-sm text-foreground">
                  Done — generated {runState.totalSteps} prompts
                </span>
              </>
            )}
            {runState.status === 'cancelled' && (
              <>
                <Square className="w-4 h-4 text-muted-foreground" />
                <span className="text-ui-sm text-muted-foreground">
                  Cancelled — completed {runState.completedSteps} of {runState.totalSteps}
                </span>
              </>
            )}
            {runState.status === 'error' && (
              <>
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-ui-sm text-red-400">
                  Failed at step {runState.failedStep} — {runState.error}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generated prompt cards */}
      <div className="space-y-3 pb-12">
        {displaySteps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center text-muted-foreground">
            Pick an architecture above to see the step list.
          </div>
        ) : (
          displaySteps.map((stepNumber) => {
            const step = ALL_STEPS[stepNumber];
            if (!step) return null;

            // Step 2 (Set Up Project) is rendered using the real
            // SetUpProjectStep component verbatim — no duplication of its
            // commands, links, or copy. If the workflow's setup step changes,
            // the test tab picks it up automatically. We pass sessionId=null
            // so the component falls back to read-only workshop parameters
            // for workspace_url (no session writes).
            if (stepNumber === SET_UP_PROJECT_STEP_NUMBER) {
              return (
                <div key={stepNumber} data-step-number={stepNumber}>
                  <SetUpProjectStep
                    isComplete={setupStepComplete}
                    onMarkComplete={() => setSetupStepComplete(true)}
                    isExpanded={setupStepExpanded}
                    onToggleExpand={() => setSetupStepExpanded((v) => !v)}
                    isPreviousStepComplete={intentDefined}
                    onStepReset={() => setSetupStepComplete(false)}
                    sessionId={null}
                    useCaseLabel={customUseCaseLabel || selectedUseCaseLabel}
                    codingAssistant={selectedAssistant}
                    currentUserEmail={currentUserEmail}
                  />
                </div>
              );
            }

            const text = stepPrompts[stepNumber];
            const isNonLlm = NON_LLM_STEPS.has(stepNumber);
            const isCurrent = runState.currentStep === stepNumber && runState.status === 'running';
            const isCollapsed = collapsedCards.has(stepNumber);
            const hasText = !!text && text.length > 0;

            return (
              <div
                key={stepNumber}
                className={`rounded-lg border ${
                  isCurrent ? 'border-primary/60 bg-primary/5' : 'border-border bg-card'
                } overflow-hidden`}
              >
                <button
                  onClick={() => toggleCard(stepNumber)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary/60 text-ui-xs font-semibold text-foreground tabular-nums shrink-0">
                    {stepNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-base font-semibold text-foreground truncate">
                      {step.title}
                    </div>
                    <div className="text-ui-xs text-muted-foreground truncate">
                      {step.sectionTag}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {!isCurrent && hasText && (
                      <span className="text-ui-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                        ready
                      </span>
                    )}
                    {!isCurrent && !hasText && isNonLlm && (
                      <span className="text-ui-2xs font-medium px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">
                        skipped
                      </span>
                    )}
                    {hasText && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyStep(stepNumber);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-ui-2xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
                      >
                        {copiedStep === stepNumber ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Copy
                      </button>
                    )}
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-border px-4 py-3">
                    {hasText ? (
                      <pre className="whitespace-pre-wrap break-words font-mono text-ui-xs text-foreground bg-background/40 rounded-md p-3 max-h-96 overflow-auto">
                        {text}
                      </pre>
                    ) : isNonLlm ? (
                      <div className="text-ui-xs text-muted-foreground italic">
                        This step is instructional in the real workflow — no LLM prompt is generated.
                      </div>
                    ) : isCurrent ? (
                      <div className="text-ui-xs text-muted-foreground italic">Generating…</div>
                    ) : (
                      <div className="text-ui-xs text-muted-foreground italic">
                        No prompt generated yet. Click Run All above.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
