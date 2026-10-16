---
input_id: <int, 9xx>
section_tag: <snake_case_tag matching an existing Default row>
coding_assistant: genie-code
bypass_llm: true
version: 1
is_active: true
sql_comments:
  - "-- <tag> (genie-code fork) — <one-line summary of the prescriptive path>; bypass_LLM = TRUE"
---


# <tag>

---

## System Prompt

---

## Input Template

<Purpose — 1-2 plain-English sentences: what this step produces; the before/after state of the workshop. No skill paths, no **Gate:** markup.>

This will involve the following steps:

- **<Verb>** — <plain-English action 1>
- **<Verb>** — <plain-English action 2>
- **<Verb>** — <plain-English action 3>
- **<Verb>** — <plain-English action 4>

### 🔴 Non-negotiable execution rules (read before anything)

❌ **NEVER** <hard stop 1 — with the one-line why>.
🛑 **NEVER** <hard stop 2>. [TESTED P##]
✅ <the single allowed-action line — what you DO run here>.

### Step 0 — Resolve your environment (once, before anything else)

Run `skills/vibecoding-state` operation `enter` with `prompt_id: "<tag>"`. Read the resolved `## Environment Capabilities` values and use them literally:

- `client_context` = `genie_code`
- `artifact_root` = your workshop project root (e.g. `/Workspace/Users/<your-email>/vibe-coding-workshop`) — where all generated bundles/apps/docs build; the repo itself is cloned at `/Workspace/Users/<your-email>/.assistant/skills/vibe-coding-workshop` (skills load from there via `skill_ref_root`, NOT from `artifact_root`)
- `skill_ref_root` = `skills/vibe-coding-workshop` (substitute your clone folder if different)
- `<track_root>` = <dp_bundle_root | app_root | agent_app_root> = ... — the self-contained project folder.

### Step 1 — <action>

<imperative lead line>

```bash
<command or code>
```

- <optional nested sub-bullet: rationale>
- <optional nested sub-bullet: [TESTED P##] provenance>

### Step N — <action>

<imperative lead line + fenced code>

**State-lock:** this prompt runs between an `enter` (Step 0) and an `exit`. After the gate passes, run `skills/vibecoding-state` op `exit` — params: `prompt_id: "<tag>"`, `gate: "<gate string>"`, `captured: {<state keys>}`. **This `enter`/`exit` pair is a mandatory ritual, not advisory.** Step 0's `enter` MUST locate — or, if this is the first prompt of the track, bootstrap-create — the canonical live state file at `<track_root>/.vibecoding-state.md` (never the temporary `example/…` bootstrap path). The closing `exit` MUST append this prompt's Per-Step Log entry, Gate result, and `captured` vars to that file, then **re-read it and echo the appended section to prove the write landed**. **Gate completion rule:** this prompt is NOT complete until that re-read confirms the appended entry — the chat summary is NOT the state store.

**Gate:** `<gate string>` — <one-sentence verification of what now exists>.

**➡️ Next step.** <one or two sentences handing off to the next step>.

---

## How to Apply

---

## Expected Output
