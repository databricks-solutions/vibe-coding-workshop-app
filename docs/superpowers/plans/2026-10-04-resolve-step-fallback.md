# resolve-step-fallback

## Ledger item (Phase 3 queue; engine.py:227-248 at 64f0772)
`engine.resolve_step(track, session, tag)` first scans the session's COMPOSED outline (`_ordered_steps`: flag-filtered and gate-rewired, Phase 3 T5 PR A). For a tag outside that outline (an explicitly requested flag-filtered step), it falls back to `MANIFEST.track_steps(track_id)`, the authored list. Its docstring calls this "the sole remaining direct track_steps read; no gate check may bypass the outline". The ledger asks to define this limitation and pin it with tests. It is docs plus tests, with NO behavior change.

## Change (no product-code behavior change)
1. Characterize, first and at base, what each MCP surface does for a flag-filtered tag T: a step authored on genie-accelerator but filtered out of this session's composed outline by a flag. Pick a real one from the manifest (e.g. a gaccel_* step filtered by an include_* flag, such as gaccel_dashboard) and name it. Record the results in a `## Findings` section of the plan file.
   - (a) vibe_get_step(T) and vibe_explain_step(T): which Step object is returned (authored), and its requiresGate.
   - (b) vibe_complete_step(T): does it complete, or return STEP_LOCKED / UNKNOWN_STEP? Does can_start read the authored, possibly dangling, requiresGate?
   - (c) Does completing T change engine.next_step or the outline for that session?
2. Pin exactly the observed behavior with tests in a new tests/workshop/test_resolve_step_fallback.py (R-F1..R-Fn), one per surface. Each test's docstring states the limitation in plain words.
3. Document the limitation in the resolve_step docstring (engine.py, trunk; the charter exception covers docstring/comment ONLY) and in docs/superpowers/decision-log.md as D-16 (2026-10-04) · "Explicitly requested flag-filtered steps resolve against the authored manifest; behavior pinned by test_resolve_step_fallback.py; no change. Rule (3), most reversible. · Reverse: delete the pins."
4. If the characterization finds a real DEFECT (e.g. completing a filtered step corrupts next_step, or can_start bypasses the outline's rewired gate, contradicting the docstring's "no gate check may bypass the outline"), do NOT fix it in this PR. Pin the current behavior with the test marked `xfail(strict=True, reason=...)`, and report it clearly so the lead can queue a fix.

Fence: src/backend/workshop/engine.py (docstring/comments only, with zero code-token diff), tests/workshop/test_resolve_step_fallback.py, docs/superpowers/decision-log.md, and the plan file.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 604 at this base plus the new tests, 0 failed (strict xfails count as passing). Lint ABSOLUTE (0 errors), build green, tools/list = 7.
- engine.py: `python -c` comparing `ast.dump(ast.parse(...))` with docstrings stripped, base vs head, must be identical. Include the command and its output in the PR body.
- Tampers (FORGE/state/specs/resolve-step-fallback/tampers.md), each verified and then restored byte-identically: T1 the fallback returns None → R-F1 red; T2 the fallback searches `ordered` instead of MANIFEST.track_steps → R-F1 red.
- Open a PR into feature/genie-code-mcp-integration titled "resolve-step-fallback: define and pin the authored-manifest fallback for filtered steps".

## Findings

Characterized at base 64f0772 with a default genie-accelerator session (no flags set, so `includeLakehouse` and `includeGenieOntology` are both off).

**Subject choice.** `gaccel_dashboard`, the plan's example, cannot be the subject: on genie-accelerator it has `flag: null` and is always in the composed outline. The subject is **T = `gold_layer_design`** (section "lakehouse", `flag: includeLakehouse`). Its authored `requiresGate` is `genie_silver_metadata`, which is also `includeLakehouse`-filtered, so the gate dangles in a default session. The ontology steps (`includeGenieOntology`) behave the same way. For example, `ontology_domain` (authored gate `gagent_optimize`, which is in the outline) returns STEP_LOCKED until `gagent_optimize` completes, then completes OK.

**(a) vibe_get_step(T), vibe_explain_step(T).** `engine.resolve_step` returns the authored Step object, equal to the `MANIFEST.track_steps` entry, with `requiresGate == "genie_silver_metadata"`. A filtered step has no outline copy, so no rewire applies to it.
- vibe_get_step gates on that authored gate. With `genie_silver_metadata` incomplete it returns STEP_LOCKED, "Complete genie_silver_metadata before this step." With the gate in `completed_gates` it renders the authored payload, `requiresGate: genie_silver_metadata`.
- vibe_explain_step does no gate check on any step, so it returns the authored step's help (`sectionTag`, `title`, `how_to_apply`, `expected_output`) even while the step is locked.

**(b) vibe_complete_step(T).** It returns STEP_LOCKED, never UNKNOWN_STEP, while `genie_silver_metadata` is incomplete. `can_start` reads the authored, dangling gate.
- A skip cannot satisfy that gate. `skipped_gates=["genie_silver_metadata"]` still gives STEP_LOCKED, because the gate is not an outline tag and `can_start`'s outline-membership rule rejects it.
- Completing the gate works. `genie_silver_metadata` is itself completable through the same fallback once `prd_generation` is done. After that, completing T succeeds.
- Assessment: this is NOT a bypass of the outline. No outline step's gate check reads an authored gate. Only the off-outline step uses its authored gate, because no outline copy of it exists.

**(c) Effect on the walk.** Completing T appends `gold_layer_design` to `completed_gates` and records its `produces` output (`captured_outputs["gold_layer_design"]`). `engine.outline` (tags and statuses) and `engine.next_step` are unchanged before and after (`semlayer_locate` in the probe), and so is vibe_next_step. Side note, not a defect: the recorded output key is one that outline steps `activation_table_design` and `activation_app_design` consume, so it becomes visible to them through `resolve_previous_outputs`.

**DEFECT found (pinned as strict xfail R-F6, not fixed).** vibe_get_step(T)'s payload `next` pointer is `{sectionTag: "", title: "Track complete"}` mid-track. `mcp_server._next_reference` looks T up in the composed outline, finds no index, and falls through to the end-of-track reference. Meanwhile vibe_next_step still answers `semlayer_locate`. The fix belongs in `mcp_server.py`, which is outside this fence (and PR #92 is in review there). It is queued for the lead.

**Pins.** tests/workshop/test_resolve_step_fallback.py:
- R-F1: resolve_step returns the authored step.
- R-F2: vibe_get_step.
- R-F3: vibe_explain_step.
- R-F4: vibe_complete_step.
- R-F5: the walk is unchanged.
- R-F6: strict xfail on the `next` pointer defect.
