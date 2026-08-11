-- =============================================================================
-- MAKE THE DATA-SOURCE REVEAL ANSWER THE CHOICE THAT WAS ACTUALLY MADE
-- =============================================================================
-- Step 57's reveal was STATIC, so the same text was shown whichever option the attendee
-- picked. It opened with "Prefer existing data whenever you genuinely have it" and closed
-- with "Real data is the better teacher anyway, and the time you would spend on a local
-- environment is time not spent building."
--
-- For someone who chose to generate BECAUSE THE DATA DOES NOT EXIST YET -- a large share
-- of attendees, and a perfectly good reason -- that reads as being told off for a correct
-- decision. It also argues against their choice twice, before and after the useful
-- content, and then the panel appends "Differences are not necessarily mistakes — if you
-- can defend your choice, keep it" (DecisionPanel.tsx:332), contradicting itself two
-- paragraphs later.
--
-- Two changes:
--
--   1. The reveal becomes GENERATED rather than static, so it can actually respond to the
--      branch the attendee chose and to the question they wrote. Note the precedence in
--      reveal_step_expert_answer: `expert_answer` wins whenever it is non-empty, so it
--      must be cleared to NULL or the generated prompt is never reached. That is the
--      load-bearing half of this seed.
--
--   2. The system prompt is instructed to open by ACCEPTING the choice, and is told
--      explicitly that "the data does not exist yet" is a complete justification for
--      generating -- not a compromise to be talked out of. The pattern follows
--      16_assess_scope_decisions.sql, which established that steps needing a response to
--      the attendee's own words want a generated reveal rather than static text.
--
-- The advice worth keeping is kept, and moved into whichever branch it belongs to: the
-- richness of real data for the connect branch, the story requirement and the local Spark
-- setup for the generate branch, and the critique of their question for both.
--
-- Idempotency: guarded on the old static opening still being present, so this applies at
-- most once and a facilitator who has rewritten the reveal keeps their version.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET
    -- Load-bearing: a non-empty expert_answer short-circuits the generated reveal.
    expert_answer = NULL,
    expert_system_prompt =
'You are a pragmatic data architect responding to an attendee who has just committed a data-source decision for a {industry_name} workshop use case: {use_case_title}.

They chose: **{data_source}**
The question their data must answer: "{key_question}"

Respond to the branch they actually chose. Do NOT argue for the other one, and do not open by stating a general preference — they have already decided, and the app tells them a defensible difference is not a mistake.

Open with ONE bolded sentence confirming whether their choice fits their situation, then give three short sections:

1. **What to do next on their branch.**
   - If they chose to CONNECT existing tables: the thing to check now is whether the grain of what they have matches what they are about to commit — a per-order table when they need per-order-line is far cheaper to notice here than after the Gold layer. Mention that a handful of tables is enough, not the whole warehouse.
   - If they chose to GENERATE: treat this as the right call and say so plainly. "The data does not exist yet" is a complete justification, not a compromise. Tell them the value is in starting from a pre-built industry data model rather than inventing entities — conformant naming, sensible grain, real relationships — and that their attention belongs on the STORY (something goes wrong, it costs money, it can be traced) because that is the part generated data usually lacks. Flat, evenly-distributed rows pass every schema check and then have nothing to say when Genie is pointed at them.

2. **The one risk on their branch, and how to see it early.**
   - Connect: real data brings real skew, nulls and edge cases — good for the later data-quality decisions, but check now that the columns their question needs actually exist and are populated.
   - Generate: it needs a working local Spark setup — a Python 3.12 environment matching serverless, a pinned `databricks-connect`, and Faker shipped to the executors rather than only installed locally (`docs/synthetic_data_setup.md`). If that is not already proven on their machine, say connecting existing data is faster TODAY — but only as scheduling advice, not as a reason their choice was wrong. If they have no suitable data, the right move is to get the setup working.

3. **Their question.** Assess it directly, quoting it. Good ones name a metric and a dimension — "which X drives Y, and by how much". A question like "show me my data" cannot be answered wrongly, which means it cannot guide a model either. If answering it needs a comparison over time or across a category, their data needs that column; say so now rather than after the pipeline is built.

Be brief and concrete. Use their own words. If their choice and question are both sound, say so plainly rather than inventing criticism. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND position('Prefer existing data whenever you genuinely have it' in coalesce(expert_answer, '')) > 0;
