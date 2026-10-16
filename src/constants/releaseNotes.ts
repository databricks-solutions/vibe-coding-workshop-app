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
  /** Feature is shipped but still in beta; shown with a Beta badge. */
  beta?: boolean;
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
    version: '2.8.0',
    date: '2026-10-15',
    title: 'Run the workshop from Genie Code',
    items: [
      {
        title: 'Run any workshop track from Genie Code',
        description:
          'Add the app as a custom MCP server in Genie Code (the app URL followed by /mcp) and say "Start the Genie Accelerator". Genie Code then walks you through the track one step at a time, showing each prompt and waiting for you to run it. Your progress is saved on the server, so you can switch between Genie Code and the web app at any point.',
        category: 'new',
        audience: 'attendee',
        icon: 'terminal',
      },
      {
        title: 'A coach inside Genie Code',
        description:
          'Ask what to do now, why a step matters, why you are stuck, or for a recap of what you have built. The coach answers in one short paragraph grounded in your own session, with a table or diagram where it helps.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'New sessions start on the Genie Accelerator, with the Genie Ontology',
        description:
          'Every new session now starts on the Genie Accelerator, whichever coding assistant you pick, with the Genie Ontology chapter included. A recommended card at the top of the path picker holds the Include Genie Ontology and Include Lakehouse options. If your workspace has no Genie One Pages, untick the ontology in the web app, or say "skip the ontology" in Genie Code. Existing sessions keep their saved path.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
        beta: true,
      },
      {
        title: 'The ontology chapter comes before the app',
        description:
          'Model the Domain, Author Pages and Write the Routing Page now follow the AI/BI Dashboard, before Choose What to Activate and the Lakebase and app steps. In Genie Code, the two Page steps you do in the Databricks UI ask you to confirm the Page is published before they complete.',
        category: 'improved',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Steps always run in order',
        description:
          'A step can no longer be skipped by accident. Each one becomes available only after the one before it is done, and your use case is chosen before the PRD step.',
        category: 'improved',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Faster step hand-offs in Genie Code',
        description:
          'Genie Code now prepares the next step’s prompt while you work on the current one, so finishing a step such as Set Up Project no longer waits 20–40 seconds for the next prompt.',
        category: 'improved',
        audience: 'attendee',
        icon: 'rocket',
      },
      {
        title: 'Sessions reopen in the view you left',
        description:
          'Each session remembers whether you were in Insights or the Technical workflow. Insights sessions started before this release reopen in Technical once; click Insights and it is remembered from then on.',
        category: 'fix',
        audience: 'attendee',
      },
      {
        title: 'New app settings for facilitators',
        description:
          'app.yaml gains MCP_MOUNT_ENABLED (the Genie Code MCP server, on by default), VIBE_DEFAULT_GENIE_ONTOLOGY (set "false" if the workspace has no Genie One Pages), VIBE_STEP_PROMPT_PREFETCH, and the coach’s VIBE_COACH_ENDPOINT and VIBE_COACH_BUDGET_S. The facilitator guide lists each one with its default.',
        category: 'new',
        audience: 'installer',
        icon: 'wrench',
      },
      {
        title: 'Upgrades keep your data',
        description:
          'The table step is now additive by default: it creates what is missing and adds new prompt rows to an existing install, and it never overwrites rows you have edited. A destructive rebuild needs an explicit opt-in. Run the table step before deploying this release.',
        category: 'improved',
        audience: 'installer',
        icon: 'database',
      },
      {
        title: 'Dependency security fixes',
        description: 'Updated dependencies clear every high-severity advisory in the app’s packages.',
        category: 'fix',
        audience: 'installer',
        icon: 'shield',
      },
    ],
  },
  {
    version: '2.7.0',
    date: '2026-10-15',
    title: 'The climb, saved ideas, points and leaderboard seasons',
    items: [
      {
        title: 'Your ideas are saved and follow you',
        description:
          'Ideas are now saved to your account, so they follow you across browsers. Each idea earns Idea Points on the server for the journey steps you finish, an AI quality judge and its outcome, with tiers and a scorecard.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'The journey is drawn as a climb',
        description:
          'The idea journey now opens on a trailhead scene and climbs to a summit flag, with a compact trail in each step header and celebrations at milestones. Named Back and Next buttons sit at the top of every step, and the trail dots show their step on hover.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Value and feasibility planning',
        description:
          'After you pick your data, a value-vs-feasibility matrix places the build in one of four quadrants, such as Quick win or Strategic bet, with confidence ranges and a portfolio comparison. Each axis comes with concrete actions that raise it, and the evidence is saved into the build brief.',
        category: 'new',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Leaderboard seasons and an Insights leaderboard',
        description:
          'Facilitators can archive, reset and restore both leaderboards by season without deleting anything, and Insights builds now have a leaderboard of their own.',
        category: 'new',
        audience: 'installer',
        icon: 'database',
      },
      {
        title: 'Builds that promise an app always include it',
        description:
          'When the chosen approach promises an app, its app, Lakebase write-back, embedded Genie and deployment steps are always part of the build and can no longer disappear. If a required step is unavailable, Start stops with a clear error instead of quietly dropping it.',
        category: 'improved',
        audience: 'attendee',
        icon: 'wrench',
      },
      {
        title: 'Clearer idea steps',
        description:
          'An approved idea now shows its business case, quality score and next actions in one place and goes straight on to choosing data in Insights. Blueprint results appear only once matching has finished, clarification questions allow one or several answers as fits the question, and loading screens show animated art instead of a blank space.',
        category: 'improved',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'A notice when a newer version is deployed',
        description:
          'If the app is redeployed while you have it open, a notice on every page asks you to reload. Your saved progress is kept.',
        category: 'improved',
        audience: 'attendee',
        icon: 'rocket',
      },
      {
        title: 'Sonnet 5.5 is the default model',
        description:
          'New deployments default to Claude Sonnet 5.5, falling back to Sonnet 4.6 and then 4.5 before the open models. Deployments that set DATABRICKS_SERVING_ENDPOINT keep their own model.',
        category: 'improved',
        audience: 'installer',
        icon: 'cpu',
      },
      {
        title: 'The completed trail line draws correctly',
        description: 'The completed part of the trail no longer shows as broken dashes.',
        category: 'fix',
        audience: 'attendee',
      },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-10-13',
    title: 'Insights follows the Genie Accelerator',
    items: [
      {
        title: 'Insights builds follow the Genie Accelerator',
        description:
          'Every Insights step now uses the Genie Accelerator prompt for that step and links to the Accelerator skill it follows in the Skills Navigator. Optional add-ons can join a build without changing the four chapters: map your business domain (Ontology), alerts on your governed metrics, view your data in an app, or a copilot app that saves to Lakebase with Genie inside it. Optional steps can be skipped. The add-ons stay off until each one has been verified.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
        beta: true,
      },
      {
        title: 'Ideate: every approach shows what it builds, and comes with Genie',
        description:
          'Approach cards now say up front what you will get: a Genie space and a dashboard, an app with Genie inside it, or an agent with an app, Genie and a dashboard, plus a question people could ask. Genie is only left out with a stated reason, and the brief and the build carry it through. Cards no longer spill outside their border.',
        category: 'improved',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'Go back to the idea, change an answer, then update the build',
        description:
          'A Back link sits at the top of every idea step, and the build bar has "Back to the idea" in both Ideate and Insights. Changing an approved answer reopens the steps after it for a quick re-check; the build keeps working until you choose Update build. Insights projects now always show the idea they were built from.',
        category: 'improved',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Ideate samples for Retail, CPG and Airlines',
        description:
          'The Ideate home has a Samples section: three finished ideas from the use case library, with every step and the business case filled in. Walk through one read-only, or choose Make it mine to copy it into My ideas.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'Business case 1-pager button',
        description:
          'The business case 1-pager has a clear, glowing button on the idea, so it is easy to find and open.',
        category: 'improved',
        audience: 'attendee',
        icon: 'palette',
      },
      {
        title: 'Genie Accelerator first, with its options grouped under it',
        description:
          'Genie Accelerator is now first in the Accelerators list. "Include Lakehouse" and "Include Genie Ontology" sit directly under it instead of below the Agents Accelerator, and the architecture diagram has a lighter look that matches the rest of the app.',
        category: 'improved',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Turn on Insights add-ons one at a time',
        description:
          'New INSIGHTS_BUILD_RECIPES setting in app.yaml (blank by default; a comma list of ontology, alerts, app_view, copilot, or all). Testers can preview in their own browser with ?recipes=all. The Insights-only prompts are added with scripts/apply_prompt_versions.py, which appends new versions through the config API (dry run by default) and never reseeds.',
        category: 'new',
        audience: 'installer',
        icon: 'wrench',
      },
    ],
  },
  {
    version: '2.5.0',
    date: '2026-10-11',
    title: 'Insights: a questions-first path to a Genie and a dashboard',
    items: [
      {
        title: 'Insights: a simpler path from questions to a Genie and a dashboard',
        description:
          'A new Technical / Insights switch in the header. Insights is a shorter workflow for analysts: write the questions you wish you could ask your data, pick where the data comes from (existing tables, a file, sample data, or a ready-made industry model), name it, and the Genie Accelerator chapters build a Genie space your team can chat with, plus a matching dashboard. "Compare paths" shows how the two views line up. Progress is shared with the session, and ?view=insights in the link opens the view directly.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'Start Insights from a sample or an approved use case',
        description:
          'On the Ask step, "Start from an approved use case" lists the Samples collection alongside every industry, with counts on each tab, search, and a Certified only filter. The first use case opens straight away, showing who it is for, the data it covers, and the questions it was built to answer; tick the ones you want and your project is linked to that use case. Use cases shared from another collection show where they came from.',
        category: 'new',
        audience: 'attendee',
        icon: 'search',
      },
      {
        title: 'Industry data models for Insights',
        description:
          'The Data step can install a model from the Databricks Industry Solutions data-model gallery: tables, connections, sensitive-field labels, and KPI views, filled with realistic sample rows. Each model is installed once per workspace into a shared idm_ catalog with read access for everyone. Approved use case previews can be turned off with INSIGHTS_USECASES_ENABLED=false.',
        category: 'new',
        audience: 'installer',
        icon: 'database',
      },
      {
        title: 'The industry data model is matched to your use case',
        description:
          'The Data step recommends the model that fits your idea and says why, and only shows an installed model when it is that one. On the model screen the AI reads your brief, lists the data your use case needs, and maps each need to the model\'s areas and tables or names it as a gap (for example ground staff shifts in the Airlines model). It picks several areas, core and supporting, with a reason for each, instead of only the areas your questions happened to land in. A word-based pick shows instantly while the AI thinks, and your own edits are never overwritten.',
        category: 'improved',
        audience: 'attendee',
        icon: 'database',
      },
      {
        title: 'Ideas always reopen their build',
        description:
          'Opening an idea whose project was never saved now starts a fresh project for it at the Data step instead of the Insights start screen. The idea is only relinked when the database confirms the project is gone, never when it is just unreachable. Code-only deploys also fill in the Lakebase host when app.yaml has it blank, so a regenerated app.yaml can no longer leave the app running without its database.',
        category: 'fix',
        audience: 'installer',
        icon: 'wrench',
      },
      {
        title: 'Ideate: a business case sized like a finance partner would',
        description:
          'The "What could it be worth?" step now sizes the pilot, then scales it to the full rollout, adds up to two more value levers, and counts time saved at a capture rate so hard and soft dollars stay separate. Every question has a best guess and a running estimate. The business case is an executive page (value, the pilot ask, payback, cost of waiting, go and stop criteria) plus an appendix with scenarios, inputs, costs, and a three-year view. Approved use cases show what they are typically worth, and ideas started from them begin from those numbers.',
        category: 'improved',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'From an idea to a build in one click',
        description:
          'Clarify, Shape, Impact, and the Genie questions step now offer a recommended option with the reason, keyboard shortcuts, and multi-select where it fits. Picking an answer only highlights it; Next (or Enter) saves it and moves on, and "Your answers so far" lets you check and change earlier answers. "I\'m ready to build" opens a new project linked to the idea: insight ideas land on the Insights data step, copilots and automations on the Technical workflow with the use case filled in. "Build later" parks it, and My ideas shows what is building, sorted by value.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'One light and dark setting, in the sidebar',
        description:
          'Appearance now lives at the bottom of the left sidebar on every page and applies across the whole app before the page draws, so Ideate, the Library, and Configuration no longer switch back. The Workflow page opens on the Technical view unless the session is an Insights one, and starting a new session always goes to Technical.',
        category: 'fix',
        audience: 'attendee',
        icon: 'palette',
      },
      {
        title: 'Separate model for the analysis steps',
        description:
          'Set app.analysis_endpoint in user-config.yaml (IDEATE_ANALYSIS_ENDPOINT) to run the Impact and summary steps on a stronger model; the step says when a fallback model answered. Use case value profiles are stored in a new usecase_value_profiles table that the app creates on first use (also in db/lakebase/ddl/13_usecase_value_profiles.sql).',
        category: 'new',
        audience: 'installer',
        icon: 'cpu',
      },
    ],
  },
  {
    version: '2.4.0',
    date: '2026-10-09',
    title: 'Ideate (Beta), a new Learning Academy, and a cleaner sidebar',
    items: [
      {
        title: 'Ideate: shape a raw idea into a decision-ready brief',
        description:
          'A new Ideate section in the left nav. Speak or type a rough idea, and the AI walks you through short steps: Spark, Industry Map, Clarify, Shape, an optional Impact step, and Brief. It asks the questions, you pick the answers, and nothing moves on without your approval. Ideas are saved in your browser. This feature is in beta, so expect changes.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
        beta: true,
      },
      {
        title: 'Business case you can download and submit',
        description:
          'The optional Impact step asks three or four quick questions about time, frequency, and people, with "estimate for me" and skip options. From the Brief, open a two-page business case with annual value, first-year cost, return, payback, and cautious, expected, and upside scenarios, then download it as a PDF. Committed ideas can be submitted to the use case map; they land in the Use Case Library\'s Needs review queue, hidden until an admin approves them. Spark now names the specific industry, such as Airlines rather than Aviation.',
        category: 'new',
        audience: 'attendee',
        icon: 'rocket',
        beta: true,
      },
      {
        title: 'New Learning Academy (formerly Agent Skills Navigator)',
        description:
          'The Agent Skills Navigator is now the Learning Academy, right after Workflow in the sidebar: one place to learn how AI agents build on Databricks, then do it yourself. It has four tabs. Map shows the five tracks and how their skills fit together. Tours walk you through a build step by step. Lessons are short reads on the building blocks, each with a quiz, with progress saved in your browser. Skills lists every skill with filters and a ready-made prompt to copy. Details open only when you ask for them, ⌘K or / searches everything, and every view, tour step, and skill has a shareable link. Existing links keep working. In each Workflow step, the tab that shared the old name is now called Skill Blueprint.',
        category: 'new',
        audience: 'attendee',
        icon: 'route',
      },
      {
        title: 'Latest skills from the workshop template',
        description:
          'The Learning Academy is synced with the latest Databricks workshop template: 108 skills across five tracks, including the new Agents + MLflow and Genie Accelerator tracks, two new guided tours (App to Agent, and Data to Genie Agent), and five new lessons. A "What\'s new" note on the Map links straight to them.',
        category: 'new',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Repeatable Learning Academy content sync',
        description:
          'Run node scripts/sync_skills_navigator.mjs to pull Learning Academy content from the template repo at a pinned commit (--ref to choose one, --check to verify without writing). It checks that every skill, tour, and lesson reference resolves before regenerating the data file, and records what changed for the "What\'s new" note.',
        category: 'new',
        audience: 'installer',
        icon: 'terminal',
      },
      {
        title: 'Built-in reviewer and gap check',
        description:
          'Every Ideate step has "Challenge me" for a reviewer\'s pushback and "Change something" for voice or text edits. The brief adds a Clarity score, a six-dimension gap check with one-click fixes, assumption tracking, and Given/When/Then test scenarios.',
        category: 'new',
        audience: 'attendee',
        icon: 'search',
        beta: true,
      },
      {
        title: 'Use Case Library',
        description:
          'Use case descriptions moved out of Configuration into their own Use Case Library page under Admin. Use cases are grouped into collections: industries, business functions such as the Office of the CFO, and technical solutions. A use case can appear in more than one collection, and any collection or use case can be switched off. The Library has a coverage map, a board and list view per collection, search (⌘K), version history, and a review queue for ideas submitted from Ideate.',
        category: 'new',
        audience: 'installer',
        icon: 'database',
      },
      {
        title: 'Explore use cases by industry or business function',
        description:
          'When picking a use case, an Explore by switch lets you browse by industry or by business function when an admin has turned on functions. Cards that come from another collection show where they came from, and every card now shows its features.',
        category: 'improved',
        audience: 'attendee',
        icon: 'diagram',
      },
      {
        title: 'Full CPG and Retail outcome maps, plus Office of the CFO, CMO, COO and CHRO plays',
        description:
          'CPG and Retail now have full build specs laid out like Travel & Hospitality (Operations, Revenue, Customer and Workforce columns), and Travel gains a Workforce column. Each business-function office has four Genie-led plays (a Genie space, a cockpit, a forecast and an agent) plus the matching industry cards. The offices ship switched off; turn them on from the Library.',
        category: 'new',
        audience: 'attendee',
        icon: 'sparkles',
      },
      {
        title: 'Redesigned left navigation',
        description:
          'The sidebar is now organized into Workshop (Workflow, Learning Academy, Leaderboard, Hackathons, Ideate) and Admin (Use Case Library, Analytics, Configuration) groups, with a pinned Resources section for the repository template, Databricks docs, feature requests, and Release Notes. The app version and connection status moved to the footer, and desktop and mobile now share the same navigation.',
        category: 'improved',
        audience: 'attendee',
        icon: 'palette',
      },
    ],
  },
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
