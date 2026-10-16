# Section Prompt Style Guide

> Companion to `section_template.md`. Apply to every file in `apps_lakebase/prompts/sections/` that is `is_active: true`.

## Round-Trip Constraint (critical)

`apps_lakebase/prompts/sync_markdown_to_seed.py::_parse_body_sections` splits the body on:

```regex
^---\s*\n+## (System Prompt|Input Template|How to Apply|Expected Output)\s*\n
```

**Implications:**
- The four canonical `## H2` headings (`System Prompt`, `Input Template`, `How to Apply`, `Expected Output`) are **markers**, not freely repeatable headings.
- All teaching content (numbered `1️⃣`–`4️⃣` blocks, diagrams, tables) lives **inside** `## How to Apply`.
- `---` separators between numbered blocks are fine as long as the next line is NOT one of the four canonical headings.

## Heading Numbering

Use circled-emoji numbering for the four teaching sub-blocks:

| Block | Heading | Required |
|-------|---------|----------|
| 1 | `## 1️⃣ How To Apply` | yes |
| 2 | `## 2️⃣ What Are We Building?` | yes |
| 3 | `## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)` | yes |
| 4 | `## 4️⃣ What Happens Behind the Scenes?` | yes |

The Tier A exemplars (09, 12, 13, 14) all use this exact wording. Do not paraphrase.

## ASCII Art

- Width: 75 columns max (fits VS Code default and GitHub render).
- Glyph set: `┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ─ │`. No Unicode emojis inside the box.
- Top + bottom borders: full-width `─`. Title centered between `┌` and `┐` on row 1.
- Inside content: indent 2 spaces from `│`.
- Reference: `09-gold_layer_design.md` "Gold Layer Architecture" diagram.

## "Why This Way?" Table

Two columns, exactly: `Practice` and `How It's Used Here`. Bold the practice name. Reference: `12-gold_layer_pipeline.md` lines 122-133.

## Key Concepts Table

Three columns: `Concept | What It Means | Why It Matters`. Reference: `14-aibi_dashboard.md` "Key Concepts" table.

## Gate Contract Table (Track A / MLflow SDLC only)

Three columns: `Reads gate | Produces gate | Captured state`. Surfaces the `vibecoding-state.enter` / `exit` gate chain visually. The values are extractable from the existing `## Input Template` block — do not invent.

## Success Criteria Checklist

Use `- [ ]` (GFM checkbox) grouped under bold sub-headers (`**ERD Artifacts:**`, `**YAML Schemas:**`, etc.). Reference: `09-gold_layer_design.md` lines 296-323.

## Forbidden Patterns

- ❌ A new `## System Prompt` / `## Input Template` / `## How to Apply` / `## Expected Output` H2 outside its canonical position (corrupts SQL round-trip).
- ❌ ASCII art using `═ ║ ╔ ╗` (double-line) — sticks out from the existing diagrams.
- ❌ Inline emojis inside ASCII boxes.
- ❌ Best-practices tables with more than two columns.

## Course Framing Voice

- **Track A (38–46)** = "Agents 101". Tone: hands-on, "we're building a custom agent on Databricks Apps". Link concepts to MLflow tracing, OpenAI Agents SDK, OBO auth, Lakebase memory.
- **MLflow SDLC (47–56)** = "Agents 201". Tone: lifecycle-aware, "production GenAI". Link concepts to UC governance, prompt registry aliases, scorer alignment, AI Gateway, agent-as-judge.

## Anchor Exemplars (read before authoring)

- `apps_lakebase/prompts/sections/09-gold_layer_design.md` — diagram + phase table + orchestrator pattern + success checklist
- `apps_lakebase/prompts/sections/12-gold_layer_pipeline.md` — best-practices table + verification SQL
- `apps_lakebase/prompts/sections/13-usecase_plan.md` — agent-layer architecture diagram + addendum table
- `apps_lakebase/prompts/sections/14-aibi_dashboard.md` — key-concepts table + dashboard JSON example

## Input Template Pattern (Track A / MLflow SDLC files)

The 19 in-scope files (`38–46`, `47–56`) use a **3-layer sandwich** for the body of `## Input Template`. The shape mirrors `13-usecase_plan.md` lines 25–37 (Tier A reference).

### Layer 1 — Purpose (1–2 sentences)

Open with the high-level intent of this prompt. Sentence 2 (optional but encouraged) describes the before/after state of the workshop — what the agent or system did before this prompt and what it does after.

> **Example (49-mlflow_prompt_registry.md):**
> *Register every prompt the **{use_case_slug}** agent loads as a governed Unity Catalog asset with git-style aliases. Today the agent uses inline strings; after this prompt runs, the agent loads via `prompts://...@production` and a release becomes an alias move (no code change).*

### Layer 2 — Bullet list of plain-English actions (4–8 bullets)

Lead in with the verbatim phrase **`This will involve the following steps:`** (matches Tier A pattern in `09`, `11`, `13`).

Each bullet starts with a **bold action verb** (`Enumerate`, `Register`, `Pin`, `Verify`, `Tag`, `Sample`, `Score`, `Write`) followed by an em-dash and plain-English description. **No skill names, no param keys, no gate strings, no `prompts://` URIs except in the Purpose paragraph.** The bullet list teaches *what is happening*; the contract block below shows *how*.

> **Example bullets (49):**
> - **Enumerate inline prompts** — find every prompt the agent loads (`agent.system_prompt`, `must_do[]`, `must_not_do[]`) by reading `docs/agent_spec.yaml`
> - **Register each as a UC asset** — create `{lakehouse_default_catalog}.{db_schema}_agent.<prompt_name>` for each one, version 1
> - **Pin `@production`** — alias the current versions so the agent's runtime loader resolves them
> - **Reserve `@staging`** — leave it free for the next iteration's candidate version
> - **Verify the loader** — boot the agent against `prompts://...@production` and assert it loads cleanly (no silent fallback to inline strings)

### Layer 3 — Contract block (BYTE-FROZEN)

The contract block is the original `**Invoke skills (in order):**` stanza (Class B) or the `## IMPORTANT - READ FIRST` stanza (Class A). It is **never paraphrased.** The lint asserts byte-equality against `_templates/contract_baseline.json` at every commit.

For Class B, prepend this verbatim soft header on its own line (followed by a blank line, then the existing `**Invoke skills (in order):**` block):

```
**How this prompt chains with the prior step (skill invocations):**
```

For Class A, no soft header is added — the existing `The generated prompt MUST include this exact instruction block at the very beginning:` lead-in already self-introduces.

### What stays verbatim per class

| Class | Files | Verbatim contract surface |
|-------|-------|---------------------------|
| **A** | 38, 39 | `## IMPORTANT - READ FIRST` block, `Save it to: docs/...` block, `**OUTPUT FORMAT RULES:**` block (lives in `## System Prompt`, untouched). |
| **B** | 40–48, 49–56 | Entire `**Invoke skills (in order):**` numbered block AND the `**Gate:** ...` trailer line. Includes every skill path, every op-enter/exit invocation, every `require_prior_gate` reference, every param key/value. |

### Forbidden moves

- ❌ Paraphrasing a `gate:` string (downstream `require_prior_gate:` references match it literally).
- ❌ Reordering, adding, or removing items in the `**Invoke skills (in order):**` numbered list.
- ❌ Renaming or removing any `{placeholder}` token.
- ❌ Folding the contract block's content into the bullet list.
- ❌ Editing `## System Prompt` — it is out of scope for this rewrite.
- ❌ Skipping the `lint_section_prompts.py --check-contract` run before commit.

### Verification

After every rewrite, run:

```bash
cd apps_lakebase/prompts
python lint_section_prompts.py --check-contract --strict sections/<file>.md
```

Expected: ✅ for the file. Any contract-token regression prints `❌ <file>: contract token missing: '...'`.

---

## Genie-Code Fork Pattern (`*.genie-code.md`)

> Companion skeleton for the `99-*.genie-code.md` forks. Copy-paste starter: `_templates/fork_template.md`.

Forks are `bypass_llm: true`: the `## Input Template` body ships **verbatim** to the agent, so it must read well for BOTH a human reviewer and the agent. `## System Prompt`, `## How to Apply`, and `## Expected Output` stay empty — the resolver reads all shared fields from the Default row (see the seed header, rule 4). **Never move runtime content into `## System Prompt`** (the bypass delivery path is `input_template`).

### Fork skeleton (everything lives inside `## Input Template`, in this order)

1. **Preamble — Purpose (1-2 sentences).** Plain English: what this step produces and the before/after state of the workshop. No skill paths, no `**Gate:**` markup.
2. **Preamble — Steps at a glance.** The verbatim lead-in **`This will involve the following steps:`** then 4-8 bullets, each a **bold verb** + em-dash + plain-English action. No skill paths, no param keys, no gate strings here — this teaches *what happens*; the runbook below shows *how*.
3. **`### Non-negotiable execution rules`** — the hard stop/allow rules. Keep the emoji set minimal and consistent (one `🔴`/`🛑` for stops, one `✅` for the allowed-action line).
4. **`### Step 0 — Resolve your environment`** — the standard vibecoding-state `enter` block. Keep it byte-identical across forks so a reader learns it once.
5. **`### Step 1..N — <action>`** — IDE style: an imperative lead line + a fenced code block. Demote rationale and `[TESTED P##]` provenance to nested sub-bullets or a trailing `> Why: ...` aside, never inline in the action line.
6. **`**State-lock:**`** — the standard enter/exit ritual paragraph (phrases verbatim — see constraints).
7. **`**Gate:** `<gate string>``** — the single gate line. This is the ONLY `**Gate:**` markup in the file.
8. **`**➡️ Next step**`** — one or two sentences handing off to the next step.

### No-regression constraints (enforced by `scripts/genie_gate.py` + `lint --check-contract`)

The forks are functionally tested; changes must be **additive preamble + reflow only**. Never delete a guarded phrase. Specifically:

- Preserve every Default `{token}` (FORK_INTENT_PARITY); do not introduce new tokens.
- The **preamble must contain no `**Gate:** `...`` line** — `genie_gate._gate` matches the first occurrence, so a stray one shadows the real gate.
- No bare `@.../SKILL.md` mentions — always full `readSkillFile("skills/vibe-coding-workshop/...")` paths.
- Preserve verbatim the family discipline phrases (state / deploy / lakehouse / hybrid) recorded for each fork in `_templates/contract_baseline.json`.
- Never place a `---` horizontal rule immediately above a `## ` line inside Input Template (it would close the section early and corrupt the round-trip).
- `99-gold_layer_design.genie-code.md` must never contain the phrase `in one batched` (negative check, G1).

### Verify (after every fork edit)

```bash
cd apps_lakebase/prompts
python sync_markdown_to_seed.py            # re-extract markdown -> seed SQL
python sync_markdown_to_seed.py --dry-run  # expect: No differences detected
python lint_section_prompts.py --check-contract --strict sections/99-<tag>.genie-code.md
python ../../scripts/genie_gate.py --touched apps_lakebase   # all gates PASS
```

---

## Tier G — Genie Accelerator family (`semlayer_* / gagent_* / ontology_* / gaccel_*`)

> Applies to the Genie Accelerator track only (defaults, forks, and Locate method
> variants). Enforced by `lint_section_prompts.py::_lint_genie_input_template`.

Every Genie Accelerator row is `bypass_llm: true`, so the **entire `## Input
Template` ships verbatim** to the agent and is exactly what the app's **Copy to
Clipboard** copies. The old "Copy and paste this prompt to Genie Code:" +
fenced ```` ``` ```` block is therefore redundant framing (and injects literal
backticks into the chat). Tier G removes it.

### Rules

- ❌ **No fenced code block** in `## Input Template`. The whole body *is* the
  prompt — write the instruction as flowing Markdown prose + bullets.
- ✅ **READ bookend** — the instruction reads the context spine first:
  `docs/design_prd.md`, `docs/genie_brief.md`, and `.vibecoding-state.md`
  (Step 1 *Locate* is the exception — it reads the PRD + state and *creates* the
  brief). `.vibecoding-state.md` must always appear.
- ✅ **RECORD bookend** — the instruction ends by recording the gate to
  `.vibecoding-state.md`.
- ✅ **Directive voice** — the copied body is a second-person instruction to Genie
  Code. Open with ONE imperative orientation sentence (what to produce + the
  stop/gate), then go straight to the READ line and the instruction. No
  third-person narration of the agent ("Genie Code drafts…", "it creates…") and
  **no `This will involve the following steps:` step-preview bullets**. Learner
  training lives in `## How to Apply` / `## What Are We Building?` (not copied).
- ✅ **UI chrome → `## How to Apply`** — "panel above", the context "(+)" button,
  `{csv_content}`, tab selection, etc. live in `## How to Apply` (not copied), so
  the copied prompt stays clean for the agent.
- Preserve every `{token}`, the `**Gate:**` string, and (forks) the `**State-lock:**`
  ritual — `genie_gate.py` guards these.

### Shape

```markdown
**<One imperative sentence: what to produce + the stop/gate.>**

Read `docs/design_prd.md`, `docs/genie_brief.md`, and `.vibecoding-state.md`
first; reuse what they already answer instead of re-asking.

<the instruction as flowing Markdown — imperative, second person — NOT fenced>

Record the gate result in `.vibecoding-state.md`.

**State-lock:** …            (fork only)
**Gate:** `<gate string>` — …
**➡️ Next step.** …
```
