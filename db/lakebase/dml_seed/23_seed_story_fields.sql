-- =============================================================================
-- SEED DATA: STORY, MONEY, AND A CORRECTLY-PLACED CATALYST
-- =============================================================================
-- Adopts three practices from databricks-solutions/solution-builder, which documents
-- Databricks' method for building solutions. Its rules, and what they fix here:
--
--   1. A named protagonist and a CURRENCY figure. Solution Builder: "$500K at risk,
--      not 720 records". Step 3 already asks for a success_metric but happily accepts
--      "improve efficiency", which is not a metric and cannot be checked against
--      anything later.
--
--   2. A catalyst with explicit temporal placement: "peak positioned 2-4 weeks in the
--      past... showing buildup, peak and decay -- never at chart edges". Step 58 asks
--      what goes wrong but never asks WHEN, so a generating agent anchors the spike at
--      max(date) and the attendee gets a cliff at the right-hand edge of every chart
--      instead of an incident they can investigate. This is the concrete fix for the
--      top risk recorded when the pre-work section shipped: flat, storyless data
--      breaks Chapter 4, because Genie has nothing interesting to answer.
--
--   3. The 5-second test: "key insight obvious at a glance". Appended to step 16's
--      expected_output, which is already a checklist.
--
-- Deliberately NOT adopted from Solution Builder (recorded so it does not creep in):
--   * Its [N/10] pre-submit checklist -- nine of the ten checks are DAB-codegen defects
--     and stripping an SA's own catalog/host/email from a handoff. The attendee here IS
--     the workspace owner and there is no DAB, so porting the shape without the content
--     would be ceremony.
--   * "Specs describe WHAT, not HOW" -- actively wrong for this workshop. Solution
--     Builder separates spec-writer from build-agent, so HOW in a spec is premature.
--     Here the prompt goes STRAIGHT to the build agent, which is why step 16 says
--     "6-column grid NOT 12" and "KPIs=v2, Charts=v3". That is HOW on purpose: it
--     encodes failure modes someone already paid for. Do not "clean up" those prompts.
--
-- Zero new steps. Every change is a field on an existing decision step or a guarded
-- append, because the complaint that drove this whole rework was too many steps.
--
-- Token naming: _decision_params names each token after the FIELD KEY itself, so a
-- field `protagonist` is available downstream as {protagonist}, NOT
-- {committed_protagonist}. It also flattens every step's fields into ONE namespace, so
-- keys must be globally unique -- `fact_grain` is already declared by both
-- gold_layer_design (11) and data_model_design (58), and whichever was committed last
-- silently wins. All four keys added here were checked absent from the existing 34-key
-- namespace. test_no_two_steps_declare_the_same_decision_field_key guards the rest.
--
-- Idempotency contract, which matters because execute_sql_file(..., ignore_errors=True)
-- swallows failures silently:
--   * Field additions use jsonb_set guarded by NOT step_config->'fields' @> '[{...}]',
--     so re-running is a no-op and an admin's own field edits survive.
--   * Prompt appends use || guarded by NOT LIKE on the section heading.
--   * Everything is additionally guarded on is_active = TRUE and, where it touches
--     admin-editable prose, on the step still being the kind we expect.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 3 — protagonist and the currency figure
-- -----------------------------------------------------------------------------
-- Step 3 carries the PRODUCT story rather than the data story, and it is on all 14
-- paths (define-usecase is in every level's sectionIds), so this is the one place a
-- protagonist and a number reach every attendee. It also runs before any data exists,
-- which is why the catalyst timing belongs on 58 instead of here.
--
-- Appends to the existing two fields rather than replacing them: committed_features and
-- success_metric are re-stated verbatim from seed 17, because jsonb_set on '{fields}'
-- replaces the whole array.
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "committed_features", "label": "The 3 features v1 must ship (ranked)", "kind": "list", "max_items": 3, "required": true,
       "placeholder": "Regional performance comparison|Category trend view|Promotion lift tracker",
       "hint": "One capability per line, phrased as something a user can do. Line 1 is what you would ship if you could only ship one."},
      {"key": "success_metric", "label": "The one metric that proves this worked", "kind": "text", "min_chars": 40, "required": true,
       "placeholder": "Field reps change their call plan at least once a week based on the app",
       "hint": "Something someone could measure next month — not a restatement of the feature list."},
      {"key": "protagonist", "label": "Who is this for — name, role, and what they are accountable for", "kind": "text", "min_chars": 40, "required": true,
       "placeholder": "Claire Dubois, VP of Operations, accountable for the return rate across 40 stores",
       "hint": "A role is not a protagonist. \"Claire Dubois, VP Operations, accountable for return rate\" is; \"operations users\" is not. Everything you build gets judged by whether it helps this one person."},
      {"key": "dollar_impact", "label": "The business impact, in currency", "kind": "text", "min_chars": 25, "required": true,
       "placeholder": "$1.2M of margin lost annually to returns we cannot attribute to a cause",
       "hint": "\"$500K at risk\" lands; \"720 records\" does not. If you cannot put a number on it — even a rough one you would defend — the use case is not scoped yet. Say how you got to it."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'prd_generation'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "committed_features"}]'
  AND NOT step_config->'fields' @> '[{"key": "protagonist"}]';

-- Feed the two new commitments into the PRD prompt. Separate heading from seed 12's
-- "Scope the Attendee Committed To" block so both appends are independently guarded.
UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Who This Is For, and What It Is Worth

**The protagonist:** {protagonist}

**The business impact, in currency:** {dollar_impact}

Write the PRD for this specific person. The Summary must name them and their
accountability, and the success criteria must connect to that currency figure rather
than restating the feature list. If the figure looks unsupportable, keep it and note
the assumption it rests on — do not quietly drop it or replace it with a percentage.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'prd_generation'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Who This Is For, and What It Is Worth%';

-- -----------------------------------------------------------------------------
-- Step 4 — carry the protagonist into the UI build
-- -----------------------------------------------------------------------------
-- A UI built for "users" is a UI built for nobody. The agent already receives the
-- committed primary screen and action from seed 12; this tells it who is looking at it.
UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Who Is Looking At This Screen

**The protagonist:** {protagonist}

**What is at stake for them:** {dollar_impact}

Design the primary screen for this person specifically. The number they care about
should be visible without scrolling or clicking a filter.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'cursor_copilot_ui_design'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Who Is Looking At This Screen%';

-- -----------------------------------------------------------------------------
-- Step 58 — WHEN the incident peaks
-- -----------------------------------------------------------------------------
-- A radio rather than free text, deliberately: the generation brief in step 59 needs a
-- machine-readable anchor it can turn into SPIKE_PEAK = NOW - 3 weeks. Free text here
-- would produce prose an agent has to interpret, which is exactly how spikes end up at
-- max(date).
--
-- The third option ("Building now, still rising") is offered AND argued against in the
-- reveal. Offering only the right answers would make this a quiz; letting someone pick
-- the edge-anchored option and then explaining why charts read it as a cliff is the
-- lesson. Existing fields re-stated verbatim from seed 21 because jsonb_set replaces
-- the whole array.
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "entities", "label": "The entities your model needs", "kind": "list", "max_items": 6, "required": true,
       "placeholder": "deliveries|carriers|routes|customers",
       "hint": "One per line, business nouns rather than table names. Fewer is better: every entity you add is one you have to populate and join."},
      {"key": "fact_grain", "label": "One row in your main fact table represents...", "kind": "text", "min_chars": 30, "required": true,
       "placeholder": "one delivery attempt, per parcel, per carrier",
       "hint": "Name every dimension the grain is per. This is the single most consequential sentence here — get it wrong and every measure silently double-counts."},
      {"key": "story_anomaly", "label": "The one thing that goes wrong in this data", "kind": "text", "min_chars": 30, "required": true,
       "placeholder": "One carrier degrades badly in week 6, breaching SLA on 30% of parcels in two regions",
       "hint": "An incident, spike or trend with a cost attached. Flat, uniform data has no story and nothing to investigate."},
      {"key": "anomaly_timing", "label": "When does it peak, relative to today?", "kind": "radio", "required": true,
       "options": ["Peak 2-3 weeks ago, now decaying", "Peak 4-6 weeks ago, since recovered", "Building now, still rising"],
       "hint": "This decides where the spike lands on every chart you build. An incident still rising today sits at the right-hand edge, where it reads as a cliff rather than something you can investigate — you cannot see whether it recovered, because there is no after."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_model_design'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "story_anomaly"}]'
  AND NOT step_config->'fields' @> '[{"key": "anomaly_timing"}]';

-- Teach the reveal to assess the timing choice. Appended to step 58's existing
-- expert_system_prompt (seed 21 set it) rather than replacing it, so the grain and
-- entity critique survive.
UPDATE ${schema}.section_input_prompts
SET expert_system_prompt = expert_system_prompt || '

Then add a short section on the SHAPE of their incident over time:
- They chose this timing: "{anomaly_timing}". Assess it. An incident whose peak is 2-4 weeks in the past shows buildup, peak AND recovery, so a reader can see the whole arc and ask what changed. One that is still rising today sits at the right-hand edge of every chart, where it reads as a cliff — there is no "after" to compare against, and a dashboard cannot show a recovery that has not happened. If they picked the still-rising option, say plainly what they lose and what to do about it.
- Say whether their incident would DOMINATE ordinary variation at their grain, or drown in it. Realistic noise plus a subtle event is the classic failure: it looks like real data and shows nothing. If it would drown, say whether to raise the event or lower the noise.
- Name the measure and the column the incident would be visible in. If they cannot point at one, the story is not in the data yet.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_model_design'
  AND is_active = TRUE
  AND expert_system_prompt IS NOT NULL
  AND expert_system_prompt NOT LIKE '%SHAPE of their incident over time%';

-- -----------------------------------------------------------------------------
-- Step 59 — thread the story into the generation brief
-- -----------------------------------------------------------------------------
-- The payoff. Steps 57/58 collect commitments; this is what makes the generated data
-- actually carry them. Without this block the agent gets a grain and an entity list and
-- invents the rest, which is the "AI decides everything" pattern this rework removes.
--
-- {anomaly_timing} substitutes as the LITERAL option string, so this text has to read
-- correctly for all three options including the one it argues against. Written to give
-- the agent the rule rather than the answer, then a worked example.
UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Make the Data Carry Your Story

If you are generating, the brief above gets your model right but says nothing about
*shape* — and shape is what decides whether anyone can see your incident later. Add
this to the brief, verbatim:

```
Who feels this:  {protagonist}
Cost:            {dollar_impact}
                 The incident should be worth roughly this much when you aggregate
                 the fact table. Compute it and show me the number — do not just
                 assert it.
Timing:          {anomaly_timing}
                 Turn that into explicit constants in code, relative to now, and
                 print the dates you chose. Derive them FROM the line above rather
                 than copying an example:
                   - "Peak 2-3 weeks ago, now decaying" -> SPIKE_START = NOW - 5 weeks,
                     SPIKE_PEAK = NOW - 3 weeks, and a partial decay that is still
                     visibly above baseline today.
                   - "Peak 4-6 weeks ago, since recovered" -> SPIKE_START = NOW - 8
                     weeks, SPIKE_PEAK = NOW - 5 weeks, back to baseline by NOW - 2
                     weeks.
                   - "Building now, still rising" -> SPIKE_START = NOW - 4 weeks and
                     a monotonic climb to NOW, with NO decay. Say in your plan that
                     this one has no "after" yet, so nobody can tell from the data
                     whether it recovers.
                 In every case generate the BUILDUP, not just the peak: a single
                 elevated week is a data point, an arc is a story.
                 NEVER anchor the peak at max(date) as a side effect of how you
                 generate the dates. A spike sitting exactly on the last day of data
                 reads as a cliff — the chart cuts off mid-event, and a reader cannot
                 tell an incident from a truncation.
Contrast:        the incident must dominate ordinary variation. If a reader cannot
                 point at it on a chart without squinting, either raise the event or
                 lower the baseline noise — and tell me which you did and why.
                 Realistic noise plus a subtle event is the failure mode here: it
                 looks like real data and demonstrates nothing.
```

**Why this is not decoration.** Everything you build after this reads the data you
generate here. A dashboard needs an incident that is visible at a glance; Genie needs
something worth asking about. Flat, evenly-distributed rows pass every schema check and
then have nothing to say.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_provision'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Make the Data Carry Your Story%';

-- -----------------------------------------------------------------------------
-- Step 16 — the 5-second test
-- -----------------------------------------------------------------------------
-- Lands in expected_output, not input_template: expected_output is already the
-- deliverables checklist and is what the attendee reads to decide whether they are
-- done, whereas input_template is the ~500-line build instruction handed to the agent.
-- Substitution runs over expected_output too (routes.py), so {dollar_impact} resolves.
--
-- {dollar_impact} is committed on step 3, which precedes 16 on every path containing
-- 16: every level whose sectionIds include data-intelligence also includes
-- define-usecase.
UPDATE ${schema}.section_input_prompts
SET expected_output = expected_output || '

## The 5-Second Test

Open the dashboard, look away, then look back for five seconds. Can you point at the
incident without reading a label? If not, it is not finished:

- Is the incident on **page 1**, above the fold, and not hidden behind a filter?
- Does the baseline make the anomaly *relatively* large, or is it flattened by the
  y-axis scale?
- Is the peak inside the visible window and **not at the right-hand edge**? An
  edge-anchored spike reads as a cliff — there is no "after" to compare it against.
- Does a KPI tile carry the currency figure you committed to: **{dollar_impact}**?

If someone has to squint, fix the dashboard — or go back and fix the contrast in the
data. Both are legitimate answers, but "it is technically on there" is not.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'aibi_dashboard'
  AND is_active = TRUE
  AND expected_output IS NOT NULL
  AND expected_output NOT LIKE '%The 5-Second Test%';
