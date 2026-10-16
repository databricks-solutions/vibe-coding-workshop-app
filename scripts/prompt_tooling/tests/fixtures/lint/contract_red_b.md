---
input_id: 9001
section_tag: contract_red_b
order_number: 9001
section_title: Contract Red B Fixture
section_description: Lint fixture failing the contract check (Class B)
bypass_llm: true
version: 1
is_active: true
---


# Contract Red B Fixture

---

## System Prompt

---

## Input Template

Do the thing for **{use_case_slug}**. Today the system is in state X; after this prompt, it is in state Y.

This will involve the following steps:

- **Find** — locate the things
- **Register** — register them
- **Verify** — confirm they exist

**How this prompt chains with the prior step (skill invocations):**

**Invoke skills (in order):**

1. `genai-agents/vibecoding-state` op `enter` — params: `prompt_id: "fixture_b"`, `require_prior_gate: {prompt_id: "prior_b", gate: "Prior B done"}`.
2. @genai-agents/test/fixture-skill/SKILL.md — params:
   - `key: "value"`
3. `genai-agents/vibecoding-state` op `exit` — params: `prompt_id: "fixture_b"`, `gate: "Fixture B done"`.

**Gate:** `Fixture B is now complete` — verification text.

---

## How to Apply

## 1️⃣ How To Apply

paste

---

## 2️⃣ What Are We Building?

a fixture

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It's Used Here |
|----------|--------------------|
| Test | Test |

---

## 4️⃣ What Happens Behind the Scenes?

phase 0

---

## Expected Output

- [ ] passes
