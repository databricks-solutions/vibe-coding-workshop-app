# D5 — Pedagogy & Content-Design

**Status:** Draft · **Doc ID:** D5 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D1 interactivity](./mcp-workshop-interactivity.md) (the `interaction` block that
carries questions in-band). **Coordinates with:** the template-repo `sections/*.md` authoring
pipeline and the prompt conventions in
[`../genie-accelerator-prompt-standardization.md`](../genie-accelerator-prompt-standardization.md)
and [`../genie-accelerator-locate-daisychain-and-prompt-cleanup.md`](../genie-accelerator-locate-daisychain-and-prompt-cleanup.md).
**Feeds:** D6 (what interactions need storing) · D8 (question/coaching tests).

> **The brief.** This is where "a mix of learning and insightful questions" is actually specified:
> the learning model, where comprehension checks and decision points sit, how the question bank is
> **authored (seeded, not hardcoded)**, how questions are phrased for **in-band** delivery (no
> elicitation UI), and the tone contract. It governs *content*; D1 governs the *mechanism*.

---

## 0. Anchors verified live (2026-09-22)

| Fact | Value |
|---|---|
| Tier-G template (unified default+fork, `bypass_llm`, verbatim) | `../genie-accelerator-prompt-standardization.md` §"Input Template", lines 60–92 |
| READ / RECORD bookends → the gate ledger | `.vibecoding-state.md` (standardization §17 line 74; daisy-chain lines 185/200/380/438) |
| Recommend-and-proceed contract (three clauses) | standardization §17 (lines 161–182) |
| Question/prompt authoring pipeline | template repo `sections/NN-<tag>.md` (default) + `sections/99-<tag>.genie-code.md` (fork) → `sync_markdown_to_seed.py` → `02_seed_section_input_prompts.sql` (standardization lines 27–36) |
| Tone bars (human-facing prose only) | `humanizer` + `economist-style`, daisy-chain §2.4 / §2.10 / §2.11 (lines 25–26, 176–187) |
| Step-9 hard-stop | `gagent_benchmarks` — "kept hard stop + confidence" (standardization line 314) |

> **Correction folded in.** D2 originally named the ledger `.n.md`; both source specs verify
> **`.vibecoding-state.md`**. D2 has been corrected to match.

---

## 1. Purpose — turn a walkthrough into a lesson

D3 makes each step self-narrating; D1 lets the engine ask questions in-band. D5 decides **which**
questions, **where**, in **what voice**, and **how they are authored** — so the track teaches
without becoming an interrogation (the exact failure the recommend-and-proceed addendum was written
to fix: "the track felt like an interrogation rather than a recommendation", standardization line
158).

Two design tenets:
- **Learning is additive and optional.** Comprehension checks never block; silence advances with the
  recommended default (D1 §3). The one exception is the Step-9 hard-stop (§8).
- **Insight lives in the decisions the track already makes.** The recommend-and-proceed clauses are
  the "insightful questions" — surfaced as confirmable choices, not open-ended prompts.

---

## 2. The learning model

Each step runs the same arc, mapped to the Tier-G template and the D1/D3 payload:

| Phase | Learner experience | Source field | Tier-G template slot |
|---|---|---|---|
| **Why** | Motivation — why this step matters now | `why` (manifest, D3 §8) | "What you're doing" (purpose + before/after) |
| **Check** *(optional, net-new)* | A comprehension question before acting | `interaction.pre` (D1 §6) | authored in the section file (§5) |
| **Do** | Run the verbatim prompt | `prompt` (assembler, D3 §7.5) | "This will involve…" + Input Template body |
| **Verify** | Confirm the expected output | `expected_output` (assembler) | "How to Apply" / "Expected Output" |
| **Decide** *(where applicable)* | Confirm/override the recommended default | `interaction.decision` (D1 §4.2) | recommend-and-proceed clause in the body |
| **Gate** | Record the checkpoint (next-action = approval) | `gate` + `complete_step` (D3 §5.4) | "Gate:" line + RECORD bookend |
| **Reflect** *(optional)* | A short takeaway | `interaction.post` (D1 §6) | authored in the section file |

The **READ bookend** (read `design_prd.md` / `genie_brief.md` / `.vibecoding-state.md` first, reuse
don't re-ask) is what makes checks feel earned rather than repetitive: the engine already knows what
the learner answered upstream (via `captured_outputs`, D3 §4), so a check never re-asks a settled
question.

---

## 3. The recommend-and-proceed doctrine (the heart of the "insightful questions")

Every decision point encodes the three clauses (standardization §17). D1's `interaction.decision`
pattern is the mechanism; this is the **content contract**:

1. **Implicit approval of the prior step.** Acting on a step commits whatever the previous step left
   pending in `.vibecoding-state.md`. The next action **is** the approval — the run never blocks
   forever.
2. **Review gate kept, but "pause" = next-action = approval.** Build steps still *show* the artifact
   (Metric View YAML, synonym diff, measure inventory) and pause — but pause means the next tool
   call approves, not block-forever. (This is D1 §4.3 gate approval.)
3. **Recommend, don't ask.** Every conflict / gap / unsupported item carries a **concrete default**,
   phrased exactly as:
   - `(recommended — building on this unless you correct me)` for a chosen default;
   - `(assumed owner — correct me)` when a measure/entity has no named owner (an unconfirmed owner
     **never** blocks the Metric View);
   - low data-supportability triggers a **proactive** synthetic-augmentation or rescope
     recommendation, not a stop.

**Anti-pattern to lint out:** any decision surfaced as an open question with no default. If a
`interaction.decision` has no `recommended` value, it violates this doctrine (D8 should test for it).

---

## 4. Where checks and decisions sit (per section)

Illustrative placement for the Genie Accelerator track. **Decision points already exist** in the
prompts (from §17); **comprehension checks are net-new** and optional. Exact wording is authored in
the pipeline (§5), not here.

| Section | sectionTags | Comprehension check (net-new, optional) — intent | Decision point(s) (existing recommend-and-proceed) |
|---|---|---|---|
| Semantic Layer | `semlayer_locate` | Why write `genie_brief.md` before building anything? | — (creates the brief) |
| | `semlayer_profile` | What does "data supportability" mean for a measure? | supportability verdicts → recommended default |
| | `semlayer_measures` | Why govern measures once, centrally? | measure inventory sign-off; unowned measure → `(assumed owner — correct me)` |
| | `semlayer_metric_view` | Why a *governed Metric View* before an agent? | plan→create; conflicts → `(recommended …)`; **never end with YAML shown but uncreated** |
| | `semlayer_synonyms` | How do synonyms improve agent recall? | synonym diff shown → next-action approves |
| Genie Agent | `gagent_describe` | What does the agent inherit from the Metric View? | commit shown-but-unapplied synonym diff |
| | `gagent_instructions` | What belongs in agent instructions vs. the semantic layer? | consolidated instructions → recommend-don't-ask |
| | `gagent_verified` | What makes a verified query trustworthy? | implicit approval, recommend-don't-ask |
| | `gagent_benchmarks` | **(hard-stop confirm, not a comprehension check — §8)** | benchmark-answer verification (required stop) |
| | `gagent_optimize` | Why iterate against a benchmark, not vibes? | native scorer loop → recommended fix modes |
| | `gaccel_dashboard` | Why does the dashboard share the governed Metric View? | — |
| Genie Ontology *(flag off by default)* | `ontology_domain` | What is a domain/subdomain model for? | recommended domain model |
| | `ontology_pages`, `ontology_routing` | *(coached — `ui-driven`, D3 §5.4)* | — |
| Activate | `gaccel_activation`, `activation_*` | Why activate through synced tables + a bundle? | recommended sync/deploy plan |

Guidance: **at most one comprehension check per section by default** (avoid a quiz gauntlet); more
only where a concept is load-bearing. Ontology `ui-driven` steps are coached, never quizzed.

---

## 5. Question-bank authoring (seeded, never hardcoded)

Questions and coaching are **content**, so they live in the same pipeline as prompts — the template
repo `sections/*.md` — and flow to Lakebase via the existing sync. They are **never** hardcoded in
the engine or the manifest generator.

### 5.1 Where interaction metadata lives
Extend each section file with an **optional, clearly delimited** interaction block that
`sync_markdown_to_seed.py` maps to seed columns the engine reads into D1's `interaction` block:

```markdown
<!-- interaction:pre type=comprehension skippable=true -->
**Q.** Why establish a governed Metric View before wiring an agent?
- a) Governance first means the agent reasons over trusted, owned measures.
- b) It's faster to skip governance and fix later.
**recommended:** (none — open comprehension)
**coaching.a** Correct — the agent inherits the Metric View's governance and definitions.
**coaching.b** Not quite — an agent over ungoverned data amplifies bad definitions.
<!-- /interaction -->
```

- **Default rows** (`sections/NN-<tag>.md`) carry the portable question; **`genie-code` forks**
  (`sections/99-<tag>.genie-code.md`) may override phrasing. Same fork resolution as prompts
  (D3 §7.2).
- The block is **outside** the `## Input Template` body, so the **verbatim prompt is never
  touched** (D1 §7; mirrors the existing "UI chrome → `## How to Apply`" rule, standardization
  line 88).

### 5.2 Pipeline (unchanged tooling)
`sections/*.md` → `sync_markdown_to_seed.py` → `02_seed_section_input_prompts.sql` → reseed. Lint
with `lint_section_prompts.py --check-contract --strict`; the interaction block must pass a new
scoped check (D8): a `type=decision` block **must** declare a `recommended` value (§3 anti-pattern).

### 5.3 Reseed, don't redeploy
Question/coaching edits are **content** → reseed path (roadmap "prompt-content changes require a
reseed + redeploy"), not an engine code change.

---

## 6. Phrasing for in-band delivery (no elicitation UI)

Because Genie Code has no elicitation form (probe §1), every question is **text the agent reads
out** and the learner answers **in chat**. Authoring rules:

- **Lead with the question, then options as lettered choices** (`a)`, `b)`) so a chat answer is one
  keystroke.
- **State the default inline** for decisions: `(recommended — building on this unless you correct
  me)`. The agent proceeds on the default if the learner is silent.
- **Mark skippable comprehension checks** so silence advances (D1 §3).
- **Coaching is one or two sentences**, keyed by option — affirm the right answer's *reason*, gently
  correct the wrong one. Never scold.
- **Never splice the question into the verbatim prompt body.** It rides the `interaction` block.

---

## 7. Tone & voice contract

Run all **human-facing prose** (the `why`, questions, coaching, decision copy) through the
`humanizer` and `economist-style` bars — **not** the machine instructions or the verbatim prompt
body (daisy-chain §2.4). Specifically:

- **Recommend, don't interrogate** (§3). The voice is a confident guide, not a form.
- **Remove "tells"** (daisy-chain §2.10): no emoji-numbered headers (→ plain sentence-case), no
  filler, no marketing adjectives.
- **Guardrails** (daisy-chain §2.11): stay precise and literal — do not "humanize" a gate string,
  a `{token}`, or a measure definition into vagueness. Clean and readable, not loose.
- **Consistency:** the same voice on both surfaces (§9).

---

## 8. The Step-9 hard-stop pedagogy (`gagent_benchmarks`)

The one place the "silence advances" rule is suspended. Pedagogically it is a **verification
ritual**, not a quiz:
- Phrased as a `type=confirm`, `skippable=false` interaction (D1 §11); the learner must confirm the
  benchmark answers are correct before the gate is accepted.
- Coaching frames *why* it's a stop: benchmark quality determines whether optimization is measuring
  the right thing. A wrong benchmark answer silently corrupts every later score.
- The engine refuses `complete_step` for `gagent_benchmarks` until `submit_answer` records the
  confirm (D2 `GATE_REQUIRED`).

This is the only interaction that may block, and it blocks by design.

---

## 9. Cross-surface pedagogy

Both surfaces render the **same** `interaction` block (D1 §6), so a learner gets identical questions
and coaching whether driving Genie Code or the UI. Answers persist to the interaction/decision log
(D6), so a facilitator projecting the UI sees the learner's answers and decisions live (roadmap
§10.3). One payload → one lesson, regardless of surface.

---

## 10. Authoring checklist (per step)

- [ ] `why` states motivation in the recommend-and-proceed voice (§7).
- [ ] At most one **optional** comprehension check per section, load-bearing only (§4).
- [ ] Every decision point carries a **concrete `recommended` default** (§3); no open-ended asks.
- [ ] Unowned owner → `(assumed owner — correct me)`; never blocks the build.
- [ ] Coaching is 1–2 sentences, keyed by option, affirming/correcting kindly (§6).
- [ ] Question/coaching authored in `sections/*.md`, **outside** `## Input Template` (§5.1).
- [ ] Prose passed through `humanizer` + `economist-style`; tokens/gate strings preserved (§7).
- [ ] `ui-driven` steps are coached, not quizzed (§4).
- [ ] `gagent_benchmarks` is `confirm`, `skippable=false` (§8).

---

## 11. Open questions (defer to human)

1. **Interaction-block format in section files.** The HTML-comment delimiter (§5.1) vs. a YAML
   frontmatter block vs. a dedicated `## Interaction` heading. Recommend the comment delimiter — it
   survives the no-fence rule and is invisible in rendered Markdown.
2. **Comprehension-check density.** One-per-section default (recommended) vs. author's discretion.
   Too many turns the track back into the interrogation §17 removed.
3. **Coaching for free-text answers.** Options are easy to coach; open comprehension answers need
   either a rubric or a light LLM judge. Recommend options-only for v1 to stay deterministic and
   `bypass_llm`.
