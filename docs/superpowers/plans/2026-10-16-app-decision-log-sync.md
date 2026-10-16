# app-decision-log-sync — plan r0 (2026-10-16; human-ruled, D-222)

repo=app · base origin/feature/genie-code-mcp-integration d08cc0e
PR plan path: docs/superpowers/plans/2026-10-16-app-decision-log-sync.md
Status: SIGNED by the human's ruling (D-222; stands in for the critic, as D-109). Docs only.

## Change
Append to `docs/superpowers/decision-log.md`, after its last entry (D-213 at d08cc0e), verbatim from
FORGE `state/lead/decisions.md`, in the order they appear there and WITHOUT renumbering:
D-214, D-215, D-216, D-217, D-218, D-219, D-220, D-221, D-222, and any newer forge entry present at build time.
- D-221 is the #167 MCP strict owner decision (written from the facilitator guide §0/§4 and the #167 PR body;
  #167 left the D-number to the forge). D-219 is the lead's earlier record of the same merge; both go in as written.
- Existing entries (incl. the human's D-200..D-204) byte-identical.
- No other file changes except this plan file.

## Acceptance
- A1 scope: exactly decision-log.md + this plan (byte-identical to the FORGE copy).
- A2 the decision-log diff is append-only: the base file is a byte prefix of the head file (or the only change is
  lines added after the last entry); every appended entry is byte-identical to its FORGE line; ids listed in the
  PR body.
- A3 canonical backend suite + root tests: floor 2279 passed, 0 failed (2269 + 10) — re-measure at base, use the
  higher number.
- A4 frontend unchanged: no file under src/, tests/frontend/, package*.json changes (git diff --stat proves it);
  no build needed.

## Tampers
- X1 change one byte inside an existing entry (e.g. D-205) → A2 red.
- X2 renumber D-221 to D-223 in the appended text → A2 red (not byte-identical to FORGE).

## Release
Review + gate (light: A1–A4), merge only, no deploy. #130 left alone. Then report the new integration head and stop.
