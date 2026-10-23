/**
 * Journey kit: the one shared module behind Ideate and Insights.
 * Both flows import from here only, so they look and behave the same.
 */
export * from './engine/types';
export * from './engine/ideaContext';
export * from './engine/businessCase';
export { useIdeas, useSyncState, flushIdea, setIdeaScore, setIdeaReview, refreshReviews, normalizeIdea, type ReviewChange, type SyncState } from './engine/useIdeas';
export { nextNudge, welcomeBack, type Nudge } from './engine/encouragement';
export { useIdeaFlow, MAX_GENIE_QUESTIONS, type IdeaFlow } from './engine/useIdeaFlow';
export { seedFromUseCase } from './engine/seedFromUseCase';
export * from './engine/handoff';
export { SWITCHED_ADD_ONS, enabledAddOns, useEnabledAddOns, type SwitchedAddOn } from './engine/buildRecipes';
export { MODE_CONFIG, SHAPE_KINDS, modeOf, ideaMinutes, type ModeConfig } from './modes';
export { ART, STEP_ART, avatarFor } from './art';

export { JourneyScreen } from './stage/JourneyScreen';
export { JourneyProgress, type ProgressPhase, type ProgressStep } from './stage/JourneyProgress';
export { PROGRESS_TOKENS, TIER_TOKENS, EASE, DURATION, scoreTone, type StepState } from './tokens';
export { hasOutput, canReach } from './engine/reach';
export { StepDot, StepSegment, StepConnector } from './stage/StepDot';
export { ActionBar, StepActions } from './stage/ActionBar';
export { IdeaStepStage } from './stage/IdeaStepStage';
export { BUILD_CLIMB_STEPS, ideaLockedClimbSteps, ideaProgressSteps, ideaTrail, showsTrailhead, stopsToSummit, trailFromSummary } from './stage/ideaProgress';
export { SummitTrail, type TrailSize, type TrailBeyond } from './stage/SummitTrail';
export { ClimbRoute } from './stage/ClimbMap';
export { StepDock } from './stage/StepDock';
export { IdeaTools } from './stage/IdeaTools';
export { useIdeaCelebrations } from './stage/useIdeaCelebrations';
export { TrailheadIntro } from './stage/TrailheadIntro';
export { WelcomeBack, SaveStatus } from './stage/NextUpCard';

export { PrimaryButton, SecondaryButton, GhostButton, Eyebrow, Headline, FadeIn, PageLoader, ProgressRing } from './ui/primitives';
export { Thinking } from './ui/Thinking';
export { PathCard } from './ui/PathCard';
export { PersonaChip, PersonaStack } from './ui/PersonaChip';
export { UseCaseBadge, UseCaseIcon } from './ui/UseCaseBadge';
export { QuestionListEditor } from './ui/QuestionListEditor';
export { VoiceTextarea } from './ui/VoiceTextarea';
export { QuestionCard } from './ui/QuestionCard';
export { AssumptionsDrawer } from './ui/AssumptionsDrawer';
export { ClarityRing } from './ui/ClarityRing';
export { PointsChip } from './ui/PointsChip';
export { TierBadge } from './ui/TierBadge';
export { Scorecard, StoredScorecard } from './ui/Scorecard';
export { SubmitDialog } from './ui/SubmitDialog';
export { ReviewDialog } from './ui/ReviewDialog';
export { ApprovalTracker } from './ui/ApprovalTracker';
export { isApproved, personName, submitterOf, useCanReview, useReviewRefresh, useReviewer } from './engine/approval';
export { BusinessCaseView, BusinessCaseSheet } from './ui/BusinessCase';
export { BusinessCaseButton } from './ui/BusinessCaseButton';
export { SurfaceChips } from './ui/SurfaceChips';
export { IndustryBadge } from './ui/IndustryBadge';
export { SampleBanner, MakeItMineButton } from './ui/SampleBanner';
export { SAMPLES, isSampleId } from './samples';
export { shapeBuild, buildLines, type Surface } from './engine/surfaces';
