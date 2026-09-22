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

Manifest `consumes` values are hand-transcribed from the actual
`previousOutputs` literals in `src/components/WorkflowDiagram.tsx` and their
mirror in `src/utils/stepPreviousOutputs.ts`. The generator stores those
literals as consumer-step-number to `{ keyName: producerStepNumber }` entries,
then translates producer numbers to `sectionTag` records parsed from
`workflowSections.ts`. `produces` is reverse-derived only when one of those
literal keys references the step; it is otherwise `null`. The Genie wrapper
literals are at `WorkflowDiagram.tsx:1066-1083`. The ontology handoffs remain
the established manifest contract required by D3 and are kept explicitly
separate from the wrapper literal table.
