import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Route } from 'lucide-react';
import { apiClient } from '../../api/client';
import { ASSISTANT_CATALOG } from '../../constants/codingAssistants';
import { WORKSHOP_LEVELS } from '../../constants/workflowSections';
import {
  BusinessCaseSheet, JourneyProgress, JourneyScreen, SHAPE_KINDS, answerFor, caseFigures, chosenShape, matchingContext, money, placedLeaf, seedFromUseCase, useIdeas,
  type Idea, type StepKey,
} from '../journeykit';
import { composeBrief, fitName, parseBrief, toSlug, type DataSource, type IdeaBrief } from './brief';
import type { ModelHint } from './blueprint/industryMap';
import type { BlueprintChoice } from './blueprint/types';
import { INDUSTRY_IDEAS } from './journey';
import { openPathComparison } from './pathEvents';
import { insightsPhases, type InsightsStage } from './progress';
import { insightsIndustryFor } from './usecases/useCaseApi';
import { DataScreen } from './screens/DataScreen';
import { IdeaLockedScreen } from './screens/IdeaLockedScreen';
import { IdeaStage } from './screens/IdeaStage';
import { LaunchScreen } from './screens/LaunchScreen';
import { NoticeScreen } from './screens/NoticeScreen';
import { ReadyScreen } from './screens/ReadyScreen';
import { StartScreen } from './screens/StartScreen';
import { InsightsStudio } from './studio/InsightsStudio';
import type { InsightsFlowProps, WorkspaceLinks } from './types';

const BlueprintScreen = lazy(() => import('./blueprint/BlueprintScreen'));

const DATA_LABELS: Record<DataSource, string> = {
  existing: 'data already in Databricks',
  upload: 'a file you upload',
  sample: 'sample data',
  blueprint: 'an industry data model',
};

class InsightsErrorBoundary extends Component<{ children: ReactNode; onSwitchToTechnical: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Insights] crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <NoticeScreen
        title="Insights hit a snag"
        body="Your progress is saved in your project. Try again, or carry on in the Technical view."
        primaryLabel="Try again"
        onPrimary={() => this.setState({ error: null })}
        onSwitchToTechnical={this.props.onSwitchToTechnical}
      />
    );
  }
}

/** Keeps a blueprint failure inside its own step; the rest of onboarding stays usable. */
class BlueprintBoundary extends Component<{ children: ReactNode; onBack: () => void; onSwitchToTechnical: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Insights] blueprint step crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <NoticeScreen
        title="The industry model could not be shown"
        body="Nothing was changed. Go back and pick another way to bring in your data."
        primaryLabel="Back to data options"
        onPrimary={this.props.onBack}
        onSwitchToTechnical={this.props.onSwitchToTechnical}
      />
    );
  }
}

function useWorkspaceLinks(): WorkspaceLinks {
  const [links, setLinks] = useState<WorkspaceLinks>({});
  useEffect(() => {
    let cancelled = false;
    apiClient.getWorkshopParametersDict()
      .then(dict => {
        if (cancelled) return;
        const raw = (dict?.workspace_url || '').trim();
        if (!raw) return;
        const base = raw.endsWith('/') ? raw : `${raw}/`;
        const org = (dict?.workspace_org_id || '').trim();
        const q = org ? `?o=${org}` : '';
        setLinks({ home: `${base}${q}`, genie: `${base}genie${q}`, dashboards: `${base}sql/dashboards${q}` });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return links;
}

/** The shaped idea as the labelled lines the build prompts read. */
function ideaBriefOf(idea: Idea): IdeaBrief {
  const shape = chosenShape(idea);
  const figures = caseFigures(idea);
  const who = placedLeaf(idea)?.personas ?? idea.useCaseContext?.personas.map(p => p.name) ?? [];
  return {
    headline: idea.title,
    problem: idea.spark?.statement,
    who: who.join(', '),
    metric: answerFor(idea, 'business'),
    approach: shape ? `${shape.title} (${SHAPE_KINDS[shape.kind].label}): ${shape.value}` : undefined,
    value: figures ? `about ${money(figures.value.expected)} a year from ${figures.driverLabel.toLowerCase()}` : undefined,
    origin: idea.sourceUseCase ? `the approved use case "${idea.sourceUseCase.label}"` : 'their own idea',
  };
}

function industryIdOf(idea: Idea | undefined, fallback: string): string {
  if (!idea) return fallback;
  if (idea.sourceUseCase) return insightsIndustryFor(idea.sourceUseCase.industry) || fallback;
  return INDUSTRY_IDEAS.find(i => i.label === idea.industry)?.id
    || insightsIndustryFor(idea.spark?.catalogIndustry ?? '')
    || fallback;
}

function InsightsFlowInner(props: InsightsFlowProps) {
  const {
    sessionId, isSessionLoaded, readOnly, currentUser, workshopLevel, codingAssistant,
    selectedIndustry, selectedIndustryLabel, selectedUseCase, selectedUseCaseLabel, customUseCaseLabel, customDescription,
    stepPrompts, completedSteps, skippedSteps, onStepPromptGenerated, onCompletedStepsChange, onStart, onNewSession, onSwitchToTechnical,
  } = props;

  const links = useWorkspaceLinks();
  const parsed = useMemo(() => parseBrief(customDescription || stepPrompts[1] || ''), [customDescription, stepPrompts]);
  const { ideas, createIdea, updateIdea, deleteIdea } = useIdeas();

  const [stage, setStage] = useState<InsightsStage>('start');
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [lockSeen, setLockSeen] = useState<string | undefined>();
  const [startIndustry, setStartIndustry] = useState('');
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [dataLocation, setDataLocation] = useState('');
  const [blueprint, setBlueprint] = useState<BlueprintChoice | null>(null);
  const [preferredSlug, setPreferredSlug] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [launching, setLaunching] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null | undefined>(undefined);
  const [caseOpen, setCaseOpen] = useState(false);

  const idea = ideaId ? ideas.find(i => i.id === ideaId) : undefined;

  // Each project starts from its linked idea, if it has one. A project created from
  // an unlinked idea keeps it, so starting the build never loses your place.
  if (isSessionLoaded && seededFor !== sessionId) {
    setSeededFor(sessionId);
    const carried = idea && !idea.sessionId ? idea : undefined;
    if (!carried) {
      const linked = sessionId ? ideas.find(i => (i.mode === 'insights' || i.buildTarget === 'insights') && i.sessionId === sessionId) : undefined;
      setIdeaId(linked?.id ?? null);
      setLockSeen(linked?.lockedAt);
      setStage(linked ? (linked.lockedAt ? (linked.buildStage === 'data' && linked.genieQuestions?.length ? 'data' : 'locked') : 'idea') : 'start');
      setDataSource(parsed.questions.length ? parsed.dataSource : null);
      setDataLocation(parsed.dataLocation);
      setBlueprint(parsed.blueprint);
      setName(fitName(linked?.title ?? (parsed.questions.length ? (customUseCaseLabel || selectedUseCaseLabel) : '')));
      setStartIndustry(INDUSTRY_IDEAS.find(i => i.label === selectedIndustryLabel)?.id ?? insightsIndustryFor(selectedIndustry));
    }
  }

  // Locking the brief hands the idea to the build.
  if (stage === 'idea' && idea?.lockedAt && idea.lockedAt !== lockSeen) {
    setLockSeen(idea.lockedAt);
    setName(fitName(idea.title));
    setStage('locked');
  }
  // Building needs a locked idea; editing one sends you back to finish it.
  if ((stage === 'locked' || stage === 'data' || stage === 'blueprint' || stage === 'ready') && !idea?.lockedAt) {
    setStage(idea ? 'idea' : 'start');
  }

  useEffect(() => {
    if (idea && !idea.sessionId && sessionId && !readOnly) updateIdea(idea.id, { sessionId });
  }, [idea, sessionId, readOnly, updateIdea]);

  useEffect(() => {
    document.querySelector('main .overflow-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage, launching]);

  const isGeniePath = workshopLevel === 'genie-accelerator';
  const ready = isGeniePath && completedSteps.has(1) && !!selectedUseCase;
  const builtElsewhere = !isGeniePath && Array.from(completedSteps).some(s => s >= 2);
  const assistantName = ASSISTANT_CATALOG.find(a => a.id === codingAssistant)?.name ?? 'Genie Code';

  const questions = idea?.genieQuestions ?? [];
  const useCase = idea?.sourceUseCase ?? null;
  const industryId = industryIdOf(idea, startIndustry);
  const ideaText = useMemo(() => matchingContext(idea), [idea]);
  const modelHint: ModelHint = {
    industryId,
    industry: idea?.spark?.industry || idea?.sourceUseCase?.industryLabel,
    text: [ideaText, ...questions].filter(Boolean).join('\n'),
  };
  const usingBlueprint = dataSource === 'blueprint';

  const phases = (viewStep?: StepKey | null) => insightsPhases({ stage, idea, viewStep, blueprint: usingBlueprint });
  const progress = <JourneyProgress phases={phases()} trailing="then 4 build chapters" />;
  const compare = (
    <button onClick={openPathComparison} className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground hover:text-foreground transition-colors">
      <Route className="w-4 h-4" /> <span className="hidden lg:inline">Compare paths</span>
    </button>
  );

  const openIdea = (next: Idea) => {
    setIdeaId(next.id);
    setLockSeen(undefined);
    setStage('idea');
  };

  const discardIdea = () => {
    if (idea) deleteIdea(idea.id);
    setIdeaId(null);
    setStage('start');
  };

  const editIdea = () => {
    setLockSeen(idea?.lockedAt);
    setStage('idea');
  };

  const openCase = idea?.brief ? () => setCaseOpen(true) : undefined;

  const start = () => {
    if (!dataSource || readOnly || !idea) return;
    const industry = INDUSTRY_IDEAS.find(i => i.id === industryId);
    const finalName = fitName(name) || fitName(idea.title) || 'My Insights Genie';
    const useBlueprint = dataSource === 'blueprint' && blueprint;
    onStart({
      industry: useCase?.industry ?? industry?.id ?? 'general',
      industryLabel: useCase?.industryLabel ?? industry?.label ?? 'General',
      useCase: useCase?.useCase ?? (toSlug(finalName) || 'insights_genie'),
      useCaseLabel: finalName,
      description: composeBrief({
        name: finalName,
        industryLabel: industry?.label ?? (useBlueprint ? blueprint.label : ''),
        questions,
        dataSource: useBlueprint ? 'blueprint' : dataSource === 'blueprint' ? 'existing' : dataSource,
        dataLocation: useBlueprint ? blueprint.catalog : dataLocation.trim(),
        blueprint: useBlueprint ? blueprint : null,
        useCase,
        idea: ideaBriefOf(idea),
      }),
    });
    setLaunching(true);
  };

  let content: ReactNode;
  let key: string;

  if (!isSessionLoaded) {
    key = 'loading';
    content = <div className="min-h-[50vh]" />;
  } else if (launching) {
    key = 'launch';
    content = <LaunchScreen name={name} onDone={() => setLaunching(false)} />;
  } else if (builtElsewhere) {
    key = 'elsewhere';
    const levelLabel = WORKSHOP_LEVELS[workshopLevel]?.label ?? 'another path';
    content = (
      <NoticeScreen
        title="This project lives in the Technical view"
        body={`It is set up for the ${levelLabel} path and already has progress. Insights builds Genie spaces and dashboards on existing data, so it works best as a fresh project.`}
        primaryLabel={readOnly ? undefined : 'Start a new Insights project'}
        onPrimary={readOnly ? undefined : onNewSession}
        onSwitchToTechnical={onSwitchToTechnical}
      />
    );
  } else if (ready) {
    key = 'studio';
    content = (
      <InsightsStudio
        name={customUseCaseLabel || selectedUseCaseLabel}
        questions={parsed.questions}
        dataSource={parsed.dataSource}
        blueprint={parsed.blueprint}
        industry={selectedIndustry}
        useCase={selectedUseCase}
        sessionId={sessionId}
        currentUser={currentUser}
        codingAssistant={codingAssistant}
        assistantName={assistantName}
        links={links}
        readOnly={readOnly}
        stepPrompts={stepPrompts}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        onStepPromptGenerated={onStepPromptGenerated}
        onCompletedStepsChange={onCompletedStepsChange}
        onSwitchToTechnical={onSwitchToTechnical}
      />
    );
  } else if (readOnly) {
    key = 'readonly';
    content = (
      <NoticeScreen
        title="Nothing to show here yet"
        body="This shared project has not been started in Insights. You can still look around in the Technical view."
        onSwitchToTechnical={onSwitchToTechnical}
      />
    );
  } else if (stage === 'start' || !idea) {
    key = 'start';
    content = (
      <JourneyScreen progress={progress} tools={compare}>
        <StartScreen
          industryId={startIndustry}
          onIndustryChange={setStartIndustry}
          replacingExisting={completedSteps.has(1)}
          onApproved={(uc, qs, preview) => openIdea(seedFromUseCase(createIdea, {
            uc,
            context: { summary: preview.summary, personas: preview.personas, entities: preview.entities, capabilities: preview.capabilities, valueProfile: preview.valueProfile ?? null },
            questions: qs,
            sessionId,
          }))}
          onOwn={text => openIdea(createIdea(text, INDUSTRY_IDEAS.find(i => i.id === startIndustry)?.label ?? '', {
            mode: 'insights',
            sessionId,
            startPath: 'own',
          }))}
        />
      </JourneyScreen>
    );
  } else if (stage === 'idea') {
    key = `idea-${idea.id}`;
    content = (
      <IdeaStage
        key={idea.id}
        ideaId={idea.id}
        industryId={industryId}
        phasesFor={phases}
        tools={compare}
        onBackFromFirst={idea.approved.length === 0 ? discardIdea : undefined}
        onChangeUseCase={discardIdea}
      />
    );
  } else if (stage === 'locked') {
    key = 'locked';
    content = (
      <JourneyScreen progress={progress} tools={compare}>
        <IdeaLockedScreen idea={idea} readOnly={readOnly} onEdit={editIdea} onOpenCase={openCase} onNext={() => setStage('data')} />
      </JourneyScreen>
    );
  } else if (stage === 'data') {
    key = 'data';
    content = (
      <DataScreen
        hint={modelHint}
        value={dataSource}
        location={dataLocation}
        progress={progress}
        onChange={setDataSource}
        onLocationChange={setDataLocation}
        onBack={() => setStage('locked')}
        onOpenInstalled={slug => {
          setDataSource('blueprint');
          setPreferredSlug(slug);
          if (blueprint && blueprint.slug !== slug) setBlueprint(null);
          setStage('blueprint');
        }}
        onNext={() => {
          if (dataSource === 'blueprint') {
            setStage('blueprint');
            return;
          }
          if (!name.trim()) setName(fitName(idea.title));
          setStage('ready');
        }}
      />
    );
  } else if (stage === 'blueprint') {
    key = 'blueprint';
    content = (
      <BlueprintBoundary onBack={() => setStage('data')} onSwitchToTechnical={onSwitchToTechnical}>
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <BlueprintScreen
            questions={questions}
            initialSlug={preferredSlug}
            hint={modelHint}
            context={ideaText}
            initialChoice={blueprint}
            progress={progress}
            onBack={() => setStage('data')}
            onNext={choice => {
              setBlueprint(choice);
              if (!name.trim()) setName(fitName(idea.title || `${choice.label} Insights`));
              setStage('ready');
            }}
          />
        </Suspense>
      </BlueprintBoundary>
    );
  } else {
    key = 'ready';
    const shape = chosenShape(idea);
    content = (
      <ReadyScreen
        progress={progress}
        idea={{ headline: idea.title, problem: idea.spark?.statement, approach: shape ? { label: shape.title, kind: shape.kind } : undefined }}
        onEditIdea={editIdea}
        onOpenCase={openCase}
        name={name}
        onNameChange={setName}
        questionCount={questions.length}
        dataLabel={usingBlueprint && blueprint ? `the ${blueprint.label} industry data model` : DATA_LABELS[dataSource && dataSource !== 'blueprint' ? dataSource : 'existing']}
        blueprint={usingBlueprint ? blueprint : null}
        useCase={useCase}
        onBack={() => setStage(usingBlueprint ? 'blueprint' : 'data')}
        onStart={start}
        readOnly={readOnly}
      />
    );
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pb-24">
          {content}
        </motion.div>
      </AnimatePresence>
      {caseOpen && idea && (
        <BusinessCaseSheet ideaId={idea.id} onClose={() => setCaseOpen(false)} onAddNumbers={() => { setCaseOpen(false); editIdea(); }} />
      )}
    </>
  );
}

export default function InsightsFlow(props: InsightsFlowProps) {
  return (
    <MotionConfig reducedMotion="user">
      <InsightsErrorBoundary onSwitchToTechnical={props.onSwitchToTechnical}>
        <InsightsFlowInner {...props} />
      </InsightsErrorBoundary>
    </MotionConfig>
  );
}
