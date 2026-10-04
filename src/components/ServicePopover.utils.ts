// Databricks service definitions shared by ServicePopover, TypingText and
// CelebrationOverlay. Kept out of ServicePopover.tsx so that file only exports
// components (react-refresh/only-export-components).

export interface ServiceInfo {
  name: string;
  description: string;
  benefits: string[];
  limitations: string[];
  docUrl: string;
  docLabel: string;
}

// =============================================================================
// SERVICE DATA - All Databricks services
// =============================================================================

export const serviceData: Record<string, ServiceInfo> = {
  databricksApp: {
    name: 'Databricks Apps',
    description: 'Host and deploy custom web applications directly on the Databricks platform. Build full-stack apps with React, Python, or any framework while leveraging Databricks security and governance.',
    benefits: [
      'No separate hosting infrastructure needed',
      'Integrated OAuth and SSO authentication',
      'Direct access to Databricks services and data',
      'Automatic scaling and load balancing',
      'Built-in CI/CD with asset bundles'
    ],
    limitations: [
      'Currently supports specific frameworks and runtimes',
      'Compute resources tied to Databricks pricing',
      'Limited to web application use cases'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/what-is',
    docLabel: 'Databricks Apps Documentation'
  },
  lakebase: {
    name: 'Lakebase (PostgreSQL)',
    description: 'Fully managed PostgreSQL database service built into Databricks. Perfect for transactional workloads, application backends, and operational data that needs ACID compliance.',
    benefits: [
      'Fully managed PostgreSQL - no infrastructure to manage',
      'Automatic backups and point-in-time recovery',
      'Native integration with Lakehouse via mirroring',
      'Standard PostgreSQL compatibility',
      'Unified security with Databricks governance'
    ],
    limitations: [
      'Best suited for transactional workloads, not analytics',
      'Storage limits compared to Delta Lake',
      'PostgreSQL-specific features only'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp',
    docLabel: 'Lakebase Documentation'
  },
  dataIngestion: {
    name: 'Data Ingestion Pipeline',
    description: 'Automated pipelines that sync data from Lakebase (or external sources) into the Lakehouse. Uses change data capture (CDC) to efficiently replicate operational data.',
    benefits: [
      'Automatic CDC-based incremental sync',
      'Near real-time data replication',
      'Schema evolution support',
      'Built-in data quality checks',
      'Declarative pipeline configuration'
    ],
    limitations: [
      'Initial full sync can be resource-intensive',
      'Some complex data types may need transformation',
      'Latency depends on source system'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp',
    docLabel: 'Lakebase Mirroring Documentation'
  },
  bronze: {
    name: 'Bronze Layer',
    description: 'The raw data landing zone in the medallion architecture. Bronze tables store data exactly as received from source systems, preserving the original format for auditability.',
    benefits: [
      'Complete data lineage and auditability',
      'Preserves raw data for reprocessing',
      'Supports schema-on-read flexibility',
      'Enables time travel and versioning',
      'Foundation for data quality checks'
    ],
    limitations: [
      'Data may contain duplicates and errors',
      'Not optimized for direct analytics queries',
      'Requires downstream processing for usability'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  silver: {
    name: 'Silver Layer',
    description: 'Cleaned and conformed data ready for analysis. Silver tables apply data quality rules, deduplication, and standardization while maintaining full lineage back to bronze.',
    benefits: [
      'Clean, deduplicated, validated data',
      'Standardized schemas across sources',
      'Optimized for analytical queries',
      'Data quality metrics and monitoring',
      'Supports both batch and streaming'
    ],
    limitations: [
      'Requires clear business rules for transformation',
      'Processing adds latency to data freshness',
      'Schema changes need careful management'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  gold: {
    name: 'Gold Layer',
    description: 'Business-ready, aggregated data optimized for reporting and analytics. Gold tables contain curated datasets, KPIs, and metrics aligned with business domains.',
    benefits: [
      'Business-aligned, consumption-ready data',
      'Pre-aggregated for fast query performance',
      'Semantic consistency across organization',
      'Direct integration with BI tools',
      'Governed and documented datasets'
    ],
    limitations: [
      'Requires ongoing business alignment',
      'Aggregations may lose granular detail',
      'Multiple gold tables for different use cases'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  sdp: {
    name: 'Spark Declarative Pipelines (SDP)',
    description: 'Declarative approach to building reliable data pipelines. Define transformations and quality expectations in SQL or Python, and let Databricks handle orchestration.',
    benefits: [
      'Declarative syntax reduces boilerplate code',
      'Built-in data quality expectations',
      'Automatic dependency management',
      'Enhanced observability and lineage',
      'Supports incremental processing'
    ],
    limitations: [
      'Learning curve for declarative paradigm',
      'Some complex transformations need custom code',
      'Debugging can be different from traditional jobs'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dlt/',
    docLabel: 'Spark Declarative Pipelines Documentation'
  },
  tvf: {
    name: 'Table Value Functions (TVFs)',
    description: 'Reusable SQL functions that return tables. TVFs encapsulate complex query logic, enable parameterized data access, and provide governed data products.',
    benefits: [
      'Encapsulate complex business logic',
      'Parameterized, reusable queries',
      'Row-level security implementation',
      'Simplified data consumption',
      'Version-controlled like tables'
    ],
    limitations: [
      'SQL knowledge required for creation',
      'Performance depends on underlying queries',
      'Not all BI tools support TVF syntax directly'
    ],
    docUrl: 'https://docs.databricks.com/en/sql/language-manual/sql-ref-syntax-qry-select-tvf.html',
    docLabel: 'SQL Table Functions'
  },
  metricViews: {
    name: 'Metric Views',
    description: 'Standardized business metric definitions that ensure consistent calculations across all analytics. Define metrics once, use everywhere with governed semantic layer.',
    benefits: [
      'Single source of truth for metrics',
      'Consistent calculations organization-wide',
      'Self-service analytics enablement',
      'Automatic aggregation and filtering',
      'Integration with Genie and dashboards'
    ],
    limitations: [
      'Requires upfront metric definition work',
      'Changes affect all downstream consumers',
      'Complex metrics may need custom logic'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/metric-views',
    docLabel: 'Metric Views Documentation'
  },
  genieSpaces: {
    name: 'Genie Spaces',
    description: 'Natural language interface for data exploration. Business users can ask questions in plain English and get instant answers, charts, and insights from governed data.',
    benefits: [
      'Natural language data queries',
      'No SQL knowledge required for users',
      'Governed by underlying data permissions',
      'Integrates with curated gold tables',
      'Conversational follow-up questions'
    ],
    limitations: [
      'Quality depends on data documentation',
      'Complex analytical queries may need refinement',
      'Requires well-structured gold layer'
    ],
    docUrl: 'https://docs.databricks.com/en/genie/index.html',
    docLabel: 'Genie Spaces Documentation'
  },
  genieAgent: {
    name: 'Genie Agent',
    description: 'A governed conversational analytics agent grounded on a curated Metric View and verified queries. You author instructions, add verified queries, benchmark accuracy, and run an optimize loop to steadily improve answer quality.',
    benefits: [
      'Natural language questions over governed metrics',
      'Verified queries pin known-good SQL for accuracy',
      'Benchmarks measure and track answer quality',
      'Optimize loop iteratively improves instructions',
      'Inherits Unity Catalog permissions and lineage'
    ],
    limitations: [
      'Answer quality depends on Metric View + synonyms',
      'Verified queries and benchmarks need curation',
      'Ambiguous questions may need routing/ontology'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie/',
    docLabel: 'Genie Documentation'
  },
  discoverOntology: {
    name: 'Discover Ontology',
    description: 'Model the business ontology that routes questions to the right data: domains, pages, and routing rules. The ontology helps the Genie Agent disambiguate intent and direct each query to the correct governed asset.',
    benefits: [
      'Organizes metrics into business domains',
      'Pages group related questions and assets',
      'Routing sends questions to the right space',
      'Improves accuracy on ambiguous questions',
      'Scales governed analytics across teams'
    ],
    limitations: [
      'Requires upfront domain modeling',
      'Routing rules need maintenance as data evolves',
      'Overlapping domains can complicate routing'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/genie/',
    docLabel: 'Genie Documentation'
  },
  syncedTables: {
    name: 'Synced Tables',
    description: 'Continuously sync curated Gold tables from the Lakehouse into Lakebase (managed Postgres) so operational apps can serve governed analytics with low latency — the reverse-ETL activation step of the Genie arc.',
    benefits: [
      'Low-latency reads for apps from Postgres',
      'Keeps Lakebase in sync with governed Gold data',
      'Powers Databricks Apps + embedded Genie',
      'Managed sync — no custom pipelines to maintain',
      'Preserves Unity Catalog governance upstream'
    ],
    limitations: [
      'Sync cadence introduces some data latency',
      'Requires a Lakebase (Postgres) instance',
      'Best for curated Gold, not raw/high-churn tables'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp/',
    docLabel: 'Lakebase Documentation'
  },
  aiBIDashboards: {
    name: 'AI/BI Dashboards',
    description: 'Native business intelligence dashboards built into Databricks. Create interactive visualizations, reports, and analytics directly on your Lakehouse data.',
    benefits: [
      'No per-user or per-viewer licensing',
      'Lives as close to actual data as possible',
      'Integrated Genie for conversational analytics',
      'Uses same compute as notebooks and pipelines',
      'Approaching feature parity with PowerBI'
    ],
    limitations: [
      'Newer product, still expanding features',
      'Migration from existing BI tools takes effort',
      'Advanced visualizations still maturing'
    ],
    docUrl: 'https://docs.databricks.com/en/ai-bi/index.html',
    docLabel: 'AI/BI Dashboards Documentation'
  },
  agents: {
    name: 'Databricks Agents',
    description: 'Build and deploy AI agents that can reason, take actions, and interact with your data and applications. Powered by foundation models with enterprise guardrails.',
    benefits: [
      'Pre-built agent frameworks and tools',
      'Integration with Genie and data catalog',
      'Enterprise-grade security and governance',
      'Model serving with automatic scaling',
      'Evaluation and monitoring built-in'
    ],
    limitations: [
      'Requires ML/AI expertise for custom agents',
      'Token costs for foundation models',
      'Complex agent logic needs careful design'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Databricks Agents Documentation'
  },
  agentFramework: {
    name: 'Agent Framework',
    description: 'The Mosaic AI Agent Framework lets you build production-grade agents with the ResponsesAgent or ChatAgent interfaces. Framework-agnostic (LangGraph, LlamaIndex, OpenAI SDK, custom Python) with automatic MLflow signature inference and native compatibility with Playground, Agent Evaluation, and Databricks Apps.',
    benefits: [
      'ResponsesAgent recommended primary interface — auto MLflow signature inference',
      'ChatAgent for streaming + markdown + persistent chat UI',
      'Bring any agent framework (LangGraph, LlamaIndex, OpenAI SDK, custom)',
      'Native Playground / Agent Evaluation / Apps integration',
      'Single agent definition deploys via mlflow.models.log_model + agents.deploy'
    ],
    limitations: [
      'Requires Python and basic ML serving familiarity',
      'Agent reasoning quality depends on the underlying foundation model',
      'Streaming responses require careful client wiring'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agent Framework Documentation'
  },
  toolsMcp: {
    name: 'Tools & MCP',
    description: 'Connect agents to capabilities via Model Context Protocol (MCP). Three server types: Managed (Unity Catalog Functions, Vector Search, Genie Spaces, Databricks SQL), External (OAuth-connected third-party MCP servers), and Custom (proprietary tools hosted as a Databricks App).',
    benefits: [
      'Standardized MCP protocol — agents reuse tools across frameworks',
      'Managed servers handle auth, governance, and lifecycle automatically',
      'Unity Catalog Functions become callable tools with one decorator',
      'Vector Search + Genie Spaces give grounded retrieval and SQL access',
      'Custom servers let you wrap proprietary APIs behind a uniform interface'
    ],
    limitations: [
      'External MCP servers require OAuth and approval flow setup',
      'Custom servers add an extra Databricks App to manage',
      'Token costs scale with tool-call count'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/mcp',
    docLabel: 'MCP on Databricks Documentation'
  },
  lakebaseMemory: {
    name: 'Lakebase Memory',
    description: 'Persist agent conversation state on Lakebase Postgres. Short-term memory uses a LangGraph (or OpenAI Agents SDK) checkpointer keyed by thread_id. Long-term memory extracts key insights into a Lakebase table that the agent queries via Mosaic AI Vector Search.',
    benefits: [
      'Short-term memory survives across requests (LangGraph thread_id checkpoint)',
      'Long-term memory enables personalization across sessions',
      'Reuses the existing Lakebase instance — no extra infra',
      'Same Postgres governance covers both UI data and agent memory',
      'Vector Search over insight extracts gives semantic recall'
    ],
    limitations: [
      'Long-term memory needs a curation/extraction pipeline',
      'Vector Search index updates have minutes-scale latency',
      'Memory growth requires retention policies'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/stateful-agents',
    docLabel: 'Stateful Agents on Lakebase Documentation'
  },
  mlflowPromptRegistry: {
    name: 'Prompt Registry',
    description: 'MLflow 3 Prompt Registry provides git-style versioning for prompts, including aliases (e.g. @production, @staging) for promotion. Pin agents to specific prompt versions and roll back without redeploying code.',
    benefits: [
      'Git-style version history per prompt',
      'Aliases (@production, @staging, etc.) for safe promotion',
      'Diff views across versions',
      'Prompts decoupled from agent code',
      'Native integration with mlflow.genai.evaluate'
    ],
    limitations: [
      'Requires MLflow 3 (mlflow >= 3.3.0)',
      'Aliases are mutable — treat promotion as a deployment event',
      'Prompts are text-only; structured templates need versioning convention'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/evaluate-prompts',
    docLabel: 'MLflow 3 Prompt Registry Documentation'
  },
  mlflowEval: {
    name: 'MLflow Evaluation',
    description: 'Curate evaluation datasets in Unity Catalog, define scorers and LLM-as-judge graders (Correctness, RetrievalGroundedness, Guidelines, Custom, Code-based), then run mlflow.genai.evaluate() across prompt and model variants. Inspect traces and capture human ratings via the Review App.',
    benefits: [
      'Curated UC-table datasets — same dataset across runs for fair comparison',
      'Built-in judges + Guidelines + Custom Python scorers',
      'Side-by-side evaluation runs in the MLflow UI',
      'Review App for human ratings + sign-off',
      'Traces capture every tool call for debugging'
    ],
    limitations: [
      'LLM-judge scoring incurs token costs',
      'Eval datasets need refresh as the use case evolves',
      'Some judges are still in preview'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/judges',
    docLabel: 'MLflow 3 Evaluation Documentation'
  },
  mlflowMonitoring: {
    name: 'Production Monitoring',
    description: 'Enable AI Gateway-enabled inference tables to capture every production request and response, then run MLflow 3 scheduled scorers (scorer.register() / .start()) at a configurable sampling rate (0.0–1.0, max 20 scorers per experiment) to detect quality drift in production.',
    benefits: [
      'AI Gateway-enabled inference tables (legacy tables deprecated 2026-04-30)',
      'Scheduled scorers run continuously without redeploying the agent',
      'Sampling rate keeps cost predictable',
      'Surface drift in an AI/BI dashboard wired to scorer outputs',
      'Ties production traffic back to MLflow experiment runs'
    ],
    limitations: [
      'Max 20 scheduled scorers per MLflow experiment',
      'Scorer cadence has minute-scale floor',
      'AI Gateway must be enabled on the serving endpoint'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/run-scorer-in-prod',
    docLabel: 'MLflow 3 Production Monitoring Documentation'
  }
};

export type ServiceKey = keyof typeof serviceData;
