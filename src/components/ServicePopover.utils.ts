// Databricks service definitions shared by ServicePopover, TypingText and
// CelebrationOverlay. Kept out of ServicePopover.tsx so that file only exports
// components (react-refresh/only-export-components).

export interface ServiceQuickQuestion {
  label: string;
  question: string;
}

export interface ServiceInfo {
  name: string;
  /** Optional status or version badge rendered in the popover header (e.g. 'YAML v1.1', 'Beta', 'GA'). */
  badge?: string;
  description: string;
  benefits: string[];
  limitations: string[];
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
    badge: 'Serverless',
    description:
      'Build, host, and deploy custom full-stack web applications (React, FastAPI, Python, Node.js) directly on serverless Databricks compute. Apps inherit Unity Catalog governance, workspace SSO, and on-behalf-of-user OAuth.',
    benefits: [
      'Zero external hosting infra — runs on managed serverless compute',
      'Built-in SSO & on-behalf-of-user auth (X-Forwarded-Access-Token)',
      'Native access to Lakebase Postgres, Genie Agents, and Serving Endpoints',
      'Declarative CI/CD and resource binding with Databricks Asset Bundles',
      'Embeds AI/BI Dashboards and conversational Genie experiences natively',
    ],
    limitations: [
      'Scoped to supported Python / Node.js runtimes and container limits',
      'Stateful persistence must live in Lakebase or Unity Catalog (ephemeral local disk)',
      'On-behalf-of-user queries require explicit OAuth scope grants in app.yaml',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/',
    docLabel: 'Databricks Apps Documentation',
    quickQuestions: [
      {
        label: '🔐 How does user auth & Lakebase access work?',
        question: 'How do Databricks Apps authenticate users with X-Forwarded-Access-Token and connect to Lakebase Postgres and Unity Catalog?',
      },
      {
        label: '🚀 How do I deploy an app with Asset Bundles?',
        question: 'How do I configure app.yaml and deploy a React + FastAPI Databricks App using Databricks Asset Bundles?',
      },
    ],
  },

  lakebase: {
    name: 'Lakebase (PostgreSQL)',
    badge: 'Autoscaling OLTP',
    description:
      'Fully managed, autoscaling PostgreSQL (Postgres 16–18) built into Databricks on the LTAP architecture. Separates stateless compute from durable storage to power sub-10ms transactional app backends, synced analytics serving, and agent state.',
    benefits: [
      'Serverless autoscaling Postgres with separated compute and storage',
      'Sub-10ms low-latency OLTP reads and full ACID transactions for apps',
      'Bidirectional Lakehouse integration: UC registration & Synced Tables',
      'Instant database branching, point-in-time recovery, and OAuth role auth',
      'Built-in hybrid search via lakebase_vector and lakebase_text extensions',
    ],
    limitations: [
      'Designed for OLTP and low-latency point lookups, not heavy OLAP scans',
      'Each registered Unity Catalog catalog maps to a single Lakebase database',
      'Synced tables inside Lakebase are read-only (writes happen in the Lakehouse)',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/',
    docLabel: 'Lakebase Postgres Documentation',
    quickQuestions: [
      {
        label: '⚡ How does Lakebase connect to Unity Catalog?',
        question: 'How does Lakebase integrate with Unity Catalog via database registration and Synced Tables in the LTAP architecture?',
      },
      {
        label: '⚠️ What are the sizing & connection considerations?',
        question: 'What are the key connection limits, autoscaling behaviors, and OLTP vs OLAP considerations when using Lakebase?',
      },
    ],
  },

  dataIngestion: {
    name: 'Data Ingestion Pipeline',
    badge: 'UC Registration + CDC',
    description:
      'Bridge operational data from Lakebase Postgres (or external sources) into the Lakehouse. Register your Lakebase database as a read-only Unity Catalog catalog, then ingest operational changes into Bronze Delta tables using Change Data Feed (CDF) and Lakeflow.',
    benefits: [
      'Zero-ETL catalog registration exposes Postgres schemas in Unity Catalog',
      'Cross-source SQL joins across live operational Postgres and Delta tables',
      'Incremental CDC ingestion into Bronze with Change Data Feed (CDF)',
      'Automatic schema evolution and column-level lineage in Unity Catalog',
      'Orchestrated end-to-end via Databricks Asset Bundles and Lakeflow jobs',
    ],
    limitations: [
      'Unity Catalog catalogs registered from Lakebase are read-only on serverless compute',
      'Initial full snapshot of large operational tables can be I/O intensive',
      'Requires serverless SQL warehouse or serverless compute to query registered catalogs',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/register-uc',
    docLabel: 'Lakebase UC Registration Docs',
    quickQuestions: [
      {
        label: '🔗 How does Lakebase UC registration work?',
        question: 'How do I register a Lakebase Postgres database in Unity Catalog and ingest its tables into the Bronze layer?',
      },
      {
        label: '⚠️ What compute is required for cross-source queries?',
        question: 'What are the compute requirements and read-only rules when querying a registered Lakebase catalog in Unity Catalog?',
      },
    ],
  },

  bronze: {
    name: 'Bronze Layer',
    badge: 'Medallion · Raw',
    description:
      'The raw landing zone of the Medallion Lakehouse architecture. Bronze Delta tables capture operational snapshots and append-only change streams exactly as received, with Change Data Feed (CDF) enabled for downstream incremental processing.',
    benefits: [
      'Immutable, auditable history of raw source records with Delta Time Travel',
      'Change Data Feed (CDF) tracks row-level inserts, updates, and deletes',
      'Decouples upstream operational systems from analytical transformations',
      'Supports schema evolution and rescued data columns without pipeline failure',
      'Allows deterministic replay of Silver and Gold pipelines at any time',
    ],
    limitations: [
      'Contains unvalidated rows, duplicates, and raw operational schemas',
      'Never expose Bronze tables directly to Genie Agents or BI dashboards',
      'Requires retention and vacuum policies to manage storage growth',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '🔄 Why enable Change Data Feed (CDF) on Bronze?',
        question: 'Why is Change Data Feed (CDF) important on Bronze tables and how do downstream pipelines consume it?',
      },
      {
        label: '⚠️ What should NOT be done in the Bronze layer?',
        question: 'What transformations or query patterns should be avoided in the Bronze layer of a medallion architecture?',
      },
    ],
  },

  silver: {
    name: 'Silver Layer',
    badge: 'Medallion · Cleansed',
    description:
      'Validated, deduplicated, and conformed enterprise data built with Spark Declarative Pipelines (SDP). Silver tables enforce data quality expectations, resolve data types, and apply SCD Type 1/2 merges via AUTO CDC.',
    benefits: [
      'Enforces explicit data quality expectations (WARN, DROP, or FAIL on violation)',
      'Deduplicates records and handles out-of-order events with AUTO CDC',
      'Supports Slowly Changing Dimensions (SCD Type 1 and SCD Type 2)',
      'Provides a single validated, non-aggregated source of truth per entity',
      'Streaming incremental reads from Bronze minimize compute cost and latency',
    ],
    limitations: [
      'Entity-normalized grain is not yet shaped for direct business KPI reporting',
      'Strict FAIL expectations can halt pipeline runs if upstream data drifts',
      'SCD Type 2 history requires filtering on current-row flags downstream',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '🛡️ How do SDP quality expectations work in Silver?',
        question: 'How do data quality expectations and AUTO CDC flows work when building Silver tables in Spark Declarative Pipelines?',
      },
      {
        label: '⚠️ How should Silver handle bad records?',
        question: 'When should I use WARN vs DROP ROW vs FAIL UPDATE for data quality expectations in the Silver layer?',
      },
    ],
  },

  gold: {
    name: 'Gold Layer',
    badge: 'Medallion · Curated',
    description:
      'Business-ready dimensional models (star/snowflake schemas of fact and dimension tables) and curated aggregates in Unity Catalog. Rich table/column COMMENTs and PK/FK constraints make Gold the foundation for Metric Views, Genie, Dashboards, and Synced Tables.',
    benefits: [
      'Dimensional fact and dimension tables aligned to business processes',
      'Primary/Foreign Key (RELY) constraints accelerate star-schema join plans',
      'Rich Unity Catalog table and column COMMENTs ground AI and Genie accuracy',
      'Directly feeds Unity Catalog Metric Views, TVFs, and AI/BI Dashboards',
      'Ready for low-latency reverse-ETL activation into Lakebase Synced Tables',
    ],
    limitations: [
      'Missing or vague column COMMENTs degrade Genie natural-language accuracy',
      'Pre-aggregated tables lose row-level detail unless paired with atomic facts',
      'Schema changes impact downstream Metric Views, Dashboards, and Synced Tables',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/lakehouse/medallion',
    docLabel: 'Medallion Architecture Docs',
    quickQuestions: [
      {
        label: '⭐ How do Gold tables prepare data for Metric Views?',
        question: 'How should I design Gold fact and dimension tables, PK/FK constraints, and comments to power Unity Catalog Metric Views and Genie?',
      },
      {
        label: '🔄 How do Gold tables sync back to Lakebase?',
        question: 'What makes a Gold table a good candidate for reverse-ETL into Lakebase via Synced Tables?',
      },
    ],
  },

  sdp: {
    name: 'Spark Declarative Pipelines (SDP)',
    badge: 'Lakeflow · dp',
    description:
      'Declarative framework for batch and streaming ETL in SQL and Python (`from pyspark import pipelines as dp`). Lakeflow pipelines extend Apache Spark Declarative Pipelines with AUTO CDC, data quality expectations, and a queryable event log.',
    benefits: [
      'Declarative SQL (CREATE STREAMING TABLE / MATERIALIZED VIEW) & Python (@dp.table)',
      'Automatic dependency graph resolution, parallel execution, and incremental refresh',
      'Built-in data quality expectations (@dp.expect, CONSTRAINT ... EXPECT)',
      'Native AUTO CDC flows for out-of-order events and SCD Type 1 / Type 2',
      'Portable open-source Apache Spark SDP syntax with managed Lakeflow observability',
    ],
    limitations: [
      'Requires declarative mindset (define target state, not imperative step loops)',
      'AUTO CDC and expectations are Lakeflow extensions beyond base open-source SDP',
      'Standalone MV/ST vs multi-dataset ETL pipelines have different operational scopes',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/ldp/',
    docLabel: 'Spark Declarative Pipelines on Lakeflow',
    quickQuestions: [
      {
        label: '🐍 What is the Python `pyspark.pipelines` syntax?',
        question: 'How do I write streaming tables, materialized views, expectations, and AUTO CDC flows using `from pyspark import pipelines as dp`?',
      },
      {
        label: '⚖️ Streaming Table vs Materialized View?',
        question: 'When should I use a Streaming Table vs a Materialized View in Spark Declarative Pipelines on Lakeflow?',
      },
    ],
  },

  tvf: {
    name: 'Table-Valued Functions (TVFs)',
    badge: 'Unity Catalog SQL',
    description:
      'Parameterized SQL functions registered in Unity Catalog (`CREATE FUNCTION ... RETURNS TABLE`) that encapsulate complex, reusable query logic. Used alongside Metric Views when questions require procedural parameters, dynamic top-N ranking, or custom table returns.',
    benefits: [
      'Encapsulates complex multi-join or window SQL behind typed input parameters',
      'Governed and versioned in Unity Catalog with standard EXECUTE privileges',
      'Callable as trusted tools by Genie Agents, Mosaic AI Agents, and MCP servers',
      'Parameterized Metric Views (DBR 18.2+) can also be invoked with TVF syntax',
      'Enforces consistent filtering (e.g. date ranges, thresholds) across callers',
    ],
    limitations: [
      'Use TVFs only where Metric Views cannot express the parameterized logic',
      'Fixed output table schema is less flexible than ad-hoc `MEASURE()` slicing',
      'Requires clear function and parameter COMMENTs so AI agents pass valid arguments',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-tvf',
    docLabel: 'SQL Table-Valued Functions Docs',
    quickQuestions: [
      {
        label: '🤔 When should I use a TVF vs a Metric View?',
        question: 'When should I create a SQL Table-Valued Function (TVF) instead of using a Unity Catalog Metric View?',
      },
      {
        label: '🛠️ How do Genie and MCP agents call TVFs?',
        question: 'How do Genie Agents and Mosaic AI MCP tools discover and invoke Unity Catalog Table-Valued Functions?',
      },
    ],
  },

  metricViews: {
    name: 'Metric Views',
    badge: 'YAML v1.1 · UC Semantics',
    description:
      'Unity Catalog governed semantic layer defined with `CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML` (YAML spec v1.1). Centralizes `fields` (dimensions), aggregate `measures`, star/snowflake `joins`, `synonyms`, and `window` measures so Genie, AI/BI Dashboards, and SQL query one source of truth via `MEASURE()`.',
    benefits: [
      'Define KPIs once in YAML v1.1; query at any grain with `SELECT MEASURE(...)`',
      'Supports star & nested snowflake joins, `rely: at_most_one_match`, and `one_to_many`',
      'Rich semantic metadata: `display_name`, `format`, `comment`, and `synonyms` (up to 10)',
      'Supports rolling/cumulative `window` measures, `parameters`, and `materialization`',
      'Import Tableau/Power BI workbooks via `/importBI` and promote local views to UC',
    ],
    limitations: [
      'Must be queried with `MEASURE(measure_name)` and `GROUP BY` (not `SELECT *` aggregates)',
      'Local dashboard metric views from `/importBI` must be promoted to UC for Genie Agents',
      '`SHOW CREATE TABLE` is blocked on Metric Views — inspect via `DESCRIBE TABLE EXTENDED`',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/',
    docLabel: 'Unity Catalog Metric Views Docs',
    quickQuestions: [
      {
        label: '📐 How do I write & query a Metric View in YAML v1.1?',
        question: 'Show me how to create a Metric View with `WITH METRICS LANGUAGE YAML` (version 1.1) and query it using `MEASURE()`.',
      },
      {
        label: '⚠️ What are the key rules (joins, non-additive, /importBI)?',
        question: 'What are the key considerations for Metric Views, including star/snowflake joins, non-additive ratios, and promoting `/importBI` views to Unity Catalog?',
      },
    ],
  },

  metricViewSynonyms: {
    name: 'Metric View Synonyms',
    badge: 'YAML v1.1 · Discovery',
    description:
      'Alternative business names attached directly to `measures` and `fields` in Metric View YAML v1.1 (`synonyms:`, up to 10 per column, max 255 chars each). Because synonyms live on the Unity Catalog Metric View itself, both Genie Agents and AI/BI Dashboards share the exact same natural-language term resolution.',
    benefits: [
      'Lives on the Metric View YAML (`synonyms:`), shared across Genie and AI/BI Dashboards',
      'Maps acronyms ("AOV"), informal phrasings ("spend per order"), and legacy report names',
      'Preserves original Tableau / Power BI field aliases when importing via `/importBI`',
      'Eliminates the #1 cause of Genie benchmark misses ("right measure not found")',
      'Up to 10 curated synonyms per measure or field without duplicating SQL definitions',
    ],
    limitations: [
      'Requires Metric View YAML specification `version: 1.1` (up to 10 synonyms per field)',
      'Not allowed on wildcard (`source.*`) field imports — exclude and define explicitly',
      'Overlapping synonyms across different measures in the same view create ambiguity',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference',
    docLabel: 'Metric View Synonyms & YAML Reference',
    quickQuestions: [
      {
        label: '🏷️ What makes a high-impact synonym list?',
        question: 'How should I choose the up to 10 synonyms per measure/field (acronyms, informal phrasings, legacy names, BI aliases) on a Metric View?',
      },
      {
        label: '🔍 Why put synonyms on the Metric View instead of Genie?',
        question: 'Why is defining `synonyms:` in Metric View YAML v1.1 better than only adding column synonyms inside a single Genie Space?',
      },
    ],
  },

  genieSpaces: {
    name: 'Genie Spaces',
    badge: 'Conversational AI/BI',
    description:
      'Conversational analytics spaces (also called Genie Agents) that let business users ask questions in plain English over governed Unity Catalog Metric Views, Gold tables, and TVFs—returning instant SQL-backed answers, interactive charts, and follow-up insights.',
    benefits: [
      'Self-service natural language exploration grounded in Unity Catalog permissions',
      'Directly consumes governed Metric Views (`MEASURE()`), Gold tables, and TVFs',
      'Curated with general instructions, verified SQL examples, and benchmark test suites',
      'Supports Chat mode and multi-step Agent mode reasoning with Flash speed option',
      'Embeds into Databricks Apps and powers multi-agent supervisor architectures',
    ],
    limitations: [
      'Supports up to 50 data objects (tables, views, or metric views) per space',
      'Accuracy depends heavily on Metric View synonyms, column comments, and curation',
      'Service principal API usage is billed at standard pay-as-you-go Genie pricing',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie-agents/',
    docLabel: 'Genie Spaces & Agents Documentation',
    quickQuestions: [
      {
        label: '🎯 How do I curate a Genie Space for high accuracy?',
        question: 'What are the best practices for curating a Genie Space with Metric Views, lean instructions, verified queries, and benchmarks?',
      },
      {
        label: '⚠️ What are the object limits and governance rules?',
        question: 'What are the table limits, permission rules, and common pitfalls when deploying a Genie Space?',
      },
    ],
  },

  genieAgent: {
    name: 'Genie Agent',
    badge: 'Governed NL Analytics',
    description:
      'A governed conversational analytics agent (Genie Space) grounded strictly on your curated Unity Catalog Metric View. Built through a disciplined 5-step arc: attach only the Metric View, author lean rule-shaped instructions, pin verified `MEASURE()` queries, load ground-truth SQL benchmarks, and run an iterative optimize loop.',
    benefits: [
      'Attaches the governed Metric View under `data_sources.metric_views` (up to 50 objects)',
      'Lean, rule-shaped instructions (<=20 lines) enforce `MEASURE()` and scope boundaries',
      'Verified example queries (`example_question_sqls`) pin proven SQL for top questions',
      'Benchmarks (up to 500 questions) pair user prompts with human-verified ground-truth SQL',
      'Iterative optimize loop maps every benchmark miss to a targeted curation fix',
    ],
    limitations: [
      'Benchmarks without expected ground-truth SQL cannot be automatically scored',
      'Generated benchmark answers must be human-verified to avoid grading Genie against itself',
      'Instruction bloat (>20 lines of prose/formulas) dilutes attention on every turn',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie-agents/best-practices',
    docLabel: 'Curate an Effective Genie Agent Docs',
    quickQuestions: [
      {
        label: '🔁 How does the Benchmark & Optimize loop work?',
        question: 'How do I load benchmarks with expected `MEASURE()` SQL and run the append-only optimize loop to reach ~85%+ accuracy?',
      },
      {
        label: '📏 What belongs in General Instructions vs the Metric View?',
        question: 'What rules belong in a Genie Agent\'s General Instructions (<=20 lines) versus on the Unity Catalog Metric View?',
      },
    ],
  },

  discoverOntology: {
    name: 'Discover Ontology',
    badge: 'Beta · UC Semantics',
    description:
      'The human-modeled business context layer of Unity Catalog semantics in Databricks Discover. Combines business-aligned **Domains & Subdomains**, authoritative **Pages** for core concepts/measures, and **Question-to-Metric-View Routing** so Genie One grounds answers in governed definitions with clickable citations.',
    benefits: [
      'Domains & subdomains organize assets by business purpose using governed tags',
      'Published Pages provide authoritative definitions prioritized and cited by Genie One',
      'Routing Pages turn fragile table inference into a deterministic Metric View lookup',
      'Inherits domain access controls and pairs with asset certification/deprecation',
      'Scales consistent business terminology across teams in Catalog -> Discover',
    ],
    limitations: [
      'Public Preview / Beta feature — requires Genie One Pages enabled in the workspace',
      'Curating domains and Pages requires `MANAGE DISCOVER` or domain `MANAGE` permission',
      'Pages are authored/published in the Discover UI editor (no public headless create API)',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/',
    docLabel: 'Unity Catalog Semantics & Ontology Docs',
    quickQuestions: [
      {
        label: '🧭 How do Domains, Pages, and Routing fit together?',
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
    badge: 'Beta · Governed Tags',
    description:
      'Account-level business organization layer in Databricks Discover (`Catalog → Discover`). Domains group tables, Metric Views, AI/BI Dashboards, Genie Agents, and Pages by business area, and partition into **Subdomains** (one level of nesting) built on governed tags (`{parentDomainTag}/{subdomainName}`).',
    benefits: [
      'Organizes data products and Pages around business areas (e.g. Revenue → Orders, Returns)',
      'Built on Unity Catalog governed tags with `{parentDomainTag}/{subdomainName}` hierarchy',
      'Many-to-many asset assignment; subdomain assets automatically surface in parent domain',
      'Controls access inheritance for all published Discover Pages inside the domain',
      'Supports AI-recommended domains and custom curator-highlighted sections',
    ],
    limitations: [
      'Supports exactly one level of subdomain nesting (subdomains cannot nest further)',
      'Requires `MANAGE DISCOVER` (account) or `MANAGE` (domain) permission to curate',
      'Downstream Page and bulk-import workflows require the internal **Domain ID**, not the name',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/domains',
    docLabel: 'Discover Domains & Subdomains Docs',
    quickQuestions: [
      {
        label: '🆔 Why must I capture Domain & Subdomain IDs?',
        question: 'Why is capturing the internal Domain ID and Subdomain IDs critical when modeling a Discover domain for Pages and bulk imports?',
      },
      {
        label: '🗂️ How do governed tags power Domains & Subdomains?',
        question: 'How do Unity Catalog governed tags (`{parentDomainTag}/{subdomainName}`) and permissions work for Discover Domains and Subdomains?',
      },
    ],
  },

  discoverPages: {
    name: 'Discover Pages',
    badge: 'Beta · Genie One Citations',
    description:
      'Governed, authoritative definitions of business concepts, KPIs, and acronyms authored inside a Discover domain or subdomain. When Genie One answers a question involving a concept defined in a published Page, it prioritizes the Page over inferred context and cites the Page in its response.',
    benefits: [
      'Authoritative ground truth for top measures: plain-language definition + exact `MEASURE()` formula',
      'Captures full synonym lists (acronyms, informal phrasings, legacy names) and negative rules',
      'Links the governed Unity Catalog Metric View directly under `Related assets`',
      'Prioritized by Genie One over automatic inference and surfaced as a clickable citation',
      'Supports rich text, inline `@` asset mentions, and glossary bulk-import drafting',
    ],
    limitations: [
      'Pages are split into chunks before retrieval — every rule sentence must name its measure/table inline',
      'Authored and published in the Discover UI Page editor (Genie Code drafts fields; human publishes)',
      'Draft Pages are only visible to the Page owner; must be Published for organization-wide Genie One use',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/pages',
    docLabel: 'Discover Pages Documentation',
    quickQuestions: [
      {
        label: '✂️ What is the "chunk-safe sentence" rule for Pages?',
        question: 'Why are Discover Pages split into chunks, and how do I write chunk-safe definitions and negative rules that never arrive orphaned?',
      },
      {
        label: '📋 What 5 elements belong in a measure Page?',
        question: 'What are the 5 essential elements to include when drafting a Discover Page for a key business measure?',
      },
    ],
  },

  discoverRouting: {
    name: 'Question-to-Metric-View Routing',
    badge: 'Beta · Highest-ROI Pattern',
    description:
      'A high-leverage Discover Page ("Question to Metric View Routing") that maps every real-world question phrasing—formal name, acronym, informal phrasing, and legacy report term—to the exact governed Unity Catalog Metric View and measure, replacing fragile table inference with a deterministic lookup.',
    benefits: [
      'Highest-return ontology exercise: turns "guess the table" inference into a curated lookup',
      'Covers every measure in the signed-off inventory in a flat phrasing → (Metric View, measure) table',
      'Resolves sloppy phrasings ("top line", "net sales", "sales $") to the same governed measure',
      'Links the governed Metric View as a related asset and assigns a named domain owner',
      'Eliminates "right calculation, wrong raw table" errors across Genie One conversations',
    ],
    limitations: [
      'Must be kept in sync as new measures or Metric Views are added to the domain',
      'Requires a named owner and published status in the Discover domain to ground all users',
      'Works alongside (not as a replacement for) Metric View YAML v1.1 `synonyms:`',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/uc-semantics/pages',
    docLabel: 'Discover Pages & Routing Docs',
    quickQuestions: [
      {
        label: '🗺️ How do I structure a Routing Page table?',
        question: 'Show me an example of a "Question to Metric View Routing" Page table mapping formal, acronym, informal, and legacy phrasings to a Metric View.',
      },
      {
        label: '💡 Why does lookup beat inference for Genie?',
        question: 'Why do most Genie misses happen from choosing the wrong source table, and how does a Routing Page solve that?',
      },
    ],
  },

  syncedTables: {
    name: 'Synced Tables',
    badge: 'GA · Reverse ETL',
    description:
      'Managed reverse-ETL pipelines (powered by Lakeflow) that sync curated Unity Catalog Gold tables into Lakebase Postgres (`_synced` read-only tables) so operational apps serve governed analytics with sub-10ms OLTP latency alongside transactional data.',
    benefits: [
      'Three sync modes: Snapshot (full copy), Triggered (scheduled incremental), Continuous (seconds latency)',
      'Fully managed Lakeflow sync pipeline — no custom ETL scripts or external orchestrators',
      'Optional LTAP Direct Writes (Postgres 16–18) accelerate bulk loads without taxing compute endpoints',
      'Supports write-time Delta Change Data Feed (CDF) and read-time Automatic CDF (Public Preview)',
      'Enables single-query Postgres joins between live app tables and governed Lakehouse Gold metrics',
    ],
    limitations: [
      'Never sync a Metric View directly — sync the underlying Gold dimension and fact tables',
      'Triggered and Continuous modes require a Primary Key and Change Data Feed (or Automatic CDF)',
      'Synced tables in Lakebase are read-only (up to 16 connections per sync pipeline)',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables',
    docLabel: 'Lakebase Synced Tables Documentation',
    quickQuestions: [
      {
        label: '🔄 Snapshot vs Triggered vs Continuous sync mode?',
        question: 'How do I choose between Snapshot, Triggered, and Continuous sync modes for Lakebase Synced Tables, and when is CDF required?',
      },
      {
        label: '⚠️ Why sync Gold tables instead of Metric Views?',
        question: 'Why must I sync the base Gold fact and dimension tables into Lakebase rather than syncing a Metric View directly?',
      },
    ],
  },

  aiBIDashboards: {
    name: 'AI/BI Dashboards',
    badge: 'Lakeview · Native BI',
    description:
      'Native, serverless business intelligence dashboards (`.lvdash.json`) built into Databricks. Query Unity Catalog Metric Views directly with `MEASURE()` for KPIs and breakdowns, use the low-code Metric View UI, enable cross-filtering and Dashboard Insights, and deploy via Asset Bundles.',
    benefits: [
      'Zero per-viewer licensing — share governed dashboards across the entire organization',
      'Native Metric View integration: `MEASURE()` for KPIs/trends + low-code local/UC metric view UI',
      'Interactive cross-filtering, faceted counters, pivot drill-down, and Global Filter pages',
      'AI-assisted authoring with Genie Code (automatic semantic validation) + embedded Genie Q&A',
      'Version-controlled as `.lvdash.json` artifacts and deployed via Databricks Asset Bundles',
    ],
    limitations: [
      'Use a mixed dataset strategy: `MEASURE()` on Metric Views for KPIs; direct Gold SQL for detail/filter lists',
      '6-column canvas grid (widget widths 1–6) and exact `fieldName`-to-SQL-alias matching required',
      'Unity Catalog metric views that define `parameters` cannot be locally extended in a dashboard',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dashboards/',
    docLabel: 'AI/BI Dashboards Documentation',
    quickQuestions: [
      {
        label: '📊 How do AI/BI Dashboards query Metric Views?',
        question: 'What is the recommended mixed dataset strategy (`MEASURE()` on Metric Views vs direct Gold SQL) when building an AI/BI Dashboard?',
      },
      {
        label: '📦 How are `.lvdash.json` dashboards deployed in bundles?',
        question: 'How do I extract an `.lvdash.json` definition and deploy an AI/BI Dashboard with Databricks Asset Bundles?',
      },
    ],
  },

  agents: {
    name: 'Databricks Agents',
    badge: 'Mosaic AI',
    description:
      'Build, evaluate, register, and deploy enterprise AI agents on Mosaic AI. Connect foundation models to governed Unity Catalog data, Genie Spaces, Vector Search, and MCP tools with full MLflow 3 observability and AI Gateway guardrails.',
    benefits: [
      'Grounded on governed enterprise data via Genie Spaces, UC Functions, and Vector Search',
      'End-to-end lifecycle with Mosaic AI Agent Framework and MLflow 3 Evaluation',
      'Scale-to-zero Model Serving endpoints with AI Gateway rate limits and guardrails',
      'Supports multi-agent supervisor patterns orchestrating specialized domain agents',
      'Full trace observability, inference table logging, and human Review App sign-off',
    ],
    limitations: [
      'Requires clear tool descriptions and system prompts for deterministic tool routing',
      'Multi-turn tool-calling increases foundation model token consumption and latency',
      'On-behalf-of-user data access requires explicit credential forwarding configuration',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agents Documentation',
    quickQuestions: [
      {
        label: '🤖 How do Mosaic AI Agents connect to Genie & UC?',
        question: 'How do I wire a Mosaic AI Agent to query Genie Spaces, Unity Catalog Functions, and Vector Search?',
      },
      {
        label: '🛡️ How are agents governed and monitored in production?',
        question: 'How do Unity Catalog permissions, AI Gateway guardrails, and MLflow 3 monitoring work for Databricks Agents?',
      },
    ],
  },

  agentFramework: {
    name: 'Agent Framework',
    badge: 'ResponsesAgent',
    description:
      'The Mosaic AI Agent Framework lets you author production-grade agents using the `ResponsesAgent` (recommended) or `ChatAgent` interfaces. Framework-agnostic (LangGraph, OpenAI Agents SDK, LlamaIndex, custom Python) with automatic MLflow 3 signature inference and native Playground, Evaluation, and Apps compatibility.',
    benefits: [
      '`ResponsesAgent` recommended primary interface with automatic MLflow signature inference',
      'Bring any orchestrator: LangGraph, OpenAI Agents SDK, LlamaIndex, or custom Python',
      'Supports streaming responses, tool-call traces, and on-behalf-of-user authentication',
      'Seamless drop-in compatibility with AI Playground, Agent Evaluation, and Databricks Apps',
      'Single `mlflow.models.log_model` + Unity Catalog registration + `agents.deploy()` workflow',
    ],
    limitations: [
      'Requires Python and familiarity with async/streaming generator patterns for custom UIs',
      'Reasoning and tool-selection quality depend on the underlying Foundation Model endpoint',
      'Stateless by default unless paired with Lakebase Memory checkpointers',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agent Framework Docs',
    quickQuestions: [
      {
        label: '🧱 Why is `ResponsesAgent` recommended over `ChatAgent`?',
        question: 'What are the advantages of building with `ResponsesAgent` in the Mosaic AI Agent Framework and how does it handle streaming and tool calls?',
      },
      {
        label: '🚀 How do I log and deploy an agent to Unity Catalog?',
        question: 'What are the steps to log a `ResponsesAgent` with MLflow 3, register it in Unity Catalog, and deploy it?',
      },
    ],
  },

  toolsMcp: {
    name: 'Tools & MCP',
    badge: 'Model Context Protocol',
    description:
      'Connect agents to enterprise capabilities via the standardized Model Context Protocol (MCP). Supports three server architectures on Databricks: **Managed MCP** (Unity Catalog Functions, Vector Search, Genie Spaces, DBSQL), **External MCP** (OAuth third-party services), and **Custom MCP** (hosted on Databricks Apps).',
    benefits: [
      'Open MCP standard lets agents discover and invoke tools uniformly across frameworks',
      'Managed MCP servers expose UC Functions, Vector Search, Genie, and SQL with zero infra',
      'Automatic Unity Catalog governance and on-behalf-of-user credential propagation',
      'External MCP servers connect third-party SaaS tools via governed UC OAuth connections',
      'Custom MCP servers wrap proprietary APIs as a scalable Databricks App',
    ],
    limitations: [
      'External MCP servers require Unity Catalog HTTP connection and OAuth handshake setup',
      'Custom MCP servers add a separate Databricks App lifecycle to deploy and maintain',
      'Large tool catalogs increase prompt context tokens — scope tools to the agent domain',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/mcp',
    docLabel: 'MCP on Databricks Documentation',
    quickQuestions: [
      {
        label: '🔌 Managed vs External vs Custom MCP servers?',
        question: 'What is the difference between Managed, External, and Custom MCP servers on Databricks and when should I use each?',
      },
      {
        label: '🔐 How does on-behalf-of-user auth work with MCP?',
        question: 'How do MCP tools enforce Unity Catalog permissions using on-behalf-of-user authentication?',
      },
    ],
  },

  lakebaseMemory: {
    name: 'Lakebase Memory',
    badge: 'Short & Long-Term State',
    description:
      'Persist stateful agent memory on Lakebase Postgres. **Short-term memory** uses a LangGraph (or OpenAI Agents SDK) Postgres checkpointer keyed by `thread_id` for multi-turn continuity; **long-term memory** extracts user insights into Lakebase tables indexed with `lakebase_vector` or Mosaic AI Vector Search.',
    benefits: [
      'Short-term conversational state survives across stateless HTTP requests (`thread_id`)',
      'Long-term semantic memory recalls user preferences and prior facts across sessions',
      'Reuses your existing Lakebase Postgres instance — no separate Redis or vector DB needed',
      'Supports hybrid vector + keyword recall via Lakebase Search (`lakebase_vector`) or UC Vector Search',
      'Unified Postgres governance and ACID reliability for both app data and agent state',
    ],
    limitations: [
      'Long-term memory requires an async extraction step to summarize and store facts',
      'Unbounded thread checkpoint growth requires TTL / retention cleanup policies',
      'Connection pooling must be configured properly for concurrent streaming agent turns',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/projects/lakehouse-integrations',
    docLabel: 'Lakebase Agent State & Memory Docs',
    quickQuestions: [
      {
        label: '🧠 Short-term checkpointer vs Long-term memory?',
        question: 'How do I implement both short-term `thread_id` checkpointing and long-term semantic memory on Lakebase Postgres?',
      },
      {
        label: '⚡ How do I manage connection pooling & TTL?',
        question: 'What are the best practices for Postgres connection pooling and checkpoint retention when using Lakebase Memory?',
      },
    ],
  },

  mlflowPromptRegistry: {
    name: 'Prompt Registry',
    badge: 'MLflow 3 · @production',
    description:
      'MLflow 3 Prompt Registry provides Git-style version control for prompt templates in Unity Catalog, complete with mutable deployment aliases (`@production`, `@staging`). Decouple prompts from agent code so you can iterate, evaluate, and roll back prompts without redeploying.',
    benefits: [
      'Immutable Git-style commit history and side-by-side diffs for every prompt revision',
      'Aliases (`@production`, `@staging`) let agents resolve live prompts dynamically at runtime',
      'Decouples prompt engineering from application/endpoint container redeployments',
      'Automatic lineage linking prompt versions to `mlflow.genai.evaluate()` runs and traces',
      'Governed in Unity Catalog alongside models, functions, and evaluation datasets',
    ],
    limitations: [
      'Requires `mlflow >= 3.3.0` and Unity Catalog prompt registry support',
      'Moving the `@production` alias immediately changes live agent behavior — gate with evals',
      'Template variable schemas (`{{var}}`) must stay compatible with caller code',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/evaluate-prompts',
    docLabel: 'MLflow 3 Prompt Registry Docs',
    quickQuestions: [
      {
        label: '🏷️ How do `@production` and `@staging` aliases work?',
        question: 'How do I register a prompt in MLflow 3, promote it with `@staging` and `@production` aliases, and load it inside an agent?',
      },
      {
        label: '🔄 How do I compare prompt versions with `mlflow.genai.evaluate`?',
        question: 'How do I run `mlflow.genai.evaluate()` across two different Prompt Registry versions before promoting to `@production`?',
      },
    ],
  },

  mlflowEval: {
    name: 'MLflow Evaluation',
    badge: 'MLflow 3 · LLM Judges',
    description:
      'Systematic quality gates for GenAI agents using `mlflow.genai.evaluate()`. Curate repeatable evaluation datasets in Unity Catalog, score responses with built-in and custom LLM judges (`Correctness`, `RetrievalGroundedness`, `Guidelines`, code scorers), and collect SME sign-off in the Review App.',
    benefits: [
      'Unity Catalog evaluation datasets ensure repeatable, apples-to-apples benchmark runs',
      'Built-in Mosaic AI judges (`Correctness`, `Safety`, `RetrievalGroundedness`, `Guidelines`)',
      'Custom Python code scorers and `@scorer` decorators for deterministic domain rules',
      'Full span-level MLflow Traces pinpoint exact tool-call or retrieval failures',
      'Stakeholder Review App captures human ratings and feedback directly into eval tables',
    ],
    limitations: [
      'LLM-as-a-judge evaluation runs incur foundation model token costs',
      'Evaluation datasets must evolve continuously to reflect real production edge cases',
      'Judge guidelines must be specific and unambiguous to avoid noisy pass/fail scores',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/judges',
    docLabel: 'MLflow 3 Evaluation & Judges Docs',
    quickQuestions: [
      {
        label: '⚖️ Built-in Judges vs `Guidelines` vs Custom Scorers?',
        question: 'When should I use built-in MLflow 3 judges (`Correctness`, `RetrievalGroundedness`), `Guidelines` judges, or custom Python code scorers?',
      },
      {
        label: '👥 How does human sign-off work in the Review App?',
        question: 'How do domain experts use the MLflow Review App to inspect traces and sign off on agent quality before promotion?',
      },
    ],
  },

  mlflowMonitoring: {
    name: 'Production Monitoring',
    badge: 'AI Gateway + Scheduled Scorers',
    description:
      'Continuous quality and drift observability in production. Capture every live request, response, and trace via **AI Gateway-enabled inference tables**, then attach **MLflow 3 scheduled scorers** (`scorer.register()` / `.start()`) at a configurable sampling rate (`0.0–1.0`) to grade live traffic automatically.',
    benefits: [
      'AI Gateway-enabled inference tables log full production payloads and MLflow traces',
      'Scheduled scorers (`scorer.register()` / `.start()`) evaluate live traffic without redeploying',
      'Configurable `sample_rate` (0.0 to 1.0) balances observability coverage with judge cost',
      'Reuses the exact same MLflow 3 judges and custom scorers used in offline evaluation',
      'Outputs land in Unity Catalog tables ready to power AI/BI Monitoring Dashboards & Alerts',
    ],
    limitations: [
      'Maximum of 20 scheduled scorers per MLflow experiment',
      'Legacy inference tables are deprecated (use AI Gateway-enabled inference tables)',
      'Asynchronous scorer execution has a minute-scale lag behind real-time requests',
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/run-scorer-in-prod',
    docLabel: 'MLflow 3 Production Monitoring Docs',
    quickQuestions: [
      {
        label: '📈 How do I register & start a scheduled scorer in prod?',
        question: 'How do I enable AI Gateway inference tables and register an MLflow 3 scheduled scorer with `sample_rate` on production traffic?',
      },
      {
        label: '⚠️ What are the limits and cost controls for prod scoring?',
        question: 'What are the scorer limits per experiment, sampling rate best practices, and AI Gateway requirements for production monitoring?',
      },
    ],
  },
};

export type ServiceKey = keyof typeof serviceData;
