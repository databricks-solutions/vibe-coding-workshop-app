# p4-usecase-hoist (app) — plan (RUN.md P4.2)

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 7329736 (P4.1 merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-p4-usecase-hoist.md
Scope: P4.2. Lane: T (trunk: scripts/generate_manifest.py, src/backend/workshop/manifest.json, db/lakebase/dml_seed/02_seed_section_input_prompts.sql; engine.py only if Change 0 must live there). Reseed: yes (a seed body changed; per D-14 the reseed skips existing PKs, so the live row 958 isn't overwritten; see change 4).

## Goal (RUN.md P4.2)
Hoist use_case_selection into the shared define-usecase step for all 14 tracks (D11 open q1). Today it's resolved pre-journey for genie-accelerator only, via the genie-only generator overrides scripts/generate_manifest.py GENIE_CHAINING_LITERAL_OVERRIDES[3] = {"use_case_brief": 1} (prd_generation consumes use_case_brief) and GENIE_REQUIRES_GATE_OVERRIDES = {"prd_generation": "use_case_selection"} (≈:249-278 @7329736). The engine primitive (engine.py:317-339 USE_CASE_GATE, use_case_resolved, resolve_use_case) is already track-agnostic. Generalize the mechanism, regenerate manifest.json with the script, make the use_case_selection prompt body track-agnostic (D11 §3.3 artifact shape), prove MCP outline == SPA outline for every track, and record the open-q1 decision.

## KEY RISK (the reason for Change 0)
build_session_state (src/backend/workshop/state.py:27-39 @7329736) does NOT credit the use_case_selection gate when the record has industry AND use_case. The SPA writes its own step-1 tag `usecase_selection` (App.tsx stepNumbersToGates; the #97 F4 finding), never `use_case_selection`. Today only genie-accelerator's prd_generation requires `use_case_selection`. After the hoist, EVERY track's prd_generation would, so an SPA-started session on e.g. lakehouse with intent defined could flip prd_generation from reachable to Blocked on both surfaces (the outline endpoint routes.py:5400 and MCP use build_session_state). That would be a regression for SPA users. lakebase.py:1798 `_has_defined_intent` already treats industry AND use_case as step-1 credit for the SPA's global step sets (GAP 2), so the shipped code has an intent-credit rule; the engine state lacks it.

## Change 0 — the intent-credit bridge (D-34)
In build_session_state: if the record has a non-blank industry AND a non-blank use_case (the same test as lakebase._has_defined_intent; reuse it or share one helper, don't duplicate the rule), append engine.USE_CASE_GATE to completed_gates if it's absent (idempotent; never removes; doesn't touch captured_outputs: use_case_brief stays absent, and consumers get the assembler placeholder, D3 §6). This applies to every track. Consequences to verify and pin:
- MCP no longer shows the intent beat for a session whose intent is already defined (this likely resolves the queued usecase-beat-current-mismatch and start-track-usecase-resolved-null; re-check both and say so).
- D-13/D-15: an unknown use case is never written to the use_case column, so the bridge can't credit an unknown pick (pin it with a test).
- No write: the bridge is read-side only; persistence happens only through existing writers.

## Changes 1–4
1. scripts/generate_manifest.py: move the use_case_brief entry for prd_generation (source step 3) out of GENIE_CHAINING_LITERAL_OVERRIDES into a SHARED override applied to EVERY track whose define-usecase section contains prd_generation; likewise move "prd_generation": "use_case_selection" out of GENIE_REQUIRES_GATE_OVERRIDES into a shared requiresGate override. The other genie-only chaining entries (11, 17, 71, 72: table_metadata / metric_view / aibi_dashboard) stay genie-only. Update the comments (the "phantom consumes" concern no longer applies: the brief exists on every track once the use case locks).
2. Regenerate src/backend/workshop/manifest.json by running the script (don't hand-edit). The expected diff is ONLY prd_generation `consumes: ["use_case_brief"]` and `requiresGate: "use_case_selection"` on each non-genie track that has prd_generation (list them; skills-accelerator has no prd_generation per tracks.md). genie-accelerator's entries are byte-identical. Any other manifest diff → STOP and report.
3. engine.py: no change expected (the primitive is track-agnostic). If Change 0 can't live in state.py, say why.
4. db/lakebase/dml_seed/02_seed_section_input_prompts.sql row 958 (use_case_selection, ≈:112): make the body track-agnostic. Remove Genie-specific wording; keep the D11 §3.3 artifact shape the lock produces (industry, industry_label, use_case, use_case_label, and description for a custom one). Per D-14 this edits the seed FILE only (fresh installs, template clones, Phase 4 reseeds of an empty table); the LIVE row 958 isn't overwritten by a reseed (duplicate-PK skip) and is a HUMAN follow-up via the admin prompt UI (record it in the PR body and decisions). No other seed row is edited. The genie gate (FORGE/tools/genie_gate_diff.py) must exit 0.

## Tests (new file tests/workshop/test_usecase_hoist.py, plus the existing parity suites unchanged)
- H1 manifest: for every track whose define-usecase section has prd_generation, it has consumes ⊇ ["use_case_brief"] and requiresGate == "use_case_selection"; genie-accelerator's manifest section is byte-identical to 7329736 (compare the JSON subtree).
- H2 generator: running generate_manifest.py reproduces the committed manifest.json exactly (if an existing test already pins that, cite it instead).
- H3 SPA-shaped sessions, BEFORE vs AFTER, per track (all 14): a record with industry+use_case set, completed_gates from the SPA (e.g. ["usecase_selection", "project_setup"]) and NO use_case_selection → engine.outline statuses and engine.next_step at 7329736 (computed by loading the base manifest via `git show 7329736:src/backend/workshop/manifest.json` and the base state.py behavior) EQUAL those at HEAD, i.e. no SPA regression. If an exact before/after comparison is impossible for a track, assert prd_generation is reachable (not Blocked) after project_setup at HEAD whenever intent is defined.
- H4 bridge: intent defined → the gate credited (idempotent); intent absent or blank → not credited; an unknown use case (D-15: the column isn't written) → not credited; captured_outputs untouched.
- H5 MCP parity: for each track, the MCP state-resource outline == engine.outline(track, state) used by the outline endpoint, for (a) a fresh MCP session after the lock and (b) an SPA-shaped session.
- H6 the intent beat: vibe_get_step on an SPA-shaped session with intent defined does NOT return the intent beat (Change 0 consequence).
- The existing tests are expected green unchanged. If any fails, STOP and report (no amendments are pre-authorized in this task).

## Fence
scripts/generate_manifest.py (trunk) · src/backend/workshop/manifest.json (trunk, regenerated) · db/lakebase/dml_seed/02_seed_section_input_prompts.sql (trunk, row 958 body only) · src/backend/workshop/state.py (Change 0) · src/backend/services/lakebase.py ONLY if you extract the shared intent helper there (no behavior change) · tests/workshop/test_usecase_hoist.py (new) · docs/superpowers/plans/2026-10-05-p4-usecase-hoist.md (new) · docs/superpowers/decision-log.md (D-33, D-34). Not mcp_server.py, routes.py, engine.py (unless justified), or the frontend.

## Acceptance
- H1–H6 green; all existing tests green unchanged; the manifest diff exactly as change 2 states; genie_gate_diff exits 0.
- Backend suite ≥ 814 + new, 0 failed. 7 tools.

## Green gates
- cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 814 + new, 0 failed.
- Seed changed: git -C <worktree> show origin/feature/genie-code-mcp-integration:db/lakebase/dml_seed/02_seed_section_input_prompts.sql > $FORGE/work/p4-usecase-hoist-base.sql; python3 $FORGE/tools/genie_gate_diff.py --base-ref origin/feature/genie-code-mcp-integration --base-seed $FORGE/work/p4-usecase-hoist-base.sql --head-seed <worktree>/db/lakebase/dml_seed/02_seed_section_input_prompts.sql --work $FORGE/work/p4-usecase-hoist-genie → exit 0.
- `python3 scripts/generate_manifest.py` (however the repo invokes it) leaves no diff after the commit.

## Live checks (for the critic to finalize)
After the deploy + reseed: (L1) the deployed state.py / manifest.json sha256 = git. (L2) For lakehouse and app-only: an SPA-shaped session (created through the SPA REST path with industry+use_case saved and project_setup completed, no MCP lock): GET /api/track/{track}/outline shows prd_generation reachable as before (compare its status with a pre-deploy capture if available, else assert not locked behind an unmet gate), and the MCP outline == the SPA outline. (L3) A fresh MCP session on lakehouse: vibe_start_track with a curated pair → no intent beat when the pair is resolved, prd_generation reachable after project_setup, and its prompt renders with the use case. (L4) genie-accelerator unchanged (outline parity 24/24). (L5) The reseed applied without error; the live row 958 is unchanged (expected, D-14), noted as the human follow-up. (L6) 7 tools; 0 ERROR/Traceback.

## Decision text (append to decision-log.md)
D-33 (2026-10-05) · D11 open q1, how to hoist use_case_selection across tracks · Rule (2)/(3): author the hoist ONCE as shared generator overrides in scripts/generate_manifest.py (prd_generation consumes use_case_brief + requiresGate use_case_selection on every track that has it), regenerating manifest.json; no manifest restructure. Genie's other chaining overrides stay genie-only · Reverse: move the two entries back into the GENIE_* tables and regenerate.
D-34 (2026-10-05) · Hoisting the gate would block prd_generation for SPA sessions, which record `usecase_selection`, not `use_case_selection` · Rule (1), shipped code decides: lakebase._has_defined_intent already treats industry AND use_case as step-1 credit; build_session_state now credits USE_CASE_GATE on the same rule (read-side, idempotent, every track) · Reverse: remove the credit from build_session_state.
