# T5 R1 — legacy gates-backfill RUNBOOK (gates-empty App-origin rows → `completed_gates` / `skipped_gates`)

> **Status:** runbook (author: polly sub-agent / this PR). **Execution: HUMAN-ONLY.**
> Nothing in this PR connects to Lakebase or executes SQL. Every statement below is
> run **by a human operator** against the live `vibe_coding_workshop` schema, in the
> order given, with the STOP conditions enforced. The offline tests
> (`tests/workshop/test_r1_backfill_runbook.py`) pin the map and the SQL guards;
> **they cannot prove PostgreSQL semantics** — the operator's live, read-only dry
> run (step a) is the real gate.

## 0. Context & what this fixes

The T5 read path (PR1 / `completion_keying` / `state.build_session_state`) decides a
session's origin **once**, by `completed_gates` presence:

- **gates present** → trust the gate `sectionTag`s verbatim; the numeric
  `completed_steps` / `skipped_steps` are ignored.
- **gates empty** → the numbers ARE global `ALL_STEPS` numbers; used verbatim.

Rows written by the SPA **before** the PR #64 gate dual-write landed are
*App-origin with empty gates*: they carry global numbers in `completed_steps` /
`skipped_steps` but no `completed_gates`. They still read correctly today (gates-empty
branch). This backfill **forward-migrates** them onto the gate representation — the
server-side equivalent of the SPA's `stepNumbersToGates` dual-write
(`src/constants/workflowSections.ts`) — so the whole corpus is uniformly
gate-keyed and the number columns stop being load-bearing.

The translation key is the **frozen `step_map`** (§2), the SQL mirror of
`manifest.step_number_to_tag()`. Because the read path maps gate tags back to the
SAME globals via the inverse map, a complete-set gate write is a **loss-free round
trip** for every number that is in the map — which is exactly what the dry-run `U`
guard and the verifier enforce.

### Schema facts (verified in-repo)

| Column | Type | Emptiness test |
|---|---|---|
| `sessions.completed_steps` | `TEXT` holding a JSON int array | `IS NULL` / regex / no digit |
| `sessions.skipped_steps` | `TEXT` holding a JSON int array (DEFAULT `'[]'`) | same |
| `sessions.completed_gates` | `JSONB` (DEFAULT `'[]'`) | `IS NULL OR = '[]'::jsonb` |
| `session_parameters.skipped_gates` | key inside the `JSONB` `session_parameters` object | `IS NULL OR = '[]'::jsonb` |

> **JSONB emptiness is NEVER `= ''`.** Comparing a JSONB column to the empty
> string makes Postgres cast `''` → jsonb at parse time → `ERROR: invalid input
> syntax for type json`, which `execute_query` swallows (returns `[]`). This was
> the PR3c B2 parse-time bug. Use `IS NULL OR = '[]'::jsonb` for JSONB, and the
> **`col IS NOT NULL AND`** + regex + `~ '[0-9]'` test for the TEXT number columns.
> The leading `IS NOT NULL` is **not optional**: a bare `col ~ '…'` yields SQL `NULL`
> (not `FALSE`) for a `NULL` column, so a negated or OR-combined test can silently
> drop or miscount a `NULL`-column row. Every non-empty test in this runbook mirrors
> (a.1) exactly: `col IS NOT NULL AND col ~ '^…$' AND col ~ '[0-9]'`.

Live facts from the operator (recorded at authoring time; **re-confirm in step 0**):
18 rows total; cohort **A = 0, A' = 0, B = 13** (so R1 is a **no-op on this
workspace** — the dry run ends at the no-op exit (a.8)); 0 non-int-array
`completed_steps`; 0 non-object `session_parameters`; the operator's identity has
`UPDATE` on `sessions` + `CREATE` on the schema via `databricks_superuser`. These
counts are **install-specific** — the runbook stays the procedure for other
installs and for the pre-`DROP` re-check, so re-confirm every count in step 0 / (a).

---

## 1. Cohort & guard definitions

| Cohort | Definition |
|---|---|
| **A**  | gates empty **AND** `completed_steps` non-empty |
| **A'** | gates empty **AND** `completed_steps` empty **AND** `skipped_steps` non-empty |
| **B**  | `completed_gates` present (already gate-keyed; **never touched**) |
| **C**  | gates empty **AND** both number columns empty (nothing to migrate) |

Backfill targets **A only**. **A' rows cannot be migrated by R1** (see (a.1b)): the
read path (`completion_keying.resolve_completion_globals`) decides origin once by
`completed_gates` presence and consults `skipped_gates` **only when
`completed_gates` is non-empty**. An A' row has no completed numbers, so its
`completed_gates` would stay `[]` and a written `skipped_gates` would be **inert** —
A' is deferred to **R4**. Expected post-run: **A = 0**, **B grows by exactly the
original A**; **A' is unchanged**; C and the total row-count otherwise unchanged.

| Guard | Meaning | STOP when |
|---|---|---|
| **U** | an A/A' row carries a step number **not in** `step_map` | `U > 0` |
| **M** | `completed_steps` or `skipped_steps` is non-NULL TEXT **not** matching the int-array regex | `M > 0` |
| **P** | `session_parameters` is non-NULL and `jsonb_typeof <> 'object'` | `P > 0` |
| **K-overlap** | an A/A' row **already** holds a non-empty `session_parameters.skipped_gates` | list non-empty |
| **ORIGIN** | an A/A' row looks MCP-origin (`session_parameters->>'coding_assistant'` set **OR** `workshop_level = 'genie-accelerator'`) → *possible MCP-origin without gates* | list non-empty |

The int-array regex used throughout:

```
^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$
```

---

## 2. Frozen `step_map` (the translation key)

This block is generated by `scripts/r1_emit_map_sql.py` and pinned three-ways
(`manifest.step_number_to_tag()` == emit output == this block) by
`tests/workshop/test_r1_backfill_runbook.py`. **Do not hand-edit** — regenerate it:

```bash
python scripts/r1_emit_map_sql.py
```

```sql
-- >>> R1 STEP_MAP CTE (generated by scripts/r1_emit_map_sql.py) >>>
WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
)
-- <<< R1 STEP_MAP CTE <<<
```

Every runnable SQL block below **inlines this exact CTE** (markers stripped). The
tests assert each inlined copy equals the canonical block above, so none can drift.

---

## 0. PREFLIGHT  *(read-only)*

1. **Workspace + schema.** Confirm you are connected to the intended workspace and
   that the schema is `vibe_coding_workshop`:

   ```sql
   SELECT current_database(), current_user, current_schema();
   SELECT count(*) AS total_sessions FROM vibe_coding_workshop.sessions;  -- expect ~18
   ```

2. **PR #64 gate dual-write deployed.** Confirm the SPA that writes to this schema
   is on a build **at or after** PR #64 (gate DUAL-WRITE). If older writers are
   still live, new App-origin gates-empty rows can keep appearing — wait for the
   rollout, then pick a **low-traffic window**.

3. **Privileges — STOP if either is false:**

   ```sql
   SELECT has_table_privilege(current_user, 'vibe_coding_workshop.sessions', 'UPDATE') AS can_update,
          has_schema_privilege(current_user, 'vibe_coding_workshop', 'CREATE')         AS can_create;
   ```

   **STOP** unless both are `t`.

---

## (a) READ-ONLY DRY RUN  *(the real gate — all read-only)*

Run every query in this section. **Do not proceed to (d-pre) until all STOP
conditions are clear.** Open the session read-only to be certain:

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
```

### (a.1) Cohort counts

```sql
WITH classified AS (
  SELECT
    (completed_gates IS NULL OR completed_gates = '[]'::jsonb) AS gates_empty,
    (completed_steps IS NOT NULL AND completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND completed_steps ~ '[0-9]') AS completed_nonempty,
    (skipped_steps   IS NOT NULL AND skipped_steps   ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND skipped_steps   ~ '[0-9]') AS skipped_nonempty
  FROM vibe_coding_workshop.sessions
)
SELECT
  count(*) FILTER (WHERE gates_empty AND completed_nonempty)                              AS cohort_a,
  count(*) FILTER (WHERE gates_empty AND NOT completed_nonempty AND skipped_nonempty)     AS cohort_a_prime,
  count(*) FILTER (WHERE NOT gates_empty)                                                 AS cohort_b,
  count(*) FILTER (WHERE gates_empty AND NOT completed_nonempty AND NOT skipped_nonempty) AS cohort_c
FROM classified;
```

Expected shape: one row, four integer columns. **Record `cohort_a`** — it alone is
the expected `rows_updated` in (b) and the expected backup count in (d-pre).
**Record `cohort_a_prime`** too: it is **not** backfilled (see (a.1b)); it is the
count of rows deferred to R4, and it is a **STOP** condition if `> 0`.

### (a.1b) Cohort A' — STOP (skipped-only rows R1 cannot migrate)

An **A'** row (gates empty, `completed_steps` empty, `skipped_steps` non-empty)
**cannot be migrated by R1**. The read path
(`completion_keying.resolve_completion_globals`) decides origin **once** by
`completed_gates` presence and reads `skipped_gates` **only on the gates-present
branch**; on the gates-empty branch it uses the numeric `skipped_steps` verbatim
and **ignores `skipped_gates` entirely**. An A' row has no completed numbers, so
mapping produces an empty `completed_tags` → `completed_gates` would stay `[]` →
the row stays on the gates-empty branch and any `skipped_gates` we wrote is
**inert**. So R1 deliberately leaves A' rows untouched; they are handled in **R4**
(which revisits the skipped-only representation). **STOP if `cohort_a_prime > 0`**
and record the rows below for the R4 plan — do **not** attempt to backfill them here:

```sql
WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
)
SELECT md5(s.created_by) AS user_md5, s.session_id,
       s.skipped_steps AS skipped_numbers,
       COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN s.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN s.skipped_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS skipped_tags
FROM vibe_coding_workshop.sessions s
WHERE (s.completed_gates IS NULL OR s.completed_gates = '[]'::jsonb)
  AND NOT (s.completed_steps IS NOT NULL AND s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND s.completed_steps ~ '[0-9]')  -- completed_steps EMPTY/NULL (exact negation of (a.1) completed_nonempty)
  AND (s.skipped_steps IS NOT NULL AND s.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND s.skipped_steps ~ '[0-9]')          -- skipped_steps non-empty (mirrors (a.1))
ORDER BY s.session_id;
```

Expected: **0 rows** (on this workspace). **STOP if any row returns** — hand the
`session_id` / `skipped_tags` list to the R4 plan.

### (a.2) Guard M — malformed number TEXT

```sql
SELECT session_id, md5(created_by) AS user_md5, 'completed_steps' AS col, completed_steps AS value
FROM vibe_coding_workshop.sessions
WHERE completed_steps IS NOT NULL AND completed_steps !~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
UNION ALL
SELECT session_id, md5(created_by), 'skipped_steps', skipped_steps
FROM vibe_coding_workshop.sessions
WHERE skipped_steps IS NOT NULL AND skipped_steps !~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$';
```

Expected: **0 rows**. **STOP if `M > 0`** (the regex guards in (b) would silently
skip these, and a `::jsonb` cast on them would error — investigate first).

### (a.3) Guard P — non-object `session_parameters`

```sql
SELECT session_id, md5(created_by) AS user_md5, jsonb_typeof(session_parameters) AS typ
FROM vibe_coding_workshop.sessions
WHERE session_parameters IS NOT NULL AND jsonb_typeof(session_parameters) <> 'object';
```

Expected: **0 rows**. **STOP if `P > 0`** (`jsonb_set(..., '{skipped_gates}', ...)`
assumes an object).

### (a.4) Guard U — step numbers not in the map

```sql
WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
)
SELECT s.session_id, md5(s.created_by) AS user_md5, x.n AS unmapped_number
FROM vibe_coding_workshop.sessions s
CROSS JOIN LATERAL jsonb_array_elements_text(
       (CASE WHEN s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' THEN s.completed_steps ELSE '[]' END)::jsonb
    || (CASE WHEN s.skipped_steps   ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' THEN s.skipped_steps   ELSE '[]' END)::jsonb
     ) AS e(num)
CROSS JOIN LATERAL (SELECT e.num::int AS n) x
WHERE (s.completed_gates IS NULL OR s.completed_gates = '[]'::jsonb)   -- A ∪ A' only
  AND NOT EXISTS (SELECT 1 FROM step_map sm WHERE sm.step_number = x.n);
```

Expected: **0 rows**. **STOP if `U > 0`** — an unmapped number would be *dropped*
by the backfill, making the round trip lossy for that row.

### (a.5) Guard K-overlap — A/A' rows already holding `skipped_gates`

```sql
SELECT session_id, md5(created_by) AS user_md5, session_parameters->'skipped_gates' AS skipped_gates
FROM vibe_coding_workshop.sessions s
WHERE (completed_gates IS NULL OR completed_gates = '[]'::jsonb)
  AND session_parameters->'skipped_gates' IS NOT NULL
  AND session_parameters->'skipped_gates' <> '[]'::jsonb
  AND (
        (completed_steps IS NOT NULL AND completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND completed_steps ~ '[0-9]')
     OR (skipped_steps   IS NOT NULL AND skipped_steps   ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND skipped_steps   ~ '[0-9]')
      );
```

Expected: **0 rows**. **STOP if the list is non-empty** (the operator clears these
by hand — the backfill must never overwrite an existing `skipped_gates`).

### (a.6) ORIGIN flag — possible MCP-origin without gates

```sql
SELECT session_id, md5(created_by) AS user_md5, workshop_level,
       session_parameters->>'coding_assistant' AS coding_assistant
FROM vibe_coding_workshop.sessions s
WHERE (completed_gates IS NULL OR completed_gates = '[]'::jsonb)
  AND (
        (completed_steps IS NOT NULL AND completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND completed_steps ~ '[0-9]')
     OR (skipped_steps   IS NOT NULL AND skipped_steps   ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND skipped_steps   ~ '[0-9]')
      )
  AND (
        (session_parameters->>'coding_assistant') IS NOT NULL
     OR workshop_level = 'genie-accelerator'
      );
```

Expected: **0 rows**. **STOP if the list is non-empty.** Rationale: MCP-origin rows
normally *carry gates*; an A/A' row (gates empty) that *looks* MCP-origin may hold
**dense track positions** rather than global numbers, so mapping them as globals
would be WRONG. The operator must confirm each flagged row's `completed_steps` are
true global numbers before clearing.

### (a.7) Per-row preview (number → tag)

```sql
WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
)
SELECT md5(s.created_by) AS user_md5, s.session_id, s.workshop_level,
       s.completed_steps AS completed_numbers,
       COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN s.completed_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS completed_tags,
       s.skipped_steps AS skipped_numbers,
       COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN s.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN s.skipped_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS skipped_tags
FROM vibe_coding_workshop.sessions s
WHERE
      (s.completed_gates IS NULL OR s.completed_gates = '[]'::jsonb)
  AND (s.session_parameters->'skipped_gates' IS NULL
       OR s.session_parameters->'skipped_gates' = '[]'::jsonb)
  AND (s.completed_steps IS NOT NULL AND s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND s.completed_steps ~ '[0-9]')  -- cohort A only; A' is listed in (a.1b)
ORDER BY s.session_id;
```

Eyeball the `*_numbers → *_tags` mapping for a few rows. Expected row count ==
`cohort_a` (A rows only — A' is previewed separately in (a.1b) and is **not**
backfilled). A rows that also carry `skipped_steps` still show mapped
`skipped_tags`, which the backfill writes in lockstep.

### (a.8) Decision — proceed, STOP, or no-op exit

With all STOP conditions clear, decide from the (a.1) counts:

- **`cohort_a_prime > 0`** → **STOP** (see (a.1b)); the A' rows are an R4 item, not an R1 backfill.
- **`cohort_a + cohort_a_prime = 0`** → **R1 complete — nothing to backfill.** Stop here: do **not** create a backup table, do **not** open a transaction, do **not** run (c). (This is the expected outcome on an install whose rows are already gate-keyed — e.g. the reference workspace: A = 0, A' = 0, B = 13.)
- **`cohort_a > 0`** (and `cohort_a_prime = 0`) → continue to (a.9), then (d-pre).

### (a.9) Reset the session to READ WRITE  *(only when proceeding to a write)*

The dry run above opened the session **READ ONLY**. The safer pattern is to run
the entire dry run (a) in its **own** psql session and start a **fresh** session
for the writes — then no reset is needed. If instead you ran the dry run in the
same session you are about to write from, this reset is the required **fallback**
so the backup `CREATE TABLE` and the backfill `UPDATE` are not silently blocked by
the carried-over read-only characteristic:

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE;
SHOW transaction_read_only;   -- must print "off"
```

**STOP unless `transaction_read_only` is `off`.**

---

## (d-pre) BACKUP  *(the only DDL in this runbook)*

Set the backup table name **once** (date **and** time, so re-runs can't collide),
then reuse it via the psql variable. Use plain `CREATE TABLE` (no
`IF NOT EXISTS`) so a name collision **fails loudly** instead of silently reusing
a stale backup:

```sql
\set backup_tbl vibe_coding_workshop.r1_gates_backfill_backup_YYYYMMDD_HHMM   -- e.g. ..._20260930_1420

CREATE TABLE :backup_tbl AS
SELECT s.session_id, s.completed_gates, s.session_parameters, s.completed_steps, s.skipped_steps,
       now() AS backed_up_at
FROM vibe_coding_workshop.sessions s
WHERE
      (s.completed_gates IS NULL OR s.completed_gates = '[]'::jsonb)
  AND (s.session_parameters->'skipped_gates' IS NULL
       OR s.session_parameters->'skipped_gates' = '[]'::jsonb)
  AND (s.completed_steps IS NOT NULL AND s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND s.completed_steps ~ '[0-9]');  -- cohort A only; A' excluded (see (a.1b))

SELECT count(*) AS backup_count FROM :backup_tbl;
```

**STOP if `backup_count <> cohort_a`** from (a.1). (The backup predicate matches the
backfill admission in (b): cohort A only — `completed_steps` non-empty — so A' rows
are never captured here.)

---

## (b) BACKFILL  *(single transaction, manual COMMIT)*

Run in psql with error-stop on, in an explicit transaction, with **no autocommit**
and **no `DO` block**. Review the `RETURNING` count against the dry run, then type
`COMMIT` **only** if it matches; otherwise `ROLLBACK`.

```sql
\set ON_ERROR_STOP on
BEGIN;

WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
),
admitted AS (
  SELECT s.session_id, s.completed_steps, s.skipped_steps
  FROM vibe_coding_workshop.sessions s
  WHERE
      (s.completed_gates IS NULL OR s.completed_gates = '[]'::jsonb)
  AND (s.session_parameters->'skipped_gates' IS NULL
       OR s.session_parameters->'skipped_gates' = '[]'::jsonb)
  AND (s.completed_steps IS NOT NULL AND s.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND s.completed_steps ~ '[0-9]')  -- cohort A only: completed_steps MUST be non-empty (A' excluded — see (a.1b) / R4)
),
mapped AS (
  SELECT a.session_id,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN a.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN a.completed_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS completed_tags,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN a.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN a.skipped_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS skipped_tags
  FROM admitted a
)
UPDATE vibe_coding_workshop.sessions t
SET completed_gates = m.completed_tags,
    session_parameters = jsonb_set(
      COALESCE(t.session_parameters, '{}'::jsonb),
      '{skipped_gates}',
      m.skipped_tags
    )
FROM mapped m
WHERE t.session_id = m.session_id
  AND (t.completed_gates IS NULL OR t.completed_gates = '[]'::jsonb)                   -- re-check gates-empty at write time (never touch a gated row)
  AND (t.session_parameters->'skipped_gates' IS NULL
       OR t.session_parameters->'skipped_gates' = '[]'::jsonb)                         -- never overwrite an existing skipped_gates
RETURNING t.session_id;
```

The `UPDATE` writes **both** ledgers in one statement:
`completed_gates` = the DISTINCT, step-number-ascending tag set mapped from
`completed_steps`; `session_parameters.skipped_gates` = the same mapping of
`skipped_steps`, set with `jsonb_set` (the rest of the object is untouched). The
tags are **not** track-filtered — this matches the SPA `stepNumbersToGates`
dual-write exactly, so the read path's inverse map round-trips them back to the
original globals. The `CASE … ~ regex … ELSE '[]'` wrapper means a `::jsonb` /
`::int` cast is **never** reached on non-array TEXT.

Then check the count and decide. psql reports the affected count as the
`UPDATE <n>` command tag, and the `RETURNING` clause prints one row per updated
session — count those rows (do **not** `SELECT … FROM mapped`; the CTE is out of
scope once the statement finishes). The expected `<n>` is `cohort_a` from (a.1)
(A rows only — A' is never admitted):

- count matches → `COMMIT;`
- count differs (or anything looks wrong) → `ROLLBACK;` and investigate.

### (b') Idempotence re-run

In its own guarded transaction, run the **same** `UPDATE` again — it must report
**0 rows**. The reason is the `UPDATE`'s own write-time `WHERE`, not the `admitted`
CTE: every backfilled A row now has a **non-empty `completed_gates`**, so the
`(t.completed_gates IS NULL OR = '[]'::jsonb)` re-check excludes it; and any A row
that carried `skipped_steps` now has a **non-empty `session_parameters.skipped_gates`**,
so the `(t.session_parameters->'skipped_gates' IS NULL OR = '[]'::jsonb)` re-check
excludes it too. (A' rows were never admitted, so they do not enter this at all.)

```sql
BEGIN;
-- (paste the identical WITH … UPDATE … RETURNING block from (b))
-- Expect: 0 rows returned.
ROLLBACK;
```

**STOP if the re-run returns > 0 rows.**

---

## (c) VERIFY

### (c.1) No cohort-A rows remain

Cohort A only (`completed_steps` non-empty). A' rows are **expected to remain** —
they were never backfilled (see (a.1b)) — so this count must exclude them:

```sql
SELECT count(*) AS remaining_a
FROM vibe_coding_workshop.sessions s
WHERE (completed_gates IS NULL OR completed_gates = '[]'::jsonb)
  AND (completed_steps IS NOT NULL AND completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$' AND completed_steps ~ '[0-9]');
```

Expected: **0** (every admitted A row now carries gates). Any A' row still shows
gates-empty with a non-empty `skipped_steps` — correct, and deferred to R4.

### (c.2) Round-trip verifier

```bash
python scripts/r1_verify_backfill.py --backup-table vibe_coding_workshop.r1_gates_backfill_backup_YYYYMMDD_HHMM
```

Must print `RESULT: OK — 0 mismatches` and **exit 0**. The verifier opens a
`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` session, then for every
backed-up row compares the backup's number-derived globals against the live
gate-derived globals (completed set, skipped set, score, step-1 credit) using the
app's own `completion_keying` + scoring helpers. **STOP on any mismatch or a
non-zero exit.**

---

## (d) ROLLBACK  *(surgical — never whole-column / whole-object)*

If the backfill must be reverted, restore **only** the fields the backfill wrote,
and **only** on rows that still hold exactly what the backfill wrote (so a
concurrent legitimate write since the backfill is never clobbered).

First list any **diverged** rows (do NOT overwrite them — investigate by hand):

```sql
WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
),
written AS (
  SELECT b.session_id,
         b.completed_gates AS backup_completed_gates,
         b.session_parameters AS backup_session_parameters,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN b.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN b.completed_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS written_completed_gates,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN b.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN b.skipped_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS written_skipped_gates
  FROM :backup_tbl b
)
SELECT t.session_id, md5(t.created_by) AS user_md5,
       t.completed_gates AS live_completed_gates, w.written_completed_gates
FROM written w
JOIN vibe_coding_workshop.sessions t USING (session_id)
WHERE t.completed_gates <> w.written_completed_gates
   OR (t.session_parameters->'skipped_gates') IS DISTINCT FROM w.written_skipped_gates;
```

Then the surgical restore. **If you are reusing a session that ran a READ ONLY dry
run, reset it to READ WRITE first** (same fallback as (a.9); running the rollback in
its own fresh session is the safer pattern):

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE;
SHOW transaction_read_only;   -- must print "off"
```

**STOP unless `transaction_read_only` is `off`.** Then the restore itself (same
BEGIN / check / COMMIT-or-ROLLBACK discipline):

```sql
\set ON_ERROR_STOP on
BEGIN;

WITH step_map(step_number, tag) AS (
  VALUES
    (1, 'usecase_selection'),
    (2, 'project_setup'),
    (3, 'prd_generation'),
    (4, 'cursor_copilot_ui_design'),
    (5, 'deploy_databricks_app'),
    (6, 'setup_lakebase'),
    (7, 'wire_ui_lakebase'),
    (8, 'workspace_setup_deploy'),
    (9, 'sync_from_lakebase'),
    (10, 'bronze_table_metadata'),
    (11, 'gold_layer_design'),
    (12, 'bronze_layer_creation'),
    (13, 'silver_layer_sdp'),
    (14, 'gold_layer_pipeline'),
    (15, 'usecase_plan'),
    (16, 'aibi_dashboard'),
    (17, 'genie_space'),
    (18, 'agent_framework'),
    (19, 'wire_ui_agent'),
    (20, 'iterate_enhance'),
    (21, 'redeploy_test'),
    (22, 'genie_silver_metadata'),
    (23, 'deploy_lakehouse_assets'),
    (24, 'deploy_di_assets'),
    (25, 'optimize_genie'),
    (26, 'skill_install_explore'),
    (27, 'skill_define_strategy'),
    (28, 'skill_create_skillmd'),
    (29, 'skill_apply_contracts'),
    (30, 'skill_certify_tables'),
    (31, 'workspace_cleanup'),
    (32, 'activation_table_design'),
    (33, 'activation_reverse_sync'),
    (34, 'activation_app_design'),
    (35, 'activation_build_wire'),
    (36, 'activation_wire_lakebase'),
    (37, 'activation_deploy_validate'),
    (38, 'agent_spec_design'),
    (39, 'agent_tool_selection'),
    (40, 'uc_resources_foundation'),
    (41, 'mlflow_agent_tracing_uc'),
    (42, 'knowledge_assistant_create'),
    (43, 'track_a_agent_app_clone_framework'),
    (44, 'track_a_agent_ka_genie_tools'),
    (45, 'track_a_agent_auth_memory'),
    (46, 'track_a_agent_eval_deploy'),
    (47, 'appkit_agent_app_proxy_chat'),
    (48, 'appkit_chat_feedback_mlflow'),
    (49, 'mlflow_prompt_registry'),
    (50, 'mlflow_evaluation_datasets'),
    (51, 'mlflow_scorers_and_judges'),
    (52, 'mlflow_evaluation_runs_and_iteration'),
    (53, 'mlflow_human_review_and_signoff'),
    (54, 'mlflow_logged_model_uc_registration'),
    (55, 'mlflow_gateway_and_deployment'),
    (56, 'mlflow_production_monitoring_and_debugging'),
    (57, 'semlayer_locate'),
    (58, 'semlayer_profile'),
    (59, 'semlayer_measures'),
    (60, 'semlayer_metric_view'),
    (61, 'semlayer_synonyms'),
    (62, 'gagent_describe'),
    (63, 'gagent_instructions'),
    (64, 'gagent_verified'),
    (65, 'gagent_benchmarks'),
    (66, 'gagent_optimize'),
    (67, 'ontology_domain'),
    (68, 'ontology_pages'),
    (69, 'ontology_routing'),
    (71, 'gaccel_dashboard'),
    (72, 'gaccel_activation'),
    (73, 'activation_wire_genie')
),
written AS (
  SELECT b.session_id,
         b.completed_gates AS backup_completed_gates,
         b.session_parameters AS backup_session_parameters,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN b.completed_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN b.completed_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS written_completed_gates,
         COALESCE((
             SELECT jsonb_agg(sm.tag ORDER BY sm.step_number)
             FROM (SELECT DISTINCT e.num::int AS n
                   FROM jsonb_array_elements_text(
                     (CASE WHEN b.skipped_steps ~ '^\s*\[\s*(\d+\s*(,\s*\d+\s*)*)?\]\s*$'
                           THEN b.skipped_steps ELSE '[]' END)::jsonb) AS e(num)) d
             JOIN step_map sm ON sm.step_number = d.n), '[]'::jsonb) AS written_skipped_gates
  FROM :backup_tbl b
)
UPDATE vibe_coding_workshop.sessions t
SET completed_gates = w.backup_completed_gates,                                   -- restore the backed-up value ('[]'/NULL — the backup is cohort A only)
    session_parameters = CASE
      WHEN w.backup_session_parameters ? 'skipped_gates'
        THEN jsonb_set(COALESCE(t.session_parameters, '{}'::jsonb),
                       '{skipped_gates}', w.backup_session_parameters->'skipped_gates')  -- restore ONLY the skipped_gates key
      ELSE (COALESCE(t.session_parameters, '{}'::jsonb)) - 'skipped_gates'              -- backup had no key → remove ONLY that key
    END
FROM written w
WHERE t.session_id = w.session_id
  AND t.completed_gates = w.written_completed_gates                              -- restore only where live STILL equals what we wrote
  AND (t.session_parameters->'skipped_gates') IS NOT DISTINCT FROM w.written_skipped_gates
RETURNING t.session_id;
```

`completed_gates` is restored only where the live value still equals the recomputed
written value; `session_parameters` is touched **only** at the `skipped_gates` key
via `jsonb_set` (restore) or the `-` operator (remove) — the rest of the object is
never replaced. Compare the `RETURNING` count to the diverged-rows list, then
`COMMIT` (counts reconcile) or `ROLLBACK`.

After rollback, re-run the (a.1) cohort counts and confirm they match the original
dry run. **Drop the backup table only after the soak** (operator's call):

```sql
-- after soak only:
DROP TABLE vibe_coding_workshop.r1_gates_backfill_backup_YYYYMMDD_HHMM;
```

---

## (e) OPTIONAL label backfill  *(operator decides at run time)*

Independent of the gate backfill. `sessions.industry_label` / `use_case_label` are
display labels some analytics breakdowns `GROUP BY`; MCP-origin rows may persist
only the `industry` / `use_case` **values** and leave the labels NULL. Labels come
**only** from the curated source that `_industry_label_for` / `_available_use_cases`
read (`backend/mcp_server.py` → `backend/api/routes.py` → the Lakebase
`usecase_descriptions` table, latest active row per key). **Never** use the raw id
as a label; **unresolved rows are listed, not guessed** (left NULL).

### (e.1) Dry-run counts

```sql
SELECT
  count(*) FILTER (WHERE industry IS NOT NULL AND industry <> '' AND industry_label IS NULL) AS industry_label_candidates,
  count(*) FILTER (WHERE use_case IS NOT NULL AND use_case <> '' AND use_case_label IS NULL) AS use_case_label_candidates
FROM vibe_coding_workshop.sessions;
```

### (e.2) Unresolved rows (listed, not guessed)

List **both** label kinds that have a value but no curated label, so neither is
silently guessed.

**Unresolved INDUSTRY labels** (`industry` set, no curated `industry_label`):

```sql
WITH industry_src AS (
  SELECT DISTINCT ON (industry) industry, industry_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND industry_label IS NOT NULL AND industry_label <> ''
  ORDER BY industry, version DESC
)
SELECT t.session_id, md5(t.created_by) AS user_md5, t.industry
FROM vibe_coding_workshop.sessions t
WHERE t.industry IS NOT NULL AND t.industry <> '' AND t.industry_label IS NULL
  AND NOT EXISTS (SELECT 1 FROM industry_src i WHERE i.industry = t.industry);
```

**Unresolved USE-CASE labels** (`use_case` set, no curated `use_case_label`):

```sql
WITH usecase_src AS (
  SELECT DISTINCT ON (industry, use_case) industry, use_case, use_case_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND use_case_label IS NOT NULL AND use_case_label <> ''
  ORDER BY industry, use_case, version DESC
)
SELECT t.session_id, md5(t.created_by) AS user_md5, t.industry, t.use_case
FROM vibe_coding_workshop.sessions t
WHERE t.use_case IS NOT NULL AND t.use_case <> '' AND t.use_case_label IS NULL
  AND NOT EXISTS (SELECT 1 FROM usecase_src u WHERE u.industry = t.industry AND u.use_case = t.use_case);
```

Rows in **either** list stay NULL — do not invent labels for them. Their count is
the **unresolved** count that (e.4) reports separately (an unresolved row is **not**
a failure and never a ROLLBACK signal).

### (e.3) Backup (own date+time-named table)

Step (e) is independent of the gate backfill and may be run **after the no-op exit
(a.8)**, which skipped the (a.9) reset — so if you are reusing the dry-run session it
may still be **READ ONLY**. Reset before this first write (fresh session is the safer
pattern, as in (a.9)):

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE;
SHOW transaction_read_only;   -- must print "off"
```

**STOP unless `transaction_read_only` is `off`.** Then take the backup:

```sql
\set label_backup_tbl vibe_coding_workshop.r1_labels_backfill_backup_YYYYMMDD_HHMM

CREATE TABLE :label_backup_tbl AS
SELECT session_id, industry, industry_label, use_case, use_case_label, now() AS backed_up_at
FROM vibe_coding_workshop.sessions
WHERE (industry IS NOT NULL AND industry <> '' AND industry_label IS NULL)
   OR (use_case IS NOT NULL AND use_case <> '' AND use_case_label IS NULL);

SELECT count(*) AS label_backup_count FROM :label_backup_tbl;
```

### (e.4) Join-based label UPDATE (same transaction discipline)

```sql
\set ON_ERROR_STOP on
BEGIN;

WITH industry_src AS (
  SELECT DISTINCT ON (industry) industry, industry_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND industry_label IS NOT NULL AND industry_label <> ''
  ORDER BY industry, version DESC
)
UPDATE vibe_coding_workshop.sessions t
SET industry_label = i.industry_label
FROM industry_src i
WHERE t.industry = i.industry
  AND t.industry IS NOT NULL AND t.industry <> ''
  AND t.industry_label IS NULL
RETURNING t.session_id;

WITH usecase_src AS (
  SELECT DISTINCT ON (industry, use_case) industry, use_case, use_case_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND use_case_label IS NOT NULL AND use_case_label <> ''
  ORDER BY industry, use_case, version DESC
)
UPDATE vibe_coding_workshop.sessions t
SET use_case_label = u.use_case_label
FROM usecase_src u
WHERE t.industry = u.industry AND t.use_case = u.use_case
  AND t.use_case_label IS NULL
RETURNING t.session_id;
```

Both UPDATEs set a label **only** where the curated source has a matching row
(INNER join); unresolved rows (e.2) get no join row and stay NULL. So each
`RETURNING` count equals the **resolvable** count, **not** the (e.1) candidate count:

```
resolvable = (e.1) candidates − (e.2) unresolved
```

Compare each `RETURNING` count to its **resolvable** count, and report the
**unresolved** count separately. A non-zero unresolved count is **expected** and is
**never** a ROLLBACK signal — only a `RETURNING` count that falls short of
*resolvable* (or anything else unexpected) means `ROLLBACK`; otherwise `COMMIT`.

### (e.5) Surgical label rollback

```sql
\set ON_ERROR_STOP on
BEGIN;

WITH industry_src AS (
  SELECT DISTINCT ON (industry) industry, industry_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND industry_label IS NOT NULL AND industry_label <> ''
  ORDER BY industry, version DESC
)
UPDATE vibe_coding_workshop.sessions t
SET industry_label = b.industry_label                       -- backed-up value (NULL for a candidate)
FROM :label_backup_tbl b
JOIN industry_src i ON i.industry = b.industry
WHERE t.session_id = b.session_id
  AND b.industry_label IS NULL
  AND t.industry_label = i.industry_label                   -- only where live still equals what we wrote
RETURNING t.session_id;

WITH usecase_src AS (
  SELECT DISTINCT ON (industry, use_case) industry, use_case, use_case_label
  FROM vibe_coding_workshop.usecase_descriptions
  WHERE is_active = TRUE AND use_case_label IS NOT NULL AND use_case_label <> ''
  ORDER BY industry, use_case, version DESC
)
UPDATE vibe_coding_workshop.sessions t
SET use_case_label = b.use_case_label
FROM :label_backup_tbl b
JOIN usecase_src u ON u.industry = b.industry AND u.use_case = b.use_case
WHERE t.session_id = b.session_id
  AND b.use_case_label IS NULL
  AND t.use_case_label = u.use_case_label
RETURNING t.session_id;
```

Per-column, diverged-safe (restores only where live still equals the written
label). `COMMIT` after reviewing counts. Drop `:label_backup_tbl` after the soak.

---

## Risks & rationale

- **Concurrent-write race.** The backfill runs in a single transaction, in a
  low-traffic window, and the `UPDATE` re-checks `completed_gates`-empty at write
  time — so a row that gained gates between the dry run and the write is skipped,
  never clobbered. The rollback is likewise gated on the live value still equaling
  what the backfill wrote.
- **ORIGIN flag rationale.** Gates-empty is the App-origin signal; an A/A' row that
  *looks* MCP-origin (`coding_assistant` set or `workshop_level = 'genie-accelerator'`)
  is suspicious because MCP rows normally carry gates. Its `completed_steps` could
  be **dense track positions**, which the global `step_map` would mistranslate. The
  flag forces a human decision before any such row is migrated.
- **Lossy-drop avoidance.** Guard `U` scans every gates-empty row (A **and** A') and
  flags any step number not in `step_map`, so the number→tag→number round trip is
  exact for every number before any write. R1 writes only cohort **A** (the backup is
  A-only); checking A' too means R4 inherits a map that already covers the
  skipped-only numbers. The verifier re-proves the round trip per row against the
  A-only backup.
- **Offline tests ≠ Postgres semantics.** The offline tests pin the map and the SQL
  guard *text*; they cannot execute Postgres. The operator's live read-only dry run
  (step a) and the verifier (step c.2) are the real gates.
