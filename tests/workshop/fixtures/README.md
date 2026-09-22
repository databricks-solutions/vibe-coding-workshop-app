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
