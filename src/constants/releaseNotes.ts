/**
 * Release Notes
 *
 * Single source of truth for the Release Notes page (/release-notes).
 * Newest release first.
 *
 * RELEASES[0].version must match the project-root VERSION file
 * (enforced by tests/test_release_notes_version.py).
 */

export type ReleaseItemCategory = 'new' | 'improved' | 'fix';

/** Who the change matters to: workshop users, or people deploying/administering the app. */
export type ReleaseItemAudience = 'attendee' | 'installer';

/** Icon keys resolved to lucide icons in ReleaseNotesPage. Defaults to a per-category icon. */
export type ReleaseItemIcon =
  | 'sparkles'
  | 'palette'
  | 'diagram'
  | 'shield'
  | 'route'
  | 'cpu'
  | 'database'
  | 'rocket'
  | 'wrench'
  | 'terminal'
  | 'search';

export interface ReleaseItem {
  title: string;
  description: string;
  category: ReleaseItemCategory;
  audience?: ReleaseItemAudience;
  icon?: ReleaseItemIcon;
}

export interface Release {
  version: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  title: string;
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    version: '2.3.0',
    date: '2026-09-21',
    title: 'Genie Accelerator track',
    items: [
      {
        title: 'Genie Accelerator workshop track',
        description:
          'A new 17-step track that takes you from a Semantic Layer to a Genie Agent, a Genie Ontology, and finally Activate & Productionize. It comes with a ~260 minute path, its own architecture diagram, and chapter blocks.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Brand-aware app generation',
        description:
          "Generated apps now pick up your company's color palette and logo, with sensible fallbacks when only a URL (or no brand info) is available.",
        category: 'new',
        audience: 'attendee',
        icon: 'palette',
      },
      {
        title: 'Mermaid diagrams render inline',
        description:
          'Mermaid code blocks in step content now render as diagrams instead of raw text, and fall back to the source if a diagram cannot be drawn.',
        category: 'improved',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Stronger design-quality checks',
        description:
          'The app-design and build prompts now include a visual and brand rubric and catch unthemed styles or a missing logo before you move on.',
        category: 'improved',
        audience: 'attendee',
        icon: 'sparkles',
      },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-09-07',
    title: 'Genie Code everywhere and Free Edition support',
    items: [
      {
        title: 'Reverse ETL and End-to-End paths for Genie Code',
        description:
          'Genie Code users can now take the Reverse ETL (Lakebase and App) paths and the full End-to-End workshop path.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Works with every Databricks-served model',
        description:
          'PRD generation now works across Claude, Llama, Gemma, GPT-OSS, and Qwen endpoints and falls back to another endpoint automatically, so the workshop runs on Databricks Free Edition.',
        category: 'new',
        audience: 'attendee',
        icon: 'cpu',
      },
      {
        title: 'Hardened Reverse ETL prompts',
        description:
          'Reverse ETL prompts now use the correct synced-tables API, introspect the synced schema before wiring the app, and include your user prefix in job names to avoid collisions in shared workspaces.',
        category: 'improved',
        audience: 'attendee',
        icon: 'database',
      },
      {
        title: 'Deploys work on OAuth-federated workspaces',
        description:
          'Deploys now use the direct bundle engine instead of Terraform, fixing "received HTML response instead of JSON" failures on workspaces that use OAuth token federation (for example Azure AD).',
        category: 'fix',
        audience: 'installer',
        icon: 'rocket',
      },
      {
        title: 'Confirmation before destructive redeploys',
        description:
          'If a deploy would recreate your Lakebase instance, the installer now stops and asks for a typed YES (or --yes) instead of failing or silently destroying data.',
        category: 'improved',
        audience: 'installer',
        icon: 'shield',
      },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-07-23',
    title: 'Install and deploy reliability',
    items: [
      {
        title: 'New industries can get use cases',
        description:
          'Newly created industries now appear in Configuration right away, are auto-selected, and show a guided "Build your first use case" state.',
        category: 'fix',
        audience: 'installer',
        icon: 'wrench',
      },
      {
        title: 'Installs work on more networks and Python setups',
        description:
          'Installs no longer depend on an internal npm proxy, work with externally managed Python (Homebrew, recent Debian/Ubuntu), and install databricks-sdk automatically when it is missing.',
        category: 'fix',
        audience: 'installer',
        icon: 'terminal',
      },
      {
        title: 'Clearer errors and a more honest uninstall',
        description:
          'The Windows prerequisite check now names bash.exe and the PATH issue explicitly, and uninstall reports each step by its real result, retries transient failures, and keeps your config if teardown is incomplete.',
        category: 'improved',
        audience: 'installer',
        icon: 'terminal',
      },
      {
        title: 'Lakebase project name pre-check',
        description:
          'Before a full deploy, the installer detects autoscaling Lakebase project names that are still reserved after deletion and suggests a free one.',
        category: 'new',
        audience: 'installer',
        icon: 'search',
      },
    ],
  },
];
