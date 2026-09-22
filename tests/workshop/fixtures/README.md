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

## Chaining source

`golden_chaining_genie.json` is a full-track 31-step `consumes` map for the
Genie Accelerator. Every row is independently hand-derived from the per-step
`previousOutputs` literals in `src/components/WorkflowDiagram.tsx`, which is
the authoritative chaining source, and source step numbers are translated to
`sectionTag` values using `src/constants/workflowSections.ts`.

The shared `geniePreviousOutputs` value is undefined for grouped ontology steps
67–69, so `ontology_domain`, `ontology_pages`, and `ontology_routing` correctly
have empty `consumes` lists and no D3-specific handoff carve-out. Case 73 is
also taken directly from `WorkflowDiagram.tsx`: `activation_wire_genie` consumes
`activation_wire_lakebase`. `src/utils/stepPreviousOutputs.ts` is only an
incomplete mirror whose switch stops at case 72. The fixture is not generated
from `manifest.json`.
