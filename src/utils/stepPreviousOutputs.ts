/**
 * Per-step previousOutputs builder for the Test Scenario tab.
 *
 * This file is consumed only by `src/components/config/TestScenarioConfig.tsx`
 * (the test tab) to drive the sequential Run All loop. The real workflow
 * uses inline `previousOutputs={...}` literals inside
 * `src/components/WorkflowDiagram.tsx` — those literals are the source of
 * truth.
 *
 * Keep this helper in sync with WorkflowDiagram.tsx. If you change a
 * per-step chaining rule there, mirror it here. If a step is not listed
 * here, it falls back to `undefined`, which matches the WorkflowStep's
 * default behavior (no chained context).
 */
import type { WorkshopLevel } from '../constants/workflowSections';

export interface GoldTableTarget {
  catalog: string;
  schema: string;
  prefix: string;
}

export interface PreviousOutputsCtx {
  goldTableTarget: GoldTableTarget;
  workshopLevel: WorkshopLevel;
}

function goldTableTargetString(t: GoldTableTarget): string {
  return `Catalog: ${t.catalog}, Schema: ${t.schema}${t.prefix ? `, Table Prefix: ${t.prefix}` : ''}`;
}

export function getPreviousOutputsForStep(
  stepNumber: number,
  stepPrompts: Record<number, string>,
  ctx: PreviousOutputsCtx,
): Record<string, string> | undefined {
  const { goldTableTarget, workshopLevel } = ctx;

  switch (stepNumber) {
    case 10:
      return stepPrompts[3] ? { prd_document: stepPrompts[3] } : undefined;

    case 11: {
      const isGenieStep11 = workshopLevel === 'genie-accelerator';
      if (isGenieStep11) {
        const out: Record<string, string> = {};
        if (stepPrompts[22]) out.table_metadata = stepPrompts[22];
        if (stepPrompts[3]) out.prd_document = stepPrompts[3];
        return Object.keys(out).length > 0 ? out : undefined;
      }
      return stepPrompts[10] ? { table_metadata: stepPrompts[10] } : undefined;
    }

    case 12: {
      // Mirrors WorkflowDiagram step 12 logic: prefers stepPrompts[10],
      // falls back to stepPrompts[22] (Genie silver metadata).
      const tableMetadata = stepPrompts[10] || stepPrompts[22] || '';
      return tableMetadata ? { table_metadata: tableMetadata } : undefined;
    }

    case 13:
      return stepPrompts[12] ? { synthetic_data: stepPrompts[12] } : undefined;

    case 14:
      return stepPrompts[11] ? { gold_layer_design: stepPrompts[11] } : undefined;

    case 15: {
      const out: Record<string, string> = {};
      if (stepPrompts[3]) out.prd_document = stepPrompts[3];
      if (stepPrompts[11]) out.gold_layer_design = stepPrompts[11];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 16: {
      const out: Record<string, string> = {};
      if (stepPrompts[3]) out.prd_document = stepPrompts[3];
      if (stepPrompts[11]) out.gold_layer_design = stepPrompts[11];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 17:
      if (workshopLevel === 'agents-accelerator') {
        const out: Record<string, string> = {};
        if (stepPrompts[3]) out.prd_document = stepPrompts[3];
        if (stepPrompts[10]) out.table_metadata = stepPrompts[10];
        return Object.keys(out).length > 0 ? out : {};
      }
      return stepPrompts[15] ? { usecase_plan: stepPrompts[15] } : undefined;

    case 18: {
      const out: Record<string, string> = {};
      if (stepPrompts[3]) out.prd_document = stepPrompts[3];
      if (stepPrompts[11]) out.gold_layer_design = stepPrompts[11];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 19:
      return stepPrompts[18] ? { agent_framework: stepPrompts[18] } : undefined;

    case 21:
      return stepPrompts[20] ? { iteration_plan: stepPrompts[20] } : undefined;

    case 26:
      return { gold_table_target: goldTableTargetString(goldTableTarget) };

    case 27: {
      const out: Record<string, string> = {
        gold_table_target: goldTableTargetString(goldTableTarget),
      };
      if (stepPrompts[26]) out.exploration_findings = stepPrompts[26];
      return out;
    }

    case 28: {
      const out: Record<string, string> = {
        gold_table_target: goldTableTargetString(goldTableTarget),
      };
      if (stepPrompts[27]) out.skill_strategy = stepPrompts[27];
      return out;
    }

    case 29: {
      const out: Record<string, string> = {
        gold_table_target: goldTableTargetString(goldTableTarget),
      };
      if (stepPrompts[28]) out.skill_definition = stepPrompts[28];
      return out;
    }

    case 30: {
      const out: Record<string, string> = {
        gold_table_target: goldTableTargetString(goldTableTarget),
      };
      if (stepPrompts[29]) out.applied_skill = stepPrompts[29];
      return out;
    }

    case 32: {
      const out: Record<string, string> = {};
      if (stepPrompts[11]) out.gold_layer_design = stepPrompts[11];
      if (stepPrompts[15]) out.usecase_plan = stepPrompts[15];
      if (stepPrompts[3]) out.prd_document = stepPrompts[3];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 34: {
      const out: Record<string, string> = {};
      if (stepPrompts[11]) out.gold_layer_design = stepPrompts[11];
      if (stepPrompts[3]) out.prd_document = stepPrompts[3];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 35: {
      const out: Record<string, string> = {};
      if (stepPrompts[34]) out.activation_app_design = stepPrompts[34];
      return Object.keys(out).length > 0 ? out : {};
    }

    case 38:
      // Step 38 has no previous-output literal in WorkflowDiagram; fall through.
      return undefined;

    case 39:
      return stepPrompts[38] ? { agent_spec_design: stepPrompts[38] } : undefined;

    case 40:
      return stepPrompts[39] ? { agent_tool_selection: stepPrompts[39] } : undefined;

    case 41:
      return stepPrompts[40] ? { uc_resources_foundation: stepPrompts[40] } : undefined;

    case 42:
      return stepPrompts[41] ? { mlflow_agent_tracing_uc: stepPrompts[41] } : undefined;

    case 43:
      return stepPrompts[42] ? { knowledge_assistant_create: stepPrompts[42] } : undefined;

    case 44:
      return stepPrompts[43] ? { track_a_agent_app_clone_framework: stepPrompts[43] } : undefined;

    case 45:
      return stepPrompts[44] ? { track_a_agent_ka_genie_tools: stepPrompts[44] } : undefined;

    case 46:
      return stepPrompts[45] ? { track_a_agent_auth_memory: stepPrompts[45] } : undefined;

    case 47:
      return stepPrompts[46] ? { track_a_agent_eval_deploy: stepPrompts[46] } : undefined;

    case 48:
      return stepPrompts[47] ? { appkit_agent_app_proxy_chat: stepPrompts[47] } : undefined;

    case 49:
      return stepPrompts[48] ? { appkit_chat_feedback_mlflow: stepPrompts[48] } : undefined;

    case 50:
      return stepPrompts[49] ? { mlflow_prompt_registry: stepPrompts[49] } : undefined;

    case 51:
      return stepPrompts[50] ? { mlflow_evaluation_datasets: stepPrompts[50] } : undefined;

    case 52:
      return stepPrompts[51] ? { mlflow_scorers_and_judges: stepPrompts[51] } : undefined;

    case 53:
      return stepPrompts[52] ? { mlflow_evaluation_runs_and_iteration: stepPrompts[52] } : undefined;

    case 54:
      return stepPrompts[53] ? { mlflow_human_review_and_signoff: stepPrompts[53] } : undefined;

    case 55:
      return stepPrompts[54] ? { mlflow_logged_model_uc_registration: stepPrompts[54] } : undefined;

    case 56:
      return stepPrompts[55] ? { mlflow_gateway_and_deployment: stepPrompts[55] } : undefined;

    default:
      return undefined;
  }
}
