# Manifest golden fixtures

These ordered-tag fixtures are an independent oracle derived from the
read-only source of truth in `src/constants/workflowSections.ts`. The fixture
dump helper executes the real `getFilteredSections` and
`getDisabledTagsForGenieOntology` functions. It does not use
`generate_manifest.py`, import the Python loader, start a server, or require
workspace access.

From the repository root, regenerate the manifest only with:

```bash
python scripts/generate_manifest.py
```

Independently regenerate the golden fixtures from the TypeScript source with:

```bash
node --experimental-strip-types scripts/dump_getfilteredsections.mjs
```

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

`golden_outline_matrix.json` is the full `engine.outline()` vs
`getFilteredSections()` parity matrix — all 14 tracks x every legal flag/axis
combo. `PARITY_MATRIX.md` is its human-readable companion (pass/gap table plus
the T3 reconciliation gap list). Both are emitted by the same oracle, which
uses the identical offline scaffold as `dump_getfilteredsections.mjs`:

```bash
node --experimental-strip-types scripts/dump_outline_matrix.mjs
```

The `ts` column of each cell is the REAL `getFilteredSections()` ordered
`sectionTag` sequence (never derived from `generate_manifest.py` or
`manifest.json` — that is the hollow side under test). The `engine` column
mirrors `manifest.outline_order` and is independently re-verified against the
real Python `engine.outline()` in `tests/workshop/test_outline_parity.py`.
`status` is `parity` when the two orders match, else `gap`.

Expressible axes (default forward order for all 14 tracks; the four
`genie-accelerator` flag combos) are hard-asserted parity — a mismatch there is
a real engine/TS drift finding, not a gap. Gap axes (`direction=reverse`,
additive-chain climb, AI-module sub-toggles, medallion sub-toggles) are the
axes the engine cannot yet express; they are enumerated with their concrete
diff and locked as the Phase 3 T3 reconciliation scope. Regenerate after any
change to `workflowSections.ts` or `manifest.json` and commit both files;
`test_oracle_regeneration_is_byte_identical` asserts the JSON is byte-identical
to a fresh dump.

## Chaining source

`golden_chaining_genie.json` is a full-track 31-step `consumes` map for the
Genie Accelerator. Every row is independently hand-derived from the per-step
`previousOutputs` literals in `src/components/WorkflowDiagram.tsx`, which is
the authoritative chaining source, and source step numbers are translated to
`sectionTag` values using `src/constants/workflowSections.ts`.

The one exception to the `WorkflowDiagram.tsx` derivation is `use_case_brief`:
it is a D11 engine-only artifact (Phase 2B) with no SPA diagram arrow, produced
by `use_case_selection` (source step 70) and consumed by `prd_generation`. Its
row here mirrors `GENIE_CHAINING_LITERAL_OVERRIDES[3]` in
`scripts/generate_manifest.py`, which is the authoritative source for this pair.

The shared `geniePreviousOutputs` value is undefined for grouped ontology steps
67–69, so `ontology_domain`, `ontology_pages`, and `ontology_routing` correctly
have empty `consumes` lists and no D3-specific handoff carve-out. Case 73 is
also taken directly from `WorkflowDiagram.tsx`: `activation_wire_genie` consumes
`activation_wire_lakebase`. `src/utils/stepPreviousOutputs.ts` is only an
incomplete mirror whose switch stops at case 72. The fixture is not generated
from `manifest.json`.
