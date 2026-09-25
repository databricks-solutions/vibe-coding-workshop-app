# D3 — Workshop Engine Domain Spec

**Status:** Draft · **Doc ID:** D3 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Promotes:** [`mcp-workshop-engine.md`](./mcp-workshop-engine.md) §4–§7 into a standalone, formal
domain spec.
**Series:** [`README.md`](./README.md) · governed by the probe constraints in
[`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe).
**Consumed by:** [D1 interactivity](./mcp-workshop-interactivity.md), D2 interface contract, D4
architecture, D6 data model, D8 tests.

> **Scope.** This spec defines the **backend domain** — the manifest, the progression functions,
> the assembler contract, the state model, and the anti-divergence guarantee. It is
> **transport-agnostic**: it says nothing about MCP or REST. Both adapters call these functions;
> neither contains workshop logic (roadmap "one engine, two thin adapters").

> **Behavior-identical mandate.** The only *net-new* logic here is the manifest + progression
> functions (§3, §5–§6). Everything touching prompt content (§7) is a **mechanical extraction** of
> existing code and MUST be byte-for-byte behavior-identical. A parity test enforces this (§9).

---

## 1. Anchors verified live (2026-09-22)

The roadmap's line anchors have drifted since 2026-09-19. **These are current; re-verify at build
time.**

| Symbol | Current location | Roadmap said |
|---|---|---|
| `get_section_input_content(...)` (the assembler) | `src/backend/api/routes.py:1241` | `:1201` |
| `get_section_input_template(section_tag, assistant_key)` (fork resolver) | `src/backend/api/routes.py:360` | — |
| Assembler return dict | `routes.py:1515–1526` | — |
| `previous_outputs` missing→placeholder | `routes.py:1351` | `:1310–1316` |
| `{prd_document}` default placeholder | `routes.py:1355` | — |
| `iterate_enhance` special `{industry}`/`{use_case}` | `routes.py:1341` | — |
| `getFilteredSections(level, disabledSectionTags, overrides?, direction?)` | `src/constants/workflowSections.ts:729` | `:722` |
| `disabledSectionTags` applied | `workflowSections.ts:825–829` | — |
| `getDisabledTagsForGenieOntology(...)` + `GENIE_ONTOLOGY_TAGS` | `workflowSections.ts:267` / `:257` | `:266–272` |
| `getNextIncompleteStep(...)` | `src/App.tsx:441` | `:441` |
| State: `stepPrompts: Record<number,string>`, `completedSteps: Set<number>` | `src/App.tsx:85–86` | `:85–86` |
| Chaining literals (source of truth) | `src/components/WorkflowDiagram.tsx` (mirror: `src/utils/stepPreviousOutputs.ts`) | same |

---

## 2. Namespaces (the golden rule, formalized)

Three **independent** identifier spaces. Conflating them is the #1 divergence bug.

| Namespace | Type | Owner | Role |
|---|---|---|---|
| `sectionTag` | string (e.g. `semlayer_locate`) | seed rows + manifest | **The only binding** between a step and its prompt content. All engine keys use this. |
| step `number` | int (e.g. `22`) | `workflowSections.ts` (`ALL_STEPS`) | Legacy UI ordinal + today's state/chaining key. **Not** equal to `sectionTag` or `input_id`. |
| `input_id` | int | Lakebase seed | DB row id. Never surfaced in domain logic. |

**Rule:** the engine keys **everything** — gates, captured outputs, chaining, outline — by
`sectionTag`. A **number↔tag map** exists only to bridge the legacy UI state during migration (§4.3).

### 2.1 Two orthogonal axes: composition vs content

A second conflation (distinct from the namespace one above) is treating "which steps" and "which
prompt body" as one dimension. They are **orthogonal**:

| Axis | What it decides | Encoded by | Resolved by |
|---|---|---|---|
| **Composition** — *which steps appear* | the `track` (a `WorkshopLevel`: `genie-accelerator`, `lakehouse`, …) plus its optional-chapter **flags** (`includeGenieOntology`, `includeLakehouse`) | `manifest.json` `tracks[…].sections[…].steps` + `flags` (§3) | `outline` / `next_step` flag filter (§5.1) |
| **Content** — *which prompt body a step renders* | the **`coding_assistant` fork** on the `section_input_prompts` row (`__default__` / `genie-code` / `coda`), keyed `(section_tag, coding_assistant, version)` | seed rows | the assembler's fork resolution (§7.2), reading `session_parameters.coding_assistant` or an explicit override |

Consequences worth stating so they are never re-derived under pressure:

- **There is no per-assistant track.** "Genie Code" is a *content fork* (and a client), **not** a
  `WorkshopLevel`. A phrase like "Genie Code has its own track" means *the composition a given
  adapter serves*, not a separate track row. When a request conflates the two, resolve it against
  this table before planning.
- The two axes are **independent**: switching the fork (`coding_assistant`) never changes which
  steps appear; toggling a flag never changes a step's prompt body.
- This spec is **transport-agnostic**: it does not pin a track or a fork. An adapter may pin both
  (e.g. the MCP adapter fixes `track = genie-accelerator` and `coding_assistant = genie-code` and
  leaves flags at their defaults) — that pinning is documented in the MCP series README, not here.

---

## 3. The Track Manifest

A declarative, generated description of a track. Single source of truth for order / gating /
chaining. Loaded by `src/backend/workshop/manifest.py`; data in `manifest.json`.

### 3.1 JSON Schema (draft-07)

```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WorkshopManifest",
  "type": "object",
  "required": ["version", "tracks"],
  "properties": {
    "version": { "type": "string" },                     // manifest schema version, e.g. "1"
    "tracks": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/Track" }  // keyed by trackId (WorkshopLevel)
    }
  },
  "$defs": {
    "Track": {
      "type": "object",
      "required": ["id", "title", "sections"],
      "properties": {
        "id":    { "type": "string" },                   // must equal the WorkshopLevel key
        "title": { "type": "string" },
        "assistants": { "type": "array", "items": { "type": "string" } },  // forks that exist; "default" always implicit
        "flags": {
          "type": "object",
          "additionalProperties": { "$ref": "#/$defs/Flag" }
        },
        "sections": { "type": "array", "items": { "$ref": "#/$defs/Section" } }
      }
    },
    "Flag": {
      "type": "object",
      "required": ["default"],
      "properties": {
        "default":      { "type": "boolean" },
        "affectsSteps": { "type": "array", "items": { "type": "string" } },  // sectionTags gated OFF when flag=false
        "note":         { "type": "string" }
      }
    },
    "Section": {
      "type": "object",
      "required": ["id", "title", "steps"],
      "properties": {
        "id":      { "type": "string" },                 // WORKFLOW_SECTIONS id, e.g. "semantic-layer"
        "chapter": { "type": "string" },
        "title":   { "type": "string" },
        "why":     { "type": "string" },                 // section-level motivation (narrative)
        "steps":   { "type": "array", "items": { "$ref": "#/$defs/Step" } }
      }
    },
    "Step": {
      "type": "object",
      "required": ["order", "sectionTag", "title", "execution", "surfaces"],
      "properties": {
        "order":        { "type": "integer" },           // engine order within the track (1-based, dense)
        "sectionTag":   { "type": "string" },            // THE prompt binding
        "title":        { "type": "string" },
        "why":          { "type": "string" },            // step motivation (narrative; not the prompt body)
        "gate":         { "type": ["string", "null"] },  // human-readable checkpoint description
        "requiresGate": { "type": ["string", "null"] },  // sectionTag that must be completed first, or null
        "consumes":     { "type": "array", "items": { "type": "string" } },   // captured-output keys read
        "produces":     { "type": ["string", "null"] },  // captured-output key written on completion
        "execution":    { "type": "string", "enum": ["agent-doable", "ui-driven", "hybrid"] },
        "surfaces":     { "type": "array", "items": { "type": "string", "enum": ["ui", "mcp"] } },
        "flag":         { "type": ["string", "null"] }   // name of the flag gating this step, or null
      }
    }
  }
}
```

### 3.2 Field semantics

- **`order`** — dense 1-based ordering *after* flag filtering is conceptually applied; but the
  manifest stores the **full** ordered set and the engine filters at read time (§5). Order is the
  flattened `getFilteredSections` sequence for the track (roadmap §4.2 table is the genie-accelerator
  instance).
- **`requiresGate`** — the single predecessor gate. Note the roadmap correction (§16): `gaccel_dashboard`
  requires `semlayer_metric_view`, **not** `gagent_optimize` — chaining ≠ linear order.
- **`consumes` / `produces`** — the chaining contract (§6). `produces` is written to
  `captured_outputs` on `complete_step`; `consumes` keys are resolved into `previous_outputs` for
  the assembler.
- **`execution`** — honesty flag (roadmap §10.4). `ui-driven` steps are **coached**, never
  auto-completed by an agent.
- **`flag`** — if set, the step is present only when the named flag is true. Mirror of
  `getDisabledTagsForGenieOntology` (`includeGenieOntology`) and the lakehouse tag filter.

### 3.3 Generation & anti-divergence (normative)

- `scripts/generate_manifest.py` emits `src/backend/workshop/manifest.json` from the current
  track definitions. Long-term source: a neutral `tracks.json` imported by both TS and Python;
  bootstrap by generating it from `workflowSections.ts` (roadmap §16). **The manifest is never
  hand-edited.**
- The generator must reproduce, per track, the exact output of
  `getFilteredSections(level, disabledTags, …)` flattened to an ordered `sectionTag` list, with the
  **default flag state — all optional-chapter flags OFF** (`includeGenieOntology` **and**
  `includeLakehouse`; add every future flag here too). A non-normative field bullet naming a flag is
  not enough — this normative rule is what CI reproduces, so it must list every default-off flag.
- **SPA↔manifest flag parity (normative).** Every level-scoped `getDisabledTagsFor*` toggle in
  `workflowSections.ts` (e.g. `getDisabledTagsForGenieOntology`, `getDisabledTagsForLakehouse`) MUST
  have a matching entry in that track's `flags` block, with the same default. The frontend toggle and
  the manifest flag are two encodings of one contract; adding a toggle on one side without the other
  is the divergence this section exists to prevent.
- **Track-scoped stamping (normative).** A flag is stamped on a step **only in the track(s) whose
  `flags` block defines it** (mirror the frontend's `LEVELS_WITH_*_TOGGLE` scoping). Several
  optional-chapter `sectionTag`s are **shared across tracks** (e.g. `gold_layer_design`,
  `gold_layer_pipeline`, `deploy_lakehouse_assets` also appear in `lakehouse`, `end-to-end`,
  `accelerator`, …). Stamping a flag on a track that does not define it makes `outline_order` treat
  the flag as an unknown default-false and silently drop the step there — a cross-track regression the
  genie-only parity fixtures do not catch. The generator applies optional-chapter flags only when
  `track_id == "genie-accelerator"`.
- See §9 for the parity contract that fails CI on drift.

---

## 4. Session state model

Reuses the existing session store (`POST /api/session/save`, `routes.py:5787`), keyed by
`session_id`. **Additive only** (roadmap §13); no new persistence engine.

### 4.1 Fields

| Field | Type | Key | Source today | Target |
|---|---|---|---|---|
| `completed_gates` | array of `sectionTag` | sectionTag | `completed_steps` (numbers, `App.tsx:86`) | **new** gate ledger, tag-keyed |
| `captured_outputs` | map `producesKey → text` | produces key | `step_prompts` (numbers, `App.tsx:85`) | **new** formalized chaining store |
| `session_parameters` | map (catalog, schema_prefix, flags, Lakebase instance, …) | param name | `/api/session/{id}/parameters` + `lakehouse-params` | unchanged |

### 4.2 Reads are per-request
Stateless MCP (roadmap "stateless MCP" rule): every engine call reads state fresh; nothing relies
on in-process caches for correctness.

### 4.3 Number↔tag migration (bridge)
Today `completedSteps`/`stepPrompts` are keyed by step **number** (`App.tsx:85–86`). The engine keys
by `sectionTag`. During Phase 0–2 keep a **number↔tag map**; the UI continues to read numbers, the
engine reads tags, and `complete_step` writes both. Flip to tag-only in Phase 3 (roadmap §14/§16).
**Interaction records** (D1 in-band answers, gate approvals) also land here — see D6.

---

## 5. Progression semantics (pure functions)

Pure functions over `(manifest, session_state)`; no I/O beyond the state read (roadmap §5). These
are the server-side port of `getFilteredSections` + `getNextIncompleteStep`.

### 5.1 `outline(track, session) → Step[]`
Returns the track's steps in engine order, each annotated with `status`.

```
status ∈ { "done", "current", "locked", "skipped" }
```

Algorithm:
1. Load the track's ordered steps from the manifest.
2. **Flag filter:** drop any step whose `flag` is set and false in `session_parameters`
   (default: `includeGenieOntology=false` drops `ontology_*`; `includeLakehouse` applies the
   lakehouse tag filter). Mirrors `getDisabledTagsForGenieOntology` (`workflowSections.ts:267`) and
   the `disabledSectionTags` drop (`:825–829`).
3. For each remaining step compute status:
   - `done` if `sectionTag ∈ completed_gates`;
   - else `current` if it is the first non-done step whose `requiresGate` is satisfied;
   - else `locked` if `requiresGate` is set and not in `completed_gates`;
   - `skipped` only if explicitly recorded skipped (legacy `skippedSteps`).

### 5.2 `next_step(session) → Step | {done:true}`
The first step in `outline` with `status == "current"`. If none remain, `{done:true}`. Port of
`getNextIncompleteStep` (`App.tsx:441`).

### 5.3 `can_start(step, session) → bool`
`true` iff `step.requiresGate` is `null` **or** `step.requiresGate ∈ completed_gates`. A step is
**locked** until its predecessor gate passes.

### 5.4 `complete_step(session, sectionTag, captured_output) → {completed_gates, next}`
1. Guard: `can_start` for the step must hold; else return an error result (no state change).
2. Guard: if `execution == "ui-driven"`, do **not** accept an agent completion silently — record a
   coached/handoff marker, not a false gate (roadmap §10.4). (D1 §11 defines the interaction.)
3. Append `sectionTag` to `completed_gates` (idempotent — set semantics).
4. If `produces` is non-null, write `captured_outputs[produces] = captured_output`.
5. Return the updated gate list and `next_step(session)`.

**Idempotency:** completing an already-completed gate is a no-op success (safe for stateless
retries).

---

## 6. Chaining resolution (`consumes` / `produces`)

Replaces the frontend `previousOutputs` literals (source of truth `WorkflowDiagram.tsx`, mirrored
in `stepPreviousOutputs.ts`) with manifest-driven resolution.

When assembling a step:
1. For each key in `step.consumes`, read `captured_outputs[key]` from the session.
2. Pass the resulting map as `previous_outputs` into the assembler (§7).
3. **Graceful degradation:** a missing key is left for the assembler's existing placeholder
   behavior — `value or "[No {key} provided …]"` (`routes.py:1351`) and the `{prd_document}` default
   (`routes.py:1355`). The engine never raises on a missing upstream output.

**Migration note.** Today's chaining is keyed by step **number** (e.g. genie step 11 consumes
`{table_metadata: stepPrompts[22], prd_document: stepPrompts[3]}`). The manifest re-expresses each
as `consumes: [<producesKey>]` on the tag-keyed step. The parity test (§9) must include a chaining
equivalence check for the genie track.

---

## 7. Assembler contract (reuse — behavior-identical)

Extract `get_section_input_content` (`routes.py:1241`) into `src/backend/workshop/assembler.py`
**unchanged in behavior**; both adapters import it. **No second assembler** (roadmap golden rule).

### 7.1 Signature (must be preserved)
```python
get_section_input_content(
    industry: str,
    use_case: str,
    section_tag: str,
    previous_outputs: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None,
    coding_assistant_override: Optional[str] = None,
) -> Dict[str, str]
```

### 7.2 Fork resolution (preserve exactly, `routes.py:1289–1318`)
`coding_assistant_override` (if non-empty) wins; else the session's coding assistant. The template
is `get_section_input_template(section_tag, assistant_key)` **or** `config[section_tag]` **or**
`config['default']`. The resolved variant (`fork` vs `default`) is returned as
`coding_assistant_variant`.

### 7.3 Token substitution (preserve order & set, `routes.py:1331–1362`)
In order: `{industry_name}`, `{use_case_title}`, `{use_case_description}`, `{section_tag}`; then the
`iterate_enhance`-only `{industry}`/`{use_case}` (`:1341`); then every `workshop_params` key; then
every `previous_outputs` key (missing→placeholder, `:1351`); then the `{prd_document}` default
(`:1355`). Brand injection applies only to the fixed section_tag set at `routes.py:1371–1373`.

### 7.4 Return shape (preserve, `routes.py:1515–1526`)
```python
{ "input", "input_template", "system_prompt", "how_to_apply", "expected_output",
  "how_to_apply_images", "expected_output_images", "bypass_llm",
  "_brand_url", "coding_assistant_variant" }
```

### 7.5 `bypass_llm` (the Genie Accelerator invariant)
Every Genie Accelerator seed row is `bypass_llm = true`: the assembled `input` **is** the verbatim
prompt (token-substituted), **no FM-API call**. The engine's explainability payload carries this as
`prompt`. This is the contract D1 wraps but never rewrites.

---

## 8. Explainability payload (engine → adapters)

Per step, the engine bundles (roadmap §6):

```jsonc
{
  "sectionTag": "semlayer_locate",
  "title": "Locate Data & Bring Context",
  "why": "…",                       // manifest step.why
  "prompt": "…",                    // assembler "input" (verbatim for bypass_llm)
  "how_to_apply": "…",              // assembler
  "expected_output": "…",           // assembler
  "gate": "Data located and genie_brief.md written",   // manifest step.gate
  "requiresGate": null,
  "consumes": ["prd_document"],
  "produces": "genie_brief",
  "execution": "agent-doable",
  "next": { "sectionTag": "semlayer_profile", "title": "Profile the Data" }
}
```

D1 adds an **optional** `interaction` block to this payload (in-band question/decision); see
[D1 §6](./mcp-workshop-interactivity.md). The base payload is unchanged whether or not interaction
is present.

---

## 9. Manifest generation + parity contract (normative test)

`tests/test_manifest_parity.py` (new, Phase 0) asserts, **per track**:

1. **Order parity:** the engine's ordered `sectionTag` list (from `outline` with default flags) ==
   `getFilteredSections(level, defaultDisabledTags, …)` flattened to `sectionTag`s. (For the genie
   track, default = **both optional chapters off**: ontology **off** and lakehouse **off**, so the
   default walk is `… → prd_generation → semlayer_locate → …` with no `genie_silver_metadata` /
   `gold_*` / `deploy_lakehouse_assets`.)
2. **Flag parity:** toggling `includeGenieOntology=true` re-introduces `ontology_*`, and toggling
   `includeLakehouse=true` re-introduces the four lakehouse steps, each in the same positions the
   corresponding TS toggle produces. One golden fixture per toggle
   (`golden_order_genie_default.json`, `…_ontology_on.json`, `…_lakehouse_on.json`); enabling one
   optional chapter must not pull in the other.
3. **Chaining parity:** for each step, `consumes` resolves to the same upstream keys the
   `WorkflowDiagram.tsx` / `stepPreviousOutputs.ts` literals produce (translated number→tag).
4. **Assembler byte-parity:** for a sample of genie `sectionTag`s (fork + default),
   the extracted `assembler.get_section_input_content(...)` output equals the current
   `routes.get_section_input_content(...)` output byte-for-byte (roadmap §15).

CI fails on any drift. This is the single guardrail that lets the UI and engine share one brain.

---

## 10. Invariants & failure modes

- **I1.** Engine keys are `sectionTag` only (§2).
- **I2.** No second assembler; extraction is behavior-identical (§7, §9.4).
- **I3.** Stateless: correctness never depends on in-process state (§4.2).
- **I4.** Missing upstream outputs degrade to placeholders, never raise (§6).
- **I5.** `ui-driven` steps are coached, never auto-gated (§5.4 step 2).
- **I6.** Manifest is generated, never hand-edited; parity test green (§3.3, §9).
- **F1.** Unknown `sectionTag` → error result, no state mutation.
- **F2.** `complete_step` on a locked step → error result, no state mutation.
- **F3.** Completing an already-done gate → idempotent success.

---

## 11. File map (Phase 0, from roadmap §12)

| File | Change |
|---|---|
| `src/backend/workshop/manifest.py` + `manifest.json` | **new** — loader + generated data |
| `src/backend/workshop/engine.py` | **new** — `outline` / `next_step` / `can_start` / `complete_step` |
| `src/backend/workshop/assembler.py` | **new** — extract `get_section_input_content` (behavior-identical) |
| `scripts/generate_manifest.py` | **new** — emit `manifest.json` |
| `tests/test_manifest_parity.py` | **new** — the §9 contract |

UI is unchanged in Phase 0 (roadmap §14): backend owns the walk, no user-visible change.

---

## 12. Open questions (defer to human)

1. **Manifest source of truth** — generate from `workflowSections.ts`, or promote a neutral
   `tracks.json` both TS and Python import? (Roadmap §16 recommends `tracks.json` long-term; parity
   test guards either way.)
2. **Number↔tag flip timing** — confirm Phase 3 as the point to drop the legacy number keys.
3. **`skipped` semantics** — is explicit skipping still a supported state in the engine, or only a
   legacy UI concept? (Affects the `status` enum in §5.1.)
