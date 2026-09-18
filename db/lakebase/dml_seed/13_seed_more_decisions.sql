-- =============================================================================
-- SEED MORE DECISION STEPS (PostgreSQL/Lakebase) - IDEMPOTENT
-- =============================================================================
-- Promotes the remaining 9 decision steps (orders 5-13 from plan section 5.A)
-- from 'instant_prompt' to 'decision'.
--
-- Every statement is guarded by `WHERE step_kind = 'instant_prompt'` so admin edits
-- are never clobbered on redeploy. Committed field values flow into prompts via
-- _decision_params in routes.py, making each decision consequential.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 13 (order 5) — Silver Layer Data Quality Expectations
-- Choose 3 DQ expectations and decide drop-or-quarantine per expectation.
-- Static expert answer based on medallion best practices.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Data quality expectations committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "dq_expectations", "label": "Three data quality expectations to enforce (one per line)", "kind": "list", "max_items": 3, "required": true},
        {"key": "dq_remediation", "label": "For each expectation, drop-or-quarantine?", "kind": "radio_per_row", "options": ["Drop", "Quarantine"], "required": true}
      ],
      "rubric": {"criteria": ["dq_relevance", "severity_judgement"]}
    }'::jsonb,
    expert_answer = 'Data quality expectations belong in the Silver layer where data is cleaned and standardized.

**Three expectations that almost always belong:**
1. **No nulls in key columns** — quarantine rows with null join keys; this is never worth dropping rows.
2. **Values in expected range** — drop or quarantine depends on if the out-of-range value means the row is bad (drop) or just needs cleanup (quarantine). Example: a negative quantity is almost certainly bad data.
3. **No duplicates on the grain** — quarantine if you suspect a duplicate-handling skill exists; otherwise drop.

**When to quarantine:** use quarantine for data that *might* be recoverable with human review or that represents a real but fixable problem (e.g., a shipping date after the order date by one day — probably a UTC offset issue).

**When to drop:** use drop when data is so corrupt that keeping it alongside "clean" rows would mislead an analyst or model (e.g., a negative revenue value that is not in any allowlist).

The mistake: putting too many expectations into Silver. Drop all the "maybe this is a problem" checks; Silver is for things that will definitely cause issues downstream.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Data Quality Expectations the Attendee Committed To

**The three expectations to enforce:**
{dq_expectations}

**Remediation strategy per expectation:**
{dq_remediation}

Implement exactly these expectations in the Silver layer pipeline. If a row violates
an expectation, apply the chosen action (drop or quarantine) even if it would be
unusual in production — the attendee has committed to this design.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Data Quality Expectations the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 15 (order 6) — Use-Case Plan: The One Question
-- Pick the one question the business must answer first.
-- LLM-generated, grounded in the PRD.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Primary business question committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "primary_business_question", "label": "The one question the business must answer first to know if this product works", "kind": "text", "min_chars": 30, "required": true, "placeholder": "e.g., Are we reducing time-to-decision for loan officers?"}
      ],
      "rubric": {"criteria": ["outcome_focus"]}
    }'::jsonb,
    expert_system_prompt = 'You are a product strategist reviewing a {industry_name} use case: {use_case_title}.

Given the PRD and success metric below, state:
1. The single highest-priority business question that determines whether this product actually works.
2. Why this question comes first (what other outcomes depend on this answer?).
3. One hypothetical answer that would signal complete failure.

Ground the question in the attendee''s committed success metric and the industry context. Be concrete — avoid generic questions like "Is the system fast?"

Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Business Question the Attendee Committed To

**The one question the business must answer first:**
{primary_business_question}

Ground your Genie space design (step 17) and your end-to-end proof-of-value in
answering this question first. Later analytics can address other questions, but
this one must be unambiguous from the data.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Business Question the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 17 (order 7) — Genie Space: Questions and Boundaries
-- Three questions Genie must answer, one it should refuse.
-- LLM-generated from the gold schema.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Genie space scope committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "genie_questions", "label": "Three questions Genie must be able to answer (one per line)", "kind": "list", "max_items": 3, "required": true},
        {"key": "genie_refusal", "label": "One question Genie should refuse to answer (and why)", "kind": "text", "min_chars": 25, "required": true, "placeholder": "e.g., Personal identifiers — we comply with privacy policy"}
      ],
      "rubric": {"criteria": ["question_quality", "boundary_awareness"]}
    }'::jsonb,
    expert_system_prompt = 'You are a data intelligence architect designing a Genie space for {industry_name}. Use case: {use_case_title}.

Given the gold schema and the attendee''s primary business question below, state:
1. Three natural-language questions about the data that Genie should answer. Phrase them as an analyst would ask them. Each should be answerable from the tables and columns in the schema.
2. One category of question Genie should refuse (and why — is it missing a table, a privacy boundary, or outside the scope of v1?).
3. One thing to watch out for: a column that sounds like it answers a question but does not (e.g., "total_revenue" that is actually just one region).

Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'genie_space'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Genie Space Scope the Attendee Committed To

**Questions Genie must answer:**
{genie_questions}

**A question Genie should refuse:**
{genie_refusal}

Configure the Genie space to answer exactly these three questions well. Add an explicit
refusal in the system instructions for the question category the attendee named, citing
the reason they gave. Do not add *other* refusals; let Genie try and fail gracefully on
out-of-scope questions.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'genie_space'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Genie Space Scope the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 6 (order 8) — Setup Lakebase: OLTP vs Analytical
-- Which entities are OLTP (Lakebase) vs analytical (lakehouse)?
-- Static expert answer.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'OLTP/analytical workload split committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "oltp_entities", "label": "Entities that are OLTP (source of truth, may be updated mid-workshop)", "kind": "list", "required": true},
        {"key": "analytical_entities", "label": "Entities that are analytical (pre-computed, read-only)", "kind": "list", "required": true}
      ],
      "rubric": {"criteria": ["workload_fit"]}
    }'::jsonb,
    expert_answer = '**OLTP (Lakebase)** entities are those where the attendees'' application *writes* and *reads* in the same workshop session — i.e., entities that represent live operational state.

**Analytical** entities are pre-computed or imported reference tables that the app reads but never updates.

**Practical tests:**
1. *Will the attendee''s UI form write updates to this entity during the workshop?* If yes, OLTP.
2. *Is the entity derived from a computation (counts, sums, joins)?* If yes, probably analytical (compute it once in the lakehouse, Genie can query it).
3. *Does a human outside the workshop (e.g., a DBA or back-office process) maintain this entity?* If yes, it''s more likely to be analytical unless the app is also supposed to maintain it.

**Lakebase is not a general-purpose data warehouse.** Use it only for entities the app truly maintains. Every entity in Lakebase means more schema to version and more consistency rules the app must uphold. When in doubt, leave the entity in the lakehouse and have the UI query it read-only.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## OLTP/Analytical Split the Attendee Committed To

**OLTP entities (Lakebase — app writes and reads):**
{oltp_entities}

**Analytical entities (lakehouse — read-only reference):**
{analytical_entities}

Configure Lakebase schema exactly to the OLTP list. Analytical entities belong in the
lakehouse catalog, queried by Genie and the UI read-only. Do not add other entities
to Lakebase just to "have the schema there" — keep Lakebase lean.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND input_template NOT LIKE '%OLTP/Analytical Split the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 20 (order 9) — Iterate & Enhance: The One Worth Shipping Next
-- Pick the one enhancement worth shipping next and say why.
-- Static — reveal is the attendee''s own step-3 success metric (no expert answer).
-- This is the teaching moment: they loop back to their own commitment.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Next-phase feature prioritized',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "next_enhancement", "label": "The one feature to add after v1 ships", "kind": "text", "min_chars": 20, "required": true},
        {"key": "enhancement_why", "label": "Why this over the others (how does it move the metric?)", "kind": "text", "min_chars": 25, "required": true}
      ],
      "rubric": {"criteria": ["metric_alignment"]}
    }'::jsonb,
    expert_answer = 'The reveal for this step is your own answer from Step 3.

**Your committed success metric:** {success_metric}

An enhancement is worth prioritizing if it moves that specific metric. Avoid adding
features that are "nice to have" but do not address the metric. Features that
move a different metric belong in v1.5 or v2, not immediately after v1.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'iterate_enhance'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Enhancement the Attendee Committed To

**Feature to prioritize in v1.1:** {next_enhancement}

**Why it moves the metric:** {enhancement_why}

Build this feature. If the attendee''s choice would actually move the metric they
committed to in Step 3, implement it. If it seems misaligned with that metric,
note the concern — do not silently swap for a different feature.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'iterate_enhance'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Enhancement the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 38 (order 10) — Agent Spec Design: Purpose and Refusal
-- State the agent''s single purpose and one thing it must refuse to do.
-- Static expert answer.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Agent purpose and refusal committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "agent_purpose", "label": "The agent''s single purpose (one sentence)", "kind": "text", "min_chars": 20, "required": true},
        {"key": "agent_refusal", "label": "One thing the agent must refuse to do (and why)", "kind": "text", "min_chars": 25, "required": true, "placeholder": "e.g., Modify employee records — only read access is provisioned"}
      ],
      "rubric": {"criteria": ["purpose_clarity", "scope_boundaries"]}
    }'::jsonb,
    expert_answer = 'An agent with a clear purpose is far more useful than a general-purpose assistant.

**A clear purpose** is testable. "Answer questions about {industry_name} data" is clear.
"Be a helpful assistant" is not.

**Why refuse something:** the reason matters more than the refusal itself. Refuse because:
1. *Permission is missing* — "We don''t have data on X" or "The agent only has read access to schema Y".
2. *It''s outside v1 scope* — "v1 focuses on X; feature Y ships in v1.1".
3. *It''s a compliance or safety boundary* — "Personal identifiers are not exposed per policy".

The mistake: defining an agent too broadly and then using refusals as a safety valve.
Define it narrowly from the start.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_spec_design'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Agent Purpose and Refusal the Attendee Committed To

**Agent purpose:** {agent_purpose}

**Must refuse:** {agent_refusal}

Write the agent system prompt to reflect exactly this purpose and refusal. When the
agent receives an out-of-scope request, the agent should explain the refusal using the
reason the attendee gave, not a generic "I can''t help with that."',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_spec_design'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Agent Purpose and Refusal the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 39 (order 11) — Agent Tool Selection
-- Toggle tools, one line of justification each, plus a real table allowlist.
-- Static expert answer based on workspace state (rule-based).
-- Widget reuses AgentToolInputsEditor; adds one justification per tool.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Agent tools committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "selected_tools", "label": "Selected tools: SQL MCP, Genie, Vector Search, UC Functions, External MCP (one per line, enabled only)", "kind": "list", "required": true},
        {"key": "tool_justifications", "label": "Why this tool, one line each (one per selected tool, same order)", "kind": "list", "required": true},
        {"key": "agent_sql_table_scope", "label": "SQL table allowlist (e.g., {{schema}}.gold_orders, {{schema}}.gold_customers; use {{schema}} variable)", "kind": "text", "min_chars": 10, "required": true}
      ],
      "rubric": {"criteria": ["tool_fit", "scope_discipline", "justification_quality"]}
    }'::jsonb,
    expert_answer = '**SQL MCP** — connect to your lakehouse. Use if the agent needs to query data.

**Genie** — already set up for natural-language questions over the gold schema. Use if you want Genie to handle ambiguous questions; do NOT use if the agent''s use case is SQL-specific (e.g., pulling exact rows).

**Vector Search** — use only if you have unstructured data (documents, PDFs) indexed. If you don''t have a Vector Search index deployed, leave this off.

**UC Functions** — use if you have business logic deployed as SQL functions. If none are deployed, this adds no value.

**External MCP** — use if you have a third-party system (e.g., Salesforce, Jira) the agent should query. Leave off if nothing is configured.

**The allowlist:** if SQL is enabled, list the specific tables the agent can query. If you list all tables, the agent can accidentally leak data or run expensive queries. Provide an allowlist: `{user_schema_prefix}.gold_orders`, `{user_schema_prefix}.gold_customers`. Do not use `*` or broad schema grants.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_tool_selection'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Agent Tools the Attendee Committed To

**Selected tools:**
{selected_tools}

**Justification for each:**
{tool_justifications}

**SQL table allowlist:**
{agent_sql_table_scope}

Configure the agent to use exactly these tools. For SQL access, restrict to the
tables in the allowlist; reject any query outside that scope. If a tool is not
justified by the attendee, question it before enabling — avoid adding tools
just to "have them available".',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_tool_selection'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Agent Tools the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 27 (order 12) — Skill Define Strategy: The One Repeated Task
-- State the one repeated task the skill will automate and its trigger.
-- LLM-generated; this step is already LLM, so committing before the reveal is new.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Skill automation task committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "skill_task", "label": "The one repeated task this skill automates", "kind": "text", "min_chars": 25, "required": true},
        {"key": "skill_trigger", "label": "What event or condition triggers the skill to run?", "kind": "text", "min_chars": 20, "required": true, "placeholder": "e.g., When a new booking arrives; When the Gold layer completes"}
      ],
      "rubric": {"criteria": ["task_specificity", "trigger_clarity"]}
    }'::jsonb,
    expert_system_prompt = 'You are a workflow architect designing a skill for a {industry_name} use case: {use_case_title}.

Given the workshop goals and the attendee''s committed choices so far, state:
1. The single task this skill repeats on a schedule or in response to an event.
2. The trigger condition: "When X happens" or "Every X hours" — be specific.
3. One potential failure mode (e.g., "If the task runs while the Gold layer is still updating, results could be inconsistent") and how the skill should detect it.

Avoid creating a skill that consolidates multiple unrelated tasks. Focus on
one repeated, automatable piece of work.

Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'skill_define_strategy'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Skill Automation Task the Attendee Committed To

**The task this skill repeats:** {skill_task}

**Trigger:** {skill_trigger}

Build the skill to perform exactly this task in response to this trigger. If the
attendee''s task could be done more efficiently with a pipeline or a job instead
of a skill, note that trade-off — but implement their choice. Do not split this
into multiple skills unless they explicitly commit to multiple tasks.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'skill_define_strategy'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Skill Automation Task the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 51 (order 13) — MLflow Scorers and Judges
-- Pick 3 scorers and define "good" for the top one.
-- Static expert answer.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'MLflow evaluation criteria committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "eval_scorers", "label": "Three evaluation scorers to use (one per line; e.g., exact_match, token_overlap, rouge_score)", "kind": "list", "max_items": 3, "required": true},
        {"key": "top_scorer_good_definition", "label": "For the first scorer, define what counts as ''good'' (give a threshold or rule)", "kind": "text", "min_chars": 20, "required": true}
      ],
      "rubric": {"criteria": ["criteria_validity"]}
    }'::jsonb,
    expert_answer = 'Picking scorers is a judgement call about what good performance means for your use case.

**Common scorers:**
- **exact_match** — the output is byte-identical to the ground truth. Best for deterministic tasks (e.g., SQL generation, classification).
- **rouge_score / bleu** — measure token overlap with a reference. Good for open-ended tasks (e.g., summarization, explanation).
- **token_overlap** — simpler than ROUGE; counts what % of your tokens appear in the ground truth. Easier to interpret.
- **latency / cost** — practical scorers; measure response time or token cost. Always useful as secondary signals.

**Mistake:** picking too many scorers. Three is enough. Four or more, and you''re optimizing to a moving target.

**Defining "good":** avoid vague definitions like "high quality." Use a number: "ROUGE F1 >= 0.7 counts as good." That threshold is what makes the eval actionable: if you hit it, ship; if not, iterate.

For an early-stage agent, 0.6-0.7 on your primary scorer is reasonable; tighten to 0.8+ as the agent matures.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'mlflow_scorers_and_judges'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## MLflow Evaluation Strategy the Attendee Committed To

**Scorers to use:**
{eval_scorers}

**Definition of "good" for the primary scorer:**
{top_scorer_good_definition}

Configure MLflow to log all three scorers with every eval run. Set the primary scorer
threshold to the one the attendee defined. If runs fall below that threshold, the eval
fails; if they meet or exceed it, the agent candidate is ready for deployment.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'mlflow_scorers_and_judges'
  AND is_active = TRUE
  AND input_template NOT LIKE '%MLflow Evaluation Strategy the Attendee Committed To%';
