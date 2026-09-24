# D2 — MCP Interface Contract

**Status:** Draft · **Doc ID:** D2 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D3 domain spec](./workshop-engine-domain.md) (engine functions + payloads this
contract exposes) · [D1 interactivity](./mcp-workshop-interactivity.md) (the `interaction` block +
`vibe_submit_answer`).
**Governs / governed by:** the reusable rules in
[`designing-mcp-servers-for-genie-code.md` §5–§6](./designing-mcp-servers-for-genie-code.md) and the
probe constraints in
[`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe).

> **What this is.** The authoritative **IDL** the MCP server and the contract tests (D8) bind to:
> every tool (name, description-as-prompt, `inputSchema`, `outputSchema`, all four annotations,
> error taxonomy), every resource (URI template, TTL/cacheScope, payload), and every prompt (name,
> args, resolved messages). The adapter is a thin translator over the D3 engine — **no workshop
> logic here** (roadmap "one engine, two thin adapters").

---

## 0. Anchors verified live (2026-09-22)

| Symbol | Current location | Roadmap said |
|---|---|---|
| Identity endpoint `/api/user/current` | `src/backend/api/routes.py:6557` | `:6400` |
| `GET /api/section-metadata/{section_tag}` (how_to_apply / expected_output) | `routes.py:2252` | `:2150` |
| Track overview narrative source | `src/constants/pathDescriptions.ts` | same |
| Gate ledger convention | `.vibecoding-state.md` (Tier-G READ/RECORD bookends, `../genie-accelerator-prompt-standardization.md` §17 + `../genie-accelerator-locate-daisychain-and-prompt-cleanup.md`) | `.vibecoding-state.md` |
| SPA catch-all (mount `/mcp` before it) | `app.py:162` | `:162` |
| FMAPI call (adaptive coaching, §3.7) | `call_databricks_serving_endpoint(prompt, endpoint_name, max_tokens, temperature, system_prompt)` — **async** — `src/backend/api/routes.py:1400` | (new) |
| Default serving endpoint | `SERVING_ENDPOINT_NAME = os.getenv("DATABRICKS_SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")` `routes.py:440` | (new) |

> **Ledger naming.** The live Tier-G convention is `.vibecoding-state.md` — verified in both the
> prompt-standardization spec (§17, line 74 RECORD bookend) and the Locate daisy-chain spec. This
> contract and the `vibe://style/vibecoding` resource use that name (§4).

---

## 1. Design principles (normative, from the generic spec)

1. **Tool budget ≤ 7.** Genie Code enforces ~20 tools across *all* connected servers. This contract
   ships **7 tools** (6 core, plus `vibe_coach` added in Phase 2A, §3.7); read-only listings
   (outline/overview/state) are **resources**, entry points are **prompts** (§9 accounts for the
   budget). 7 is still comfortably under the ~20 shared ceiling — do not grow it further without a
   budget re-check (D1 §5, generic §3.4).
2. **Descriptions are the agent's only documentation** — 200–400 chars, stating *what · when ·
   params · errors* (generic §5.1).
3. **Flat `inputSchema`** — < 8 params, enums + defaults (generic §5.2).
4. **All four annotations** on every tool — `readOnlyHint`, `destructiveHint`, `idempotentHint`,
   `openWorldHint` (generic §5.3). Every tool touches Lakebase ⇒ `openWorldHint: true`.
5. **`outputSchema` + `structuredContent` on every tool**, mirrored to a human-readable text block
   (§7).
6. **Errors return in-result** (`isError: true`), never as protocol errors (§6).
7. **Resources carry `ttlMs` / `cacheScope`**; large payloads are resource links, not inlined
   (generic §5.6–§5.7).
8. **Stateless.** Every call resolves identity → `session_id` per request (§2.3); no in-process
   session state (D3 §4.2).

---

## 2. Conventions

### 2.1 Naming
Tools are prefixed `vibe_` and named `verb_object`. Resources use the `vibe://` scheme.

### 2.2 Shared types
```jsonc
// StepStatus (D3 §5.1)
"StepStatus": { "enum": ["done", "current", "locked", "skipped"] }

// OutlineItem
{ "sectionTag": "string", "title": "string", "status": StepStatus, "execution": "string" }

// Interaction (D1 §6) — optional; present only when the step asks something
"Interaction": {
  "id": "string", "type": { "enum": ["comprehension","decision","confirm"] },
  "question": "string", "options": [{ "id":"string","label":"string" }],
  "recommended": ["string","null"], "skippable": "boolean"
}

// ExplainabilityPayload (D3 §8 + D1 §6)
{
  "sectionTag": "string", "title": "string", "why": "string",
  "prompt": "string",                 // verbatim for bypass_llm (D3 §7.5)
  "how_to_apply": "string", "expected_output": "string",
  "gate": ["string","null"], "requiresGate": ["string","null"],
  "consumes": ["string"], "produces": ["string","null"],
  "execution": { "enum": ["agent-doable","ui-driven","hybrid"] },
  "next": { "sectionTag":"string", "title":"string" },
  "interaction": ["Interaction-map","null"]   // { pre?, decision?, post? } — D1 §6
}
```

### 2.3 Identity → session resolution
Every tool resolves the Databricks caller to a `session_id` server-side (reuse `/api/user/current`,
`routes.py:6557`). `session_id` may be passed explicitly (dual-surface continuity, roadmap §10.3) or
resolved from identity. **MCP session ≠ auth** (generic §4.5): never trust the MCP transport as the
identity source; `clientInfo.name` is the connection name, not the user (probe finding).

### 2.4 Annotation semantics
`readOnlyHint` = no state change · `destructiveHint` = removes/overwrites data ·
`idempotentHint` = same args ⇒ same effect (safe to retry) · `openWorldHint` = touches an external
system. All seven tools set `openWorldHint: true` (Lakebase; plus FMAPI for `vibe_coach`, §3.7).

---

## 3. Tools (the catalog)

Seven tools (6 core + `vibe_coach`, §3.7). Each entry is the binding contract:
description-as-prompt, `inputSchema`, `outputSchema`, annotations, errors, and the D3/D1/D5 mapping.

### 3.1 `vibe_start_track`
> **Description (as-prompt):** "Start or resume a guided workshop track (e.g. the Genie
> Accelerator) for the current user. Call this first, in Agent mode, before any other vibe tool.
> Args: `track` (required), optional `use_case`/`industry`/`session_id`. Returns the session id and
> the ordered step outline. Errors if `track` is unknown."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["track"],
  "properties": {
    "track":      { "type": "string", "description": "Track id, e.g. 'genie-accelerator'." },
    "use_case":   { "type": "string" },
    "industry":   { "type": "string" },
    "session_id": { "type": "string", "description": "Resume an existing session; omit to start fresh." }
  },
  "additionalProperties": false
}
"outputSchema": {
  "type": "object",
  "required": ["session_id", "track", "outline"],
  "properties": {
    "session_id": { "type": "string" },
    "track":      { "type": "string" },
    "outline":    { "type": "array", "items": { "$ref": "OutlineItem" } }
  }
}
```
- **Annotations:** `readOnly:false, destructive:false, idempotent:true, openWorld:true`
  (resuming with the same `session_id` is idempotent).
- **Errors:** `UNKNOWN_TRACK`.
- **Maps to:** D3 `outline(track, session)`; REST twin `GET /api/track/{track}/outline` (roadmap §9).

### 3.2 `vibe_get_step`
> **Description (as-prompt):** "Fetch one workshop step to present to the learner. Returns the
> prompt to run **verbatim**, plus why it matters, how to apply it, the expected output, the gate,
> and the next step — and an optional `interaction` question to ask in chat. Present `prompt`
> verbatim first, then narrate. Args: `session_id` (required), `sectionTag` (optional; defaults to
> the current step)."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["session_id"],
  "properties": {
    "session_id": { "type": "string" },
    "sectionTag": { "type": "string", "description": "Defaults to the current step." }
  },
  "additionalProperties": false
}
"outputSchema": { "$ref": "ExplainabilityPayload" }
```
- **Annotations:** `readOnly:true, destructive:false, idempotent:true, openWorld:true`.
- **Errors:** `INVALID_SESSION`, `UNKNOWN_STEP`, `STEP_LOCKED` (if an explicit locked `sectionTag`
  is requested; D3 F2).
- **Maps to:** D3 explainability payload + assembler (D3 §7–§8); REST twin
  `GET /api/track/{track}/step/{sectionTag}`.

### 3.3 `vibe_next_step`
> **Description (as-prompt):** "Advance to the first not-yet-completed step whose prerequisite gate
> is satisfied, and return it (same shape as vibe_get_step). Returns `{done:true}` when the track is
> complete. Call after a step's gate is recorded. Args: `session_id` (required)."

```jsonc
"inputSchema": { "type":"object", "required":["session_id"],
  "properties": { "session_id": { "type":"string" } }, "additionalProperties": false }
"outputSchema": {
  "oneOf": [ { "$ref": "ExplainabilityPayload" },
             { "type":"object", "required":["done"], "properties": { "done": { "const": true } } } ]
}
```
- **Annotations:** `readOnly:true, destructive:false, idempotent:true, openWorld:true`.
- **Errors:** `INVALID_SESSION`.
- **Maps to:** D3 `next_step(session)`; REST twin `GET /api/track/{track}/next`.

### 3.4 `vibe_complete_step`
> **Description (as-prompt):** "Record that the current step's gate passed and store the step's
> captured output (the gate = this call, i.e. next-action-as-approval). Advances the walk. Do **not**
> call this for `execution:ui-driven` steps — those are coached and hand off to the UI. Args:
> `session_id`, `sectionTag`, `captured_output` (all required)."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["session_id", "sectionTag", "captured_output"],
  "properties": {
    "session_id":      { "type": "string" },
    "sectionTag":      { "type": "string" },
    "captured_output": { "type": "string", "description": "The step's produced artifact/summary; stored under the step's `produces` key." }
  },
  "additionalProperties": false
}
"outputSchema": {
  "type": "object",
  "required": ["completed_gates", "next"],
  "properties": {
    "completed_gates": { "type": "array", "items": { "type": "string" } },
    "next": { "oneOf": [ { "type":"object","properties":{ "sectionTag":{"type":"string"},"title":{"type":"string"} } },
                         { "type":"object","required":["done"],"properties":{ "done":{"const":true} } } ] }
  }
}
```
- **Annotations:** `readOnly:false, destructive:false, idempotent:true, openWorld:true`
  (re-completing a done gate is a no-op success, D3 F3).
- **Errors:** `INVALID_SESSION`, `UNKNOWN_STEP`, `STEP_LOCKED` (D3 F2), `UI_DRIVEN_STEP`
  (coached, not agent-completable, D3 §5.4 / D1 §4.3), `GATE_REQUIRED` (Step-9 hard-stop: the
  confirm answer must be recorded first, D1 §11).
- **Maps to:** D3 `complete_step(...)`; REST twin `POST /api/track/{track}/complete`.

### 3.5 `vibe_submit_answer`  *(net-new, from D1 §5)*
> **Description (as-prompt):** "Record the learner's answer to a step's `interaction` question — a
> comprehension check or a recommend-and-proceed decision/override — and return coaching feedback.
> Optional for skippable questions (silence applies the recommended default). Args: `session_id`,
> `interaction_id`, `answer` (all required)."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["session_id", "interaction_id", "answer"],
  "properties": {
    "session_id":     { "type": "string" },
    "interaction_id": { "type": "string", "description": "The Interaction.id from the step payload, e.g. 'semlayer_locate.why'." },
    "answer":         { "type": "string", "description": "Selected option id (for options) or free text." }
  },
  "additionalProperties": false
}
"outputSchema": {
  "type": "object",
  "required": ["recorded", "coaching"],
  "properties": {
    "recorded":  { "type": "boolean" },
    "coaching":  { "type": "string", "description": "Short feedback the agent reads out; empty for pure decision capture." },
    "unblocks":  { "type": ["string","null"], "description": "sectionTag this answer unblocks, e.g. the Step-9 hard-stop; else null." }
  }
}
```
- **Annotations:** `readOnly:false, destructive:false, idempotent:true, openWorld:true`.
- **Errors:** `INVALID_SESSION`, `UNKNOWN_INTERACTION`.
- **Maps to:** D1 §4.1/§4.2 patterns + §11 (Step-9 unblock); persists to the interaction/decision
  log (D6). No REST twin required (UI has its own controls).

### 3.6 `vibe_set_parameters`
> **Description (as-prompt):** "Set or update session parameters and feature flags (catalog, schema
> prefix, `includeGenieOntology`, `includeLakehouse`, Lakebase instance). Returns the resolved
> parameters and any still-missing required ones — ask the learner in chat for those, then call
> again. Args: `session_id`, `params` (object)."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["session_id", "params"],
  "properties": {
    "session_id": { "type": "string" },
    "params": {
      "type": "object",
      "properties": {
        "catalog":              { "type": "string" },
        "schema_prefix":        { "type": "string" },
        "includeGenieOntology": { "type": "boolean" },
        "includeLakehouse":     { "type": "boolean" },
        "lakebase_instance":    { "type": "string" }
      },
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
"outputSchema": {
  "type": "object",
  "required": ["resolved_params", "missing_required"],
  "properties": {
    "resolved_params":  { "type": "object", "additionalProperties": true },
    "missing_required": { "type": "array", "items": { "type": "string" } }
  }
}
```
- **Annotations:** `readOnly:false, destructive:false, idempotent:true, openWorld:true`.
- **Errors:** `INVALID_SESSION`, `INVALID_PARAM` (unknown key with a strict flag, else ignored).
- **Maps to:** D3 §4 session_parameters + the outline flag filter (D3 §5.1); reuses
  `/api/session/{id}/parameters` + `lakehouse-params`.

### 3.7 `vibe_coach`  *(net-new, Phase 2A — from D5 §11 adaptive coaching)*
> **Description (as-prompt):** "Coach the learner on **what is happening at their current step and
> why**, grounded in their own progress — call it on demand when they ask 'why does this matter?',
> 'what do I do now?', or 'I'm stuck'. Read-only; never blocks or advances the track. Args:
> `session_id` (required), `focus` (optional: what_now | why | unblock | review), `sectionTag`
> (optional; defaults to the current step)."

```jsonc
"inputSchema": {
  "type": "object",
  "required": ["session_id"],
  "properties": {
    "session_id": { "type": "string" },
    "focus":      { "type": "string", "enum": ["what_now","why","unblock","review"], "default": "what_now",
                    "description": "Coaching lens: orient (what_now), motivate (why), get unstuck (unblock), or recap (review)." },
    "sectionTag": { "type": "string", "description": "Defaults to the current step." }
  },
  "additionalProperties": false
}
"outputSchema": { "$ref": "CoachResult" }   // see §12
```
- **Annotations:** `readOnly:true, destructive:false, idempotent:true, openWorld:true`
  (`openWorld` because it calls FMAPI + reads Lakebase; `readOnly` because it changes **no** workshop
  state — progress/gates/answers are untouched. The optional coaching-telemetry row (D6 §3a) is an
  observability side-channel, like a log line, not workshop state).
- **Errors:** `INVALID_SESSION`, `UNKNOWN_STEP` (explicit bad `sectionTag`). **Never** raises on an
  FMAPI failure — coaching is **fail-open**: on any model/timeout error it returns the static,
  option-keyed fallback (D5 §11.4 / interactions bank) with `is_fallback:true`. There is no
  `COACH_FAILED` code by design.
- **Grounding (server-assembled, never client-supplied):** the current step's `title`/`why`/
  `how_to_apply`/`expected_output`/`gate` + the verbatim `prompt` (as *reference to explain*, never
  to rewrite — §7 / D1 §7), the learner's `captured_outputs`, prior `session_interactions` answers,
  and `industry`/`use_case` (D5 §11.2). The model call carries `_COACH_SYSTEM` (§12) as
  `system_prompt`.
- **Maps to:** D5 §11 (pedagogy/doctrine) via `services/llm.py` (extract of
  `call_databricks_serving_endpoint`, `routes.py:1400`; D4 §1.2). **No REST twin required** for v1
  (the SPA renders its own coaching); add `GET /api/track/{track}/coach` later if the UI needs it.

---

## 4. Resources (read-only context)

Resources absorb the read-only listings that would otherwise cost tool-budget slots (§9). Each
declares `ttlMs` + `cacheScope ∈ {global, session}`.

| URI template | Payload | cacheScope | ttlMs |
|---|---|---|---|
| `vibe://track/{track}/overview` | Chapter/section narrative from `pathDescriptions.ts` + manifest `why` (D3 §3) | `global` | `3600000` (1 h) |
| `vibe://session/{session_id}/state` | `{ outline: OutlineItem[], completed_gates: string[], captured_output_keys: string[] }` — the live walk + gate ledger, mirroring `.vibecoding-state.md` | `session` | `0` (no-cache; always fresh, stateless) |
| `vibe://style/vibecoding` | The `.vibecoding-state.md` gate-ledger convention + Tier-G READ/RECORD bookends (`../genie-accelerator-prompt-standardization.md`) | `global` | `86400000` (24 h) |
| `vibe://guide/getting-started` | **Self-documenting help** — how the workshop works (answer in chat, silence = recommended default, the one hard stop, mirror in the web UI) + the troubleshooting table (20-tool budget, stateless, the 307). The in-product source the agent reads to help a learner **without** a human or D10 (self-serve invariant, D1 §1a). | `global` | `86400000` (24 h) |

Notes:
- **`outline` is a resource, not a tool** (moved from the roadmap's `vibe_track_outline`) — it is
  pure read; this keeps the tool count at 6 (§9). The session-state resource carries it for the
  session's active track.
- `resources/list` and `resources/read` responses should themselves set sensible `ttlMs` (generic
  §5.7).

---

## 5. Prompts (user-invoked entry points)

Prompts surface as discoverable slash-style entries; they cost **nothing** against the tool budget
and are how learners *find* the server.

| Prompt name | Arguments | Resolves to (messages) |
|---|---|---|
| `Start the Genie Accelerator` | `use_case?`, `industry?` | Instructs the agent to deliver the **first-run orientation** (D1 §4.5), then call `vibe_start_track {track:"genie-accelerator", …}` then `vibe_get_step`, present `prompt` verbatim, and narrate. |
| `Continue where I left off` | — | Instructs the agent to call `vibe_next_step` and resume, reading `vibe://session/{session_id}/state` for context. **Skips** orientation. |
| `How does this workshop work?` | — | Self-serve orientation on demand: instructs the agent to read `vibe://guide/getting-started` and explain how to answer, how gates work, the one hard stop, and how to mirror in the web UI (D1 §1a). Costs nothing against the tool budget. |

Each prompt's resolved message MUST restate the **verbatim-first** rendering contract (D1 §6) so the
agent presents the prompt body before narrating.

---

## 6. Error taxonomy (in-result `isError`)

All expected failures return a result with `isError: true` and a typed body — never a protocol
error (generic §5.5). Shape:

```jsonc
{ "isError": true, "error": { "code": "STEP_LOCKED", "message": "…actionable…", "sectionTag": "…" } }
```

| Code | Meaning | Raised by | D3/D1 ref |
|---|---|---|---|
| `UNKNOWN_TRACK` | `track` not in manifest | `start_track` | — |
| `INVALID_SESSION` | session id unresolvable | all | — |
| `UNKNOWN_STEP` | `sectionTag` not in track | `get_step`, `complete_step`, `coach` | D3 F1 |
| `STEP_LOCKED` | prerequisite gate not met | `get_step`, `complete_step` | D3 F2 |
| `UI_DRIVEN_STEP` | step is coached, not agent-completable | `complete_step` | D3 §5.4 / D1 §4.3 |
| `GATE_REQUIRED` | Step-9 confirm answer not yet recorded | `complete_step` | D1 §11 |
| `UNKNOWN_INTERACTION` | `interaction_id` not on the current step | `submit_answer` | D1 §6 |
| `INVALID_PARAM` | unknown/invalid parameter (strict mode) | `set_parameters` | D3 §4 |

`complete_step` on an already-completed gate is **not** an error — it is idempotent success
(D3 F3). `vibe_coach` **never** returns an FMAPI error — model/timeout failures degrade to the
static fallback with `is_fallback:true` (§3.7 / D5 §11.4); only `INVALID_SESSION`/`UNKNOWN_STEP`
(bad inputs, before any model call) are `isError`.

---

## 7. Output contract (hard)

Every tool call returns **both**:
1. `structuredContent` validated against the tool's `outputSchema`; and
2. a mirrored **text** content block (human-readable) so the agent can read results aloud.

A tool that cannot produce schema-valid `structuredContent` returns an `isError` result (§6) — it
never returns malformed structured output.

---

## 8. Annotation matrix

| Tool | readOnly | destructive | idempotent | openWorld |
|---|:--:|:--:|:--:|:--:|
| `vibe_start_track` | ❌ | ❌ | ✅ | ✅ |
| `vibe_get_step` | ✅ | ❌ | ✅ | ✅ |
| `vibe_next_step` | ✅ | ❌ | ✅ | ✅ |
| `vibe_complete_step` | ❌ | ❌ | ✅ | ✅ |
| `vibe_submit_answer` | ❌ | ❌ | ✅ | ✅ |
| `vibe_set_parameters` | ❌ | ❌ | ✅ | ✅ |
| `vibe_coach` | ✅ | ❌ | ✅ | ✅ |

None are `destructive`: completion/answers are additive and idempotent; coaching mutates no workshop
state; rollback is a whole-snapshot concern handled elsewhere, never a tool-level destroy.

---

## 9. Tool-budget accounting

| Surface | Count | Items |
|---|--:|---|
| **Tools** | **7** | start_track, get_step, next_step, complete_step, submit_answer, set_parameters, **coach** |
| Resources | 4 | track overview, session state (incl. outline), style/vibecoding, guide/getting-started |
| Prompts | 3 | Start the Genie Accelerator, Continue where I left off, How does this workshop work? |

Resources and prompts cost **nothing** against Genie Code's ~20-tool budget, so the self-serve
surfaces (the help resource + the orientation prompt, D1 §1a) are free — the tool count is **7**
(6 core + `vibe_coach`, added in Phase 2A). Coaching is deliberately a **tool** (not a resource)
because it takes arguments (`focus`, `sectionTag`) and calls a model per invocation.

**Reconciliation with the roadmap §8.2:** the roadmap listed 6 tools *including* `vibe_track_outline`
but *excluding* `vibe_submit_answer`. D1 requires `submit_answer`; to stay at 6 **core** tools we
**demote `track_outline` to the session-state resource** (§4). Net: 6 core tools, and the read-only
listing lives where reads belong (generic §6). **Phase 2A** then adds `vibe_coach` (§3.7) for a
total of **7** — still far under the shared ~20-tool ceiling.

---

## 10. Mapping (contract → engine/interaction/REST)

| Tool | D3 engine fn | D1 interaction | REST twin (roadmap §9) |
|---|---|---|---|
| `vibe_start_track` | `outline` | — | `GET /api/track/{track}/outline` |
| `vibe_get_step` | payload + assembler | carries `interaction` | `GET /api/track/{track}/step/{sectionTag}` |
| `vibe_next_step` | `next_step` | — | `GET /api/track/{track}/next` |
| `vibe_complete_step` | `complete_step` | gate = next-action-as-approval (§4.3) | `POST /api/track/{track}/complete` |
| `vibe_submit_answer` | (writes interaction log) | §4.1/§4.2 + §11 | — (UI-native) |
| `vibe_set_parameters` | session_parameters + outline filter | §4.4 | `POST /api/session/{id}/parameters` |
| `vibe_coach` | reads state + assembler context; calls FMAPI (`services/llm.py`) | D1 §4.6 (adaptive coaching) | — (UI-native; optional `GET …/coach` later) |

---

## 11. Open questions (defer to human)

1. **`session_id` in args vs. identity-only.** Exposing `session_id` enables dual-surface handoff
   (UI → Genie Code) but adds a spoofable arg. Recommend: accept it, but authorize it against the
   resolved identity server-side.
2. **Strict vs. lenient `set_parameters`.** Reject unknown keys (`INVALID_PARAM`) or ignore them?
   Recommend lenient-with-warning to avoid brittle failures as the flag set grows.
3. **Overview resource freshness.** 1 h TTL assumes track narrative is static between deploys;
   confirm reseed invalidates it (or drop TTL to session).
4. **Coaching model + budget knobs (§3.7/§12).** **RESOLVED 2026-09-24 (ship enabled):** endpoint =
   app default (`DATABRICKS_SERVING_ENDPOINT` → `databricks-claude-sonnet-4-5`), `max_tokens≈400`,
   `≈8 s` timeout with fail-open, and per-triple caching on `(session_id, sectionTag, focus)`. Gate
   the live call behind a coaching kill-switch env (default **on**) for rollback (D9 §6).
5. **Coaching telemetry (D6 §3a).** Persist a `kind='coaching'` row per call (recommended, for the
   fallback-rate metric) vs. fire-and-forget with no row. Recommend persist, best-effort.

---

## 12. Adaptive-coaching internals (`CoachResult` + `_COACH_SYSTEM`)

The shape and the model contract behind `vibe_coach` (§3.7). Bound by the D8 coaching tests (§4).

### 12.1 `CoachResult` (output type)

```jsonc
// CoachResult — the vibe_coach outputSchema (structuredContent + mirrored text, §7)
"CoachResult": {
  "type": "object",
  "required": ["coaching", "focus", "section_tag", "is_fallback"],
  "properties": {
    "coaching":    { "type": "string",
                     "description": "2–5 sentences the agent reads out; explains what's happening and why. Never restates the step prompt." },
    "focus":       { "type": "string", "enum": ["what_now","why","unblock","review"] },
    "section_tag": { "type": "string", "description": "The step the coaching is grounded on." },
    "grounded_on": { "type": "array", "items": { "type": "string" },
                     "description": "Which context keys fed the answer, e.g. ['why','expected_output','captured_outputs:genie_brief']. For transparency/tests." },
    "is_fallback": { "type": "boolean",
                     "description": "true ⇒ the FMAPI call failed/timed out and the static option-keyed fallback was returned (D5 §11.4)." }
  },
  "additionalProperties": false
}
```

Pydantic sketch (mirrors the existing models in `src/backend/mcp_server.py`):

```python
class CoachResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    coaching: str
    focus: Literal["what_now", "why", "unblock", "review"]
    section_tag: str
    grounded_on: list[str] = Field(default_factory=list)
    is_fallback: bool = False
```

### 12.2 `_COACH_SYSTEM` (the model system prompt)

Passed as `system_prompt` to `call_databricks_serving_endpoint` (`routes.py:1400` → `services/llm.py`,
D4 §1.2). It is a **server-owned constant** (like `ORIENTATION_PREAMBLE` in `mcp_server.py`), never
learner- or agent-supplied. The **user message** is the assembled grounding context (§3.7); this
system prompt fixes the role, the guardrails, and the output shape.

```text
You are the coach for a hands-on Databricks "Genie Accelerator" workshop. A learner is working
through it inside an AI coding agent. Your job: explain, in plain language, WHAT is happening at
their current step and WHY it matters — grounded ONLY in the CONTEXT provided in the user message
(the step's purpose, how-to-apply, expected output, the learner's own prior outputs and answers,
and their industry/use case).

HARD RULES
- Ground every claim in the CONTEXT. If the CONTEXT does not support an answer, say what the learner
  should do or check next — never invent facts, table names, column values, or results.
- NEVER restate, paraphrase, or "improve" the step's verbatim PROMPT body. It is shown to the
  learner separately and must remain authoritative. You explain and motivate; you do not re-issue
  the instruction.
- NEVER emit benchmark question text, sample data values, literals, secrets, or PII. Speak in terms
  of concepts and the learner's own artifacts, not raw data. (Firewall — D7 §6.)
- Respect the learner's recorded decisions: if they chose a non-recommended option, coach that
  path's trade-offs; do not scold or re-litigate a settled choice.

FOCUS (from the CONTEXT's `focus` field)
- what_now : orient them — where they are, what this step produces, what to do next.
- why      : motivate — why this step exists and what breaks downstream if it's skipped or wrong.
- unblock  : diagnose — the most likely reason they're stuck here and the smallest next action.
- review   : recap — what they've accomplished so far and how this step builds on it.

STYLE
- 2–5 sentences. Confident guide, not a form or a quiz. Recommend, don't interrogate (D5 §3, §7).
- No emoji, no numbered/decorated headers, no marketing adjectives, no filler (economist/humanizer
  bars, D5 §7). Precise and literal about tokens, gate names, and definitions — do not vague them.
- Output prose only. No JSON, no markdown headings — the tool wraps your text into CoachResult.
```

### 12.3 Grounding context (the user message)

Assembled server-side from the same sources `_step_payload` already uses (`mcp_server.py`), plus
session history — **never** taken from tool arguments:

| Context key | Source |
|---|---|
| `focus` | the `focus` arg (§3.7) |
| `title`, `why`, `how_to_apply`, `expected_output`, `gate`, `execution` | step payload (D3 §8) |
| `prompt` (verbatim, **as reference only**) | assembler `bypass_llm` input (D3 §7.5) |
| `captured_outputs` (relevant `consumes`/`produces` keys) | `engine.resolve_previous_outputs` (D3 §6) |
| prior answers/decisions | `session_interactions` (D6 §3) |
| `industry`, `use_case` | `session_parameters` (D6 §4) |

`grounded_on` in the result echoes which of these keys were non-empty, for transparency and the
D8 grounding test (§4).
