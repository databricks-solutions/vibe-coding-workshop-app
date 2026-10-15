# D10 — Facilitator & Learner Guide

**Status:** Draft · **Doc ID:** D10 (optional) · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D4 architecture](./mcp-workshop-architecture.md) · [D7 security](./mcp-workshop-security.md)
· [D9 rollout](./mcp-workshop-rollout.md).

> **Audience.** The facilitator running the Genie Accelerator over MCP, and the learner driving it
> in Genie Code. Operational, not architectural — how to connect, run, project, and troubleshoot.

> **⚠ This is a fallback, not the primary path.** The MCP experience is **self-serve by
> construction** (D1 §1a): the app's landing page carries the "Connect to Genie Code" on-ramp
> (D4 §1.1), and once connected the **server orients the learner and answers "how does this work?"
> in-band** (the `How does this workshop work?` prompt + `vibe://guide/getting-started` resource,
> D2 §4–§5). A learner needs **only the app URL** — not this document. This guide is a safety net
> for classroom facilitation and a human-readable copy of the troubleshooting the server already
> surfaces itself.

---

## 1. Prerequisites

- **Genie Code in Agent mode.** The MCP surface only works in **Agent mode** (probe / Databricks
  docs). Ask/edit modes won't invoke the tools.
- **Same workspace.** The MCP app and the learner's Genie Code must be in the **same Databricks
  workspace**.
- **The app is deployed with an `mcp-` name.** e.g. `mcp-vibe-workshop` (D9 §4). If the name doesn't
  start with `mcp-`, Genie Code won't offer it as an MCP server.
- **You're signed in.** The Databricks Apps auth proxy authenticates you; there is no separate MCP
  login (D7 §1).

---

## 2. Add the app as a Custom MCP server (learner)

1. Open **Genie Code** in your workspace and switch to **Agent mode**.
2. Open the MCP / custom-tools settings and **Add a custom MCP server**.
3. Enter the app's MCP URL: `https://<app-url>/mcp` (the app URL + `/mcp`).
4. Save. Genie Code performs the handshake; the `vibe_*` tools and the workshop prompts become
   available.
5. If it doesn't appear, see Troubleshooting (§7) — the usual cause is the 307 or an `mcp-` name.

Then start: on the Genie Accelerator say "Start the Genie Accelerator"; on any other track say
"Start a workshop track" with the track id shown in the app.

---

## 3. Start the track / continue

- Type or pick the start prompt for your track: on the Genie Accelerator, **"Start the Genie
  Accelerator"**; on any other track, **"Start a workshop track"** with the track id shown in the
  app. Genie Code calls `vibe_start_track`, then `vibe_get_step`, and presents step 1 (the prompt
  **verbatim**, then the why/how).
- To resume later, use **"Continue where I left off"** — it calls `vibe_next_step` from your saved
  progress (state is server-side, keyed to you).
- Answer the occasional in-band question in chat (§6). Silence accepts the recommended default —
  the track never blocks, except the Step-9 benchmark confirm and the two ontology publish
  confirms (§6).

**Genie Accelerator with the Genie Ontology on.** The optional ontology chapter comes straight after
the AI/BI Dashboard and before any Lakebase or app step (R7, D-137): … 12 Optimize Loop,
13 AI/BI Dashboard, **14 Model the Domain + Subdomains, 15 Author Pages, 16 Write the Routing
Page**, 17 Choose What to Activate, … 24 Deploy & Validate, 25 Iterate & Enhance, 26 Redeploy &
Test, 27 Workspace Clean Up (27 steps; 31 with the Lakehouse on). With the ontology off nothing
changes (24 steps).

**In-flight sessions (side effect of the move).** Progress is strict order (D-78). A learner who
turned the ontology on and has already started Activation now gets **Model the Domain** as their
next step: completed Activation steps stay done (no work is lost, no migration), and the remaining
Activation steps unlock once the three ontology steps are done or skipped. Expect this on sessions
started before the change; tell learners it is intended.

**Genie Ontology is on by default for new sessions (R2, R4).** The facilitator switch
`VIBE_DEFAULT_GENIE_ONTOLOGY` in `app.yaml` (template default `"true"`) turns the ontology on for
every NEW Genie Accelerator session, over MCP and in the web UI. It is read per call:
set it to `"false"` (or `0`/`off`/`no`) and redeploy if your workspace has no Genie One Pages.
Unset means on. Sessions that already exist keep their own setting; nothing is migrated, and the
manifest flag default stays off.

- **Beta caveat:** the Genie Ontology steps use Genie One Pages, a Beta feature. Check that the
  workspace has it before the workshop, or set the switch to `"false"`.
- **Learner opt-out:** both Genie Accelerator start prompts end with "If your workspace doesn't
  have Genie One Pages, say skip the ontology". Genie Code then calls `vibe_set_parameters` with
  `{include_genie_ontology: false}` and the outline drops to 24 steps.
- **Opting in late:** a learner who turns the ontology on after step 16 gets **Model the Domain**
  as their current step (strict order); completed steps stay done and the remaining steps follow
  once the three ontology steps are done.
- **Author Pages and Write the Routing Page are done in the Databricks UI.** Genie Code coaches the
  learner there, then asks "Confirm you published the Page in the Databricks UI" (or the routing
  Page). Only **published** completes the step; **not yet** keeps it open. Genie Code cannot
  complete these steps on its own.

**Web UI default (R2, R3, R5).** Every new web session starts on the Genie Accelerator, for every
coding assistant, with the ontology from the switch above (`GET /config/workshop-defaults`; if that
call fails the UI uses the template default: Genie Accelerator, ontology on). Picking a coding
assistant doesn't move a new session off it. Sessions that already exist open as they were saved;
one that never stored the ontology opens with it off.

- **The recommended card.** In **Workshop Path & Architecture** (Build Forward), a card marked
  "★ Recommended for this workshop" sits above the other paths. It shows the Genie Accelerator's
  chapters (Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync → App), its step count
  and its estimated build time, and reads "✓ Selected" while it is the session's path. Click it to
  pick it. "Choose a different path (Apps · Lakehouse · AI & Agents · other accelerators)" is
  folded while the Genie Accelerator is selected and open whenever another path is. The card
  follows the usual path locks, is disabled on a read-only (shared) session and is hidden in
  Reverse ETL.
- **Opt-out toggle.** The card holds **Include Genie Ontology (Beta: needs Genie One Pages)** and
  **Include Lakehouse**. Untick the ontology if the workspace has no Genie One Pages: the
  Ontology chapter drops out and the outline goes back to 24 steps. Switching back to the Genie
  Accelerator from another path turns the ontology back to the switch's default.
- **Which view a session reopens in (D-143).** Every new session stores its view: Technical when
  created in the web UI or over MCP, Insights when set up from the Insights view. Switching views
  with the header toggle stores the new one. A `?view=` link always wins; a session with no stored
  view opens in Technical.
- **Accepted cost, once.** Insights sessions started on main's 2.6.0 app have no stored view, so
  after this release reaches main they reopen in Technical one time. One click on **Insights**
  stores the view and they reopen there from then on. Tell learners it is expected.

---

## 4. Dual-surface projector setup (facilitator)

- Open the **web UI** (SPA) on the **same `session_id`** the learner is using. As the learner
  completes steps in Genie Code (`vibe_complete_step`), the UI mirrors gates and advances the
  narrative live (D4 §3.3) — ideal for projecting.
- The UI is a **companion + progress mirror**; the learner drives from Genie Code. Both read the
  same engine payload, so the story is identical on both surfaces.

---

## 5. The 20-tool budget caveat

Genie Code enforces a **~20-tool limit across all connected MCP servers**. The workshop uses **6**
tools. If the learner also has Databricks-managed MCPs connected (Genie, UC functions), they may hit
the ceiling and some tools won't load. If tools are missing:
- temporarily **disconnect other MCP servers**, or
- keep only the workshop server connected for the duration of the track.

---

## 6. What interactivity looks like (set expectations)

Genie Code has **no pop-up forms** for MCP (no elicitation) — so every question comes **as text in
the chat** and you answer in chat:

- **Comprehension checks** — a short "why does this matter" question, usually multiple-choice
  (`a`/`b`). Optional — you can skip; the track continues.
- **Recommend-and-proceed decisions** — the track states a **recommended default**
  (`recommended — building on this unless you correct me`) and proceeds; reply only if you want to
  override.
- **Gates** — approval is implicit: the agent's next action *is* the approval. You won't be blocked
  waiting.
- **The hard stops** — the **benchmark step** (`gagent_benchmarks`) requires an explicit
  confirmation that the benchmark answers are correct before it proceeds. With the Genie Ontology
  on, **Author Pages** and **Write the Routing Page** each require the learner to confirm they
  published the Page in the Databricks UI. This is by design.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App not offered as an MCP server | App name doesn't start with `mcp-` | Redeploy with an `mcp-` name (D9 §4) |
| "Connected" but no tools / silent failure | **307 redirect** on `POST /mcp` (Genie Code POSTs `/mcp`, app redirects to `/mcp/`) | Server must answer `/mcp` with 200 via path rewrite (D4 §2 / D8 §5). **This is the #1 cause — not CORS.** |
| Tools error immediately after connect | MCP app **lifespan not started** | Compose the MCP lifespan into the app (D4 §2.1) |
| Some tools missing | **20-tool budget** exceeded across servers | Disconnect other MCP servers (§5) |
| Intermittent 400s on tool calls | Assuming a stateful session | It's **stateless** — each call is independent; ensure `session_id` flows (D7) |
| "It's asking me things in chat, not a form" | **No elicitation** in Genie Code — by design | Answer in chat; that's the intended in-band flow (§6) |
| 302 to a login page (raw curl) | Auth proxy blocks unauthenticated requests | Expected — connect from authenticated Genie Code, not raw curl (D7 §1) |
| Suspecting CORS | Almost always the 307 instead | Rule out the 307 first (D7 §3); CORS is rarely the issue |

---

## 8. Learner quick reference

- **Mode:** Agent. **Server URL:** `https://<app-url>/mcp`.
- **Start:** "Start the Genie Accelerator". **Resume:** "Continue where I left off".
- **Answering:** in chat; silence = accept the recommended default.
- **Hard stops:** the benchmark step asks you to confirm; with the Genie Ontology on, so do Author
  Pages and Write the Routing Page (confirm you published the Page in the Databricks UI).
- **No Genie One Pages?** Say "skip the ontology".
- **Your progress is saved** server-side — switch between Genie Code and the web UI freely.

---

## 9. Open questions (defer to human)

1. **Exact Genie Code UI steps** for adding a custom MCP server may change with releases — verify
   against the current Genie Code docs and update §2 screenshots/labels.
2. **Whether to ship a facilitator "reset session" affordance** for classroom reuse.
3. **Recommended default app name** (e.g. `mcp-vibe-workshop`) — confirm with the deploy target.

---

## 10. Release note for #130 (integration → main)

Item for the release notes when #130 ships; this file is its home because the forge does not edit
#130.

- **New sessions start on the Genie Accelerator with the Genie Ontology on** (web UI and MCP, every
  coding assistant). A recommended card in Workshop Path & Architecture holds the Include Genie
  Ontology (Beta: needs Genie One Pages) and Include Lakehouse toggles; facilitators set the
  default with `VIBE_DEFAULT_GENIE_ONTOLOGY`. Existing sessions keep their saved path and settings.
- **Sessions remember their view.** Insights sessions started on 2.6.0 reopen in Technical once;
  one click on Insights stores the view from then on.
