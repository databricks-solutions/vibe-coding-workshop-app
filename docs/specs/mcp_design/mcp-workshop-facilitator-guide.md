# D10 — Facilitator & Learner Guide

**Status:** Current for release 2.8.0 · **Doc ID:** D10 (optional) · **Date:** 2026-09-22, updated 2026-10-15 · **Target repo:** `vibe-coding-workshop-app`
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

## 0. Before the workshop: deploy and configure (facilitator)

Do this once per workspace, at least a day before the session, so there is time to fix anything.

### Deploy or upgrade the app

1. **Name the app with an `mcp-` prefix** (in your `user-config.yaml`, `app.name`; the example uses
   `mcp-vibe-coding-workshop-app`). Genie Code only offers apps whose name starts with `mcp-` (§1).
2. **Run the table step first:** `./scripts/deploy.sh --tables-only`. It is additive: it creates
   missing tables and adds new prompt rows, and never overwrites rows you have edited. Never use
   `--tables-recreate` on an install that has learner sessions; it drops the configuration tables.
3. **Only when upgrading an older install** whose sessions predate gate-based progress: run the R1
   gate backfill first (dry run, then apply), as described in the #130 upgrade notes (B3 step 2).
4. **Install dependencies and deploy the code:** `npm ci`, then `./scripts/deploy.sh --code-only`.
   A fresh install can run `./scripts/deploy.sh` once instead of steps 2 and 4.

### Settings in `app.yaml`

`app.yaml` is generated from `app.yaml.template` (`./vibe2value configure`) and is not in git, so a
merge never changes it. After an upgrade, check that it has these keys:

| Key | Default | What it does |
|---|---|---|
| `MCP_MOUNT_ENABLED` | `"true"` | Serves the Genie Code MCP server at `/mcp`. `"false"` turns it off. |
| `DATABRICKS_SERVING_ENDPOINT` | your choice | The model behind PRD, step prompts and the other generated text. The code default is `databricks-claude-sonnet-5-5`. |
| `VIBE_COACH_ENDPOINT` | `databricks-claude-sonnet-5-5` | The model the Genie Code coach uses. Unset uses `DATABRICKS_SERVING_ENDPOINT`. |
| `VIBE_COACH_BUDGET_S` | `"20"` | Seconds the coach waits for the model before falling back to the step's static help. |
| `VIBE_DEFAULT_GENIE_ONTOLOGY` | `"true"` | Turns the Genie Ontology on for new Genie Accelerator sessions. Set `"false"` if the workspace has no Genie One Pages (§3). |
| `VIBE_STEP_PROMPT_PREFETCH` | `"true"` | Prepares the next step's prompt in the background over MCP (§3). `"false"` renders it on completion. |
| `VIBE_MCP_STRICT_OWNER` | `"true"` | A Genie Code request with no user identity can't open a session someone owns (§4). Databricks Apps always sends `x-forwarded-email`; set `"false"` only if your workspace's proxy sends no identity header. |
| `IDEATE_ANALYSIS_ENDPOINT` | blank | Optional stronger model for Ideate's impact sizing. Blank uses `DATABRICKS_SERVING_ENDPOINT`. |
| `INSIGHTS_BUILD_RECIPES` | blank | Insights add-ons turned on for everyone (`ontology`, `alerts`, `app_view`, `copilot` or `all`). |

The switches are read per call, but `app.yaml` only changes on the next deploy.

### Check it before the room arrives

- Open the app URL: the Release Notes page should show 2.8.0 as the latest release.
- In Genie Code (Agent mode), add `https://<app-url>/mcp` as a custom MCP server (§2), say "Start the
  Genie Accelerator", and check that step 1 appears and that the coach answers "what should I do
  now?". The full check is [docs/superpowers/genie-code-smoke-script.md](../../superpowers/genie-code-smoke-script.md).
- If the workspace has no Genie One Pages, set `VIBE_DEFAULT_GENIE_ONTOLOGY` to `"false"` and redeploy
  before the session, rather than asking every learner to opt out.

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

In the app, choose **Interactive Mode (MCP Server)** (Recommended · Beta; Copy & Paste is the
default). The panel shows these four steps in order:

1. **Copy your MCP URL** — This link connects Genie Code to this workshop app.
   (The app shows the real URL, `https://<app-url>/mcp`, with a copy button.)
2. **Open Genie Code in Agent mode** — In your Databricks workspace, open Genie Code and switch the mode to Agent.
3. **Add the URL as a custom MCP server** — Open MCP settings, choose "Add custom MCP server", paste the URL from Step 1, then Save.
4. **Start the workshop** — Paste this message into the Genie Code chat and press Enter:
   **"Start a workshop track: <track name> (session <id>)"** (shown in the app with a copy button).

After Save, Genie Code performs the handshake; the `vibe_*` tools and the workshop prompts become
available. If it doesn't appear, see Troubleshooting (§7) — the usual cause is the 307 or an
`mcp-` name. Without the web UI, say "Start a workshop track" with the track name ("Start the
Genie Accelerator" still works too).

---

## 3. Start the track / continue

- Type the line the web UI shows: **"Start a workshop track: <track name> (session <id>)"**. It is
  in the Genie Code card of **Choose Your Coding Assistant** (with the MCP URL and the four
  setup steps) and again in **Set Up Project**, each with a copy button; it names the
  session's track and id, so Genie Code continues that same web session. Without the web UI, say
  **"Start a workshop track"** with the track ("Start the Genie Accelerator" still works too). The track can be its
  id or a name a learner would say ("Genie Accelerator", "Apps + Lakebase", "lakehouse with AI",
  "Reverse ETL: Analytics App"); "Lakehouse" means Build Forward unless the learner says "reverse".
  Add the web session's id to continue that same session (§4). Genie Code calls
  `vibe_start_track`, then `vibe_get_step`, and presents step 1 (the prompt **verbatim**, then the
  why/how).
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

- **Two track tabs.** **Workshop Path & Architecture** opens with two tabs: **★ Genie Accelerator ·
  Recommended** and **Other tracks**. The Genie tab holds the "★ Recommended track" card: the
  Genie Accelerator's chapters (Metric View → Genie Agent → Dashboard → Ontology → Lakebase sync →
  App), its step count and estimated build time, "✓ Selected" while it is the session's track,
  and its stage strip. **Other tracks** shows everything else as before: Build Forward / Reverse
  ETL, the Apps, Lakehouse and AI & Agents columns and the other accelerators. Clicking Other
  tracks only changes the view ("Current track: Genie Accelerator. Pick one below to switch");
  picking a track there switches it, and one click on the Genie tab switches back. The Genie tab
  follows the usual path locks, can't switch tracks on a read-only (shared) session, and is
  disabled in Reverse ETL (switch to Build Forward first).
- **Opt-out toggle.** The card holds **Include Genie Ontology (Beta: needs Genie One Pages)** and
  **Include Lakehouse**. Untick the ontology if the workspace has no Genie One Pages: the
  Ontology chapter drops out and the outline goes back to 24 steps. Switching back to the Genie
  Accelerator from another path turns the ontology back to the switch's default.
- **Which view a session reopens in (D-143).** Every new session stores its view: Technical when
  created in the web UI or over MCP, Insights when set up from the Insights view. Switching views
  with the header toggle stores the new one. A `?view=` link always wins; a session with no stored
  view opens in Technical.
- **Accepted cost, once.** Insights sessions started on main's 2.6.0 or 2.7.0 app have no stored
  view, so after this release reaches main they reopen in Technical one time. One click on **Insights**
  stores the view and they reopen there from then on. Tell learners it is expected.

**Step prompts are prefetched by default (D-160).** Over MCP, when a step becomes current the
app starts generating the next step's prompt in the background, so `vibe_complete_step` returns it
without the usual 20-47 s wait. It does this only when the next step needs nothing the current
step produces (for example `prd_generation` after `project_setup`, or `iterate_enhance`); the
skills steps that build on the previous step's output still render on complete, as before. The web
UI is unchanged.

- **Switch:** `VIBE_STEP_PROMPT_PREFETCH` in `app.yaml` (template default `"true"`), read per
  call. Unset means on. Set it to `"false"` (or `0`/`off`/`no`) and redeploy to get exactly the
  old behaviour back.
- **Cost:** a prefetch for a step the learner never reaches is a wasted generation.
- **Start-of-session burst:** `prd_generation` starts generating as soon as `project_setup`
  becomes current, that is at session start. When a room starts together, more `prd_generation`
  generations run at the same moment than before (before, they spread over each learner's
  `project_setup` completion). The serving endpoint showed about 20 concurrent requests before
  queueing; a queued generation still falls back to the template after 90 s. If a large room
  sees slow or template prompts on `prd_generation`, set the switch to `"false"`.

---

## 4. Dual-surface projector setup (facilitator)

- Open the **web UI** (SPA) on the **same `session_id`** the learner is using. As the learner
  completes steps in Genie Code (`vibe_complete_step`), the UI mirrors gates and advances the
  narrative live (D4 §3.3) — ideal for projecting.
- The UI is a **companion + progress mirror**; the learner drives from Genie Code. Both read the
  same engine payload, so the story is identical on both surfaces.

**Moving between the web UI and Genie Code (one engine, two interfaces).** It is one session either
way; both sides read and write the same row.
- **Web to Genie Code:** start the track with the web session's id (`vibe_start_track` with
  `session_id`). If that session was never named, Genie Code names it ("Genie Code — …"), so the
  web UI's "New session" clean-up can't delete it. A name the learner chose is never replaced.
- **Genie Code to the web UI:** every start, switch and save returns a `session_url`; open it. An
  open web tab also catches up by itself (every 30 s, and as soon as you switch back to it) and
  says what changed ("Now on Lakehouse"). A session Genie Code started after this one shows up as
  "New session in Genie Code" with an **Open** button. If Genie Code changed the session while the
  Save dialog was open, Save takes those changes first and asks you to save again.
- **Switch track** from either side, under the same rule: any track until Set Up Project is done,
  then only the next step on the same path (Apps → + Lakebase → + Lakehouse → + AI and Agents).
  Over MCP, `vibe_switch_track` (or starting with another track on the same session) applies it;
  when it's blocked, Genie Code offers a new session on the other track. The Agent Skills
  Accelerator always needs a new session.
- **Save or rename** from either side: the web UI's Save, or `vibe_save_session` (1-100
  characters, not "New Session").
- **Find a session** over MCP with `vibe_list_sessions` (the learner's own sessions, newest first),
  then continue it with its id.
- **Only your own sessions.** Every Genie Code call checks that the session belongs to the caller
  (the `x-forwarded-email` identity the Apps proxy adds). A request without an identity can't open
  a session someone owns (`VIBE_MCP_STRICT_OWNER`, §0), so a session id seen on someone's screen
  is not enough to open their session.

---

## 5. The 20-tool budget caveat

Genie Code enforces a **~20-tool limit across all connected MCP servers**. The workshop uses **10**
tools (7 for the walk, plus `vibe_switch_track`, `vibe_save_session` and `vibe_list_sessions`). If the learner also has Databricks-managed MCPs connected (Genie, UC functions), they may hit
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
- **Start:** the line the web UI shows, "Start a workshop track: <track> (session <id>)" (or just
  "Start a workshop track: Genie Accelerator"). **Resume:** "Continue where I left off".
- **Answering:** in chat; silence = accept the recommended default.
- **Hard stops:** the benchmark step asks you to confirm; with the Genie Ontology on, so do Author
  Pages and Write the Routing Page (confirm you published the Page in the Databricks UI).
- **No Genie One Pages?** Say "skip the ontology".
- **Your progress is saved** server-side — switch between Genie Code and the web UI freely.
- **Change track, save or find a session:** ask Genie Code ("switch to Apps + Lakebase", "save
  this session as Retail demo", "list my sessions").

---

## 9. Open questions (defer to human)

1. **Exact Genie Code UI steps** for adding a custom MCP server may change with releases — verify
   against the current Genie Code docs and update §2 screenshots/labels.
2. **Whether to ship a facilitator "reset session" affordance** for classroom reuse.
3. **Recommended default app name** (e.g. `mcp-vibe-workshop`) — confirm with the deploy target.

---

## 10. Release notes

This release ships as **2.8.0**. Its notes are on the app's Release Notes page
(`src/constants/releaseNotes.ts`): running the workshop from Genie Code, the coach, the Genie
Accelerator and Genie Ontology as the default for new sessions, the new ontology position, strict
step order, prefetched step prompts, sessions that remember their view (Insights sessions started on
2.6.0 or 2.7.0 reopen in Technical once), and the new `app.yaml` settings in §0.
