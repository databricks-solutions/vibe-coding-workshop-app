import type { WorkshopLevel } from '../../constants/workflowSections';

export interface InsightsSetup {
  industry: string;
  industryLabel: string;
  useCase: string;
  useCaseLabel: string;
  description: string;
}

export interface InsightsFlowProps {
  sessionId: string | null;
  isSessionLoaded: boolean;
  readOnly: boolean;
  currentUser: string;
  workshopLevel: WorkshopLevel;
  codingAssistant: string | null;
  selectedIndustry: string;
  selectedIndustryLabel: string;
  selectedUseCase: string;
  selectedUseCaseLabel: string;
  customUseCaseLabel: string;
  customDescription: string;
  stepPrompts: Record<number, string>;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  onStepPromptGenerated: (stepNumber: number, promptText: string) => void;
  onCompletedStepsChange: (steps: Set<number>) => void;
  onStart: (setup: InsightsSetup) => void;
  onNewSession: () => void;
  onSwitchToTechnical: () => void;
}

export interface WorkspaceLinks {
  home?: string;
  genie?: string;
  dashboards?: string;
}
