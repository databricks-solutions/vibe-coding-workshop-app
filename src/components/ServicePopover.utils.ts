// Databricks service definitions shared by ServicePopover, TypingText and
// CelebrationOverlay. Kept out of ServicePopover.tsx so that file only exports
// components (react-refresh/only-export-components).

export interface ServiceQuickQuestion {
  label: string;
  question: string;
}

/** One benefit or watch-out: a short plain-English headline plus one sentence on why it matters. */
export interface ServicePoint {
  title: string;
  detail: string;
}

/**
 * Popover copy is written for people new to Databricks: `badge`, `summary`,
 * `useWhen`, `benefits` and `limitations` use plain words with no code, YAML
 * keys or unexplained acronyms. `description` keeps the technical detail for the
 * chat modal header and the LLM system prompt.
 */
export interface ServiceInfo {
  name: string;
  /** One or two plain words shown in the popover header (e.g. 'Semantic layer'). */
  badge?: string;
  /** "What it is": one sentence, max ~25 words. */
  summary: string;
  /** "Use it when": one sentence tied to a real situation. */
  useWhen: string;
  description: string;
  benefits: ServicePoint[];
  limitations: ServicePoint[];
  docUrl: string;
  docLabel: string;
  /** Optional service-specific quick questions shown in the embedded AI chat. */
  quickQuestions?: ServiceQuickQuestion[];
}

// =============================================================================
// SERVICE DATA - All Databricks services & sub-chips (2026 Documentation)
// =============================================================================

export const serviceData: Record<string, ServiceInfo> = {
  databricksApp: {
    name: 'Databricks Apps',
    badge: 'App hosting',
    summary:
      'A way to build and run your own web apps directly inside Databricks, with no separate servers to manage.',
    useWhen:
      'You want to give business users a custom tool or screen on top of your Databricks data and AI.',
    description:
      'Build, host, and deploy custom full-stack web applications (React, FastAPI, Python, Node.js) directly on serverless Databricks compute. Apps inherit Unity Catalog governance, workspace SSO, and on-behalf-of-user OAuth.',
    benefits: [
      { title: 'No servers to manage', detail: 'Databricks hosts and scales the app for you, so there is no outside infrastructure to run.' },
      { title: 'Sign-in is built in', detail: 'Users log in with their workspace account, and the app can act with their permissions.' },
      { title: 'Connects to your data and AI', detail: 'Apps talk directly to Lakebase databases, Genie, and AI models in your workspace.' },
    ],
    limitations: [
      { title: 'Supported languages only', detail: 'Apps run on supported Python and Node.js versions, within set size and memory limits.' },
      { title: "Local files don't last", detail: "Files saved on the app's own disk are lost on restart; store data in Lakebase or Unity Catalog." },
      { title: 'Acting as the user needs setup', detail: "To use each person's permissions, list the access the app needs in its config file." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/',
    docLabel: 'Databricks Apps Documentation',
    quickQuestions: [
      {
        label: '🔐 How do users sign in to an app?',
        question: 'How do Databricks Apps authenticate users with X-Forwarded-Access-Token and connect to Lakebase Postgres and Unity Catalog?',
      },
      {
        label: '🚀 How do I deploy my first app?',
        question: 'How do I configure app.yaml and deploy a React + FastAPI Databricks App using Databricks Asset Bundles?',
      },
    ],
  },

  lakebase: {
    name: 'Lakebase (PostgreSQL)',
    badge: 'App database',
    summary:
      'A fully managed Postgres database inside Databricks, built for the fast, everyday reads and writes apps need, like saving orders or user profiles.',
    useWhen:
      'Your app needs to store and update individual records instantly, not just analyze data in bulk.',
    description:
      'Fully managed, autoscaling PostgreSQL (Postgres 16–18) built into Databricks on the LTAP architecture. Separates stateless compute from durable storage to power sub-10ms transactional app backends, synced analytics serving, and agent state.',
    benefits: [
      { title: 'Instant responses for apps', detail: 'Reads and writes typically finish in under 10 milliseconds, with full transaction safety.' },
      { title: 'Scales on its own', detail: 'Capacity grows and shrinks with demand, and you can copy a database instantly for testing.' },
      { title: 'Connected to your analytics', detail: 'Register it in Unity Catalog and sync curated analytics tables in for your app to use.' },
    ],
    limitations: [
      { title: 'Not built for big reports', detail: 'It is designed for quick lookups and updates; run heavy analysis in the lakehouse instead.' },
      { title: 'One catalog per database', detail: 'Each Unity Catalog catalog you register maps to exactly one Lakebase database.' },
      { title: 'Synced copies are read-only', detail: "Tables synced in from the lakehouse can't be edited here; change them at the source." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/',
    docLabel: 'Lakebase Postgres Documentation',
    quickQuestions: [
      {
        label: '⚡ How does Lakebase connect to my analytics data?',
        question: 'How does Lakebase integrate with Unity Catalog via database registration and Synced Tables in the LTAP architecture?',
      },
      {
        label: '⚠️ What limits should I plan for?',
        question: 'What are the key connection limits, autoscaling behaviors, and OLTP vs OLAP considerations when using Lakebase?',
      },
    ],
  },

  dataIngestion: {
    name: 'Data Ingestion Pipeline',
    badge: 'Data ingestion',
    summary:
      'Moves data from your app database (or other sources) into the lakehouse, so it can be cleaned and analyzed.',
    useWhen:
      'Day-to-day data lives in an app database and you want to report on it or feed it to AI.',
    description:
      'Bridge operational data from Lakebase Postgres (or external sources) into the Lakehouse. Register your Lakebase database as a read-only Unity Catalog catalog, then ingest operational changes into Bronze Delta tables using Change Data Feed (CDF) and Lakeflow.',
    benefits: [
      { title: 'See app data without copying', detail: 'Register your Postgres database in Unity Catalog and browse its tables right away.' },
      { title: 'Join live and historical data', detail: 'Query app tables and lakehouse tables together in a single SQL statement.' },
      { title: 'Only move what changed', detail: 'After the first load, only new and updated rows flow in, keeping runs fast and cheap.' },
    ],
    limitations: [
      { title: 'Registered data is read-only', detail: 'You can query the registered database from Databricks, but not write to it.' },
      { title: 'The first load can be heavy', detail: 'Copying very large tables the first time takes time and resources, so plan for it.' },
      { title: 'Needs serverless compute', detail: 'Querying the registered database requires a serverless SQL warehouse or serverless compute.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/register-uc',
    docLabel: 'Lakebase UC Registration Docs',
    quickQuestions: [
      {
        label: '🔗 How do I bring app data into the lakehouse?',
        question: 'How do I register a Lakebase Postgres database in Unity Catalog and ingest its tables into the Bronze layer?',
      },
      {
        label: '⚠️ What compute do I need?',
        question: 'What are the compute requirements and read-only rules when querying a registered Lakebase catalog in Unity Catalog?',
      },
    ],
  },

  bronze: {
    name: 'Bronze Layer',
    badge: 'Raw data',
    summary:
      'The first layer of your lakehouse, where data lands exactly as it arrived, before any cleanup.',
    useWhen:
      'You need a safe, complete copy of source data that later steps can always rebuild from.',
    description:
      'The raw landing zone of the Medallion Lakehouse architecture. Bronze Delta tables capture operational snapshots and append-only change streams exactly as received, with Change Data Feed (CDF) enabled for downstream incremental processing.',
    benefits: [
      { title: 'Complete, auditable history', detail: 'Every raw record is kept, and you can look back at earlier versions of a table.' },
      { title: 'Tracks every change', detail: "Each insert, update, and delete is recorded, so later layers process only what's new." },
      { title: 'Protects source systems', detail: 'Analysis runs on this copy, so it never slows down the apps that produced the data.' },
    ],
    limitations: [
      { title: 'The data is messy', detail: 'Expect duplicates, bad values, and source-specific formats; clean them in the Silver layer.' },
      { title: 'Not for business users', detail: 'Never point Genie or dashboards at Bronze tables; use curated Gold tables instead.' },
      { title: 'Storage keeps growing', detail: "Set retention and cleanup rules so old raw files don't pile up." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '🔄 Why track changes in Bronze?',
        question: 'Why is Change Data Feed (CDF) important on Bronze tables and how do downstream pipelines consume it?',
      },
      {
        label: '⚠️ What should I avoid in Bronze?',
        question: 'What transformations or query patterns should be avoided in the Bronze layer of a medallion architecture?',
      },
    ],
  },

  silver: {
    name: 'Silver Layer',
    badge: 'Cleaned data',
    summary:
      'The second layer of your lakehouse, where raw data is checked, de-duplicated, and standardized into one reliable record per item.',
    useWhen:
      'You need trustworthy records (one per customer, order, or product) before building reports.',
    description:
      'Validated, deduplicated, and conformed enterprise data built with Spark Declarative Pipelines (SDP). Silver tables enforce data quality expectations, resolve data types, and apply SCD Type 1/2 merges via AUTO CDC.',
    benefits: [
      { title: 'Built-in quality checks', detail: 'Set rules for bad data and choose to warn, drop the row, or stop the pipeline.' },
      { title: 'Handles duplicates and late data', detail: 'Records that arrive twice or out of order are merged into one correct, current version.' },
      { title: 'Keeps history when you need it', detail: 'Either overwrite changes or keep a full history of how each record changed.' },
    ],
    limitations: [
      { title: 'Not shaped for reports yet', detail: 'Data is organized by item, not by business metric; shape it for reporting in Gold.' },
      { title: 'Strict rules can stop runs', detail: 'If you choose to stop on bad data, an unexpected upstream change can halt the pipeline.' },
      { title: 'History needs filtering', detail: 'Tables that keep change history must be filtered to the current record in later steps.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '🛡️ How do quality checks work in Silver?',
        question: 'How do data quality expectations and AUTO CDC flows work when building Silver tables in Spark Declarative Pipelines?',
      },
      {
        label: '⚠️ What should happen to bad records?',
        question: 'When should I use WARN vs DROP ROW vs FAIL UPDATE for data quality expectations in the Silver layer?',
      },
    ],
  },

  gold: {
    name: 'Gold Layer',
    badge: 'Business-ready',
    summary:
      'The final layer of your lakehouse: clean, business-friendly tables organized around how your company measures itself.',
    useWhen:
      "You're ready to power metrics, dashboards, Genie, or apps with trusted data.",
    description:
      'Business-ready dimensional models (star/snowflake schemas of fact and dimension tables) and curated aggregates in Unity Catalog. Rich table/column COMMENTs and PK/FK constraints make Gold the foundation for Metric Views, Genie, Dashboards, and Synced Tables.',
    benefits: [
      { title: 'Organized for business questions', detail: 'Tables hold events (like sales) and the things they describe (like customers or products).' },
      { title: 'Descriptions make AI smarter', detail: 'Clear table and column descriptions help Genie understand your data and answer correctly.' },
      { title: 'Feeds everything downstream', detail: 'Metric views, dashboards, Genie, and apps all build on these tables.' },
    ],
    limitations: [
      { title: 'Vague descriptions hurt accuracy', detail: 'Missing or unclear column descriptions lead Genie to wrong answers.' },
      { title: 'Summaries lose detail', detail: "Pre-summarized tables can't answer row-level questions unless you keep the detailed table too." },
      { title: 'Changes ripple downstream', detail: 'Renaming or removing columns can break the metric views, dashboards, and apps built on top.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '⭐ How should I design Gold tables for metrics?',
        question: 'How should I design Gold fact and dimension tables, PK/FK constraints, and comments to power Unity Catalog Metric Views and Genie?',
      },
      {
        label: '🔄 How do Gold tables reach my app?',
        question: 'What makes a Gold table a good candidate for reverse-ETL into Lakebase via Synced Tables?',
      },
    ],
  },

  sdp: {
    name: 'Spark Declarative Pipelines (SDP)',
    badge: 'Data pipelines',
    summary:
      'A framework for building data pipelines by describing the tables you want, while Databricks works out how and when to build them.',
    useWhen:
      'You need to move and clean data through Bronze, Silver, and Gold, in batches or continuously.',
    description:
      'Declarative framework for batch and streaming ETL in SQL and Python (`from pyspark import pipelines as dp`). Lakeflow pipelines extend Apache Spark Declarative Pipelines with AUTO CDC, data quality expectations, and a queryable event log.',
    benefits: [
      { title: 'Describe the result, not the steps', detail: 'Write simple SQL or Python for each table; ordering and dependencies are handled for you.' },
      { title: 'Quality rules built in', detail: 'Add data quality checks right next to each table definition.' },
      { title: 'Handles changing records', detail: 'Built-in change handling merges updates and late-arriving data correctly.' },
    ],
    limitations: [
      { title: 'A different way of thinking', detail: 'You define what each table should contain, rather than writing step-by-step code.' },
      { title: 'Some features are Databricks-only', detail: 'Change handling and quality checks go beyond the open-source version of the framework.' },
      { title: 'Pick the right table type', detail: 'Streaming tables and materialized views behave differently; choose based on how data arrives.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/ldp/',
    docLabel: 'Spark Declarative Pipelines on Lakeflow',
    quickQuestions: [
      {
        label: '🐍 What does a pipeline look like in Python?',
        question: 'How do I write streaming tables, materialized views, expectations, and AUTO CDC flows using `from pyspark import pipelines as dp`?',
      },
      {
        label: '⚖️ Streaming table or materialized view?',
        question: 'When should I use a Streaming Table vs a Materialized View in Spark Declarative Pipelines on Lakeflow?',
      },
    ],
  },

  tvf: {
    name: 'Table-Valued Functions (TVFs)',
    badge: 'Reusable queries',
    summary:
      'Saved SQL queries that take inputs (like a date range or region) and return a table, stored and secured in Unity Catalog.',
    useWhen:
      "A question needs inputs or step-by-step logic a metric view can't express, like a ranked top-10 list.",
    description:
      'Parameterized SQL functions registered in Unity Catalog (`CREATE FUNCTION ... RETURNS TABLE`) that encapsulate complex, reusable query logic. Used alongside Metric Views when questions require procedural parameters, dynamic top-N ranking, or custom table returns.',
    benefits: [
      { title: 'Complex logic, simple to call', detail: 'Hide multi-step SQL behind a function name and a few inputs.' },
      { title: 'Secured and versioned', detail: 'Lives in Unity Catalog with the same permissions model as your tables.' },
      { title: 'Callable by AI agents', detail: 'Genie and AI agents can call these functions as trusted tools.' },
    ],
    limitations: [
      { title: 'Use only when needed', detail: "Prefer metric views; reach for these functions only for logic metric views can't handle." },
      { title: 'Fixed output shape', detail: 'Results always have the same columns, so they are less flexible than slicing a metric view.' },
      { title: 'Needs clear descriptions', detail: 'Describe each function and input well so AI agents pass the right values.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-tvf',
    docLabel: 'SQL Table-Valued Functions Docs',
    quickQuestions: [
      {
        label: '🤔 When should I use a function instead of a metric view?',
        question: 'When should I create a SQL Table-Valued Function (TVF) instead of using a Unity Catalog Metric View?',
      },
      {
        label: '🛠️ How do Genie and agents call these functions?',
        question: 'How do Genie Agents and Mosaic AI MCP tools discover and invoke Unity Catalog Table-Valued Functions?',
      },
    ],
  },

  metricViews: {
    name: 'Metric Views',
    badge: 'Semantic layer',
    summary:
      'A single, shared place to define business metrics like revenue or profit margin, so every report and AI assistant calculates them the same way.',
    useWhen:
      'Different teams or dashboards report different numbers for the same metric, and you want one trusted answer.',
    description:
      'Unity Catalog governed semantic layer defined with `CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML` (YAML spec v1.1). Centralizes `fields` (dimensions), aggregate `measures`, star/snowflake `joins`, `synonyms`, and `window` measures so Genie, AI/BI Dashboards, and SQL query one source of truth via `MEASURE()`.',
    benefits: [
      { title: 'One definition, used everywhere', detail: 'Define "revenue" once; dashboards, Genie, and SQL queries all reuse the exact same logic.' },
      { title: 'Slice by anything, instantly', detail: 'Break a metric down by region, month, or product without building new tables.' },
      { title: 'AI understands your business words', detail: 'Add friendly names and synonyms so Genie knows "sales" and "revenue" mean the same thing.' },
    ],
    limitations: [
      { title: 'Queried a little differently', detail: 'Metrics are requested through a special function, so standard SQL habits need a small adjustment.' },
      { title: 'Percentages need careful setup', detail: 'Ratios like profit margin must be defined as a division, otherwise totals come out wrong.' },
      { title: 'Publish before Genie can use it', detail: 'Metric views built inside a single dashboard must be saved to Unity Catalog to be shared.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/',
    docLabel: 'Unity Catalog Metric Views Docs',
    quickQuestions: [
      {
        label: '📐 How do I create and query my first metric view?',
        question: 'Show me how to create a Metric View with `WITH METRICS LANGUAGE YAML` (version 1.1) and query it using `MEASURE()`.',
      },
      {
        label: '⚠️ What mistakes should I avoid?',
        question: 'What are the key considerations for Metric Views, including star/snowflake joins, non-additive ratios, and promoting `/importBI` views to Unity Catalog?',
      },
    ],
  },

  metricViewSynonyms: {
    name: 'Metric View Synonyms',
    badge: 'Business terms',
    summary:
      'Alternative names you attach to each metric or field, so people and AI can find it using the words they actually use.',
    useWhen:
      'People ask for the same metric in different ways, like "AOV", "average order value", or "spend per order".',
    description:
      'Alternative business names attached directly to `measures` and `fields` in Metric View YAML v1.1 (`synonyms:`, up to 10 per column, max 255 chars each). Because synonyms live on the Unity Catalog Metric View itself, both Genie Agents and AI/BI Dashboards share the exact same natural-language term resolution.',
    benefits: [
      { title: 'Written once, shared everywhere', detail: 'Synonyms live on the metric view, so Genie and dashboards understand the same words.' },
      { title: 'Matches how people really talk', detail: 'Cover acronyms, casual phrases, and old report names for each metric.' },
      { title: 'Fixes the most common Genie miss', detail: "Most wrong answers happen when Genie can't find the right metric; synonyms fix that." },
    ],
    limitations: [
      { title: 'Up to 10 per field', detail: 'Each metric or field holds at most 10 synonyms, so pick the most useful ones.' },
      { title: 'Define fields one by one', detail: "Synonyms can't be added when importing all columns at once; list those fields individually." },
      { title: 'Avoid overlaps', detail: 'Using the same synonym on two different metrics confuses Genie about which one you mean.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference',
    docLabel: 'Metric View Synonyms & YAML Reference',
    quickQuestions: [
      {
        label: '🏷️ How do I pick good synonyms?',
        question: 'How should I choose the up to 10 synonyms per measure/field (acronyms, informal phrasings, legacy names, BI aliases) on a Metric View?',
      },
      {
        label: '🔍 Why put synonyms on the metric view?',
        question: 'Why is defining `synonyms:` in Metric View YAML v1.1 better than only adding column synonyms inside a single Genie Space?',
      },
    ],
  },

  genieSpaces: {
    name: 'Genie Spaces',
    badge: 'Ask in plain English',
    summary:
      'A chat space where business users ask questions about data in plain English and get answers, charts, and the SQL behind them.',
    useWhen:
      'Business users need answers from data without writing SQL or waiting for an analyst.',
    description:
      'Conversational analytics spaces (also called Genie Agents) that let business users ask questions in plain English over governed Unity Catalog Metric Views, Gold tables, and TVFs—returning instant SQL-backed answers, interactive charts, and follow-up insights.',
    benefits: [
      { title: 'Self-service answers', detail: 'Anyone can ask questions, and they only see data they have permission to see.' },
      { title: 'Built on trusted definitions', detail: 'Answers come from your metric views, Gold tables, and saved query functions.' },
      { title: 'Gets better with tuning', detail: 'Instructions, example questions, and test sets make answers more accurate over time.' },
    ],
    limitations: [
      { title: 'Up to 50 data sources', detail: 'Each space can include at most 50 tables or views, so keep it focused.' },
      { title: 'Quality depends on setup', detail: 'Accuracy relies on good synonyms, column descriptions, and careful tuning.' },
      { title: 'Automated use is billed', detail: 'Calling Genie from automated accounts through the API is charged at standard rates.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie-agents/',
    docLabel: 'Genie Spaces & Agents Documentation',
    quickQuestions: [
      {
        label: '🎯 How do I make Genie answers accurate?',
        question: 'What are the best practices for curating a Genie Space with Metric Views, lean instructions, verified queries, and benchmarks?',
      },
      {
        label: '⚠️ What limits and rules apply?',
        question: 'What are the table limits, permission rules, and common pitfalls when deploying a Genie Space?',
      },
    ],
  },

  genieAgent: {
    name: 'Genie Agent',
    badge: 'Tuned Genie',
    summary:
      'A Genie space built on a single metric view, then tested and tuned step by step until its answers are reliably right.',
    useWhen:
      'You need Genie answers people can trust for real decisions, not just a quick demo.',
    description:
      'A governed conversational analytics agent (Genie Space) grounded strictly on your curated Unity Catalog Metric View. Built through a disciplined 5-step arc: attach only the Metric View, author lean rule-shaped instructions, pin verified `MEASURE()` queries, load ground-truth SQL benchmarks, and run an iterative optimize loop.',
    benefits: [
      { title: 'Grounded in one trusted source', detail: 'Answers come only from your metric view, so numbers match your official definitions.' },
      { title: 'Proven example answers', detail: 'Pin tested queries for the most common questions so Genie reuses known-good answers.' },
      { title: 'Measurable accuracy', detail: 'Test questions with verified answers show exactly where Genie is wrong and what to fix.' },
    ],
    limitations: [
      { title: 'Tests need correct answers', detail: "Each test question needs a verified answer, or it can't be scored automatically." },
      { title: 'A person must check answers', detail: "Don't let Genie write its own answer key; have a person verify each one." },
      { title: 'Keep instructions short', detail: 'Long instructions (more than about 20 lines) make Genie less accurate, not more.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie-agents/best-practices',
    docLabel: 'Curate an Effective Genie Agent Docs',
    quickQuestions: [
      {
        label: '🔁 How do I test and improve Genie?',
        question: 'How do I load benchmarks with expected `MEASURE()` SQL and run the append-only optimize loop to reach ~85%+ accuracy?',
      },
      {
        label: '📏 What goes in instructions vs the metric view?',
        question: 'What rules belong in a Genie Agent\'s General Instructions (<=20 lines) versus on the Unity Catalog Metric View?',
      },
    ],
  },

  discoverOntology: {
    name: 'Discover Ontology',
    badge: 'Business context · Beta',
    summary:
      'A layer of business context that organizes data by business area and defines key terms, so Genie answers using your official definitions.',
    useWhen:
      "Teams use the same words differently and you want AI answers to follow your company's official meaning.",
    description:
      'The human-modeled business context layer of Unity Catalog semantics in Databricks Discover. Combines business-aligned **Domains & Subdomains**, authoritative **Pages** for core concepts/measures, and **Question-to-Metric-View Routing** so Genie One grounds answers in governed definitions with clickable citations.',
    benefits: [
      { title: 'Organized by business area', detail: 'Group data into areas like Sales or Finance, with smaller sub-areas inside each.' },
      { title: 'Official definitions, cited', detail: 'Published pages define key terms, and Genie uses and links to them in its answers.' },
      { title: 'Questions go to the right metric', detail: 'A routing page sends each kind of question to the correct metric view.' },
    ],
    limitations: [
      { title: 'Beta feature', detail: 'It is in preview and must be turned on in your workspace before use.' },
      { title: 'Needs special permissions', detail: 'Organizing areas and pages requires Discover management permission.' },
      { title: 'Built in the editor', detail: 'Pages are written and published in the Discover editor, not created through an API.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/',
    docLabel: 'Unity Catalog Semantics & Ontology Docs',
    quickQuestions: [
      {
        label: '🧭 How do areas, pages, and routing fit together?',
        question: 'How do Discover Domains, Subdomains, concept Pages, and the Question-to-Metric-View Routing Page work together in the Genie Ontology?',
      },
      {
        label: '⚠️ What permissions and Beta limits apply?',
        question: 'What permissions (`MANAGE DISCOVER`), ID-vs-name rules, and Beta limitations apply to Discover Ontology?',
      },
    ],
  },

  discoverDomains: {
    name: 'Discover Domains',
    badge: 'Business areas · Beta',
    summary:
      'Folders for your business, like Revenue or Supply Chain, that group related tables, metrics, dashboards, and Genie spaces in one place.',
    useWhen:
      "People struggle to find the right data because it's organized by system instead of by business area.",
    description:
      'Account-level business organization layer in Databricks Discover (`Catalog → Discover`). Domains group tables, Metric Views, AI/BI Dashboards, Genie Agents, and Pages by business area, and partition into **Subdomains** (one level of nesting) built on governed tags (`{parentDomainTag}/{subdomainName}`).',
    benefits: [
      { title: 'Find data by business area', detail: 'Group assets under areas like Revenue, with sub-areas like Orders or Returns.' },
      { title: 'One asset, many areas', detail: 'An asset can belong to several areas, and sub-area assets also appear in the parent area.' },
      { title: 'Access follows the area', detail: 'Pages published inside an area inherit its access controls.' },
    ],
    limitations: [
      { title: 'Only one level of sub-areas', detail: "Areas can have sub-areas, but sub-areas can't contain further sub-areas." },
      { title: 'Needs special permissions', detail: 'Creating and managing areas requires Discover management permission.' },
      { title: "Save each area's ID", detail: "Later steps need the area's internal ID, not its name, so record it when you create it." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/domains',
    docLabel: 'Discover Domains & Subdomains Docs',
    quickQuestions: [
      {
        label: '🆔 Why do I need to save area IDs?',
        question: 'Why is capturing the internal Domain ID and Subdomain IDs critical when modeling a Discover domain for Pages and bulk imports?',
      },
      {
        label: '🗂️ How are areas and sub-areas set up?',
        question: 'How do Unity Catalog governed tags (`{parentDomainTag}/{subdomainName}`) and permissions work for Discover Domains and Subdomains?',
      },
    ],
  },

  discoverPages: {
    name: 'Discover Pages',
    badge: 'Official definitions · Beta',
    summary:
      'Short, official write-ups of your key business terms and metrics that Genie reads first and links to in its answers.',
    useWhen:
      'You want Genie to use your company\'s exact definition of a metric like "net revenue" every time.',
    description:
      'Governed, authoritative definitions of business concepts, KPIs, and acronyms authored inside a Discover domain or subdomain. When Genie One answers a question involving a concept defined in a published Page, it prioritizes the Page over inferred context and cites the Page in its response.',
    benefits: [
      { title: 'One official definition', detail: 'Each page explains a metric in plain words alongside its exact formula.' },
      { title: 'Covers every way people say it', detail: 'List acronyms, casual names, and old report names, plus what the term does not mean.' },
      { title: 'Genie cites it', detail: 'Genie trusts published pages over its own guesses and shows them as clickable sources.' },
    ],
    limitations: [
      { title: 'Write self-contained sentences', detail: 'Pages are read in small pieces, so each sentence must name the metric it describes.' },
      { title: 'A person must publish', detail: 'Genie Code can draft a page, but a person reviews and publishes it in the editor.' },
      { title: 'Drafts are private', detail: "Only the author sees a draft; publish it before anyone else's Genie answers can use it." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/pages',
    docLabel: 'Discover Pages Documentation',
    quickQuestions: [
      {
        label: '✂️ How should I write a page so Genie reads it well?',
        question: 'Why are Discover Pages split into chunks, and how do I write chunk-safe definitions and negative rules that never arrive orphaned?',
      },
      {
        label: '📋 What belongs on a metric page?',
        question: 'What are the 5 essential elements to include when drafting a Discover Page for a key business measure?',
      },
    ],
  },

  discoverRouting: {
    name: 'Question-to-Metric-View Routing',
    badge: 'Question routing · Beta',
    summary:
      'A special page that lists every way people ask about a metric and points each one to the exact metric view to use.',
    useWhen:
      'Genie picks the wrong table or calculation because people phrase the same question many different ways.',
    description:
      'A high-leverage Discover Page ("Question to Metric View Routing") that maps every real-world question phrasing—formal name, acronym, informal phrasing, and legacy report term—to the exact governed Unity Catalog Metric View and measure, replacing fragile table inference with a deterministic lookup.',
    benefits: [
      { title: 'A lookup instead of a guess', detail: 'Genie follows a clear list instead of guessing which table answers a question.' },
      { title: 'Catches loose phrasing', detail: 'Terms like "top line", "net sales", and "sales $" all point to the same metric.' },
      { title: 'Fewer wrong-table answers', detail: 'Stops answers that use the right formula on the wrong source data.' },
    ],
    limitations: [
      { title: 'Must stay up to date', detail: 'Update the page whenever new metrics or metric views are added.' },
      { title: 'Needs an owner and publishing', detail: "Assign a named owner and publish it so everyone's answers use it." },
      { title: 'Adds to synonyms, not instead', detail: 'Keep synonyms on your metric views too; this page works alongside them.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/pages',
    docLabel: 'Discover Pages & Routing Docs',
    quickQuestions: [
      {
        label: '🗺️ What does a routing page look like?',
        question: 'Show me an example of a "Question to Metric View Routing" Page table mapping formal, acronym, informal, and legacy phrasings to a Metric View.',
      },
      {
        label: '💡 Why does a lookup beat guessing?',
        question: 'Why do most Genie misses happen from choosing the wrong source table, and how does a Routing Page solve that?',
      },
    ],
  },

  syncedTables: {
    name: 'Synced Tables',
    badge: 'Data to apps',
    summary:
      'Automatically copies curated analytics tables from the lakehouse into your Lakebase app database, so apps can show them instantly.',
    useWhen:
      'Your app needs to show analytics results (like customer scores) next to its own live data.',
    description:
      'Managed reverse-ETL pipelines (powered by Lakeflow) that sync curated Unity Catalog Gold tables into Lakebase Postgres (`_synced` read-only tables) so operational apps serve governed analytics with sub-10ms OLTP latency alongside transactional data.',
    benefits: [
      { title: 'Three sync speeds', detail: 'Copy everything once, refresh on a schedule, or stay up to date within seconds.' },
      { title: 'Fully managed', detail: 'Databricks runs the sync for you, with no custom scripts or schedulers.' },
      { title: 'Join in one query', detail: 'Apps can combine their own tables with synced analytics in a single database query.' },
    ],
    limitations: [
      { title: 'Sync tables, not metric views', detail: "Metric views can't be synced; sync the Gold tables underneath them instead." },
      { title: 'Ongoing sync needs setup', detail: 'Scheduled and continuous syncs need a primary key and change tracking on the source table.' },
      { title: 'Copies are read-only', detail: "Synced tables can't be edited in Lakebase; change the data at the source." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables',
    docLabel: 'Lakebase Synced Tables Documentation',
    quickQuestions: [
      {
        label: '🔄 Which sync speed should I choose?',
        question: 'How do I choose between Snapshot, Triggered, and Continuous sync modes for Lakebase Synced Tables, and when is CDF required?',
      },
      {
        label: "⚠️ Why can't I sync a metric view?",
        question: 'Why must I sync the base Gold fact and dimension tables into Lakebase rather than syncing a Metric View directly?',
      },
    ],
  },

  aiBIDashboards: {
    name: 'AI/BI Dashboards',
    badge: 'Dashboards',
    summary:
      'Interactive dashboards built into Databricks that anyone in your company can view and explore, with AI help to build and explain them.',
    useWhen:
      'You want to share key metrics visually across teams without buying a separate BI tool.',
    description:
      'Native, serverless business intelligence dashboards (`.lvdash.json`) built into Databricks. Query Unity Catalog Metric Views directly with `MEASURE()` for KPIs and breakdowns, use the low-code Metric View UI, enable cross-filtering and Dashboard Insights, and deploy via Asset Bundles.',
    benefits: [
      { title: 'No per-viewer licenses', detail: 'Share dashboards with your whole organization at no extra per-user cost.' },
      { title: 'Uses your official metrics', detail: 'Charts read straight from metric views, so numbers match Genie and SQL.' },
      { title: 'Explore by clicking', detail: 'Click a chart to filter the rest, drill down, and ask follow-up questions in Genie.' },
    ],
    limitations: [
      { title: 'Mix metrics and detail tables', detail: 'Use metric views for headline numbers and Gold tables for detailed lists and filters.' },
      { title: 'The layout has rules', detail: "Dashboards use a six-column grid, and field names must exactly match the query's columns." },
      { title: "Some metric views can't be extended", detail: "Metric views that take inputs can't be customized inside a dashboard." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dashboards/',
    docLabel: 'AI/BI Dashboards Documentation',
    quickQuestions: [
      {
        label: '📊 How do dashboards use metric views?',
        question: 'What is the recommended mixed dataset strategy (`MEASURE()` on Metric Views vs direct Gold SQL) when building an AI/BI Dashboard?',
      },
      {
        label: '📦 How do I deploy a dashboard?',
        question: 'How do I extract an `.lvdash.json` definition and deploy an AI/BI Dashboard with Databricks Asset Bundles?',
      },
    ],
  },

  agents: {
    name: 'Databricks Agents',
    badge: 'AI agents',
    summary:
      'Tools for building, testing, and running AI assistants that can look up your company data and take actions safely.',
    useWhen:
      'You want an AI assistant that answers from your own data or completes multi-step tasks.',
    description:
      'Build, evaluate, register, and deploy enterprise AI agents on Mosaic AI. Connect foundation models to governed Unity Catalog data, Genie Spaces, Vector Search, and MCP tools with full MLflow 3 observability and AI Gateway guardrails.',
    benefits: [
      { title: 'Grounded in your data', detail: 'Agents use Genie, saved functions, and document search over data in Unity Catalog.' },
      { title: 'Build, test, and ship in one place', detail: 'Develop, evaluate, and deploy agents with built-in tracking at every step.' },
      { title: 'Safe in production', detail: 'Usage limits and safety guardrails protect every deployed agent.' },
    ],
    limitations: [
      { title: 'Clear tool descriptions matter', detail: 'Agents choose tools from their descriptions, so vague ones lead to wrong choices.' },
      { title: 'Multi-step tasks cost more', detail: 'Each extra tool call adds response time and AI model usage cost.' },
      { title: 'User-level access needs setup', detail: "For agents to act with each user's permissions, credential passing must be configured." },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agents Documentation',
    quickQuestions: [
      {
        label: '🤖 How do agents connect to my data?',
        question: 'How do I wire a Mosaic AI Agent to query Genie Spaces, Unity Catalog Functions, and Vector Search?',
      },
      {
        label: '🛡️ How are agents kept safe in production?',
        question: 'How do Unity Catalog permissions, AI Gateway guardrails, and MLflow 3 monitoring work for Databricks Agents?',
      },
    ],
  },

  agentFramework: {
    name: 'Agent Framework',
    badge: 'Build agents',
    summary:
      'The coding toolkit for writing an AI agent in Python with the framework of your choice, then logging and deploying it on Databricks.',
    useWhen:
      "You're ready to write the code for a custom agent and run it in production.",
    description:
      'The Mosaic AI Agent Framework lets you author production-grade agents using the `ResponsesAgent` (recommended) or `ChatAgent` interfaces. Framework-agnostic (LangGraph, OpenAI Agents SDK, LlamaIndex, custom Python) with automatic MLflow 3 signature inference and native Playground, Evaluation, and Apps compatibility.',
    benefits: [
      { title: 'Use any framework', detail: 'Works with LangGraph, the OpenAI Agents SDK, LlamaIndex, or plain Python.' },
      { title: 'Works with built-in tools', detail: 'Your agent plugs straight into the AI Playground, evaluation tools, and Databricks Apps.' },
      { title: 'A simple path to production', detail: 'Log, register, and deploy the agent in a few standard steps.' },
    ],
    limitations: [
      { title: 'Requires Python skills', detail: 'Custom interfaces need comfort with Python and streaming responses.' },
      { title: 'Quality depends on the model', detail: 'How well the agent reasons and picks tools depends on the AI model behind it.' },
      { title: 'No memory by default', detail: 'Agents forget past conversations unless you add Lakebase Memory.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agent Framework Docs',
    quickQuestions: [
      {
        label: '🧱 Which agent interface should I use?',
        question: 'What are the advantages of building with `ResponsesAgent` in the Mosaic AI Agent Framework and how does it handle streaming and tool calls?',
      },
      {
        label: '🚀 How do I deploy my agent?',
        question: 'What are the steps to log a `ResponsesAgent` with MLflow 3, register it in Unity Catalog, and deploy it?',
      },
    ],
  },

  toolsMcp: {
    name: 'Tools & MCP',
    badge: 'Agent tools',
    summary:
      'A standard way to plug tools into AI agents, using the open Model Context Protocol (MCP), so they can query data, search documents, or call other services.',
    useWhen:
      'Your agent needs to do more than chat, like querying data, searching documents, or using another app.',
    description:
      'Connect agents to enterprise capabilities via the standardized Model Context Protocol (MCP). Supports three server architectures on Databricks: **Managed MCP** (Unity Catalog Functions, Vector Search, Genie Spaces, DBSQL), **External MCP** (OAuth third-party services), and **Custom MCP** (hosted on Databricks Apps).',
    benefits: [
      { title: 'One standard for all tools', detail: 'Agents find and use tools the same way, whichever framework you build with.' },
      { title: 'Ready-made Databricks tools', detail: 'Built-in servers give agents Genie, search, SQL, and functions with no setup.' },
      { title: 'Respects user permissions', detail: "Tools run with each user's own access, governed by Unity Catalog." },
    ],
    limitations: [
      { title: 'Outside tools need setup', detail: 'Third-party services need a secure connection and sign-in configured first.' },
      { title: 'Custom servers are more to run', detail: 'Hosting your own tool server means deploying and maintaining a separate app.' },
      { title: 'Too many tools slow agents down', detail: 'Every tool adds to what the agent must read; give each agent only what it needs.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/mcp',
    docLabel: 'MCP on Databricks Documentation',
    quickQuestions: [
      {
        label: '🔌 Which kind of tool server do I need?',
        question: 'What is the difference between Managed, External, and Custom MCP servers on Databricks and when should I use each?',
      },
      {
        label: '🔐 How do tools respect user permissions?',
        question: 'How do MCP tools enforce Unity Catalog permissions using on-behalf-of-user authentication?',
      },
    ],
  },

  lakebaseMemory: {
    name: 'Lakebase Memory',
    badge: 'Agent memory',
    summary:
      'Lets AI agents remember the current conversation and recall facts about users across sessions, stored in your Lakebase database.',
    useWhen:
      "Your agent should remember what was said earlier, or recall a user's preferences next time.",
    description:
      'Persist stateful agent memory on Lakebase Postgres. **Short-term memory** uses a LangGraph (or OpenAI Agents SDK) Postgres checkpointer keyed by `thread_id` for multi-turn continuity; **long-term memory** extracts user insights into Lakebase tables indexed with `lakebase_vector` or Mosaic AI Vector Search.',
    benefits: [
      { title: 'Remembers the conversation', detail: 'Each conversation is saved, so follow-up questions keep their context.' },
      { title: 'Recalls users over time', detail: 'Important facts and preferences are stored and found again in later sessions.' },
      { title: 'No extra database needed', detail: 'Uses the Lakebase database you already have instead of a separate memory store.' },
    ],
    limitations: [
      { title: 'Long-term memory takes an extra step', detail: 'Facts must be summarized and saved in a separate background step.' },
      { title: 'Memory keeps growing', detail: "Set cleanup rules so old conversations don't pile up forever." },
      { title: 'Plan for many users at once', detail: 'Configure database connections carefully so many simultaneous chats do not overload it.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/lakehouse-integrations',
    docLabel: 'Lakebase Agent State & Memory Docs',
    quickQuestions: [
      {
        label: '🧠 Short-term vs long-term memory?',
        question: 'How do I implement both short-term `thread_id` checkpointing and long-term semantic memory on Lakebase Postgres?',
      },
      {
        label: '⚡ How do I keep memory fast and tidy?',
        question: 'What are the best practices for Postgres connection pooling and checkpoint retention when using Lakebase Memory?',
      },
    ],
  },

  mlflowPromptRegistry: {
    name: 'Prompt Registry',
    badge: 'Prompt versions',
    summary:
      'A version history for the instructions (prompts) you give AI models, so you can change, compare, and roll back prompts without redeploying your app.',
    useWhen:
      "You're improving an agent's prompts and want to test changes safely before users see them.",
    description:
      'MLflow 3 Prompt Registry provides Git-style version control for prompt templates in Unity Catalog, complete with mutable deployment aliases (`@production`, `@staging`). Decouple prompts from agent code so you can iterate, evaluate, and roll back prompts without redeploying.',
    benefits: [
      { title: 'Full version history', detail: 'Every prompt change is saved, and you can compare any two versions side by side.' },
      { title: 'Switch versions without redeploying', detail: 'Point a label like "production" at a version, and agents pick it up automatically.' },
      { title: 'Linked to test results', detail: 'Each version connects to the evaluation runs that tested it.' },
    ],
    limitations: [
      { title: 'Needs an up-to-date MLflow', detail: 'Requires a recent MLflow release with prompt support in Unity Catalog.' },
      { title: 'Labels change live behavior', detail: 'Moving the production label changes what users see immediately, so test first.' },
      { title: 'Keep placeholders compatible', detail: 'Placeholders in a prompt must keep matching the values your code fills in.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/evaluate-prompts',
    docLabel: 'MLflow 3 Prompt Registry Docs',
    quickQuestions: [
      {
        label: '🏷️ How do I promote a prompt to production?',
        question: 'How do I register a prompt in MLflow 3, promote it with `@staging` and `@production` aliases, and load it inside an agent?',
      },
      {
        label: '🔄 How do I compare two prompt versions?',
        question: 'How do I run `mlflow.genai.evaluate()` across two different Prompt Registry versions before promoting to `@production`?',
      },
    ],
  },

  mlflowEval: {
    name: 'MLflow Evaluation',
    badge: 'Quality testing',
    summary:
      'Repeatable tests for AI agents that score answers automatically, using AI judges and your own rules, plus review by experts.',
    useWhen:
      'You need proof an agent gives correct, safe answers before releasing or changing it.',
    description:
      'Systematic quality gates for GenAI agents using `mlflow.genai.evaluate()`. Curate repeatable evaluation datasets in Unity Catalog, score responses with built-in and custom LLM judges (`Correctness`, `RetrievalGroundedness`, `Guidelines`, code scorers), and collect SME sign-off in the Review App.',
    benefits: [
      { title: 'Repeatable test sets', detail: 'Saved question sets let you compare agent versions fairly, like for like.' },
      { title: 'Automatic AI judges', detail: 'Built-in judges score correctness, safety, and whether answers stick to the sources.' },
      { title: 'See exactly what went wrong', detail: 'Step-by-step traces show which tool call or lookup caused a bad answer.' },
    ],
    limitations: [
      { title: 'Judging has a cost', detail: 'AI judges use model calls, which add cost to every test run.' },
      { title: 'Tests must keep growing', detail: 'Add new real-world cases over time so tests reflect what users actually ask.' },
      { title: 'Vague rules give noisy scores', detail: 'Write specific, clear judging rules to get consistent pass or fail results.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/judges',
    docLabel: 'MLflow 3 Evaluation & Judges Docs',
    quickQuestions: [
      {
        label: '⚖️ Which kind of judge should I use?',
        question: 'When should I use built-in MLflow 3 judges (`Correctness`, `RetrievalGroundedness`), `Guidelines` judges, or custom Python code scorers?',
      },
      {
        label: '👥 How do experts review answers?',
        question: 'How do domain experts use the MLflow Review App to inspect traces and sign off on agent quality before promotion?',
      },
    ],
  },

  mlflowMonitoring: {
    name: 'Production Monitoring',
    badge: 'Live quality checks',
    summary:
      'Keeps watching an AI agent after launch, logging real conversations and automatically scoring a sample of them for quality.',
    useWhen:
      'Your agent is live and you want to catch quality drops before users notice.',
    description:
      'Continuous quality and drift observability in production. Capture every live request, response, and trace via **AI Gateway-enabled inference tables**, then attach **MLflow 3 scheduled scorers** (`scorer.register()` / `.start()`) at a configurable sampling rate (`0.0–1.0`) to grade live traffic automatically.',
    benefits: [
      { title: 'Every request logged', detail: 'Full requests, responses, and traces are saved to tables you can query.' },
      { title: 'Live traffic scored automatically', detail: 'The same judges used in testing grade real conversations, without redeploying.' },
      { title: 'You control the cost', detail: 'Score anything from a small sample to all traffic to balance coverage and cost.' },
    ],
    limitations: [
      { title: 'Up to 20 scorers', detail: 'Each experiment supports at most 20 scheduled scorers.' },
      { title: 'Use the newer logging tables', detail: 'Older inference tables are retired; use the AI Gateway versions instead.' },
      { title: 'Scores arrive with a delay', detail: 'Scoring runs in the background, a few minutes behind live traffic.' },
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/run-scorer-in-prod',
    docLabel: 'MLflow 3 Production Monitoring Docs',
    quickQuestions: [
      {
        label: '📈 How do I start scoring live traffic?',
        question: 'How do I enable AI Gateway inference tables and register an MLflow 3 scheduled scorer with `sample_rate` on production traffic?',
      },
      {
        label: '⚠️ What limits and costs should I plan for?',
        question: 'What are the scorer limits per experiment, sampling rate best practices, and AI Gateway requirements for production monitoring?',
      },
    ],
  },
};

export type ServiceKey = keyof typeof serviceData;
