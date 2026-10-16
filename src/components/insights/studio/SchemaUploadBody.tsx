import { CsvUploadPanel } from '../../CsvUploadPanel';

interface SchemaUploadBodyProps {
  sessionId: string | null;
  industry: string;
  useCase: string;
  step: number;
  savedPrompt?: string;
  previousStepComplete: boolean;
  readOnly: boolean;
  onGenerated: (step: number, text: string) => void;
  onReadyChange: (ready: boolean) => void;
}

/** Schema-driven locate flow, using the same validator and processor as the Technical view. */
export function SchemaUploadBody({
  sessionId,
  industry,
  useCase,
  step,
  savedPrompt,
  previousStepComplete,
  readOnly,
  onGenerated,
  onReadyChange,
}: SchemaUploadBodyProps) {
  return (
    <CsvUploadPanel
      sessionId={sessionId}
      industry={industry}
      useCase={useCase}
      stepNumber={step}
      sectionTag="semlayer_locate_upload"
      onPromptGenerated={onGenerated}
      initialPrompt={savedPrompt}
      isPreviousStepComplete={previousStepComplete && !readOnly}
      onReadyChange={onReadyChange}
    />
  );
}
