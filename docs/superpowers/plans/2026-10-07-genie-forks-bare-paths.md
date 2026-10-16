# genie-forks-bare-paths: v2 genie-code rows that root the bare paths in 15 genie-accelerator forks (D-57)

repo=app · base origin/feature/genie-code-mcp-integration after p4-agents-a-1009 merges (seed-02 serialization) · plan path in PR: docs/superpowers/plans/2026-10-07-genie-forks-bare-paths.md
Trunk files touched: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (15 additive rows). No src/, manifest or generate_manifest.

## Evidence (lead, read-only @7e4144d)
- #121's STOP hits (PENDING in tests/workshop/test_genie_family_genie.py): forks 932 semlayer_locate, 951 semlayer_profile, 952 semlayer_measures, 933 semlayer_metric_view, 953 semlayer_synonyms, 934 gagent_describe, 954 gagent_instructions, 955 gagent_verified, 956 gagent_benchmarks, 935 gagent_optimize, 940 gaccel_dashboard, 941 gaccel_activation, 936 ontology_domain, 937 ontology_pages, 938 ontology_routing read and write bare `docs/…` and `.vibecoding-state.md` (3-6 lines each), and none of them runs `vibecoding-state resolve_root`. E.g. 932: "Read `docs/design_prd.md` and `.vibecoding-state.md` first".
- The data-product forks on this track's outline (903, 924) name `<dp_bundle_root>/.vibecoding-state.md`, but those lakehouse steps are flag-filtered (includeLakehouse) and the activation steps have an app root, so no single hardcoded root is right for the 15 steps. The authority is TPL skills/vibecoding-state/SKILL.md:216-220 @edb07a9 (state-path rule: app_root → agent_app_root → dp_bundle_root → bootstrap path; bootstrap-create the canonical file if missing). 1017/114 carry the "Artifact root (client-aware)" block, resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root`, and write `<ARTIFACT_ROOT>/docs/…`.
- D-57: bare paths resolve against the page's CWD (TPL 07:19, field guide :133/:268/:294); correct shipped rows via additive `version = 2` rows (resolvers order active rows by version DESC; unique index per (tag, assistant, version)).

## Changes
S1 Seed 02: 15 new genie-code rows, input_id 1018-1032 in the order above (932→1018 … 938→1032), each placed right after its v1 fork, `version = 2`, is_active true, same section_tag / coding_assistant. Each v2 is a mechanics-only copy of its v1:
  - add, at the top of the body, 1017's "Artifact root (client-aware)" block byte-for-byte (it resolves `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root`), followed by ONE fixed sentence defining the state file (round 2, critic r1): "`<STATE_FILE>` = the live state file that `skills/vibecoding-state` resolves by its state-path rule (`<app_root>` → `<agent_app_root>` → `<dp_bundle_root>` → the bootstrap path, creating the canonical file if none exists yet), never `.vibecoding-state.md` relative to the page." Do NOT copy 903's `dp_bundle_root` definition (it depends on the data-product `enter` and the lakehouse steps, which are flag-filtered on this track);
  - every bare `docs/…` → `<ARTIFACT_ROOT>/docs/…`;
  - every bare `.vibecoding-state.md` → `<STATE_FILE>` (where v1 says the step "bootstraps" the state file, v2 says it bootstraps `<STATE_FILE>`);
  - nothing else: same gates, captured keys, require_prior_gate, {tokens}, wording (FORK_INTENT_PARITY with v1).
  v1 rows 932…938 are NOT modified.
S2 tests/workshop/test_genie_family_genie.py: FORK_ID maps the 15 tags to the v2 ids; the PENDING set becomes empty; a new G6 pins, per v2, that it equals its v1 after reversing exactly the S1 substitutions and removing the added root block (the 1017-vs-114 pattern); G3 marker lint then sees 0 bare docs/ and 0 bare state paths in served bodies.
S3 A served-version test (tests/workshop or tests/api, whichever already holds the version-resolution tests; add one if none): with both v1 and v2 active for a tag, the genie-code resolver serves v2, and the shared help fields still come from the Default row.
S4 test_seed_new_rows.py: only what 15 rows force (F02 +15, ledger +1018-1032, sequence 1018 → 1033).
S5 decision-log.md: append D-57 verbatim.

## STOP rules
- If a v1's bare path cannot be rooted mechanically (e.g. it is a path inside a generated file, or the target root is ambiguous), leave that tag on v1, keep it in PENDING with the reason, and report it; do not invent a root.
- genie_gate_diff: no audit key may grow; BARE_ARTIFACT_PATH-type findings should fall.

## Green gates
pytest tests/workshop tests/api ≥ floor; genie_gate_diff (base APP seed from origin) exit 0, no key growth.

## Tampers (anchor `(<input_id>, '<tag>', 'genie-code',`; restore each)
X1 in 1018, put back one bare `docs/design_prd.md` → G3 red.
X2 in 1025 (gagent_instructions v2), change one non-path word → G6 red.
X3 set 1032's version to 1 → the seed-load / unique-index test red (two active v1 rows for ontology_routing).
X4 delete the 1023 INSERT → FORK_ID / G2 red (gagent_describe served from v1 with bare paths).
X5 in the S3 test fixture, swap the resolver order to version ASC → S3 red.
X6 in 1030, replace one `<STATE_FILE>` with `.vibecoding-state.md` → G3 red.
X7 (round 2) in 1018, delete the `<STATE_FILE>` definition sentence → a new G7 red (every v2 that uses `<STATE_FILE>` defines it, byte-equal to the fixed sentence).

## Release
reseed=yes (15 inserted / 0 warnings, sequence 1018 → 1033).

## Live checks
L0 = the #121 L2 walk (session 1836632f…, per-step served shas).
L1 tables log `15 inserted / 0 warnings`, `sequence raised 1018 -> 1033`; ro DB: 1018-1032 present, version 2, active; v1 rows 932…938 still present and active.
L2 genie-accelerator genie-code walk to Done (L0 flags): 0 unexpected errors, 0 empty; the 15 steps served from 1018-1032 (sha ≠ L0) with 0 bare `docs/` and 0 bare `.vibecoding-state.md` (every state reference is `<STATE_FILE>`, defined once per prompt); every other non-LLM step = L0.
L3 outline-list hash MCP == /api == L0 at start/mid/Done.
L4 7 tools, /health 200, clean log.

## Reverse
Delete rows 1018-1032 (v1 serves again); restore PENDING.
