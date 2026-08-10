-- =============================================================================
-- SEED DATA: TAKE SOMETHING WITH YOU BEFORE CLEANUP
-- =============================================================================
-- Step 31 (workspace_cleanup) is the workshop's terminal step and it DESTROYS
-- everything: jobs, pipelines, dashboards, Genie spaces, serving endpoints, schemas,
-- the Lakebase project and the app. That is correct and deliberate — the workshop's
-- output is a practitioner who learned something, not a demo anyone will re-show, which
-- is exactly why it never creates a UC catalog either.
--
-- But it means the last thing that happens is a delete, and the attendee walks away
-- with nothing they can show anyone. databricks-solutions/solution-builder is built on
-- the opposite premise — "finished solutions become publishable templates... reskin one
-- industry for another" — and while its full answer (DAB packaging plus an
-- ADAPTATION_GUIDE) does not transfer here, the thin end of it does: leave with the
-- story, not the resources.
--
-- Prose, not a `verify` check, and not negotiable: whether someone took a screenshot or
-- copied a paragraph is unobservable to the app's Service Principal by construction. A
-- gate that cannot verify what it claims to verify is the anti-pattern this codebase
-- already avoids everywhere else (three-state checks, `unknown` never blocking).
--
-- workspace_cleanup has bypass_llm = TRUE, so input_template is emitted directly and
-- this text is exactly what the attendee reads — no LLM in between to paraphrase it.
--
-- Idempotency: single guarded `||` append. Re-running is a no-op; admin edits survive.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET input_template = '## Before You Delete Anything

Everything below this line is irreversible. Four things are worth two minutes first,
because none of them can be recovered afterwards:

1. **Screenshot your dashboard.** Including the view where the incident is visible. This
   is the single most useful artefact you will have next week and it stops existing in
   about ten minutes.
2. **Copy your story chain out.** The end-to-end trace you committed on the use-case plan
   step — data column, pipeline layer, dashboard widget, Genie question. That paragraph is
   what lets you explain this to a colleague or a customer without the workspace in front
   of you.
3. **Write down where your data was and how much of it there was.** Catalog, schema and
   row counts. If you generated it, note the seed or the brief you used, so you could
   regenerate it rather than redesigning it.
4. **Note the currency figure you committed to, and whether what you built could actually
   move it.** That is the honest version of what this was worth, and it is the only part
   of the exercise that transfers to a real engagement.

Then run the cleanup below.

---

' || input_template,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'workspace_cleanup'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Before You Delete Anything%';
