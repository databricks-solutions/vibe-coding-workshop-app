# MCP Workshop — Phase 0 (Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the workshop assembler and build a generated track manifest + pure progression engine as a transport-agnostic backend domain, proven byte-for-byte identical to the live code by a parity test — with **zero user-visible change** (UI untouched in Phase 0).

**Architecture:** One engine, one assembler. `get_section_input_content` (`src/backend/api/routes.py:1241`) is mechanically extracted into `src/backend/workshop/assembler.py` with behavior preserved to the byte. A declarative `manifest.json` (generated, never hand-edited) is the single source of truth for order/gating/chaining, loaded by `manifest.py`. Pure functions in `engine.py` (`outline`/`next_step`/`can_start`/`complete_step`) port the frontend `getFilteredSections` + `getNextIncompleteStep` walk, keyed exclusively by `sectionTag`. A parity test suite (`tests/workshop/`) fails on any drift between engine and UI, and between the extracted and live assembler.

**Tech Stack:** Python 3.11+, FastAPI (existing), Lakebase/asyncpg with in-memory fallback (existing `src/backend/services/lakebase.py`), stdlib `unittest` + `pytest` for tests. No new runtime deps in Phase 0. Frontend `src/constants/workflowSections.ts` is a **read-only source of truth** for the generator — not modified.

**Spec:** `docs/specs/mcp_design/workshop-engine-domain.md` (D3), tests from `docs/specs/mcp_design/mcp-workshop-test-plan.md` (D8 §2), probe constraints from `docs/specs/mcp_design/mcp-interactive-track-doc-plan.md` §1. The plan argues from these; executors read them alongside this plan.

---

## Global Constraints

> These are the charter's NON-NEGOTIABLE GUARDRAILS, copied verbatim. Every task's requirements implicitly include this section. (Guardrails #1–#11 mostly bind Phase 1/2; they are reproduced in full so no executor loses the thread. Phase 0 is bound most directly by #5 stateless, #9 verbatim/bypass_llm, #12 additive-data, and #13 repo reality.)

1.  **PROBE FLOOR** (plan §1; D1 §2, §10): Genie Code declares empty capabilities — NO elicitation, NO MRTR, NO sampling. ALL interactivity is IN-BAND. Never add a server→client protocol call. There is no code path where a missing capability blocks a step (D1 §2).
2.  **307 IS THE #1 KILLER** (D4 §2 step; D7 §2; D8 §5): POST /mcp MUST return 200, never a 307 redirect to /mcp/. Implement an ASGI path-rewrite so /mcp is served without redirect.
3.  **MOUNT ORDER** (D4 §2.1; anchor app.py:162): mount /mcp BEFORE the SPA catch-all `@app.get("/{full_path:path}")` and exclude /mcp in serve_spa.
4.  **LIFESPAN** (D4 §2 step 3; anchor app.py:34): the parent FastAPI(...) MUST compose mcp_app.lifespan or FastMCP's session manager never starts.
5.  **STATELESS** (D3 §4.2; D7 §5): stateless_http=True; read session state fresh from Lakebase per request; no engine correctness depends on in-process state; two concurrent sessions never share memory.
6.  **APP NAME** (D4 §2; D9 §4): the deployed app name MUST start with "mcp-".
7.  **TOOL BUDGET ≤ 6** (D2 §1, §9): exactly 6 tools. Read-only listings are RESOURCES; entry points are PROMPTS (both are free of the ~20-tool budget).
8.  **ANNOTATIONS + ERRORS** (D2 §7, §8): every tool sets all four annotations and returns structuredContent validating its outputSchema PLUS a text block; expected failures return isError with a code from D2 §6 — never a protocol exception.
9.  **VERBATIM FIRST** (D1 §7; D3 §7.5 bypass_llm): present the step `prompt` body VERBATIM before narrating why/how. The Genie Accelerator is a bypass_llm track — the assembler renders, it does not paraphrase.
10. **RECOMMEND-AND-PROCEED** (D5 §3): every decision interaction carries a stated `recommended` default; the track never blocks on it (only §11 hard-stops).
11. **SELF-SERVE BY CONSTRUCTION** (D1 §1a; D4 §1.1; D2 §4–§5): a learner reaches step 1 with ONLY the app URL — orientation + help come from the server (orientation prompt, vibe://guide/getting-started) and the SPA "Connect to Genie Code" panel. D10 is a fallback, never a prerequisite.
12. **ADDITIVE DATA ONLY** (D6 §2, §7): new Lakebase columns/tables only; migration DDL is idempotent (IF NOT EXISTS); never rewrite or drop existing columns.
13. **REPO REALITY** (CLAUDE.md/AGENTS.md): this is a Databricks App — NEVER run uvicorn, npm run dev, or any local server. Pin mcp/fastmcp to EXACT versions in requirements.txt (this repo has NO uv/pyproject pinning). There is NO CI: run `pytest tests/...` locally and PASTE results in every PR. Reseed = scripts/deploy.sh --tables-only; deploy = --code-only -t <target>.

### Phase 0 repo-reality reconciliation (verified 2026-09-22 by anchor explores)

- **routes.py is at `src/backend/api/routes.py`** (7,220 lines), not repo-root. All D3 §1 / charter Anchor-Pack line numbers confirmed exact against live source.
- **The injected `CLAUDE.md` describing `uv` / `./scripts/test.sh` / `asyncio_mode` belongs to a DIFFERENT project (Genie Workbench).** It does NOT apply here. This repo tests with stdlib `unittest` + FastAPI `TestClient` (`tests/api/*.py`, `tests/e2e/*.spec.ts`). D8 §11 mandates the invocation `pytest tests/workshop tests/api`. **Repo reality wins over the injected CLAUDE.md.**
- **Test runner decision (resolve in Task 1, Step 0):** confirm whether `pytest` is importable in the local env. Default to D8 §11's `pytest` invocation. Write tests as plain `pytest`-style functions (pytest also discovers `unittest.TestCase`). If `pytest` is not installed, `pip install pytest` locally (test-only tool; not a deploy/runtime dependency — do NOT add it to the platform requirements used by `uv sync`/pip on deploy). Record the exact command and its output in every PR.
- **DO NOT run any server, deploy, or reseed.** Phase 0 is offline-only. The parity tests are the gate.
- **`bypass_llm` clarification (critical for byte-parity):** the assembler only **reads and propagates** `bypass_llm`; it does NOT contain the verbatim `## Context\n\n…\n\n---\n\n…` rendering — that lives caller-side across 4 call sites (`routes.py:1568-1585` non-stream + 3 streaming). Phase 0 extraction moves ONLY the flag. Byte-parity (D8 §2.4) compares the assembler's 10-key output dict, NOT the verbatim concatenation.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/backend/workshop/__init__.py` | package marker | T1 (first to land) |
| `src/backend/workshop/assembler.py` | **new** — extracted `get_section_input_content`, behavior-identical | T1 |
| `src/backend/workshop/manifest.py` | **new** — loader + `Track`/`Section`/`Step` typed access over `manifest.json` | T2 |
| `src/backend/workshop/manifest.json` | **new** — generated track data (order/gating/chaining); never hand-edited | T2 |
| `scripts/generate_manifest.py` | **new** — emits `manifest.json` from `workflowSections.ts` (bootstrap source, D3 §3.3) | T2 |
| `src/backend/workshop/engine.py` | **new** — pure `outline`/`next_step`/`can_start`/`complete_step` + chaining resolution | T3 |
| `tests/workshop/__init__.py` | test package marker | T1 |
| `tests/workshop/test_assembler_parity.py` | **new** — D8 §2.4 assembler byte-parity | T1 |
| `tests/workshop/test_manifest_parity.py` | **new** — D8 §2.1 order + §2.2 flag parity | T2 |
| `tests/workshop/test_engine.py` | **new** — D8 §2.5 progression units + §2.3 chaining parity | T3 |
| `tests/workshop/fixtures/` | golden fixtures captured from TS source (order/flag/chaining) + seeded prompt rows | T2, T3 |

**Existing files NOT modified in Phase 0:** `routes.py` (only lightly, iff extraction requires it — see T1 constraint), `app.py`, `workflowSections.ts`, all DDL, all frontend. UI is unchanged (D3 §11).

**Serialized shared file:** `manifest.json` has exactly one producer (`generate_manifest.py`, T2). No task edits another task's file.

---

## Dependency graph & execution order

```
Round 1 (parallel LEAVES — /fanout, independent worktrees):
  T1  assembler extraction          (own PR, own worktree)
  T2  manifest loader + generator   (own PR, own worktree)

Round 2 (TRUNK — after T1 AND T2 are cross-reviewed clean):
  T3  progression engine            (consumes manifest from T2, assembler from T1)
```

- **T1 ⟂ T2:** no shared files, no shared symbols. Independent leaves — run concurrently.
- **T3 depends on T1 + T2:** `engine.outline`/`next_step` consume `manifest.load_manifest()`; the step-payload/chaining path resolves `previous_outputs` and (optionally) calls the assembler. Start T3 only after T1 and T2 land.
- Each task is ONE PR, TDD (failing test → run red → minimal impl → run green → commit), cross-reviewed by a **different vendor** than the implementer. Implementers never merge.

---

## Task 1: Assembler extraction (behavior-identical)

**Files:**
- Create: `src/backend/workshop/__init__.py`
- Create: `src/backend/workshop/assembler.py`
- Create: `tests/workshop/__init__.py`
- Create: `tests/workshop/test_assembler_parity.py`
- Modify (minimal, iff required to break an import cycle): `src/backend/api/routes.py` — see constraint below.

**Interfaces:**
- Consumes: existing `src/backend/api/routes.py` helpers (all module-local): `get_section_input_template` (:360), `format_industry_name` (:976), `format_use_case_name` (:985), `get_prompt_templates_map` (:906), `get_effective_workshop_parameters` (:1124), `get_workshop_parameters_sync` (:1068), `get_section_input_prompts_map` (:934), `_normalize_coding_assistant` (:276), `_get_session_coding_assistant` (:300), `get_section_input_prompts_from_lakebase` (:248), `_hex_to_oklch` (:44), plus transitive `_section_row_to_template` (:344), `_parse_image_field` (:331), `_refresh_lakebase_cache` (:163), `get_usecase_descriptions_from_lakebase` (:237). All read Lakebase via `src.backend.services.lakebase` with in-memory fallback.
- Produces (later tasks/adapters rely on this EXACT signature and return shape):
  ```python
  def get_section_input_content(
      industry: str,
      use_case: str,
      section_tag: str,
      previous_outputs: Optional[Dict[str, str]] = None,
      session_id: Optional[str] = None,
      coding_assistant_override: Optional[str] = None,
  ) -> Dict[str, str]:  # loose annotation; runtime dict has str/List/bool members
      ...
  # Returns a 10-key dict, EXACTLY:
  #   "input" (str), "input_template" (str), "system_prompt" (str),
  #   "how_to_apply" (str), "expected_output" (str),
  #   "how_to_apply_images" (List), "expected_output_images" (List),
  #   "bypass_llm" (bool), "_brand_url" (str), "coding_assistant_variant" (str)
  ```

**Behavior-identical mandate (D3 §7, I2):** This is a **mechanical extraction**. Preserve exactly: fork resolution (D3 §7.2; routes.py:1289–1318), token substitution order & set — base → `iterate_enhance` extras (:1341) → `workshop_params` → `previous_outputs` (missing→placeholder, :1351) → `{prd_document}` default (:1355) (D3 §7.3), the six-tag brand-injection gate (carry routes.py:1364–1374 as one unit), and the 10-key return shape (D3 §7.4; routes.py:1515–1526). Do NOT "clean up", rename, reorder dict insertions, or change types. The assembler propagates `bypass_llm` but does NOT render the verbatim concatenation (that stays caller-side).

**Constraint — no duplication, no circular import (I2, "no second assembler"):** There must be exactly ONE implementation of the assembler after this task. Two acceptable shapes; the byte-parity test is the arbiter — pick whichever keeps `routes.py` importable and avoids a circular import:
- (a) Move `get_section_input_content` into `assembler.py`; have `assembler.py` import the helper deps from `routes.py`; make `routes.py` re-export via `from src.backend.workshop.assembler import get_section_input_content` (guard against a cycle — a deferred/inline import inside the function, or moving the shared leaf helpers into a small `_prompt_helpers` module, are both allowed).
- (b) Keep helpers in `routes.py`, move only the assembler body, and resolve the cycle with a lazy import.
- **Forbidden:** copy-pasting the assembler body into `assembler.py` while leaving the original in `routes.py` (that is a second assembler and violates I2).

- [ ] **Step 0: Confirm the test runner (see Global Constraints).** Run `python -c "import pytest, fastapi.testclient; print('ok')"`. If pytest is missing, `pip install pytest` locally. Record the exact command + output for the PR.

- [ ] **Step 1: Write the failing byte-parity test** (D8 §2.4). It drives BOTH the live `routes.get_section_input_content` and the extracted `workshop.assembler.get_section_input_content` with identical inputs and identical seeded DB state, and asserts dict equality (byte-for-byte).

```python
# tests/workshop/test_assembler_parity.py
import pytest
from src.backend.api import routes
from src.backend.workshop import assembler

# Golden sample per D8 §13 open-q 3 recommendation: all semlayer_* + gagent_*,
# fork ('genie-code') AND default, across a small industry/use_case matrix.
SAMPLE_TAGS = [
    "semlayer_locate", "semlayer_profile", "semlayer_metric_view",
    "gagent_optimize", "gagent_benchmarks",
]
MATRIX = [("retail", "customer_analytics"), ("finance", "fraud_detection")]
ASSISTANTS = [None, "genie-code"]  # default + fork


@pytest.fixture
def seeded_prompt_rows(monkeypatch):
    """Seed identical section_input_prompts rows into the in-memory lakebase
    fallback so BOTH functions read the SAME content. Reset the 30s TTL cache
    (_lakebase_cache) before each run so neither path serves stale rows."""
    # Implementer: seed via the same in-memory store both code paths read; the
    # goal is that routes.* and assembler.* observe byte-identical rows.
    ...


@pytest.mark.parametrize("tag", SAMPLE_TAGS)
@pytest.mark.parametrize("industry,use_case", MATRIX)
@pytest.mark.parametrize("assistant", ASSISTANTS)
def test_assembler_byte_parity(seeded_prompt_rows, tag, industry, use_case, assistant):
    live = routes.get_section_input_content(
        industry, use_case, tag, coding_assistant_override=assistant
    )
    extracted = assembler.get_section_input_content(
        industry, use_case, tag, coding_assistant_override=assistant
    )
    assert extracted == live, f"assembler drift for {tag}/{industry}/{use_case}/{assistant}"
    # Lock the exact key set (D3 §7.4)
    assert set(extracted.keys()) == {
        "input", "input_template", "system_prompt", "how_to_apply",
        "expected_output", "how_to_apply_images", "expected_output_images",
        "bypass_llm", "_brand_url", "coding_assistant_variant",
    }
```

- [ ] **Step 2: Run the test to verify it fails.** Run: `pytest tests/workshop/test_assembler_parity.py -v`. Expected: FAIL — `ModuleNotFoundError: src.backend.workshop.assembler` (or `ImportError`).

- [ ] **Step 3: Extract minimally.** Create `src/backend/workshop/__init__.py` (empty) and `assembler.py` per the "no duplication" constraint (shape a or b). Move the body verbatim; wire helper imports; resolve any cycle. Make `routes.get_section_input_content` and `assembler.get_section_input_content` resolve to the SAME implementation.

- [ ] **Step 4: Run the byte-parity test to verify it passes.** Run: `pytest tests/workshop/test_assembler_parity.py -v`. Expected: PASS for every parametrization.

- [ ] **Step 5: Regression-check the callers.** Run the existing suite to prove no caller broke: `pytest tests/api -v` (or the repo's `python -m unittest discover tests/api` if pytest is unavailable). Expected: no NEW failures vs. the pre-change baseline (capture the baseline first).

- [ ] **Step 6: Commit and open the PR.**

```bash
git add src/backend/workshop/__init__.py src/backend/workshop/assembler.py \
        tests/workshop/__init__.py tests/workshop/test_assembler_parity.py
# plus routes.py IFF the re-export/cycle fix required it
git commit -m "feat(workshop): extract get_section_input_content into assembler (byte-parity)"
```
PR body MUST paste: the exact test command(s) and full output for `test_assembler_parity.py` AND the caller regression run, plus a one-line statement that there is now exactly one assembler implementation (which shape, a or b).

---

## Task 2: Track manifest — loader + generator + generated data

**Files:**
- Create: `scripts/generate_manifest.py`
- Create: `src/backend/workshop/manifest.py`
- Create: `src/backend/workshop/manifest.json` (generated output of the script)
- Create: `tests/workshop/test_manifest_parity.py`
- Create: `tests/workshop/fixtures/` (golden ordered-tag lists captured from `workflowSections.ts`)

**Interfaces:**
- Consumes: `src/constants/workflowSections.ts` — specifically `getFilteredSections(level, disabledSectionTags, overrides?, direction?)` (:729), `disabledSectionTags` application (:825–829), `getDisabledTagsForGenieOntology(...)` + `GENIE_ONTOLOGY_TAGS` (:267 / :257). READ-ONLY source; not modified.
- Produces (T3 relies on these):
  ```python
  # manifest.py
  def load_manifest(path: str | None = None) -> Manifest: ...
  # Manifest.tracks: dict[str, Track]; Track.sections: list[Section]; Section.steps: list[Step]
  # Step fields (D3 §3.1): order:int, sectionTag:str, title:str, why:str|None,
  #   gate:str|None, requiresGate:str|None, consumes:list[str], produces:str|None,
  #   execution:Literal["agent-doable","ui-driven","hybrid"], surfaces:list[str], flag:str|None
  def track_steps(track_id: str) -> list[Step]:  # full ordered set (unfiltered)
      ...
  ```

**Manifest source-of-truth decision (D3 §12 open-q 1, resolved for Phase 0):** Adopt the spec's stated **bootstrap**: `generate_manifest.py` derives `manifest.json` from `workflowSections.ts` (D3 §3.3). The long-term `tracks.json` promotion is out of scope for Phase 0 — flag it in the PR as a follow-up; the parity test guards either way. The generator must reproduce, per track, the exact flattened `sectionTag` order of `getFilteredSections(level, defaultDisabledTags, …)` with the **default flag state (Genie ontology OFF)**, and record each step's `flag`, `requiresGate`, `consumes`, `produces` per D3 §3.2 / §6. **Chaining literals** come from `WorkflowDiagram.tsx` (source of truth) mirrored in `stepPreviousOutputs.ts`, translated number→tag (D3 §6 migration note). Note the D3 §16 correction: `gaccel_dashboard` `requiresGate` is `semlayer_metric_view`, NOT `gagent_optimize`.
- Extraction mechanics are the implementer's choice (a small Node script that imports `getFilteredSections` and dumps JSON, then Python consumes it; OR static parse). Whichever is used, `manifest.json` must be reproducible by re-running `generate_manifest.py`, and the generator must NOT require a running server.

- [ ] **Step 1: Write the failing order + flag parity test** (D8 §2.1, §2.2). It compares the loaded manifest's ordered `sectionTag` list against a golden fixture captured from the TS `getFilteredSections` output.

```python
# tests/workshop/test_manifest_parity.py
import json, pathlib
import pytest
from src.backend.workshop import manifest

FIX = pathlib.Path(__file__).parent / "fixtures"
# golden_order_genie_default.json: flattened sectionTags from
# getFilteredSections("genie-accelerator", defaultDisabledTags) — ontology OFF.
# golden_order_genie_ontology_on.json: same with includeGenieOntology=true.


def _ordered_tags(steps):
    return [s.sectionTag for s in steps]


def test_order_parity_default_flags():
    m = manifest.load_manifest()
    got = _ordered_tags(m.outline_order("genie-accelerator", flags={}))  # defaults
    want = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert got == want


def test_flag_parity_ontology_on_reintroduces_tags_in_position():
    m = manifest.load_manifest()
    got = _ordered_tags(
        m.outline_order("genie-accelerator", flags={"includeGenieOntology": True})
    )
    want = json.loads((FIX / "golden_order_genie_ontology_on.json").read_text())
    assert got == want
    # ontology_* tags appear ONLY in the ontology-on ordering
    assert any(t.startswith("ontology_") for t in got)
    default = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert not any(t.startswith("ontology_") for t in default)
```
> The `outline_order` helper here is a thin manifest-level ordering (flag filter only). Full status-annotated `outline` (needing session state) belongs to T3; keep T2's surface to loading + flag-filtered ordering so this task stays an independent leaf.

- [ ] **Step 2: Run to verify it fails.** Run: `pytest tests/workshop/test_manifest_parity.py -v`. Expected: FAIL — no `manifest` module / no `manifest.json` / missing fixtures.

- [ ] **Step 3: Capture the golden fixtures from the TS source.** Produce `golden_order_genie_default.json` and `golden_order_genie_ontology_on.json` as the flattened `sectionTag` lists that `getFilteredSections` yields for the genie-accelerator track (ontology off / on). Document exactly how they were derived (script or manual trace) in the PR so a reviewer can reproduce.

- [ ] **Step 4: Write `generate_manifest.py`, generate `manifest.json`, and `manifest.py` loader.** Emit the full ordered set per track with `flag`/`requiresGate`/`consumes`/`produces`. Implement `load_manifest()` + `outline_order(track_id, flags)` (flag filter mirrors `getDisabledTagsForGenieOntology`).

- [ ] **Step 5: Run to verify it passes.** Run: `pytest tests/workshop/test_manifest_parity.py -v`. Expected: PASS.

- [ ] **Step 6: Commit and open the PR.**

```bash
git add scripts/generate_manifest.py src/backend/workshop/manifest.py \
        src/backend/workshop/manifest.json tests/workshop/test_manifest_parity.py \
        tests/workshop/fixtures/
git commit -m "feat(workshop): generated track manifest + loader with order/flag parity"
```
PR body MUST paste the parity test output AND the exact command that regenerates `manifest.json` (prove it is generated, not hand-written), plus how the golden fixtures were derived from `workflowSections.ts`.

---

## Task 3: Progression engine (pure functions) + chaining parity

**Files:**
- Create: `src/backend/workshop/engine.py`
- Create: `tests/workshop/test_engine.py`
- Extend: `tests/workshop/fixtures/` (golden chaining map from `WorkflowDiagram.tsx` / `stepPreviousOutputs.ts`)

**Interfaces:**
- Consumes: `manifest.load_manifest()` + `Step` (T2); `assembler.get_section_input_content` (T1) for the optional step-payload path. Session state shape (D3 §4.1): `completed_gates: list[str]` (tag ledger), `captured_outputs: dict[str, str]`, `session_parameters: dict` (flags live here).
- Produces:
  ```python
  # engine.py — pure functions over (manifest, session_state); state read is the only I/O (D3 §5)
  def outline(track_id: str, session: SessionState) -> list[StepStatus]: ...
      # StepStatus.status in {"done","current","locked","skipped"} (D3 §5.1)
  def next_step(track_id: str, session: SessionState) -> Step | Done: ...      # D3 §5.2
  def can_start(step: Step, session: SessionState) -> bool: ...                # D3 §5.3
  def complete_step(track_id: str, session: SessionState, section_tag: str,
                    captured_output: str | None = None) -> CompleteResult: ... # D3 §5.4
  def resolve_previous_outputs(step: Step, session: SessionState) -> dict[str, str]: ...  # D3 §6
  ```

**Semantics to preserve (D3 §5, §6, §10 invariants):**
- `outline`: flag-filter first (drop `flag`-gated steps false in `session_parameters`), then status: `done` if tag ∈ `completed_gates`; else `current` if first non-done with satisfied `requiresGate`; else `locked` if `requiresGate` set & unmet; `skipped` only if explicitly recorded.
- `can_start`: `true` iff `requiresGate is None or requiresGate ∈ completed_gates`.
- `complete_step`: F2 guard (locked step → error result, no mutation); ui-driven → coached marker not a false gate (D3 §5.4 step 2); append tag idempotently (F3 done-gate → idempotent success); write `captured_outputs[produces]` when `produces` non-null; return updated gates + `next_step`. F1: unknown `sectionTag` → error result, no mutation.
- `resolve_previous_outputs`: read `captured_outputs[k]` for each `consumes` key; **never raise** on a missing key — leave it for the assembler's placeholder (`value or "[No {key} provided …]"`, routes.py:1351) and `{prd_document}` default (:1355) (I4).

- [ ] **Step 1: Write the failing progression + chaining tests** (D8 §2.5 + §2.3).

```python
# tests/workshop/test_engine.py
import json, pathlib
import pytest
from src.backend.workshop import engine, manifest

FIX = pathlib.Path(__file__).parent / "fixtures"
TRACK = "genie-accelerator"


def _session(gates=None, outputs=None, params=None):
    return engine.SessionState(
        completed_gates=list(gates or []),
        captured_outputs=dict(outputs or {}),
        session_parameters=dict(params or {}),
    )


def test_next_step_is_first_current():
    s = _session()
    step = engine.next_step(TRACK, s)
    order = [st.sectionTag for st in manifest.load_manifest().outline_order(TRACK, flags={})]
    assert step.sectionTag == order[0]


def test_can_start_requires_gate():
    m = manifest.load_manifest()
    gated = next(st for st in m.track_steps(TRACK) if st.requiresGate)
    assert engine.can_start(gated, _session()) is False
    assert engine.can_start(gated, _session(gates=[gated.requiresGate])) is True


def test_complete_step_idempotent_success():  # D3 F3
    s = _session()
    first = engine.next_step(TRACK, s)
    r1 = engine.complete_step(TRACK, s, first.sectionTag, "out")
    r2 = engine.complete_step(TRACK, s, first.sectionTag, "out")
    assert r1.ok and r2.ok
    assert s.completed_gates.count(first.sectionTag) == 1


def test_complete_locked_step_is_error_no_mutation():  # D3 F2
    m = manifest.load_manifest()
    locked = next(st for st in m.track_steps(TRACK)
                  if st.requiresGate and st.requiresGate not in [])
    s = _session()
    r = engine.complete_step(TRACK, s, locked.sectionTag)
    assert r.ok is False and r.error_code == "STEP_LOCKED"
    assert s.completed_gates == []


def test_unknown_tag_is_error_no_mutation():  # D3 F1
    s = _session()
    r = engine.complete_step(TRACK, s, "not_a_real_tag")
    assert r.ok is False and r.error_code == "UNKNOWN_TRACK"  # or UNKNOWN_STEP per D2 §6
    assert s.completed_gates == []


def test_chaining_parity_consumes_matches_ts_literals():  # D8 §2.3
    m = manifest.load_manifest()
    golden = json.loads((FIX / "golden_chaining_genie.json").read_text())  # {tag: [consumesKeys]}
    for st in m.track_steps(TRACK):
        assert sorted(st.consumes) == sorted(golden.get(st.sectionTag, []))


def test_resolve_previous_outputs_missing_key_does_not_raise():  # I4
    m = manifest.load_manifest()
    step = next(st for st in m.track_steps(TRACK) if st.consumes)
    out = engine.resolve_previous_outputs(step, _session())  # no captured outputs
    assert isinstance(out, dict)  # engine never raises; placeholder handled downstream
```

- [ ] **Step 2: Run to verify it fails.** Run: `pytest tests/workshop/test_engine.py -v`. Expected: FAIL — no `engine` module.

- [ ] **Step 3: Capture the golden chaining fixture.** `golden_chaining_genie.json` = each genie step's upstream keys from `WorkflowDiagram.tsx` (source of truth) / `stepPreviousOutputs.ts`, translated number→tag (D3 §6). Document the translation in the PR.

- [ ] **Step 4: Implement `engine.py`** — the pure functions + `SessionState`/`StepStatus`/`CompleteResult` dataclasses per the Interfaces block, preserving all §5/§6/§10 semantics. Align error codes to D2 §6 vocabulary (`STEP_LOCKED`, `UNKNOWN_STEP`/`UNKNOWN_TRACK`, `GATE_REQUIRED`, `UI_DRIVEN_STEP`).

- [ ] **Step 5: Run to verify it passes.** Run: `pytest tests/workshop/test_engine.py -v`. Expected: PASS.

- [ ] **Step 6: Full Phase-0 gate run + commit + PR.** Run the whole new suite: `pytest tests/workshop -v` (all three files green) and confirm no regression in `tests/api`.

```bash
git add src/backend/workshop/engine.py tests/workshop/test_engine.py tests/workshop/fixtures/
git commit -m "feat(workshop): progression engine + chaining parity"
```
PR body MUST paste `pytest tests/workshop -v` full output (order + flag + chaining + assembler byte-parity + progression all green) and the chaining-fixture derivation.

---

## Phase 0 Exit Gate (objective — must be green before proposing Phase 1)

- **Assembler byte-parity** (D3 §9.4 / D8 §2.4): extracted `assembler.get_section_input_content` == live `routes.get_section_input_content` byte-for-byte across the golden sample (fork + default). ✅ Task 1.
- **Manifest order + flag parity** (D8 §2.1–§2.2): engine ordered `sectionTag`s == `getFilteredSections` flattened (default flags), and `includeGenieOntology=true` re-introduces `ontology_*` in position. ✅ Task 2.
- **Chaining parity** (D8 §2.3): each step's `consumes` == TS literals (number→tag). ✅ Task 3.
- **Progression units** (D8 §2.5): `next_step`/`can_start`/status transitions; idempotency (F3); locked guard (F2); unknown-tag guard (F1). ✅ Task 3.
- **No regression:** existing `tests/api` suite shows no new failures.
- **UI unchanged** (D3 §11): no frontend or `app.py` behavioral change.

All test outputs pasted in the PRs (no CI, D8 §11). Every PR cross-reviewed by a different vendor than its implementer. **polly does not merge — the human merges each PR.**

---

## Self-Review (author checklist — completed)

1. **Spec coverage:** D3 §3 manifest → T2; §5 progression → T3; §6 chaining → T3; §7 assembler → T1; §9 parity contract → all four sub-tests across T1–T3; §11 file map → File Structure table (all 5 new files + tests covered). D8 §2.1→T2, §2.2→T2, §2.3→T3, §2.4→T1, §2.5→T3. No Phase-0 spec requirement left unassigned. (D3 §8 explainability payload and §4.3 dual-write/number↔tag are deferred to Phase 1/2 per the phase map — noted, not dropped.)
2. **Placeholder scan:** test bodies are concrete; the two intentionally-deferred-to-implementer mechanics (in-memory DB seeding for byte-parity; TS→JSON fixture capture) are called out explicitly as steps with a documented arbiter (the parity test) rather than left as vague "add a fixture" TODOs.
3. **Type consistency:** `get_section_input_content` signature + 10-key return identical in T1 Interfaces and the parity test. `Step`/`SessionState`/`CompleteResult`/`outline_order`/`track_steps` names consistent between T2 Produces and T3 Consumes/tests. Error codes aligned to D2 §6.

## Open questions carried to the human (do NOT resolve autonomously)

- **Byte-parity DB seeding approach** (D8 §13 open-q 2/3): the implementer will seed the in-memory lakebase fallback so both code paths read identical rows; if that proves infeasible offline, escalate rather than weaken the parity assertion.
- **Golden-fixture derivation from TS** (D3 §12 open-q 1): Phase 0 bootstraps `manifest.json` from `workflowSections.ts`; the neutral `tracks.json` promotion is deferred. Flag for the human at the Phase 0→1 gate.
- **`skipped` status semantics** (D3 §12 open-q 3): treated as legacy-only (explicit record) in `outline`; confirm at the gate.
