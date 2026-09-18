-- =============================================================================
-- POINT EACH CONSUMER AT THE GRAIN IT ACTUALLY MEANS
-- =============================================================================
-- Two steps legitimately commit a field called `fact_grain`:
--
--   step 58 (data_model_design) — the grain of the SOURCE model the attendee is about
--            to generate or connect. "one sale line, per store, per day"
--   step 11 (gold_layer_design) — the grain of the GOLD fact table built from it.
--            Often coarser: "one order line per day"
--
-- Both are correct, and they are genuinely different sentences. But _decision_params
-- flattens every committed field into one namespace keyed by the bare field name, so
-- `{fact_grain}` meant "whichever of the two the dict happened to yield last" — a value
-- decided by Python dict insertion order, not by anything the attendee did. Verified by
-- calling _decision_params with the same two decisions in both orders and getting
-- different answers.
--
-- The consequence was quiet and bad: step 59's generation brief tells an agent what grain
-- to generate at, and on any path where step 11 is committed first it could receive the
-- GOLD grain instead of the source grain — so the agent generates pre-aggregated data,
-- and the Silver and Gold layers built on top of it are re-graining rows that were never
-- at the grain they claim. Nothing errors. The numbers are just wrong.
--
-- The fix is in two halves:
--
--   1. _decision_params now ALSO emits every field scoped to its step, as
--      `<section_tag>__<key>`, and resolves the bare token by the LATEST commitment
--      (tie-broken on section_tag so it is deterministic even for older sessions saved
--      before committed_at existed). That is the code half, in routes.py.
--
--   2. This seed points the three prompts that care at the scoped token, so each one
--      names the grain it actually means and can never receive the other. That is the
--      half that makes the guarantee real rather than merely available.
--
-- Bare `{fact_grain}` still works everywhere and is still substituted; this is not a
-- breaking change. It is now simply never used where the distinction matters.
--
-- Idempotency: each UPDATE is guarded on the bare token still being present, so it
-- applies at most once and an admin who has already reworded the block keeps their text.
-- Necessary because execute_sql_file(..., ignore_errors=True) swallows failures.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 11 — the Gold pipeline must build at the GOLD grain
-- -----------------------------------------------------------------------------
-- This block is appended by 12_seed_step_kinds.sql and feeds the agent that writes the
-- Gold layer. It must name step 11's own commitment: the attendee decided the gold fact
-- grain on this very step, and receiving step 58's source grain here would have the agent
-- build the fact table at the wrong grain entirely.
UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      input_template,
      '**Fact grain — one row represents:** {fact_grain}',
      '**Fact grain — one row represents:** {gold_layer_design__fact_grain}'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'gold_layer_design'
  AND is_active = TRUE
  AND position('**Fact grain — one row represents:** {fact_grain}' in input_template) > 0;

-- -----------------------------------------------------------------------------
-- Step 59 — generate at the SOURCE grain, and recap the SOURCE grain
-- -----------------------------------------------------------------------------
-- The one that was actually exposed, and it references the grain TWICE: once in the
-- header that recaps what the attendee committed on step 58, and once in the brief handed
-- to databricks-synthetic-data-gen as the grain to generate rows at. Both must be the
-- source grain — never the coarser gold grain, which would have the agent produce data
-- that is already aggregated.
--
-- Both live on data_provision, not on data_model_design. I first wrote this rewrite
-- against step 58 on the assumption that the recap sat with the step that collects the
-- field; the replay proved otherwise, because the UPDATE matched nothing and
-- ignore_errors=True said nothing about it.
--
-- Rewrites every occurrence in one statement: replace() is global, and the guard is on
-- the bare token still being present anywhere in the column.
UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      input_template, '{fact_grain}', '{data_model_design__fact_grain}'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_provision'
  AND is_active = TRUE
  -- position(), not LIKE: in LIKE an underscore is a single-character wildcard, so
  -- '%{fact_grain}%' would also match '{factxgrain}' and — worse — the double-prefix
  -- guard below would match text it should not. position() compares literally.
  AND position('{fact_grain}' in input_template) > 0
  -- Never double-prefix: without this, a re-run would turn
  -- {data_model_design__fact_grain} into {data_model_design__data_model_design__...}.
  AND position('__fact_grain}' in input_template) = 0;

-- -----------------------------------------------------------------------------
-- Step 15 — the coherence gate reasons about the SOURCE grain
-- -----------------------------------------------------------------------------
-- Added by 24_seed_coherence_gate.sql. It asks whether the attendee's incident is
-- visible at their grain, and the incident lives in the source data — so this is step
-- 58's grain. On paths that include step 11, the gold grain is a downstream consequence
-- of it, not the thing the anomaly has to survive.
UPDATE ${schema}.section_input_prompts
SET expert_system_prompt = replace(
      expert_system_prompt,
      'visible at their committed grain ({fact_grain})?',
      'visible at their committed source grain ({data_model_design__fact_grain})?'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'usecase_plan'
  AND is_active = TRUE
  AND position('visible at their committed grain ({fact_grain})?' in expert_system_prompt) > 0;
