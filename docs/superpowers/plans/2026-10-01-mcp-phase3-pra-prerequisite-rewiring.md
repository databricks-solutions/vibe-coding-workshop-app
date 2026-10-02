# Phase 3 · T5 · PR A — prerequisite rewiring + all-tracks gate invariant (root cause of the false `done:true`)

**Status:** APPROVED WITH AMENDMENTS (human, 2026-10-01) — amendments folded in; dispatched on that approval.
**Base:** `feature/genie-code-mcp-integration` @ `956fbd4`. **One PR.** claude_code implements → cursor reviews. This plan doc committed in-PR.
**Charter exceptions (APPROVED):** `manifest.py` (composition), `engine.py` (resolve helper + `complete_step` call site), `mcp_server.py` (`vibe_get_step`/`vibe_explain_step` call sites). Stated in the PR body with the D3 §5.2/§5.3 + §12 cites.

## 0. The bug — two layers (both human-verified)

**Layer 1 — dangling gates in composition.** `Manifest.outline_order` (`manifest.py:156-175`) filters flagged steps but keeps each surviving step's original `requiresGate` — a step whose prerequisite was filtered out dangles, stays `locked`, and when it's all that remains, `next_step` returns `Done()` with steps remaining. Live: genie-accelerator defaults → `iterate_enhance.requiresGate = ontology_routing` (filtered) → after `activation_deploy_validate`, 3 steps locked → `Done()`.

**Layer 2 (human's gate finding — makes "engine/mcp_server zero-diff" FALSE):** three step lookups **bypass the composed outline** and keep the ORIGINAL (dangling) `requiresGate`:
- `engine.complete_step`: `steps = MANIFEST.track_steps(track_id)` (`engine.py:204`)
- `vibe_get_step`: `steps = engine.MANIFEST.track_steps(DEFAULT_TRACK)` (`mcp_server.py:1019`)
- `vibe_explain_step`: same (`mcp_server.py:1106`)

With the rewire only in `outline_order`, `vibe_next_step` returns `iterate_enhance` while `vibe_complete_step(iterate_enhance)` → `STEP_LOCKED` (still checking `ontology_routing`), and `vibe_get_step` disagrees — the same cross-tool class closed in #74.

The web is unaffected (local order walk, gates ignored).

## 1. Classification — DONE (reproduces the human's sweep exactly; read-only, offline)

384 combos ✓; **898 total ✓ — ALL `dangling_filtered`** (prereq exists in track, filtered from composition); **`forward` = 0; `dangling_nonstep` = 0** → no forward ruling needed; the ancestor walk covers 100%. Post-rewire simulation: **0 invariant violations**. Concrete walk: `iterate_enhance → ontology_routing → ontology_pages → ontology_domain` (all filtered) → `ontology_domain.requiresGate = gagent_optimize` (in outline, earlier) → **rewired gate = `gagent_optimize`** (the authored graph never had the activation steps as its prerequisite either). Other tracks: zero dangling (no flags).

## 2. The rewire (`manifest.py` `outline_order`, runtime-only)

- **Rule:** a visible step whose `requiresGate` names a step **not in this composed outline** is rewired by walking the required step's own `requiresGate` chain (over the **full** track step map) back to the nearest ancestor **in the outline**. Terminals: ancestor-in-outline → that gate; reaches `use_case_selection` → **stays the use-case gate**; `None` → `None`; cycle/missing → `None` (defensive; 0 today — asserted).
- **Immutability:** never mutate shared `Step` objects — `dataclasses.replace(step, requiresGate=new)` copies, **only** for steps whose gate changes.
- **ORDER untouched.** Frozen-golden order fixtures **byte-identical** (regen + full parity suite; fresh-session statuses unaffected).

## 2b. ONE composed-outline lookup helper (blocking amendment 1)

- **`engine.resolve_step(track_id, session, tag)`** — returns the step from **this session's composed outline** (rewired gate) when `tag` is in it; else falls back to `MANIFEST.track_steps(track_id)` (current behavior for non-outline tags).
- **Use at exactly the three sites:** `engine.complete_step` (`engine.py:204`), `vibe_get_step` (`mcp_server.py:1019`), `vibe_explain_step` (`mcp_server.py:1106`). No other lookup changes.
- **VERIFY grep:** no gate check reads `track_steps` directly anymore (the helper's internal fallback is the sole remaining call, with the non-outline-tag rationale stated).

## 3. The all-tracks invariant test + proof over the SAME space (amendment 3)

For **every track × every flag combo × every composition input** (`direction` ∈ {forward, reverse} where a variant exists; `chainContext` ∈ {none, app} where applicable): **each visible step's `requiresGate` is `None`, the use-case gate, or an EARLIER visible step.** **898 → 0.**
The offline **post-rewire simulation re-runs over that same full space** (not just the 384 track×flag combos) and its totals are **pasted in the PR body**; the invariant test asserts that same space.

## 4. Tests — rewire TARGET pinned + cross-tool agreement (blocking amendment 2)

1. **Rewire-target pin:** genie-accelerator defaults → the **composed** `iterate_enhance.requiresGate == "gagent_optimize"`. (This is what makes T2 fail; the end-of-track regression row passes under either rewire.)
2. **End-to-end through MCP (offline harness)** on the defaults row completed through `activation_deploy_validate`:
   - `vibe_next_step = iterate_enhance`;
   - `vibe_get_step(iterate_enhance)` is **not** `STEP_LOCKED`;
   - `vibe_complete_step(iterate_enhance)` succeeds;
   - continue to `workspace_cleanup` → `{done: true}`.
3. Prior soak-row tests (#74) unchanged and green.
**Tampers (each named in the PR body):**
- **T1:** drop the rewire → invariant + regression fail.
- **T2:** rewire to the *immediately-preceding* visible step → the target-pin fixture fails (`gagent_optimize` ≠ the immediate predecessor).
- **T3 (new):** revert the `engine.complete_step` lookup to `track_steps` → the end-to-end test fails.

## 5. Fences & proofs

`state.py` / frontend / `routes.py` / DDL: **zero-diff**. `engine.py` diff scoped to the helper + the `complete_step` call site; `mcp_server.py` scoped to the two call sites. `manifest.json` + `generate_manifest.py`: zero-diff, regen **byte-identical**. Frozen-golden: byte-identical + parity suite green. Absence pin green; JSONB-vs-`''` sweep zero. Offline gates pasted: targeted pytest (main `.venv`, `mcp==1.30.0`, SDK-neutralized) + FE node + `npm run build`/lint from repo root; the full-space simulation totals pasted. Explicit staging; never `.cursor/`/`.isaac/`; never `git add -A`; STOP-and-report over partial/red PRs.

## 6. Dispatch & sequencing

Dispatched on the plan approval (amendments folded in). claude_code implements → cursor reviews → human gate → merge → human deploys `--code-only` → **human live smoke** (web save `completed_gates` through `activation_deploy_validate` on a locked-use-case session; then over MCP: next = `iterate_enhance` → `get_step` agrees → complete each → `done: true`; **no direct DB writes**). Then **PR B plan revision** (amended blocked safety net) after PR A merges — no dispatch before its own gate.

## 7. PR B preview (unchanged from the approved (b) plan, as amended by the ruling)

`{blocked: true, blocked_by: {sectionTag, title, requiresGate}, message}`, `extra="forbid"`, no top-level step fields; deterministic configuration-problem message + server-side WARNING log; `vibe_next_step` description updated; contract test extended; D2 §3.3/§6 in-PR; 7 tools; monkeypatched-dangling-gate fixture (post-PR-A blocked is unreachable by construction → offline only); charter exceptions `engine.py` + `mcp_server.py`.

## 8. Ledger

Unchanged, plus: ~~"Phase 4 prerequisite: all-tracks gate invariant"~~ → **closed-by-PR-A once merged**; backup-table retention (human); smoke residue sessions `70ec5b95`, `c35a437c` (human, optional); `_merge_app_gates` RMW race; `vibe_start_track` unknown-use-case step-1 credit; LeaderboardPage 4 ESLint errors (first post-soak src PR); engine `skippedSteps` alias reader (remove later); absence-pin exception `r1_*`-globs-only (low risk).
