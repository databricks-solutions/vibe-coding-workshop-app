-- =============================================================================
-- STOP LLM STEPS RE-ABSTRACTING COMMITTED DECISIONS (PostgreSQL/Lakebase)
-- =============================================================================
-- Bug this fixes: on prd_generation the attendee's committed features arrived in the
-- generated prompt as unresolved placeholders —
--
--     1. {committed_feature_1}
--     2. {committed_feature_2}
--     3. {committed_feature_3}
--     **The single metric...:** {success_metric}
--
-- Substitution was working. The problem is that prd_generation is one of the four
-- genuinely generative steps: it does not emit its template, it asks an LLM to WRITE
-- a prompt from it. The real committed values were substituted into that LLM's input,
-- and the model — reasonably, given it is authoring a reusable prompt — turned the
-- concrete list back into numbered placeholders for someone to fill in later. Tokens
-- it invented itself, which is why the names never appear anywhere in this repo.
--
-- Fix: tell the model explicitly that the committed block holds already-resolved
-- values which must be copied through verbatim, and that emitting any {curly_token}
-- is a failure. Applied to the system_prompt so it governs the model's behaviour
-- rather than the content it is summarising.
--
-- Scoped to the steps that are BOTH decision steps and real LLM steps
-- (bypass_llm = FALSE) — the static steps substitute and emit directly, so they were
-- never affected.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET system_prompt = system_prompt || '

**COMMITTED DECISIONS — COPY THROUGH VERBATIM:**

The input may contain a section headed "... the Attendee Committed To". Everything in
it is already resolved: the attendee typed those exact words in the workshop app, and
the values were substituted before you were called.

- Reproduce those values **literally** in your output. Copy the feature text, the
  metric sentence, the table names and the grain statement exactly as given.
- Do **NOT** replace them with placeholders. Never emit `{committed_feature_1}`,
  `{success_metric}`, `{fact_grain}` or any other `{curly_token}` — a curly-brace
  token anywhere in your output is a bug, because nothing downstream will fill it in.
- Do **NOT** paraphrase, renumber, reorder or "improve" them. They are the attendee''s
  decision, not a suggestion.
- If a committed value looks unwise, still carry it through unchanged and note the
  concern separately.

If the committed section is empty or missing, say so plainly in one line instead of
inventing placeholder text.',
    updated_at = CURRENT_TIMESTAMP
WHERE step_kind = 'decision'
  AND bypass_llm = FALSE
  AND is_active = TRUE
  AND system_prompt NOT LIKE '%COMMITTED DECISIONS — COPY THROUGH VERBATIM%';
