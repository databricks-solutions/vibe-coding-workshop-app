# Manifest golden fixtures

These ordered-tag fixtures are derived from the read-only source of truth in
`src/constants/workflowSections.ts`. The generator statically reads
`WORKSHOP_LEVELS`, `WORKFLOW_SECTIONS`, `ALL_STEPS`, `CHAPTER_VISIBILITY`, and
`GENIE_ONTOLOGY_TAGS`, then mirrors the `getFilteredSections` filtering rules.
It does not import the frontend, start a server, or require workspace access.

From the repository root, regenerate both the manifest and the fixtures with:

```bash
python scripts/generate_manifest.py --write-fixtures
```

The manifest-only regeneration command is:

```bash
python scripts/generate_manifest.py
```

`golden_order_genie_default.json` is the flattened `sectionTag` order with
`includeGenieOntology` at its source default (`false`).
`golden_order_genie_ontology_on.json` is the same full ordered set with the
three `GENIE_ONTOLOGY_TAGS` retained, proving flag filtering preserves their
source positions.
