# post-check-answerable

## Defect (verified at f97f813)
- `vibe_complete_step` (src/backend/mcp_server.py ~1599-1697) returns `post_check=_pending_post_check(sectionTag, state)` for the step it JUST completed (~1695). By then `engine.complete_step` has appended sectionTag to `state.completed_gates` (engine.py:280), so the engine's current step is the NEXT step.
- `vibe_submit_answer` (~1715-1790) builds `answerable = {current step tag} (+ the intent beat while _needs_use_case)` (~1736-1741) and rejects anything else with UNKNOWN_INTERACTION "not on the current workshop step".
- So the post check the server just told the agent to ask can never be answered. The #80 live probe saw 24 such errors across the 25-step genie-accelerator walk.
- Tests missed it: test_step_help_and_postcheck.py:194-205 answers prd_generation.check while still positioned ON prd_generation, never after completing it.

## Change (trunk file src/backend/mcp_server.py; charter exception accepted by plan_critic)
1. In `vibe_submit_answer`, after building `answerable`, also accept the interaction when ALL of these hold: `slot == "post"`, `interaction.type == "comprehension"`, and `section_tag in state.completed_gates` (name the condition `is_completed_post_check`). Comment: this is the post check that vibe_complete_step re-surfaces for an already-completed step. Nothing else widens: pre/decision/confirm interactions of completed steps, steps not yet completed, and locked steps (the Blocked case) stay UNKNOWN_INTERACTION. Re-answering overwrites the interaction_answered marker; it never touches completed_gates or decision keys.
2. The answered-marker path (~1776-1786) is unchanged, so `_pending_post_check` then returns None for that step.
3. Nit from the #83 review: reword the comment at mcp_server.py:1404-1405, "forge a skip (via either skip key)" → "forge a skip (or plant the retired skippedSteps alias)". Comment only.
4. docs/superpowers/decision-log.md: append these three entries in the file's existing one-line format (public register: say "the run brief", not "RUN.md"; no lead-internal notes):
   - D-4 (2026-10-04) · #80's live check failed only on its blanket "0 errors surfaced" clause, which two defects predating #80 tripped (the post-check answer rejected after complete; the use_case_selection intent beat rejected by explain/complete). Roll back per protocol, or keep? · Human decision: keep #80 deployed, treat its live check as PASS for #80's scope, and fix both defects as their own tasks. Future live checks scope error clauses to the PR's behavior. · The #80 probe report; `git diff bfe95a0 c280933 -- src/backend/mcp_server.py` changes behavior only on engine.Blocked. · Reverse: roll back merge c280933 (restores the bfe95a0 behavior; the two defects remain either way).
   - D-5 (2026-10-04) · Standing branch rule (human directive): no agent commits to, pushes to, or merges into main in either repo. Merges go only into feature/genie-code-mcp-integration (release role only); implementers push only forge/<slug> branches. Enforced locally by forge guards and by the rule restated in every dispatch; no GitHub-side change. · Human directive. · Reverse: only the human lifts it.
   - D-6 (2026-10-04) · Which completed steps' post checks are answerable? · Rule (3), most reversible: any completed step's post comprehension check, not only the most recent one, so a learner can answer late. · vibe_complete_step surfaces post_check for the completed step; vibe_submit_answer previously accepted only the current step. · Reverse: restrict the condition to `state.completed_gates[-1]`.

Fence: src/backend/mcp_server.py, tests/workshop/test_step_help_and_postcheck.py, docs/superpowers/decision-log.md, and the plan file. Zero diff elsewhere (engine.py, routes.py, manifest.json, db/, frontend).

## Tests (tests/workshop/test_step_help_and_postcheck.py)
- T-A: completing prd_generation via vibe_complete_step and then answering prd_generation.check via vibe_submit_answer → recorded=True, and the interaction_answered marker is saved.
- T-B: after T-A, _pending_post_check for prd_generation is None.
- T-C1: a PRE-slot interaction of a completed step is still UNKNOWN_INTERACTION (append_session_interaction not called, store unchanged). T-C2: the same for a decision/confirm interaction of a completed step. Keep these as separate tests so each tamper bites its own.
- T-D: the post comprehension of a NOT-yet-completed, non-current step is still UNKNOWN_INTERACTION.
- The existing test_vibe_submit_answer_on_blocked_is_unknown_interaction (test_blocked_safety_net.py:310) stays green unchanged.

## Acceptance contract
- Tampers in FORGE/state/specs/post-check-answerable/tampers.md: T1 drop the completed_gates condition → T-D red; T2 drop slot==post → T-C1 red; T3 drop the comprehension-type condition → T-C2 red; T4 disable the condition → T-A red. Verify each bites, then restore byte-identically.
- Required green gates: the backend pytest suite via the repo's documented invocation (floor 541 plus the new tests, 0 failed); frontend `npm run lint` and `npm run build` green (expected unaffected); MCP tools/list = 7.
- Open a PR into feature/genie-code-mcp-integration titled "post-check-answerable: accept completed steps' post comprehension answers", and report the PR number, head SHA and test counts.
