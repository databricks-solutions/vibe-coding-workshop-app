/**
 * The track picker's lock rule, as a pure function: which levels a session may
 * pick, and why the others are locked. Moved unchanged out of
 * LevelSelectorGrid (LevelSelector.tsx) so the picker's tabs use the same rule,
 * and so tests/workshop/test_track_switch_parity.py can compare it with the MCP
 * switch rule (src/backend/workshop/track_switch.py).
 */

import {
  getActiveChain,
  type ChainContext,
  type WorkflowDirection,
  type WorkshopLevel,
} from './workflowSections';

export type LockReason = 'workflow-started' | 'use-case' | 'assistant';

export interface LevelLockState {
  reason: LockReason;
  title?: string;
  body?: string;
}

export interface LevelLockContext {
  selectedLevel: WorkshopLevel;
  completedSteps: Set<number>;
  chainContext?: ChainContext;
  useCaseLockedLevel?: WorkshopLevel | null;
  hasUseCaseSelected?: boolean;
  direction?: WorkflowDirection;
  disabledWorkshopLevels?: Set<WorkshopLevel>;
}

/**
 * Returns the set of buttons that should appear "included" (highlighted).
 * When on a progressive chain, all levels up to and including the current
 * position are highlighted to show the cumulative path.
 */
export function getHighlightedButtons(
  selectedLevel: WorkshopLevel,
  completedSteps: Set<number>,
  chainContext?: ChainContext,
): Set<WorkshopLevel> {
  const chain = getActiveChain(selectedLevel, completedSteps, chainContext);
  if (chain) {
    const idx = chain.indexOf(selectedLevel);
    if (idx !== -1) return new Set(chain.slice(0, idx + 1));
  }
  switch (selectedLevel) {
    case 'end-to-end':
      // End-to-End is direction-agnostic: highlight every level on both forward
      // and reverse chains so the buttons in whichever column layout is currently
      // rendered (forward or reverse) all show the included/checkmark style.
      return new Set<WorkshopLevel>([
        'app-only', 'app-database', 'lakehouse', 'lakehouse-di',
        'reverse-lakehouse', 'reverse-lakehouse-di', 'reverse-lakebase', 'reverse-app',
        'end-to-end',
      ]);
    case 'accelerator':
      return new Set<WorkshopLevel>(['accelerator']);
    case 'genie-accelerator':
      return new Set<WorkshopLevel>(['genie-accelerator']);
    case 'data-engineering-accelerator':
      return new Set<WorkshopLevel>(['data-engineering-accelerator']);
    case 'skills-accelerator':
      return new Set<WorkshopLevel>(['skills-accelerator']);
    case 'agents-accelerator':
      return new Set<WorkshopLevel>(['agents-accelerator']);
    default:
      return new Set<WorkshopLevel>([selectedLevel]);
  }
}

/** "Workflow started": any step from Set Up Project (2) on is done. */
export function hasStartedWorkflow(completedSteps: Set<number>): boolean {
  return Array.from(completedSteps).some(s => s >= 2);
}

// Additive-selection gates. The "+" prefix levels are hard-disabled until
// their parent in the APP_CHAIN is highlighted/selected. Once Apps is
// selected, "+ Lakebase" unlocks; once Lakehouse is selected, "+ AI and
// Agents" unlocks. These gates apply only in forward direction — reverse
// chain deals with its own separate level set.
function additiveGate(level: WorkshopLevel, ctx: LevelLockContext): { disabled: boolean; tooltipBody?: string } {
  if (ctx.direction === 'reverse') return { disabled: false };
  if (ctx.useCaseLockedLevel) return { disabled: false };
  const highlightedButtons = getHighlightedButtons(ctx.selectedLevel, ctx.completedSteps, ctx.chainContext);
  if (level === 'app-database') {
    const appsSelected = highlightedButtons.has('app-only') || highlightedButtons.has('app-database');
    if (!appsSelected) {
      return { disabled: true, tooltipBody: 'Select Databricks Apps first to enable.' };
    }
  }
  if (level === 'lakehouse-di') {
    const lakehouseSelected = highlightedButtons.has('lakehouse') || highlightedButtons.has('lakehouse-di');
    if (!lakehouseSelected) {
      return { disabled: true, tooltipBody: 'Select Lakehouse first to enable.' };
    }
  }
  return { disabled: false };
}

/**
 * Resolve why a button is locked, in priority order. Returns null when the
 * button is enabled. The returned `reason` drives the LockedTooltip wording
 * so the user always knows whether this is an assistant restriction, a
 * use-case lock, an additive gate, or the standard "workflow started" lock.
 *
 * Grandfather rule: the currently-selected level is ALWAYS clickable, even
 * if it lives in `disabledWorkshopLevels`. This preserves shared sessions
 * (a session saved with `app-database` and a Cursor user, opened later by a
 * Genie Code user, still works) and prevents mid-session assistant changes
 * from silently mutating progress.
 */
export function computeLevelLockState(level: WorkshopLevel, ctx: LevelLockContext): LevelLockState | null {
  // Grandfather: current selection is always usable.
  if (level === ctx.selectedLevel) return null;

  // 1. Assistant restriction. Highest-priority message because it's the most
  //    likely cause of confusion when a user just switched assistants.
  if (ctx.disabledWorkshopLevels?.has(level)) {
    return { reason: 'assistant' };
  }

  // 2. Use-case lock pinned a specific level — every other level is locked.
  if (ctx.useCaseLockedLevel && level !== ctx.useCaseLockedLevel) {
    return { reason: 'use-case' };
  }

  // 3. Skills Accelerator is hidden once a non-skills use case is selected
  //    (the use-case lock above pins it directly when chosen).
  if (level === 'skills-accelerator' && !ctx.useCaseLockedLevel && ctx.hasUseCaseSelected) {
    return { reason: 'use-case' };
  }

  // 4. Additive gate ("+ Lakebase" needs Apps, "+ AI and Agents" needs
  //    Lakehouse). Friendlier wording than the generic locked tooltip.
  const additive = additiveGate(level, ctx);
  if (additive.disabled) {
    return { reason: 'workflow-started', title: 'Select prerequisite first', body: additive.tooltipBody };
  }

  // 5. Workflow-started path lock. Foundation steps complete -> only the
  //    active chain's current and next-step buttons remain clickable.
  if (hasStartedWorkflow(ctx.completedSteps)) {
    const activeChain = getActiveChain(ctx.selectedLevel, ctx.completedSteps, ctx.chainContext);
    if (activeChain) {
      const chainIdx = activeChain.indexOf(ctx.selectedLevel);
      const targetIdx = activeChain.indexOf(level);
      if (targetIdx === chainIdx) return null;
      if (targetIdx === chainIdx + 1) return null;
      return { reason: 'workflow-started' };
    }
    return { reason: 'workflow-started' };
  }

  return null;
}

/**
 * Which track tab (PathAndArchitecture, Mock B) shows a level: the Genie tab for
 * the Genie Accelerator, Other tracks for everything else. Reverse ETL has no
 * accelerators, so it is always Other tracks.
 */
export function trackTabForLevel(level: WorkshopLevel, direction: WorkflowDirection = 'forward'): 'genie' | 'other' {
  return level === 'genie-accelerator' && direction !== 'reverse' ? 'genie' : 'other';
}
