-- =============================================================================
-- SEED DATA: REVEAL MODEL PARAMETERS
-- =============================================================================
-- The commit-before-reveal panel exists to tell an attendee quickly whether they are
-- thinking along the right lines. On the general-purpose endpoint
-- (databricks-claude-sonnet-4-6) it took ~12s, which is long enough that the feedback
-- stops feeling like a response to what they just did.
--
-- Measured on a live workspace, streaming, real reveal prompt, median of 3 runs:
--
--   endpoint                             first words   complete
--   databricks-gemini-3-1-flash-lite          1.3s        3.8s   <- default
--   databricks-claude-haiku-4-5                0.7s        6.6s
--   databricks-gemini-3-5-flash                8.6s        9.0s
--   databricks-claude-sonnet-4-6               1.0s       12.0s   (previous)
--
-- gemini-3-5-flash is NOT the default despite being the newer model: it is a
-- reasoning model, so it emits nothing at all for ~8.6s while it thinks (4 chunks in
-- total, versus 24 for flash-lite). Streaming cannot hide that, and its reasoning
-- tokens count against max_tokens.
--
-- Why these are parameters rather than constants: endpoint availability is region-
-- AND rollout-gated. databricks-gemini-3-6-flash and databricks-gemini-3-5-flash-lite
-- are both documented but return 404 on a eu-central-1 workspace. So any hardcoded
-- default is wrong somewhere, and a facilitator needs to be able to change the model
-- when an endpoint is missing, down, or over quota — mid-workshop, with no deploy.
-- Adopting a newer model becomes a one-field edit.
--
-- reveal_model_fallbacks is a comma-separated chain, tried in order. The backend
-- always appends the workshop's general-purpose endpoint as a last resort, so an
-- unavailable chain degrades to a slower answer rather than no answer.
--
-- Idempotency: INSERT ... WHERE NOT EXISTS, so a facilitator's chosen model survives
-- every redeploy. Runs as a POST_SEED_MIGRATION for existing installs.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

INSERT INTO ${schema}.workshop_parameters
(param_key, param_label, param_value, param_description, param_type, display_order,
 is_required, is_active, allow_session_override, inserted_at, updated_at, created_by)
SELECT
 'reveal_model',
 'Reveal Model (fast)',
 'databricks-gemini-3-1-flash-lite',
 'Serving endpoint used for the commit-before-reveal expert answer. Latency matters more than depth here: the attendee is waiting on it. Measured first-words/complete on a real reveal prompt: gemini-3-1-flash-lite 1.3s/3.8s, claude-haiku-4-5 0.7s/6.6s, claude-sonnet-4-6 1.0s/12.0s. Avoid reasoning models such as gemini-3-5-flash, which stay silent ~8.6s while thinking. Change this if the endpoint is unavailable in your region, down, or over quota.',
 'endpoint',
 30,
 FALSE,
 TRUE,
 TRUE,
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP,
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.workshop_parameters WHERE param_key = 'reveal_model'
);

INSERT INTO ${schema}.workshop_parameters
(param_key, param_label, param_value, param_description, param_type, display_order,
 is_required, is_active, allow_session_override, inserted_at, updated_at, created_by)
SELECT
 'reveal_model_fallbacks',
 'Reveal Model Fallbacks',
 'databricks-claude-haiku-4-5,databricks-claude-sonnet-4-6',
 'Comma-separated serving endpoints tried in order when the Reveal Model is unavailable (404 in this region), erroring, or returns no content. The workshop general-purpose endpoint is always appended as a final fallback, so a reveal degrades to slower rather than missing.',
 'text',
 31,
 FALSE,
 TRUE,
 TRUE,
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP,
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.workshop_parameters WHERE param_key = 'reveal_model_fallbacks'
);
