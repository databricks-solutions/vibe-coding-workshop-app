# Plan: contract-doc-phase2a-reconcile (app, docs only)

Date: 2026-10-13 · repo: app · base: origin/feature/genie-code-mcp-integration @ 5c37937
Commit this plan at docs/superpowers/plans/2026-10-13-contract-doc-phase2a-reconcile.md.
Sources: D-102, D-103, the #134 implementer note (D2 :171), the #137 reviewer's non-blocking notes.
Decisions carried: every FORGE decisions.md entry not yet in docs/superpowers/decision-log.md at
your base (at 5c37937 it ends at D-102; coach-budget-env carries D-103..D-106 if it merges first).

## Goal
Make D2 (mcp-interface-contract.md), D1 (mcp-workshop-interactivity.md) and D8
(mcp-workshop-test-plan.md) describe the shipped 7-tool surface at 5c37937. Phase 2A shipped
coaching as `vibe_explain_step(focus)` (D-22), not a `vibe_coach` tool, and #134 (D-78) made
`vibe_next_step` strictly ordered. Several live (normative) sentences still say otherwise.

## Rule for every edit
- The shipped code at 5c37937 decides (decision protocol (1)). Quote code strings byte-for-byte
  from source (tool descriptions = the joined Python string literals in src/backend/mcp_server.py;
  COACH_SYSTEM from src/backend/services/coaching.py).
- Rename/redirect, don't erase history: where a sentence records what was planned, keep it and
  mark it historical ("planned as `vibe_coach`; shipped as `vibe_explain_step` with `focus`, D-22").
  Where a sentence states current behaviour, make it true.
- Nothing outside the fence. In particular: no edit to the polly-*charter* files, D9
  mcp-workshop-rollout.md, mcp-research-and-findings.md, the D12 spec
  mcp-workshop-coach-visuals.md, or any code/test/seed file.

## Fence (exactly these files)
1. docs/specs/mcp_design/mcp-interface-contract.md (D2)
2. docs/specs/mcp_design/mcp-workshop-interactivity.md (D1)
3. docs/specs/mcp_design/mcp-workshop-test-plan.md (D8)
4. docs/superpowers/decision-log.md (append the not-yet-carried entries only)
5. docs/superpowers/plans/2026-10-13-contract-doc-phase2a-reconcile.md (this plan, byte-identical)

## Edits
### D2
- E1 §2.2 `ExplainabilityPayload`: make the field list match the shipped `vibe_get_step` result
  (the model/`_step_payload` fields at 5c37937, names and order). Fields that moved to
  `vibe_explain_step` (e.g. `how_to_apply`, `expected_output`, if absent from the shipped payload)
  leave this type, with one line pointing to §3.8. If the shipped payload has fields the type lacks
  (e.g. `user_trigger_prompt`), add them.
- E2 §2.4 (:103): "plus FMAPI for `vibe_coach`, §3.7" → FMAPI for `vibe_explain_step` with
  `focus`, §3.8.
- E3 every "Description (as-prompt)" quote in §3.1–§3.6 and §3.8: byte-equal to the shipped
  description. Known stale: §3.3 `vibe_next_step` (:171, pre-D-78 "whose prerequisite gate is
  satisfied"). Fix any other that differs; list each one changed in the PR body. Where §3.3's prose
  around the quote still describes skip-ahead, align it with D-78 (first unfinished step in order,
  else `{blocked:true, blocked_by}`; `STEP_LOCKED` on out-of-order completion is §3.4's).
- E4 §6 (~:513): the fail-open sentence names `vibe_explain_step` (with `focus`), not `vibe_coach`.
- E5 §8 annotation matrix: rows = the 7 shipped tools with their shipped ToolAnnotations. The
  `vibe_coach` row becomes `vibe_explain_step` (values from code). Add one line under the table:
  "`vibe_coach` was planned (§3.7) and never built; its slot is `vibe_explain_step` (§9)."
- E6 §10 mapping: the `vibe_coach` row becomes `vibe_explain_step` (engine: payload + assembler;
  with `focus`, `services/coaching.py` model call; D1 §4.6; REST twin as the shipped route, or
  "— (MCP-only)" if none). Verify the other six rows' REST twins exist in routes.py; fix any that
  don't, listing them.
- E7 §12 intro (:614) and §12.1 heading context: say the model contract sits behind
  `vibe_explain_step`'s `focus` (§3.8); `CoachResult` is kept as the historical shape (the existing
  §12.1 note stays). §12.2: if the quoted system prompt differs from shipped COACH_SYSTEM, make it
  byte-equal (that may change the "CoachResult" wording at :689 only if the code says otherwise).
- E8 §3.8 (#137 residuals): quote the progress-caption all-done wordings exactly as shipped (D-98:
  "All N steps done." / "D of N steps done. The rest were skipped." with N/D explained); add one
  sentence under the selection matrix: "`visual=none` returns no visual for any `focus`."
- E15 §9 "Reconciliation with the roadmap §8.2" paragraph (:575-:576): "**Phase 2A** then adds
  `vibe_coach` (§3.7) for a total of **7**" states current behaviour. Make it say the 7th tool is
  `vibe_explain_step` (shipped 2026-09-27) and Phase 2A extended it with `focus` instead of adding
  the planned `vibe_coach` (§3.7), so the total stays **7**; keep "still far under the shared
  ~20-tool ceiling". (Critic r1 BLOCK.)
- §3.7 and the rest of §9 stay as they are. The §9 "Phase 2A amendment" blockquote (:565-:570) is
  historical (it records the 2026-09-27 decision, including "§10's `vibe_coach` row folds into
  `vibe_explain_step`"); leave it and list it in A6 as historical.

### D1
- E9 §4.6 Mechanism (:186–:194): current-behaviour sentences name `vibe_explain_step` with
  `focus` (D2 §3.8) and the result fields it returns (`coaching`, `is_fallback`, … as shipped),
  keeping one historical clause ("planned as a separate `vibe_coach` tool, D2 §3.7").
- E10 §4.6 visuals bullet (#137 residual): labels come only from manifest step titles and output
  key names; curated diagrams are the hand-converted twin files themselves (D-95).
- E11 §5 table and the paragraph after it (:213–:226): the `vibe_coach` row becomes
  `vibe_explain_step` (`focus` → adaptive coaching; read-only; fail-open). The "net-new tools" /
  "one deliberate exception" sentences say that coaching extended an existing tool instead
  (tool count stays 7, D2 §9), keeping the rationale text.
- E12 any other current-behaviour `vibe_coach` mention in D1 (e.g. :315 "The `vibe_coach` model
  call"): same treatment.

### D8
- E13 §4 coaching tests (:115–:132): name `vibe_explain_step` with `focus` (the shipped tests
  live in tests/… — cite the real files), keep the assertions as written.
- E14 §9 (:273, D-103): the `tests/tools/mcp_probe/` citation → keep the sentence, mark the path
  as planned and not built (no other change to §9).

## Acceptance contract (gatekeeper re-derives each from 5c37937 + head)
- A1 Scope: exactly the 5 fence files changed; plan byte-identical to
  FORGE/state/lead/plans/contract-doc-phase2a-reconcile.md; no code/test/seed diff.
- A2 Descriptions: for each of the 7 tools, every D2 "Description (as-prompt)" quote equals the
  shipped description (normalise only the blockquote "> " prefixes and line wraps to single spaces;
  compare otherwise exactly).
- A3 Payload: D2 §2.2 field names = shipped `vibe_get_step` result field names, same order.
- A4 Matrix: D2 §8 rows = the 7 shipped tool names with their shipped annotation values.
- A5 COACH_SYSTEM: D2 §12.2 quote = shipped COACH_SYSTEM (same normalisation as A2).
- A6 `vibe_coach` residue: every remaining `vibe_coach` occurrence in D2/D1/D8 at head is listed in
  the PR body with its line and reason ("historical" or "pointer"), and the list matches a fresh
  grep exactly. No listed line states current behaviour.
- A7 Citations: every file path / section reference on an added or changed line resolves at head
  (D-103 rule: pre-existing unchanged lines are out of scope).
- A8 Additive-only outside the named edits: no deleted or reworded line in D2/D1/D8 that isn't
  covered by an E-item; the PR body maps each changed hunk to its E-number.
- A9 Tests: the app suite stays green at the floor (1891 passed, 0 failed).

## Tampers (each must make the named check fail, then restore)
- X1 change one character in the §3.3 description quote → A2.
- X2 add a non-shipped field to §2.2 → A3.
- X3 flip one annotation cell in §8 → A4.
- X4 leave one current-behaviour `vibe_coach` sentence unlisted → A6.
- X5 add a citation to a missing file on a changed line → A7.
- X6 reword an unrelated D2 sentence → A8.
- X7 touch one line in polly-charter-next.md → A1.

## Green gates
- `cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q` → ≥1891 passed, 0 failed.
- The implementer's own scripts for A2–A8 (kept under FORGE/work/, not committed), output pasted
  in the PR body. No genie gate (no seed change). No deploy.

## Reversal
Revert the single merge commit; docs only.

## Out of scope (queued, D-105)
`vibe_coach` mentions in D4 mcp-workshop-architecture.md, D5 mcp-workshop-pedagogy.md,
D6 mcp-workshop-data-model.md and D7 mcp-workshop-security.md → follow-up `spec-vibe-coach-sweep`.
