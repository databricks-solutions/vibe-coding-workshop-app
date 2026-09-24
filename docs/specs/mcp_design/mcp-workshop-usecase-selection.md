# Use-Case Discovery & Cross-Surface Sync (D11)

**Status:** Draft · **Date:** 2026-09-23 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md) · **Phase:** **2B — recommended next increment** (a decoupled,
additive fast-follow on shipped Phase 2; see [D9 §1](./mcp-workshop-rollout.md#1-revised-phasing-elicitation-decoupled)).
Genie Accelerator now; **generalizing `use_case_selection` to all ten tracks is Phase 4**; the full
UI-repoint that makes cross-surface sync *canonical* is **Phase 3** (this doc ships the **bridge**).
**Anchors verified live 2026-09-23** against this checkout.

> **Why this doc.** The first live Genie Code smoke exposed two gaps the D1–D10 series did not
> cover: (1) the agent **jumped straight to PRD** because there is no in-band way to discover, pick,
> or author a use case — it silently fell back to a default; and (2) the human asked whether the
> **MCP surface and the web app can stay in step-sync** when a learner switches between them. This
> doc designs both. It follows the series doctrine: **reuse the one repository and the existing
> tool set; add zero new tools** (the ≤7-tool budget, [charter guardrail 7](./polly-build-charter.md)).

---

## 1. The problem, grounded in code

### 1.1 The PRD jump

`vibe_start_track(track, use_case?, industry?)` (`mcp_server.py:486`) stores `use_case`/`industry` as
free strings in `session_parameters` — and when absent, everything downstream falls back to
`DEFAULT_INDUSTRY = "Technology"` / `DEFAULT_USE_CASE = "Genie Accelerator"`
(`mcp_server.py:37-38`). `_step_payload` (`mcp_server.py:~435`) reads those keys and calls
`assembler.get_section_input_content(industry, use_case, section_tag, …)`, so **every step —
including PRD — renders against whatever use case is in the session**. With no selection tool and
no gate, the agent completes `project_setup` (environment config, `produces: null`) and proceeds to
`prd_generation` (`produces: "prd_document"`), authoring a PRD for the **default** use case.

The shared section is identical in **all ten tracks** — `define-usecase` = `project_setup` →
`prd_generation` (e.g. genie-accelerator `manifest.json:1786-1815`). Nothing currently produces a
`use_case`-shaped artifact, and `prd_generation.consumes = []`.

### 1.2 What already exists (SPA/HTTP only — MCP can't reach it)

| Surface | Curated repository | Community / author-your-own |
|---|---|---|
| **Store** | `usecase_descriptions` (`db/lakebase/ddl/01_usecase_descriptions.sql`): `industry`, `use_case`, labels, `prompt_template`, `category`, `is_certified`, `path_type` | `saved_usecase_descriptions` (`db/lakebase/ddl/05_saved_usecase_descriptions.sql`): "Build Your Use Case [Beta]" |
| **Read** | `GET /industries` (`routes.py:1924`), `GET /use-cases/{industry}` (`routes.py:1938`), `GET /prompt-template/{industry}/{use_case}` (`routes.py:1955`) via `get_industries()` / `get_use_cases_map()` | `GET /usecase-builder/list` (`routes.py:6901`), `get_all_saved_usecases()` (`lakebase.py:2196`) |
| **Write** | admin CRUD `POST /config/industries` (`:2997`), `/config/use-cases` (`:3035`) | `POST /usecase-builder/generate` (LLM SSE, `:6845`), `/save` (`:6877`, `save_usecase_builder_description` `lakebase.py:2164`) |

In the SPA the learner picks industry → use case (or authors one) **before** the workshop, and that
choice parameterizes every step. The MCP engine has **no equivalent** — that pre-workshop step is
simply missing in-band.

---

## 2. Decisions (locked with the human, 2026-09-23)

1. **Custom use cases stay session-local.** Authoring "your own" writes only to `session_parameters`
   + the `use_case_brief` artifact for *this* session. It does **not** auto-publish to
   `saved_usecase_descriptions`. (An explicit opt-in "publish to the community library" can come
   later; out of scope here.)
2. **Certified use cases are the recommendation.** The selection interaction leads with `is_certified`
   options and names one as the `recommended` default — the recommend-and-proceed doctrine
   ([D5 §3](./mcp-workshop-pedagogy.md)); the track never blocks on the choice except that PRD cannot
   start until *some* use case is locked (§4.3).
3. **Flow starts from industry.** Offer **industries first** → then **use cases for that industry**
   (certified-first) → plus an explicit **"make your own"** option. Two-hop selection.
4. **`use_case_brief` is track-agnostic.** Verified: the `define-usecase` section is byte-identical
   across all ten tracks, so the artifact and the step live in the **shared** section, produced once
   and consumed by `prd_generation` (and available downstream via the engine's produces/consumes
   resolution).

---

## 3. Design — a shared use-case layer with **zero new tools**

The ≤7-tool budget is a hard guardrail. Read-only listings become **resources** (budget-free) and
mutation reuses the **existing** tools. The only new surfaces are two resources, one manifest step,
and one interaction block.

### 3.1 Resources (budget-free) — "propose options"

Backed by the **same** repository seams the HTTP routes use — one source of truth, no fork:

| Resource URI | Returns | Reuses |
|---|---|---|
| `vibe://usecases/industries` | industry options (`value`/`label`) | `get_industries()` (`routes.py:1935`) |
| `vibe://usecases/{industry}` | use cases for an industry, **certified-first**, each with `value`/`label`/`category`/`is_certified`/short description | `get_use_cases_map()` (`routes.py:1950`) |

(Optional, deferred: `vibe://usecases/{industry}/{use_case}` for a prompt-template preview via the
assembler/`section-metadata` path. Not required for v1.)

### 3.2 A shared `use_case_selection` step (manifest, additive)

Insert one step into the shared `define-usecase` section, **before** `prd_generation`:

```
define-usecase:
  project_setup        (unchanged; environment config; produces: null)
  use_case_selection   (NEW; produces: "use_case_brief")   ← industry → use case → or author own
  prd_generation       (consumes: ["use_case_brief"]; requiresGate: use_case_selection)
```

**Phase 2B scope:** make this edit on the **Genie Accelerator** track only (`manifest.json:1786-1815`).
The same edit generalizes to the other nine `define-usecase` blocks in **Phase 4** — preferably by
hoisting a shared section definition so it is authored once (D9 §1; open q1). `prd_generation`
gains `consumes: ["use_case_brief"]` and `requiresGate: "use_case_selection"`; today both are empty
(`manifest.json:1809-1815`).

### 3.3 The `use_case_brief` artifact (track-agnostic shape)

Stored in `captured_outputs["use_case_brief"]` on `vibe_complete_step`; read by downstream steps via
the engine's produces/consumes resolution.

```json
{
  "industry": "retail",
  "industry_label": "Retail & CPG",
  "use_case": "demand_forecasting",
  "use_case_label": "Demand Forecasting",
  "source": "curated",              // "curated" | "custom"
  "is_certified": true,
  "description": "…",               // present for source=custom (the authored brief)
  "selected_at": "2026-09-23T…Z"
}
```

Because the assembler already keys on `industry`/`use_case` in `session_parameters`, the brief's job
is to **lock and record** the choice (gate + provenance + downstream narrative), not to re-plumb
rendering.

### 3.4 The interaction block (`interactions.json`, recommend-and-proceed)

A `decision` interaction on `use_case_selection`: pick industry, then pick a use case (certified as
`recommended`) **or** choose "author your own". Enforced by the **existing** blocking-interaction
gate — `vibe_complete_step` already refuses with `GATE_REQUIRED` until the decision is captured
(`mcp_server.py:613-625`), and `vibe_submit_answer` already records decisions and unblocks
(`mcp_server.py:675`). No new gate machinery.

### 3.5 The flow — reuses `vibe_get_step` / `vibe_submit_answer` / `vibe_set_parameters` / `vibe_complete_step`

```mermaid
sequenceDiagram
  participant U as Learner
  participant GC as Genie Code
  participant MCP as MCP adapter
  participant R as Resources
  participant DB as Lakebase
  GC->>MCP: vibe_get_step (→ use_case_selection)
  MCP-->>GC: prompt + interaction "pick your use case"
  GC->>R: read vibe://usecases/industries
  GC->>U: "Which industry?" (options)
  U-->>GC: picks industry
  GC->>R: read vibe://usecases/{industry}
  GC->>U: use cases (certified first, recommended) + "make your own"
  U-->>GC: picks curated OR authors own (drafted in-chat by the agent)
  GC->>MCP: vibe_set_parameters {industry, use_case, use_case_label[, description]}
  MCP->>DB: session_parameters updated
  GC->>MCP: vibe_submit_answer {use_case_selection decision}   (unblocks)
  GC->>MCP: vibe_complete_step {use_case_selection, captured_output=<use_case_brief>}
  MCP->>DB: captured_outputs["use_case_brief"] ; completed_gates += use_case_selection
  MCP-->>GC: next → prd_generation (now renders against the LOCKED use case)
```

**"Make your own" is in-band with no server LLM.** The client agent (Genie Code is itself an LLM)
drafts the custom use case conversationally, then locks it via `vibe_set_parameters` +
`vibe_complete_step`. This honors decision #1 (session-local) and adds no tool. The SPA's richer
LLM builder (`/usecase-builder/generate`) remains the heavyweight authoring path on the web surface.

### 3.6 Net effect

`prd_generation` can no longer start against a default: it is gated on `use_case_selection` and
consumes `use_case_brief`. The exact symptom from the smoke — "why did it create the PRD already" —
is closed by construction.

---

## 4. Cross-surface step sync (answer to "can they see which step they're on?")

**Yes — and it is precisely what Phase 3 is for** ([D4 §3.3](./mcp-workshop-architecture.md#33-cross-surface-live-sync),
[D3 §4.3](./workshop-engine-domain.md)): repoint the SPA to read the engine's state so both surfaces
render the *same* progress off the *same* session row.

### 4.1 What already lines up

Both surfaces persist to the **same** `sessions` table (`db/lakebase/ddl/03_sessions.sql`), keyed by
`session_id`, scoped to the OBO user via `created_by`. So:

- **Discovery/handoff works today.** The SPA can enumerate a user's sessions — including
  MCP-created ones — via `get_user_sessions(created_by)` (`lakebase.py:1046`) /
  `get_user_default_session(created_by)` (`lakebase.py:1129`); and MCP can resume an SPA session via
  `vibe_start_track(session_id=…)` (`mcp_server.py:486`). Same row, same user.

### 4.2 The gap: two progress representations on one row

| | Progress model | Written by |
|---|---|---|
| **Legacy SPA** | `current_step` INTEGER + `completed_steps` (int list) (`03_sessions.sql`) | SPA save-session |
| **MCP engine** | `captured_outputs` + `completed_gates` (JSONB; `12_mcp_engine_state.sql`) | `vibe_complete_step` (`mcp_server.py:642-646`) |

Today MCP writes `completed_gates`/`captured_outputs` but **not** `current_step`/`completed_steps`,
so the legacy SPA step indicator stays at step 1 even after MCP progress (and vice versa). Same row,
different fields — no reconciliation.

### 4.3 Recommendation — a small bridge now, the full repoint in Phase 3

1. **Bridge (small, additive, ships the ask immediately):** in `vibe_complete_step`, also update
   `current_step`/`completed_steps` derived from the section's order in the manifest, so the
   *existing* SPA reflects MCP progress with no SPA rewrite. `save_session` already accepts both
   (`lakebase.py:592`, `current_step`/`completed_steps` params) and its `COALESCE` upsert is
   safe to extend.
2. **Canonical (Phase 3):** add the engine-backed `GET /api/track/{track}/outline?session_id`
   ([D4 §3.3](./mcp-workshop-architecture.md#33-cross-surface-live-sync)) and repoint the SPA to
   render `completed_gates`/current section from the engine — making the section/gate model the one
   source of truth and the sync bidirectional.
3. **Live refresh:** polling for v1 ([D4 §7 q1](./mcp-workshop-architecture.md)), SSE later.

Deliverable: a learner mid-track in Genie Code can open the web app, land on their session, and see
the same step highlighted — and the reverse.

---

## 5. Reuse map (one repository, one engine — no forks)

| Need | Reuse | Anchor |
|---|---|---|
| List industries | `get_industries()` | `routes.py:1935` |
| List use cases (certified-first) | `get_use_cases_map()` | `routes.py:1950` |
| Community library (read) | `get_all_saved_usecases()` | `lakebase.py:2196` |
| Lock choice into session | `vibe_set_parameters` | `mcp_server.py:748` |
| Gate + record decision | `vibe_submit_answer` + `blocking_interactions` | `mcp_server.py:675`, `613-625` |
| Produce `use_case_brief` | `vibe_complete_step` | `mcp_server.py:603` |
| Render step against locked UC | `assembler.get_section_input_content` | `routes.py:1241` |
| Shared session store / handoff | `save_session` / `load_session` / `get_user_sessions` | `lakebase.py:592 / 828 / 1046` |

---

## 6. Test seams (extend D8)

- **Manifest parity:** `use_case_selection` present in the **Genie Accelerator** `define-usecase`
  (Phase 2B scope; all-tracks in Phase 4), ordered before `prd_generation`,
  `produces: "use_case_brief"`; `prd_generation.consumes` includes it and
  `requiresGate == "use_case_selection"`.
- **Resources:** `vibe://usecases/industries` and `vibe://usecases/{industry}` return certified-first
  options off a seeded fixture (mock the repository seam; offline).
- **Gate:** `vibe_complete_step("prd_generation", …)` before selection → `STEP_LOCKED`;
  `vibe_complete_step("use_case_selection", …)` before the decision → `GATE_REQUIRED`; after
  `vibe_submit_answer` + `vibe_set_parameters` → PRD unlocks and renders against the chosen UC.
- **Custom = session-local:** authoring path writes `session_parameters` + `use_case_brief` only;
  asserts **no** row in `saved_usecase_descriptions`.
- **Sync bridge:** `vibe_complete_step` updates `current_step`/`completed_steps`; a legacy
  `get_user_default_session` read reflects MCP progress.

---

## 7. Open questions (resolved 2026-09-23 unless noted)

1. **Where does the step live** — **RESOLVED:** implement `use_case_selection` on the
   **Genie Accelerator (`DEFAULT_TRACK`) only** in Phase 2B (it's the sole active track and the
   defect surface); **hoisting a shared `define-usecase` definition across all ten tracks is Phase 4**
   ([D9 §1](./mcp-workshop-rollout.md#1-revised-phasing-elicitation-decoupled)).
2. **Industry taxonomy source** — **RESOLVED:** use the curated `get_industries()` list
   (`routes.py:1935`) for `vibe://usecases/industries`, for parity with the SPA.
3. **Bridge vs. full repoint ordering** — **RESOLVED:** ship the `current_step` bridge (§4.3.1) in
   Phase 2B (small, unblocks the human's sync ask); the Phase 3 UI-repoint then **subsumes** it and
   makes sync canonical/bidirectional.
4. **Custom-UC publish opt-in** *(open)* — a later, explicit "publish this to the community library"
   affordance (write to `saved_usecase_descriptions`) is out of scope for 2B; confirm if/when wanted.

---

## 8. Charter task for Polly (paste-ready)

```text
────────────────────────────────────────────────────────────────────────────
POLLY TASK — USE-CASE SELECTION STEP + CROSS-SURFACE STEP SYNC (D11)
────────────────────────────────────────────────────────────────────────────
SCOPE  Add an in-band use-case discovery/selection stage before PRD, and bridge
       MCP↔SPA step progress. Design source: docs/specs/mcp_design/
       mcp-workshop-usecase-selection.md (D11). Repo reality wins; /investigate
       and re-confirm every anchor before editing.

GUARDRAILS (inherit ALL from polly-build-charter.md; these are the load-bearing ones)
- ≤7 TOOLS, DO NOT ADD AN 8th. Listings are RESOURCES; mutation reuses EXISTING
  tools (vibe_set_parameters / vibe_submit_answer / vibe_complete_step). (Gd 7)
- ONE REPOSITORY, ONE ENGINE, ONE ASSEMBLER — reuse get_industries()/
  get_use_cases_map()/get_section_input_content; never fork. (D3 §7)
- ADDITIVE DATA ONLY; migrations idempotent (IF NOT EXISTS). (Gd 12)
- RECOMMEND-AND-PROCEED: certified UC is the recommended default; never block
  except the existing PRD-needs-a-locked-UC gate. (D5 §3)
- CUSTOM UC STAYS SESSION-LOCAL — no write to saved_usecase_descriptions.
- NO local server; pin deps EXACT; no CI → run pytest tests/workshop and PASTE
  results in every PR. HARD STOPS: deploy, reseed, live Genie Code smoke. (Gd 13)

TASKS (TDD: failing test → implement minimal → run → commit; ONE PR PER TASK)
1. manifest: add `use_case_selection` step (produces "use_case_brief") before
   prd_generation in the define-usecase section of the GENIE ACCELERATOR track
   ONLY (DEFAULT_TRACK; all-tracks hoist is Phase 4, open q1); set
   prd_generation.consumes=["use_case_brief"], requiresGate="use_case_selection".
   Test: manifest-parity per §6.
2. resources: vibe://usecases/industries + vibe://usecases/{industry}
   (certified-first) in mcp_server.py, backed by get_industries()/
   get_use_cases_map(). Test: certified-first ordering off a fixture (offline).
3. interaction: add the use_case_selection decision block to interactions.json
   (certified recommended + "author your own"); wire the existing
   blocking-interactions gate. Test: GATE_REQUIRED before decision.
4. lock + produce: extend vibe_set_parameters handling (industry/use_case/label/
   description) and confirm vibe_complete_step writes captured_outputs
   ["use_case_brief"]. Test: PRD renders against the chosen UC; custom path
   writes no saved_usecase_descriptions row.
5. sync bridge: vibe_complete_step also updates current_step/completed_steps
   (derived from manifest section order) via save_session. Test: legacy
   get_user_default_session reflects MCP progress. (§4.3.1)
6. (defer/optional, Phase 3) engine-backed GET /api/track/{track}/outline?
   session_id + SPA repoint (D4 §3.3). Human decides ordering (open q3).

CADENCE  Summarize PRs + pasted pytest results after each task; STOP at any
         hard stop and wait for the human.
────────────────────────────────────────────────────────────────────────────
```
