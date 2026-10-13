# Plan: coach-visuals (D12 PR 2, "Coach Visuals")

- Repo: app (databricks-solutions/vibe-coding-workshop-app)
- Base: origin/feature/genie-code-mcp-integration @ e0078d2 (PR #135, D12 PR 1, merged)
- Plan path in the PR: docs/superpowers/plans/2026-10-13-coach-visuals.md
- Spec: docs/specs/mcp_design/mcp-workshop-coach-visuals.md (committed by #135, sha256 67e6cde0...726e). §1 is authoritative.
- Spec sections: §3.1 invariants, §3.2 lint, §3.3 shapes, §3.4 matrix, §3.5 (coach reuse), §3.6 interface, §3.7 ops, §6.1 tests.
- Test floor: 1776 passed / 0 failed.

## Goal
`vibe_explain_step` with `focus` (or with an explicit `visual`) returns a server-built inline visual: a markdown table or a box-drawing diagram in a ```text fence, with a caption. The model writes the prose and may refer to the visual, but never draws it. Labels come only from manifest step titles and output key names, never from captured output values.

## Hard constraints (from the human; breaking any one means STOP and report)
- No new MCP tool (7 tools stay 7), no Lakebase DDL, no reseed, no seed SQL change.
- No change to the coaching.py scrub rules: `_scrub_output`, `scrub_output_with_reason`, `scrub_output`, `scrub_input`, `_has_secret`, `_ngrams` and `_labelled` stay byte-identical.
- No change to web-path output (the assembler is not touched) or to the web UI / Mermaid rendering (no frontend file).
- The model never draws or edits visuals. Labels come only from manifest step titles and output key names (`consumes`/`produces`); captured output VALUES, sample data and benchmark text never appear in `visual` or `visual_caption`.
- Fail-open: any visual error means `visual`, `visual_kind` and `visual_caption` are all null, plus one content-free WARNING. It is never a tool error.
- No deploy. Merge-only, and the human deploys.

## Charter exception (trunk file): src/backend/mcp_server.py
Reason: §3.6 requires the result fields and the tool argument, and they can only live there. The scope is limited to:
(1) the three `StepHelpResult` fields;
(2) the `visual` parameter on `vibe_explain_step` and its INVALID_PARAMETER check (beside the `focus` check);
(3) building the visual after `help_result` and before `coaching.coach`, then passing it in;
(4) the tool description text (D-92).
Nothing else in mcp_server.py changes.
Reversal: revert the PR, or set VIBE_COACH_VISUALS_ENABLED=0 (visual is then always null; the description and fields stay in place, inert).

## File fence (exhaustive)
- NEW src/backend/services/coach_visuals.py
- src/backend/mcp_server.py (exception above)
- src/backend/services/coaching.py: COACH_SYSTEM addition, build_context, the coach() kwarg, the cache key and the timings log field. Scrub functions unchanged.
- src/backend/workshop/visuals.py: at most one small public accessor that returns a twin's raw fenced text and kind by name. No change to lint_visual, the swap, load_twins semantics or FALLBACK_LINE.
- src/backend/workshop/mcp_visuals/semlayer_profile.expected_output.1.md (nit a)
- src/backend/workshop/mcp_visuals/sync_from_lakebase.how_to_apply.1.txt (nit b)
- NEW tests/workshop/test_coach_visuals.py
- tests/workshop/test_coaching.py and tests/workshop/test_mcp_contract.py: only where they pin the description, the COACH_SYSTEM text, the cache key or the timings log line.
- docs/superpowers/plans/2026-10-13-coach-visuals.md (this plan, byte-identical to FORGE/state/lead/plans/coach-visuals.md)
- docs/superpowers/decision-log.md (append D-90..D-97 from FORGE/state/lead/decisions.md, verbatim in substance)
NOT touched: assembler.py, routes.py, engine.py, App.tsx, workflowSections.ts, generate_manifest.py, manifest.json, any seed or DDL file, index.json, any twin besides the two named, and anything under src/components or src/ (frontend).

## Twin nits carried from PR 1 (D-91)
(a) semlayer_profile.expected_output.1.md: the header cell "Key columns" becomes "Columns". Nothing else changes.
(b) sync_from_lakebase.how_to_apply.1.txt line 4: "your _lakebase schema" (21 chars) becomes "your Lakebase clone schema" (26 chars, +5). The ─ run before ┐ is shortened by exactly 5 (8 → 3), so the line length and the right edge (┐) column are unchanged and lint_visual passes. A test asserts that the ┐ column on line 4 equals the ┤/│ column on the following lines.
index.json is NOT changed: hashes are of the Mermaid SOURCES, which are unchanged. gagent_optimize stays a straight chain. The PR 1 coverage and no-orphan tests must stay green.

## Design

### coach_visuals.py (imports lint_visual, DIAGRAM_CAPTION and the twin accessor from workshop/visuals.py; D-85)
Public entry: `build_visual(*, step, state, track, focus, visual, served_how_to_apply) -> Visual | None`, where `Visual` is a frozen dataclass of (text, kind, caption).
- `visuals_enabled()`: VIBE_COACH_VISUALS_ENABLED, read per call, with the same parsing as `coaching_enabled()` (0/false/off/no disables; unset means enabled). When it is off, the result is None. The PR 1 twin swap is NOT behind this switch.
- Selection (§3.4, verbatim):
  - `visual` None → "auto" if focus else "none". "none" → None.
  - what_now: auto=progress, table=progress, diagram=curated else downstream
  - why: auto=curated else downstream, table=progress, diagram=curated else downstream
  - unblock: auto=unblock checklist, table=unblock checklist, diagram=curated else downstream
  - review: auto=built-so-far, table=progress, diagram=built-so-far
  - no focus: auto=none, table=progress, diagram=curated else downstream
- Every built visual goes through lint_visual(text, kind, caption) before it is returned. A non-empty lint result means None plus a WARNING naming the section and the shape only.
- The whole of build_visual sits in try/except Exception, so it returns None plus `logger.warning("Coach visual failed section=%s shape=%s", ...)`, with no content and no exc text from user data. (exc_info=False, because a traceback could carry values.)

Labels (D-93): step titles come verbatim from the manifest (`Step.title`; `_INTENT_BEAT_STEP.title` for the beat). Output keys use `key_label(key)`: underscores become spaces, the first letter is capitalised, and whole words in a fixed acronym set {prd, ui, api, sql, bi, er, uc, kpi, llm, mcp, id} are upper-cased (`prd_document` → "PRD document"). No other text source is allowed.

Session frontier (D-94): the progress table describes the SESSION:
- Its "Now" row is the intent beat ("Define Your Use Case") while `_needs_use_case(state)`. Pass this in as a bool; coach_visuals does not import mcp_server.
- Otherwise it is the outline's first unfinished step (`engine.outline`; current or locked, per D-78).
- When every step is done, there is no Now row.
The other shapes describe the REQUESTED step.

Shapes (§3.3):
- Progress table (table): Step | Status. Rows: the last done step ("Done"), the Now step ("Now", bold title), the next two unfinished steps ("Next"), then a summary row "<k> more steps | Later" when k > 0. Skipped steps are not rows. Max 5 data rows, 2 columns, and cells ≤ 40 (titles max 33 today).
  - Caption: "<d> of <n> steps done. Now: <Now title>."
  - All done: the last ≤ 4 done rows, caption "All <n> steps done."
  - n is the outline length; the intent beat is not counted in n.
- Unblock checklist (table): Kind | Needs | Status (3 columns, so no cell carries a prefix; critic r1 (f): "Previous step: " + a 33-char title = 48 and "Input: " + the 36-char key label "MLflow evaluation runs and iteration" = 43 both broke MAX_CELL 40).
  - Prerequisite row: "Previous step | <title of the requiresGate step> | Done/Not done". For requiresGate == USE_CASE_GATE the row is "Use case | Use case locked | Done/Not done". If the gate's title isn't in the track, the gate key goes through key_label.
  - Then one "Input | <key_label> | Present/Missing" row per consumes key. That is key presence in captured_outputs only; values are never read beyond truthiness.
  - With no rows: "None | Nothing blocks this step | Ready".
  - Over 8 rows: the first 7, then "Input | <k> more inputs | See step".
  - A test computes every title and every key_label of every consumes/produces key on every track and asserts each is ≤ 40 chars, and ≤ 38 when bolded (progress Now row), so every cell fits by construction.
  - Caption: "<met> of <total> needs met."
- Downstream chain (diagram):
  - Nodes: the requested step, then the steps (in outline order, after it) that transitively consume its produces key, with at most 5 nodes in total.
  - If no step consumes it: the next ≤ 4 outline steps.
  - If the chain is only the step itself: None (logged visual=none).
  - Nodes are joined by the "│ / ▼" connector lines. There is no side note (D-95), and every line starts at column 0.
  - Caption: DIAGRAM_CAPTION + " Steps that build on <title>."
- Built-so-far chain (diagram):
  - Nodes: the last ≤ 6 done steps in outline order. A step's line is "<title> ─▶ <key_label(produces)>" when produces is set and the line is ≤ 60, else the title alone.
  - With 0 done steps: None.
  - Caption: DIAGRAM_CAPTION + " What you have built so far."
- Curated diagram (diagram or table, by the twin file's extension):
  - Source: the twin `<sectionTag>.how_to_apply.1` (§3.5 coach reuse).
  - It is used ONLY IF this call's served `how_to_apply` (render_target="mcp", already swapped by the assembler) contains that twin's fenced text, i.e. the twin's hash matched the live row and it was actually served (D-95). Otherwise the downstream chain is used.
  - Caption: for a diagram, DIAGRAM_CAPTION + " How <title> fits together."; for a table, "How <title> fits together."

### mcp_server.py
- StepHelpResult gains exactly the §3.6 fields: `visual: str | None = None`, `visual_kind: Literal["table", "diagram"] | None = None`, `visual_caption: str | None = None`. extra="forbid" stays.
- vibe_explain_step(session_id, sectionTag=None, focus=None, visual=None, context=None):
  - An invalid visual value returns INVALID_PARAMETER ("visual must be one of auto, none, table, diagram."), checked before the session load.
- Visual build:
  - After help_result is built, call coach_visuals.build_visual. It is fail-open itself; the call site is wrapped again in try/except → None.
  - On the project_setup and intent-beat branches it works the same way; there is no curated twin there, so curated falls back to downstream.
  - The result goes onto help_result via model_copy.
  - If focus is None, return then. This is a visual-only request and makes NO coach() call.
- With focus: coach(..., visual_kind=<kind or None>, visual_caption=<caption or None>). The result carries both the coaching fields and the visual fields.
- With no focus and no visual: the result is exactly today's: every existing field has the same value, and the three new fields are null.
- Description (D-92): replaced by this exact text, 385 chars, inside the 200-400 contract bound. Both §3.6 sentences are verbatim at the end.
  "Step help: `how_to_apply`, `expected_output`, `why`. Call ONLY when the learner asks about a step; `sectionTag` defaults to current. Pass `focus` (what_now|why|unblock|review) for grounded `coaching` (else `is_fallback`). Pass `visual` (table|diagram) when the learner asks to see, show, draw or map something. Present `coaching`, then `visual` exactly as given, then `visual_caption`."

### coaching.py
- COACH_SYSTEM: append to the STYLE block the exact §3.6 sentence:
  "- If the CONTEXT has `visual`, a visual is shown after your text. You may point to it ("the table below"). Never draw one, and never describe it line by line."
  The 2-5 sentence rule and the "Output prose only" line stay as they are.
- build_context(..., visual_kind=None, visual_caption=None): when kind is set, append the section ("visual", f"{kind}, {caption}") so the line reads `visual: <kind>, <caption>`, and include "visual" in grounded_on. The visual TEXT is never put in the context.
- coach(..., visual_kind=None, visual_caption=None): pass them to build_context.
- Cache key (D-96): the single-flight / cache / negative-cache key becomes (session_id, section_tag, focus, visual_kind or "none"), so prose that says "the table below" is never served with a different visual or none.
- Timings log: append " visual=%s" (the kind, or "none") as the LAST field of the existing `coaching timings` line. No other log change. The regex that pins the line at tests/workshop/test_coaching.py:771 (`... outcome=(\S+) cache=(\S+)$`) is updated to `... outcome=(\S+) cache=(\S+) visual=(\S+)$` and asserts the visual value; this edit is inside the fence.
- The scrub is unchanged. A model reply containing a fence is still dropped by the existing `_scrub_output`, which is what we want (F9).

## Acceptance contract
- A1 Suite: ≥ 1776 passed + new, 0 failed (the command below).
- A2 Lint: every §3.2 rule has a pass and a fail case (PR 1's tests may already cover this; extend them only for anything missing).
- A3 Builders: snapshot tests for each of the 5 shapes on fixed states (fresh, mid-track, all-done, blocked) on genie-accelerator, plus at least one other track. Every output passes lint_visual.
- A4 Selection: one test per §3.4 cell (5 focus rows × auto/table/diagram, plus "none").
- A5 Legacy: no focus and no visual gives existing fields equal to the base behaviour and the 3 new fields null.
- A6 Fail-open: a builder that raises gives the visual triple null, coaching text still returned, no tool error, and a WARNING with no content.
- A7 Kill switch: VIBE_COACH_VISUALS_ENABLED=0 gives no visual, and the twin swap still applies in how_to_apply.
- A8 No model call for a visual-only request: the coach/LLM spy is never called.
- A9 Firewall: a test plants a distinctive token in captured_outputs (for every key, including the step's produces and consumes keys) and in session_parameters. The token never appears in visual or visual_caption, on any shape or track.
- A10 Cache key: a coached reply cached for visual "table" is not served to a visual "none" call (D-96).
- A11 Contract: 7 tools; the description equals the D-92 text and is 200-400 chars; < 8 parameters; output schema validates with the new fields; INVALID_PARAMETER on visual="bogus".
- A12 Scrub byte-identity: the source text of the 7 scrub functions is unchanged from base (the gatekeeper checks with git diff, AST or function source).
- A13 Twins: the PR 1 coverage, no-orphan and no-Mermaid tests stay green; the two nit twins pass lint; index.json is unchanged.
- A14 Web path: assembler.py is unchanged. The gatekeeper re-runs PR 1's base-vs-head web byte-identity over all tags and both variants.
- A15 Timings line: contains `visual=<kind|none>`, and never visual text or caption text.

## Green gates
- cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q (floor 1776/0)
- git diff --check clean; no frontend change, so no npm build; no seed change, so no genie gate.

## Tampers (each must turn a named test red, then be restored green)
- T1 Remove the try/except in build_visual → A6 red.
- T2 Make visuals_enabled() always True → A7 red.
- T3 Drop visual_kind from the cache key → A10 red.
- T4 Call coach() on a visual-only request → A8 red.
- T5 Label a node from captured_outputs[key] instead of key_label(key) → A9 red.
- T6 Emit a 61-character line from the downstream builder (skip lint) → A3 red.
- T7 Swap why/auto to the progress table → A4 red.
- T8 Change one word of the §3.6 description sentences → A11 red.
- T9 Gate the PR 1 twin swap on visuals_enabled() → A7 red.
- T10 Put the visual text into build_context → a test asserting the context has only `visual: <kind>, <caption>` goes red.

## Revision r1 (critic BLOCK round 1)
- (f) unblock checklist → 3 columns (Kind | Needs | Status), plus the all-labels ≤ 40 test.
- (g) nit (b) → the ─ run is shortened by 5, not 3, plus the alignment test.
- (h) the timings-line regex at test_coaching.py:771 is named and updated.
- (a) the second description-bound pin is in test_c12_tool_count_and_annotations in test_coaching.py (cited as :536 and :541 by different reads; locate it by name).
- (d-93a) Post-ACCEPT casing amendment (length-neutral): the critic's label scan shows "Mlflow evaluation runs and iteration". key_label maps the whole word "mlflow" to "MLflow" (same length; still ≤ 36, and ≤ 40 bolded).

## Fix-up r1 (D-98; gatekeeper FAIL @f83d560, PLAN_PROGRESS_DENOMINATOR)
- Progress caption: n = len(engine.outline(track, state)), the full outline including skipped entries; the intent beat is not counted. d = the number of outline entries with status "done". Skipped steps are still not rows.
- No unfinished step left (every entry is done or skipped):
  - if d == n, the caption is "All <n> steps done.";
  - otherwise it is "<d> of <n> steps done. The rest were skipped.";
  - the rows are the last ≤ 4 done steps either way.
- New tests, on genie-accelerator:
  - with project_setup skipped, "0 of 24 steps done. Now: PRD Generation." (the gatekeeper's regression);
  - all-done with one skipped, "23 of 24 steps done. The rest were skipped.";
  - the snapshots and the firewall state set gain one skipped_gates state.
- Fence unchanged: coach_visuals.py, test_coach_visuals.py, this plan (re-copied byte-identical) and decision-log.md (append D-98).

## Decisions carried into docs/superpowers/decision-log.md
D-90, D-91 (human), D-92..D-97 (this plan), verbatim in substance from FORGE/state/lead/decisions.md.

## Out of scope (queued)
PR 3 docs (D2 §12 + IDL, D1 §4.6, README row 16, D8 smoke entry). vibe_submit_answer visuals (§8 q3). §8 q1-q4 stay open.
