---
input_id: <int>
section_tag: <snake_case_tag>
order_number: <int>
section_title: "<Human Title>"
section_description: "<one-sentence description>"
bypass_llm: true
version: 1
is_active: true
sql_comments:
  - "-- Step <N>: <short description>"
---


# <Human Title>

---

## System Prompt

<empty for bypass_llm:true; otherwise the system prompt that wraps the input>

---

## Input Template

<Layer 1 — Purpose: 1–2 sentences. Sentence 1 = high-level intent. Sentence 2 = before/after state.>

This will involve the following steps:

- **<Verb>** — <plain-English description of one AI action>
- **<Verb>** — <plain-English description of one AI action>
- **<Verb>** — <plain-English description of one AI action>
- **<Verb>** — <plain-English description of one AI action>
- **<Verb>** — <plain-English description of one AI action>

**How this prompt chains with the prior step (skill invocations):**

1. `genai-agents/vibecoding-state` op `enter` — params: `prompt_id: "<this_prompt_id>"`, `require_prior_gate: {prompt_id: "<prior>", gate: "<prior gate string>"}`.
2. @<skill-path>/SKILL.md — params:
   - `<key>: "<value or {placeholder}>"`
   ...
3. `genai-agents/vibecoding-state` op `exit` — params: `prompt_id: "<this_prompt_id>"`, `gate: "<this gate string>"`, `captured: {<state keys>}`.

**Gate:** `<this gate string>` — <one-sentence verification of what now exists>.

---

## How to Apply

## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent thread** in your Coding Assistant, and paste it.

### Prerequisite

- ✅ <gate name from prior input_id>
- ✅ <state key captured>

### Steps to Apply

**Step 1: Start New Agent Thread** — open Cursor and start a new Agent thread for clean context.

**Step 2: Paste the Prompt** — paste this entire prompt; the AI will <one-line summary>.

**Step 3: Verify** — <one verification command>

---

## 2️⃣ What Are We Building?

### What is <concept>?

<2-3 sentence plain-English explanation>

### <Concept> Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          <DIAGRAM TITLE>                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  <ascii art ~75 cols wide using ┌─┐│└┘├┤┬┴┼ glyphs>                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | What It Means | Why It Matters |
|---------|---------------|----------------|
| **<term>** | <plain-english> | <why it matters in this context> |

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It's Used Here |
|----------|-------------------|
| **<best practice>** | <how this section applies it> |

---

## 4️⃣ What Happens Behind the Scenes?

<one of: phase table | orchestrator/worker diagram | gate contract table | MLflow span breakdown>

### Phase Workflow

| Phase | What Happens | Key Output |
|-------|--------------|------------|
| **Phase 0** | <what> | <output> |

### Gate Contract (Track A / MLflow SDLC sections)

| Reads gate | Produces gate | Captured state |
|------------|---------------|----------------|
| `<prior gate>` | `<this gate>` | `<state keys>` |

---

## Expected Output

### Resources Created
- [ ] <deliverable 1>
- [ ] <deliverable 2>

### Success Criteria Checklist
- [ ] <verifiable criterion 1>
- [ ] <verifiable criterion 2>
