# D6 — Data Model & Persistence

**Status:** Draft · **Doc ID:** D6 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D3 domain](./workshop-engine-domain.md) (`produces`/`consumes` keys, state model) ·
[D5 pedagogy](./mcp-workshop-pedagogy.md) (what interactions must be stored).
**Extends:** roadmap §13. **Feeds:** D7 (isolation), D8 (migration/parity tests).

> **Principle: additive-only, reseed-safe.** No new persistence engine; no destructive migrations.
> New columns/tables are additive; existing rows keep working; the legacy number-keyed state stays
> until the UI migrates (D3 §4.3).

---

## 0. Anchors verified live (2026-09-22)

| Fact | Location |
|---|---|
| Sessions DDL | `db/lakebase/ddl/03_sessions.sql` |
| `save_session(...)` (persist path) | `src/backend/services/lakebase.py:592` |
| DDL naming convention | `db/lakebase/ddl/NN_*.sql` (next free: `12_`) |
| Prompt-content store (unchanged) | `db/lakebase/ddl/02_section_input_prompts.sql` |

---

## 1. Existing schema (`sessions`, as of today)

```sql
CREATE TABLE ${schema}.sessions (
    session_id          VARCHAR(36) PRIMARY KEY,
    created_by          VARCHAR(255) NOT NULL,          -- Databricks identity (D7)
    industry            VARCHAR(100),
    use_case            VARCHAR(100),
    step_1_prompt       TEXT,
    step_prompts        JSONB DEFAULT '{}',             -- {stepNumber -> prompt text}  (number-keyed!)
    current_step        INTEGER DEFAULT 1,
    workshop_level      VARCHAR(20) DEFAULT '300',      -- the track id
    completed_steps     TEXT,                           -- serialized list of step NUMBERS
    skipped_steps       TEXT DEFAULT '[]',
    session_parameters  JSONB DEFAULT '{}',             -- per-session param + flag overrides
    created_at          TIMESTAMP, updated_at TIMESTAMP
    -- (feedback_*, chapter_feedback, labels elided)
);
```

Key observations for the engine:
- **`completed_steps` and `step_prompts` are keyed by step NUMBER** — the legacy namespace. The
  engine keys by `sectionTag` (D3 §2), so it needs tag-keyed companions.
- **`session_parameters` (JSONB) already exists** — flags and params live here **with no schema
  change** (§4).

---

## 2. Additive changes (new columns)

Two additive JSONB columns on `sessions` (roadmap §13):

| Column | Type | Keyed by | Purpose |
|---|---|---|---|
| `captured_outputs` | `JSONB DEFAULT '{}'` | `produces` key (sectionTag-derived) | Chaining store: `producesKey → text` (D3 §6). Replaces number-keyed `step_prompts` for the engine. |
| `completed_gates` | `JSONB DEFAULT '[]'` | `sectionTag` | Gate ledger; complements legacy `completed_steps` (numbers) until the UI migrates (D3 §4.3). |

Both are additive; the UI keeps reading `completed_steps`/`step_prompts` during Phase 0–2, and
`complete_step` **dual-writes** number + tag (D3 §5.4).

---

## 3. Interaction / decision log (new table)

Comprehension answers and recommend-and-proceed decisions (D5) need provenance — timestamp, what was
asked, what was answered, whether coaching was shown, and whether it unblocked a hard-stop. This is
append-heavy and query-worthy, so it is a **separate table**, not a JSONB blob.

```sql
CREATE TABLE IF NOT EXISTS ${schema}.session_interactions (
    id              BIGSERIAL PRIMARY KEY,
    session_id      VARCHAR(36) NOT NULL REFERENCES ${schema}.sessions(session_id),
    section_tag     VARCHAR(128) NOT NULL,             -- the step (D3 §2)
    interaction_id  VARCHAR(160) NOT NULL,             -- D1 Interaction.id, e.g. 'semlayer_locate.why'
    kind            VARCHAR(16) NOT NULL,              -- 'comprehension' | 'decision' | 'confirm'
    answer          TEXT,                              -- option id or free text (NULL if skipped)
    recommended     TEXT,                              -- the default that was offered (NULL for open)
    was_default     BOOLEAN DEFAULT FALSE,             -- TRUE if silence applied the recommended default
    coaching_shown  TEXT,                              -- the coaching returned to the agent (D2 vibe_submit_answer)
    surface         VARCHAR(8) DEFAULT 'mcp',          -- 'mcp' | 'ui'
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_session_interactions_session ON ${schema}.session_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_interactions_tag ON ${schema}.session_interactions(session_id, section_tag);
```

- Written by `vibe_submit_answer` (D2 §3.5) and the UI equivalent (`surface` distinguishes them).
- Powers cross-surface honesty (D5 §9): a facilitator's UI reads this to show what the learner
  answered.
- **Alternative (rejected for v1):** a `session_interactions` JSONB column on `sessions`. Rejected —
  a table gives clean append, indexing, and provenance without read-modify-write races under
  stateless concurrency (D7 §5).

---

## 4. Session parameters & flags (no schema change)

`session_parameters` (JSONB) already exists; the engine reads these keys — **document only, no DDL**:

| Key | Type | Consumed by |
|---|---|---|
| `catalog` | string | assembler tokens, outline |
| `schema_prefix` | string | assembler tokens |
| `includeGenieOntology` | boolean (default false) | outline flag filter (D3 §5.1) → drops `ontology_*` |
| `includeLakehouse` | boolean | outline flag filter (lakehouse tag filter) |
| `lakebase_instance` | string | activation steps |
| `coding_assistant` | string | fork resolution (D3 §7.2) |

`vibe_set_parameters` (D2 §3.6) writes here; `missing_required` is computed against the track's
required params.

---

## 5. Number↔tag migration

| Namespace | Store today | Engine target | Bridge |
|---|---|---|---|
| Completed gates | `completed_steps` (TEXT, numbers) | `completed_gates` (JSONB, tags) | dual-write; number↔tag map (D3 §2); flip to tag-only Phase 3 |
| Captured outputs / chaining | `step_prompts` (JSONB, numbers) | `captured_outputs` (JSONB, produces keys) | dual-write; engine reads tag store; UI reads numbers until Phase 3 |

The number↔tag map is derived from the manifest (`order`/`number` ↔ `sectionTag`) — it is **not** a
stored table; it is computed from the generated manifest (D3 §3) so it can never drift from the
source of truth.

---

## 6. Access patterns (stateless)

- **Read-per-request:** every engine call reads the session row fresh (D3 §4.2). No caching for
  correctness.
- **Delta writes:** `complete_step` appends to `completed_gates` (set semantics — idempotent, D3 F3)
  and sets one `captured_outputs` key. `submit_answer` inserts one `session_interactions` row.
- **No cross-session reads** in the hot path (D7 §5).

---

## 7. Migration DDL (new file `db/lakebase/ddl/12_mcp_engine_state.sql`)

```sql
-- 12_mcp_engine_state.sql — additive; safe to re-run.
ALTER TABLE ${schema}.sessions ADD COLUMN IF NOT EXISTS captured_outputs JSONB DEFAULT '{}';
ALTER TABLE ${schema}.sessions ADD COLUMN IF NOT EXISTS completed_gates  JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS ${schema}.session_interactions ( … as §3 … );
CREATE INDEX IF NOT EXISTS idx_session_interactions_session ON ${schema}.session_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_interactions_tag ON ${schema}.session_interactions(session_id, section_tag);
```

Applied via the app's existing schema-ensure path (`lakebase.py` `_ensure_schema`) or the reseed
tooling — **additive, idempotent** (`IF NOT EXISTS`). No data backfill required; legacy sessions
simply have empty tag stores until they next complete a step.

---

## 8. Retention & privacy

- `session_interactions` is workshop telemetry; retain with the sessions table's lifecycle. No PII
  beyond `created_by` (already in `sessions`).
- No benchmark question text or literals persist in interaction rows (respect the firewall spirit;
  answers are option ids / short text).

---

## 9. Open questions (defer to human)

1. **`save_session` extension vs. a new writer.** Extend `save_session` (`lakebase.py:592`) to
   dual-write the tag stores, or add engine-specific writers? Recommend extending `save_session` to
   keep one persistence path.
2. **Interaction table vs. column** — confirmed table (§3); re-confirm if telemetry volume is a
   concern.
3. **When to drop legacy number stores** — Phase 3 (D3 §12); confirm no external consumer reads
   `completed_steps`/`step_prompts` by number.
