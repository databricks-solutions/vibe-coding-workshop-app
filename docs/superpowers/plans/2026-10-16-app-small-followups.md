# app-small-followups — plan r0.1 (2026-10-16; critic ACCEPT r1, folded below)

repo=app · base origin/feature/genie-code-mcp-integration dc848dc (#163–#165 session linking merged; MCP = 10 tools)
PR plan path: docs/superpowers/plans/2026-10-16-app-small-followups.md
Status: PLAN ONLY. Build only after the human signs (D-210).
Hands-off (D-207/D-210): mcp_server.py, App.tsx, LevelSelector.tsx, PathAndArchitecture.tsx,
CodingAssistantSelector.tsx, track_*.py — none edited; tests may READ App.tsx only if needed (none planned).

## Items (line numbers re-checked at dc848dc)
C1. `src/constants/workflowSections.ts:267-268` comment: "includeGenieOntology === false (the default) disables the
    ontology steps." Stale since D-143/#147/#148: new sessions take ontology from VIBE_DEFAULT_GENIE_ONTOLOGY
    (default "true"); the manifest flag default stays false (R2) and an absent stored flag means off for resumed
    sessions. Rewrite the comment to say exactly that. Comment only.
C2. `src/constants/workflowSections.ts:340-343`: the comment lists "semantic-layer, genie-agent, genie-ontology,
    genie-activate" (R7 order) while the `sectionIds` array at :343 still reads
    `[..., 'genie-agent', 'genie-activate', 'genie-ontology', ...]` (pre-R7). The comment says display order
    follows WORKFLOW_SECTIONS, not this array.
    Default action: COMMENT ONLY — state that the array is a membership set and that order comes from
    WORKFLOW_SECTIONS declaration order (genie-ontology declared before genie-activate since #146).
    r0.1 (critic b): the array order IS consumed — scripts/generate_manifest.py:358 extracts sectionIds and the
    union order lands in manifest.json; reordering would break manifest byte-parity. So C2 is COMMENT ONLY, and the
    comment must say the array order feeds generate_manifest's union (it is not display order) and must not be
    reordered without regenerating the manifest. Q1 is answered: comment only.
    (superseded) Reorder the array ONLY if the critic proves no consumer depends on its order AND every pinned outline/golden is
    unchanged; otherwise leave it (question Q1).
C3. `app.yaml.template:114`: "Default off; see docs/specs/mcp_design/." contradicts `value: "true"` at :116.
    app.py:35 treats unset as off. Rewrite: "app.py treats an unset value as off; this template turns it on".
    Comment only; value unchanged.
P1. Test pin `tests/workshop/test_llm_defaults_pin.py` (new): `llm.SERVING_ENDPOINT_NAME` default (env unset) ==
    "databricks-claude-sonnet-5-5"; `llm.FALLBACK_ENDPOINTS` == the exact 8-entry list at llm.py:43-52 (equal to
    main ec50e37's, per #158 review). Import with DATABRICKS_SERVING_ENDPOINT cleared (monkeypatch + reload) so a
    developer env var can't mask a default change.
    r0.1 (critic d): NO importlib.reload — it resets llm._workspace_client / _available_endpoints_cache and breaks
    the routes.py re-export identity checks (test_llm_service.py REEXPORTED). Instead import llm in a SUBPROCESS
    (sys.executable -c, env without DATABRICKS_SERVING_ENDPOINT, LAKEBASE_HOST empty, DATABRICKS_CONFIG_FILE=/dev/null)
    and print the two values as JSON; the test compares them.
P2. Test pin for `src/components/BundleUpdateNotice.tsx` (main's code, no tests): new
    `tests/frontend/BundleUpdateNotice.node.test.ts`, source-level (the helpers are module-private and exporting
    non-components from a .tsx trips react-refresh/only-export-components, as library-lint found):
    - the bundle regex extracts `/assets/index-<hash>.js` from a sample `<script src=...>` and returns null for
      a Vite-dev page with no hashed bundle (component returns early, :18);
    - the poll interval is 45_000 ms (:36) and the check URL carries `_bundle_check` with `cache: 'no-store'` (:24);
    - same bundle → no notice; different bundle → notice (logic extracted from source text and evaluated, as
      genieDefaultSession.node.test.ts does).
    No change to BundleUpdateNotice.tsx.
D1. Decision log: append to docs/superpowers/decision-log.md every forge decision missing from it (forge
    state/lead/decisions.md ∖ APP log; critic-confirmed: D-197, D-198, D-199, D-205..D-210, plus any newer at build), verbatim, NO renumbering;
    D-200..D-204 are the human's and stay as they are. List the copied ids in the PR body.

## Acceptance
- A1 scope: workflowSections.ts (comments; array only if Q1 = reorder), app.yaml.template (comment), the two new
  test files, decision-log.md, the plan file. Nothing else; no hands-off file.
- A2 comment text matches the code it describes (cite file:line in the PR body for each claim).
- A3 app.yaml.template parses; the MCP_MOUNT_ENABLED value is still "true"; test_app_template_env.py green.
- A4 P1 red if the default or any fallback entry/order changes; P2 red if the regex, interval or compare logic changes.
- A5 every pinned outline / golden / PARITY file unchanged (git diff --stat on tests/ shows only the 2 new files).
- A6 green gates: canonical backend suite floor 2120 passed / 0 failed (+ new tests) and root tests 10/0
  (release-notes tests pass since #160; floor 2130 total) — re-measure the floor at dc848dc first and use it if
  higher; frontend: npm ci, tsc -b, vite build, frontend node tests (`node --experimental-strip-types --test tests/frontend/*.node.test.ts`) (≥ current count + 1), ESLint 0 errors.
- A7 MCP still 10 tools (descriptions untouched); D12 web byte-identity unchanged.

## Tampers
- T1 change FALLBACK_ENDPOINTS order in llm.py → P1 red.
- T2 change SERVING_ENDPOINT_NAME default → P1 red.
- T3 change the 45_000 interval in BundleUpdateNotice.tsx → P2 red.
- T4 break the bundle regex (drop `-[\w-]+`) → P2 red.
- T5 reorder the genie-accelerator sectionIds array → manifest freshness / parity test red (proves C2 stays comment-only).
- (critic T5-T8 in specs, which edit the new tests' own expectations, are not used: they cannot fail for a code change.)

## Questions for sign-off
- Q1 C2: comment only (recommended) or reorder the array if the critic proves it inert?

## SIGNED (human, 2026-10-16, D-213) — r1
- Q1: C2 COMMENT ONLY (the array order feeds generate_manifest.py:358).
- A6 floor at dc848dc: 2261 total = 2251 canonical (tests/workshop + tests/api) + 10 root, 0 failed; re-measure
  first and use the higher number.
- D1: copy D-197..D-199 and D-205 onward verbatim from FORGE state/lead/decisions.md, no renumbering;
  D-200..D-204 stay the human's.
- Hands-off session-linking files unchanged (none in scope). Build, review + gate, merge only; no deploy.
