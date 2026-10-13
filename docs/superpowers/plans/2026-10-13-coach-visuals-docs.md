# Plan: coach-visuals-docs (D12 PR 3, docs)

- Repo: app (databricks-solutions/vibe-coding-workshop-app)
- Base: origin/feature/genie-code-mcp-integration @ 88135f8 (PR #135 twins + PR #136 coach visuals, both merged)
- Plan path in the PR: docs/superpowers/plans/2026-10-13-coach-visuals-docs.md
- Spec: docs/specs/mcp_design/mcp-workshop-coach-visuals.md §5 PR 3, §6.3, Appendix A. The spec file itself is NOT edited (sha256 67e6cde0...726e stays).
- Test floor: 1891 passed / 0 failed. This is docs only, so the suite must stay exactly green.

## Rule for every edit (D-101)
The docs describe the SHIPPED code at 88135f8. Where shipped code differs from the D12 spec, the docs follow the code and cite the decision:
- D-92: the 385-char description;
- D-93: key_label;
- D-94: the progress frontier and caption;
- D-95: the curated diagram only when served;
- D-96: the cache key;
- D-98: the caption denominator;
- D-84: the diagram-only twin caption;
- D-89: per-fence fallback.
Every behavioural statement cites a file:symbol at 88135f8. No new normative behaviour is invented in docs.

## File fence (exhaustive)
1. docs/specs/mcp_design/mcp-interface-contract.md (D2)
2. docs/specs/mcp_design/mcp-workshop-interactivity.md (D1)
3. docs/specs/mcp_design/README.md
4. docs/specs/mcp_design/mcp-workshop-test-plan.md (D8)
5. docs/superpowers/plans/2026-10-13-coach-visuals-docs.md (this plan, byte-identical to FORGE/state/lead/plans/coach-visuals-docs.md)
6. docs/superpowers/decision-log.md (append D-99..D-101 from FORGE/state/lead/decisions.md)

NOT touched: any code, test, seed, DDL or frontend file; the D12 spec; docs/superpowers/genie-code-smoke-script.md; any other mcp_design doc. Line 171 of mcp-interface-contract.md (the queued `next_step` wording follow-up) is NOT fixed here.

## Edits

### 1. D2 mcp-interface-contract.md
(a0) NEW §3.8 `vibe_explain_step` *(shipped 2026-09-27; Phase 2A coaching; D12 coach visuals 2026-10-13)* (revised D-99, critic r1). Insert it after §3.7 and before the `---` that precedes §4. It is the full IDL of the SHIPPED tool, in the §3.x style (description as prompt, inputSchema jsonc, outputSchema jsonc, annotations, errors, maps-to):
- Description: verbatim from mcp_server.py.
- inputSchema: session_id (required), sectionTag, focus (enum what_now|why|unblock|review), visual (enum auto|none|table|diagram).
- outputSchema: StepHelpResult with EVERY field as shipped (mcp_server.py class StepHelpResult): sectionTag, title, why, how_to_apply, expected_output, coaching, focus, grounded_on, is_fallback, visual, visual_kind, visual_caption; additionalProperties false.
- Annotations: as registered (readOnly true, destructive false, idempotent true, openWorld true).
- Errors: INVALID_PARAMETER (bad focus or visual), INVALID_SESSION, UNKNOWN_STEP, and the blocked-step error as returned by vibe_explain_step at 88135f8.
- Maps to: mcp_server.vibe_explain_step, coaching.coach, coach_visuals.build_visual, assembler render_target="mcp".
In §3.7, add ONE line directly under its heading: "> Shipped as `vibe_explain_step` (§3.8; §9 Phase 2A amendment). This section is the historical coaching contract." Nothing else in §3.7 changes.

(a) §3.8 also carries the D12 specifics, under a sub-heading "D12 coach visuals (2026-10-13)":
- the shipped description, verbatim (mcp_server.py vibe_explain_step description, 385 chars), noting that it replaces the 2026-09-27 wording to stay inside the 200-400 bound (D-92);
- an inputSchema delta in the same jsonc style as §3.7: `"visual": { "type": "string", "enum": ["auto","none","table","diagram"], "description": "..." }`, optional; the default is auto when focus is set and none otherwise (spec §3.4); an invalid value gives INVALID_PARAMETER;
- an outputSchema delta: StepHelpResult gains `visual` (string|null), `visual_kind` ("table"|"diagram"|null) and `visual_caption` (string|null), with extra="forbid" kept;
- the selection matrix (spec §3.4), reproduced as a table, plus "a visual without focus makes no model call";
- fail-open: any visual error gives a null triple, never a tool error;
- the kill switch VIBE_COACH_VISUALS_ENABLED;
- the MCP twin swap: render_target="mcp", per-fence fallback line, no raw Mermaid on MCP (PR 1, D-87/D-89).
Nothing existing in §3.7 is deleted or reworded (only the one pointer line is added).

(b) §12:
- §12.1: add a short note that on the shipped surface the coaching fields live on StepHelpResult (vibe_explain_step) and the D12 visual triple sits beside them. The jsonc CoachResult stays as the historical contract; no reword.
- §12.2: append to the quoted prompt's STYLE block the exact shipped sentence (coaching.py COACH_SYSTEM, last line), and a one-line note that it was added by D12. No other change to the quoted text, even where it predates shipped wording.
- §12.3: add a table row `visual` | "kind and caption only (`visual: <kind>, <caption>`), never the visual text" (coaching.py build_context). Then add notes on:
  - the cache key (session_id, sectionTag, focus, visual_kind or "none") (D-96);
  - the `visual=<kind|none>` field at the end of the `coaching timings` log line.

(c) §9 tool-budget: no edit needed (still 7 tools). If §9 or §0 states a field list for vibe_explain_step, add the triple there. Otherwise, no edit.

### 1b. Pre-existing Phase 2A drift: NOT fixed here (D-102)
D2 §2.2 (:85-86, ExplainabilityPayload still lists how_to_apply/expected_output), §6 (:414, `coach`), §8 (:442, `vibe_coach`), §10 (:491, `vibe_coach`), D1 §5 (:213, `vibe_coach`) and D9 :42 predate D12 and are covered by D2 §9's Phase 2A amendment. They are queued as contract-doc-phase2a-reconcile, together with the :171 next_step wording. PR 3 does not touch them, so it stays additive and D12-scoped.

### 2. D1 mcp-workshop-interactivity.md §4.6
Append one bullet, "**Inline visuals (D12):**". It says:
- the server builds one table or one ```text box-drawing diagram per call from manifest titles and output key names only;
- the model refers to it but never draws it (spec §1 F9);
- shape by focus as in D2 §3.7's D12 amendment;
- fail-open;
- the step help on MCP serves hand-converted twins instead of Mermaid.
Then add a link to the D12 spec. Nothing else in §4.6 changes.

### 3. README.md
- Add row 16 to "The series" table: `| 16 | [mcp-workshop-coach-visuals.md](./mcp-workshop-coach-visuals.md) | Spec (D12) | **Written (2026-10-13); PR 1 twins #135, PR 2 visuals #136 merged; PR 3 docs** | ... |`.
- Its "What it is" cell: Genie Code probe findings (Mermaid doesn't render; fenced box-drawing and markdown tables do), server-built inline visuals on vibe_explain_step, and MCP twins for the 36 seed Mermaid fences. Zero new tools, no DDL, no reseed.
- Match the style of rows 1-15.
- If D2's row 7 Status cell lists dated amendments, append "+D12 coach visuals 2026-10-13". Do the same for D1 row 6 and D8 row 12. No other README edit.

### 4. D8 mcp-workshop-test-plan.md
(a) Add a new subsection "### 8c. Coach visuals human smoke (D12)" after §8b (D-100). It contains:
- deploy from the integration branch;
- paste spec Appendix A, and include the prompt verbatim in a ````text fence, copied byte-for-byte from the spec;
- the spec §6.3 checklist, verbatim as checkboxes;
- a pointer that the re-probe (Appendix A) must be re-run after a Genie Code release before changing any spec §3.2 rule.
(b) §12 coverage matrix: add rows that point at the shipped test files:
- "No raw Mermaid on MCP; twins cover every seed fence (D12 §3.5)" → tests/workshop/test_mcp_visual_twins.py;
- "Coach visuals: matrix, firewall, fail-open, kill switch, no model call (D12 §3.4/§3.1/§3.7)" → tests/workshop/test_coach_visuals.py;
- "Web output unchanged by D12" → test_mcp_visual_twins.py web byte-identity.
Each file path must exist at 88135f8.

## Acceptance contract
- B1 Only the 6 fenced files change; git diff --check is clean; the D12 spec sha256 is unchanged.
- B2 Every quoted code string is byte-identical to its canonical source at 88135f8. The gatekeeper extracts each from source (not from the critic's line numbers) and greps the doc:
  - the description: the mcp_server.py vibe_explain_step decorator;
  - the COACH_SYSTEM sentence: coaching.py COACH_SYSTEM, last line;
  - the enum values: coach_visuals.py VISUALS and coaching.py FOCI;
  - the StepHelpResult field names: mcp_server.py;
  - the fallback line: visuals.py FALLBACK_LINE;
  - the caption prefix: visuals.py DIAGRAM_CAPTION;
  - the env var name: where visuals_enabled reads it in coach_visuals.py;
  - the log field: the coaching.py timings format string.
- B2b §3.8's field list equals the StepHelpResult model_fields at 88135f8 exactly (names and order), and its error codes are the ones vibe_explain_step can return at 88135f8.
- B3 Appendix A in D8 §8c is byte-identical to the spec's Appendix A fenced prompt, and the §6.3 checklist matches the spec's items in substance, in the same order.
- B4 Every file path and test file cited exists at 88135f8. Every "§" cross-reference resolves to an existing heading.
- B5 Nothing existing is deleted or reworded in D2 §3.7, D2 §12, D1 §4.6 or D8 §8b. Additions only; `git diff` shows no '-' lines in those sections other than whitespace-free context.
- B6 README row 16 exists, with 5 cells in the right style. The table still renders, with the same column count on every row.
- B7 Suite: 1891 passed, 0 failed (docs only, unchanged).
- B8 Decision log: D-99..D-101 appended.

## Tampers (gatekeeper; each must be detected by B1-B6)
- X1 Change one character of the quoted description in D2 → B2 FAIL.
- X2 Drop one line of Appendix A in D8 §8c → B3 FAIL.
- X3 Cite a non-existent test file in the coverage matrix → B4 FAIL.
- X4 Reword an existing D2 §3.7 sentence → B5 FAIL.
- X5 Edit the D12 spec file → B1 FAIL.
- X6 Give README row 16 four cells → B6 FAIL.
- X7 Omit `title` from §3.8's outputSchema → B2b FAIL.

## Revision r1 (critic BLOCK round 1)
- §3.7 was the wrong home on its own (titled vibe_coach, output CoachResult). The fix is a NEW §3.8 with the full shipped vibe_explain_step IDL, plus a one-line pointer in §3.7.
- B2 sources are named by symbol; B2b and X7 are added.
- The pre-existing Phase 2A drift is queued (D-102), not fixed here.

## Out of scope (queued)
- contract-doc-phase2a-reconcile: D2 :171 next_step wording + §2.2/§6/§8/§10 + D1 §5 vibe_coach references (D-102).
- Spec §8 q1-q4 stay open.
- vibe_submit_answer visuals (§8 q3).
