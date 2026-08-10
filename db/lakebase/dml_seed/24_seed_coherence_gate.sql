-- =============================================================================
-- SEED DATA: THE COHERENCE GATE
-- =============================================================================
-- Adopts the single most valuable idea in databricks-solutions/solution-builder: a
-- COHERENCE REVIEW that happens BEFORE the expensive build, checking that
--
--     data schema -> pipeline logic -> dashboard visualization -> agent queries
--
-- all actually line up. Its checklist asks whether every dashboard widget and every
-- Genie question has a supporting column, whether identifiers are consistent across
-- tables and documents, and whether the key numbers replicate everywhere. It closes
-- with: "Is this a coherent story with data supporting every downstream consumer?"
--
-- The workshop has column-level lineage as a Gold deliverable (step 11 emits
-- COLUMN_LINEAGE.csv), but lineage is generated FOR the attendee by their agent. It
-- proves the columns connect; it does not make the attendee check that their own story
-- survives the trip from fact table to Genie answer. Nothing does that today. This is
-- the cheapest thing that does.
--
-- WHY A FIELD ON STEP 15 AND NOT A NEW STEP, A verify CHECK, OR critique:
--
--   * A `verify` check was ruled out on capability grounds, not effort. A real coherence
--     check would have to read the attendee's dashboard JSON, their Genie config and
--     their gold schema and cross-reference columns. The app authenticates as its own
--     Service Principal with no OBO and can only READ; it frequently cannot see an
--     attendee's personal catalog at all, which is why _check_provisioned_tables_exist
--     and _check_uc_catalog_active both degrade to `unknown` by design. A gate that
--     returns "unknown" for most of the room actively teaches attendees that the gates
--     are theatre. There is also no Lakeview read path anywhere in verification.py.
--
--   * `critique` has no renderer. WorkflowStep.tsx branches only on `decision` (needing
--     step_config.fields) and `verify` (needing step_config.check); `critique` and
--     `prediction` are declared in the step_kind constraint but have zero instances and
--     no UI. Using one means building a component to ask a question a `decision` with a
--     good expert_system_prompt already asks.
--
--   * A new step costs an ALL_STEPS entry, a case in renderSectionSteps (omit it and the
--     card silently never renders), STEP_SCORES mirrored in lakebase.py, CHAPTERS
--     membership, a MAX_STEP_NUMBER bump and a PATH_DURATIONS segment across fourteen
--     hand-maintained rows -- for one card, in a workshop whose original complaint was
--     too many steps.
--
--   * Step 15 `usecase_plan` sits FIRST in the data-intelligence section on every level
--     that contains it (verified across all 14, including the reverse-* paths that swap
--     16 and 17 and genie-accelerator which filters the section to [15, 17, 25]). It is
--     already a decision step with a generated reveal. It is exactly the right seam:
--     after the data exists, before the dashboards, Genie space and agents get built.
--
-- Idempotency: the field append is guarded on the new key being absent; the
-- expert_system_prompt append on its heading being absent. Re-running is a no-op and an
-- admin's edits survive. This matters because execute_sql_file(..., ignore_errors=True)
-- swallows failures without a word.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 15 — trace the story end to end, before building on it
-- -----------------------------------------------------------------------------
-- min_chars 120 is the highest in the workshop, and deliberately so: the entire value
-- is in being forced to WALK the chain rather than assert that it connects. A two-line
-- answer traces nothing. If a live room stalls here, lower it to 80 — but do not remove
-- it, because that turns the step back into a box to tick.
--
-- primary_business_question is re-stated verbatim from seed 13, because jsonb_set on
-- '{fields}' replaces the whole array.
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "primary_business_question", "label": "The one question the business must answer first to know if this product works", "kind": "text", "min_chars": 30, "required": true, "placeholder": "e.g., Are we reducing time-to-decision for loan officers?"},
      {"key": "coherence_trace", "label": "Trace your story end to end, in one paragraph", "kind": "text", "min_chars": 120, "required": true,
       "placeholder": "The SLA breach lives in fact_delivery.sla_breach_flag, dated by delivery_ts; the weekly trend chart on page 1 shows it against a 30-day baseline; Genie answers \"which carrier breached SLA most last month\" from dim_carrier joined on carrier_id.",
       "hint": "Name the column that carries your incident, the widget that will show it, and the question Genie has to answer from it. If a link is missing you have just found it — now, rather than after the pipeline is built and the dashboard is empty."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "primary_business_question"}]'
  AND NOT step_config->'fields' @> '[{"key": "coherence_trace"}]';

-- Run Solution Builder's coherence checklist against the attendee's own words.
--
-- Appended to the existing expert_system_prompt (seed 13 set it) rather than replacing
-- it, so the business-question critique survives. Generated rather than static for the
-- reason recorded in 16_assess_scope_decisions.sql: a useful answer here has to name
-- THEIR columns and THEIR entities, and static text cannot.
--
-- The tokens below all resolve at reveal time: {fact_grain}, {entities} and
-- {story_anomaly} come from step 58 and {dollar_impact} from step 3, all via
-- _decision_params, which flattens every committed field into one namespace.
UPDATE ${schema}.section_input_prompts
SET expert_system_prompt = expert_system_prompt || '

Then review their COHERENCE TRACE. This is the part that matters most, because every
break they do not find here becomes an empty dashboard widget or a question Genie cannot
answer, discovered after the pipeline is built.

Their trace: "{coherence_trace}"

Walk the chain in order and be specific about where it breaks:
1. **Data.** Does a named column actually carry their incident ({story_anomaly}), and is
   it visible at their committed grain ({fact_grain})? A measure that only shows up at a
   coarser grain than they are storing is the classic silent break.
2. **Pipeline.** Does the column they named survive to the layer the dashboard reads
   from? Name where it would get aggregated away.
3. **Dashboard.** Does every widget they describe have a supporting column? Name any
   widget that has nothing behind it.
4. **Genie.** Is the question they named answerable from the entities they have
   ({entities})? If it needs a join, is the key present in both?
5. **The numbers.** Would {dollar_impact} be reproducible by aggregating their fact
   table, or is it a figure that exists only in the PRD? A number nobody can recompute
   is a number that gets challenged in the first review.
6. **Identifiers.** Are the columns the dashboard filters on the same ones Genie joins
   on? Inconsistent identifiers are invisible until two artefacts disagree.

Close with a direct verdict on the question Solution Builder asks at this gate: **is this
a coherent story with data supporting every downstream consumer?** If it is, say so
plainly and name the single weakest link anyway. If it is not, name the missing link
first and say what to fix before building.

Use their own column and entity names throughout. Do not invent criticism if the chain
holds.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND expert_system_prompt IS NOT NULL
  AND expert_system_prompt NOT LIKE '%review their COHERENCE TRACE%';

-- Carry the trace into the plan the agent writes, so the plan is built around a chain
-- the attendee has already checked rather than one the agent assumes.
UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## The Story Chain the Attendee Committed To

They have traced their own story from data to Genie answer:

{coherence_trace}

Treat this as the spine of the plan. Every artefact you plan — metric view, dashboard
widget, Genie benchmark question — must sit somewhere on this chain. If you plan
something that does not, say which link it serves or drop it. If a link in their trace
has no supporting column in the gold layer, raise it as a gap rather than planning
around it silently.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND input_template NOT LIKE '%The Story Chain the Attendee Committed To%';
