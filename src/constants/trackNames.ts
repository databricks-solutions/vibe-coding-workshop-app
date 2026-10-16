/**
 * One standalone name per workshop track, for text a learner reads or says
 * ("Start a workshop track: Databricks Apps + Lakebase"). The track picker's
 * BUTTON_LABELS are additive labels ("+ Lakebase") and stay as they are.
 *
 * Mirrors TRACK_DISPLAY_NAMES in src/backend/workshop/track_names.py, which the
 * MCP server matches names against (parity: tests/workshop/test_track_switch_parity.py).
 */

import type { WorkshopLevel } from './workflowSections';

export const TRACK_DISPLAY_NAMES: Record<WorkshopLevel, string> = {
  'app-only': 'Databricks Apps',
  'app-database': 'Databricks Apps + Lakebase',
  'lakehouse': 'Lakehouse',
  'lakehouse-di': 'Lakehouse + AI and Agents',
  'end-to-end': 'Complete Workshop',
  'accelerator': 'Data Product Accelerator',
  'genie-accelerator': 'Genie Accelerator',
  'data-engineering-accelerator': 'Data Engineering Accelerator',
  'skills-accelerator': 'Agent Skills Accelerator',
  'agents-accelerator': 'Agents Accelerator',
  'reverse-lakehouse': 'Reverse ETL: Lakehouse',
  'reverse-lakehouse-di': 'Reverse ETL: Lakehouse + AI and Agents',
  'reverse-lakebase': 'Reverse ETL: Lakebase (Synced)',
  'reverse-app': 'Reverse ETL: Analytics App',
};
