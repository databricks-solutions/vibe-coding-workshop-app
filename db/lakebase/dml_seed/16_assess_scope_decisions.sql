-- =============================================================================
-- MAKE THE SCOPE REVEALS ACTUALLY ASSESS THE ATTENDEE'S CHOICES
-- =============================================================================
-- Bug this fixes: on the scope decisions the "How an experienced practitioner would
-- answer" panel showed the same static paragraph no matter what the attendee typed —
-- generic advice about not taking every table, which never mentioned the tables they
-- picked or the join key they chose. An attendee who selected five tables and a key
-- got no read on whether that was a defensible selection.
--
-- Static expert_answer text was the wrong tool for these steps. A static answer works
-- where the guidance is genuinely universal (navigation shape, drop-vs-quarantine
-- trade-offs). It cannot work where the whole question is "is MY selection right?",
-- because the answer depends entirely on what they chose and what the use case needs.
--
-- Switching them to expert_system_prompt routes the reveal through the model with the
-- product context, the use case description and the attendee's own answer (see
-- _build_reveal_prompt in routes.py), so the response can name their tables, flag the
-- ones with no path to the committed metric, and challenge a join key that will
-- fan out.
--
-- expert_answer is cleared, because the reveal endpoint prefers static text when both
-- are present and would otherwise keep returning the old paragraph.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 10 — source scope and join key
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET expert_answer = '',
    expert_system_prompt = 'You are a senior data engineer reviewing which source tables an attendee has scoped for a {industry_name} use case: {use_case_title}.

Open with ONE bolded sentence giving your verdict on their selection — is it right, too broad, or missing something essential?

Then, concisely:
1. For each table they chose, say whether it earns its place: does it plausibly feed the outcome this use case needs? Name the tables individually. Call out any that look like future work rather than v1 scope.
2. Name anything obviously missing for this use case that they did not include.
3. Assess their join key. Say whether it is likely to be unique in every table they listed, and where you would expect fan-out or nulls. If they gave several keys, say whether that means they actually need a composite key or separate joins per table.

Be specific and use their actual table and column names. Do not restate generic advice about scope discipline — they can already read that. If their selection is sound, say so plainly and briefly rather than inventing criticism. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'bronze_table_metadata'
  AND is_active = TRUE
  AND step_kind = 'decision';

-- -----------------------------------------------------------------------------
-- Step 20 — the next enhancement worth shipping
-- The reveal is meaningless unless it engages with the enhancement they named.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET expert_answer = '',
    expert_system_prompt = 'You are a pragmatic product lead reviewing which enhancement an attendee wants to ship next for a {industry_name} application: {use_case_title}.

Open with ONE bolded sentence saying whether this is the right next thing to build.

Then: does it move the success metric they committed to earlier, or is it polish? What is the cheapest version that would prove the idea? Name one thing they should NOT build yet, and why.

Engage with the specific enhancement and reasoning they gave. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'iterate_enhance'
  AND is_active = TRUE
  AND step_kind = 'decision';

-- -----------------------------------------------------------------------------
-- Step 39 — agent tools and the SQL allowlist
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET expert_answer = '',
    expert_system_prompt = 'You are a senior AI engineer reviewing the tools an attendee has selected for an agent in a {industry_name} context: {use_case_title}.

Open with ONE bolded sentence on whether this tool selection fits the job.

Then:
1. For each tool they enabled, say whether their justification holds. Flag any tool that duplicates another, or that adds latency and failure modes without adding capability.
2. Name any tool they omitted that this use case genuinely needs.
3. Assess their table allowlist. A broad or unrestricted scope is the common mistake — say concretely what could go wrong with the scope they set.

Use their actual wording and table names. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_tool_selection'
  AND is_active = TRUE
  AND step_kind = 'decision';

-- -----------------------------------------------------------------------------
-- Step 38 — agent purpose and refusal
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET expert_answer = '',
    expert_system_prompt = 'You are a senior AI engineer reviewing an agent''s stated purpose and its one refusal, for a {industry_name} use case: {use_case_title}.

Open with ONE bolded sentence on whether this purpose is narrow enough to build and evaluate.

Then: is the purpose a single job or several smuggled into one sentence? Is their refusal the one that actually matters, or a soft case that would never come up? Name a harder refusal this agent will need.

Quote their wording. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_spec_design'
  AND is_active = TRUE
  AND step_kind = 'decision';
