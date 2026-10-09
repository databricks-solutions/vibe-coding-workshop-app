# next-ref-filtered-step

## Defect (found by #93's characterization, pinned as strict xfail R-F6 in tests/workshop/test_resolve_step_fallback.py)
`vibe_get_step(T)` on an explicitly requested flag-filtered step T (e.g. `gold_layer_design` with includeLakehouse off, on genie-accelerator) builds its payload `next` with `mcp_server._next_reference(track, state, step)` (~:575-600). That helper orders against the composed outline (`engine._ordered_steps`), finds no index for an off-outline T, and falls through to `StepReference(sectionTag="", title="Track complete")`, mid-track. vibe_next_step still answers the real current step. An agent reading `next` from get_step would believe the track ended.

## Change (trunk file src/backend/mcp_server.py; charter exception accepted by plan_critic)
In `_next_reference`, after the intent-beat special case and before the "Track complete" fallthrough: when `step.sectionTag` is not in the composed outline (index is None), compute T's authored index in `engine.MANIFEST.track_steps(track)`, then iterate the composed outline IN OUTLINE ORDER and return the first outline step O with authored_index(O) > authored_index(T). If none, return "Track complete". The outline-member path and the intent-beat path are untouched. Rationale (put it in a comment): "next after this step" in the learner's track order, consistent with the outline's ordering on variant tracks (climb/reverse composition order differently from authored order), never pointing at another filtered step.

Fence: src/backend/mcp_server.py; tests/workshop/test_resolve_step_fallback.py (flip R-F6 from strict xfail to a passing test asserting the real next reference; nothing else in that file); a new tests/workshop/test_next_ref_filtered_step.py; docs/superpowers/decision-log.md (append D-17 (2026-10-04) · "get_step's next for an off-outline step points at the next outline step in the learner's track order (outline order, after the step's authored position). Rule (3). · Reverse: revert the branch." in the one-line public register, at the END of the file); and the plan file.

## Tests
- N1: filtered gold_layer_design → next is the first outline step authored after it. Name it in the test, derived from the manifest at test time or asserted as the concrete tag.
- N2: a filtered step authored after the last outline step → "Track complete" (construct it via a stub manifest or monkeypatch if no real case exists).
- N3: an outline step's next is unchanged, for a sample of steps including the last outline step → "Track complete".
- N4: the intent-beat next is unchanged (project_setup).
- N5 (variant-track ordering, non-monotonic): a session whose composed outline order differs from authored order, so that for a filtered T, the first outline step in OUTLINE order with authored index > T's is NOT the step with the smallest authored index > T's. Use a REAL composition if one is available on genie-accelerator (a session_parameters direction/climb/chainContext input that reorders the outline, cf. mcp_server.py ~:584-585). Otherwise monkeypatch `engine._ordered_steps` to return a deliberately reordered outline over real manifest steps. Assert the OUTLINE-order choice.
- R-F6 (flipped): passes, with the strict xfail marker removed.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 618 (617 passed + 1 xfailed at base) plus the new tests, 0 failed, 0 xfailed remaining. Lint ABSOLUTE (0 errors), build green, tools/list = 7.
- Tampers (FORGE/state/specs/next-ref-filtered-step/tampers.md; line numbers indicative), each verified and then restored byte-identically: T1 drop the off-outline branch → N1 and R-F6 red; T2 return the authored-next step without checking outline membership → N1 red; T3 break the outline-member path (index+2) → N3 red; T4 select by min authored index instead of outline order → N5 red.
- Open a PR into feature/genie-code-mcp-integration titled "next-ref-filtered-step: get_step's next for a filtered step points at the next outline step".
