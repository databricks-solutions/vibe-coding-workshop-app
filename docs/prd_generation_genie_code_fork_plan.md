# Plan: Add a Genie Code Fork for `prd_generation`

> **Status**: Ready to execute. All design choices made. No clarifying questions outstanding.
> **Scope**: One new INSERT in `db/lakebase/dml_seed/02_seed_section_input_prompts.sql`. No code changes elsewhere.
> **Owner**: Vibe-to-Value workshop app maintainers.

---

## 1. Goal

Add a `coding_assistant='genie-code'` fork row for the **PRD Generation** step (Step 3) so workshop participants who select **Genie Code** as their coding assistant get the same PRD prompt content **plus** a "Genie Code Overrides" appendix at the end. This mirrors the pattern already shipped for input_ids 1010–1015 (V2V Lakehouse genie-code forks) and 1020+ (V2V AI/Agents forks).

End-state behavior:

- Cursor / Copilot / VS Code / AI Gateway sessions → render the default PRD prompt unchanged (input_id=1).
- Genie Code sessions → render the same PRD prompt with a `## Genie Code Overrides` block appended that translates the only environment-coupled verb in the step (saving `docs/design_prd.md`) to `write_file(...)` against the Workspace `REPO_ROOT`.

---

## 2. Why this fits the existing fork pattern cleanly

The PRD step's only environment-coupled action is **saving `docs/design_prd.md` to local FS**. Everything else (the 7-section structure, the forbidden list, the STOP-after-saving directive, the `{industry_name}` / `{use_case_title}` / `{use_case_description}` template variables) is identical for both worlds. So the override block is the smallest in the fork series — one substitution, one bootstrap pointer, three traps.

Resolver behavior (verified in `src/backend/api/routes.py` → `get_section_input_template`, ~lines 320–360):

- When a session's `coding_assistant='genie-code'`, the fork row's `input_template` / `system_prompt` / `bypass_llm` **replace** the default row's values.
- Shared fields (`section_title`, `section_description`, `order_number`, `how_to_apply`, `expected_output`, image columns) are **always** taken from the default row, regardless of fork.
- The fork row therefore only needs the three replaceable fields — it intentionally omits all shared fields.

---

## 3. Files to change

- **`db/lakebase/dml_seed/02_seed_section_input_prompts.sql`** — add one new INSERT.

That's the only file. No edits to:

- `src/backend/api/routes.py` (resolver already handles this)
- `src/constants/codingAssistantForks.ts` (`genie-code` already registered as a forkable assistant)
- Any frontend component (Step 3 already renders fork content)
- The default PRD row (input_id=1) — left untouched
- Any downstream genie-code fork (1011–1015 already substitute `@docs/design_prd.md` → `read_file(...)`)

---

## 4. Design decisions (already made)

### 4.1 `input_id = 1001`

Reserved by the comment block at lines 63–105 of the seed file specifically for this fork:

```
--   (1001, 'prd_generation', 'genie-code',
--    'Genie-Code specific instructions for prd_generation...',
```

### 4.2 `bypass_llm = false`

The PRD step is the only forkable step that genuinely benefits from LLM tailoring — the LLM customizes the generated prompt to the specific industry/use case. Setting `bypass_llm=true` would lose that.

The existing 1010–1015 forks use `bypass_llm=true` because their content is generic CLI-translation overlay over already-generic skills. PRD is different.

To keep the LLM from paraphrasing or reflowing the override block, we add a **GENIE CODE PRESERVATION RULE** sentence to the system prompt instructing the LLM to copy the `## Genie Code Overrides` section verbatim.

### 4.3 Placement in the seed file

Insert the new INSERT statement **immediately after** the existing `input_id=1015` INSERT (the `deploy_lakehouse_assets` genie-code fork, around line 12695) and **before** the V2V AI/Agents genie-code forks block. This keeps all V2V Lakehouse-related genie-code forks grouped contiguously while sitting next to the other forks.

### 4.4 SQL escaping

Inside the SQL string literal, every literal `'` is doubled to `''`. Notable instances in our content: `user''s` (twice). The triple-backtick fenced blocks inside the string are plain text from PostgreSQL's perspective — no special handling needed.

### 4.5 Template variables to preserve

`{industry_name}`, `{use_case_title}`, `{use_case_description}` are Python `.format()` placeholders the backend substitutes at render time. They appear in the default row and **must** appear identically in the fork row. Do not escape, transform, or rename them.

---

## 5. The exact change

Append the following INSERT statement after the existing `input_id=1015` row in `db/lakebase/dml_seed/02_seed_section_input_prompts.sql`. Use the same surrounding indentation as adjacent fork rows.

```sql
-- Step 3 (prd_generation) — Genie Code fork
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1001, 'prd_generation', 'genie-code',
'Generate a prompt that I can copy into my AI coding assistant (Cursor/Copilot/Genie Code) to create a simple Product Requirements Document (PRD).

The generated prompt MUST include these instructions at the very beginning:

```
## IMPORTANT - READ FIRST
Your ONLY task is to create a PRD document. Do NOT:
- Generate any code or scripts
- Create any implementation files
- Start building the application
- Define table structures, schemas, or database designs
- Create table names or data models
- Define API endpoints, routes, or API specifications
- Include implementation-specific logic or technical details
- Do anything other than creating the PRD

You MUST:
- Create ONLY the PRD document
- Save it to: docs/design_prd.md
- STOP after saving the PRD - do nothing else
```

After those instructions, the prompt should ask for a simple, focused PRD for a {industry_name} application focused on {use_case_title}.

## Use Case Context to Include
{use_case_description}

## Application Context to Include
- **Industry**: {industry_name}
- **Use Case**: {use_case_title}
- Use a neutral, professional product name and generic terminology
- Web first, but include mobile considerations if applicable

## PRD Focus Guidelines
**Keep it simple** - Focus on providing enough details to generate a clear, readable PRD without over-engineering.

**Important Constraints:**
- Do NOT include table definitions, table names, or database schema designs - these will come in later steps
- Do NOT include API definitions, endpoints, or implementation-specific logic
- Only focus on **High Value workflows**
- Document **Happy Path only** - skip edge cases and error handling details for now
- Prioritize clarity over completeness

## PRD Structure to Request
The generated prompt should ask for a PRD with these sections:

1. **Summary** - Product vision, problem statement, target personas (2-3 max), goals + non-goals
2. **Scope** - MVP scope only, clear out of scope items
3. **User Journeys** - High-value end-to-end flows (Happy Path only) for primary personas
4. **Functional Requirements** - Key requirements with simple acceptance criteria
5. **Non-Functional Requirements** - Basic performance, security, accessibility notes
6. **High-Level Data Entities** - Entity names and relationships only (NO table definitions or schemas)
7. **Release Plan** - Simple milestones from MVP to GA

The prompt MUST end with:
```
Save this PRD to: docs/design_prd.md
STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks.
```

---

## Genie Code Overrides

The prompt above is correct as-is. Replace ONLY the file save verb below — Genie Code has no local filesystem; the PRD must land under `/Workspace`.

**Once per Genie Code session:** clone `https://github.com/databricks-solutions/vibe-coding-workshop-template` into `/Workspace/Users/<your_email>/v2v-in-geniecode/vibe-coding-workshop-template` (Workspace → Repos → Add Repo), then read `@data_product_accelerator/skills/common/genie-code/genie-code-helpers.md` and run **Section 1 — Bootstrap** (3 cells). That defines `w`, `REPO_ROOT`, `read_file`, `write_file`, `write_notebook`, `run_sql`, `run_job_by_name`, `make_job_notebook`, `create_job`, `create_pipeline_idempotent`.

**Substitutions for THIS step:**

- The final instruction `Save this PRD to: docs/design_prd.md` → `prd_path = (REPO_ROOT + "/docs/design_prd.md").replace("/Workspace", "", 1); write_file(prd_path, prd_markdown)`
- Any local-FS save the assistant might emit (`open(path, "w").write(...)`, `pathlib.Path(...).write_text(...)`, `dbutils.fs.put(...)`) → use `write_file(prd_path, prd_markdown)` only.

**Traps:**
1. Ensure the `docs/` folder exists in the cloned repo before writing — `write_file` does NOT auto-create parent directories. Run `w.workspace.mkdirs(REPO_ROOT + "/docs")` once per session if needed.
2. The PRD must be **plain markdown content**, not the entire document wrapped in a single fenced code block — otherwise downstream genie-code forks (`gold_layer_design`, `bronze_layer_creation`, etc.) that already substitute `@docs/design_prd.md` → `read_file(...)` will receive the code-fence wrapper as part of the content.
3. Do NOT save the PRD as a notebook via `write_notebook(...)`. Every downstream fork uses `read_file(...)` and expects a `.md` file. If you want a notebook view in the Workspace UI, render the PRD in a separate cell using `displayHTML(prd_markdown)` AFTER the file write completes.',
'You are generating a prompt that users will copy into their AI coding assistant.

Your output should be a complete, ready-to-use prompt that when pasted into Cursor, Copilot, or a Genie Code notebook cell will:
1. Create ONLY a simple Product Requirements Document
2. Save it to docs/design_prd.md
3. NOT generate any code, scripts, table definitions, or API specifications

CRITICAL: Your generated prompt MUST start with clear instructions telling the AI to ONLY create the PRD document and save it to docs/design_prd.md, and to NOT do anything else. Focus on High Value workflows with Happy Path only.

The prompt should be focused and specific to {use_case_title}, incorporating the use case context provided.

**OUTPUT FORMAT RULES:**
- Output the prompt directly as plain markdown text - do NOT wrap the entire output in code blocks or backticks
- Use proper markdown formatting: ## for headers, - for bullet points, **text** for bold
- For code blocks within your output (like file paths or specific instructions to include verbatim), use triple backticks on their own lines
- Do NOT use single backticks for multi-line content
- The output should render properly when displayed as markdown

**GENIE CODE PRESERVATION RULE:**
You MUST preserve the entire `## Genie Code Overrides` section (including its bootstrap paragraph, the Substitutions list, and the Traps list) that appears at the end of the input_template VERBATIM in your output. Do not paraphrase, summarize, reformat, reorder, translate, merge, or move it. It is runtime metadata for the user''s Genie Code environment, not part of the PRD they are generating. Place it at the very end of your output, after the final ``Save this PRD to: docs/design_prd.md`` instruction block, separated by a horizontal rule (`---`).',
false, 1, true, current_timestamp(), current_timestamp(), current_user());
```

---

## 6. Step-by-step execution checklist

When in agent mode, do these in order:

1. **Verify `input_id=1001` is unused.** Grep `02_seed_section_input_prompts.sql` for `^(1001,` — should return zero matches. If non-zero, stop and surface the conflict to the user.
2. **Locate insertion point.** Find the closing `current_user());` of the `input_id=1015` INSERT (`deploy_lakehouse_assets` genie-code fork). Insert the new statement immediately after, on its own paragraph, with one blank line separating it from the surrounding rows.
3. **Apply the SQL change** from Section 5 of this document verbatim. Pay attention to:
   - Single-quote doubling (only `user''s` appears twice; double-check no other apostrophes were added).
   - Triple-backtick fenced blocks inside the SQL string are intentional and must remain.
   - Template variables `{industry_name}`, `{use_case_title}`, `{use_case_description}` must be unmodified.
4. **Sanity-check the file.** After saving, verify with a `Grep` that:
   - The string `(1001, 'prd_generation', 'genie-code',` appears exactly once.
   - The total count of rows for `section_tag = 'prd_generation'` (default + new fork) is 2: one without `coding_assistant` (line ~112) and one with `'genie-code'` (the new row).
5. **Linter check.** None expected — this is plain SQL. Run `ReadLints` on the file just to confirm no incidental issues.
6. **Do NOT redeploy in this session.** Deployment requires `./scripts/setup-lakebase.sh --recreate` or `./vibe2value deploy --tables`, which is a user action. Surface the deployment commands at the end of execution but do not run them.

---

## 7. Verification (user-driven, post-execution)

### 7.1 Deploy

```bash
./scripts/setup-lakebase.sh --recreate
# OR, to avoid dropping existing data:
./vibe2value deploy --tables
```

### 7.2 Confirm row exists

```sql
SELECT input_id, section_tag, coding_assistant, bypass_llm, version, is_active
FROM <catalog>.<schema>.section_input_prompts
WHERE section_tag = 'prd_generation'
ORDER BY coding_assistant NULLS FIRST;
```

Expect two rows:

- `(1, 'prd_generation', NULL or '__default__', NULL/false, 1, true)`
- `(1001, 'prd_generation', 'genie-code', false, 1, true)`

### 7.3 Default path unchanged

In a session whose `session_parameters.coding_assistant` is `cursor`, `copilot`, `vscode`, or `ai-gateway` (or unset), open Step 3 in the app. The rendered prompt must NOT contain a `## Genie Code Overrides` heading.

### 7.4 Genie Code path renders the override

Switch the session's coding assistant to **Genie Code**. Regenerate the Step 3 prompt. Confirm:

- The full default PRD content is present (the LLM tailors it to your `{industry_name}` / `{use_case_title}` / `{use_case_description}`).
- A `## Genie Code Overrides` section appears at the very end with the bootstrap paragraph, the Substitutions list, and the Traps list intact and verbatim.
- The use-case-specific context is correctly substituted in the upper section.

### 7.5 End-to-end smoke test (optional)

In a Databricks notebook:

1. Run the bootstrap from `genie-code-helpers.md` Section 1.
2. Paste the rendered prompt into a notebook cell.
3. Run the cell.
4. Confirm `docs/design_prd.md` appears at `REPO_ROOT/docs/design_prd.md` as a markdown file (not a notebook).
5. Run any downstream genie-code fork that reads `@docs/design_prd.md` (e.g., `gold_layer_design`) and confirm it loads cleanly via `read_file(...)`.

---

## 8. Out of scope (intentionally NOT in this change)

- Adding a `coda` fork for `prd_generation` (no `coda` forks exist for any step today).
- Editing the default `input_id=1` row's `input_template`, `system_prompt`, or any other field.
- Editing any downstream fork (1011–1015 etc.) — they already handle `@docs/design_prd.md` reads.
- Editing any frontend code, `routes.py`, or `codingAssistantForks.ts`.
- Generating a sample/golden PRD document under `docs/`.
- Pulling in the polish items from the `jai-gc-update` template branch (consistent product naming directive, allowing concrete Happy-Path UX as FRs, stronger non-goals list). Tracked as future work.
- Adding a Genie Code fork or refresh for downstream AppKit steps (Step 4 Figma UI, Step 5 Scaffold/Build, Step 6 Deploy). The new template's `apps_lakebase/prompts/one-ui-design-local.md` collapses scaffold + UI + mock deploy into one prompt and would be a separate, larger change.

---

## 9. Rollback

If verification fails, the rollback is a single SQL DELETE:

```sql
DELETE FROM <catalog>.<schema>.section_input_prompts
WHERE input_id = 1001
  AND section_tag = 'prd_generation'
  AND coding_assistant = 'genie-code';
```

Followed by removing the new INSERT block from `02_seed_section_input_prompts.sql` (or reverting the file via Git). Default Cursor/Copilot users are unaffected throughout — the default row was never modified.

---

## 10. Pitfalls / things the executing agent must NOT do

- Do NOT copy the existing 1010–1015 forks' `bypass_llm=true` value blindly — for PRD use `false` (Section 4.2).
- Do NOT insert at a random position in the file. Place it after `input_id=1015` (Section 4.3).
- Do NOT remove the trailing `STOP after saving...` block from the default content — the override block lives **after** it, separated by `---`. Both must remain in the rendered prompt.
- Do NOT drop the `current_timestamp()` / `current_user()` columns or the `version=1, is_active=true` flags. The unique constraint is `(section_tag, coding_assistant, version)`; if you re-apply, you'll need to bump version to 2 or run with `--recreate`.
- Do NOT modify any other row in the seed file as part of this change.
- Do NOT run the deploy command yourself. Surface it for the user.
- Do NOT touch `docs/design_prd.md` (the actual sample PRD in this repo) — that's an unrelated artifact.
