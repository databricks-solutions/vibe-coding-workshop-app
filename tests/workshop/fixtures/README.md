# Manifest golden fixtures

These ordered-tag fixtures are a FROZEN reference captured from the read-only
source of truth that used to live in `src/constants/workflowSections.ts`. They
were produced by node dump helpers that executed the real `getFilteredSections`
and `getDisabledTagsForGenieOntology` functions. **`getFilteredSections` and
those dump helpers were retired in Phase 3 T4b**, so these fixtures are now a
permanent, non-regenerable reference — they never used `generate_manifest.py`,
imported the Python loader, started a server, or required workspace access.

From the repository root, regenerate the manifest only with:

```bash
python scripts/generate_manifest.py
```

The golden fixtures below are FROZEN and are no longer regenerable (their
`getFilteredSections` oracle was removed in T4b). The live engine is validated
against them in `tests/workshop/`; do not hand-edit them.

`golden_order_genie_default.json` is the flattened `sectionTag` order with
`includeGenieOntology` at its source default (`false`).
`golden_order_genie_ontology_on.json` is the same full ordered set with the
three `GENIE_ONTOLOGY_TAGS` retained, proving flag filtering preserves their
source positions.
`golden_define_usecase_by_track.json` maps every `WORKSHOP_LEVELS` track to the
`sectionTag` order of its `define-usecase` section, taken from the same
`getFilteredSections` dump. It proves the D11 `use_case_selection` step (source
step 70) is present for `genie-accelerator` only and absent from every other
track (and that `skills-accelerator` still drops PRD too).

## Outline parity matrix (Phase 3 T2)

`golden_outline_matrix.json` is the full `engine.outline()` vs the FROZEN
`getFilteredSections()` reference matrix — all 14 tracks x every legal flag/axis
combo. `PARITY_MATRIX.md` is its human-readable companion. Both were captured
from the now-retired `dump_outline_matrix.mjs` oracle (removed in Phase 3 T4b)
and are frozen; they are no longer regenerable.

The `ts` column of each cell is the FROZEN `getFilteredSections()` reference
ordered `sectionTag` sequence (never derived from `generate_manifest.py` or
`manifest.json`). The `engine` column mirrors `manifest.outline_order` at
capture and is independently re-verified against the LIVE Python
`engine.outline()` in `tests/workshop/test_outline_parity.py`. `status` is
`parity` when the two orders match, else `gap`.

As of Phase 3 T3a every enumerated cell is engine-expressible and hard-asserted
parity — a mismatch is a real engine drift finding. Since the oracle was retired
in T4b, `test_outline_parity.py` no longer re-runs a node dump; instead
`test_live_engine_reproduces_frozen_golden_cell_for_cell` asserts the LIVE
engine still reproduces this frozen reference cell-for-cell (a tamper on either
the engine or the frozen golden fails it).

## Chaining source

`golden_chaining_genie.json` is a full-track 31-step `consumes` map for the
Genie Accelerator. Every row is independently hand-derived from the per-step
`previousOutputs` literals in `src/components/WorkflowDiagram.tsx`, which is
the authoritative chaining source, and source step numbers are translated to
`sectionTag` values using `src/constants/workflowSections.ts`.

The one exception to the `WorkflowDiagram.tsx` derivation is `use_case_brief`:
it is a D11 engine-only artifact with no SPA diagram arrow, consumed by
`prd_generation`. Its producer, `use_case_selection`, was retired as a numbered
outline step and is now resolved PRE-JOURNEY (mirroring the App's step 1 "Define
Your Intent"): the MCP engine writes `use_case_brief` up front via
`resolve_use_case`, so no numbered step produces it and `use_case_selection` is
NOT a key here. `prd_generation`'s `["use_case_brief"]` row mirrors
`GENIE_CHAINING_LITERAL_OVERRIDES[3]` in `scripts/generate_manifest.py`, which is
the authoritative source for this consume (re-pointed 70 -> 1, the pre-journey
producer's identity).

The shared `geniePreviousOutputs` value is undefined for grouped ontology steps
67–69, so `ontology_domain`, `ontology_pages`, and `ontology_routing` correctly
have empty `consumes` lists and no D3-specific handoff carve-out. Case 73 is
also taken directly from `WorkflowDiagram.tsx`: `activation_wire_genie` consumes
`activation_wire_lakebase`. `src/utils/stepPreviousOutputs.ts` is only an
incomplete mirror whose switch stops at case 72. The fixture is not generated
from `manifest.json`.
