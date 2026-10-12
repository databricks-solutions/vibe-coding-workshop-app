import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { apiClient } from '../../api/client';
import { ASSISTANT_CATALOG } from '../../constants/codingAssistants';
import { WORKSHOP_LEVELS } from '../../constants/workflowSections';
import { composeBrief, parseBrief, toSlug, type DataSource } from './brief';
import { blueprintForIndustry } from './blueprint/industryMap';
import type { BlueprintChoice } from './blueprint/types';
import { INDUSTRY_IDEAS } from './journey';
import { insightsIndustryFor, type ApprovedUseCase } from './usecases/useCaseApi';
import { AskScreen } from './screens/AskScreen';
import { DataScreen } from './screens/DataScreen';
import { LaunchScreen } from './screens/LaunchScreen';
import { NoticeScreen } from './screens/NoticeScreen';
import { ReadyScreen } from './screens/ReadyScreen';
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

type OnboardingStep = 'ask' | 'data' | 'blueprint' | 'ready';

function InsightsFlowInner(props: InsightsFlowProps) {
  const {
    sessionId, isSessionLoaded, readOnly, currentUser, workshopLevel, codingAssistant,
    selectedIndustry, selectedIndustryLabel, selectedUseCase, selectedUseCaseLabel, customUseCaseLabel, customDescription,
    stepPrompts, completedSteps, skippedSteps, onStepPromptGenerated, onCompletedStepsChange, onStart, onNewSession, onSwitchToTechnical,
  } = props;

  const links = useWorkspaceLinks();
  const parsed = useMemo(() => parseBrief(customDescription || stepPrompts[1] || ''), [customDescription, stepPrompts]);

  const [step, setStep] = useState<OnboardingStep>('ask');
  const [questions, setQuestions] = useState<string[]>([]);
  const [industryId, setIndustryId] = useState('');
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [dataLocation, setDataLocation] = useState('');
  const [blueprint, setBlueprint] = useState<BlueprintChoice | null>(null);
  const [useCase, setUseCase] = useState<ApprovedUseCase | null>(null);
  const [preferredSlug, setPreferredSlug] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [launching, setLaunching] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Start each session's onboarding from whatever brief it already has.
  if (isSessionLoaded && seededFor !== sessionId) {
    setSeededFor(sessionId);
    setStep('ask');
    setQuestions(parsed.questions);
    setDataSource(parsed.questions.length ? parsed.dataSource : null);
    setDataLocation(parsed.dataLocation);
    setBlueprint(parsed.blueprint);
    setUseCase(parsed.useCase);
    setName(parsed.questions.length ? (customUseCaseLabel || selectedUseCaseLabel) : '');
    setIndustryId(INDUSTRY_IDEAS.find(i => i.label === selectedIndustryLabel)?.id ?? insightsIndustryFor(selectedIndustry));
  }

  useEffect(() => {
    document.querySelector('main .overflow-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, launching]);

  const isGeniePath = workshopLevel === 'genie-accelerator';
  const ready = isGeniePath && completedSteps.has(1) && !!selectedUseCase;
  const builtElsewhere = !isGeniePath && Array.from(completedSteps).some(s => s >= 2);
  const assistantName = ASSISTANT_CATALOG.find(a => a.id === codingAssistant)?.name ?? 'Genie Code';

  const start = () => {
    if (!dataSource || readOnly) return;
    const industry = INDUSTRY_IDEAS.find(i => i.id === industryId);
    const finalName = name.trim() || 'My Insights Genie';
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
  } else if (step === 'ask') {
    key = 'ask';
    content = (
      <AskScreen
        questions={questions}
        onQuestionsChange={setQuestions}
        industryId={industryId}
        onIndustryChange={setIndustryId}
        replacingExisting={completedSteps.has(1)}
        useCase={useCase}
        onUseCaseApply={(uc, qs) => {
          setUseCase(uc);
          setQuestions(prev => [...prev, ...qs.filter(q => !prev.includes(q))].slice(0, 6));
          if (!industryId) setIndustryId(insightsIndustryFor(uc.industry));
          if (!name.trim() || name === useCase?.label) setName(uc.label);
        }}
        onUseCaseClear={() => setUseCase(null)}
        onNext={() => setStep('data')}
      />
    );
  } else if (step === 'data') {
    key = 'data';
    content = (
      <DataScreen
        industryId={industryId}
        value={dataSource}
        location={dataLocation}
        onChange={setDataSource}
        onLocationChange={setDataLocation}
        onBack={() => setStep('ask')}
        onOpenInstalled={slug => {
          setDataSource('blueprint');
          setPreferredSlug(slug);
          if (blueprint && blueprint.slug !== slug) setBlueprint(null);
          setStep('blueprint');
        }}
        onNext={() => {
          if (dataSource === 'blueprint') {
            setStep('blueprint');
            return;
          }
          if (!name.trim()) {
            const industry = INDUSTRY_IDEAS.find(i => i.id === industryId);
            setName(industry ? `${industry.label} Insights` : 'My Insights Genie');
          }
          setStep('ready');
        }}
      />
    );
  } else if (step === 'blueprint') {
    key = 'blueprint';
    content = (
      <BlueprintBoundary onBack={() => setStep('data')} onSwitchToTechnical={onSwitchToTechnical}>
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <BlueprintScreen
            questions={questions}
            initialSlug={preferredSlug ?? blueprintForIndustry(industryId)}
            initialChoice={blueprint}
            onBack={() => setStep('data')}
            onNext={choice => {
              setBlueprint(choice);
              if (!name.trim()) {
                const industry = INDUSTRY_IDEAS.find(i => i.id === industryId);
                setName(`${industry?.label ?? choice.label} Insights`);
              }
              setStep('ready');
            }}
          />
        </Suspense>
      </BlueprintBoundary>
    );
  } else {
    key = 'ready';
    content = (
      <ReadyScreen
        name={name}
        onNameChange={setName}
        questionCount={questions.length}
        dataLabel={dataSource === 'blueprint' && blueprint ? `the ${blueprint.label} industry data model` : DATA_LABELS[dataSource && dataSource !== 'blueprint' ? dataSource : 'existing']}
        blueprint={dataSource === 'blueprint' ? blueprint : null}
        useCase={useCase}
        onBack={() => setStep(dataSource === 'blueprint' ? 'blueprint' : 'data')}
        onStart={start}
        readOnly={readOnly}
      />
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pb-24">
        {content}
      </motion.div>
    </AnimatePresence>
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
