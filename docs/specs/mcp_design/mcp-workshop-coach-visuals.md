# Coach Visuals: Inline Diagrams and Tables for Genie Code (D12)

**Status:** Draft · **Date:** 2026-10-13 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md) · **Builds on:** Phase 2A adaptive coaching
([D1 §4.6](./mcp-workshop-interactivity.md), [D2 §12](./mcp-interface-contract.md)).
**Anchors verified** against `de70b96` (2026-10-13).

> **Why this doc.** The Vibe Coach (`vibe_explain_step(focus=...)`) answers in 2–5 sentences of
> prose. A learner who asks "show me" gets no picture, and the server rejects any reply that
> contains one. The coach should combine short explanations with a visual when a visual helps.
> Three rounds of rendering probes in Genie Code (§1) fixed what that visual can be. The same
> probes exposed a live defect: Genie Code renders the 36 Mermaid diagrams in the step help as
> raw code, with a Run button that fails when clicked (§2.3).
>
> The design follows the series doctrine: **zero new tools**, server-side and deterministic,
> fail-open, and **no Lakebase DDL or reseed** (§7).

---

## 1. Probe findings (authoritative; re-probe before changing)

Run by hand in Genie Code chat on 2026-10-13, in three rounds. The re-probe prompt is
[Appendix A](#appendix-a-re-probe-prompt).

| # | Finding | Consequence |
|---|---|---|
| F1 | **Mermaid does not render** in Genie Code chat. A ```` ```mermaid ```` fence shows as a code block and fails when run. | No Mermaid on the MCP surface. |
| F2 | Text outside a code fence is reflowed, and an ASCII diagram collapses to one line. | Every diagram goes inside a fence. |
| F3 | Fenced blocks are monospace and keep alignment. 80 columns fit the panel without wrapping. | Fenced text diagrams work. Cap at 60 columns for margin. |
| F4 | Box-drawing characters (`│ ─ ┐ ┘ ▼ ◀ ▶`) render cleanly, with no syntax colouring. | Use box-drawing characters, not `- \| + >`. |
| F5 | **Markdown tables render natively**, with no Run button and no colouring. | Prefer a table wherever the content is tabular. |
| F6 | Every fenced block gets a **▶ Run** button. Clicking it runs the block on compute, as **Python or SQL depending on context**, and diagrams fail (`SyntaxError: invalid character '◀'`, `PARSE_SYNTAX_ERROR near '#'`). | No comment prefix is a no-op in both languages, so the button can't be neutralised. Mitigate with a caption (§3.2) and by preferring tables. |
| F7 | The language tag doesn't matter: `text` and `plaintext` are coloured alike, using the context's language (Python or SQL keywords). A fence with no tag is not shown as code. | Always tag fences ```` ```text ````. Accept keyword colouring; it can't be avoided through word choice. |
| F8 | **Leading whitespace** draws indent guides and fold arrows (∨). | Every line starts at column 0. |
| F9 | Asked for an ASCII flow, the model draws straight chains acceptably. It draws loops wrong, adds steps nobody asked for, and indents unevenly even when given rules. | **The model never draws visuals.** The server draws them. |
| F10 | When the agent receives a prepared visual and is told to show it exactly, it does, apart from leading whitespace on the first line (covered by F8). | Visuals can ride in the tool result. |
| F11 | `displayHTML` + Mermaid from a CDN renders well in a **notebook cell**. | Out of scope. It needs compute, a notebook and CDN access, and leaves the chat (§4). |

Also observed: Genie Code appends its own follow-up suggestion buttons (e.g. "Create a Genie
space") that can pull a learner ahead of the current step. Not addressed here; see §8 q4.

---

## 2. Current state (grounded in code)

### 2.1 The coach is prose-only by construction

- `COACH_SYSTEM` asks for "2–5 sentences … Output prose only. No JSON, no markdown headings"
  (`src/backend/services/coaching.py:33-60`), with `COACH_MAX_TOKENS = 400` (`:65`).
- `_scrub_output` rejects any code fence (`coaching.py:194`). A diagram is a fence, so a model
  reply containing one is dropped and the learner gets the static fallback (`is_fallback: true`).
- `StepHelpResult.coaching` is `str | None`, and there is no visual field
  (`src/backend/mcp_server.py:213-229`).
- Quiz feedback in `vibe_submit_answer` is a fixed per-option string from
  `src/backend/workshop/interactions.json`.

### 2.2 One choke point for step help on MCP

`vibe_explain_step` (`mcp_server.py:1468-1564`) is the only MCP path that returns `how_to_apply`
and `expected_output`. The slim step payload leaves them out (`mcp_server.py:164`). It calls
`assembler.get_section_input_content(..., coding_assistant_override="genie-code")`
(`mcp_server.py:1526-1533`, `DEFAULT_CODING_ASSISTANT` at `:58`). The assembler then fills
placeholders into `how_to_apply` and `expected_output` (`src/backend/workshop/assembler.py:159-164`).

### 2.3 Live defect: Mermaid in the step help

An audit of `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` found **36** Mermaid fences,
all in **default** rows: **32 in `how_to_apply` and 4 in `expected_output`**. None are in prompt
bodies. Genie-code fork rows can't override them, because shared fields "are ALWAYS read from the
Default row" (seed header rule 4, `:78-81`).

| Track | Steps in the default outline carrying Mermaid |
|---|---|
| genie-accelerator | **19** (22 with optional flags) |
| end-to-end | 8 |
| reverse-app | 7 |
| app-database, agents-accelerator | 5 each |
| app-only, reverse-lakebase | 2 each |
| lakehouse-di, accelerator, reverse-lakehouse-di | 1 each |

Three tagged rows are on no track: `gaccel_productionize`, `gagent_share`,
`semlayer_metric_view_importbi`.

The diagrams are small: 4–9 lines each, apart from one 12-line diagram. 35 are flowcharts (3 of
them written with the `graph` keyword, each with one subgraph), and 1 is an ER diagram
(`semlayer_profile.expected_output`). Every one can be
converted by hand. The web UI renders them through `src/components/MermaidDiagram.tsx` and must
keep doing so.

These 36 diagrams are also the **hand-written per-step concept diagrams** this design needs
(§3.5). Converting them fixes the defect and builds the curated library in one pass.

---

## 3. Design

### 3.1 Invariants

1. **Inline only.** Visuals live in the chat as markdown tables or fenced box-drawing diagrams
   (F1–F5, F11).
2. **The server draws; the model explains.** Visuals are built from the manifest, the session
   state, or reviewed text in the repo (F9). The model writes prose and may refer to the visual.
3. **Labels never carry learner content.** Labels come only from manifest step titles and output
   key names, never from captured output values, sample data or benchmark text (D7 §6 firewall).
   No extra scrub is needed.
4. **Fail-open.** Any visual error yields `visual: null` and a log line, never a tool error.
   This is the same contract as coaching (D-22).
5. **Zero new tools, no DDL, no reseed.** New optional fields and one optional argument on an
   existing tool. Deploy-only rollout.
6. **The web UI is unchanged.** Mermaid keeps rendering there. Only the MCP surface swaps.

### 3.2 Format rules (enforced by `lint_visual`)

Two visual kinds:

- **`table`**: a GitHub-flavoured markdown table. Preferred, because it has no Run button and no
  colouring (F5).
- **`diagram`**: a ```` ```text ```` fenced block that passes every rule below.

| Rule | Limit | Source |
|---|---|---|
| Fence | Opens with ```` ```text ````, closes with ```` ``` ```` | F2, F7 |
| Column 0 | No line inside the fence starts with whitespace | F8 |
| Width | Every line ≤ 60 characters (`len()`; box-drawing glyphs are one column) | F3 |
| Height | ≤ 20 lines inside the fence | readability |
| Characters | Printable ASCII except backtick, plus `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ▼ ▲ ◀ ▶` | F4 |
| Arrows | No ASCII arrows or `--` (`-->`, `->`, `--`); use `─▶`, `▼`, `◀─` | F4, F7 |
| Whitespace | No tabs, no trailing whitespace | F8 |
| Placeholders | No `{...}` template placeholders, because filled-in width is unknown | §2.2 |
| Caption | `visual_caption` is required. For diagrams it starts with `Diagram only, nothing to run.` | F6 |

Tables: ≤ 8 data rows, ≤ 3 columns, cell text ≤ 40 characters, no fences inside cells.

### 3.3 Visual shapes

Four builders in a new module, `src/backend/services/coach_visuals.py`. All inputs come from
`engine.outline`, `engine._ordered_steps`, `Step.consumes`/`produces`, `completed_gates` and
`captured_outputs` **keys**. The examples below are illustrative.

**Progress table** (`table`): the last done step, the current step, the next two, and a summary
row.

| Step | Status |
|---|---|
| PRD Generation | Done |
| **Locate Data & Bring Context** | **Now** |
| Profile Your Schema | Next |
| Measures Analysis | Next |
| 19 more steps | Later |

Caption: `3 of 24 steps done. The data steps start now.`

**Unblock checklist** (`table`): the step's prerequisite gate, each `consumes` key (present or
missing in `captured_outputs`), and whether the use case is locked when the step needs it.
Key names become labels by replacing underscores (`prd_document` → `PRD document`).

| Needs | Status |
|---|---|
| Previous step: PRD Generation | Done |
| Input: PRD document | Missing |

**Downstream chain** (`diagram`): the current step, then the steps that transitively consume its
`produces` key, in outline order, at most 5 nodes. If nothing consumes it, show the next 4 steps.
An optional side note goes on the last line only.

```text
Draft the Metric View
│
▼
Review & Expand Synonyms
│
▼
Author Instructions
│
▼
Add Verified Queries ─▶ wrong measures surface here
```

**Built-so-far chain** (`diagram`): the last ≤ 6 done steps in outline order, each with its
produced key as a side note when the line stays ≤ 60 characters.

```text
Set Up Project
│
▼
PRD Generation ─▶ PRD document
│
▼
Locate Data & Bring Context
```

**Loop chain**: a chain with one back-edge on the right, used by curated diagrams such as the
optimize loop. This exact layout was verified in probe round 3:

```text
Write instructions ◀──────┐
│                         │
▼                         │
Add verified queries      │
│                         │
▼                         │
Load benchmarks           │
│                         │
▼                         │
Benchmarks at target ─ no ┘
│
yes
▼
Done
```

### 3.4 Which visual for which request

| `focus` | `visual="auto"` | `visual="table"` | `visual="diagram"` |
|---|---|---|---|
| `what_now` | Progress table | Progress table | Curated diagram for the step (§3.5), else downstream chain |
| `why` | Curated diagram, else downstream chain | Progress table | Curated diagram, else downstream chain |
| `unblock` | Unblock checklist | Unblock checklist | Curated diagram, else downstream chain |
| `review` | Built-so-far chain | Progress table | Built-so-far chain |
| none (static help) | no visual | Progress table | Curated diagram, else downstream chain |

`visual` defaults to `"auto"` when `focus` is set, and to `"none"` when it isn't, so static help
with no arguments is unchanged (D-23). A visual without `focus` makes **no model call**.

### 3.5 Mermaid twins on the MCP surface

The fix for §2.3: each Mermaid fence gets a hand-converted **twin**, a diagram or table that
passes `lint_visual`. The twin replaces the fence only when serving MCP.

- **Storage (in the repo, not Lakebase):** `src/backend/workshop/mcp_visuals/`, one file per twin,
  named `<section_tag>.<field>.<n>.txt` (or `.md` for a table twin). `<field>` is `how_to_apply`
  or `expected_output`, and `<n>` is the 1-based position of the fence within that field. An
  `index.json` maps each name to the `sha256` of its source Mermaid body: lines joined with `\n`,
  trailing whitespace stripped.
- **Where the swap happens:** in the assembler, **before** placeholder substitution
  (`assembler.py:159`), so the hash is checked against the raw template. Add an optional
  `render_target: Literal["web", "mcp"] = "web"` argument to `get_section_input_content`, and
  pass `"mcp"` from `vibe_explain_step` only. Every web caller keeps the default, so its output
  is byte-identical.
- **Swap rule, for each ```` ```mermaid ```` fence in `how_to_apply`/`expected_output`:**
  - If a twin exists **and** its hash matches, replace the fence with the twin.
  - Otherwise (no twin, or the hash differs because the row was edited in the Config UI), replace
    it with the line `(This step has a diagram in the workshop web UI.)` and log one WARNING
    naming `section_tag`, field and position, never content.
  - **Raw Mermaid never reaches MCP.**
- **Conversion guidance:** turn left-to-right flows top-to-bottom, so they fit in 60 columns.
  Drop `<br/>` and wrap long labels into a shorter label. Render subgraphs as a short label line
  above their nodes. The ER diagram becomes a table twin (Entity | Key columns | Relates to).
  Placeholders such as `{lakehouse_default_catalog}` become a generic phrase, e.g. `your gold
  schema` (§3.2).
- **Coach reuse:** the twin for a step's `how_to_apply` is that step's **curated diagram** in
  §3.4. A step with several twins uses the first.

### 3.6 Interface changes (D2 amendment)

`StepHelpResult` (`mcp_server.py:213`) gains three optional fields. `extra="forbid"` stays.

```python
visual: str | None = None            # markdown table, or a ```text fenced diagram
visual_kind: Literal["table", "diagram"] | None = None
visual_caption: str | None = None    # takeaway; diagrams prefixed "Diagram only, nothing to run."
```

`vibe_explain_step` gains `visual: Literal["auto", "none", "table", "diagram"] | None = None`
(defaults per §3.4). An invalid value returns `INVALID_PARAMETER`, as `focus` does
(`mcp_server.py:1491`). Description addition, kept short because the description is the prompt:

> Pass `visual` (table|diagram) when the learner asks to see, show, draw or map something.
> Present `coaching`, then `visual` exactly as given, then `visual_caption`.

`COACH_SYSTEM` addition. The prose stays 2–5 sentences, and the scrub is **unchanged**:

> If the CONTEXT has `visual`, a visual is shown after your text. You may point to it ("the table
> below"). Never draw one, and never describe it line by line.

`build_context` adds `visual: <kind>, <caption>` when a visual was built. The visual is built
**before** the model call, so the prose can refer to it.

`vibe_submit_answer` is unchanged in this increment (§8 q3).

### 3.7 Operations

- **Kill switch:** `VIBE_COACH_VISUALS_ENABLED`, read per call, with the same parsing as
  `VIBE_COACHING_ENABLED` (`coaching.py:78-81`). When off, `visual` is always null. The twin swap
  (§3.5) is a defect fix and is **not** behind this switch.
- **Telemetry:** add `visual=<kind|none>` to the existing `coaching timings` log line
  (`coaching.py:513`). No `session_interactions` schema change.
- **Payload size:** tables are ≤ 8 rows and diagrams ≤ 20 × 60 characters, so at most about
  1.3 KB is added per call.

---

## 4. Non-goals

- Mermaid, HTML or images in Genie Code chat (F1, F11).
- Notebook-based visuals (`displayHTML`, `%md` cells). This could return later as an optional
  "open the full diagram" link.
- Model-drawn or model-edited diagrams (F9).
- Charts of the learner's data. The agent can build those in the workspace if the learner asks;
  the coach may suggest it in prose.
- Any change to the web UI or its Mermaid rendering.
- Visuals in the slim step payload (`vibe_get_step`/`vibe_next_step`).

---

## 5. Implementation plan

Three PRs, in order. Each is independently revertible.

**PR 1: Mermaid twins and MCP swap (defect fix).**
- `src/backend/workshop/mcp_visuals/`: 36 twins plus `index.json`.
- `lint_visual` (in `coach_visuals.py`, or a small shared module PR 2 imports).
- The `render_target` argument on the assembler and the swap; `vibe_explain_step` passes `"mcp"`.
- Exit: no ```` ```mermaid ```` in any MCP-served help on any track; web output byte-identical;
  every twin passes the lint.

**PR 2: coach visuals.**
- `coach_visuals.py` builders (§3.3), the selection logic (§3.4) and the kill switch.
- The `StepHelpResult` fields, the `visual` argument, the description wording, and the
  `COACH_SYSTEM` and `build_context` additions.
- Exit: the contract tests and snapshot tests pass, and any visual failure leaves the tool
  result valid with `visual: null`.

**PR 3: docs and human smoke.**
- An amendment to D2 (§12 and the `vibe_explain_step` IDL) and a note in D1 §4.6.
- Row 16 for this doc in the series README.
- A D8 human-smoke entry using Appendix A, and decision-log entries.
- Exit: the human-smoke screenshots pass the §6.3 checklist.

---

## 6. Tests

### 6.1 Unit and contract

- **Lint:** each rule in §3.2 has a passing case and a failing case.
- **Builders:** snapshot tests for each shape on fixed session states (fresh, mid-track,
  all-done, blocked), and every output passes `lint_visual`.
- **Selection:** a test covering each row of the §3.4 matrix, including that no-focus with no
  `visual` returns exactly today's fields.
- **Fail-open:** a builder that raises yields `visual: null`, and the coaching text is still
  returned.
- **Kill switch:** when off, there is no visual, and the twin swap still applies.
- **No model call** for a visual-only request (no `focus`).

### 6.2 Twin coverage (CI guard)

- Parse every default row of the seed SQL. For each Mermaid fence in `how_to_apply` or
  `expected_output`, assert a twin exists whose `index.json` hash matches. Reuse an existing seed
  parser if there is one; otherwise add a small test helper that handles `''` escaping inside
  quoted values.
- Every twin passes `lint_visual`, and there are no orphan twins without a matching fence.
- For every section tag on every track, `vibe_explain_step` output contains no
  ```` ```mermaid ````.
- A web-path regression test: assembler output with `render_target="web"` is unchanged.
- A test of the fallback line on a hash mismatch.

**Effect:** anyone who adds or edits a Mermaid diagram in the seed must add or refresh its twin
in the same PR.

### 6.3 Human smoke (Genie Code)

Paste Appendix A into Genie Code and pass all of these:

- [ ] The progress table renders as a table, with no ▶.
- [ ] Every diagram is aligned, with no indent guides or fold arrows.
- [ ] Every diagram caption starts with "Diagram only, nothing to run."
- [ ] On a live session, `focus=why` on `semlayer_metric_view` shows prose, then the twin
      diagram, then the caption, with no raw Mermaid anywhere.
- [ ] `focus=unblock` shows the checklist table.

---

## 7. Rollout

| Change | Reseed | DDL | Redeploy |
|---|---|---|---|
| PR 1 twins and swap | No | No | Yes |
| PR 2 coach visuals | No | No | Yes |
| PR 3 docs | No | No | No |

**Rollback:** set `VIBE_COACH_VISUALS_ENABLED=0` for PR 2, or revert the PR. Reverting PR 1
brings the raw Mermaid back on MCP.

**STOP and ask the human before:**
- any DDL, reseed or new tool;
- any change to the `coaching.py` scrub rules;
- any change to web-path output;
- deploying.

---

## 8. Open questions

1. **Should `auto` attach a visual to every focused call?** The proposal is yes (§3.4). Revisit
   after the smoke if replies feel crowded.
2. **Who signs off on the 36 twins?** The proposal is that the human reviews the PR 1 diff. The
   twins are short text files, so the review is quick.
3. **Should quiz feedback (`vibe_submit_answer`) get visuals?** Deferred. Its coaching is
   static, and a curated table per decision point would be a separate small increment.
4. **Genie Code's own suggestion buttons** can pull learners ahead (§1). Should
   `STEP_WAIT_DIRECTIVE` tell the agent to ignore them? This is a separate follow-up.

---

## 9. Evidence

- Probe rounds 1–3, run by hand in Genie Code chat on 2026-10-13. The screenshots are held by
  the human and not committed. The findings are recorded in §1.
- Seed audit (2026-10-13): fences mapped to `(input_id, section_tag, column)` by parsing the
  `INSERT … VALUES` tuples of `02_seed_section_input_prompts.sql`. Result: 36 fences, 32 in
  `how_to_apply` and 4 in `expected_output`, all in `__default__` rows.
- Per-track reach: computed from `engine.MANIFEST.track_steps` and `engine._ordered_steps` with a
  fresh `SessionState`.

---

## Appendix A: Re-probe prompt

Paste this into Genie Code chat. It checks F2–F8 and the shapes in §3.3. Re-run it after a Genie
Code release and before changing any rule in §3.2.

````text
Don't call any tools. Reproduce everything between BEGIN and END exactly, character for character, with no commentary and no changes to spacing.

BEGIN

| Step | Status |
|---|---|
| PRD Generation | Done |
| **Locate Data & Bring Context** | **Now** |
| Profile Your Schema | Next |

```text
Write instructions ◀──────┐
│                         │
▼                         │
Add verified queries      │
│                         │
▼                         │
Load benchmarks           │
│                         │
▼                         │
Benchmarks at target ─ no ┘
│
yes
▼
Done
```

Diagram only, nothing to run. The optimize loop repeats until benchmarks hit the target.

END
````

Pass: the table renders natively; the diagram is aligned, with no indent guides; the caption
shows as plain text.
