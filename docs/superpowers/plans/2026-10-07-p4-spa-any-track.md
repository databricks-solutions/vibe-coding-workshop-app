# p4-spa-any-track: the Connect-to-Genie-Code panel names the start prompt for the session's track (P4.5, D-59)

repo=app · base origin/feature/genie-code-mcp-integration (latest) · plan path in PR: docs/superpowers/plans/2026-10-07-p4-spa-any-track.md
Trunk files touched: NONE (App.tsx, workflowSections.ts and mcp_server.py stay unchanged).

## Evidence (lead, read-only @7e4144d)
- Track choice is free already: DEFAULT_LEVEL_BY_ASSISTANT (src/constants/codingAssistants.ts:121-122, 'genie-code' → 'genie-accelerator') is applied in App.tsx handleCodingAssistantChange (:849-853) only when `!levelExplicitlySelected`, i.e. as a cold-start default. RUN.md P4.5 asks exactly that → no change.
- The instructions are pinned: src/components/ConnectToGenieCodePanel.tsx:82-86 renders "Then say ‘Start the Genie Accelerator’" from GENIE_ACCELERATOR_START_PROMPT (src/constants/genieCodeMcpConnection.ts:18). It is rendered with no props at WorkflowDiagram.tsx:3482, where `workshopLevel` is in scope.
- The MCP server has both prompts: "Start the Genie Accelerator" (mcp_server.py:2421-2439) and "Start a workshop track" (:2442-2468, args track / use_case / industry; an unknown or missing track returns the valid-track list).
- tests/e2e/connect-genie-code.spec.ts asserts the panel shows GENIE_ACCELERATOR_START_PROMPT and that the connection steps match D10 §2 (docs/specs/mcp_design/mcp-workshop-facilitator-guide.md).

## Changes
S1 genieCodeMcpConnection.ts: add `GENERIC_TRACK_START_PROMPT = 'Start a workshop track'` (byte-equal to the mcp_server.py prompt name) and a pure helper `startPromptForTrack(level: string | null | undefined): { prompt: string; track: string | null }` → genie-accelerator / empty / unknown-to-the-SPA → { GENIE_ACCELERATOR_START_PROMPT, null }; any other level → { GENERIC_TRACK_START_PROMPT, level }. Keep GENIE_ACCELERATOR_START_PROMPT and GENIE_CODE_MCP_CONNECTION_STEPS unchanged.
S2 ConnectToGenieCodePanel.tsx: optional prop `workshopLevel?: string`; render "Then say ‘<prompt>’" and, when `track` is set, " with track `<track>`" (the track id the MCP prompt expects; a display label may follow in parentheses if one exists in an existing non-trunk constant, otherwise the id alone). No other visual change.
S3 WorkflowDiagram.tsx:3482: pass `workshopLevel={workshopLevel}`. Nothing else in that file.
S4 Tests: a unit test for startPromptForTrack (genie-accelerator → GA prompt; '' / undefined → GA prompt; 'lakehouse' → generic + 'lakehouse'; every manifest track id other than genie-accelerator → generic), in whatever harness the repo already uses for src/constants (find it; if only pytest-driven node checks exist, follow that pattern); a pytest that every value startPromptForTrack can return as a prompt name equals an @mcp.prompt name in mcp_server.py (prevents drift); extend tests/e2e/connect-genie-code.spec.ts with the per-track case only if the e2e suite is part of a documented gate, otherwise leave e2e alone and say so.
S5 docs/specs/mcp_design/mcp-workshop-facilitator-guide.md D10 §2: one sentence after the three steps: on the Genie Accelerator say "Start the Genie Accelerator"; on any other track say "Start a workshop track" with the track id shown in the app. The three step strings stay byte-identical (the lockstep test).

## Green gates
pytest tests/workshop tests/api ≥ floor; `npm run build`; `npx eslint` on the changed .ts/.tsx files (0 errors).

## Tampers (restore each)
X1 make startPromptForTrack return the GA prompt for 'lakehouse' → S4 unit red.
X2 change GENERIC_TRACK_START_PROMPT to 'Start any workshop track' → the prompt-name drift pytest red.
X3 drop the workshopLevel prop at WorkflowDiagram.tsx:3482 → a render/unit check red (the panel shows the GA prompt on lakehouse), or, if no render harness exists, a static test that the call site passes workshopLevel.
X4 edit one of the three connection step strings → the D10 §2 lockstep test red.

## Release
reseed=no (frontend + docs only); code deploy.

## Live checks
L1 GET / serves the new bundle (the built asset hash changes); the panel HTML on a fresh session shows "Start the Genie Accelerator" (cold-start genie-code default).
L2 via the SPA API only: set a test session's workshop_level to lakehouse (POST /api/session/update-metadata, the walk session only), load the app for that session: the panel shows "Start a workshop track" and `lakehouse`. Use the embedded browser or a headless fetch of the rendered page; if the panel only renders client-side, drive it with the prober's browser tooling.
L3 MCP prompts/list still lists both prompt names; 7 tools; /health 200; clean log.

## Reverse
Revert the PR.
