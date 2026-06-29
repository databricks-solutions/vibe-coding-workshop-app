/**
 * Skills Navigator data — ported verbatim from
 * presentations/workshop-explorer.html (vibe-coding-workshop-template).
 *
 * GENERATED via scripts/extract (one-off). Edit the source HTML and re-extract
 * rather than hand-editing the large content strings below.
 *
 * `desc`, `rationale`, `content`, and tour `tree` fields contain trusted,
 * static HTML authored in the template repo. They are rendered with
 * dangerouslySetInnerHTML inside the scoped `.skills-navigator` styling.
 */

export type SkillNavType =
  | 'orchestrator' | 'worker' | 'common' | 'entry' | 'platform' | string;

export interface NavSkill {
  id: string;
  name: string;
  domain?: string;
  component?: string;
  type: SkillNavType;
  stage?: number | string;
  phase?: number;
  platform?: string;
  desc?: string;
  keywords?: string[];
  workers?: string[];
  commonDeps?: string[];
  emits?: string[];
  code?: string;
  rationale?: string;
  prompt?: string;
}

export interface NavStage { num: string; label: string; sc: string; orch: string; }
export interface NavPhase { num: number; label: string; skills: string[]; }

export interface TourStep {
  expand?: string[];
  activate?: string[];
  lit?: string[];
  narration: string;
  tier?: [number, string];
  skillIds?: string[];
  designRationale?: string;
  inputOutput?: { inputs: string[]; outputs: string[] };
  summary?: boolean;
}
export interface Tour { name: string; tree: string; steps: TourStep[]; }

export interface AcademyQuizQ { q: string; opts: string[]; answer: number; }
export interface AcademyModule {
  id: string; title: string; subtitle: string; icon: string; color: string;
  content: string; quiz?: AcademyQuizQ[];
}

export const SKILLS: NavSkill[] = [
  {
    "id": "gold-00",
    "name": "Gold Layer Design",
    "domain": "gold",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 1,
    "platform": "medallion",
    "desc": "<strong>What This Stage Does</strong><br>Takes a customer schema CSV and produces a complete dimensional model — YAML schemas, ERD diagrams, lineage tracking, and business documentation — before any pipeline code is written.<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Parse schema CSV</span> → classify tables (fact vs dimension)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Design dimensional model</span> → grains, SCDs, bus matrix<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ Generate YAML schemas</span> → one .yaml per table (SSOT)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Create ERD diagrams</span> → Mermaid master + domain + summary<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">⑤ Build lineage CSV</span> → every Gold column traced to Bronze source<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">⑥ Cross-validate</span> → YAML ↔ ERD ↔ lineage must agree</div><br><strong>Why Gold first?</strong> The Gold layer defines what questions the business can answer. Designing it first catches schema mismatches when they cost minutes, not days of rework.",
    "keywords": [
      "Gold design",
      "dimensional model",
      "ERD",
      "YAML schema",
      "schema CSV"
    ],
    "workers": [
      "gold-dw-01",
      "gold-dw-02",
      "gold-dw-03",
      "gold-dw-04",
      "gold-dw-05",
      "gold-dw-06",
      "gold-dw-07"
    ],
    "commonDeps": [
      "common-expert",
      "common-naming"
    ],
    "emits": [
      "gold_layer_design/yaml/*.yaml",
      "gold_layer_design/erd_master.md"
    ],
    "code": "clustering: auto\ntable_properties:\n  delta.enableChangeDataFeed: \"true\"\n  delta.enableRowTracking: \"true\"\n  layer: \"gold\"",
    "rationale": "<em>Design-first architecture</em>: the Gold layer is designed as a dimensional model before any Bronze or Silver code is written. This inverts the traditional \"ingest first, model later\" approach. Discovering a grain mismatch after building 15 Silver pipelines means rework across every layer. By designing Gold first, the schema CSV drives the entire pipeline shape top-down — catching errors when they cost minutes, not days.",
    "prompt": "Please design the Gold layer using\n@data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md"
  },
  {
    "id": "gold-dw-01",
    "name": "Grain Definition",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Decides the grain (granularity) of each fact table using a decision tree: transaction grain (one row per event), periodic snapshot (one row per time period), or accumulating snapshot (one row per lifecycle with milestone timestamps).",
    "keywords": [
      "grain",
      "fact granularity"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Transaction grain: one row per booking event\nCREATE TABLE fact_bookings (\n  booking_key bigint,\n  guest_key bigint,\n  property_key bigint,\n  date_key int,\n  revenue numeric(10,2)\n);\n-- Accumulating: one row per booking lifecycle\nCREATE TABLE fact_booking_lifecycle (\n  booking_key bigint,\n  created_date_key int,\n  confirmed_date_key int,  -- NULL until confirmed\n  checked_in_date_key int  -- NULL until check-in\n);",
    "rationale": "Grain is the <em>single most important modeling decision</em>. Getting it wrong means either losing detail (too coarse) or creating massive tables (too fine). The decision tree considers: Is there a natural event? → transaction. Need time-series snapshots? → periodic. Need to track milestones? → accumulating."
  },
  {
    "id": "gold-dw-02",
    "name": "Dimension Patterns",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Implements dimension table patterns: SCD Type 1 (overwrite), SCD Type 2 (history with effective dates), role-playing dimensions (same table, multiple FK roles), junk dimensions (flag consolidation), and degenerate dimensions (fact-embedded attributes).",
    "keywords": [
      "dimension",
      "SCD",
      "role-playing"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- SCD Type 2: track history with effective dates\nALTER TABLE dim_customer ADD COLUMNS (\n  effective_from DATE,\n  effective_to DATE,\n  is_current BOOLEAN\n);\n-- Role-playing: same dim_date used for multiple FKs\n-- fact_bookings.check_in_date_key → dim_date\n-- fact_bookings.check_out_date_key → dim_date",
    "rationale": "SCD Type 2 is the <em>default for business-critical dimensions</em> because losing history means losing the ability to analyze trends. Role-playing dimensions avoid table duplication — one dim_date table serves check-in, check-out, booking, and cancellation dates."
  },
  {
    "id": "gold-dw-03",
    "name": "Fact Table Patterns",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Handles measure additivity (additive, semi-additive, non-additive), factless facts for event tracking, and bridge tables for many-to-many relationships.",
    "keywords": [
      "fact",
      "measure",
      "additivity"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Semi-additive: can SUM across dimensions but not time\n-- balance can be summed across accounts but not dates\nSELECT property_key, MAX(occupancy_rate) -- not SUM!\nFROM fact_daily_occupancy\nGROUP BY property_key;\n\n-- Factless fact: records events with no measures\nCREATE TABLE fact_guest_checkin (\n  guest_key bigint,\n  property_key bigint,\n  checkin_date_key int  -- no measures, just the event\n);",
    "rationale": "Additivity determines which aggregation functions are valid. Using SUM on a non-additive measure like \"occupancy rate\" produces nonsense. The skill enforces correct aggregation annotations in the YAML schema so downstream queries and Metric Views use the right functions."
  },
  {
    "id": "gold-dw-04",
    "name": "Conformed Dimensions",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Builds the bus matrix showing which dimensions are shared across fact tables, enabling drill-across queries. Ensures dimension keys and attributes are identical everywhere they appear.",
    "keywords": [
      "conformed",
      "bus matrix",
      "drill-across"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Bus Matrix (conceptual)\n--                  dim_date  dim_guest  dim_property\n-- fact_bookings       ✓         ✓          ✓\n-- fact_payments       ✓         ✓\n-- fact_reviews        ✓         ✓          ✓\n\n-- Drill-across: join facts via conformed dims\nSELECT d.guest_name, SUM(b.revenue), AVG(r.rating)\nFROM fact_bookings b\nJOIN fact_reviews r ON b.guest_key = r.guest_key\nJOIN dim_guest d ON b.guest_key = d.guest_key\nGROUP BY d.guest_name;",
    "rationale": "Conformed dimensions are what make a <em>data warehouse</em> instead of a collection of siloed tables. Without them, joining fact_bookings to fact_reviews requires complex mapping logic. With them, it is a simple key join."
  },
  {
    "id": "gold-dw-05",
    "name": "ERD Diagrams",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Generates three levels of ERD diagrams in Mermaid markdown: master ERD (all tables), domain ERDs (per subject area), and summary ERD (fact-dimension relationships only). These become the visual contract for stakeholder review.",
    "keywords": [
      "ERD",
      "diagram"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "erDiagram\n  dim_guest ||--o{ fact_bookings : \"guest_key\"\n  dim_property ||--o{ fact_bookings : \"property_key\"\n  dim_date ||--o{ fact_bookings : \"date_key\"\n  fact_bookings }o--|| dim_booking_type : \"type_key\"",
    "rationale": "ERDs serve as the <em>visual contract</em> between data engineers and business stakeholders. Non-technical reviewers can spot missing relationships, incorrect cardinalities, and naming issues in a diagram far more easily than in YAML or SQL."
  },
  {
    "id": "gold-dw-06",
    "name": "Table Documentation",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Creates a business onboarding guide with plain-English descriptions of every table and column, plus a column lineage CSV tracing each Gold column back to its Bronze/Silver source.",
    "keywords": [
      "documentation",
      "lineage"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Lineage CSV enables automated <em>impact analysis</em>: if a Bronze source column changes type, you can instantly find every Gold column that depends on it. The business guide means new team members can understand the model without reading SQL."
  },
  {
    "id": "gold-dw-07",
    "name": "Design Validation",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 1,
    "desc": "Cross-validates three artifacts: YAML schemas (source of truth) ↔ ERD diagrams (visual) ↔ lineage CSV (traceability). Catches mismatches like a column in the YAML that is missing from the ERD, or a lineage reference to a non-existent source column.",
    "keywords": [
      "validation",
      "cross-check"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Three independent representations of the same model should agree. If they don't, one of them is wrong — and it's much cheaper to fix now than after writing 15 Silver pipelines."
  },
  {
    "id": "bronze-00",
    "name": "Bronze Layer Setup",
    "domain": "bronze",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 2,
    "desc": "<strong>What This Stage Does</strong><br>Creates source tables with realistic synthetic data using Faker. Every table gets Delta defaults (Liquid Clustering, CDF, auto-optimize) and configurable data corruption for testing DQ rules.<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Parse schema CSV</span> → extract table/column definitions<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Generate CREATE TABLE DDLs</span> → CLUSTER BY AUTO + TBLPROPERTIES<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ Faker data generation</span> → realistic values + intentional corruption<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Load order</span> → dimensions first → date dim → facts (FK integrity)</div><br><strong>Corruption mapping:</strong> Each corruption type (null required field, invalid format, out-of-range) maps 1:1 to a named DQ expectation in Silver — proving your quality rules actually catch real problems.",
    "keywords": [
      "Bronze",
      "test data",
      "Faker",
      "demo data"
    ],
    "workers": [
      "bronze-01"
    ],
    "commonDeps": [
      "common-bundles",
      "common-props",
      "common-schema",
      "common-imports",
      "common-ops"
    ],
    "code": "CREATE TABLE {catalog}.{schema}.{table}\n  (...) USING DELTA\n  CLUSTER BY AUTO\n  TBLPROPERTIES (\n    'delta.enableChangeDataFeed' = 'true',\n    'layer' = 'bronze'\n  )",
    "rationale": "Bronze creates <em>realistic test data</em> using Faker — not random noise. Configurable corruption rates let you prove that downstream Silver DQ rules actually catch problems. The tables mirror production schemas exactly so every downstream pipeline works without modification when you swap in real sources later.",
    "prompt": "Create the Bronze layer with test data.\nRead @data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md"
  },
  {
    "id": "bronze-01",
    "name": "Faker Data Generation",
    "domain": "bronze",
    "component": "dpa",
    "type": "worker",
    "stage": 2,
    "desc": "<strong>How Faker Works</strong><br>Generates realistic synthetic data with a two-phase approach: (1) create a valid record, then (2) with configurable probability, apply corruption.<br><br><div class=\"ac-diagram\"><span class=\"hl\">generate_valid_record()</span> → realistic values (log-normal amounts, weighted categories)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ if random() &lt; corruption_rate<br><span class=\"hl-o\">apply_corruption()</span> → null a field, invalid format, out-of-range, bad FK<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Each corruption maps to a named DQ rule</span><br>  e.g. null email → fails \"valid_email\" expectation in Silver</div><br><strong>Key design:</strong> <code>np.random.seed(42)</code> + <code>Faker.seed(42)</code> for reproducibility. Amounts use log-normal distribution (not uniform) for realistic skew.",
    "keywords": [
      "Faker",
      "synthetic",
      "corruption"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "def generate_bookings(dim_keys, n=1000, corruption_rate=0.05):\n    fake = Faker(); Faker.seed(42)\n    records = []\n    for i in range(n):\n        record = generate_valid_record(fake, dim_keys)\n        if random.random() < corruption_rate:\n            record = apply_corruption(record)\n            # Will fail: valid_amount, valid_email, etc.\n        records.append(record)\n    return records",
    "rationale": "The corruption rate is <em>configurable per job run</em> via DAB <code>base_parameters</code>. Set it to 0% for clean demos, 5% for DQ rule validation, or 20% for stress testing quarantine tables."
  },
  {
    "id": "silver-00",
    "name": "Silver Layer Setup",
    "domain": "silver",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 3,
    "desc": "<strong>What This Stage Does</strong><br>Builds SDP/DLT (Spark Declarative Pipelines) that validate and clean Bronze data using expectations loaded from a Delta rules table.<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Setup dq_rules Delta table</span> → central rule store<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② dq_rules_loader.py</span> → loads rules at pipeline start<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ @dlt.table + @dlt.expect_all_or_drop(rules)</span><br>&nbsp;&nbsp;Bronze stream → Silver (clean) + Quarantine (failed)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Deploy pipeline</span> → serverless, ADVANCED edition, Photon</div><br><strong>Key insight:</strong> Rules live in Delta, not code. <code>UPDATE dq_rules SET constraint_sql = 'amount > 0'</code> takes effect on the next pipeline run — no redeploy needed.<br><br><strong>Pipeline edition:</strong> <code>ADVANCED</code> is mandatory for expectations. CORE/PRO do not support <code>@dlt.expect*</code>.",
    "keywords": [
      "Silver",
      "DLT",
      "SDP",
      "expectations",
      "data quality"
    ],
    "workers": [
      "silver-01",
      "silver-02"
    ],
    "commonDeps": [
      "common-bundles",
      "common-props",
      "common-constraints",
      "common-imports",
      "common-ops"
    ],
    "code": "rules = load_rules('silver_bookings', 'critical')\n\n@dlt.table(cluster_by_auto=True)\n@dlt.expect_all_or_drop(rules)\ndef silver_bookings():\n    return dlt.read_stream('bronze_bookings')",
    "rationale": "DQ rules live in <em>Delta tables instead of code</em> because business rules change faster than deployment cycles. An analyst can UPDATE a rule row — no CI/CD needed. The quarantine pattern ensures bad rows are captured, not silently dropped, so data stewards can investigate and fix root causes upstream.",
    "prompt": "Build Silver DLT pipelines.\nRead @data_product_accelerator/skills/silver/00-silver-layer-setup/SKILL.md"
  },
  {
    "id": "silver-01",
    "name": "DLT Expectations",
    "domain": "silver",
    "component": "dpa",
    "type": "worker",
    "stage": 3,
    "desc": "Implements the Delta-table-based DQ rules pattern: rules stored in a Delta table, loaded at runtime, applied with @dlt.expect_all_or_drop(). Rules can be updated with a SQL UPDATE — no code change, no redeploy.",
    "keywords": [
      "DLT",
      "expectations",
      "DQ"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "# Load rules from Delta table at runtime\nrules = load_rules(\"silver_bookings\", \"critical\")\n\n@dlt.table(cluster_by_auto=True)\n@dlt.expect_all_or_drop(rules)\ndef silver_bookings():\n    return dlt.read_stream(\"bronze_bookings\")",
    "rationale": "Storing rules in a Delta table instead of code means <em>data stewards can update rules without engineering PRs</em>. A new rule like \"booking_amount > 0\" is a SQL INSERT, not a code change. The pipeline picks it up on the next run."
  },
  {
    "id": "silver-02",
    "name": "DQX Patterns",
    "domain": "silver",
    "component": "dpa",
    "type": "worker",
    "stage": 3,
    "desc": "Advanced DQX (Data Quality eXtensions) framework for reusable, composable quality checks: null checks, range checks, referential integrity, regex patterns, and custom SQL expressions.",
    "keywords": [
      "DQX",
      "validation"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "# DQX rule definitions (YAML-driven)\nrules:\n  - column: email\n    check: regex\n    pattern: \"^[^@]+@[^@]+\\\\.[^@]+$\"\n  - column: booking_amount\n    check: range\n    min: 0\n    max: 999999\n  - column: guest_id\n    check: referential_integrity\n    ref_table: dim_guest\n    ref_column: guest_key",
    "rationale": "DQX provides <em>composable quality primitives</em> beyond simple expect(). Referential integrity checks catch orphaned FKs before they reach Gold. Regex checks catch malformed emails, phone numbers, and IDs at the Silver layer."
  },
  {
    "id": "gold-01",
    "name": "Gold Layer Setup",
    "domain": "gold",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 4,
    "desc": "<strong>What This Stage Does</strong><br>Materializes the YAML schemas from Stage 1 into actual Delta tables, then loads data from Silver using MERGE scripts — handling SCD Type 1, SCD Type 2, and aggregated fact patterns.<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Load YAML schemas</span> → parse table definitions<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Generate CREATE TABLE DDLs</span> → CLUSTER BY AUTO + TBLPROPERTIES<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ Add constraints</span> → ALTER TABLE ADD CONSTRAINT (PK, FK)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Dedup Silver data</span> → dropDuplicates on business key<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">⑤ MERGE into Gold</span> → dims first (SCD1/2), then facts<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">⑥ Validate grain</span> → distinct count == total count</div><br><strong>Order matters:</strong> Dimensions are merged before facts because facts have foreign keys to dimensions. Breaking this order causes referential integrity violations.",
    "keywords": [
      "Gold tables",
      "merge scripts",
      "Gold setup"
    ],
    "workers": [
      "gold-pw-01",
      "gold-pw-02",
      "gold-pw-03",
      "gold-pw-04",
      "gold-pw-05"
    ],
    "commonDeps": [
      "common-bundles",
      "common-props",
      "common-constraints",
      "common-imports"
    ],
    "code": "MERGE INTO gold.dim_customer t\nUSING silver_customer s\nON t.customer_key = s.customer_key\nWHEN MATCHED THEN UPDATE SET ...\nWHEN NOT MATCHED THEN INSERT ...",
    "rationale": "Gold implementation is <em>YAML-driven, not hand-coded</em>. The YAML schemas from Stage 1 are the single source of truth — DDLs, MERGE scripts, and validation queries are all generated from them. This guarantees schema consistency and means changes to the dimensional model propagate automatically without manually editing SQL in multiple places.",
    "prompt": "Implement Gold tables.\nRead @data_product_accelerator/skills/gold/01-gold-layer-setup/SKILL.md"
  },
  {
    "id": "gold-pw-01",
    "name": "YAML Table Setup",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 4,
    "desc": "Generates CREATE TABLE DDLs from YAML schemas. Each YAML file defines columns, types, constraints, clustering keys, and table properties. The DDLs include COMMENT ON for every column.",
    "keywords": [
      "YAML",
      "DDL"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "CREATE TABLE IF NOT EXISTS gold.dim_guest (\n  guest_key BIGINT NOT NULL,\n  guest_name STRING NOT NULL,\n  email STRING,\n  loyalty_tier STRING,\n  effective_from DATE,\n  effective_to DATE,\n  is_current BOOLEAN\n)\nCLUSTER BY AUTO\nTBLPROPERTIES (\n  'delta.enableChangeDataFeed' = 'true',\n  'layer' = 'gold'\n);",
    "rationale": "YAML-driven DDLs mean the <em>schema is code-reviewed, version-controlled, and diffable</em>. Any column addition is a YAML change, not a manual ALTER TABLE that someone forgets to document."
  },
  {
    "id": "gold-pw-02",
    "name": "Merge Patterns",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 4,
    "desc": "Implements SCD Type 1 (overwrite), SCD Type 2 (insert new row with effective dates), and accumulating snapshot MERGE statements. Handles WHEN MATCHED, WHEN NOT MATCHED, and WHEN NOT MATCHED BY SOURCE.",
    "keywords": [
      "MERGE",
      "SCD"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "MERGE INTO gold.dim_guest t\nUSING staging.dim_guest_updates s\nON t.guest_key = s.guest_key AND t.is_current = true\nWHEN MATCHED AND t.hash != s.hash THEN\n  UPDATE SET is_current = false, effective_to = current_date()\nWHEN NOT MATCHED THEN\n  INSERT (guest_key, guest_name, email, effective_from, is_current)\n  VALUES (s.guest_key, s.guest_name, s.email, current_date(), true);",
    "rationale": "MERGE is the <em>workhorse of Gold updates</em>. SCD Type 2 is used for dimensions where history matters (guest profile changes). SCD Type 1 is used where only the latest value matters. The hash comparison avoids needless updates when nothing changed."
  },
  {
    "id": "gold-pw-03",
    "name": "Deduplication",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 4,
    "desc": "Implements ROW_NUMBER-based deduplication strategies for handling duplicate records from source systems. Uses deterministic ordering and configurable tiebreak columns.",
    "keywords": [
      "dedup",
      "duplicate"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (\n    PARTITION BY booking_id\n    ORDER BY updated_at DESC, _ingest_ts DESC\n  ) AS rn\n  FROM silver.bookings\n)\nSELECT * FROM ranked WHERE rn = 1;",
    "rationale": "Source systems often emit duplicates (retry logic, CDC replays). ROW_NUMBER with deterministic ordering ensures <em>exactly one row per business key</em>. The ORDER BY uses updated_at first (business timestamp) and _ingest_ts second (system tiebreak)."
  },
  {
    "id": "gold-pw-04",
    "name": "Grain Validation",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 4,
    "desc": "Verifies fact table grain integrity by checking that the declared grain columns produce a unique combination. Detects duplicate grains before data reaches downstream consumers.",
    "keywords": [
      "grain validation"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Grain check: should return 0 rows\nSELECT booking_key, COUNT(*) as cnt\nFROM gold.fact_bookings\nGROUP BY booking_key\nHAVING cnt > 1;",
    "rationale": "A violated grain means aggregations will double-count. This check runs as a <em>post-load validation step</em> and fails the pipeline if duplicates are found — catching the problem at load time rather than in a dashboard."
  },
  {
    "id": "gold-pw-05",
    "name": "Schema Validation",
    "domain": "gold",
    "component": "dpa",
    "type": "worker",
    "stage": 4,
    "desc": "Cross-checks the actual DDL in Unity Catalog against the YAML schema definition. Catches column drift (added/removed/renamed columns, type changes) between what the YAML says and what actually exists.",
    "keywords": [
      "schema validation"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Schema drift happens when someone runs an ad-hoc ALTER TABLE without updating the YAML. This validator ensures the <em>YAML remains the single source of truth</em> by flagging any discrepancy."
  },
  {
    "id": "planning-00",
    "name": "Project Planning",
    "domain": "planning",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 5,
    "desc": "<strong>What This Stage Does</strong><br>Reads Gold design artifacts and generates YAML manifest files that serve as machine-readable contracts for stages 6-9.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Gold YAML schemas + ERDs + Biz docs</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓ Planning orchestrator<br><span class=\"hl-p\">semantic-layer-manifest.yaml</span> → Stage 6 (MVs, TVFs, Genie)<br><span class=\"hl-g\">observability-manifest.yaml</span> → Stage 7 (monitors, alerts)<br><span class=\"hl-o\">ml-manifest.yaml</span> → Stage 8 (features, models)<br><span class=\"hl-p\">genai-agents-manifest.yaml</span> → Stage 9 (agents, eval)</div><br><strong>Why manifests?</strong> They decouple stages. If Stage 7 fails, restart from the manifest without re-running stages 1-6. Each downstream stage reads only its manifest — not the entire pipeline state.",
    "keywords": [
      "planning",
      "architecture plan",
      "manifest"
    ],
    "workers": [],
    "commonDeps": [
      "common-expert"
    ],
    "emits": [
      "plans/manifests/*.yaml"
    ],
    "rationale": "The <em>plan-as-contract</em> pattern: Stage 5 emits YAML manifests that downstream stages 6-9 consume as input contracts. This decouples stages — each stage only reads its manifest and produces its output. It also makes the pipeline resumable: if Stage 7 fails, you restart from the Stage 7 manifest without re-running stages 1-6.",
    "prompt": "Create a project plan.\nRead @data_product_accelerator/skills/planning/00-project-planning/SKILL.md"
  },
  {
    "id": "semantic-00",
    "name": "Semantic Layer Setup",
    "domain": "semantic",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 6,
    "desc": "<strong>What This Stage Does</strong><br>Creates the semantic layer — Metric Views (business metric definitions), TVFs (parameterized queries), and Genie Spaces (NL-to-SQL) — all sitting on top of Gold tables.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Phase 0: Read manifest</span> → validate against Gold inventory<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Phase 1: Metric Views</span> → YAML definitions with MEASURE()<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Phase 2: TVFs</span> → parameterized SQL functions (STRING params)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Phase 3: Genie Spaces</span> → instructions + assets + benchmarks<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Phase 4: DAB job</span> → create_MVs → create_TVFs → deploy_Genie</div><br><strong>Asset priority:</strong> Genie uses Metric Views first (richest semantics), TVFs second (parameterized), raw tables last (least context).",
    "keywords": [
      "semantic layer",
      "metric view",
      "TVF",
      "Genie Space"
    ],
    "workers": [
      "semantic-01",
      "semantic-02",
      "semantic-03",
      "semantic-04"
    ],
    "commonDeps": [
      "common-bundles",
      "common-imports"
    ],
    "rationale": "The semantic layer sits <em>between Gold tables and consumers</em> — it provides business-meaningful definitions (Metric Views) and parameterized access patterns (TVFs) so analysts and Genie Spaces never need to understand the raw dimensional model. This separation means the Gold schema can evolve without breaking BI dashboards or NL query experiences.",
    "prompt": "Build the semantic layer.\nRead @data_product_accelerator/skills/semantic-layer/00-semantic-layer-setup/SKILL.md"
  },
  {
    "id": "semantic-01",
    "name": "Metric Views",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": 6,
    "desc": "Creates Metric Views — pre-computed business definitions on top of Gold tables. They encode formulas like \"RevPAR = revenue / available_rooms\" so Genie and dashboards use the correct calculation without needing to know the underlying model.",
    "keywords": [
      "metric view",
      "semantic"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "CREATE MATERIALIZED VIEW gold.mv_monthly_revenue AS\nSELECT\n  d.year_month,\n  p.property_name,\n  SUM(f.revenue) AS total_revenue,\n  SUM(f.revenue) / SUM(f.available_rooms) AS revpar,\n  SUM(f.revenue) / SUM(f.rooms_sold) AS adr\nFROM gold.fact_bookings f\nJOIN gold.dim_date d ON f.date_key = d.date_key\nJOIN gold.dim_property p ON f.property_key = p.property_key\nGROUP BY d.year_month, p.property_name;",
    "rationale": "Metric Views are the <em>semantic contract</em> between the data team and consumers. When \"revenue\" is defined once in a Metric View, Genie, dashboards, and apps all use the same formula — no more \"my number doesn't match yours\" conversations."
  },
  {
    "id": "semantic-02",
    "name": "Table-Valued Functions",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": 6,
    "desc": "Parameterized SQL functions that accept input arguments (e.g., date ranges, property IDs) and return a filtered/computed result set. TVFs sit between Metric Views and raw tables in Genie's priority order.",
    "keywords": [
      "TVF",
      "function"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "CREATE FUNCTION gold.fn_revenue_by_period(\n  start_date DATE, end_date DATE\n)\nRETURNS TABLE (\n  property_name STRING,\n  revenue DECIMAL(12,2),\n  booking_count BIGINT\n)\nRETURN\n  SELECT p.property_name, SUM(f.revenue), COUNT(*)\n  FROM gold.fact_bookings f\n  JOIN gold.dim_property p ON f.property_key = p.property_key\n  JOIN gold.dim_date d ON f.date_key = d.date_key\n  WHERE d.full_date BETWEEN start_date AND end_date\n  GROUP BY p.property_name;",
    "rationale": "TVFs let Genie answer parameterized questions like \"revenue last quarter\" without writing complex date logic. The AI just calls fn_revenue_by_period('2024-01-01', '2024-03-31') — cleaner, faster, and more reliable than generating the full SQL."
  },
  {
    "id": "semantic-03",
    "name": "Genie Space Patterns",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": 6,
    "desc": "Designs Genie Spaces with three components: Agent Instructions (business context in ≤20 lines), Data Assets (Metric Views + TVFs + tables in priority order), and Benchmark Questions (expected Q→SQL pairs for validation).",
    "keywords": [
      "Genie Space",
      "instructions"
    ],
    "workers": [],
    "commonDeps": [],
    "platform": "genie",
    "code": "# Agent Instructions (≤20 lines, highest impact)\nYou are a hotel analytics assistant.\nKey terms:\n- \"RevPAR\" = Revenue Per Available Room\n- \"ADR\" = Average Daily Rate\n- \"Occupancy\" = rooms_sold / available_rooms\nWhen asked about \"top hotels\", rank by RevPAR.\nAll monetary values are in USD.\nUse mv_monthly_revenue for trend questions.",
    "rationale": "Agent Instructions are the <em>single highest-impact lever</em> for Genie quality. They provide the business context that transforms a generic SQL engine into a domain expert. Without them, Genie has to guess what \"top\" means, what currency to use, and which tables to prefer."
  },
  {
    "id": "semantic-04",
    "name": "Genie Export/Import API",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": 6,
    "desc": "Programmatic Genie Space deployment using the REST API. Export a space as JSON, version-control it, and import it to other workspaces. Enables CI/CD for Genie Spaces.",
    "keywords": [
      "Genie API",
      "export",
      "import"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "# Export Genie Space as JSON\ndatabricks api get /api/2.0/genie/spaces/{space_id} > space.json\n\n# Import to another workspace\ndatabricks api post /api/2.0/genie/spaces --json @space.json",
    "rationale": "Treating Genie Spaces as <em>code artifacts</em> (export → commit → review → import) brings the same rigor to analytics configuration that software engineering applies to code. Changes to instructions or data assets go through PR review."
  },
  {
    "id": "genie-opt-00",
    "name": "Genie Optimization",
    "domain": "semantic",
    "component": "dpa",
    "type": "orchestrator",
    "stage": "6b",
    "desc": "Autonomous optimization loop: benchmark → evaluate → optimize → apply → re-evaluate.",
    "keywords": [
      "Genie accuracy",
      "benchmark",
      "optimize"
    ],
    "workers": [
      "genie-opt-01",
      "genie-opt-02",
      "genie-opt-03",
      "genie-opt-04"
    ],
    "commonDeps": [],
    "rationale": "Genie accuracy is <em>measurable and improvable</em> through a closed-loop cycle: generate benchmark questions, evaluate Genie's SQL against expected answers, optimize metadata and instructions, re-evaluate. This turns \"the AI gets it wrong sometimes\" from a vague complaint into a systematic improvement process with quantified accuracy scores."
  },
  {
    "id": "genie-opt-01",
    "name": "Benchmark Generator",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": "6b",
    "desc": "Generates benchmark question sets with expected SQL answers. Covers common, edge, and adversarial questions. Each benchmark includes the natural language question, expected SQL, and the expected result shape.",
    "keywords": [
      "benchmark"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "benchmarks:\n  - question: \"What was total revenue last quarter?\"\n    expected_sql: \"SELECT SUM(revenue) FROM mv_monthly_revenue WHERE year_month BETWEEN ...\"\n    category: \"aggregation\"\n  - question: \"Top 5 hotels by occupancy\"\n    expected_sql: \"SELECT property_name, AVG(occupancy) ...\"\n    category: \"ranking\"",
    "rationale": "You can't improve what you can't measure. Benchmarks turn <em>subjective \"Genie is bad\"</em> into quantified accuracy scores (e.g., 73% correct SQL → 91% after optimization)."
  },
  {
    "id": "genie-opt-02",
    "name": "Benchmark Evaluator",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": "6b",
    "desc": "Runs benchmark questions against the live Genie Space, compares generated SQL to expected SQL, scores for correctness (does it return the right answer?) and repeatability (does it give the same answer every time?).",
    "keywords": [
      "evaluator",
      "accuracy"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Repeatability matters as much as correctness. If Genie answers the same question differently each time, users lose trust even if the average is correct."
  },
  {
    "id": "genie-opt-03",
    "name": "Metadata Optimizer",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": "6b",
    "desc": "Analyzes benchmark failures and generates metadata improvements: better COMMENT ON for ambiguous columns, more specific Agent Instructions, additional TVFs for common question patterns.",
    "keywords": [
      "metadata",
      "optimizer"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Most Genie failures trace back to <em>missing context</em>, not AI limitations. A column called \"amt\" with no comment forces Genie to guess. Adding \"COMMENT: Total booking amount in USD including taxes\" fixes it."
  },
  {
    "id": "genie-opt-04",
    "name": "Optimization Applier",
    "domain": "semantic",
    "component": "dpa",
    "type": "worker",
    "stage": "6b",
    "desc": "Applies metadata optimizations via the Genie API (update instructions, add table comments, register new TVFs), then re-runs benchmarks to measure improvement.",
    "keywords": [
      "apply",
      "API"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "The <em>closed loop</em> (benchmark → optimize → re-benchmark) is what makes this systematic. Without re-benchmarking, you can't confirm that the optimization actually helped — it might have fixed one question while breaking two others."
  },
  {
    "id": "monitor-00",
    "name": "Observability Setup",
    "domain": "monitoring",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 7,
    "desc": "<strong>What This Stage Does</strong><br>Builds a four-layer defense for data health: table monitors, schema anomaly detection, visual dashboards, and threshold-based alerts.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Phase 1: Lakehouse Monitors</span> → profile_metrics + drift_metrics<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Phase 2: Anomaly Detection</span> → schema-level freshness + completeness<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Phase 3: AI/BI Dashboards</span> → Lakeview health visualization<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Phase 4: SQL Alerts</span> → threshold triggers → email/Slack/PagerDuty</div><br><strong>Defense in depth:</strong> Monitors catch table-level issues, anomaly detection catches schema-level patterns, dashboards provide visibility, and alerts ensure immediate response.",
    "keywords": [
      "monitoring",
      "dashboard",
      "alert",
      "observability"
    ],
    "workers": [
      "monitor-01",
      "monitor-02",
      "monitor-03",
      "monitor-04"
    ],
    "commonDeps": [
      "common-bundles"
    ],
    "rationale": "Observability is <em>built in, not bolted on</em>. Lakehouse monitors track row counts, schema drift, and freshness at the table level. SQL alerts fire when thresholds are breached. AI/BI dashboards give stakeholders a single pane of glass. This \"defense in depth\" catches problems that Silver DQ rules miss — like upstream sources going silent or unexpected schema changes.",
    "prompt": "Set up observability.\nRead @data_product_accelerator/skills/monitoring/00-observability-setup/SKILL.md"
  },
  {
    "id": "monitor-01",
    "name": "Lakehouse Monitoring",
    "domain": "monitoring",
    "component": "dpa",
    "type": "worker",
    "stage": 7,
    "desc": "Creates Lakehouse Monitors on Gold tables that track row counts over time, detect schema drift (column additions/removals/type changes), and monitor data distribution for anomalies.",
    "keywords": [
      "monitor",
      "drift"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Create a table monitor\nCREATE MONITOR gold.fact_bookings_monitor\nAS SELECT * FROM gold.fact_bookings\nWITH SCHEDULE (CRON \"0 */6 * * *\")\nQUALITY RULES (\n  row_count_check: COUNT(*) > 0,\n  freshness_check: MAX(updated_at) > current_timestamp() - INTERVAL 24 HOURS\n);",
    "rationale": "Lakehouse Monitors provide <em>always-on table health</em>. Unlike batch DQ checks that run during pipeline execution, monitors run on a schedule and catch problems even when the pipeline didn't run — like a source going silent."
  },
  {
    "id": "monitor-02",
    "name": "AI/BI Dashboards",
    "domain": "monitoring",
    "component": "dpa",
    "type": "worker",
    "stage": 7,
    "desc": "Builds Lakeview dashboards for data health visibility: pipeline run status, DQ rule pass rates, table freshness heatmaps, and row count trends. Provides a single pane of glass for data stakeholders.",
    "keywords": [
      "dashboard",
      "Lakeview"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Dashboards transform raw monitoring data into <em>stakeholder-readable insights</em>. A \"data health\" dashboard showing green/yellow/red for each table is far more actionable than log files or email alerts."
  },
  {
    "id": "monitor-03",
    "name": "SQL Alerting",
    "domain": "monitoring",
    "component": "dpa",
    "type": "worker",
    "stage": 7,
    "desc": "Creates SQL-based alerts that fire when business-critical thresholds are breached: zero new bookings in 24h, revenue drops >20% day-over-day, DQ failure rate exceeds 5%. Sends notifications via email, Slack, or PagerDuty.",
    "keywords": [
      "alert",
      "SQL"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Alert: no new bookings in 24 hours\nCREATE ALERT gold.alert_booking_drought\nWITH SCHEDULE (CRON \"0 * * * *\")\nAS SELECT COUNT(*) as recent\n   FROM gold.fact_bookings\n   WHERE created_at > current_timestamp() - INTERVAL 24 HOURS\nWHEN recent = 0\nTHEN NOTIFY(\"booking-alerts@company.com\");",
    "rationale": "SQL alerts catch <em>business-level problems</em> that table monitors miss. A table can be perfectly healthy (rows exist, schema unchanged) while the business is broken (no new bookings). Alert thresholds should be set with domain knowledge."
  },
  {
    "id": "monitor-04",
    "name": "Anomaly Detection",
    "domain": "monitoring",
    "component": "dpa",
    "type": "worker",
    "stage": 7,
    "desc": "Detects statistical anomalies in data patterns: freshness violations (table not updated when expected), completeness drops (NULL rate spikes), volume anomalies (10x more/fewer rows than usual), and distribution shifts.",
    "keywords": [
      "anomaly",
      "freshness",
      "stale"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Anomaly detection catches <em>problems that fixed thresholds miss</em>. A table that normally gets 10K rows per day suddenly getting 1M rows is a problem — but a simple \"row count > 0\" check won't catch it. Statistical baselines detect deviations from normal patterns."
  },
  {
    "id": "ml-00",
    "name": "ML Pipeline Setup",
    "domain": "ml",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 8,
    "desc": "<strong>What This Stage Does</strong><br>End-to-end ML on the Lakehouse: feature tables in Unity Catalog, experiment tracking with MLflow, model registration, and batch inference — all governed and versioned.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Gold Tables</span> → <span class=\"hl-p\">Feature Engineering</span> (fe.create_table)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Training + Experiments</span> (MLflow tracking)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">UC Model Registry</span> (aliases: champion/production)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl\">Batch Inference</span> (fe.score_batch → predictions table)</div><br><strong>Key pattern:</strong> <code>fe.score_batch()</code> ensures the same feature transformations used in training are applied during inference — no training/serving skew.",
    "keywords": [
      "MLflow",
      "ML model",
      "training",
      "inference"
    ],
    "workers": [],
    "commonDeps": [
      "common-bundles",
      "common-imports"
    ],
    "rationale": "ML pipelines consume <em>Gold tables as feature sources</em>, ensuring that training data has already passed through Bronze ingestion, Silver DQ, and Gold dimensional modeling. MLflow provides experiment tracking, model versioning, and a model registry — so every model in production is traceable back to the exact data and code that created it.",
    "prompt": "Set up ML pipelines.\nRead @data_product_accelerator/skills/ml/00-ml-pipeline-setup/SKILL.md"
  },
  {
    "id": "genai-00",
    "name": "GenAI Course Orchestrator",
    "domain": "genai",
    "component": "dpa",
    "type": "orchestrator",
    "stage": 9,
    "desc": "<strong>What This Stage Does</strong><br>Routes production GenAI agent work through the current course structure: foundation, Track A custom Agent Apps, AppKit 2-Apps proxy, feedback, and the MLflow SDLC.<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Foundation</span> → UC, MLflow, tracing, tools, KA<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Track A Agent App</span> → Python agent on Databricks Apps<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ AppKit 2-Apps Proxy</span> → 06d OBO forwarding<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Chat History + Feedback</span> → 07/08 + MLflow assessments<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">⑤ SDLC</span> → prompt registry, evals, deploy, monitor</div><br><strong>Architecture:</strong> The canonical path uses a separate Agent App plus a rich AppKit frontend, with Lakebase memory and MLflow for the complete evaluation-to-deployment pipeline.",
    "keywords": [
      "GenAI agent",
      "ResponsesAgent",
      "AI agent"
    ],
    "workers": [
      "genai-01",
      "genai-02",
      "genai-03",
      "genai-04",
      "genai-05",
      "genai-06",
      "genai-07",
      "genai-08"
    ],
    "commonDeps": [
      "common-bundles",
      "common-imports"
    ],
    "rationale": "GenAI agents are the <em>capstone of the data product</em>. They sit on top of the medallion architecture — using Gold tables for retrieval, Genie Spaces for analytics, Lakebase for memory, and MLflow for evaluation. The current orchestrator routes to focused foundation, Track A, SDLC, and capstone skills instead of a deleted setup skill.",
    "prompt": "Build GenAI agents.\nRead @genai-agents/00-course-orchestrator/SKILL.md"
  },
  {
    "id": "genai-01",
    "name": "ResponsesAgent Patterns",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Builds agents using Databricks ResponsesAgent — the recommended agent framework. Includes tool definition, predict_stream for streaming, and AI Playground for interactive testing before deployment.",
    "keywords": [
      "ResponsesAgent"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "from databricks.agents import ResponsesAgent\n\nagent = ResponsesAgent(\n  model=\"databricks-claude-sonnet-4-6\",\n  tools=[search_tool, sql_tool],\n  instructions=\"You are a hotel analytics assistant...\"\n)\n\n# Streaming inference\nfor event in agent.predict_stream(messages):\n  print(event)",
    "rationale": "ResponsesAgent provides a <em>unified interface</em> for building agents with tool-calling, streaming, and conversation history. It wraps the Foundation Model API with Databricks-specific features like MLflow tracing and model serving integration."
  },
  {
    "id": "genai-02",
    "name": "MLflow GenAI Evaluation",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Evaluates agent quality using MLflow's GenAI evaluation framework with LLM-judge scorers. Measures faithfulness, relevance, harmfulness, and custom domain-specific scores.",
    "keywords": [
      "evaluation",
      "LLM judge"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "import mlflow\n\nresults = mlflow.genai.evaluate(\n  model=agent,\n  data=eval_dataset,\n  scorers=[\n    mlflow.genai.scorers.Faithfulness(),\n    mlflow.genai.scorers.Relevance(),\n    CustomDomainScorer()\n  ]\n)",
    "rationale": "LLM-judge evaluation provides <em>automated quality gates</em> for agents. Instead of manual review, scorers quantify whether answers are faithful to source data, relevant to the question, and safe. This enables CI/CD: reject deployments where quality drops below threshold."
  },
  {
    "id": "genai-03",
    "name": "Lakebase Memory",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Implements stateful conversation memory using Lakebase PostgreSQL. The CheckpointSaver pattern stores conversation state, tool results, and agent reasoning steps so conversations can be resumed across sessions.",
    "keywords": [
      "memory",
      "Lakebase",
      "stateful"
    ],
    "workers": [],
    "commonDeps": [],
    "platform": "lakebase",
    "code": "CREATE TABLE agent_memory (\n  session_id TEXT NOT NULL,\n  turn_idx INT NOT NULL,\n  role TEXT NOT NULL,\n  content JSONB NOT NULL,\n  tool_calls JSONB,\n  created_at TIMESTAMPTZ DEFAULT now(),\n  PRIMARY KEY (session_id, turn_idx)\n);",
    "rationale": "Stateless agents forget everything between requests. Lakebase memory enables <em>multi-turn conversations</em> where the agent remembers previous questions, tool results, and user preferences across sessions — essential for complex analytical workflows."
  },
  {
    "id": "genai-04",
    "name": "Prompt Registry",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Stores versioned prompts in Unity Catalog so prompt changes are tracked, diffable, and rollback-able. Each prompt version gets a timestamp and author, enabling A/B testing between prompt versions.",
    "keywords": [
      "prompt",
      "registry",
      "versioning"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Prompt engineering is <em>iterative and non-deterministic</em>. Without versioning, you can't tell which prompt produced last week's good results. The registry makes prompts first-class artifacts with the same rigor as code."
  },
  {
    "id": "genai-05",
    "name": "Multi-Agent Genie",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Implements intent classification to route user questions to specialized sub-agents or Genie Spaces. Handles multi-step workflows where the answer requires information from multiple sources.",
    "keywords": [
      "multi-agent",
      "orchestration"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Not every question should go to the same agent. \"Revenue last quarter\" goes to Genie, \"cancel my booking\" goes to a CRUD agent, \"explain this anomaly\" goes to an analytics agent. Intent classification is the <em>router that makes this seamless</em>."
  },
  {
    "id": "genai-06",
    "name": "Deployment Automation",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Implements CI/CD for agent deployment: automated evaluation → quality gate → model registration → serving endpoint update. Prevents deploying agents that score below quality thresholds.",
    "keywords": [
      "deploy",
      "CI/CD"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Manual agent deployment is risky — a bad prompt change can degrade quality for all users. Automated deployment with <em>evaluation gates</em> ensures only quality-approved agents reach production."
  },
  {
    "id": "genai-07",
    "name": "Production Monitoring",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Monitors deployed agents using registered scorers that evaluate a sample of production requests. Detects quality drift (accuracy dropping over time), latency spikes, and hallucination patterns.",
    "keywords": [
      "production",
      "monitoring",
      "drift"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Agent quality can degrade <em>without any code changes</em> — underlying data changes, user behavior shifts, or model updates can all cause drift. Production monitoring catches these before users complain."
  },
  {
    "id": "genai-08",
    "name": "MLflow GenAI Foundation",
    "domain": "genai",
    "component": "dpa",
    "type": "worker",
    "stage": 9,
    "desc": "Sets up MLflow tracing for GenAI: automatic logging of LLM calls, tool invocations, latency, token counts, and cost. Provides the observability foundation for all other GenAI workers.",
    "keywords": [
      "MLflow",
      "tracing",
      "GenAI"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "import mlflow\n\n# Enable automatic tracing\nmlflow.set_experiment(\"/genai/hotel-agent\")\nmlflow.genai.autolog()\n\n# Every LLM call is now traced:\n# - input/output tokens\n# - latency\n# - tool calls\n# - cost estimate",
    "rationale": "Tracing is the <em>foundation of GenAI observability</em>. Without it, debugging \"why did the agent give a wrong answer?\" requires reproducing the exact conversation. With tracing, every LLM call, tool invocation, and decision point is logged and inspectable."
  },
  {
    "id": "common-expert",
    "name": "Databricks Expert Agent",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Core SA behavior, \"Extract Don't Generate\" principle.",
    "keywords": [
      "expert",
      "extract"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "The \"Extract Don't Generate\" principle means the AI <em>reads existing SKILL.md files and follows their instructions</em> rather than improvising from training data. This ensures every output matches Databricks best practices — not the AI's potentially outdated knowledge. It's the foundation that makes all other skills reliable."
  },
  {
    "id": "common-naming",
    "name": "Naming & Tagging Standards",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "snake_case, COMMENTs, PII tags, budget policies.",
    "keywords": [
      "naming",
      "tagging",
      "PII"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Consistent naming is <em>loaded into every stage</em> because inconsistency compounds: a column called \"cust_id\" in Bronze and \"customer_key\" in Gold creates join confusion. The always-on pattern ensures every table, column, and tag follows the same conventions from the first DDL to the last dashboard."
  },
  {
    "id": "common-bundles",
    "name": "Asset Bundles",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Generates Databricks Asset Bundle (DAB) YAML for deploying jobs, pipelines, and resources. Uses Serverless compute, Environments V4 for dev/staging/prod promotion, and the databricks.yml schema.",
    "keywords": [
      "bundle",
      "DAB",
      "deploy"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "# databricks.yml\nbundle:\n  name: hotel-data-product\nresources:\n  pipelines:\n    silver_pipeline:\n      target: \"silver\"\n      serverless: true\n      catalog: production\n      configuration:\n        \"pipelines.channel\": \"PREVIEW\"",
    "rationale": "Asset Bundles make infrastructure <em>declarative and version-controlled</em>. Instead of clicking through UIs, you define jobs/pipelines as YAML and deploy with \"databricks bundle deploy\". This enables GitOps — every infrastructure change goes through PR review."
  },
  {
    "id": "common-ops",
    "name": "Autonomous Operations",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "The self-healing loop: Deploy → Poll status → Diagnose errors → Apply fix → Redeploy. The AI reads logs, identifies common failure patterns, and applies targeted fixes without human intervention.",
    "keywords": [
      "autonomous",
      "self-heal",
      "troubleshoot"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Most deployment failures follow <em>predictable patterns</em>: missing permissions, wrong warehouse ID, typo in table name. The autonomous loop recognizes these patterns from error logs and applies the known fix automatically — turning 30-minute debugging sessions into 30-second auto-repairs."
  },
  {
    "id": "common-imports",
    "name": "Python Imports",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Standardizes Python import patterns for Databricks notebooks: sys.path setup for shared modules, relative imports within packages, and the pure-Python module pattern for unit-testable code.",
    "keywords": [
      "import",
      "sys.path"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "# Standard pattern for notebook imports\nimport sys\nsys.path.append(\"/Workspace/Repos/project/src\")\nfrom utils.dq_rules import load_rules\nfrom utils.merge_patterns import scd_type2_merge",
    "rationale": "Inconsistent imports are the #1 cause of <em>\"works in my notebook, fails in production\"</em> errors. This skill enforces a standard pattern so shared modules work identically in notebooks, jobs, and local development."
  },
  {
    "id": "common-props",
    "name": "Table Properties",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Defines mandatory TBLPROPERTIES for every table: Change Data Feed (incremental processing), Row Tracking (MV refresh), Auto-Optimize (file compaction), and custom tags (layer, domain, owner).",
    "keywords": [
      "TBLPROPERTIES",
      "CDF"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "TBLPROPERTIES (\n  'delta.enableChangeDataFeed' = 'true',\n  'delta.enableRowTracking' = 'true',\n  'delta.autoOptimize.optimizeWrite' = 'true',\n  'delta.autoOptimize.autoCompact' = 'true',\n  'layer' = 'gold',\n  'domain' = 'bookings'\n)",
    "rationale": "Table properties are <em>set once and forgotten</em> — but missing one has cascading consequences. Without CDF, downstream incremental processing must full-scan. Without Row Tracking, Materialized Views fail to refresh. This skill ensures nothing is missed."
  },
  {
    "id": "common-schema",
    "name": "Schema Management",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Standardizes CREATE SCHEMA IF NOT EXISTS with governance metadata: owner, description, and layer tags. Ensures consistent namespace structure across catalog → schema → table.",
    "keywords": [
      "schema",
      "governance"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "CREATE SCHEMA IF NOT EXISTS production.gold\nCOMMENT 'Gold layer dimensional model for hotel bookings'\nMANAGED LOCATION 's3://bucket/gold'\nWITH DBPROPERTIES ('layer' = 'gold', 'domain' = 'bookings');"
  },
  {
    "id": "common-constraints",
    "name": "UC Constraints",
    "domain": "common",
    "component": "dpa",
    "type": "common",
    "desc": "Adds PRIMARY KEY and FOREIGN KEY constraints to Gold tables in Unity Catalog. Uses informational constraints (not enforced) that optimize query plans and document relationships for data consumers.",
    "keywords": [
      "constraint",
      "PK",
      "FK"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "ALTER TABLE gold.fact_bookings\n  ADD CONSTRAINT pk_bookings PRIMARY KEY (booking_key);\nALTER TABLE gold.fact_bookings\n  ADD CONSTRAINT fk_guest FOREIGN KEY (guest_key)\n  REFERENCES gold.dim_guest (guest_key);",
    "rationale": "UC constraints are <em>informational, not enforced</em> — but they serve two critical purposes: the query optimizer uses them for join elimination, and tools like Genie read them to understand table relationships without needing explicit documentation."
  },
  {
    "id": "appkit-00",
    "name": "AppKit Navigator",
    "domain": "appkit",
    "component": "appkit",
    "type": "entry",
    "phase": 0,
    "desc": "<strong>The Router</strong> — reads your intent and loads exactly one skill. Prevents the AI from loading all 10 AppKit skills at once, keeping the context window small and the AI sharply focused on one branch.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Your prompt</span> → <span class=\"hl-p\">Navigator reads keywords</span> → <span class=\"hl-g\">Loads 1 matching skill</span><br><br>\"scaffold\" → 01-scaffold&nbsp;&nbsp;|&nbsp;&nbsp;\"deploy\" → 03-deploy&nbsp;&nbsp;|&nbsp;&nbsp;\"wire lakebase\" → 05-wiring<br>\"agent app proxy\" → 06d&nbsp;&nbsp;|&nbsp;&nbsp;\"chat history\" → 07&nbsp;&nbsp;|&nbsp;&nbsp;\"feedback\" → 08</div><br>The navigator defines a <strong>branch-aware lifecycle</strong>: scaffold/build → deploy mock → setup Lakebase → wire Lakebase or agent chat → optional history/feedback → deploy + E2E",
    "keywords": [
      "AppKit",
      "navigate",
      "route"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "A single <em>entry-point router</em> skill prevents the AI from loading all 10 AppKit skills at once. It reads the user's intent (scaffold? deploy? Lakebase? agent proxy? feedback?) and loads only the relevant skill — keeping the context window small and the AI focused on one branch at a time."
  },
  {
    "id": "appkit-01",
    "name": "Scaffold App",
    "domain": "appkit",
    "component": "appkit",
    "type": "orchestrator",
    "phase": 1,
    "desc": "<strong>What This Skill Does</strong><br>Runs <code>databricks apps init</code> to generate a full-stack TypeScript project with the canonical AppKit file structure.<br><br><div class=\"ac-diagram\"><span class=\"hl\">databricks apps init</span> → generates project skeleton<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">npm install</span> → downloads @databricks/appkit + appkit-ui<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">npm run dev</span> → starts Express server on localhost:8000</div><br><strong>What is npm?</strong><br>npm (Node Package Manager) is like pip for Python. <code>npm install</code> reads <code>package.json</code> and downloads all dependencies into <code>node_modules/</code>. <code>npm run dev</code> executes the \"dev\" script defined in package.json — which starts the local development server with hot-reload.<br><br><strong>Generated Project Structure</strong><pre>my-app/\n├── app.yaml            ← Databricks Apps config (command, env vars)\n├── databricks.yml      ← Bundle config (resources, targets)\n├── package.json        ← Dependencies + scripts (build, dev, start)\n├── server/\n│   └── server.ts       ← Express backend entry point\n├── client/\n│   └── src/\n│       └── App.tsx     ← React frontend entry point\n└── config/\n    └── queries/        ← SQL files → become query keys</pre><strong>Blank vs Plugin-Enabled</strong><br>• <strong>Blank</strong>: <code>databricks apps init --name $APP --run none</code> — minimal, no data plugins<br>• <strong>With plugins</strong>: <code>--features analytics,lakebase</code> — pre-wires data access<br>• Workshop uses <strong>blank</strong> first, adds plugins incrementally in Phase 4",
    "keywords": [
      "scaffold",
      "create app",
      "init",
      "new app"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Step 1: Authenticate\ndatabricks auth login --host $WORKSPACE_URL\n\n-- Step 2: Scaffold blank project\ndatabricks apps init \\\n  --name my-hotel-app \\\n  --run none \\\n  --profile DEFAULT\n\n-- Step 3: Install dependencies\ncd my-hotel-app && npm install\n\n-- Step 4: Start dev server\nnpm run dev\n-- App runs at http://localhost:8000",
    "rationale": "The <em>blank template + plugin pattern</em> means you start with nothing and add capabilities incrementally. Unlike monolithic starters, your app only carries what it uses. The scaffold creates the canonical file structure (server/, client/, config/queries/) that all other skills expect — deviating from it breaks the toolchain.",
    "prompt": "Scaffold a new AppKit app.\nRead @apps_lakebase/skills/01-appkit-scaffold/SKILL.md",
    "platform": "appkit"
  },
  {
    "id": "appkit-02",
    "name": "Build from PRD",
    "domain": "appkit",
    "component": "appkit",
    "type": "orchestrator",
    "phase": 1,
    "desc": "<strong>What This Skill Does</strong><br>Reads a Product Requirements Document (PRD) and translates it into a working React UI with mock data arrays — no database needed yet.<br><br><strong>The 6-Step Build Process</strong><br><div class=\"ac-diagram\"><span class=\"hl\">① Read PRD</span> → extract personas, journeys, data requirements<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Design SQL</span> → write config/queries/*.sql → <code>npm run typegen</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ Design UI</span> → choose aesthetic, pick AppKit UI components<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Build Backend</span> → createApp({ plugins: [server()] })<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">⑤ Build Frontend</span> → React components with mock data arrays<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">⑥ Verify</span> → <code>npm run dev</code> + Playwright smoke tests</div><br><strong>What are Mock Data Arrays?</strong><br>Static JavaScript arrays that mimic the shape of real data. The UI renders them identically to live data — so stakeholders can review the full app before any database exists:<pre>&lt;BarChart\n  data={[\n    { month: \"Jan\", revenue: 4200 },\n    { month: \"Feb\", revenue: 5100 },\n  ]}\n  xKey=\"month\" yKey=\"revenue\"\n/&gt;</pre><strong>Key Technologies</strong><br>• <strong>React 19</strong> — UI framework (functional components, hooks)<br>• <strong>TypeScript</strong> — type-safe JavaScript (catches errors at compile time)<br>• <strong>AppKit UI</strong> — Shadcn/Radix primitives + ECharts for charts<br>• <strong>Vite</strong> — fast build tool that compiles React → browser-ready JS",
    "keywords": [
      "build UI",
      "PRD",
      "components",
      "mock data"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "// Mock data array (Phase 1 - no database)\nconst MOCK_BOOKINGS = [\n  { id: 1, guest: \"Alice\", room: \"Suite\", amount: 450 },\n  { id: 2, guest: \"Bob\", room: \"Standard\", amount: 180 },\n];\n\n// Phase 2: Replace with live query\nimport { useAnalyticsQuery } from \"@databricks/appkit-ui\";\nconst { data, loading } = useAnalyticsQuery(\"bookings\");\n// ^ reads config/queries/bookings.sql automatically",
    "rationale": "Building with <em>mock data arrays first</em> decouples UI development from backend readiness. You can ship a beautiful, fully functional UI to stakeholders for review while Lakebase is still being set up. The mock arrays are later swapped for live API calls with zero component changes — the shape of the data is already correct.",
    "prompt": "Build the UI from the PRD.\nRead @apps_lakebase/skills/02-appkit-build/SKILL.md",
    "platform": "appkit"
  },
  {
    "id": "appkit-03",
    "name": "Deploy App",
    "domain": "appkit",
    "component": "appkit",
    "type": "orchestrator",
    "phase": 2,
    "desc": "<strong>What This Skill Does</strong><br>Pushes your app to Databricks Apps — a managed container platform. Your code becomes a live URL accessible by anyone in the workspace.<br><br><strong>The Deploy Pipeline (3 Steps)</strong><br><div class=\"ac-diagram\"><span class=\"hl\">① databricks apps validate</span> → checks app.yaml syntax + resource bindings<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② npm run build</span> → Vite compiles React → client/dist/ (production JS)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ databricks apps deploy</span> → uploads code + starts container</div><br><strong>What Happens Inside the Container</strong><br><div class=\"ac-diagram\"><span class=\"hl\">Platform downloads source</span> → <code>/home/app/</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">npm install</span> (production only — no devDependencies)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">npm run build</span> (if build script exists)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Runs command from app.yaml</span>: <code>[node, build/index.mjs]</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br>⏱ Must complete within <strong>10 minutes</strong> or deploy fails</div><br><strong>What is app.yaml?</strong><br>The app manifest that tells the platform how to run your app:<pre>command: [node, build/index.mjs]\nenv:\n  - name: DATABRICKS_WAREHOUSE_ID\n    valueFrom: sql-warehouse  ← bound from databricks.yml\n  - name: LAKEBASE_ENDPOINT\n    valueFrom: postgres</pre><strong>What You Get After Deploy</strong><br>• A live URL: <code>https://my-app.cloud.databricks.com</code><br>• A <strong>Service Principal</strong> identity for API calls<br>• Auto-injected env vars: <code>DATABRICKS_HOST</code>, <code>DATABRICKS_APP_PORT</code><br>• Workspace SSO auth (users sign in with their Databricks credentials)",
    "keywords": [
      "deploy",
      "push",
      "ship app"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "-- Step 1: Validate configuration\ndatabricks apps validate --profile $PROFILE\n\n-- Step 2: Build frontend (React → production JS)\nnpm run build\n-- Vite compiles client/src/ → client/dist/\n-- Express serves dist/ as static files in prod\n\n-- Step 3: Deploy (uploads + starts container)\ndatabricks apps deploy --profile $PROFILE\n-- Equivalent to: bundle deploy + apps start\n\n-- Step 4: Verify health\ndatabricks apps get --name my-app --profile $PROFILE\n-- Look for: compute_status.state = \"ACTIVE\"",
    "rationale": "The deploy skill uses an <em>autonomous validate-deploy-verify-fix loop</em>. It doesn't just push code — it checks the build, validates app.yaml, deploys, waits for health checks, and if something fails, reads the logs and attempts a fix automatically. This turns the typical \"deploy and pray\" into a self-healing cycle.",
    "prompt": "Deploy the app.\nRead @apps_lakebase/skills/03-appkit-deploy/SKILL.md",
    "platform": "apps"
  },
  {
    "id": "appkit-04",
    "name": "Add Plugin",
    "domain": "appkit",
    "component": "appkit",
    "type": "orchestrator",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Registers data access plugins in <code>server/server.ts</code>. Each plugin adds a specific capability without touching other plugins.<br><br><strong>The Four Plugins</strong><br><table><tr><th>Plugin</th><th>What It Does</th><th>Data Pattern</th></tr><tr><td><code>analytics()</code></td><td>Read-only SQL queries via SQL Warehouse</td><td>Dashboards, reports</td></tr><tr><td><code>lakebase()</code></td><td>Full CRUD via PostgreSQL (OAuth)</td><td>App state, user data</td></tr><tr><td><code>genie()</code></td><td>Natural language → SQL via Genie Spaces</td><td>NL chat interface</td></tr><tr><td><code>files()</code></td><td>File upload/download via UC Volumes</td><td>Documents, images</td></tr></table><br><strong>How Plugin Registration Works</strong><br><div class=\"ac-diagram\"><span class=\"hl\">import { createApp, server, lakebase }</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">await createApp({ plugins: [server(), lakebase()] })</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br>Each plugin registers its own <span class=\"hl-g\">middleware + routes</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br>lakebase() → creates <span class=\"hl-o\">PostgreSQL connection pool</span> with auto OAuth</div><br><strong>Why Composable?</strong><br>You add only what you need. A simple dashboard app uses only <code>analytics()</code>. A CRUD app uses <code>lakebase()</code>. A full data product uses all four. Each plugin is independent — adding one never breaks another.",
    "keywords": [
      "add plugin",
      "lakebase",
      "analytics",
      "genie",
      "files"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "import { createApp, server, lakebase,\n         analytics, genie, files }\n  from \"@databricks/appkit\";\n\nconst AppKit = await createApp({\n  plugins: [\n    server({ autoStart: false }),\n    lakebase({  // PostgreSQL with auto OAuth\n      pool: { max: 10, idleTimeoutMillis: 30000 }\n    }),\n    analytics(), // SQL Warehouse read-only\n    genie(),     // Natural language queries\n    files(),     // UC Volume file ops\n  ],\n});\n\n// Register custom routes, THEN start\nAppKit.server.extend((app) => { ... });\nawait AppKit.server.start();",
    "rationale": "AppKit's <em>plugin architecture</em> is composable: analytics() for read-only SQL, lakebase() for CRUD, genie() for NL queries, files() for volume uploads. Each plugin registers its own middleware and routes. You pick exactly the data access patterns your app needs — nothing more.",
    "prompt": "Add the Lakebase plugin.\nRead @apps_lakebase/skills/04-appkit-plugin-add/SKILL.md",
    "platform": "lakebase"
  },
  {
    "id": "appkit-05",
    "name": "Wire Lakebase",
    "domain": "appkit",
    "component": "appkit",
    "type": "orchestrator",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Connects the app end-to-end: designs PostgreSQL tables, builds Express API routes, creates a React hook, and adds a live/mock status indicator.<br><br><strong>The Four Layers of Wiring</strong><br><div class=\"ac-diagram\"><span class=\"hl\">Layer 1: DDL</span> — CREATE TABLE IF NOT EXISTS (runs on startup)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Layer 2: API Routes</span> — Express CRUD endpoints (/api/bookings)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Layer 3: React Hook</span> — useLakebaseData() fetches from API<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Layer 4: Status Badge</span> — ConnectionStatus shows live vs mock</div><br><strong>DDL (Database Schema)</strong><br>Tables are created <em>on every app startup</em> using <code>IF NOT EXISTS</code> — idempotent and safe. The <strong>Service Principal</strong> runs DDL on first deploy and becomes the table owner:<pre>CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.bookings (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  guest_name TEXT NOT NULL,\n  amount NUMERIC(10,2) NOT NULL,\n  status TEXT DEFAULT 'pending'\n    CHECK (status IN ('pending','confirmed','cancelled')),\n  created_at TIMESTAMPTZ DEFAULT now()\n);</pre><strong>Mock Fallback Pattern</strong><br>Every API route wraps Lakebase calls in try/catch. If the database is unavailable, it returns mock data with <code>source: \"mock\"</code> — the UI never shows a blank screen:<br><div class=\"ac-diagram\"><span class=\"hl\">API Request</span> → try Lakebase query → <span class=\"hl-g\">{ data: rows, source: \"live\" }</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;catch → <span class=\"hl-o\">{ data: MOCK_ARRAY, source: \"mock\" }</span></div><br><strong>OAuth Flow (Zero Passwords)</strong><br>Lakebase uses OAuth token rotation — no username/password. The plugin handles 1-hour token refresh with a 2-minute buffer automatically. You never write auth code.",
    "keywords": [
      "wire lakebase",
      "DDL",
      "CRUD",
      "backend"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "// DDL runs on every startup (idempotent)\nawait AppKit.lakebase.query(\n  `CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA}`);\nawait AppKit.lakebase.query(\n  `CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.bookings ...`);\n\n// CRUD API route with mock fallback\nAppKit.server.extend((app) => {\n  app.get(\"/api/bookings\", async (req, res) => {\n    try {\n      const r = await AppKit.lakebase.query(\n        `SELECT * FROM ${DB_SCHEMA}.bookings\n         ORDER BY created_at DESC`);\n      res.json({ data: r.rows, source: \"live\" });\n    } catch {\n      res.json({ data: MOCK_BOOKINGS, source: \"mock\" });\n    }\n  });\n});\n\n// React hook (frontend)\nconst { data, source } = useLakebaseData(\"/api/bookings\");\n// source = \"live\" | \"mock\" | \"loading\"",
    "rationale": "The wiring pattern uses a <em>mock fallback</em>: every API endpoint tries Lakebase first and falls back to the mock data array if the connection fails. This means the app never shows a blank screen — it gracefully degrades. The useLakebaseData() hook on the frontend shows a ConnectionStatus badge so users know whether they're seeing live or mock data.",
    "prompt": "Wire Lakebase backend.\nRead @apps_lakebase/skills/05-appkit-lakebase-wiring/SKILL.md",
    "platform": "lakebase"
  },
  {
    "id": "appkit-06",
    "name": "Wire Serving Endpoint",
    "domain": "appkit",
    "component": "appkit",
    "type": "worker",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Connects the AppKit frontend to a Model Serving or Agent Serving endpoint using the serving plugin.<br><br><div class=\"ac-diagram\"><span class=\"hl\">serving()</span> plugin → endpoint alias in <code>app.yaml</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Backend route</span> streams invoke responses<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">React chat UI</span> renders tokens and errors</div><br><strong>Choose this path when</strong> the agent is exposed as a serving endpoint rather than a separate Databricks App.",
    "keywords": [
      "serving",
      "agent endpoint",
      "model serving",
      "chat"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Serving wiring is the endpoint-based agent branch. It is independent of Lakebase, but pairs well with Lakebase when the app needs persisted chat history or app state.",
    "prompt": "Wire a serving endpoint.\nRead @apps_lakebase/skills/06-appkit-serving-wiring/SKILL.md",
    "platform": "appkit"
  },
  {
    "id": "appkit-06d",
    "name": "Agent App Proxy",
    "domain": "appkit",
    "component": "appkit",
    "type": "worker",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Connects an AppKit frontend to a separate Databricks Agent App using an authenticated proxy.<br><br><div class=\"ac-diagram\"><span class=\"hl\">AppKit UI</span> → <code>/api/chat</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">App-to-app auth</span> + <code>x-forwarded-access-token</code><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Separate Agent App</span> streams SSE responses</div><br><strong>Choose this path when</strong> the GenAI course Track A agent has been deployed as its own Databricks App.",
    "keywords": [
      "06d",
      "agent app proxy",
      "two apps",
      "OBO",
      "x-forwarded-access-token"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "The 2-Apps architecture keeps the Python agent runtime separate from the TypeScript AppKit UI while preserving end-user identity through OBO forwarding. This is the canonical AppKit integration path for the GenAI prompt guide.",
    "prompt": "Wire AppKit to a separate Agent App.\nRead @apps_lakebase/skills/06d-appkit-agent-app-proxy/SKILL.md",
    "platform": "appkit"
  },
  {
    "id": "appkit-07",
    "name": "Chat History",
    "domain": "appkit",
    "component": "appkit",
    "type": "worker",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Persists conversations, messages, and trace IDs in Lakebase so agent chats can resume across sessions.<br><br><div class=\"ac-diagram\"><span class=\"hl\">Agent stream</span> → assistant message + trace ID<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Lakebase chat schema</span> stores sessions and messages<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Sidebar UI</span> lists prior conversations</div><br><strong>Requires</strong> Lakebase wiring plus either serving endpoint wiring or the separate Agent App proxy.",
    "keywords": [
      "chat history",
      "persistent chat",
      "conversation sidebar",
      "trace ID"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Persisting chat history turns a one-off chat box into an application feature. Captured trace IDs also become the bridge into feedback and MLflow assessment logging.",
    "prompt": "Add persistent chat history.\nRead @apps_lakebase/skills/07-appkit-chat-history/SKILL.md",
    "platform": "lakebase"
  },
  {
    "id": "appkit-08",
    "name": "Feedback",
    "domain": "appkit",
    "component": "appkit",
    "type": "worker",
    "phase": 4,
    "desc": "<strong>What This Skill Does</strong><br>Adds thumbs up/down feedback for assistant responses and links votes to MLflow assessments when trace IDs are available.<br><br><div class=\"ac-diagram\"><span class=\"hl\">User clicks feedback</span> → vote stored in Lakebase<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">traceId lookup</span> links vote to response<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">MLflow assessment</span> feeds evaluation datasets</div><br><strong>Requires</strong> the chat history skill because feedback depends on message IDs, votes, and trace IDs.",
    "keywords": [
      "feedback",
      "thumbs",
      "MLflow assessment",
      "rate response"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Feedback closes the loop from production usage back into evaluation. It gives the app a lightweight human review path while keeping the data model tied to MLflow traces.",
    "prompt": "Add user feedback.\nRead @apps_lakebase/skills/08-appkit-feedback/SKILL.md",
    "platform": "lakebase"
  },
  {
    "id": "af-loop",
    "name": "FM Agent Loop",
    "domain": "agentic",
    "component": "agentic",
    "type": "orchestrator",
    "desc": "Implements the core tool-calling loop with Databricks Foundation Models: send message → LLM generates tool calls → execute tools → return results → repeat until done. Handles streaming, error recovery, and conversation history.",
    "keywords": [
      "agent loop",
      "tool-calling",
      "Foundation Model"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "while not done:\n  response = fm.predict(messages, tools=tool_defs)\n  for tool_call in response.tool_calls:\n    result = execute_tool(tool_call)\n    messages.append(tool_result(result))\n  if response.content:\n    done = True  # Final answer",
    "rationale": "The agent loop is the <em>fundamental building block</em> of all AI agents. Every multi-step workflow — from data analysis to code generation — follows this pattern. Understanding it deeply is essential for building reliable agents."
  },
  {
    "id": "af-prd",
    "name": "PRD Analyzer",
    "domain": "agentic",
    "component": "agentic",
    "type": "worker",
    "desc": "Extracts structured requirements from Product Requirement Documents: user stories, data needs, API endpoints, UI components, and acceptance criteria. Outputs a machine-readable spec that other agents consume.",
    "keywords": [
      "PRD",
      "requirements"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "PRDs are written for humans but consumed by AI. The analyzer bridges this gap by extracting <em>structured, actionable requirements</em> from free-form text — so the build agent knows exactly what to create."
  },
  {
    "id": "af-scaffold",
    "name": "Skill Scaffolder",
    "domain": "agentic",
    "component": "agentic",
    "type": "worker",
    "desc": "Creates new SKILL.md files following the AgentSkills.io specification: metadata (name, version, triggers), context, inputs, numbered steps, output contract, and references.",
    "keywords": [
      "scaffold skill"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "SKILL.md is a <em>structured contract between humans and AI</em>. The scaffolder ensures every new skill follows the same format, making skills discoverable, composable, and reliable across any AI coding assistant."
  },
  {
    "id": "af-tool",
    "name": "Tool Builder",
    "domain": "agentic",
    "component": "agentic",
    "type": "worker",
    "desc": "Builds Python tool functions for agents: input/output schemas, error handling, rate limiting, and automatic parameter validation. Tools become callable functions that agents invoke during the FM loop.",
    "keywords": [
      "build tool"
    ],
    "workers": [],
    "commonDeps": [],
    "code": "@tool(description=\"Search hotel bookings by guest name\")\ndef search_bookings(\n  guest_name: str,\n  limit: int = 10\n) -> list[dict]:\n  return db.sql(f\"SELECT * FROM gold.fact_bookings\n    WHERE guest_name ILIKE '%{guest_name}%'\n    LIMIT {limit}\").to_dict()"
  },
  {
    "id": "af-test",
    "name": "Agent Tester",
    "domain": "agentic",
    "component": "agentic",
    "type": "worker",
    "desc": "Tests agent behavior with scenario-based test suites: given input X, the agent should call tool Y with parameters Z and produce answer W. Validates both the tool-calling sequence and the final output quality.",
    "keywords": [
      "test agent"
    ],
    "workers": [],
    "commonDeps": [],
    "rationale": "Agent testing is harder than unit testing because <em>outputs are non-deterministic</em>. The tester uses LLM-judge evaluation and structural assertions (did the agent call the right tools?) to create reliable, repeatable test suites."
  }
];

export const SKILL_MAP: Record<string, NavSkill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s])
);

export const STAGES: NavStage[] = [
  {
    "num": "1",
    "label": "Gold Design",
    "sc": "sc-1",
    "orch": "gold-00"
  },
  {
    "num": "2",
    "label": "Bronze",
    "sc": "sc-2",
    "orch": "bronze-00"
  },
  {
    "num": "3",
    "label": "Silver",
    "sc": "sc-3",
    "orch": "silver-00"
  },
  {
    "num": "4",
    "label": "Gold Impl",
    "sc": "sc-4",
    "orch": "gold-01"
  },
  {
    "num": "5",
    "label": "Planning",
    "sc": "sc-5",
    "orch": "planning-00"
  },
  {
    "num": "6",
    "label": "Semantic",
    "sc": "sc-6",
    "orch": "semantic-00"
  },
  {
    "num": "6b",
    "label": "Genie Opt",
    "sc": "sc-6b",
    "orch": "genie-opt-00"
  },
  {
    "num": "7",
    "label": "Observ.",
    "sc": "sc-7",
    "orch": "monitor-00"
  },
  {
    "num": "8",
    "label": "ML",
    "sc": "sc-8",
    "orch": "ml-00"
  },
  {
    "num": "9",
    "label": "GenAI",
    "sc": "sc-9",
    "orch": "genai-00"
  }
];

export const PHASES: NavPhase[] = [
  {
    "num": 1,
    "label": "Scaffold + Build",
    "skills": [
      "appkit-01",
      "appkit-02"
    ]
  },
  {
    "num": 2,
    "label": "Deploy Mock",
    "skills": [
      "appkit-03"
    ]
  },
  {
    "num": 3,
    "label": "Setup Lakebase",
    "skills": [
      "appkit-04"
    ]
  },
  {
    "num": 4,
    "label": "Wire Branches",
    "skills": [
      "appkit-04",
      "appkit-05",
      "appkit-06",
      "appkit-06d",
      "appkit-07",
      "appkit-08"
    ]
  },
  {
    "num": 5,
    "label": "Deploy + E2E",
    "skills": [
      "appkit-03"
    ]
  }
];

export const TOURS: Record<'a' | 'b' | 'c', Tour> = {
  "a": {
    "name": "Schema to Production",
    "tree": "<ul>\n<li id=\"ta-root\" class=\"collapsed\"><div class=\"tnode type-entry\" id=\"ta-n-root\" data-skill=\"\" data-toggle=\"ta-root\"><div class=\"icon\" style=\"background:var(--cyan-dim);color:var(--cyan)\">A</div><div class=\"name\">AGENTS.md</div><div class=\"tag\" style=\"background:var(--cyan-dim);color:var(--cyan)\">entry</div><div class=\"chevron\">▶</div></div>\n<ul>\n<li id=\"ta-nav\" class=\"collapsed\"><div class=\"tnode type-entry\" id=\"ta-n-nav\" data-skill=\"\" data-toggle=\"ta-nav\"><div class=\"icon\" style=\"background:var(--cyan-dim);color:var(--cyan)\">N</div><div class=\"name\">skill-navigator</div><div class=\"tag\" style=\"background:var(--cyan-dim);color:var(--cyan)\">router</div><div class=\"chevron\">▶</div></div>\n<ul>\n<li id=\"ta-common\" class=\"collapsed\"><div class=\"tnode type-common\" id=\"ta-n-common\" data-skill=\"\" data-toggle=\"ta-common\"><div class=\"icon\">C</div><div class=\"name\">Common Skills (always loaded)</div><div class=\"tag\">core</div><div class=\"meta\">~4K tokens</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-common\" data-skill=\"common-expert\"><div class=\"icon\">C</div><div class=\"name\">databricks-expert-agent</div><div class=\"tag\">common</div></div></li><li><div class=\"tnode type-common\" data-skill=\"common-naming\"><div class=\"icon\">C</div><div class=\"name\">naming-tagging-standards</div><div class=\"tag\">common</div></div></li></ul></li>\n<li id=\"ta-s1\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s1\" data-skill=\"gold-00\" data-toggle=\"ta-s1\"><div class=\"icon\">1</div><div class=\"name\">Stage 1: Gold Design</div><div class=\"tag\">orchestrator</div><div class=\"meta\">7 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w1\" data-skill=\"gold-dw-01\"><div class=\"icon\">W</div><div class=\"name\">01-grain-definition</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w2\" data-skill=\"gold-dw-02\"><div class=\"icon\">W</div><div class=\"name\">02-dimension-patterns</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w3\" data-skill=\"gold-dw-03\"><div class=\"icon\">W</div><div class=\"name\">03-fact-table-patterns</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w4\" data-skill=\"gold-dw-04\"><div class=\"icon\">W</div><div class=\"name\">04-conformed-dimensions</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w5\" data-skill=\"gold-dw-05\"><div class=\"icon\">W</div><div class=\"name\">05-erd-diagrams</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w6\" data-skill=\"gold-dw-06\"><div class=\"icon\">W</div><div class=\"name\">06-table-documentation</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s1-w7\" data-skill=\"gold-dw-07\"><div class=\"icon\">W</div><div class=\"name\">07-design-validation</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s2\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s2\" data-skill=\"bronze-00\" data-toggle=\"ta-s2\"><div class=\"icon\">2</div><div class=\"name\">Stage 2: Bronze</div><div class=\"tag\">orchestrator</div><div class=\"meta\">1 worker</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s2-w1\" data-skill=\"bronze-01\"><div class=\"icon\">W</div><div class=\"name\">01-faker-data-generation</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s3\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s3\" data-skill=\"silver-00\" data-toggle=\"ta-s3\"><div class=\"icon\">3</div><div class=\"name\">Stage 3: Silver</div><div class=\"tag\">orchestrator</div><div class=\"meta\">2 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s3-w1\" data-skill=\"silver-01\"><div class=\"icon\">W</div><div class=\"name\">01-dlt-expectations</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s3-w2\" data-skill=\"silver-02\"><div class=\"icon\">W</div><div class=\"name\">02-dqx-patterns</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s4\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s4\" data-skill=\"gold-01\" data-toggle=\"ta-s4\"><div class=\"icon\">4</div><div class=\"name\">Stage 4: Gold Implementation</div><div class=\"tag\">orchestrator</div><div class=\"meta\">5 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s4-w1\" data-skill=\"gold-pw-01\"><div class=\"icon\">W</div><div class=\"name\">01-yaml-table-setup</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s4-w2\" data-skill=\"gold-pw-02\"><div class=\"icon\">W</div><div class=\"name\">02-merge-patterns</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s4-w3\" data-skill=\"gold-pw-03\"><div class=\"icon\">W</div><div class=\"name\">03-deduplication</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s5\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s5\" data-skill=\"planning-00\" data-toggle=\"ta-s5\"><div class=\"icon\">5</div><div class=\"name\">Stage 5: Planning</div><div class=\"tag\">orchestrator</div><div class=\"meta\">emits manifests</div></div></li>\n<li id=\"ta-s6\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s6\" data-skill=\"semantic-00\" data-toggle=\"ta-s6\"><div class=\"icon\">6</div><div class=\"name\">Stage 6: Semantic Layer</div><div class=\"tag\">orchestrator</div><div class=\"meta\">4 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s6-w1\" data-skill=\"semantic-01\"><div class=\"icon\">W</div><div class=\"name\">01-metric-views</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s6-w2\" data-skill=\"semantic-02\"><div class=\"icon\">W</div><div class=\"name\">02-table-valued-functions</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s6-w3\" data-skill=\"semantic-03\"><div class=\"icon\">W</div><div class=\"name\">03-genie-space-patterns</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s7\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s7\" data-skill=\"monitor-00\" data-toggle=\"ta-s7\"><div class=\"icon\">7</div><div class=\"name\">Stage 7: Observability</div><div class=\"tag\">orchestrator</div><div class=\"meta\">4 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s7-w1\" data-skill=\"monitor-01\"><div class=\"icon\">W</div><div class=\"name\">01-lakehouse-monitoring</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s7-w2\" data-skill=\"monitor-02\"><div class=\"icon\">W</div><div class=\"name\">02-ai-bi-dashboards</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s7-w3\" data-skill=\"monitor-03\"><div class=\"icon\">W</div><div class=\"name\">03-sql-alerting</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s7-w4\" data-skill=\"monitor-04\"><div class=\"icon\">W</div><div class=\"name\">04-anomaly-detection</div><div class=\"tag\">worker</div></div></li></ul></li>\n<li id=\"ta-s8\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s8\" data-skill=\"ml-00\" data-toggle=\"ta-s8\"><div class=\"icon\">8</div><div class=\"name\">Stage 8: ML Pipeline</div><div class=\"tag\">orchestrator</div></div></li>\n<li id=\"ta-s9\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"ta-n-s9\" data-skill=\"genai-00\" data-toggle=\"ta-s9\"><div class=\"icon\">9</div><div class=\"name\">Stage 9: GenAI Agents</div><div class=\"tag\">orchestrator</div><div class=\"meta\">8 workers</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"ta-n-s9-w1\" data-skill=\"genai-01\"><div class=\"icon\">W</div><div class=\"name\">01-responses-agent</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s9-w2\" data-skill=\"genai-02\"><div class=\"icon\">W</div><div class=\"name\">02-mlflow-evaluation</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s9-w3\" data-skill=\"genai-03\"><div class=\"icon\">W</div><div class=\"name\">03-lakebase-memory</div><div class=\"tag\">worker</div></div></li><li><div class=\"tnode type-worker\" id=\"ta-n-s9-w4\" data-skill=\"genai-04\"><div class=\"icon\">W</div><div class=\"name\">04-prompt-registry</div><div class=\"tag\">worker</div></div></li></ul></li>\n</ul></li></ul></li></ul>",
    "steps": [
      {
        "expand": [
          "ta-root"
        ],
        "activate": [
          "ta-n-root"
        ],
        "narration": "The IDE auto-loads <span class=\"hl\">AGENTS.md</span> — the universal entry point for any AI coding assistant.",
        "tier": [
          1,
          "Tier 1: Entry"
        ],
        "designRationale": "A single entry file means <em>any IDE</em> (Cursor, Claude Code, Copilot, Windsurf) discovers the framework automatically. No special configuration, no plugin install — just open the repo and the AI knows where to start. This is the \"zero-friction onboarding\" principle. <strong>Genie Code (in-workspace):</strong> <code>git clone</code> the repo into your user project (<code>/Workspace/Users/&lt;you&gt;/vibe-coding-workshop</code>, a git working tree so generated bundles are recognized) and <strong>copy</strong> the tree to <code>/Users/&lt;you&gt;/.assistant/skills/vibe-coding-workshop</code> for discovery, then start a NEW Agent-mode chat thread so Genie Code recurses the skills copy and auto-loads every SKILL.md (it is pre-authenticated and serverless).",
        "inputOutput": {
          "inputs": [
            "repo root"
          ],
          "outputs": [
            "AGENTS.md",
            "skill-navigator"
          ]
        }
      },
      {
        "expand": [
          "ta-nav"
        ],
        "activate": [
          "ta-n-nav"
        ],
        "narration": "The <span class=\"hl\">Skill Navigator</span> matches keywords to find the right orchestrator or worker skill.",
        "tier": [
          1,
          "Tier 1: Routing"
        ],
        "designRationale": "Keyword-based routing keeps the AI's context window <em>small and focused</em>. Instead of loading all 44 accelerator skills, the navigator matches your request to 1-2 relevant skills (~4-8K tokens). This is the \"progressive disclosure\" pattern — load only what you need, when you need it.",
        "inputOutput": {
          "inputs": [
            "user prompt",
            "keywords"
          ],
          "outputs": [
            "matched skill path"
          ]
        }
      },
      {
        "expand": [
          "ta-common"
        ],
        "activate": [
          "ta-n-common"
        ],
        "narration": "Two <span class=\"hl-g\">always-on common skills</span> are loaded first: expert-agent and naming-standards.",
        "tier": [
          1,
          "Tier 1: Core"
        ],
        "skillIds": [
          "common-expert",
          "common-naming"
        ],
        "designRationale": "These two skills are loaded <em>into every stage, unconditionally</em>. Expert-agent enforces the \"Extract Don't Generate\" principle (read the SKILL.md, don't improvise). Naming-standards ensures snake_case, COMMENTs, and PII tags are consistent from first DDL to last dashboard. Together they cost only ~4K tokens — a small price for universal consistency.",
        "inputOutput": {
          "inputs": [
            "always loaded"
          ],
          "outputs": [
            "consistent behavior",
            "naming conventions"
          ]
        }
      },
      {
        "expand": [
          "ta-s1"
        ],
        "activate": [
          "ta-n-s1"
        ],
        "narration": "<span class=\"hl\">Stage 1: Gold Design</span> — reads the schema CSV and creates dimensional models, ERDs, and YAML schemas.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "gold-00"
        ],
        "designRationale": "<strong>Design-first architecture</strong> — Gold is designed <em>before</em> any Bronze or Silver code is written. This inverts the traditional \"ingest first, model later\" approach:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Schema CSV</span> (customer's existing tables)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ parse + classify (fact vs dimension)<br><span class=\"hl-p\">Dimensional Model</span> (grains, SCDs, bus matrix)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ generate from model<br><span class=\"hl-g\">YAML Schemas</span> (one .yaml per table — SSOT)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ visualize<br><span class=\"hl-o\">ERD Diagrams</span> (Mermaid: master + domain + summary)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ trace<br><span class=\"hl-p\">Lineage CSV</span> (every Gold column → Bronze source)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ validate<br><span class=\"hl-g\">Cross-Check</span> (YAML ↔ ERD ↔ lineage must agree)</div><br><strong>Why Gold first?</strong> Discovering a grain mismatch after building 15 Silver pipelines means rework across every layer. By designing Gold first, errors cost minutes instead of days.",
        "inputOutput": {
          "inputs": [
            "schema CSV",
            "naming standards"
          ],
          "outputs": [
            "YAML schemas",
            "ERD diagrams",
            "lineage CSV",
            "business docs"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s1-w1",
          "ta-n-s1-w2",
          "ta-n-s1-w3",
          "ta-n-s1-w4"
        ],
        "narration": "Four design workers — <span class=\"hl-y\">grain-definition</span>, <span class=\"hl-y\">dimension-patterns</span>, <span class=\"hl-y\">fact-tables</span>, <span class=\"hl-y\">conformed-dims</span>.",
        "tier": [
          3,
          "Tier 3: Workers"
        ],
        "skillIds": [
          "gold-dw-01",
          "gold-dw-02",
          "gold-dw-03",
          "gold-dw-04"
        ],
        "designRationale": "Each worker handles one <em>specific dimensional modeling concern</em>:<br><br><table><tr><th>Worker</th><th>Decides</th><th>Key Concept</th></tr><tr><td>Grain Definition</td><td>What is one row?</td><td>Transaction (per event) vs Periodic Snapshot (per time period) vs Accumulating (per lifecycle)</td></tr><tr><td>Dimension Patterns</td><td>How to track history?</td><td>SCD Type 1 (overwrite) vs Type 2 (add new row with effective_from/to dates)</td></tr><tr><td>Fact Table Patterns</td><td>How to aggregate?</td><td>Additive (SUM everywhere) vs Semi-additive (SUM across dims, not time) vs Non-additive (ratios)</td></tr><tr><td>Conformed Dimensions</td><td>What is shared?</td><td>Bus Matrix: which dimensions appear in multiple fact tables for drill-across</td></tr></table><br>Splitting them means the AI focuses deeply on one pattern at a time — no juggling four complex decisions simultaneously.",
        "inputOutput": {
          "inputs": [
            "schema CSV",
            "Gold design context"
          ],
          "outputs": [
            "grain decisions",
            "dimension specs",
            "fact specs",
            "bus matrix"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s1-w5",
          "ta-n-s1-w6",
          "ta-n-s1-w7"
        ],
        "narration": "ERD diagrams, table documentation, and design validation complete Gold Design.",
        "tier": [
          3,
          "Tier 3: Workers"
        ],
        "skillIds": [
          "gold-dw-05",
          "gold-dw-06",
          "gold-dw-07"
        ],
        "designRationale": "The final three workers are <em>quality assurance</em>:<br><br><div class=\"ac-diagram\"><span class=\"hl\">05-ERD Diagrams</span> → Mermaid erDiagram (visual contract for stakeholder review)<br>&nbsp;&nbsp;Master ERD (all tables) + Domain ERDs (per subject area) + Summary ERD<br><br><span class=\"hl-p\">06-Table Documentation</span> → Business onboarding guide (plain English)<br>&nbsp;&nbsp;+ COLUMN_LINEAGE.csv (Gold column → Bronze source traceability)<br><br><span class=\"hl-g\">07-Design Validation</span> → Cross-check all artifacts<br>&nbsp;&nbsp;YAML ↔ ERD (same columns?) ↔ Lineage (same sources?)<br>&nbsp;&nbsp;PK/FK consistency, mandatory TBLPROPERTIES, grain declarations</div><br>Three independent representations of the same model. If they disagree, one is wrong — much cheaper to fix now than after writing 15 pipelines.",
        "inputOutput": {
          "inputs": [
            "dimension + fact specs"
          ],
          "outputs": [
            "ERD markdown",
            "biz docs",
            "validation report"
          ]
        }
      },
      {
        "expand": [
          "ta-s2"
        ],
        "activate": [
          "ta-n-s2"
        ],
        "narration": "<span class=\"hl\">Stage 2: Bronze</span> — creates source tables with Faker-generated test data.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "bronze-00"
        ],
        "designRationale": "Bronze creates <em>realistic test data</em> that mirrors production schemas exactly:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Schema CSV</span> → parse table/column definitions<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">CREATE TABLE ... USING DELTA</span><br>&nbsp;&nbsp;CLUSTER BY AUTO (Liquid Clustering — engine manages layout)<br>&nbsp;&nbsp;delta.enableChangeDataFeed = true (required by Silver streaming)<br>&nbsp;&nbsp;delta.autoOptimize.optimizeWrite = true<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Faker generates data</span><br>&nbsp;&nbsp;Log-normal distributions for amounts (realistic skew)<br>&nbsp;&nbsp;Weighted categoricals for status/tier fields<br>&nbsp;&nbsp;Last ~6 months date window<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Load order: dims → date dim → facts</span> (FK integrity)</div><br><strong>Key insight:</strong> Every downstream pipeline works without modification when you swap in real sources later — the shapes are identical.",
        "inputOutput": {
          "inputs": [
            "Gold YAML schemas"
          ],
          "outputs": [
            "Bronze DDLs",
            "Faker notebooks",
            "Asset Bundle jobs"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s2-w1"
        ],
        "narration": "<span class=\"hl-y\">Faker Data Generation</span> worker creates realistic synthetic data with configurable corruption rates.",
        "tier": [
          3,
          "Tier 3: Worker"
        ],
        "skillIds": [
          "bronze-01"
        ],
        "designRationale": "Faker uses a <em>two-phase approach</em> — generate valid data first, then corrupt:<br><br><div class=\"ac-diagram\"><span class=\"hl\">generate_valid_record()</span> → realistic values<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ if random() &lt; corruption_rate (e.g. 5%)<br><span class=\"hl-o\">apply_corruption()</span> → intentional defects<br>&nbsp;&nbsp;• null_required_field → will fail \"valid_email\" expectation<br>&nbsp;&nbsp;• invalid_format → will fail regex check<br>&nbsp;&nbsp;• out_of_range → will fail \"amount > 0\" rule<br>&nbsp;&nbsp;• bad_fk → will fail referential integrity</div><br>Each corruption maps 1:1 to a named DQ rule in Silver. Set <code>corruption_rate=0%</code> for clean demos, <code>5%</code> for validation, <code>20%</code> for stress testing quarantine tables. Seeds (<code>np.random.seed(42)</code>) ensure reproducibility.",
        "inputOutput": {
          "inputs": [
            "Bronze DDLs",
            "corruption config"
          ],
          "outputs": [
            "Faker Python notebook",
            "test data"
          ]
        }
      },
      {
        "expand": [
          "ta-s3"
        ],
        "activate": [
          "ta-n-s3"
        ],
        "narration": "<span class=\"hl\">Stage 3: Silver</span> — SDP/DLT pipelines with Delta table DQ rules.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "silver-00"
        ],
        "designRationale": "Silver is the <em>validation layer</em> — it cleans Bronze data using expectations loaded from a central Delta rules table:<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Setup dq_rules Delta table</span><br>&nbsp;&nbsp;table_name | rule_name | constraint_sql | severity<br>&nbsp;&nbsp;\"silver_bookings\" | \"valid_amount\" | \"amount > 0\" | \"critical\"<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② dq_rules_loader.py</span> (pure Python, module-level cache)<br>&nbsp;&nbsp;get_critical_rules(\"silver_bookings\") → {\"valid_amount\":\"amount > 0\"}<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ SDP/DLT pipeline</span><br>&nbsp;&nbsp;@dlt.table(cluster_by_auto=True)<br>&nbsp;&nbsp;@dlt.expect_all_or_drop(rules)  ← critical: drop bad rows<br>&nbsp;&nbsp;@dlt.expect_all(warning_rules)  ← warning: log but keep<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Quarantine table</span> — failed rows + reason + timestamp</div><br><strong>Runtime updates:</strong> <code>UPDATE dq_rules SET constraint_sql = ...</code> takes effect on the next pipeline run — no redeploy needed.<br><strong>Edition:</strong> <code>ADVANCED</code> is mandatory for expectations (CORE/PRO do not support <code>@dlt.expect*</code>).",
        "inputOutput": {
          "inputs": [
            "Bronze tables",
            "Gold YAML schemas"
          ],
          "outputs": [
            "Silver DLT pipelines",
            "DQ rules table",
            "quarantine views"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s3-w1",
          "ta-n-s3-w2"
        ],
        "narration": "<span class=\"hl-y\">DLT Expectations</span> and <span class=\"hl-y\">DQX Patterns</span> — runtime-updateable data quality rules.",
        "tier": [
          3,
          "Tier 3: Workers"
        ],
        "skillIds": [
          "silver-01",
          "silver-02"
        ],
        "designRationale": "Two complementary DQ approaches:<br><br><table><tr><th>Feature</th><th>DLT Expectations</th><th>DQX Framework</th></tr><tr><td>Scope</td><td>Single-row SQL predicates</td><td>Row + dataset-level (uniqueness, FK, outliers)</td></tr><tr><td>Storage</td><td>Delta <code>dq_rules</code> table</td><td>YAML / Delta / Lakebase</td></tr><tr><td>On Failure</td><td>Drop row (critical) or log (warning)</td><td>Split into valid + invalid DataFrames with _error columns</td></tr><tr><td>Diagnostics</td><td>Pass/fail counts</td><td>Rich: which rule failed, column value, reason</td></tr><tr><td>API</td><td><code>@dlt.expect_all_or_drop(dict)</code></td><td><code>dq_engine.apply_checks_by_metadata_and_split()</code></td></tr></table><br><strong>When to use each:</strong> DLT Expectations for standard pass/fail rules. Add DQX when you need richer diagnostics, FK integrity checks, or dataset-level validation that goes beyond single-row predicates.",
        "inputOutput": {
          "inputs": [
            "Bronze tables",
            "DQ rule definitions"
          ],
          "outputs": [
            "clean Silver tables",
            "quarantine tables",
            "DQ metrics"
          ]
        }
      },
      {
        "expand": [
          "ta-s4"
        ],
        "activate": [
          "ta-n-s4"
        ],
        "narration": "<span class=\"hl\">Stage 4: Gold Implementation</span> — materializes YAML designs as Delta tables with MERGE scripts.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "gold-01"
        ],
        "designRationale": "Stage 4 turns the <em>Stage 1 design into running code</em> — a YAML-driven pipeline that creates tables, loads data, and validates results:<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Load YAML schemas</span> → parse table definitions from gold_layer_design/yaml/<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② setup_tables.py</span> → CREATE TABLE ... CLUSTER BY AUTO + TBLPROPERTIES<br>&nbsp;&nbsp;+ ALTER TABLE ADD CONSTRAINT (PK, FK, UNIQUE)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ Dedup Silver data</span> → .orderBy(processed_timestamp.desc).dropDuplicates(biz_key)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ MERGE into Gold</span> (dimensions first, then facts):<br>&nbsp;&nbsp;SCD1: whenMatchedUpdateAll().whenNotMatchedInsertAll()<br>&nbsp;&nbsp;SCD2: match on biz_key + is_current=true, close old row, insert new<br>&nbsp;&nbsp;Facts: match on grain columns, update measures<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">⑤ Validate grain</span> → distinct_count(grain_cols) == total_count<br><span class=\"hl-g\">⑥ Validate schema</span> → YAML columns match actual DDL columns</div><br><strong>Why dimensions first?</strong> Facts have FK references to dimensions. Loading facts before dims would violate referential integrity.",
        "inputOutput": {
          "inputs": [
            "Gold YAML schemas",
            "Silver tables"
          ],
          "outputs": [
            "Gold DDLs",
            "MERGE scripts",
            "constraint SQL",
            "validation notebooks"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s4-w1",
          "ta-n-s4-w2",
          "ta-n-s4-w3"
        ],
        "narration": "Pipeline workers: <span class=\"hl-y\">YAML table setup</span>, <span class=\"hl-y\">merge patterns</span>, <span class=\"hl-y\">deduplication</span>.",
        "tier": [
          3,
          "Tier 3: Workers"
        ],
        "skillIds": [
          "gold-pw-01",
          "gold-pw-02",
          "gold-pw-03"
        ],
        "designRationale": "Three workers form the <em>Gold load pipeline</em>:<br><br><div class=\"ac-diagram\"><span class=\"hl\">01-YAML Table Setup</span><br>&nbsp;&nbsp;YAML → CREATE TABLE with CLUSTER BY AUTO, COMMENT, TBLPROPERTIES<br>&nbsp;&nbsp;+ ALTER TABLE ADD CONSTRAINT pk_* PRIMARY KEY (key_col)<br><br><span class=\"hl-p\">02-Merge Patterns</span> (three patterns from YAML scd_type):<br>&nbsp;&nbsp;SCD1: .whenMatchedUpdateAll().whenNotMatchedInsertAll()<br>&nbsp;&nbsp;SCD2: Match on biz_key AND is_current=true<br>&nbsp;&nbsp;&nbsp;&nbsp;→ Close old: UPDATE SET is_current=false, effective_to=today<br>&nbsp;&nbsp;&nbsp;&nbsp;→ Insert new: with effective_from=today, is_current=true<br>&nbsp;&nbsp;Facts: Match on grain (composite PK), update measures only<br><br><span class=\"hl-g\">03-Deduplication</span><br>&nbsp;&nbsp;.orderBy(processed_timestamp.desc).dropDuplicates(business_key)<br>&nbsp;&nbsp;Dedup key MUST equal MERGE key (mismatch = data loss)</div>",
        "inputOutput": {
          "inputs": [
            "YAML schemas",
            "Silver tables"
          ],
          "outputs": [
            "CREATE TABLE DDLs",
            "MERGE SQL",
            "dedup SQL"
          ]
        }
      },
      {
        "expand": [
          "ta-s5"
        ],
        "activate": [
          "ta-n-s5"
        ],
        "narration": "<span class=\"hl\">Stage 5: Planning</span> — generates YAML manifest contracts for downstream stages 6-9.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "planning-00"
        ],
        "designRationale": "Stage 5 reads Gold artifacts and emits <em>four YAML manifests</em> — one per downstream stage:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Gold YAML + ERDs + Business Docs</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓ Planning orchestrator<br><span class=\"hl-p\">semantic-layer-manifest.yaml</span> → Stage 6<br>&nbsp;&nbsp;Metric Views, TVFs, Genie Spaces per domain<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">observability-manifest.yaml</span> → Stage 7<br>&nbsp;&nbsp;Monitors, dashboards, alerts per table<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">ml-manifest.yaml</span> → Stage 8<br>&nbsp;&nbsp;Feature tables, models, experiments<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">genai-agents-manifest.yaml</span> → Stage 9<br>&nbsp;&nbsp;Agents, tools, eval datasets, deployment</div><br><strong>Why manifests?</strong> They decouple stages — if Stage 7 fails, restart from its manifest without re-running 1-6. Every artifact traces to (1) a Gold table and (2) a business use case.",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "project requirements"
          ],
          "outputs": [
            "YAML manifests for stages 6-9"
          ]
        }
      },
      {
        "expand": [
          "ta-s6"
        ],
        "activate": [
          "ta-n-s6"
        ],
        "narration": "<span class=\"hl\">Stage 6: Semantic Layer</span> — Metric Views, TVFs, and Genie Spaces.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "semantic-00"
        ],
        "designRationale": "The semantic layer <em>sits between Gold tables and consumers</em> — providing business-meaningful definitions that any tool can query consistently:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Phase 1: Metric Views</span> (YAML definitions)<br>&nbsp;&nbsp;CREATE VIEW ... WITH METRICS LANGUAGE YAML<br>&nbsp;&nbsp;measures: total_revenue: \"SUM(amount)\"<br>&nbsp;&nbsp;Query: SELECT MEASURE(total_revenue) FROM mv_sales<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Phase 2: TVFs</span> (parameterized SQL)<br>&nbsp;&nbsp;CREATE FUNCTION fn_revenue_by_period(start STRING, end STRING)<br>&nbsp;&nbsp;All params = STRING for Genie compatibility<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Phase 3: Genie Spaces</span><br>&nbsp;&nbsp;Instructions (≤20 lines) + Data Assets + Benchmarks (≥10 Q&amp;A)<br>&nbsp;&nbsp;Asset priority: Metric Views → TVFs → Tables<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Phase 4: DAB job</span> (create_MVs → create_TVFs → deploy_Genie)</div>",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "planning manifests"
          ],
          "outputs": [
            "Metric Views",
            "TVFs",
            "Genie Space JSON",
            "benchmark questions"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s6-w1",
          "ta-n-s6-w2",
          "ta-n-s6-w3"
        ],
        "narration": "Workers: <span class=\"hl-y\">metric-views</span>, <span class=\"hl-y\">TVFs</span>, <span class=\"hl-y\">Genie Space patterns</span>.",
        "tier": [
          3,
          "Tier 3: Workers"
        ],
        "skillIds": [
          "semantic-01",
          "semantic-02",
          "semantic-03"
        ],
        "designRationale": "Three asset types for <em>different query patterns</em>:<br><br><table><tr><th>Asset</th><th>What It Does</th><th>When Genie Uses It</th></tr><tr><td>Metric Views</td><td>Pre-defined business metrics (YAML + MEASURE())</td><td>First choice — richest semantics, pre-joined, correct formulas</td></tr><tr><td>TVFs</td><td>Parameterized SQL functions (date ranges, Top-N)</td><td>Second choice — when the question needs parameters</td></tr><tr><td>Raw Tables</td><td>Direct Gold table access</td><td>Last resort — least context for the AI</td></tr></table><br><strong>Metric Views</strong> use <code>WITH METRICS LANGUAGE YAML</code> — not a SQL SELECT. They define dimensions and measures declaratively, and the engine resolves aggregations at query time across any dimension.<br><br><strong>TVFs</strong> must use <code>STRING</code> params (not DATE) for Genie compatibility, and <code>ROW_NUMBER() WHERE rank &lt;= top_n</code> instead of <code>LIMIT</code> with a parameter.",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "agent instructions"
          ],
          "outputs": [
            "CREATE METRIC VIEW SQL",
            "CREATE FUNCTION SQL",
            "Genie Space config"
          ]
        }
      },
      {
        "expand": [
          "ta-s7"
        ],
        "activate": [
          "ta-n-s7"
        ],
        "narration": "<span class=\"hl\">Stage 7: Observability</span> — monitors, dashboards, alerts, anomaly detection.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "monitor-00"
        ],
        "designRationale": "Four-layer defense for data health — each layer catches what the others miss:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Layer 1: Lakehouse Monitors</span> (table-level)<br>&nbsp;&nbsp;TimeSeriesConfig / SnapshotConfig on Gold tables<br>&nbsp;&nbsp;→ *_profile_metrics + *_drift_metrics output tables<br>&nbsp;&nbsp;Custom business KPIs (AGGREGATE, DERIVED, DRIFT types)<br><br><span class=\"hl-p\">Layer 2: Anomaly Detection</span> (schema-level)<br>&nbsp;&nbsp;Monitor(object_type=\"schema\", object_id=schema_uuid)<br>&nbsp;&nbsp;ML baselines for freshness + completeness<br>&nbsp;&nbsp;→ system.data_quality_monitoring.table_results<br><br><span class=\"hl-g\">Layer 3: AI/BI Dashboards</span> (visual)<br>&nbsp;&nbsp;Lakeview JSON with monitoring widgets<br>&nbsp;&nbsp;Green/yellow/red health indicators per table<br><br><span class=\"hl-o\">Layer 4: SQL Alerts</span> (reactive)<br>&nbsp;&nbsp;Threshold-based: \"0 new bookings in 24h\"<br>&nbsp;&nbsp;→ email / Slack / PagerDuty notifications</div>",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "Silver tables",
            "planning manifests"
          ],
          "outputs": [
            "Lakehouse monitors",
            "Lakeview dashboards",
            "SQL alerts"
          ]
        }
      },
      {
        "expand": [
          "ta-s8"
        ],
        "activate": [
          "ta-n-s8"
        ],
        "narration": "<span class=\"hl\">Stage 8: ML</span> — feature engineering, model training, batch inference.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "ml-00"
        ],
        "designRationale": "End-to-end ML on the Lakehouse — three DAB jobs form the pipeline:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Job 1: Feature Engineering</span><br>&nbsp;&nbsp;Gold Tables → fe.create_table() → UC Feature Tables<br>&nbsp;&nbsp;Consistent features between training and serving<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Job 2: Training</span> (parallel per model)<br>&nbsp;&nbsp;fe.create_training_set(df, feature_lookups, label)<br>&nbsp;&nbsp;MLflow logs params, metrics, artifacts, model<br>&nbsp;&nbsp;mlflow.register_model() → UC Model Registry<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Job 3: Batch Inference</span><br>&nbsp;&nbsp;scoring_df = feature_table.select(lookup_keys).distinct()<br>&nbsp;&nbsp;predictions = fe.score_batch(model_uri, scoring_df)<br>&nbsp;&nbsp;→ Predictions table (governed, traceable)</div><br><strong>Key pattern:</strong> <code>fe.score_batch()</code> automatically retrieves features using the same lookups defined in training — eliminating training/serving skew.",
        "inputOutput": {
          "inputs": [
            "Gold feature tables",
            "planning manifests"
          ],
          "outputs": [
            "MLflow experiments",
            "registered models",
            "inference pipelines"
          ]
        }
      },
      {
        "expand": [
          "ta-s9"
        ],
        "activate": [
          "ta-n-s9"
        ],
        "narration": "<span class=\"hl\">Stage 9: GenAI Agents</span> — current course orchestrator with foundation, Track A, SDLC, and capstone routes.",
        "tier": [
          2,
          "Tier 2: Orchestrator"
        ],
        "skillIds": [
          "genai-00"
        ],
        "designRationale": "The capstone stage now starts from the <em>course orchestrator</em>, not the deleted setup skill:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Foundation</span> → UC resources, MLflow, tracing, tools, AI Gateway<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Track A</span> → custom Python Agent App on Databricks Apps<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">AppKit 2-Apps</span> → 06d proxy with OBO forwarding<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Chat + feedback</span> → 07/08 persistence and MLflow assessments<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">SDLC</span> → prompt registry, evals, registration, deploy, monitor</div><br>The agent consumes Gold tables, Genie Spaces, Lakebase memory, and MLflow traces built or configured in prior stages.",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "Genie Spaces",
            "Lakebase",
            "MLflow experiment"
          ],
          "outputs": [
            "Agent App",
            "AppKit proxy contract",
            "evaluation datasets",
            "deployment + monitoring"
          ]
        }
      },
      {
        "activate": [
          "ta-n-s9-w1",
          "ta-n-s9-w2",
          "ta-n-s9-w3",
          "ta-n-s9-w4"
        ],
        "narration": "Course modules: <span class=\"hl-y\">foundation</span>, <span class=\"hl-y\">Track A</span>, <span class=\"hl-y\">SDLC</span>, and optional <span class=\"hl-y\">capstone</span>.",
        "tier": [
          3,
          "Tier 3: Course Modules"
        ],
        "skillIds": [
          "genai-00"
        ],
        "designRationale": "The current GenAI tree is organized by course modules rather than the older eight-worker setup. Foundation skills establish UC, MLflow, tracing, tools, and AI Gateway. Track A builds the custom Agent App. The AppKit skills add the 2-Apps UI proxy, chat history, and feedback. SDLC skills handle prompt registry, evaluation, deployment, monitoring, and iteration.",
        "inputOutput": {
          "inputs": [
            "agent spec",
            "tools",
            "data assets"
          ],
          "outputs": [
            "working Agent App",
            "AppKit integration",
            "eval scores",
            "versioned prompts",
            "production monitors"
          ]
        }
      },
      {
        "narration": "<strong>Full pipeline traversal complete!</strong> From schema CSV to production GenAI agents in 9 stages with 44 accelerator skills.",
        "tier": [
          1,
          "Complete"
        ],
        "summary": true
      }
    ]
  },
  "b": {
    "name": "PRD to Deployed App",
    "tree": "<ul>\n<li id=\"tb-root\" class=\"collapsed\"><div class=\"tnode type-entry\" id=\"tb-n-root\" data-skill=\"appkit-00\" data-toggle=\"tb-root\"><div class=\"icon\" style=\"background:var(--cyan-dim);color:var(--cyan)\">N</div><div class=\"name\">00-appkit-navigator</div><div class=\"tag\" style=\"background:var(--cyan-dim);color:var(--cyan)\">router</div><div class=\"chevron\">▶</div></div>\n<ul>\n<li id=\"tb-p1\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tb-n-p1\" data-skill=\"appkit-01\" data-toggle=\"tb-p1\"><div class=\"icon\">1</div><div class=\"name\">Phase 1: Scaffold + Build</div><div class=\"tag\">phase</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"tb-n-p1-s1\" data-skill=\"appkit-01\"><div class=\"icon\">S</div><div class=\"name\">01-appkit-scaffold</div><div class=\"tag\">skill</div><div class=\"meta\">databricks apps init</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p1-s2\" data-skill=\"appkit-02\"><div class=\"icon\">B</div><div class=\"name\">02-appkit-build</div><div class=\"tag\">skill</div><div class=\"meta\">PRD → mock UI</div></div></li></ul></li>\n<li id=\"tb-p2\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tb-n-p2\" data-skill=\"appkit-03\" data-toggle=\"tb-p2\"><div class=\"icon\">2</div><div class=\"name\">Phase 2: Deploy Mock</div><div class=\"tag\">phase</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"tb-n-p2-s1\" data-skill=\"appkit-03\"><div class=\"icon\">D</div><div class=\"name\">03-appkit-deploy</div><div class=\"tag\">skill</div><div class=\"meta\">validate + deploy</div></div></li></ul></li>\n<li id=\"tb-p3\" class=\"collapsed\"><div class=\"tnode type-entry\" id=\"tb-n-p3\" data-skill=\"appkit-04\" data-toggle=\"tb-p3\"><div class=\"icon\" style=\"background:var(--teal-dim);color:var(--teal)\">L</div><div class=\"name\">Phase 3: Setup Lakebase</div><div class=\"tag\" style=\"background:var(--teal-dim);color:var(--teal)\">bundle</div><div class=\"meta\">plugin + app resources</div></div></li>\n<li id=\"tb-p4\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tb-n-p4\" data-skill=\"appkit-04\" data-toggle=\"tb-p4\"><div class=\"icon\">4</div><div class=\"name\">Phase 4: Wire Branches</div><div class=\"tag\">phase</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s1\" data-skill=\"appkit-04\"><div class=\"icon\">P</div><div class=\"name\">04-appkit-plugin-add</div><div class=\"tag\">skill</div><div class=\"meta\">plugins + resources</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s2\" data-skill=\"appkit-05\"><div class=\"icon\">W</div><div class=\"name\">05-appkit-lakebase-wiring</div><div class=\"tag\">skill</div><div class=\"meta\">DDL + CRUD + hooks</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s3\" data-skill=\"appkit-06\"><div class=\"icon\">6</div><div class=\"name\">06-appkit-serving-wiring</div><div class=\"tag\">optional</div><div class=\"meta\">serving endpoint</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s4\" data-skill=\"appkit-06d\"><div class=\"icon\">6d</div><div class=\"name\">06d-agent-app-proxy</div><div class=\"tag\">optional</div><div class=\"meta\">2-Apps + OBO</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s5\" data-skill=\"appkit-07\"><div class=\"icon\">7</div><div class=\"name\">07-chat-history</div><div class=\"tag\">optional</div><div class=\"meta\">sessions + messages</div></div></li><li><div class=\"tnode type-worker\" id=\"tb-n-p4-s6\" data-skill=\"appkit-08\"><div class=\"icon\">8</div><div class=\"name\">08-feedback</div><div class=\"tag\">optional</div><div class=\"meta\">votes + MLflow</div></div></li></ul></li>\n<li id=\"tb-p5\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tb-n-p5\" data-skill=\"appkit-03\" data-toggle=\"tb-p5\"><div class=\"icon\">5</div><div class=\"name\">Phase 5: Deploy + E2E</div><div class=\"tag\">phase</div><div class=\"meta\">live data verification</div></div></li>\n</ul></li></ul>",
    "steps": [
      {
        "expand": [
          "tb-root"
        ],
        "activate": [
          "tb-n-root"
        ],
        "narration": "<span class=\"hl\">AppKit Navigator</span> — the entry point that routes to the right skill based on your intent.",
        "tier": [
          1,
          "Tier 1: Entry"
        ],
        "skillIds": [
          "appkit-00"
        ],
        "designRationale": "The navigator is a <em>traffic cop</em> for all AppKit tasks. It reads your prompt for keywords (\"scaffold\", \"deploy\", \"wire\", \"agent app proxy\", \"feedback\") and loads only the one skill you need. This keeps the AI's context window small instead of loading all 10 skills. Think of it as a receptionist who sends you to the right department instead of giving you the entire employee directory.",
        "inputOutput": {
          "inputs": [
            "user intent"
          ],
          "outputs": [
            "matched skill"
          ]
        }
      },
      {
        "expand": [
          "tb-p1"
        ],
        "activate": [
          "tb-n-p1"
        ],
        "narration": "<span class=\"hl\">Phase 1: Scaffold + Build</span> — from zero to a working app with mock data.",
        "tier": [
          2,
          "Tier 2: Phase 1"
        ],
        "designRationale": "Phase 1 combines scaffolding and building because they're <em>always done together</em>. The scaffold is just an empty skeleton — useless on its own. Here is what happens end-to-end:<br><br><div class=\"ac-diagram\"><span class=\"hl\">databricks apps init</span> → generates project files<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">npm install</span> → downloads ~200 packages into node_modules/<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">AI reads PRD</span> → extracts personas, pages, data shapes<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Builds React components</span> → with static mock data arrays<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl\">npm run dev</span> → live preview at localhost:8000</div><br>At the end of Phase 1, you have a <em>beautiful, fully interactive app</em> that stakeholders can click through — even though no database exists yet. The mock data arrays define the exact shape that Lakebase data will follow later.",
        "inputOutput": {
          "inputs": [
            "PRD document",
            "workspace URL"
          ],
          "outputs": [
            "project files",
            "mock UI",
            "server routes"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p1-s1"
        ],
        "narration": "<span class=\"hl-y\">01-appkit-scaffold</span> — generates the TypeScript project skeleton with one CLI command.",
        "tier": [
          3,
          "Tier 3: Skill"
        ],
        "skillIds": [
          "appkit-01"
        ],
        "designRationale": "The scaffold creates AppKit's <em>canonical file structure</em> that all other skills depend on:<br><br><pre>my-app/\n├── app.yaml            ← tells Databricks HOW to run the app\n├── databricks.yml      ← tells Databricks WHAT resources to bind\n├── package.json        ← JavaScript dependencies + scripts\n├── server/server.ts    ← Express backend (plugins registered here)\n├── client/src/App.tsx  ← React frontend (UI lives here)\n└── config/queries/     ← SQL files → query keys for analytics()</pre><br><strong>What is npm?</strong> It is the JavaScript package manager (like pip for Python). <code>npm install</code> reads <code>package.json</code> and downloads all libraries. <code>npm run dev</code> starts a local server with hot-reload — edit code and the browser updates instantly.<br><br><strong>Blank vs Plugin-Enabled:</strong> The workshop starts with a blank scaffold (no data plugins). This proves the app works before adding complexity. Plugins are added incrementally in Phase 4.",
        "inputOutput": {
          "inputs": [
            "template choice",
            "app name"
          ],
          "outputs": [
            "server/server.ts",
            "client/src/App.tsx",
            "config/queries/",
            "app.yaml"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p1-s2"
        ],
        "narration": "<span class=\"hl-y\">02-appkit-build</span> — translates the PRD into React UI with mock data. Design quality is non-negotiable!",
        "tier": [
          3,
          "Tier 3: Skill"
        ],
        "skillIds": [
          "appkit-02"
        ],
        "designRationale": "This skill follows a <em>6-step translation process</em> from PRD to working UI:<br><br><div class=\"ac-diagram\"><span class=\"hl\">① Read PRD</span> → who are the users? what do they need?<br><span class=\"hl-p\">② Design SQL</span> → config/queries/*.sql → <code>npm run typegen</code><br><span class=\"hl-g\">③ Design UI</span> → aesthetic direction + AppKit UI components<br><span class=\"hl-o\">④ Build Backend</span> → createApp + plugin registration<br><span class=\"hl-p\">⑤ Build Frontend</span> → React pages with mock data arrays<br><span class=\"hl-g\">⑥ Verify</span> → <code>npm run dev</code> + visual check</div><br><strong>Mock data arrays</strong> are static JavaScript arrays that mimic real database rows:<pre>const MOCK_BOOKINGS = [\n  { id: 1, guest: \"Alice\", room: \"Suite\", amount: 450 },\n  { id: 2, guest: \"Bob\", room: \"Standard\", amount: 180 },\n];</pre>The UI renders these identically to live data. When Lakebase is wired in Phase 4, the arrays are swapped for API calls — <em>zero component changes needed</em> because the data shape is already correct.<br><br><strong>Key tech:</strong> React 19 (UI framework), TypeScript (type safety), Vite (fast build tool), AppKit UI (Shadcn/Radix components + ECharts for visualizations).",
        "inputOutput": {
          "inputs": [
            "PRD",
            "scaffolded project"
          ],
          "outputs": [
            "React components",
            "mock data arrays",
            "styled pages"
          ]
        }
      },
      {
        "expand": [
          "tb-p2"
        ],
        "activate": [
          "tb-n-p2"
        ],
        "narration": "<span class=\"hl\">Phase 2: Deploy Mock</span> — first deployment validates the full infrastructure pipeline.",
        "tier": [
          2,
          "Tier 2: Phase 2"
        ],
        "designRationale": "Deploying with mock data <em>first</em> is a deliberate strategy. It validates the entire infrastructure chain before adding database complexity:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Your Code</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓ <code>databricks apps deploy</code><br><span class=\"hl-p\">Platform Pipeline</span> (inside the container):<br>&nbsp;&nbsp;① Download source → /home/app/<br>&nbsp;&nbsp;② <code>npm install</code> (production — no devDependencies)<br>&nbsp;&nbsp;③ <code>npm run build</code> (Vite compiles React → dist/)<br>&nbsp;&nbsp;④ Run command from app.yaml: <code>[node, build/index.mjs]</code><br>&nbsp;&nbsp;⏱ All 4 steps must complete in <strong>10 minutes</strong><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Live App</span> → https://my-app.cloud.databricks.com<br>&nbsp;&nbsp;+ Service Principal (for API calls)<br>&nbsp;&nbsp;+ Auto-injected DATABRICKS_HOST, APP_PORT<br>&nbsp;&nbsp;+ Workspace SSO authentication (OBO)</div><br>If the app can't deploy with static data, adding Lakebase won't help — you'd be debugging two problems at once. This is the <em>\"make it work, then make it real\"</em> principle.",
        "inputOutput": {
          "inputs": [
            "built app",
            "app.yaml"
          ],
          "outputs": [
            "deployed app URL",
            "health check status"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p2-s1"
        ],
        "narration": "<span class=\"hl-y\">03-appkit-deploy</span> — the three-command deploy: validate → build → deploy.",
        "tier": [
          3,
          "Tier 3: Skill"
        ],
        "skillIds": [
          "appkit-03"
        ],
        "designRationale": "The deploy skill runs an <em>autonomous validate-deploy-verify-fix loop</em>:<br><br><div class=\"ac-diagram\"><span class=\"hl\">① databricks apps validate</span><br>&nbsp;&nbsp;Checks: app.yaml syntax, resource bindings, command format<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② npm run build</span><br>&nbsp;&nbsp;Vite compiles client/src/ → client/dist/ (optimized JS/CSS)<br>&nbsp;&nbsp;Express will serve dist/ as static files in production<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ databricks apps deploy</span><br>&nbsp;&nbsp;= bundle deploy (sync code) + apps start (launch container)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Verify</span><br>&nbsp;&nbsp;<code>databricks apps get --name my-app</code><br>&nbsp;&nbsp;Look for: compute_status.state = \"ACTIVE\"<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ if failed<br><span class=\"hl\">⑤ Read logs → diagnose → fix → redeploy</span></div><br><strong>What is app.yaml?</strong> The manifest file that tells the platform:<br>• <code>command:</code> how to start your app (e.g. <code>[node, build/index.mjs]</code>)<br>• <code>env:</code> environment variables, often bound to resources via <code>valueFrom:</code><br>• Every <code>valueFrom:</code> must match a resource in <code>databricks.yml</code> — mismatches cause empty vars at runtime.",
        "inputOutput": {
          "inputs": [
            "app source code"
          ],
          "outputs": [
            "deployed app",
            "Service Principal",
            "env vars"
          ]
        }
      },
      {
        "expand": [
          "tb-p3"
        ],
        "activate": [
          "tb-n-p3"
        ],
        "narration": "<span class=\"hl\">Phase 3: Setup Lakebase</span> — add Lakebase package and bundle resources without touching server.ts.",
        "tier": [
          2,
          "Tier 2: Phase 3"
        ],
        "designRationale": "Phase 3 is <em>configuration-only</em>. It installs the Lakebase package, declares <code>postgres_projects</code> in <code>databricks.yml</code>, and binds <code>LAKEBASE_ENDPOINT</code> / <code>DB_SCHEMA</code> in <code>app.yaml</code>. It deliberately keeps <code>server/server.ts</code> unchanged because the platform injects Lakebase env vars only after deploy. Plugin registration waits until Phase 4, where the backend can also add DDL, routes, and fallbacks.",
        "inputOutput": {
          "inputs": [
            "app name",
            "bundle config"
          ],
          "outputs": [
            "@databricks/lakebase dependency",
            "postgres project resource",
            "app env bindings"
          ]
        }
      },
      {
        "expand": [
          "tb-p4"
        ],
        "activate": [
          "tb-n-p4"
        ],
        "narration": "<span class=\"hl\">Phase 4: Wire Branches</span> — choose Lakebase, agent endpoint, or separate Agent App paths.",
        "tier": [
          2,
          "Tier 2: Phase 4"
        ],
        "designRationale": "Phase 4 is branch-aware rather than linear:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Lakebase branch</span> → 05 DDL, CRUD routes, React hooks<br><span class=\"hl-p\">Serving branch</span> → 06 Model Serving / Agent endpoint chat<br><span class=\"hl-g\">2-Apps branch</span> → 06d AppKit proxy to separate Agent App<br><span class=\"hl-o\">Quality branch</span> → 07 chat history + 08 feedback</div><br>Pick only the branches your app needs. Chat history requires Lakebase plus an agent stream. Feedback requires chat history because it depends on message IDs and trace IDs.",
        "inputOutput": {
          "inputs": [
            "selected branches",
            "app code",
            "agent runtime"
          ],
          "outputs": [
            "live data APIs",
            "agent chat stream",
            "conversation history",
            "feedback assessments"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p4-s1"
        ],
        "narration": "<span class=\"hl-y\">04-appkit-plugin-add</span> — add AppKit plugins and resources for the chosen branch.",
        "tier": [
          3,
          "Tier 3: Skill"
        ],
        "skillIds": [
          "appkit-04"
        ],
        "designRationale": "Adding a plugin is a <em>one-line change</em> in <code>server/server.ts</code> — but it configures a lot behind the scenes:<br><br><pre>import { createApp, server, lakebase } from \"@databricks/appkit\";\n\nconst AppKit = await createApp({\n  plugins: [server({ autoStart: false }), lakebase()],\n});</pre><br><strong>What <code>lakebase()</code> does internally:</strong><br><div class=\"ac-diagram\"><span class=\"hl\">Creates a PostgreSQL connection pool</span> (max 10 connections)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Sets up OAuth token rotation</span> (1-hour tokens, 2-min buffer)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Reads PGHOST, PGPORT, PGDATABASE</span> from env (auto-injected)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br>Exposes <span class=\"hl-o\">AppKit.lakebase.query(sql, params)</span> for your code</div><br><strong>Why <code>server({ autoStart: false })</code>?</strong> Because you need to register custom API routes via <code>AppKit.server.extend()</code> <em>before</em> the server starts listening. You call <code>await AppKit.server.start()</code> manually at the end.",
        "inputOutput": {
          "inputs": [
            "server.ts",
            "plugin choice"
          ],
          "outputs": [
            "updated server.ts",
            "plugin config"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p4-s2"
        ],
        "narration": "<span class=\"hl-y\">05-appkit-lakebase-wiring</span> — builds the complete data flow: DDL → API → Hook → Badge.",
        "tier": [
          3,
          "Tier 3: Skill"
        ],
        "skillIds": [
          "appkit-05"
        ],
        "designRationale": "This skill wires <em>four layers</em> that connect the database to the user's screen:<br><br><div class=\"ac-diagram\"><span class=\"hl\">Layer 1: DDL</span> (database tables)<br>  CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.bookings (...)<br>  Runs on EVERY startup — idempotent (safe to repeat)<br>  Service Principal executes DDL and owns the tables<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Layer 2: Express API Routes</span><br>  AppKit.server.extend((app) =&gt; {<br>    app.get(\"/api/bookings\", ...) → Lakebase query<br>    app.post(\"/api/bookings\", ...) → INSERT with $1, $2<br>  });<br>  Every route returns { data: [...], source: \"live\"|\"mock\" }<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">Layer 3: useLakebaseData() Hook</span><br>  const { data, source } = useLakebaseData(\"/api/bookings\")<br>  source = \"live\" | \"mock\" | \"loading\"<br>  Automatically re-fetches when endpoint changes<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">Layer 4: ConnectionStatus Badge</span><br>  🟢 Live Data (green) — connected to Lakebase<br>  🟡 Mock Data (yellow) — using fallback arrays</div><br><strong>The mock fallback</strong> is the key pattern: every API route wraps its Lakebase call in <code>try/catch</code>. On failure, it returns the same JSON shape with <code>source: \"mock\"</code>. The frontend renders identically either way — the only difference is the badge color.",
        "inputOutput": {
          "inputs": [
            "data requirements",
            "Lakebase connection"
          ],
          "outputs": [
            "DDL scripts",
            "CRUD API routes",
            "useLakebaseData hook",
            "ConnectionStatus"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p4-s3",
          "tb-n-p4-s4"
        ],
        "narration": "<span class=\"hl-y\">06 / 06d</span> — choose endpoint-based chat or a separate Agent App proxy.",
        "tier": [
          3,
          "Tier 3: Agent Branch"
        ],
        "skillIds": [
          "appkit-06",
          "appkit-06d"
        ],
        "designRationale": "Use <code>06-appkit-serving-wiring</code> when the agent is a Model Serving or Agent Serving endpoint. Use <code>06d-appkit-agent-app-proxy</code> when the GenAI course produced a separate Databricks Agent App. The 06d path forwards both app-to-app authorization and the end-user token so downstream tools can honor OBO permissions.",
        "inputOutput": {
          "inputs": [
            "agent endpoint or Agent App URL",
            "auth model"
          ],
          "outputs": [
            "streaming chat route",
            "frontend chat UI",
            "OBO proxy contract"
          ]
        }
      },
      {
        "activate": [
          "tb-n-p4-s5",
          "tb-n-p4-s6"
        ],
        "narration": "<span class=\"hl-y\">07 / 08</span> — add persistent conversations and user feedback.",
        "tier": [
          3,
          "Tier 3: Quality Loop"
        ],
        "skillIds": [
          "appkit-07",
          "appkit-08"
        ],
        "designRationale": "Chat history persists sessions, messages, and trace IDs in Lakebase. Feedback uses those trace IDs to tie thumbs up/down votes back to MLflow assessments. Together, they convert production conversations into evidence for prompt iteration and evaluation datasets.",
        "inputOutput": {
          "inputs": [
            "Lakebase chat schema",
            "trace IDs"
          ],
          "outputs": [
            "conversation sidebar",
            "Vote records",
            "MLflow assessments"
          ]
        }
      },
      {
        "expand": [
          "tb-p5"
        ],
        "activate": [
          "tb-n-p5"
        ],
        "narration": "<span class=\"hl\">Phase 5: Deploy + E2E</span> — deploy with live Lakebase and verify everything works.",
        "tier": [
          2,
          "Tier 2: Phase 5"
        ],
        "designRationale": "The final deploy includes <em>automatic database initialization</em> — a carefully orchestrated first-boot sequence:<br><br><div class=\"ac-diagram\"><span class=\"hl\">① databricks apps deploy</span> (pushes wired code)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">② Container starts</span> → server.ts runs<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">③ DDL executes</span> → Service Principal creates tables<br>&nbsp;&nbsp;CREATE SCHEMA IF NOT EXISTS → CREATE TABLE IF NOT EXISTS<br>&nbsp;&nbsp;SP becomes owner of all database objects<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">④ Seed data check</span> → SELECT count(*) → INSERT if empty<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl\">⑤ Health check passes</span> → app goes ACTIVE</div><br><strong>E2E Verification Checklist:</strong><br>• ConnectionStatus badge shows <span style=\"color:var(--green)\">🟢 Live Data</span><br>• Create a record → refresh page → it persists (not mock)<br>• Check API response: <code>source: \"live\"</code> in JSON<br>• Open DevTools Network tab → verify <code>/api/*</code> calls succeed<br><br>If any check fails, the deploy skill reads container logs, diagnoses the issue, and attempts an automatic fix. The most common issues: missing <code>valueFrom</code> bindings in <code>app.yaml</code>, or the Service Principal lacking <code>CAN_CONNECT_AND_CREATE</code> permission.",
        "inputOutput": {
          "inputs": [
            "wired app",
            "DDL scripts",
            "Lakebase endpoint"
          ],
          "outputs": [
            "production app with live data",
            "E2E test results"
          ]
        }
      },
      {
        "narration": "<strong>App lifecycle complete!</strong> From PRD to production Databricks App with Lakebase and optional agent chat.",
        "tier": [
          1,
          "Complete"
        ],
        "summary": true
      }
    ]
  },
  "c": {
    "name": "The Full Picture",
    "tree": "<ul>\n<li id=\"tc-root\" class=\"collapsed\"><div class=\"tnode type-entry\" id=\"tc-n-root\" data-skill=\"\" data-toggle=\"tc-root\"><div class=\"icon\" style=\"background:var(--cyan-dim);color:var(--cyan)\">★</div><div class=\"name\">Complete Data Product</div><div class=\"tag\" style=\"background:var(--cyan-dim);color:var(--cyan)\">convergence</div><div class=\"chevron\">▶</div></div>\n<ul>\n<li id=\"tc-pathb\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tc-n-pathb\" data-skill=\"gold-00\" data-toggle=\"tc-pathb\"><div class=\"icon\">B</div><div class=\"name\">Path B: Data Pipeline</div><div class=\"tag\">9 stages</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-manifest\" id=\"tc-n-gold\" data-skill=\"gold-01\"><div class=\"icon\">→</div><div class=\"name\">Gold Tables (dimensional model)</div><div class=\"tag\">output</div></div></li><li><div class=\"tnode type-manifest\" id=\"tc-n-semantic\" data-skill=\"semantic-00\"><div class=\"icon\">→</div><div class=\"name\">Semantic Layer (Metric Views)</div><div class=\"tag\">output</div></div></li><li><div class=\"tnode type-manifest\" id=\"tc-n-genie\" data-skill=\"semantic-03\"><div class=\"icon\">→</div><div class=\"name\">Genie Spaces (NL analytics)</div><div class=\"tag\">output</div></div></li></ul></li>\n<li id=\"tc-patha\" class=\"collapsed\"><div class=\"tnode type-orchestrator\" id=\"tc-n-patha\" data-skill=\"appkit-00\" data-toggle=\"tc-patha\" style=\"border-color:var(--green)\"><div class=\"icon\" style=\"background:var(--green-dim);color:var(--green)\">A</div><div class=\"name\">Path A: Databricks App</div><div class=\"tag\" style=\"background:var(--green-dim);color:var(--green)\">branch-aware</div><div class=\"chevron\">▶</div></div><ul><li><div class=\"tnode type-worker\" id=\"tc-n-analytics\" data-skill=\"appkit-04\"><div class=\"icon\">→</div><div class=\"name\">analytics() → Gold Tables</div><div class=\"tag\">plugin</div></div></li><li><div class=\"tnode type-worker\" id=\"tc-n-genieplugin\" data-skill=\"semantic-03\"><div class=\"icon\">→</div><div class=\"name\">genie() → Genie Spaces</div><div class=\"tag\">plugin</div></div></li><li><div class=\"tnode type-worker\" id=\"tc-n-lakebase\" data-skill=\"appkit-05\"><div class=\"icon\">→</div><div class=\"name\">lakebase() → App State</div><div class=\"tag\">plugin</div></div></li><li><div class=\"tnode type-worker\" id=\"tc-n-agentproxy\" data-skill=\"appkit-06d\"><div class=\"icon\">→</div><div class=\"name\">06d → Agent App Proxy</div><div class=\"tag\">agent chat</div></div></li><li><div class=\"tnode type-worker\" id=\"tc-n-feedback\" data-skill=\"appkit-08\"><div class=\"icon\">→</div><div class=\"name\">07/08 → History + Feedback</div><div class=\"tag\">quality loop</div></div></li></ul></li>\n</ul></li></ul>",
    "steps": [
      {
        "expand": [
          "tc-root"
        ],
        "activate": [
          "tc-n-root"
        ],
        "narration": "<span class=\"hl\">Two paths, one destination.</span> Data pipeline + application layer = complete data product.",
        "tier": [
          1,
          "Tier 1: Overview"
        ],
        "designRationale": "A <em>complete data product</em> has both a data pipeline (Path B) that builds the analytical foundation, and an application (Path A) that makes it accessible to users. Neither path alone is sufficient — data without a UI is inaccessible, and an app without data is empty. The two paths can be built in parallel by different teams.",
        "inputOutput": {
          "inputs": [
            "schema CSV",
            "PRD"
          ],
          "outputs": [
            "production data product"
          ]
        }
      },
      {
        "expand": [
          "tc-pathb"
        ],
        "activate": [
          "tc-n-pathb"
        ],
        "narration": "<span class=\"hl\">Path B</span> builds the data foundation — Gold tables, semantic layer, ML models, GenAI agents.",
        "tier": [
          2,
          "Tier 2: Pipeline"
        ],
        "designRationale": "The data pipeline follows a <em>9-stage progression</em> where each stage builds on the previous one's output. Gold tables provide the dimensional model. The semantic layer adds business meaning. ML adds predictions. GenAI adds natural language interaction. Each layer increases the data's accessibility and value.",
        "inputOutput": {
          "inputs": [
            "schema CSV"
          ],
          "outputs": [
            "Gold tables",
            "Metric Views",
            "Genie Spaces",
            "ML models",
            "GenAI agents"
          ]
        }
      },
      {
        "activate": [
          "tc-n-gold",
          "tc-n-semantic",
          "tc-n-genie"
        ],
        "narration": "Gold tables power <span class=\"hl-y\">Metric Views</span> and <span class=\"hl-y\">Genie Spaces</span> for natural language analytics.",
        "tier": [
          3,
          "Tier 3: Assets"
        ],
        "designRationale": "These three outputs are what the <em>application layer consumes</em>. Gold tables provide structured data for dashboards and reports. Metric Views provide pre-computed business metrics. Genie Spaces allow natural language queries. Each serves a different user persona: analysts query Gold, executives read Metric Views, and everyone uses Genie.",
        "inputOutput": {
          "inputs": [
            "9-stage pipeline"
          ],
          "outputs": [
            "Gold tables",
            "Metric Views",
            "Genie Spaces"
          ]
        }
      },
      {
        "expand": [
          "tc-patha"
        ],
        "activate": [
          "tc-n-patha"
        ],
        "narration": "<span class=\"hl\">Path A</span> builds the user-facing app that queries the data foundation and can host agent chat.",
        "tier": [
          2,
          "Tier 2: App"
        ],
        "designRationale": "The AppKit application is <em>a thin UI layer</em> on top of the data foundation. It queries Gold tables for dashboards, calls Genie Spaces for NL analytics, uses Lakebase for app-specific state, and can proxy a separate Agent App from the GenAI course when the product needs conversational AI.",
        "inputOutput": {
          "inputs": [
            "PRD",
            "data foundation",
            "optional Agent App"
          ],
          "outputs": [
            "Databricks App with live data and optional agent chat"
          ]
        }
      },
      {
        "activate": [
          "tc-n-analytics",
          "tc-n-genieplugin",
          "tc-n-lakebase",
          "tc-n-agentproxy",
          "tc-n-feedback"
        ],
        "narration": "The app connects via plugins and proxy layers: <span class=\"hl-y\">analytics()</span>, <span class=\"hl-y\">genie()</span>, <span class=\"hl-y\">lakebase()</span>, <span class=\"hl-y\">06d proxy</span>, and <span class=\"hl-y\">07/08 feedback</span>.",
        "tier": [
          3,
          "Tier 3: Plugins + Agent UX"
        ],
        "designRationale": "The plugin and proxy branches each own a distinct data flow: analytics() runs read-only SQL against a SQL Warehouse, genie() streams NL analytics, lakebase() handles transactional app state, 06d forwards chat to a separate Agent App with OBO, and 07/08 persist conversation history and feedback for MLflow assessment loops.",
        "inputOutput": {
          "inputs": [
            "Gold tables",
            "Genie Spaces",
            "Lakebase DB",
            "Agent App URL"
          ],
          "outputs": [
            "dashboards",
            "NL analytics",
            "CRUD state",
            "agent chat",
            "feedback data"
          ]
        }
      },
      {
        "narration": "<strong>The complete picture:</strong> Path B builds the data, Path A builds the experience. Together, a production data product with a beautiful frontend.",
        "tier": [
          1,
          "Complete"
        ],
        "summary": true
      }
    ]
  }
};

export const ACADEMY: AcademyModule[] = [
  {
    "id": "apps",
    "title": "Databricks Apps 101",
    "subtitle": "Managed hosting for full-stack web apps",
    "icon": "⬡",
    "color": "var(--cyan)",
    "content": "<h5>What is Databricks Apps?</h5><p>Managed hosting for full-stack web applications that run inside the Databricks platform. Your app gets a container, a Service Principal identity, and auto-injected environment variables — zero DevOps required.</p>\n<div class=\"ac-diagram\"><span class=\"hl\">User Browser</span> → <span class=\"hl-p\">Databricks Proxy (auth)</span> → <span class=\"hl\">App Container (Node.js)</span><br>↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">SQL Warehouse</span>&nbsp;&nbsp;<span class=\"hl-g\">Lakebase</span>&nbsp;&nbsp;&nbsp;&nbsp;<span class=\"hl-g\">UC Volumes</span>&nbsp;&nbsp;<span class=\"hl-g\">Genie Space</span></div>\n<h5>How Deployment Works</h5>\n<div class=\"ac-diagram\"><span class=\"hl\">databricks apps validate</span> → <span class=\"hl-p\">databricks bundle deploy</span> → <span class=\"hl-g\">databricks apps deploy</span><br>&nbsp;&nbsp;&nbsp;(checks app.yaml)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(syncs to workspace)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(starts container)</div>\n<p>The deploy command builds a container image from your source, sets up networking, provisions the Service Principal, injects env vars from app.yaml resources, and starts the health check loop.</p>\n<h5>Platform Constraints</h5><table><tr><th>Constraint</th><th>Value</th><th>Why it matters</th></tr><tr><td>Startup timeout</td><td>10 minutes</td><td>If your app doesn't respond to health checks in 10 min, deploy fails</td></tr><tr><td>HTTP proxy timeout</td><td>120 seconds</td><td>Long-running requests need SSE streaming, not blocking</td></tr><tr><td>Max apps/workspace</td><td>100</td><td>Enough for dev + staging + prod of many apps</td></tr><tr><td>Persistent storage</td><td>None</td><td>Use Lakebase for state, UC Volumes for files</td></tr><tr><td>Inbound auth</td><td>SSO / OBO</td><td>Users authenticate via workspace SSO, token forwarded as x-forwarded-access-token</td></tr></table>\n<h5>Auto-Injected Env Vars</h5><table><tr><th>Variable</th><th>Description</th></tr><tr><td><code>DATABRICKS_HOST</code></td><td>Workspace URL (e.g., https://myws.cloud.databricks.com)</td></tr><tr><td><code>DATABRICKS_APP_PORT</code></td><td>Port to bind (default 8000)</td></tr><tr><td><code>DATABRICKS_APP_NAME</code></td><td>App name in Databricks</td></tr><tr><td><code>DATABRICKS_CLIENT_ID</code></td><td>Service Principal client ID for API calls</td></tr><tr><td><code>DATABRICKS_CLIENT_SECRET</code></td><td>Service Principal secret (auto-rotated)</td></tr></table>\n<h5>app.yaml Resource Types</h5><pre>resources:\n  - name: sql-warehouse\n    sql_warehouse: auto      # auto-provisions a starter warehouse\n  - name: lakebase-db\n    lakebase:\n      instance: my-project   # connects to a Lakebase instance\n  - name: serving-endpoint\n    serving_endpoint: llm-endpoint  # for AI/LLM calls</pre>\n<h5>Authentication Flow</h5>\n<div class=\"ac-diagram\"><span class=\"hl\">User</span> → SSO login → <span class=\"hl-p\">Proxy adds x-forwarded-access-token</span> → <span class=\"hl-g\">App uses OBO</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class=\"hl-o\">SP fallback for missing scopes</span></div>",
    "quiz": [
      {
        "q": "What happens to files written to local disk?",
        "opts": [
          "Persisted across restarts",
          "Lost on restart",
          "Synced to UC Volumes"
        ],
        "answer": 1
      },
      {
        "q": "What provides the app's identity for API calls?",
        "opts": [
          "User OAuth token",
          "Service Principal",
          "API key"
        ],
        "answer": 1
      },
      {
        "q": "How do users authenticate to a Databricks App?",
        "opts": [
          "Username/password form",
          "Workspace SSO (OBO)",
          "API key in URL"
        ],
        "answer": 1
      },
      {
        "q": "What happens if the app doesn't respond to health checks in 10 minutes?",
        "opts": [
          "It retries indefinitely",
          "The deploy fails",
          "It runs without health checks"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "appkit",
    "title": "AppKit Deep Dive",
    "subtitle": "TypeScript SDK with plugin architecture",
    "icon": "◈",
    "color": "var(--purple)",
    "content": "<h5>Two Packages</h5><p><code>@databricks/appkit</code> (backend: Express server, plugins, SQL queries, caching) + <code>@databricks/appkit-ui</code> (frontend: React hooks, Shadcn/Radix, ECharts). Together they handle data access, type safety, auth, and UI rendering.</p>\n<h5>Canonical Project Structure</h5><pre>my-app/\n├── server/\n│   └── server.ts          ← createApp() + plugins\n├── client/\n│   └── src/\n│       ├── App.tsx         ← root React component\n│       ├── pages/          ← route components\n│       └── components/     ← reusable UI\n├── config/\n│   └── queries/\n│       ├── getBookings.sql ← query key = filename\n│       └── getStats.sql    ← auto-generates types\n├── app.yaml                ← Databricks Apps config\n└── databricks.yml          ← DAB bundle config</pre>\n<h5>The SQL-First Dev Loop</h5><div class=\"ac-diagram\"><span class=\"hl\">1. Write SQL</span> → <span class=\"hl-p\">2. npm run typegen</span> → <span class=\"hl-g\">3. Import types</span> → <span class=\"hl-o\">4. Build UI</span> → <span class=\"hl\">5. npm run dev</span> → <span class=\"hl-g\">6. Deploy</span></div>\n<p>This order is <strong>mandatory</strong>. Writing UI code before typegen means TypeScript types don't exist yet. The SQL file name becomes the query key used in hooks.</p>\n<h5>Plugin System — Core + 5 Data Plugins</h5><table><tr><th>Plugin</th><th>Backend</th><th>Frontend</th></tr><tr><td><code>server()</code></td><td>Express server, static files</td><td>—</td></tr><tr><td><code>analytics()</code></td><td>SQL Warehouse queries, caching</td><td><code>useQuery()</code>, <code>useChart()</code></td></tr><tr><td><code>lakebase()</code></td><td>PostgreSQL connection pool</td><td><code>useLakebaseData()</code></td></tr><tr><td><code>serving()</code></td><td>Model Serving / Agent endpoint calls</td><td>custom chat hooks</td></tr><tr><td><code>genie()</code></td><td>Genie API streaming</td><td><code>&lt;GenieChat /&gt;</code></td></tr><tr><td><code>files()</code></td><td>UC Volume operations</td><td><code>&lt;FilePreview /&gt;</code></td></tr></table>\n<pre>import { createApp, server, analytics, lakebase, serving, genie, files } from \"@databricks/appkit\";\n\nawait createApp({\n  plugins: [server(), analytics(), lakebase(), serving(), genie(), files()],\n});</pre>\n<h5>Agent Chat Extensions</h5><p>Agent-chat apps can use <code>06-appkit-serving-wiring</code> for serving endpoints or <code>06d-appkit-agent-app-proxy</code> for a separate Agent App. Add <code>07-appkit-chat-history</code> for persisted conversations and <code>08-appkit-feedback</code> for MLflow-linked ratings.</p>\n<h5>Query Key Pattern</h5><pre>// config/queries/getTopBookings.sql\nSELECT destination, COUNT(*) as total\nFROM gold.fact_bookings\nGROUP BY destination ORDER BY total DESC LIMIT 10;\n\n// client/src/pages/Dashboard.tsx — type-safe!\nconst { data } = useQuery&lt;GetTopBookings&gt;(\"getTopBookings\");</pre>\n<h5>Design Quality Standards</h5><p>AppKit apps must meet <strong>design quality gates</strong>: proper spacing, color contrast, responsive layout, loading states, empty states, and error boundaries. The build skill enforces this as a checklist.</p>",
    "quiz": [
      {
        "q": "What does npm run typegen do?",
        "opts": [
          "Generates SQL files",
          "Generates TypeScript types from SQL",
          "Compiles TypeScript"
        ],
        "answer": 1
      },
      {
        "q": "Which file is the backend entry point?",
        "opts": [
          "client/src/App.tsx",
          "config/queries/main.sql",
          "server/server.ts"
        ],
        "answer": 2
      },
      {
        "q": "What does the SQL filename become?",
        "opts": [
          "A database table name",
          "A query key for useQuery()",
          "A REST endpoint"
        ],
        "answer": 1
      },
      {
        "q": "Which skill wires a separate Agent App to AppKit?",
        "opts": [
          "05-appkit-lakebase-wiring",
          "06d-appkit-agent-app-proxy",
          "08-appkit-feedback"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "lakebase",
    "title": "Lakebase",
    "subtitle": "Managed PostgreSQL with OAuth — zero passwords",
    "icon": "⛁",
    "color": "var(--teal)",
    "content": "<h5>What is Lakebase?</h5><p>A managed PostgreSQL service on Databricks that uses OAuth instead of passwords. It auto-scales, supports git-like branching, and integrates natively with Databricks Apps via the lakebase() plugin.</p>\n<h5>The Git-Like Model</h5>\n<div class=\"ac-diagram\"><span class=\"hl\">Project</span> → <span class=\"hl-p\">Branch (main)</span> → <span class=\"hl-g\">Endpoint (compute)</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↘ <span class=\"hl-o\">Branch (staging)</span> → <span class=\"hl-g\">Endpoint</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↘ <span class=\"hl-p\">Branch (dev)</span> → <span class=\"hl-g\">Endpoint</span></div>\n<p>Just like git branches for code, you can have dev/staging/prod branches of your database. Each branch gets its own endpoint with independent compute.</p>\n<h5>Key Features</h5><table><tr><th>Feature</th><th>Detail</th><th>Why</th></tr><tr><td>OAuth Auth</td><td>1-hour tokens, auto-refresh</td><td>No passwords to rotate or leak</td></tr><tr><td>Scale-to-zero</td><td>suspend_timeout_duration</td><td>No cost when idle</td></tr><tr><td>Branching</td><td>Projects → Branches → Endpoints</td><td>Safe dev/staging isolation</td></tr><tr><td>Data Sync</td><td>Sync tables to Delta Lake</td><td>Analytics on transactional data</td></tr></table>\n<h5>AppKit Workshop Setup Flow</h5><pre># 1. Add the package\nnpm install @databricks/lakebase\n\n# 2. Declare postgres_projects in databricks.yml\n# 3. Bind LAKEBASE_ENDPOINT and DB_SCHEMA in app.yaml\n# 4. Validate the app before wiring server.ts\ndatabricks apps validate --profile $PROFILE</pre>\n<p>Phase 3 is configuration-only: it prepares bundle-managed Lakebase resources and leaves <code>server/server.ts</code> unchanged. The actual <code>lakebase()</code> registration, DDL, API routes, and frontend hooks happen in Phase 4.</p>\n<p><strong>Genie Code (in-workspace):</strong> pre-authenticated and serverless — drop the <code>--profile $PROFILE</code> flag (no CLI profile). Do the one-time <strong>Set Up Project</strong> first: <code>git clone</code> the repo into your user project (<code>/Workspace/Users/&lt;you&gt;/vibe-coding-workshop</code>, git-backed so generated bundles are recognized) and <strong>copy</strong> the tree into <code>/Workspace/Users/&lt;you&gt;/.assistant/skills/vibe-coding-workshop</code> for skill discovery, then start a NEW Agent-mode chat thread. The local dev-server / E2E-test steps are IDE/CLI-only; on Genie Code, verify against the deployed app.</p>\n<h5>When to Use Lakebase vs. SQL Warehouse</h5><table><tr><th>Pattern</th><th>Use Lakebase</th><th>Use SQL Warehouse</th></tr><tr><td>User writes data</td><td>✅ CRUD operations</td><td>❌ Read-only</td></tr><tr><td>Session/app state</td><td>✅ Transactional</td><td>❌</td></tr><tr><td>Aggregation dashboards</td><td>❌ Not optimized</td><td>✅ Columnar scans</td></tr><tr><td>Ad-hoc analytics</td><td>❌</td><td>✅ Photon engine</td></tr><tr><td>Sub-10ms latency</td><td>✅ PostgreSQL</td><td>❌ 100ms+ cold</td></tr></table>\n<h5>PostgreSQL Type Conventions</h5><table><tr><th>Use Case</th><th>Type</th><th>Never Use</th></tr><tr><td>Auto-increment ID</td><td><code>bigint generated always as identity</code></td><td>serial (deprecated)</td></tr><tr><td>Text fields</td><td><code>text</code></td><td>varchar(n) — arbitrary limits</td></tr><tr><td>Money/prices</td><td><code>numeric(10,2)</code></td><td>float — rounding errors</td></tr><tr><td>Timestamps</td><td><code>timestamptz</code></td><td>timestamp — loses timezone</td></tr><tr><td>Booleans</td><td><code>boolean</code></td><td>int — confusing semantics</td></tr></table>\n<h5>DDL Best Practice</h5><pre>CREATE TABLE IF NOT EXISTS bookings (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  guest_name text NOT NULL,\n  check_in timestamptz NOT NULL,\n  check_out timestamptz NOT NULL,\n  total_price numeric(10,2) NOT NULL DEFAULT 0,\n  status text NOT NULL DEFAULT 'pending',\n  created_at timestamptz NOT NULL DEFAULT now()\n);</pre>",
    "quiz": [
      {
        "q": "How does Lakebase authenticate?",
        "opts": [
          "Username + password",
          "OAuth token rotation",
          "API keys"
        ],
        "answer": 1
      },
      {
        "q": "For money columns, use:",
        "opts": [
          "float",
          "varchar",
          "numeric(10,2)"
        ],
        "answer": 2
      },
      {
        "q": "When should you use SQL Warehouse instead of Lakebase?",
        "opts": [
          "For CRUD operations",
          "For aggregation dashboards",
          "For session state"
        ],
        "answer": 1
      },
      {
        "q": "What is the Lakebase branching model analogous to?",
        "opts": [
          "Docker containers",
          "Git branches",
          "Kubernetes pods"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "sdp",
    "title": "Spark Declarative Pipelines (SDP)",
    "subtitle": "Declarative ETL — define WHAT, not HOW",
    "icon": "⟳",
    "color": "var(--gold)",
    "content": "<h5>What is SDP?</h5><p>Spark Declarative Pipelines (formerly Delta Live Tables / DLT) lets you define <em>what</em> your pipeline produces as decorated Python functions. The engine handles scheduling, retries, checkpointing, and data quality enforcement.</p>\n<h5>Three-Layer Pipeline Architecture</h5>\n<div class=\"ac-diagram\"><span class=\"hl-o\">Bronze (raw)</span> → <span class=\"hl-p\">Silver (cleaned)</span> → <span class=\"hl-g\">Gold (business)</span><br>Ingest as-is&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dedup, type, validate&nbsp;&nbsp;&nbsp;&nbsp;Dimensional model<br>append-only&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;expectations enforce DQ&nbsp;&nbsp;&nbsp;MERGE for SCD</div>\n<h5>Data Quality: Delta Table Pattern</h5><p>The framework stores DQ rules in a Delta table instead of hardcoding them. This means rules can be updated with a simple SQL UPDATE — no code change, no redeploy, no PR review.</p>\n<div class=\"ac-diagram\"><span class=\"hl-o\">Traditional (fragile)</span>: Rules in code → PR → deploy → restart<br><span class=\"hl-g\">Delta Table (agile)</span>: Rules in table → UPDATE query → next run picks up</div>\n<pre># Rules loaded at runtime from Delta table\nrules = load_rules(\"silver_bookings\", \"critical\")\n\n@dlt.table(cluster_by_auto=True)\n@dlt.expect_all_or_drop(rules)\ndef silver_bookings():\n    return dlt.read_stream(\"bronze_bookings\")\n      .select(\n        col(\"booking_id\").cast(\"long\"),\n        col(\"guest_name\").cast(\"string\"),\n        to_timestamp(\"check_in_date\").alias(\"check_in\"),\n        col(\"total_amount\").cast(\"decimal(10,2)\")\n      )</pre>\n<h5>Expectation Types</h5><table><tr><th>Decorator</th><th>On Failure</th><th>Use When</th></tr><tr><td><code>@dlt.expect</code></td><td>Warn, keep row</td><td>Non-critical fields (e.g., optional phone)</td></tr><tr><td><code>@dlt.expect_or_drop</code></td><td>Drop row silently</td><td>Known-bad data you can discard</td></tr><tr><td><code>@dlt.expect_or_fail</code></td><td>Fail pipeline</td><td>Critical invariants (e.g., negative revenue)</td></tr><tr><td><code>@dlt.expect_all_or_drop</code></td><td>Drop if any rule fails</td><td>Batch of rules from Delta table</td></tr></table>\n<h5>Pipeline Non-Negotiables</h5><table><tr><th>Setting</th><th>Value</th><th>Reason</th></tr><tr><td>Serverless</td><td>true</td><td>No cluster management</td></tr><tr><td>Edition</td><td>ADVANCED</td><td>Required for expectations + flows</td></tr><tr><td>Photon</td><td>true</td><td>10-20x faster aggregations</td></tr><tr><td>Liquid Clustering</td><td>AUTO</td><td>Engine-managed data layout</td></tr><tr><td>Row Tracking</td><td>true</td><td>Required for MV refresh</td></tr><tr><td>Change Data Feed</td><td>true</td><td>Incremental downstream processing</td></tr></table>",
    "quiz": [
      {
        "q": "Why store DQ rules in a Delta table?",
        "opts": [
          "Better performance",
          "Runtime-updateable without redeploy",
          "Required by DLT"
        ],
        "answer": 1
      },
      {
        "q": "Which DLT edition is required for expectations?",
        "opts": [
          "CORE",
          "PRO",
          "ADVANCED"
        ],
        "answer": 2
      },
      {
        "q": "What does @dlt.expect_or_fail do when a rule fails?",
        "opts": [
          "Drops the row",
          "Warns and keeps the row",
          "Fails the entire pipeline"
        ],
        "answer": 2
      },
      {
        "q": "What makes Liquid Clustering different from traditional partitioning?",
        "opts": [
          "It uses more storage",
          "The engine manages layout automatically",
          "It requires manual tuning"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "genie",
    "title": "Genie Spaces",
    "subtitle": "Natural language → SQL analytics",
    "icon": "✦",
    "color": "var(--orange)",
    "content": "<h5>What is Genie?</h5><p>Genie Spaces let business users ask questions in plain English and get SQL-powered answers. The AI translates natural language to SQL, executes it against a SQL Warehouse, and returns formatted results.</p>\n<h5>Three Components of a Genie Space</h5><table><tr><th>Component</th><th>Purpose</th><th>Impact on Quality</th></tr><tr><td>Agent Instructions</td><td>Business context (≤20 lines)</td><td>⬛⬛⬛⬛⬛ Highest</td></tr><tr><td>Data Assets</td><td>Tables, Metric Views, TVFs</td><td>⬛⬛⬛⬛ High</td></tr><tr><td>Benchmark Questions</td><td>Expected Q→SQL pairs</td><td>⬛⬛⬛ Medium</td></tr></table>\n<h5>Data Asset Priority</h5>\n<div class=\"ac-diagram\"><span class=\"hl-g\">Metric Views</span> (pre-computed, highest trust) → <span class=\"hl-p\">TVFs</span> (parameterized) → <span class=\"hl-o\">Tables</span> (raw)</div>\n<p>Always prefer Metric Views over raw tables. They encode business logic (e.g., \"revenue = price - discount - tax\") so Genie doesn't have to guess.</p>\n<h5>Writing Great Agent Instructions</h5><pre># Genie Space: Hotel Bookings Analytics\nYou are an analytics assistant for a hotel chain.\nKey terms:\n- \"RevPAR\" = Revenue per Available Room = total_revenue / available_rooms\n- \"ADR\" = Average Daily Rate = room_revenue / rooms_sold\n- \"Occupancy\" = rooms_sold / available_rooms\nWhen asked about \"top hotels\", rank by RevPAR unless specified.\nAll monetary values are in USD.</pre>\n<h5>AppKit Integration</h5><pre>// server/server.ts — register Genie plugin\ngenie({ spaces: { sales: \"01ef7abc-def0-...\" } })\n\n// client/src/pages/Analytics.tsx — drop-in chat\nimport { GenieChat } from \"@databricks/appkit-ui\";\n&lt;GenieChat alias=\"sales\" height={500} /&gt;</pre>\n<div class=\"ac-diagram\"><span class=\"hl\">User asks question</span> → <span class=\"hl-p\">GenieChat component</span> → <span class=\"hl-o\">SSE stream to /api/genie/</span> → <span class=\"hl-g\">Genie API → SQL Warehouse</span></div>\n<h5>Optimization Tips</h5><table><tr><th>Tip</th><th>Details</th></tr><tr><td>Column comments</td><td>Add COMMENT ON COLUMN with business meaning</td></tr><tr><td>Metric Views</td><td>Pre-compute complex calculations</td></tr><tr><td>Benchmark questions</td><td>Cover your top 20 most-asked questions</td></tr><tr><td>Avoid ambiguity</td><td>Define terms like \"active user\" explicitly</td></tr></table>",
    "quiz": [
      {
        "q": "What has the highest impact on Genie quality?",
        "opts": [
          "More tables",
          "Agent Instructions",
          "Faster warehouse"
        ],
        "answer": 1
      },
      {
        "q": "What order does Genie prioritize data assets?",
        "opts": [
          "Tables → TVFs → Views",
          "Metric Views → TVFs → Tables",
          "Random"
        ],
        "answer": 1
      },
      {
        "q": "Why prefer Metric Views over raw tables?",
        "opts": [
          "They are faster",
          "They encode business logic",
          "They use less storage"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "uc",
    "title": "Unity Catalog & Governance",
    "subtitle": "Data governance, lineage, and access control",
    "icon": "⊞",
    "color": "var(--green)",
    "content": "<h5>What is Unity Catalog?</h5><p>Unity Catalog (UC) is Databricks' unified governance layer. It provides a three-level namespace, fine-grained permissions, column-level lineage tracking, and data discovery — all from a single control plane.</p>\n<h5>Three-Level Namespace</h5><div class=\"ac-diagram\"><span class=\"hl\">Catalog</span> → <span class=\"hl-p\">Schema</span> → <span class=\"hl-g\">Table / View / Volume / Function / Model</span></div>\n<pre>-- Full path: catalog.schema.object\nSELECT * FROM production.gold.fact_bookings;</pre>\n<h5>Object Types in UC</h5><table><tr><th>Object</th><th>Description</th><th>Example</th></tr><tr><td>Table</td><td>Managed or external Delta tables</td><td>gold.fact_bookings</td></tr><tr><td>View</td><td>Virtual table (SQL query)</td><td>gold.v_monthly_revenue</td></tr><tr><td>Materialized View</td><td>Pre-computed, auto-refreshed</td><td>gold.mv_daily_stats</td></tr><tr><td>Volume</td><td>File storage (managed/external)</td><td>raw.uploads</td></tr><tr><td>Function</td><td>UDFs and TVFs</td><td>gold.fn_revenue_by_period()</td></tr><tr><td>Model</td><td>MLflow registered models</td><td>ml.churn_predictor</td></tr></table>\n<h5>Table Properties (every Gold table)</h5><pre>TBLPROPERTIES (\n  'delta.enableChangeDataFeed' = 'true',\n  'delta.enableRowTracking' = 'true',\n  'delta.autoOptimize.optimizeWrite' = 'true',\n  'delta.autoOptimize.autoCompact' = 'true',\n  'layer' = 'gold',\n  'domain' = 'bookings',\n  'owner' = 'data-engineering'\n)</pre>\n<h5>Why Each Property Matters</h5><table><tr><th>Property</th><th>Purpose</th><th>Consequence if Missing</th></tr><tr><td>Change Data Feed</td><td>Incremental downstream processing</td><td>Must full-scan for changes</td></tr><tr><td>Row Tracking</td><td>Required for MV refresh</td><td>Materialized Views won't work</td></tr><tr><td>Auto-Optimize</td><td>File compaction + write optimization</td><td>Small files accumulate, slow reads</td></tr><tr><td>Liquid Clustering</td><td>Engine-managed data layout</td><td>Manual OPTIMIZE required</td></tr><tr><td>Tags (layer, domain)</td><td>Discovery, lineage, governance</td><td>Hard to find and govern at scale</td></tr></table>\n<h5>Files Plugin (UC Volumes)</h5><pre>// app.yaml resource\n- name: volumes\n  serving_endpoint: null  # uses workspace default\n\n// Auto-discovered from env vars\nDATABRICKS_VOLUME_UPLOADS=/Volumes/catalog/schema/uploads\n\n// React: DirectoryList, FileBreadcrumb, FilePreviewPanel</pre>",
    "quiz": [
      {
        "q": "What is required for Materialized View refresh?",
        "opts": [
          "Change Data Feed",
          "Row Tracking",
          "Liquid Clustering"
        ],
        "answer": 1
      },
      {
        "q": "How many levels in the UC namespace?",
        "opts": [
          "2 (schema.table)",
          "3 (catalog.schema.table)",
          "4 (workspace.catalog.schema.table)"
        ],
        "answer": 1
      },
      {
        "q": "What happens without auto-optimize?",
        "opts": [
          "Tables get corrupted",
          "Small files accumulate, reads slow down",
          "Nothing noticeable"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "medallion",
    "title": "Medallion Architecture",
    "subtitle": "Bronze → Silver → Gold data layering",
    "icon": "◆",
    "color": "var(--bronze)",
    "content": "<h5>The Three Layers</h5><p>The Medallion Architecture organizes data into three quality tiers. Each layer has a specific purpose and transformation pattern.</p>\n<div class=\"ac-diagram\"><span class=\"hl-o\">Bronze (raw)</span>&nbsp;&nbsp;&nbsp;→&nbsp;&nbsp;&nbsp;<span class=\"hl-p\">Silver (validated)</span>&nbsp;&nbsp;&nbsp;→&nbsp;&nbsp;&nbsp;<span class=\"hl-g\">Gold (business)</span><br>Ingest as-is&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Deduplicate&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dimensional model<br>Append-only&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Type cast&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MERGE for SCD<br>Schema-on-read&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Apply DQ rules&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Business aggregations<br>Full history&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Standardize names&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Conformed dimensions</div>\n<h5>Design-First Principle</h5><p>This framework designs Gold <em>first</em> and works backwards. Why? Because the Gold layer defines what questions the business can answer. If you build Bronze/Silver first, you discover schema mismatches too late.</p>\n<div class=\"ac-diagram\"><span class=\"hl-o\">Traditional</span>: Bronze → Silver → Gold → <span class=\"hl\">discover grain mismatch</span> → rework<br><span class=\"hl-g\">Design-First</span>: <span class=\"hl\">Gold design</span> → Bronze → Silver → Gold impl → <span class=\"hl-g\">no surprises</span></div>\n<h5>Layer Comparison</h5><table><tr><th>Aspect</th><th>Bronze</th><th>Silver</th><th>Gold</th></tr><tr><td>Source</td><td>External systems, files</td><td>Bronze tables</td><td>Silver tables</td></tr><tr><td>Format</td><td>Delta (schema-on-read)</td><td>Delta (typed, cleaned)</td><td>Delta (dimensional model)</td></tr><tr><td>DQ rules</td><td>None — ingest everything</td><td>Expectations (warn/drop/fail)</td><td>Constraints (PK/FK)</td></tr><tr><td>Update pattern</td><td>Append</td><td>SCD Type 1 (overwrite)</td><td>SCD Type 2 (history)</td></tr><tr><td>Audience</td><td>Data engineers</td><td>Analysts, ML engineers</td><td>Business users, apps</td></tr><tr><td>Naming</td><td><code>bronze_[source]</code></td><td><code>silver_[entity]</code></td><td><code>dim_/fact_[name]</code></td></tr></table>\n<h5>The 9-Stage Pipeline</h5><p>The Data Product Accelerator expands this into 9 stages that go well beyond ETL:</p>\n<div class=\"ac-diagram\"><span class=\"hl-g\">Gold Design</span> → <span class=\"hl-o\">Bronze</span> → <span class=\"hl-p\">Silver</span> → <span class=\"hl-g\">Gold Impl</span> → <span class=\"hl\">Planning</span> → <span class=\"hl-p\">Semantic Layer</span> → <span class=\"hl-o\">Observability</span> → <span class=\"hl-g\">ML</span> → <span class=\"hl\">GenAI</span></div>",
    "quiz": [
      {
        "q": "Why does this framework design Gold first?",
        "opts": [
          "It is faster to build",
          "Catches schema mismatches before building Bronze/Silver",
          "Gold tables are simpler"
        ],
        "answer": 1
      },
      {
        "q": "What DQ approach does Bronze use?",
        "opts": [
          "Strict expectations",
          "No rules — ingest everything",
          "Manual review"
        ],
        "answer": 1
      },
      {
        "q": "What naming convention do Gold tables follow?",
        "opts": [
          "gold_[name]",
          "dim_/fact_[name]",
          "table_[name]"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "skills",
    "title": "Agent Skills Pattern",
    "subtitle": "How AI coding assistants navigate this repo",
    "icon": "⚡",
    "color": "var(--blue)",
    "content": "<h5>What are Agent Skills?</h5><p>Agent Skills are structured Markdown files (<code>SKILL.md</code>) that teach AI coding assistants <em>how</em> to perform complex multi-step tasks. Instead of the AI guessing, the skill provides the exact steps, code patterns, and guardrails.</p>\n<h5>Orchestrator / Worker Pattern</h5>\n<div class=\"ac-diagram\"><span class=\"hl\">AGENTS.md (entry)</span> → <span class=\"hl-p\">skill-navigator (router)</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓ routes by keyword<br><span class=\"hl-g\">Orchestrator SKILL.md</span> (decides which workers to call)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ delegates<br><span class=\"hl-o\">Worker SKILL.md</span> (focused, single-purpose task)</div>\n<p>This pattern limits context window usage. Instead of loading all 44 accelerator skills, the navigator loads only the relevant orchestrator (~4K tokens), which loads only the needed workers (~2K each).</p>\n<h5>Progressive Disclosure</h5><table><tr><th>Tier</th><th>Loaded When</th><th>Token Cost</th><th>Example</th></tr><tr><td>Tier 1: Entry</td><td>Always (auto-loaded)</td><td>~2K</td><td>AGENTS.md</td></tr><tr><td>Tier 2: Router</td><td>Keyword match</td><td>~4K</td><td>skill-navigator</td></tr><tr><td>Tier 3: Orchestrator</td><td>Router delegates</td><td>~4K</td><td>gold-layer-design</td></tr><tr><td>Tier 4: Worker</td><td>Orchestrator calls</td><td>~2K each</td><td>grain-definition</td></tr></table>\n<h5>Skill File Structure</h5><pre># SKILL.md\n## Metadata (name, version, triggers)\n## Context (what this skill does)\n## Inputs (what it needs)\n## Steps (numbered, explicit)\n## Output Contract (what it produces)\n## References (linked files for deep detail)</pre>\n<h5>Why This Matters for Workshops</h5><p>Workshop attendees don't need to learn 44 accelerator skills or 10 AppKit skills. They type one natural language prompt, the AI reads AGENTS.md, routes to the right skill, and executes. The skill ensures consistency, correctness, and best practices automatically.</p>\n<h5>How Different Clients Discover Skills</h5><p>IDE/CLI clients (Cursor, Claude Code, Copilot, Windsurf, Codex) auto-load <code>AGENTS.md</code> from the repo root. <strong>Genie Code</strong> runs inside the Databricks workspace and needs the repo in two places — <code>git clone</code> it into your user project (<code>/Workspace/Users/&lt;you&gt;/vibe-coding-workshop</code>, git-backed so generated bundles are recognized) and <strong>copy</strong> the tree into <code>/Workspace/Users/&lt;you&gt;/.assistant/skills/vibe-coding-workshop</code> for discovery, then <strong>start a NEW Agent-mode chat thread</strong> so it auto-loads every <code>SKILL.md</code>. Four root <code>skills/</code> steer behavior across clients: <code>vibecoding-state</code> (detects the client and gates each prompt) and <code>genie-code-environment</code> (the in-workspace behavior manifest).</p>\n<div class=\"ac-diagram\"><span class=\"hl\">Human prompt</span> → <span class=\"hl-p\">AI reads AGENTS.md</span> → <span class=\"hl-o\">routes to skill</span> → <span class=\"hl-g\">executes steps</span> → <span class=\"hl\">production code</span></div>",
    "quiz": [
      {
        "q": "Why use orchestrator/worker instead of one big skill?",
        "opts": [
          "It looks more organized",
          "Limits context window token usage",
          "The AI requires it"
        ],
        "answer": 1
      },
      {
        "q": "What is Tier 1 in progressive disclosure?",
        "opts": [
          "The main orchestrator",
          "AGENTS.md (auto-loaded entry point)",
          "The worker skills"
        ],
        "answer": 1
      },
      {
        "q": "What file format are Agent Skills written in?",
        "opts": [
          "JSON",
          "YAML",
          "Markdown (SKILL.md)"
        ],
        "answer": 2
      }
    ]
  },
  {
    "id": "dq-expectations",
    "title": "Data Quality with SDP Expectations",
    "subtitle": "Enforce data contracts inside your ETL pipeline",
    "icon": "✓",
    "color": "#e04545",
    "content": "<h5>What are SDP Expectations?</h5><p>Expectations are data quality rules declared directly on your SDP (formerly DLT) pipeline tables. They evaluate a SQL Boolean expression on every record and either <strong>warn</strong>, <strong>drop</strong>, or <strong>fail</strong> based on severity.</p>\n<h5>The Three Actions</h5><table><tr><th>Action</th><th>Decorator</th><th>On Violation</th><th>Pipeline</th></tr><tr><td>Warn</td><td><code>@dlt.expect_all({...})</code></td><td>Row kept, metric logged</td><td>Continues</td></tr><tr><td>Drop</td><td><code>@dlt.expect_all_or_drop({...})</code></td><td>Row removed silently</td><td>Continues</td></tr><tr><td>Fail</td><td><code>@dlt.expect_or_fail(...)</code></td><td>Pipeline stops</td><td>Halted</td></tr></table>\n<p><strong>Best practice:</strong> Use <code>expect_all_or_drop</code> for critical rules and <code>expect_all</code> for warnings. Avoid <code>expect_or_fail</code> — it stops the entire pipeline when a single bad record appears.</p>\n<h5>The Delta Rules Table Pattern</h5><p>Instead of hardcoding rules in each notebook, store them in a central <strong>Unity Catalog Delta table</strong>:</p>\n<pre>CREATE TABLE IF NOT EXISTS {catalog}.{schema}.dq_rules (\n  table_name    STRING    COMMENT 'Silver table this rule applies to',\n  rule_name     STRING    COMMENT 'Stable identifier, e.g. valid_amount',\n  constraint_sql STRING   COMMENT 'SQL boolean: amount > 0',\n  severity      STRING    COMMENT 'critical or warning',\n  description   STRING,\n  CONSTRAINT pk PRIMARY KEY (table_name, rule_name) NOT ENFORCED\n) USING DELTA CLUSTER BY AUTO;</pre>\n<div class=\"ac-diagram\"><span class=\"hl\">Delta dq_rules table</span> → <span class=\"hl-p\">dq_rules_loader.py</span> → <span class=\"hl-g\">@dlt.expect_all_or_drop(rules)</span><br>UPDATE dq_rules → next pipeline run picks up changes → zero redeploy</div>\n<h5>Runtime Loader Pattern</h5><pre>def get_critical_rules(table_name):\n    df = spark.sql(f\"\"\"\n      SELECT rule_name, constraint_sql\n      FROM {catalog}.{schema}.dq_rules\n      WHERE table_name = '{table_name}'\n        AND severity = 'critical'\n    \"\"\").toPandas()\n    return dict(zip(df.rule_name, df.constraint_sql))\n\n@dlt.table(name=\"silver_transactions\")\n@dlt.expect_all_or_drop(get_critical_rules(\"silver_transactions\"))\ndef silver_transactions():\n    return dlt.read_stream(\"bronze_transactions\")</pre>\n<h5>Quarantine Tables</h5><p>Rows that fail critical rules go to a separate quarantine table for investigation, not lost forever:</p>\n<div class=\"ac-diagram\"><span class=\"hl\">Bronze stream</span> → <span class=\"hl-p\">Silver (clean rows)</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↘ <span class=\"hl-o\">Quarantine (failed rows + reason + timestamp)</span></div>\n<h5>Pipeline Edition Requirement</h5><p><strong>ADVANCED edition is mandatory</strong> for expectations. CORE and PRO do not support <code>@dlt.expect*</code> decorators. Set <code>edition: ADVANCED</code> in your pipeline configuration.</p>\n<h5>Optional: DQX Framework</h5><p>For richer diagnostics beyond pass/fail, the <strong>Databricks Labs DQX</strong> library adds <code>_error</code>/<code>_warning</code> columns, dataset-level checks (uniqueness, FK integrity, outliers), and YAML/Delta-driven rule definitions. Use it when DLT expectations alone are not enough.</p>",
    "quiz": [
      {
        "q": "Which expectation action is recommended for critical rules?",
        "opts": [
          "expect_all (warn)",
          "expect_all_or_drop",
          "expect_or_fail"
        ],
        "answer": 1
      },
      {
        "q": "Where should DQ rules be stored?",
        "opts": [
          "Hardcoded in each notebook",
          "A central Delta table in Unity Catalog",
          "A JSON config file"
        ],
        "answer": 1
      },
      {
        "q": "What DLT pipeline edition is required for expectations?",
        "opts": [
          "CORE",
          "PRO",
          "ADVANCED"
        ],
        "answer": 2
      },
      {
        "q": "What happens to rows that fail critical rules in the recommended pattern?",
        "opts": [
          "They are deleted forever",
          "They go to a quarantine table",
          "The pipeline stops"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "lakehouse-monitoring",
    "title": "Lakehouse Monitoring",
    "subtitle": "Profile, detect drift, and alert on your data",
    "icon": "📊",
    "color": "#e07b39",
    "content": "<h5>What is Lakehouse Monitoring?</h5><p>A unified data quality monitoring service built into Unity Catalog. It creates <strong>monitors</strong> on Delta tables that automatically compute statistics, detect distribution drift, and generate dashboards — no external tools needed.</p>\n<h5>Monitor Types</h5><table><tr><th>Type</th><th>Config</th><th>Best For</th><th>Key Setting</th></tr><tr><td>Time Series</td><td><code>TimeSeriesConfig</code></td><td>Fact tables with timestamps</td><td><code>timestamp_column</code> + <code>granularity</code></td></tr><tr><td>Snapshot</td><td><code>SnapshotConfig</code></td><td>Dimension tables, reference data</td><td>Point-in-time comparison</td></tr><tr><td>Inference</td><td><code>InferenceLogConfig</code></td><td>ML model request logs</td><td><code>model_id_col</code> + <code>prediction_col</code></td></tr></table>\n<h5>Output Tables</h5><p>Each monitor produces two output tables in a dedicated monitoring schema:</p>\n<div class=\"ac-diagram\"><span class=\"hl\">Gold table</span> → <span class=\"hl-p\">Monitor refresh</span> → <span class=\"hl-g\">*_profile_metrics</span> (summary stats)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ <span class=\"hl-o\">*_drift_metrics</span> (distribution changes)</div>\n<h5>Creating a Monitor (Python SDK)</h5><pre>from databricks.sdk.service.dataquality import (\n    Monitor, DataProfilingConfig, TimeSeriesConfig,\n    AggregationGranularity, CronSchedule\n)\n\nmonitor = w.data_quality.create_monitor(monitor=Monitor(\n    object_type=\"table\",\n    object_id=table_uuid,\n    data_profiling_config=DataProfilingConfig(\n        output_schema_id=monitoring_schema_uuid,\n        time_series_config=TimeSeriesConfig(\n            timestamp_column=\"event_date\",\n            granularity=AggregationGranularity.DAY\n        ),\n        schedule=CronSchedule(\n            cron_expression=\"0 0 6 * * ?\",\n            timezone=\"America/New_York\"\n        )\n    )\n))</pre>\n<h5>Custom Business Metrics</h5><p>Beyond built-in statistics, you can define custom metrics that track business KPIs directly:</p>\n<table><tr><th>Metric Type</th><th>Purpose</th><th>Example</th></tr><tr><td>AGGREGATE</td><td>Single value per window</td><td>Total revenue, avg order value</td></tr><tr><td>DERIVED</td><td>Computed from aggregates</td><td>Revenue per user = revenue / users</td></tr><tr><td>DRIFT</td><td>Measures distribution shift</td><td>Chi-squared test on category column</td></tr></table>\n<h5>Schema-Level Anomaly Detection</h5><p>A separate capability that monitors an <strong>entire schema</strong> for freshness (was the table updated on time?) and completeness (did the expected number of rows arrive?):</p>\n<div class=\"ac-diagram\"><span class=\"hl\">Schema-level monitor</span> → ML baselines → <span class=\"hl-o\">Freshness alerts</span> + <span class=\"hl-g\">Completeness alerts</span><br>Results in: <code>system.data_quality_monitoring.table_results</code></div>\n<h5>The Full Observability Stack</h5><div class=\"ac-diagram\"><span class=\"hl\">Lakehouse Monitors</span> (table profiling + drift)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">Anomaly Detection</span> (schema freshness + completeness)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-g\">AI/BI Dashboards</span> (visual health view)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">SQL Alerts</span> (threshold-triggered notifications)</div>",
    "quiz": [
      {
        "q": "What two output tables does a Lakehouse Monitor produce?",
        "opts": [
          "input_metrics and output_metrics",
          "profile_metrics and drift_metrics",
          "source_metrics and target_metrics"
        ],
        "answer": 1
      },
      {
        "q": "Which monitor type is best for fact tables with timestamps?",
        "opts": [
          "Snapshot",
          "Inference",
          "Time Series"
        ],
        "answer": 2
      },
      {
        "q": "What does schema-level anomaly detection check for?",
        "opts": [
          "SQL syntax errors",
          "Freshness and completeness",
          "Column data types"
        ],
        "answer": 1
      },
      {
        "q": "Which SDK module is used for the current monitoring API?",
        "opts": [
          "databricks.sdk.service.catalog",
          "databricks.sdk.service.dataquality",
          "databricks.sdk.service.monitoring"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "metric-views",
    "title": "UC Metric Views",
    "subtitle": "Semantic layer — define metrics once, query everywhere",
    "icon": "📐",
    "color": "#6366f1",
    "content": "<h5>What are Metric Views?</h5><p>Metric Views are first-class Unity Catalog objects that define a <strong>semantic layer</strong> — reusable business metric definitions (measures, dimensions, joins) that any tool can query consistently. Define \"Revenue\" once, and Genie, dashboards, notebooks, and alerts all use the same formula.</p>\n<h5>How They Differ from Regular Views</h5><table><tr><th>Feature</th><th>Regular View</th><th>Metric View</th></tr><tr><td>Definition</td><td>SQL SELECT statement</td><td>YAML with measures + dimensions</td></tr><tr><td>Aggregation</td><td>Locked at creation time</td><td>Dynamic — query any dimension at runtime</td></tr><tr><td>Joins</td><td>Manual in each query</td><td>Declared once, auto-applied</td></tr><tr><td>Governance</td><td>UC permissions</td><td>UC permissions + semantic metadata</td></tr><tr><td>AI Integration</td><td>None</td><td>Genie, AI/BI natively understand measures</td></tr></table>\n<h5>YAML Definition Structure</h5><pre>CREATE OR REPLACE VIEW catalog.schema.mv_sales\nWITH METRICS\nLANGUAGE YAML\nCOMMENT 'Sales metrics across all dimensions'\nAS $$\nversion: \"1.1\"\nsource: catalog.schema.fact_sales\ndimensions:\n  - name: region\n    expr: region\n  - name: product_category\n    expr: product_category\nmeasures:\n  - name: total_revenue\n    expr: \"SUM(amount)\"\n    description: \"Total revenue in USD\"\n    format:\n      type: number_currency\n  - name: order_count\n    expr: \"COUNT(*)\"\n  - name: avg_order_value\n    expr: \"MEASURE(total_revenue) / MEASURE(order_count)\"\n    description: \"Revenue per order\"\njoins:\n  - source_column: customer_id\n    target: catalog.schema.dim_customer\n    target_column: customer_id\n    type: left\n$$;</pre>\n<h5>Querying with MEASURE()</h5><pre>-- Metric Views use MEASURE() function\nSELECT region,\n       MEASURE(total_revenue),\n       MEASURE(avg_order_value)\nFROM catalog.schema.mv_sales\nGROUP BY region;\n\n-- Cannot use SELECT * — must name dimensions + MEASURE()</pre>\n<h5>How Metric Views Power Genie</h5><div class=\"ac-diagram\"><span class=\"hl\">Metric View</span> (semantic definitions)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ primary asset<br><span class=\"hl-p\">TVFs</span> (parameterized access patterns)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ secondary asset<br><span class=\"hl-g\">Raw Tables</span> (last resort)<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ all feed into<br><span class=\"hl-o\">Genie Space</span> (NL → SQL with semantic awareness)</div>\n<h5>Key Constraints</h5><table><tr><th>Rule</th><th>Details</th></tr><tr><td>YAML version</td><td>Must be <code>\"1.1\"</code> (requires DBR 17.2+)</td></tr><tr><td>Join targets</td><td>First-level joins must reference <code>source</code> — no chained/transitive joins</td></tr><tr><td>Composability</td><td>Measures can reference other measures via <code>MEASURE(other)</code></td></tr><tr><td>Materialization</td><td>Optional experimental feature for heavy workloads</td></tr></table>",
    "quiz": [
      {
        "q": "How are Metric Views defined?",
        "opts": [
          "SQL SELECT statement",
          "YAML with measures and dimensions",
          "JSON configuration"
        ],
        "answer": 1
      },
      {
        "q": "How do you query a measure in a Metric View?",
        "opts": [
          "SELECT total_revenue",
          "SELECT MEASURE(total_revenue)",
          "SELECT SUM(amount)"
        ],
        "answer": 1
      },
      {
        "q": "What is the priority order for Genie data assets?",
        "opts": [
          "Tables → TVFs → Metric Views",
          "Metric Views → TVFs → Tables",
          "TVFs → Metric Views → Tables"
        ],
        "answer": 1
      },
      {
        "q": "Can Metric View measures reference other measures?",
        "opts": [
          "No, each must be independent",
          "Yes, via MEASURE(other_measure)",
          "Only with subqueries"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "asset-bundles",
    "title": "Databricks Asset Bundles (DABs)",
    "subtitle": "Infrastructure-as-code for Databricks resources",
    "icon": "📦",
    "color": "#059669",
    "content": "<h5>What are Asset Bundles?</h5><p>Databricks Asset Bundles (DABs) let you define jobs, pipelines, dashboards, and alerts as <strong>version-controlled YAML</strong>. Deploy across dev/staging/prod with a single <code>databricks bundle deploy</code> command.</p>\n<h5>Project Structure</h5><pre>my-project/\n├── databricks.yml          # Bundle root config\n├── resources/\n│   ├── jobs/\n│   │   ├── bronze_job.yml  # Job definitions\n│   │   ├── silver_job.yml\n│   │   └── gold_job.yml\n│   ├── pipelines/\n│   │   └── dlt_pipeline.yml\n│   └── dashboards/\n│       └── monitoring.yml\n├── src/                    # Notebooks and Python files\n│   ├── bronze/\n│   ├── silver/\n│   └── gold/\n└── .databricksbundle/      # Generated (gitignored)</pre>\n<h5>Key Concepts</h5><table><tr><th>Concept</th><th>What It Does</th></tr><tr><td>Environments V4</td><td>Serverless compute — <strong>mandatory</strong>, never use older versions</td></tr><tr><td>Targets</td><td>dev / staging / prod with variable substitution</td></tr><tr><td><code>notebook_task</code></td><td>Preferred task type — pass parameters via <code>base_parameters</code></td></tr><tr><td><code>dbutils.widgets.get()</code></td><td>Read parameters inside notebooks (not <code>argparse</code>)</td></tr></table>\n<h5>Job YAML Pattern</h5><pre>resources:\n  jobs:\n    silver_pipeline_job:\n      name: \"[&dollar;{bundle.target}] Silver Pipeline\"\n      environments:\n        - environment_key: \"default\"\n          spec:\n            environment_version: \"4\"\n      tasks:\n        - task_key: run_silver\n          environment_key: default\n          notebook_task:\n            notebook_path: ../src/silver/transform.py\n            base_parameters:\n              catalog: \"&dollar;{var.catalog}\"\n              schema: \"&dollar;{var.schema}\"</pre>\n<h5>Deployment Workflow</h5><div class=\"ac-diagram\"><span class=\"hl\">databricks bundle validate</span> → <span class=\"hl-p\">databricks bundle deploy -t dev</span> → <span class=\"hl-g\">databricks bundle run job_name -t dev</span><br>&nbsp;&nbsp;&nbsp;(checks YAML)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(syncs to workspace)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(executes the job)</div>\n<h5>Hierarchical Job Pattern</h5><p>Complex pipelines use a hierarchy: <strong>atomic jobs</strong> (single task) → <strong>composite jobs</strong> (multiple related tasks) → <strong>orchestrator job</strong> (runs composites in dependency order).</p>\n<div class=\"ac-diagram\"><span class=\"hl\">Orchestrator Job</span><br>&nbsp;&nbsp;├── <span class=\"hl-p\">Bronze Composite</span> (setup_dq → create_tables → load_data)<br>&nbsp;&nbsp;├── <span class=\"hl-p\">Silver Composite</span> (dlt_pipeline → validate)<br>&nbsp;&nbsp;└── <span class=\"hl-g\">Gold Composite</span> (merge_dims → merge_facts → verify_grain)</div>",
    "quiz": [
      {
        "q": "What environment version is mandatory for DAB jobs?",
        "opts": [
          "V2",
          "V3",
          "V4"
        ],
        "answer": 2
      },
      {
        "q": "How do notebooks read DAB parameters?",
        "opts": [
          "argparse",
          "dbutils.widgets.get()",
          "sys.argv"
        ],
        "answer": 1
      },
      {
        "q": "What command deploys a bundle to dev?",
        "opts": [
          "databricks deploy --env dev",
          "databricks bundle deploy -t dev",
          "databricks push dev"
        ],
        "answer": 1
      },
      {
        "q": "What is the preferred task type for DAB jobs?",
        "opts": [
          "python_task",
          "spark_submit_task",
          "notebook_task"
        ],
        "answer": 2
      }
    ]
  },
  {
    "id": "ml-pipelines",
    "title": "ML Pipelines on Unity Catalog",
    "subtitle": "Feature engineering, training, and batch inference",
    "icon": "🧪",
    "color": "#8b5cf6",
    "content": "<h5>End-to-End ML on the Lakehouse</h5><p>Databricks provides a complete ML lifecycle: feature tables in Unity Catalog, experiment tracking with MLflow, model registration in UC, and batch inference — all governed and versioned.</p>\n<h5>The ML Pipeline Stages</h5><div class=\"ac-diagram\"><span class=\"hl\">Gold Tables</span> → <span class=\"hl-p\">Feature Engineering</span> → <span class=\"hl-g\">Training + Experiments</span> → <span class=\"hl-o\">UC Model Registry</span> → <span class=\"hl\">Batch Inference</span></div>\n<h5>Feature Engineering</h5><p>Feature Store creates <strong>feature tables</strong> in Unity Catalog that maintain consistency between training and serving:</p>\n<pre>from databricks.feature_engineering import FeatureEngineeringClient\n\nfe = FeatureEngineeringClient()\n\n# Create feature table from Gold table\nfe.create_table(\n    name=\"catalog.schema.customer_features\",\n    primary_keys=[\"customer_id\"],\n    df=feature_df,\n    description=\"Customer behavioral features\"\n)\n\n# Training with automatic feature lookup\ntraining_set = fe.create_training_set(\n    df=label_df,\n    feature_lookups=[FeatureLookup(\n        table_name=\"catalog.schema.customer_features\",\n        lookup_key=\"customer_id\"\n    )],\n    label=\"churn\"\n)</pre>\n<h5>MLflow Experiment Tracking</h5><table><tr><th>What is Logged</th><th>How</th><th>Why</th></tr><tr><td>Parameters</td><td><code>mlflow.log_param()</code></td><td>Hyperparameter comparison</td></tr><tr><td>Metrics</td><td><code>mlflow.log_metric()</code></td><td>Model performance tracking</td></tr><tr><td>Artifacts</td><td><code>mlflow.log_artifact()</code></td><td>Feature importance plots, SHAP</td></tr><tr><td>Model</td><td><code>mlflow.sklearn.log_model()</code></td><td>Reproducible model packaging</td></tr></table>\n<h5>Unity Catalog Model Registry</h5><pre># Register model in Unity Catalog\nmlflow.set_registry_uri(\"databricks-uc\")\nmodel_uri = f\"runs:/{run.info.run_id}/model\"\nmv = mlflow.register_model(model_uri, \"catalog.schema.churn_model\")\n\n# Promote to production alias\nclient = mlflow.tracking.MlflowClient()\nclient.set_registered_model_alias(\n    \"catalog.schema.churn_model\", \"production\", mv.version\n)</pre>\n<h5>Batch Inference Pattern</h5><div class=\"ac-diagram\"><span class=\"hl\">Feature Table</span> + <span class=\"hl-p\">Registered Model (@production)</span> → <span class=\"hl-g\">fe.score_batch()</span> → <span class=\"hl-o\">Predictions Table</span></div>\n<p>The <code>score_batch</code> method ensures the same feature transformations used in training are applied during inference — no training/serving skew.</p>\n<h5>Deployment with Asset Bundles</h5><pre># Three DAB jobs form the ML pipeline:\ndatabricks bundle run ml_feature_pipeline_job -t dev   # Create features\ndatabricks bundle run ml_training_pipeline_job -t dev   # Train models\ndatabricks bundle run ml_inference_pipeline_job -t dev  # Score batch</pre>",
    "quiz": [
      {
        "q": "What prevents training/serving skew in Databricks ML?",
        "opts": [
          "Manual feature alignment",
          "Feature Store with score_batch()",
          "Copying training code to serving"
        ],
        "answer": 1
      },
      {
        "q": "Where are production models registered?",
        "opts": [
          "Local MLflow server",
          "Unity Catalog Model Registry",
          "S3 bucket"
        ],
        "answer": 1
      },
      {
        "q": "What does fe.score_batch() do?",
        "opts": [
          "Trains a new model",
          "Applies the registered model with consistent features",
          "Evaluates model metrics"
        ],
        "answer": 1
      },
      {
        "q": "How are ML pipelines deployed to production?",
        "opts": [
          "Manual notebook runs",
          "Databricks Asset Bundle jobs",
          "Cron scripts on a VM"
        ],
        "answer": 1
      }
    ]
  },
  {
    "id": "genai-agents",
    "title": "GenAI Agent Course",
    "subtitle": "Foundation, Track A, AppKit 2-Apps, and MLflow SDLC",
    "icon": "🤖",
    "color": "#ec4899",
    "content": "<h5>What is the GenAI Agent Course?</h5><p>The current course starts at <code>genai-agents/00-course-orchestrator</code>. The canonical path is <strong>Track A</strong>: build a Python Agent App on Databricks Apps, connect it to a rich AppKit frontend through <code>06d</code>, then run the MLflow SDLC.</p>\n<h5>The Canonical 2-Apps Architecture</h5><div class=\"ac-diagram\"><span class=\"hl\">User Query</span><br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-p\">AppKit Frontend</span> — dashboard, chat, history, feedback<br>&nbsp;&nbsp;&nbsp;&nbsp;↓ <code>/api/chat</code> via 06d OBO proxy<br><span class=\"hl-g\">Separate Agent App</span> — Track A Python agent with KA, Genie, UC tools<br>&nbsp;&nbsp;&nbsp;&nbsp;↓<br><span class=\"hl-o\">MLflow SDLC</span> — traces, prompts, evals, deployment, monitoring</div>\n<h5>Agent Components</h5><table><tr><th>Component</th><th>Purpose</th><th>Technology</th></tr><tr><td>LLM</td><td>Reasoning and response generation</td><td>Foundation Model API (Claude, GPT, DBRX)</td></tr><tr><td>Tools</td><td>Actions the agent can take</td><td>Python functions with type hints</td></tr><tr><td>Memory</td><td>Conversation state persistence</td><td>Lakebase PostgreSQL (CheckpointSaver)</td></tr><tr><td>Guardrails</td><td>Safety and quality boundaries</td><td>Input/output validators</td></tr></table>\n<h5>Lakebase Memory Pattern</h5><p>Conversations are stateful across sessions using Lakebase:</p>\n<pre># CheckpointSaver stores conversation state in Lakebase\n# Each turn: user message → agent reasoning → tool calls → response\n# All persisted with session_id for resumption\n\n# Schema:\n# sessions(session_id, user_id, created_at, metadata)\n# messages(message_id, session_id, role, content, timestamp)\n# tool_results(result_id, message_id, tool_name, result, latency)</pre>\n<h5>MLflow GenAI Evaluation</h5><p>Before deploying, evaluate agent quality with LLM-as-judge scorers:</p>\n<table><tr><th>Scorer</th><th>What It Measures</th></tr><tr><td>Faithfulness</td><td>Are answers grounded in retrieved context?</td></tr><tr><td>Relevance</td><td>Does the response answer the question?</td></tr><tr><td>Harmfulness</td><td>Could the response cause harm?</td></tr><tr><td>Tool Selection</td><td>Did the agent pick the right tool?</td></tr><tr><td>Custom Domain</td><td>Business-specific quality criteria</td></tr></table>\n<h5>Deployment Pipeline</h5><div class=\"ac-diagram\"><span class=\"hl\">Build Agent App</span> → <span class=\"hl-p\">Evaluate (MLflow)</span> → Quality Gate (pass?) → <span class=\"hl-g\">Deploy App</span> → <span class=\"hl-o\">Wire AppKit 06d</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class=\"hl\">Production Monitoring</span> + <span class=\"hl-p\">End-user feedback</span></div>\n<h5>Production Monitoring</h5><p>Deployed agents are continuously monitored: registered scorers evaluate a sample of production requests, while AppKit feedback can become human-labeled assessment data for future evaluations.</p>",
    "quiz": [
      {
        "q": "What is the canonical course track?",
        "opts": [
          "Track A custom Agent App",
          "Node-native single app only",
          "Legacy setup skill"
        ],
        "answer": 0
      },
      {
        "q": "Which AppKit skill connects a separate Agent App?",
        "opts": [
          "06d-appkit-agent-app-proxy",
          "05-appkit-lakebase-wiring",
          "03-appkit-deploy"
        ],
        "answer": 0
      },
      {
        "q": "Where does agent conversation memory persist?",
        "opts": [
          "Browser localStorage",
          "Lakebase PostgreSQL",
          "In-memory only"
        ],
        "answer": 1
      },
      {
        "q": "What must pass before production deployment?",
        "opts": [
          "Manual code review only",
          "MLflow evaluation quality gate",
          "Unit tests only"
        ],
        "answer": 1
      }
    ]
  }
];
