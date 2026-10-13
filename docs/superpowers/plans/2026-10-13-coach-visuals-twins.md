# Plan: coach-visuals-twins (D12 PR 1 of 3: Mermaid twins and MCP swap, defect fix)

repo=app · base origin/feature/genie-code-mcp-integration @ de70b96 · date 2026-10-13
Plan path in the PR: docs/superpowers/plans/2026-10-13-coach-visuals-twins.md
Source spec (D12): FORGE/state/specs/coach-visuals/mcp-workshop-coach-visuals.md, 457 lines,
sha256 67e6cde0ef767598b68922559e66b778361cf65c742e4ddc60b7c7ad474c726e. Absent from origin. This
PR commits it unchanged at docs/specs/mcp_design/mcp-workshop-coach-visuals.md (D-83): copy it,
verify the sha256 of the committed file equals the value above BEFORE committing, and paste the
`shasum -a 256` line in the PR body. Never edit the FORGE copy. Never write to APP (the human's
checkout); work only in the worktree. §1 (F1–F11) is authoritative: do not change a §3.2 rule.

## Defect
vibe_explain_step serves seed `how_to_apply` / `expected_output` verbatim (mcp_server.py:1526-1533
-> assembler.py:159-164). 36 ```mermaid fences sit in __default__ rows of
db/lakebase/dml_seed/02_seed_section_input_prompts.sql (verified: `grep -c` = 36; 32 how_to_apply,
4 expected_output; 0 indented; 4 fence lines contain `{placeholder}` tokens; 1 erDiagram in
semlayer_profile.expected_output). Genie Code shows them as code with a ▶ Run that fails (F1, F6).
genie-accelerator has 19 affected steps in its default outline.

## Changes (fence; nothing outside it)
1. `src/backend/workshop/mcp_visuals/` — 36 hand-converted twins named
   `<section_tag>.<field>.<n>.txt` (diagram) or `.md` (table), `<field>` ∈ {how_to_apply,
   expected_output}, `<n>` = 1-based fence position within that field of that row. Plus
   `index.json`: `{ "<name>": {"sha256": "<hex>", "kind": "diagram"|"table"} }`.
   Conversion (spec §3.5): left-to-right → top-to-bottom; drop `<br/>`, shorten labels;
   subgraph → a short label line above its nodes; the erDiagram → a table twin
   (Entity | Key columns | Relates to); `{placeholders}` → a generic phrase ("your gold schema");
   loops use the verified loop-chain layout in spec §3.3. A diagram twin file holds exactly one
   ```text … ``` fence and nothing else; a table twin holds one GFM table and nothing else.
   Content must preserve the source diagram's nodes and edges in meaning: no added steps, no
   dropped steps (F9 is why the server, and a human, own these).
2. `src/backend/workshop/visuals.py` (new, shared; PR 2's coach_visuals.py imports it, D-85):
   - `lint_visual(text, kind, caption) -> list[str]` (empty = pass) enforcing every spec §3.2
     rule exactly: fence open ```text / close ```; no line inside starts with whitespace; every
     line ≤ 60 by `len()`; ≤ 20 lines inside; allowed chars = printable ASCII minus backtick plus
     `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ▼ ▲ ◀ ▶`; no `-->`, `->`, `--`; no tabs, no trailing whitespace; no
     `{...}`; caption required, diagram caption starts `Diagram only, nothing to run.`; tables
     ≤ 8 data rows, ≤ 3 columns, cell text ≤ 40 chars, no fences in cells.
   - `mermaid_hash(body)`: body = the lines strictly between the ```mermaid line and its closing
     ``` line, `\r\n`→`\n`, each line `rstrip()`ed, joined with `\n`, no trailing newline;
     sha256 hex of UTF-8 (D-86). Fence detection: a line whose `strip()` == "```mermaid" opens,
     the next line whose `strip()` starts with "```" closes.
   - `swap_mermaid_for_mcp(text, section_tag, field) -> str`: for each fence in order, if
     `<tag>.<field>.<n>` is in index.json AND hashes match → replace the whole fence (open line
     through close line) with the twin text; for a diagram twin append "\n\nDiagram only, nothing
     to run." (D-84). Else → replace with the single line
     `(This step has a diagram in the workshop web UI.)` and `logger.warning` naming section_tag,
     field and n only — never fence content, never row text. Index and twins load once, lazily,
     cached; a load error degrades every fence to the fallback line (fail-open, never raises).
   - `strip_residual_mermaid(text)`: post-substitution safety net (D-87): any ```mermaid fence
     still present (e.g. arriving via a substituted previous output) → fallback line + WARNING
     (tag/field only). MCP path only.
3. `src/backend/workshop/assembler.py`: `get_section_input_content(..., render_target:
   Literal["web","mcp"] = "web")`. When "mcp": call `swap_mermaid_for_mcp` on the RAW
   `how_to_apply` and `expected_output` before the substitution loop (assembler.py:159), and
   `strip_residual_mermaid` on both after all substitution/branding. When "web": code path
   untouched — zero behaviour change. No other field (input, system_prompt, user_trigger_prompt)
   is touched.
4. `src/backend/mcp_server.py` (TRUNK — charter exception GRANTED by the human, limited to this
   one kwarg): add `render_target="mcp"` to the ONE call at :1526 inside vibe_explain_step.
   Nothing else in the file; any further need there → STOP and report. Reason: it is the only MCP path that returns how_to_apply/expected_output (slim payload
   omits them, :164). Reversal: delete the kwarg. `_step_payload` (:1118) stays on the web default
   because it does not emit those fields; the CI guard below proves that.
5. Tests (new `tests/workshop/test_mcp_visual_twins.py`, plus lint tests): see Acceptance.
   Reuse the seed-parsing helper in tests/workshop/test_seed_new_rows.py (or whatever existing
   test parses 02_seed's VALUES tuples) — add a small `''`-aware helper only if none fits.
6. The spec, committed verbatim (D-83), and `docs/superpowers/decision-log.md`: carry D-79–D-82
   from FORGE/state/lead/decisions.md plus D-83–D-87 below.

Out of fence (STOP and report if needed): seed SQL, any DDL, any MCP tool, coaching.py, any
frontend file, MermaidDiagram.tsx, routes.py, manifest, generate_manifest.py.

## Acceptance contract
A1 Exactly 36 twins + index.json with 36 entries; 32 how_to_apply, 4 expected_output; the
   erDiagram twin is a table. Every twin passes `lint_visual` (caption = the D-84 caption for
   diagrams, any non-empty takeaway for tables). Swap output: a diagram twin is followed by the
   D-84 line; a table twin is not (test both).
A0 The committed spec's sha256 = 67e6cde0…726e (full value above).
A2 Coverage guard: parse every __default__ row in the seed; for every ```mermaid fence in
   how_to_apply/expected_output a twin exists with matching sha256. No orphan twins (every index
   entry and every file maps to a real fence; files ↔ index 1:1).
A3 For every section tag on every track (engine.MANIFEST.track_steps), vibe_explain_step output
   (static and each focus, coaching disabled) contains no "```mermaid"; same assertion for
   vibe_get_step / vibe_next_step / vibe_start_track payloads and the session-state resource.
A4 Web byte-identity: for every section tag with a seed row, get_section_input_content with no
   render_target equals render_target="web" and equals the pre-PR output (golden computed by
   running the base implementation in the test, or a committed fixture of sha256s generated at
   base de70b96 — state which in the PR). Web how_to_apply still contains all original fences.
A5 Hash-mismatch test: mutate one fence → that fence becomes the fallback line, one WARNING
   whose message contains tag/field/n and none of the fence text; other fences still swap.
A6 Placeholder order: a fence containing `{placeholder}` swaps (hash taken pre-substitution).
A7 Residual net: a previous output containing a mermaid fence substituted into how_to_apply on
   the mcp path yields the fallback line; on the web path it is untouched.
A8 Lint: each §3.2 rule has a passing and a failing case.
A9 PR body: a "Twin review" section is NOT required; instead write the human review file (below).

## Twin review artifact (spec §8 q2: the human signs off before merge)
Write `FORGE/work/coach-visuals-twins-review.md` (outside the repo, not committed): for each of
the 36 twins, in track/outline order, a heading `<name>` (tracks it reaches), the source Mermaid
fence verbatim, then the twin verbatim. Report its path and line count.

## Green gates
- `cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q`
  → floor 1688 passed + the new tests, 0 failed.
- No seed change → no genie gate; no frontend change → no npm build.
- `git diff --stat origin/feature/genie-code-mcp-integration` lists only fence files.

## Tampers (for plan_critic to adopt/extend in tampers.md)
T1 edit one seed mermaid line in a test copy → A2 red. T2 delete one twin → A2 red. T3 add an
orphan twin → A2 red. T4 add a leading space to a twin line → A1 red. T5 drop render_target from
vibe_explain_step → A3 red. T6 apply the swap on "web" → A4 red. T7 move the swap after
substitution → A6 red. T8 log fence text in the WARNING → A5 red. T9 remove the residual net →
A7 red.

## Live checks (for plan_critic's live_checks.md; run only after the human approves deploy)
L1 deployed app: vibe_explain_step on every genie-accelerator step + every tagged step of every
track → zero "```mermaid"; report per step twin vs fallback (a fallback means the Lakebase row
drifted from the seed; list them, not a FAIL by itself, but > 0 on genie-accelerator's 19 is
reported to the human). L2 focus=why on semlayer_metric_view → contains its twin text. L3 web
endpoint for the same step still returns the original ```mermaid fence. L4 app logs: WARNING
lines from visuals.py carry no fence content.

## Decisions (draft; carry into decision-log)
D-83 commit the untracked D12 spec verbatim in PR 1 · rev: git rm it.
D-84 (human-approved) DIAGRAM twins only are followed by the plain line "Diagram only, nothing
     to run." in step help (F6). Table twins (the ER twin) get no such line: tables have no Run
     button (F5) · rev: one constant.
D-85 lint_visual + twin loader live in src/backend/workshop/visuals.py, shared with PR 2.
D-86 hash definition as above (spec §3.5 made exact).
D-87 (human-approved; keep it even if no template can trigger it) MCP-only post-substitution
     residual-Mermaid net: runs only when render_target="mcp", same fallback line, WARNING with
     no content, never touches the web path · rev: delete one call.
D-83/D-85/D-86 human-approved as written.
Release (human ruling, D-88): PR 1 is held open after ACCEPT+PASS; the human reviews the twin
side-by-side; merge only after TPL #21 then APP #130 merge; default merge-only, the human deploys
and runs the §6.3 smoke. Live checks run after the human's deploy.

## Fix-up r1 (D-89)
After ACCEPT + PASS on 9a2aedc (one lead ruling, one nit), spec §3.5 is applied per fence:
`load_twins` treats only a missing or unparseable `index.json` as global (every fence falls back,
one content-free WARNING). A twin file that is missing, unreadable or fails `lint_visual` drops
only its own entry, with one WARNING naming the twin key and no content; every other fence still
swaps. The D-84 caption, the D-87 residual net, render_target gating and the web path are
unchanged (A4 golden unchanged). New tests: `test_missing_twin_file_degrades_only_its_fence`,
`test_lint_failing_twin_degrades_only_its_fence` (tmp copy of mcp_visuals; the broken
semlayer_profile how_to_apply twin falls back, its expected_output table twin and
semlayer_metric_view still swap). Tamper: revert to all-or-nothing → both red. Nit: trailing
whitespace removed at assembler.py:334 (`git diff --check` clean).
