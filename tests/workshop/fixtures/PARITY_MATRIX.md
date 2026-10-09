# Outline parity matrix (Phase 3 T3a; frozen T4b)

FROZEN reference — captured from `getFilteredSections()` via the now-retired `scripts/dump_outline_matrix.mjs`. That oracle and `getFilteredSections` were removed in Phase 3 T4b, so this is a permanent, non-regenerable snapshot; the live engine is validated against it in `tests/workshop/test_outline_parity.py`.

`ts` = the FROZEN `getFilteredSections()` reference ordered `sectionTag` sequence. `engine` = `engine.outline()` (manifest declaration order minus flag-filtered steps, over the variant the engine selects). **parity** = the engine reproduces the TS order. As of T3a the engine composes all four axes (direction=reverse, additive-chain climb, AI-module + medallion sub-toggles), so every cell is expressible and parity; the `Engine input` column shows the flags + direction/chainContext the engine reads to reproduce each TS order.

Totals: 65 cells across 14 tracks — 65 parity, 0 gap.

## Matrix (14 tracks x combos)

| Track | Combo | Axis | Engine input | Expressible | Status | TS len | Engine len |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app-only | default | default | — | yes | ✅ parity | 7 | 7 |
| app-database | default | default | — | yes | ✅ parity | 10 | 10 |
| lakehouse | default | default | — | yes | ✅ parity | 11 | 11 |
| lakehouse | climb:app | additive-chain climb | chainContext=app | yes | ✅ parity | 17 | 17 |
| lakehouse | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 9 | 9 |
| lakehouse | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 8 | 8 |
| lakehouse-di | default | default | — | yes | ✅ parity | 17 | 17 |
| lakehouse-di | climb:app | additive-chain climb | chainContext=app | yes | ✅ parity | 24 | 24 |
| lakehouse-di | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 15 | 15 |
| lakehouse-di | ai-off:agent | AI-module sub-toggle | ai.agent=false | yes | ✅ parity | 16 | 16 |
| lakehouse-di | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 16 | 16 |
| lakehouse-di | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.agent=false, ai.dashboard=false | yes | ✅ parity | 13 | 13 |
| lakehouse-di | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 15 | 15 |
| lakehouse-di | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 14 | 14 |
| end-to-end | default | default | — | yes | ✅ parity | 24 | 24 |
| end-to-end | direction:reverse | direction=reverse | direction=reverse | yes | ✅ parity | 23 | 23 |
| end-to-end | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 22 | 22 |
| end-to-end | ai-off:agent | AI-module sub-toggle | ai.agent=false | yes | ✅ parity | 22 | 22 |
| end-to-end | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 23 | 23 |
| end-to-end | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.agent=false, ai.dashboard=false | yes | ✅ parity | 19 | 19 |
| end-to-end | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 22 | 22 |
| end-to-end | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 21 | 21 |
| accelerator | default | default | — | yes | ✅ parity | 17 | 17 |
| accelerator | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 15 | 15 |
| accelerator | ai-off:agent | AI-module sub-toggle | ai.agent=false | yes | ✅ parity | 16 | 16 |
| accelerator | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 16 | 16 |
| accelerator | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.agent=false, ai.dashboard=false | yes | ✅ parity | 13 | 13 |
| accelerator | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 15 | 15 |
| accelerator | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 14 | 14 |
| genie-accelerator | default | default | — | yes | ✅ parity | 24 | 24 |
| genie-accelerator | flags:includeLakehouse | genie flags | includeLakehouse=true | yes | ✅ parity | 28 | 28 |
| genie-accelerator | flags:includeGenieOntology | genie flags | includeGenieOntology=true | yes | ✅ parity | 27 | 27 |
| genie-accelerator | flags:includeLakehouse+includeGenieOntology | genie flags | includeLakehouse=true, includeGenieOntology=true | yes | ✅ parity | 31 | 31 |
| data-engineering-accelerator | default | default | — | yes | ✅ parity | 11 | 11 |
| data-engineering-accelerator | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 9 | 9 |
| data-engineering-accelerator | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 8 | 8 |
| skills-accelerator | default | default | — | yes | ✅ parity | 9 | 9 |
| agents-accelerator | default | default | — | yes | ✅ parity | 29 | 29 |
| reverse-lakehouse | default | default | — | yes | ✅ parity | 11 | 11 |
| reverse-lakehouse | direction:reverse | direction=reverse | direction=reverse | yes | ✅ parity | 11 | 11 |
| reverse-lakehouse | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 9 | 9 |
| reverse-lakehouse | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 8 | 8 |
| reverse-lakehouse-di | default | default | — | yes | ✅ parity | 17 | 17 |
| reverse-lakehouse-di | direction:reverse | direction=reverse | direction=reverse | yes | ✅ parity | 17 | 17 |
| reverse-lakehouse-di | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 15 | 15 |
| reverse-lakehouse-di | ai-off:agent | AI-module sub-toggle | ai.agent=false | yes | ✅ parity | 16 | 16 |
| reverse-lakehouse-di | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 16 | 16 |
| reverse-lakehouse-di | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.agent=false, ai.dashboard=false | yes | ✅ parity | 13 | 13 |
| reverse-lakehouse-di | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 15 | 15 |
| reverse-lakehouse-di | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 14 | 14 |
| reverse-lakebase | default | default | — | yes | ✅ parity | 18 | 18 |
| reverse-lakebase | direction:reverse | direction=reverse | direction=reverse | yes | ✅ parity | 18 | 18 |
| reverse-lakebase | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 16 | 16 |
| reverse-lakebase | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 17 | 17 |
| reverse-lakebase | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.dashboard=false | yes | ✅ parity | 15 | 15 |
| reverse-lakebase | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 16 | 16 |
| reverse-lakebase | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 15 | 15 |
| reverse-app | default | default | — | yes | ✅ parity | 23 | 23 |
| reverse-app | direction:reverse | direction=reverse | direction=reverse | yes | ✅ parity | 23 | 23 |
| reverse-app | ai-off:genie | AI-module sub-toggle | ai.genie=false | yes | ✅ parity | 21 | 21 |
| reverse-app | ai-off:agent | AI-module sub-toggle | ai.agent=false | yes | ✅ parity | 22 | 22 |
| reverse-app | ai-off:dashboard | AI-module sub-toggle | ai.dashboard=false | yes | ✅ parity | 22 | 22 |
| reverse-app | ai-off:all | AI-module sub-toggle | ai.genie=false, ai.agent=false, ai.dashboard=false | yes | ✅ parity | 19 | 19 |
| reverse-app | medallion:gold-off | medallion sub-toggle | medallion.gold=false | yes | ✅ parity | 21 | 21 |
| reverse-app | medallion:silver+gold-off | medallion sub-toggle | medallion.silver=false, medallion.gold=false | yes | ✅ parity | 20 | 20 |

## Expressible cells (hard-asserted parity — the safety net)

Every cell the engine reproduces exactly. Any drift here is a real finding, not a gap.

- `app-only` / `default` — PARITY
- `app-database` / `default` — PARITY
- `lakehouse` / `default` — PARITY
- `lakehouse` / `climb:app` — PARITY
- `lakehouse` / `medallion:gold-off` — PARITY
- `lakehouse` / `medallion:silver+gold-off` — PARITY
- `lakehouse-di` / `default` — PARITY
- `lakehouse-di` / `climb:app` — PARITY
- `lakehouse-di` / `ai-off:genie` — PARITY
- `lakehouse-di` / `ai-off:agent` — PARITY
- `lakehouse-di` / `ai-off:dashboard` — PARITY
- `lakehouse-di` / `ai-off:all` — PARITY
- `lakehouse-di` / `medallion:gold-off` — PARITY
- `lakehouse-di` / `medallion:silver+gold-off` — PARITY
- `end-to-end` / `default` — PARITY
- `end-to-end` / `direction:reverse` — PARITY
- `end-to-end` / `ai-off:genie` — PARITY
- `end-to-end` / `ai-off:agent` — PARITY
- `end-to-end` / `ai-off:dashboard` — PARITY
- `end-to-end` / `ai-off:all` — PARITY
- `end-to-end` / `medallion:gold-off` — PARITY
- `end-to-end` / `medallion:silver+gold-off` — PARITY
- `accelerator` / `default` — PARITY
- `accelerator` / `ai-off:genie` — PARITY
- `accelerator` / `ai-off:agent` — PARITY
- `accelerator` / `ai-off:dashboard` — PARITY
- `accelerator` / `ai-off:all` — PARITY
- `accelerator` / `medallion:gold-off` — PARITY
- `accelerator` / `medallion:silver+gold-off` — PARITY
- `genie-accelerator` / `default` — PARITY
- `genie-accelerator` / `flags:includeLakehouse` — PARITY
- `genie-accelerator` / `flags:includeGenieOntology` — PARITY
- `genie-accelerator` / `flags:includeLakehouse+includeGenieOntology` — PARITY
- `data-engineering-accelerator` / `default` — PARITY
- `data-engineering-accelerator` / `medallion:gold-off` — PARITY
- `data-engineering-accelerator` / `medallion:silver+gold-off` — PARITY
- `skills-accelerator` / `default` — PARITY
- `agents-accelerator` / `default` — PARITY
- `reverse-lakehouse` / `default` — PARITY
- `reverse-lakehouse` / `direction:reverse` — PARITY
- `reverse-lakehouse` / `medallion:gold-off` — PARITY
- `reverse-lakehouse` / `medallion:silver+gold-off` — PARITY
- `reverse-lakehouse-di` / `default` — PARITY
- `reverse-lakehouse-di` / `direction:reverse` — PARITY
- `reverse-lakehouse-di` / `ai-off:genie` — PARITY
- `reverse-lakehouse-di` / `ai-off:agent` — PARITY
- `reverse-lakehouse-di` / `ai-off:dashboard` — PARITY
- `reverse-lakehouse-di` / `ai-off:all` — PARITY
- `reverse-lakehouse-di` / `medallion:gold-off` — PARITY
- `reverse-lakehouse-di` / `medallion:silver+gold-off` — PARITY
- `reverse-lakebase` / `default` — PARITY
- `reverse-lakebase` / `direction:reverse` — PARITY
- `reverse-lakebase` / `ai-off:genie` — PARITY
- `reverse-lakebase` / `ai-off:dashboard` — PARITY
- `reverse-lakebase` / `ai-off:all` — PARITY
- `reverse-lakebase` / `medallion:gold-off` — PARITY
- `reverse-lakebase` / `medallion:silver+gold-off` — PARITY
- `reverse-app` / `default` — PARITY
- `reverse-app` / `direction:reverse` — PARITY
- `reverse-app` / `ai-off:genie` — PARITY
- `reverse-app` / `ai-off:agent` — PARITY
- `reverse-app` / `ai-off:dashboard` — PARITY
- `reverse-app` / `ai-off:all` — PARITY
- `reverse-app` / `medallion:gold-off` — PARITY
- `reverse-app` / `medallion:silver+gold-off` — PARITY

## Composition axes (Phase 3 T3a — all reconciled)

The four axes that were Phase 3 T3 gaps are now engine-composed. Any cell that regresses to a gap is listed below with its concrete TS-vs-engine diff (empty in a healthy tree).

### direction=reverse (0 gap cells)

_Reconciled: every cell on this axis is engine-composed and at parity._

### additive-chain climb (0 gap cells)

_Reconciled: every cell on this axis is engine-composed and at parity._

### AI-module sub-toggle (0 gap cells)

_Reconciled: every cell on this axis is engine-composed and at parity._

### medallion sub-toggle (0 gap cells)

_Reconciled: every cell on this axis is engine-composed and at parity._

## Non-expressible cells (should be empty after T3a)

_None — every enumerated cell is engine-expressible._

