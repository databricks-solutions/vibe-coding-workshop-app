# D7 — Auth, Identity & Security

**Status:** Draft · **Doc ID:** D7 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D4 architecture](./mcp-workshop-architecture.md) (deployment topology) ·
[D2 interface](./mcp-interface-contract.md) (tools that resolve identity).
**Extends:** roadmap §8.1. **Grounded in:** the probe
[`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe)
and [`designing-mcp-servers-for-genie-code.md` §4/§8](./designing-mcp-servers-for-genie-code.md).

> **Scope.** How the caller becomes a `session_id`, why the MCP session is not an auth boundary, the
> CORS reconciliation, the `/mcp` rate-limit decision, and stateless-concurrency isolation. It pins
> the probe-proven deployment facts so no one re-chases CORS.

---

## 0. Anchors verified live (2026-09-22)

| Fact | Location |
|---|---|
| Identity endpoint | `/api/user/current` `routes.py:6557` |
| `security_middleware` (origin guard + rate limit) | `app.py:60` |
| `security_middleware` special-cases `/api/` **only** | `app.py:64` |
| `CORSMiddleware` | `app.py:106` |
| `allow_origins = ALLOWED_ORIGINS` | `app.py:108` |
| `allow_credentials = False` | `app.py:109` |
| `ALLOWED_ORIGINS` (env, empty default) | `app.py:44` |
| SPA catch-all | `app.py:162` |

---

## 1. Identity model

- **The Databricks Apps auth proxy authenticates every request** before it reaches the app (OBO /
  workspace identity). Unauthenticated requests never arrive — they get a **302 to OAuth login**
  (probe finding; generic §4.5). So the app does not implement its own login on `/mcp`.
- **Resolve caller → `session_id` per request.** Reuse `/api/user/current` (`routes.py:6557`) to get
  the Databricks identity; map it to (or create) a session. `created_by` on `sessions`
  (D6 §1) records the identity.
- **`session_id` may be passed explicitly** for dual-surface continuity (UI → Genie Code, roadmap
  §10.3). When passed, **authorize it against the resolved identity** — a caller may only address a
  session whose `created_by` matches (or a facilitator role, if introduced). Never trust a
  client-supplied `session_id` blindly (D2 §11 open q1).

### 1.1 Managed-proxy identity nuance (probe)
Genie Code connects **through a managed MCP proxy**; the MCP `clientInfo.name` is the **connection
name**, not the user, and the transport forwards **no** client capabilities. **Do not** derive
identity or capability from `clientInfo` — identity comes from the auth proxy / `/api/user/current`,
capability from the transport-level `initialize` capture (D1 §2).

### 1.2 MCP session ≠ auth
The stateless MCP "session" is a transport convenience, not a security principal. Authorization is
always re-derived from the authenticated request identity, per request (generic §4.5, §8).

---

## 2. Deployment security facts (probe-proven — do not re-litigate)

From plan §1.3 / generic §4. These are **binding** and must be encoded (D4 §2):

1. **App name `mcp-…`** — recognition requirement, not a security control, but required.
2. **`POST /mcp` must return 200, not 307** — the trailing-slash trap; fix by ASGI path rewrite. A
   307 is the usual "it won't connect" cause, **not CORS** (§3).
3. **Lifespan wired** — else the MCP manager never starts (availability, not authz).
4. **Stateless** — durable state in Lakebase (D6); enables horizontal safety and isolation (§5).
5. **Auth proxy fronts `/mcp`** — 302 on unauthenticated (§1).

---

## 3. CORS reconciliation (stop chasing it)

- **Current code:** `allow_origins = ALLOWED_ORIGINS` (`app.py:108`, empty by default) +
  `allow_credentials = False` (`app.py:109`).
- **Why CORS is not the `/mcp` blocker:** Genie Code reaches `/mcp` **through the auth proxy**
  (effectively server-to-server), not a browser CORS flow. Even for a browser, Starlette's
  `CORSMiddleware` with `allow_origins=["*"]` + `allow_credentials=True` **echoes** the request
  origin rather than sending literal `*`, so preflight succeeds. The Databricks docs' CORS example
  is optional hardening, not the fix (plan §1.3.3).
- **Decision:**
  - **SPA browser calls** (`/api/*`): keep the explicit `ALLOWED_ORIGINS` allowlist; add the
    workspace URL there if a real browser-CORS error ever appears. Do **not** switch to a wildcard.
  - **`/mcp`:** no CORS change needed. If a preflight ever surfaces, allow the workspace origin
    explicitly — never `*` with credentials.
- **Anti-pattern:** concluding a failed Genie Code connection is "a CORS problem." Check the 307
  (§2.2) first.

---

## 4. `security_middleware` and `/mcp` (the rate-limit decision)

`security_middleware` (`app.py:60`) applies the origin guard **and** rate limiter **only** to paths
that `startswith("/api/")` (`app.py:64`). Consequences and the required decision:

- **`/mcp` bypasses the origin guard** — **intended**: Genie Code's proxy origin must not be
  blocked.
- **`/mcp` bypasses the rate limiter** — **a gap.** Pair the "stateless, durable state in Lakebase"
  posture with an **explicit `/mcp` abuse decision** (roadmap open q). Options:
  1. **Rely on the auth proxy** (only authenticated workspace users reach `/mcp`) + per-identity
     write idempotency (D3 F3) — *recommended for v1*, since tools are idempotent and non-destructive
     (D2 §8) and the blast radius is a single user's own session.
  2. Add a **lightweight per-identity rate limit** for `/mcp` write tools if abuse appears — but keep
     it **stateless** (Lakebase-backed counters, not the in-process bucket, which is void under the
     stateless rule).
- **Do not** extend the in-process rate bucket to `/mcp` — it is not correct under statelessness
  (roadmap "never rely on in-process caches/rate-buckets for correctness").

---

## 5. Stateless-concurrency isolation

- Every read/write is **scoped by the resolved `session_id`** (D6 §6). Two concurrent users share no
  in-process state (stateless MCP), and no engine call reads another session's rows in the hot path.
- `complete_step` uses **set semantics** on `completed_gates` (idempotent, D3 F3), so concurrent
  retries of the same user's call cannot corrupt state.
- `session_interactions` is **append-only** (D6 §3), avoiding read-modify-write races.
- **Isolation invariant:** a tool call for identity A can never observe or mutate identity B's
  session. D8 includes a two-session concurrency test (plan §1.3 / generic §9.3).

---

## 6. Least privilege & secrets

- The app runs as its **service principal** for its own resources (Lakebase); OBO identity is used
  only to attribute the session (`created_by`) and authorize session access (§1).
- No new secrets are introduced by the MCP surface. Reuse existing env config (roadmap env vars).
- **Adaptive coaching (`vibe_coach`, D2 §3.7) calls FMAPI as the app SP** via the existing
  `call_databricks_serving_endpoint` path (`routes.py:1400`) and the existing
  `DATABRICKS_SERVING_ENDPOINT` config (`routes.py:440`) — **no new endpoint, credential, or secret**.
  The learner's OBO identity is not forwarded to the model call; coaching is generated under the SP,
  the same trust boundary as every other Lakebase read.
- No benchmark question text, literals, or PII in tool outputs, resource payloads, or interaction
  logs (D6 §8) — respect the firewall spirit.

### 6.1 Coaching firewall (the LLM path — hard)

An LLM that sees step context could parrot contaminating content, so `vibe_coach` is firewalled on
**both** sides of the model call:

- **Input side.** The grounding context (D2 §12.3) is assembled from concepts and the learner's own
  artifacts — never raw benchmark question text, sample data rows, secrets, or PII. `_COACH_SYSTEM`
  (D2 §12.2) explicitly forbids emitting any of those.
- **Output side.** The generated text is **leakage-scrubbed before it is returned to the agent and
  before it is stored** in `session_interactions.coaching_shown` (D6 §3a). A scrub failure fails
  **closed to the static fallback** (`is_fallback:true`) — it never ships unscrubbed model text.
- **Verbatim safety.** Coaching explains but never re-issues the step `prompt`; the authoritative
  instruction stays the assembler's verbatim body (D1 §7).

---

## 7. Threat model (brief)

| Threat | Mitigation |
|---|---|
| Unauthenticated access to `/mcp` | Auth proxy 302 before the app (§1) |
| Cross-user session access via spoofed `session_id` | Authorize `session_id` against resolved identity (§1) |
| Identity spoof via `clientInfo` | Never trust `clientInfo`; identity from auth proxy (§1.1) |
| `/mcp` abuse / floods | Auth-gated + idempotent tools; optional stateless per-identity limit (§4) |
| State corruption under concurrency | Session-scoped reads, set-semantics gates, append-only log (§5) |
| Data exfiltration in payloads | No literals/PII in outputs or logs (§6) |
| Coaching LLM leaks benchmark text / data / PII | Input-side firewall in `_COACH_SYSTEM` + concept-only context; output-side scrub before return **and** store; scrub failure → static fallback (§6.1) |

---

## 8. Security checklist

- [ ] Every tool resolves identity → `session_id` server-side (§1).
- [ ] Client-supplied `session_id` authorized against `created_by` (§1).
- [ ] Identity/capability never derived from `clientInfo` (§1.1).
- [ ] `POST /mcp` returns 200 (no 307); regression-tested (§2.2, D8).
- [ ] SPA CORS keeps the explicit allowlist; no wildcard-with-credentials (§3).
- [ ] Explicit `/mcp` rate-limit decision recorded; no in-process bucket on `/mcp` (§4).
- [ ] Two-session isolation test passes (§5, D8).
- [ ] No literals/PII in tool outputs, resources, or interaction logs (§6).
- [ ] `vibe_coach` output is leakage-scrubbed before return **and** before store; scrub failure →
      static fallback; no new secret/endpoint (§6.1, D8 §4).

---

## 9. Open questions (defer to human)

1. **Facilitator role.** Should a facilitator identity read another learner's session (projector
   use)? If yes, define the role and relax §1's same-identity rule for read-only.
2. **`/mcp` rate limiting.** Ship v1 with auth-proxy-only (recommended) or add a stateless
   per-identity limit now?
3. **Session creation policy.** Auto-create on first `vibe_start_track`, or require an explicit
   session provisioned by the UI first?
