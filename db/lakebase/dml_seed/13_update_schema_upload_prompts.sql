-- Idempotent product-default migration for existing installs. New installs get
-- the same content from 02_seed_section_input_prompts.sql.

UPDATE ${catalog}.${schema}.section_input_prompts
SET input_template = '**Use my uploaded schema definition to propose DDL and row counts, wait for my approval, then create matching Faker sample data in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` and seed the Genie brief.**

Treat this CSV as the schema contract and save it to `<ARTIFACT_ROOT>/docs/context/{use_case_file_prefix}_schema.csv`:

--- CSV CONTENT START ---
{csv_content}
--- CSV CONTENT END ---

Then read `docs/design_prd.md` and `.vibecoding-state.md` first — reuse the PRD''s User Journeys and High-Level Data Entities; don''t re-ask what they already answer.

Parse every table and column from the CSV, preserving its data type, nullability, ordinal position, and comment. Infer relationships only when needed and label every inferred key or constraint as an assumption.

First show me:
1. the proposed `CREATE TABLE` DDL in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`;
2. a row count for every table;
3. inferred relationships and data-generation assumptions.

Do not create anything yet. Wait for my explicit approval.

On my approval, create the tables in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`, use Faker to generate realistic sample rows that conform to the uploaded types, nullability, and relationships, and validate the actual row counts and key relationships.

Then start `docs/genie_brief.md` from the PRD and the created schema: the function, candidate measures grounded in actual columns, and the questions my users actually ask. Collect open points into ONE numbered list and ask me in a single batch, pre-filling your best assumption for each and marking it "(assumed — correct me)".

Record the target, created tables, validation results, and gate result in `.vibecoding-state.md`.',
    section_title = 'Locate Data & Bring Context (Schema CSV)',
    section_description = 'Upload a schema definition CSV; Genie Code proposes matching DDL and row counts, waits for approval, creates Faker sample data in your Gold target, and seeds the brief',
    how_to_apply = '> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it. On Cursor/Copilot that is your repo root; on Databricks Genie Code it is your user project root `/Workspace/Users/<email>/<repo>` (a git clone of the workshop repo), not the page''s current working directory.

## How to apply

1. Drop your schema definition CSV and click **Process & Generate**. The app validates the required metadata columns and folds the schema into the prompt at `{csv_content}`.
2. Copy the generated prompt, start a new Agent chat in Genie Code, paste, and press Enter.
3. Review the proposed DDL and row counts, then approve before anything is created.

**State:** on the first step of the track Genie Code bootstraps `.vibecoding-state.md`; otherwise it appends this step''s gate.

## What this produces

Tables and Faker sample data matching your uploaded schema in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`, plus `docs/genie_brief.md` seeded from the created schema and PRD.',
    expected_output = '## Expected deliverables

- Your schema CSV saved under `<ARTIFACT_ROOT>/docs/context/`
- Approved DDL and row counts for every uploaded table
- Created and validated Faker sample data in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`
- `docs/genie_brief.md` seeded from the created schema and the PRD
- One batched, pre-assumed clarifying-question list presented for your correction
- Gate recorded to `.vibecoding-state.md`',
    updated_at = current_timestamp()
WHERE section_tag = 'semlayer_locate_upload'
  AND coding_assistant IS NULL;

UPDATE ${catalog}.${schema}.section_input_prompts
SET input_template = '**Use my uploaded schema definition to propose DDL and row counts, wait for my approval, then create matching Faker sample data in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` via `executeCode` and seed the Genie brief.**

Treat this CSV as the schema contract and save it to `<ARTIFACT_ROOT>/docs/context/{use_case_file_prefix}_schema.csv`:

--- CSV CONTENT START ---
{csv_content}
--- CSV CONTENT END ---

Then read `docs/design_prd.md` and `.vibecoding-state.md` first — reuse the PRD''s User Journeys and High-Level Data Entities; don''t re-ask what they already answer.

Parse every table and column from the CSV, preserving its data type, nullability, ordinal position, and comment. Infer relationships only when needed and label every inferred key or constraint as an assumption.

First show me the proposed `CREATE TABLE` DDL in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`, a row count for every table, and all inferred relationships and generation assumptions. Do not call `executeCode` or create anything yet. Wait for my explicit approval.

On my approval, use `executeCode` to create the tables in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`, generate realistic Faker rows that conform to the uploaded types, nullability, and relationships, and validate the actual row counts and key relationships.

Then start `docs/genie_brief.md` from the PRD and the created schema: the function, candidate measures grounded in actual columns, and the questions my users actually ask. Collect open points into ONE numbered list and ask me in a single batch, pre-filling your best assumption for each and marking it "(assumed — correct me)".

**State-lock:** on the first step of the track Genie Code bootstraps `.vibecoding-state.md`; otherwise it appends this step''s Per-Step Log entry and gate result, then re-reads to confirm the write landed.

**Gate:** `Brief seeded` — the schema CSV is saved under `docs/context/`; approved tables and Faker sample data exist in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`; actual row counts and key relationships were validated; `docs/genie_brief.md` exists with function, candidate measures, and user questions; the gate result is recorded in `.vibecoding-state.md`.

**➡️ Next step.** Profile the schema so the measure inventory is grounded in what the data can actually support.',
    updated_at = current_timestamp()
WHERE section_tag = 'semlayer_locate_upload'
  AND coding_assistant = 'genie-code';
