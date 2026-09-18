-- =============================================================================
-- RECONCILE STEPS THAT ARE BOTH A DECISION AND A GATE (PostgreSQL/Lakebase)
-- =============================================================================
-- Three steps carry a real judgement call AND produce a verifiable workspace
-- artifact:
--
--   setup_lakebase    — decide which entities are OLTP vs analytical; the Lakebase
--                       project either exists afterwards or it does not
--   silver_layer_sdp  — choose the DQ expectations; the pipeline either succeeded
--   genie_space       — choose what Genie must answer and refuse; the space exists
--
-- step_kind holds one value, and seed 12 (which runs first) claimed all three as
-- 'verify' — so seed 13's `AND step_kind = 'instant_prompt'` guard correctly skipped
-- them and their decisions never landed.
--
-- Resolution: the decision is the teaching moment, so these become 'decision', and
-- the verification `check` is merged into the same step_config. Nothing is lost —
-- VerifyPanel keys off step_config.check, not step_kind, so the gate still runs.
--
-- Ordering matters: this file must sort AFTER 13 so it sees the final state of both
-- earlier seeds. Each statement is guarded so re-running is a no-op.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 6 — Setup Lakebase: OLTP vs analytical
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'OLTP vs analytical split committed',
    step_config = '{
      "widget": "freeform",
      "check": "lakebase_project_exists",
      "blocking": false,
      "escape_hatch_points_pct": 60,
      "fields": [
        {"key": "oltp_entities", "label": "Entities that belong in Lakebase (row-at-a-time reads and writes from the app)", "kind": "list", "max_items": 5, "required": true},
        {"key": "analytical_entities", "label": "Entities that belong in the lakehouse (scanned and aggregated, not served per row)", "kind": "list", "max_items": 5, "required": true},
        {"key": "oltp_rationale", "label": "Why that split — what access pattern decided it?", "kind": "text", "min_chars": 30, "required": true}
      ],
      "rubric": {"criteria": ["workload_fit", "rationale_quality"]}
    }'::jsonb,
    expert_answer = 'The split follows the access pattern, not the subject matter.

**Lakebase (OLTP)** is for what the app reads or writes one row at a time in response to a user action: the booking being created, the current status of a request, a user preference. Single-digit-millisecond point lookups, frequent small writes.

**Lakehouse** is for what gets scanned and aggregated: history, trends, anything feeding a dashboard, Genie or a model. Columnar, wide scans, no per-row latency requirement.

The common mistake is putting an entity in Lakebase because it *sounds* transactional. Ask instead: does a user wait on a single row of this? If the answer is no, it belongs in the lakehouse. And if an entity is needed in both places, that is normal — it lives in Lakebase and is synced out, rather than being duplicated by hand.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND step_kind = 'verify';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Storage Split the Attendee Committed To

**Lakebase (OLTP):**
{oltp_entities}

**Lakehouse (analytical):**
{analytical_entities}

**Their reasoning:** {oltp_rationale}

Provision Lakebase for exactly the OLTP entities listed. Do not move an analytical
entity into Lakebase for convenience. If one of these placements will cause a real
problem, implement the attendee''s choice and state the concern plainly.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Storage Split the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 13 — Silver Layer: which DQ expectations, and how to enforce them
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'DQ expectations committed',
    step_config = '{
      "widget": "freeform",
      "check": "silver_pipeline_succeeded",
      "blocking": false,
      "escape_hatch_points_pct": 60,
      "fields": [
        {"key": "dq_expectations", "label": "Three data-quality expectations worth enforcing", "kind": "list", "max_items": 3, "required": true},
        {"key": "dq_enforcement", "label": "For each: drop the row, or quarantine it for review?", "kind": "radio_per_row", "options": ["Drop", "Quarantine"], "required": true},
        {"key": "dq_rationale", "label": "Which of these would you be most upset to discover was silently violated, and why?", "kind": "text", "min_chars": 30, "required": true}
      ],
      "rubric": {"criteria": ["dq_relevance", "severity_judgement"]}
    }'::jsonb,
    expert_answer = 'Pick expectations that would change a decision if violated, not ones that are merely easy to write.

**Worth enforcing:** the join key is non-null and unique where you assume uniqueness; amounts are non-negative if the domain says so; timestamps fall in a plausible range; a status column contains only values your code handles.

**Drop vs quarantine** is a question about who needs to know. Drop when a row is unambiguously junk and nobody will come looking for it. Quarantine when the row represents something real that you cannot yet interpret — a booking with a null customer is a data problem someone has to see, and dropping it makes revenue quietly disappear.

The mistake to avoid is dropping on a rule you are not certain about. A quarantine table costs almost nothing and is the difference between "we lost 3% of rows" and "we know exactly which 3% and why".',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND step_kind = 'verify';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Data-Quality Rules the Attendee Committed To

**Expectations:**
{dq_expectations}

**Enforcement per expectation:**
{dq_enforcement}

**The one they care most about:** {dq_rationale}

Declare exactly these expectations, with the stated drop-or-quarantine action for
each. Where an expectation is quarantined, route the failing rows somewhere
inspectable rather than discarding them. If an expectation cannot be expressed
against the actual Bronze schema, say which one and why instead of substituting a
different rule.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Data-Quality Rules the Attendee Committed To%';

-- -----------------------------------------------------------------------------
-- Step 17 — Genie Space: what it must answer, and what it must refuse
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Genie scope committed',
    step_config = '{
      "widget": "freeform",
      "check": "genie_space_exists",
      "blocking": false,
      "escape_hatch_points_pct": 60,
      "fields": [
        {"key": "genie_questions", "label": "Three questions Genie must answer correctly", "kind": "list", "max_items": 3, "required": true},
        {"key": "genie_refusal", "label": "One question it should refuse rather than guess at", "kind": "text", "min_chars": 25, "required": true}
      ],
      "rubric": {"criteria": ["question_quality", "boundary_awareness"]}
    }'::jsonb,
    expert_system_prompt = 'You are a senior analytics engineer reviewing the scope of a Genie space for a {industry_name} use case: {use_case_title}.

Open with ONE bolded sentence naming the single most valuable question this Genie space should answer.

Then give:
1. Three questions it must answer correctly, each phrased the way a business user would actually type it — not as SQL, and not as a schema description.
2. One question it should explicitly refuse, and why refusing beats guessing. Prefer a question that looks answerable from the schema but is not — a causal question, a question needing data that is not modelled, or one whose grain would silently double-count.

Ground every question in the gold tables described below. Do not invent columns.
Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'genie_space'
  AND is_active = TRUE
  AND step_kind = 'verify';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Genie Scope the Attendee Committed To

**Must answer correctly:**
{genie_questions}

**Must refuse rather than guess:** {genie_refusal}

Configure the space so those three questions work — add the instructions, sample
queries and column comments needed to make them reliable. For the refusal, add an
explicit instruction so Genie declines rather than producing a confident wrong
answer. If one of the three cannot be answered from the available gold tables, say
which and what is missing.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'genie_space'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Genie Scope the Attendee Committed To%';
