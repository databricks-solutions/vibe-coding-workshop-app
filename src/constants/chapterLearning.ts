/**
 * Chapter Learning Content
 * 
 * Defines what the user learned in each chapter, displayed in the chapter completion popup.
 * Each entry includes:
 * - congratsTitle: The celebration headline
 * - summary: Brief intro sentence
 * - bullets: What you learned (displayed with typing animation)
 * - services: Databricks service keys that appear as clickable popovers in the text
 *   (keys must match serviceData in ServicePopover.tsx)
 */

import type { ServiceKey } from '../components/ServicePopover';

export interface ChapterLearning {
  congratsTitle: string;
  summary: string;
  bullets: string[];
  /** Databricks service keys referenced in this chapter. 
   *  These will be rendered as clickable service popovers in the completion popup. */
  services: ServiceKey[];
}

export const CHAPTER_LEARNING: Record<string, ChapterLearning> = {
  'Foundation': {
    congratsTitle: 'Foundation Complete!',
    summary: 'You have laid the groundwork for your project.',
    bullets: [
      'Selected an industry use case and configured your environment',
      'Generated a Product Requirements Document (PRD) using a coding assistant',
      'Established the foundation for your full-stack data application',
    ],
    services: [],
  },
  'Chapter 1': {
    congratsTitle: 'Databricks App Complete!',
    summary: 'You built and deployed a web application on Databricks.',
    bullets: [
      'Designed a user interface using a coding assistant',
      'Built and tested the UI locally',
      'Deployed your application as a Databricks App',
    ],
    services: ['databricksApp'],
  },
  'Chapter 2': {
    congratsTitle: 'Lakebase Complete!',
    summary: 'You added data persistence to your application.',
    bullets: [
      'Set up a Lakebase PostgreSQL database with DDL and seed data',
      'Wired the UI to read and write data from Lakebase',
      'Deployed and tested the full-stack application on Databricks Apps',
    ],
    services: ['lakebase', 'databricksApp'],
  },
  'Chapter 3': {
    congratsTitle: 'Lakehouse Complete!',
    summary: 'You built a complete data pipeline from operational to analytical.',
    bullets: [
      'Registered Lakebase as a read-only Unity Catalog database catalog',
      'Cloned source tables into Bronze layer with CDF and Asset Bundles',
      'Created Silver layer pipelines using Spark Declarative Pipelines (SDP)',
      'Designed and implemented Gold layer dimensional models',
      'Deployed assets using Databricks Asset Bundles',
    ],
    services: ['dataIngestion', 'bronze', 'silver', 'gold', 'sdp'],
  },
  'Chapter 4': {
    congratsTitle: 'Data Intelligence Complete!',
    summary: 'You turned raw data into actionable intelligence.',
    bullets: [
      'Created a use-case plan for data products',
      'Built Genie Spaces powered by Metric Views and TVFs',
      'Created AI/BI Dashboards for visual analytics',
      'Deployed assets to your workspace',
      'Optimized Genie Spaces for production use',
      'Built a Databricks Agent for conversational data access',
    ],
    services: ['genieSpaces', 'metricViews', 'tvf', 'aiBIDashboards', 'agents'],
  },
  'Refinement': {
    congratsTitle: 'Refinement Complete!',
    summary: 'You polished and finalized your application.',
    bullets: [
      'Iterated on features and enhanced the application',
      'Redeployed and tested the complete solution end-to-end',
    ],
    services: ['databricksApp'],
  },
  'Clean Up': {
    congratsTitle: 'Clean Up Complete!',
    summary: 'You safely removed all workshop resources from your workspace.',
    bullets: [
      'Identified all Databricks resources created during the workshop',
      'Safely deleted apps, databases, schemas, dashboards, and jobs',
      'Left your workspace clean and ready for the next project',
    ],
    services: [],
  },
};
