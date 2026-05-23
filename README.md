<div align="center">
  <h1>Vibe to Value</h1>
  <h3>Vibe Coding Workshop</h3>
  <p>An interactive workshop where participants can define their intent and build production-ready data applications grounded by <a href="https://agentskills.io/home">agent skills</a>, deployed using Vibe coding best practices.</p>
</div>

### 3 Key Learnings

1. **How to vibe code with intent** — fast, structured, and repeatable
2. **Take an idea through the full lifecycle in a gamified, engaging experience** — from defining the concept to building, deploying, and iterating on a real solution.
3. **How to apply Databricks best practices through embedded [agent skills](https://agentskills.io/home),** ensuring that AI-generated code stays governed, trusted, and production-ready.

<div align="center">
  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Databricks-FF3621?style=for-the-badge&logo=databricks&logoColor=white" alt="Databricks" />
    <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  </p>
</div>

<div align="center">
  <a href="https://www.youtube.com/watch?v=MUa5kbIV1Lc">
    <img src="https://img.youtube.com/vi/MUa5kbIV1Lc/maxresdefault.jpg" alt="Workshop Walkthrough" width="70%" />
  </a>
  <br/><br/>
  <a href="https://www.youtube.com/watch?v=MUa5kbIV1Lc">
    <img src="https://img.shields.io/badge/▶_Watch_Walkthrough-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch on YouTube" />
  </a>
</div>

<h2 align="center">Choose Your Path</h2>

<table>
  <tr>
    <td align="center" width="50%">
      <h3>Build a Sample Booking App</h3>
      <p><em>Follow the guided workshop with a pre-built use case</em></p>
      <img src="docs/images/workshop-overview.gif" alt="Workshop Overview" width="100%"/>
    </td>
    <td align="center" width="50%">
      <h3>Define Your Own Use Case</h3>
      <p><em>Bring your own idea and let AI generate the prompts</em></p>
      <img src="docs/images/Creating%20your%20own%20custom%20usecase.gif" alt="Custom Use Case" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <h3>Build a New Agent Skill</h3>
      <p><em>Extend the platform with custom AI agent capabilities</em></p>
      <img src="docs/images/Building%20a%20new%20Agent%20Skill.gif" alt="Agent Skill" width="100%"/>
    </td>
    <td align="center" width="50%">
      <h3>Use a Specific Accelerator</h3>
      <p><em>Jump-start development with pre-built solution patterns</em></p>
      <img src="docs/images/Using%20specific%20accelerators.gif" alt="Accelerators" width="100%"/>
    </td>
  </tr>
</table>

---

## What It Does

- **AI-Generated Prompts** — Customized, copy-ready prompts for every development step, tailored to your industry and use case
- **Guided Workflow** — 30+ steps covering Foundation, Databricks App, Lakebase, Lakehouse, AI and Agents, Refinement, Agent Skills, and Workspace Clean Up
- **Real-Time Streaming** — LLM responses rendered live with markdown formatting
- **Voice Input** — Describe your use case by speaking; speech-to-text captures your intent
- **Gamified Experience** — Progress tracking, leaderboard, and completion badges
- **Analytics Dashboard** — Read-only view of workshop usage metrics and session activity
- **One-Command Install** — Clone, run the installer, and you're live

---

## Quick Start

### Prerequisites

- **Node.js 18+** and **Python 3.9+**
- **Databricks CLI**
  - macOS: `brew install databricks`
  - Linux: `curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh`
  - Windows: `winget install Databricks.DatabricksCLI`
- **Windows only:** **Git for Windows** (provides `bash.exe`, used by the deployer to run the bundled `.sh` scripts). Install with `winget install Git.Git`, or run `scripts\install-prerequisites.ps1` to install everything (Git, Python, Node, Databricks CLI) in one shot.
- A **Databricks workspace** with Unity Catalog and Lakebase access (autoscaling mode is default and recommended)

### Install

The bundle ships with **canonical defaults already committed** -- `databricks.yml` declares a Lakebase Autoscaling project + branch, an app shell bound to this upstream git repo (`https://github.com/databricks-solutions/vibe-coding-workshop-app`, branch `main`), and an `apps.<name>.resources[].database` binding that wires the app's service principal to the Lakebase database with `CAN_CONNECT_AND_CREATE`. `app.yaml` reads PG* env vars injected by that binding at runtime; the FastAPI lifespan handler applies DDL + seed migrations on first cold start. **A fresh `git clone` is deploy-ready with zero local edits.**

#### One-shot install -- single CLI call (recommended for the workspace admin)

The first person who installs the app on a workspace must use the CLI -- it is the only path that provisions Lakebase. After that, additional attendees can spin up their own copies of the app entirely through the workspace UI (see below).

```bash
git clone https://github.com/databricks-solutions/vibe-coding-workshop-app.git
cd vibe-coding-workshop-app
databricks bundle deploy -p <your-databricks-cli-profile>
```

That single command:

1. Provisions the Lakebase Autoscaling project + the `main` branch.
2. Creates the Databricks App from this git repository (`git_repository` field) so the app code is pulled directly from GitHub on first start.
3. Declares the `apps.<name>.resources[].database` binding. The Apps platform creates the app's service principal a Postgres role on the bound branch with `CAN_CONNECT_AND_CREATE`, and injects `PGHOST` / `PGUSER` / `PGDATABASE` / `PGPORT` / `PGSSLMODE` into the running container.
4. Grants the workspace `users` group `CAN_USE` on the app and the Lakebase project.

When the app cold-starts, its FastAPI lifespan handler ([`app.py`](app.py)) calls [`src/backend/migrations.py::apply_pending_migrations`](src/backend/migrations.py), which mints a fresh Lakebase OAuth token via the SDK and replays every `db/lakebase/ddl/*.sql` and `db/lakebase/dml_seed/*.sql` file that is not yet present in the `<schema>._migrations` ledger. Subsequent cold starts are no-ops; new SQL files added to the repo are applied automatically the next time the app restarts.

> **Operator helper script:** `./scripts/deploy.sh -p <profile>` wraps the same `databricks bundle deploy` and adds two niceties -- a `bundle validate` pre-check that catches YAML/schema errors before any provisioning happens, and a frontend `dist/` staleness check. Use it instead of the raw `bundle deploy` call if you want those guards.

> **Zero-config:** the canonical `databricks.yml` ships with safe defaults for every required value (instance name, schema, app name, git URL). `user-config.yaml` is only needed if you fork and want to override those defaults via `./vibe2value install`.

#### UI git deploy (additional attendees, after the admin install)

Once the workspace admin has run the one-shot install above, additional attendees can spin up their own copies of the app entirely through the UI -- no CLI required:

1. In your workspace, go to **Apps -> Create app -> Custom app**.
2. Choose **From a Git repository** and paste:
   ```
   https://github.com/databricks-solutions/vibe-coding-workshop-app
   ```
   (branch `main`, provider `gitHub`).
3. Click **Deploy** to create the app shell from the repo.
4. Once the app is created, click **+ Add resource -> Database** and pick the existing Lakebase database the admin provisioned (`vibe-coding-workshop-lakebase` -> branch `main` -> database `databricks-postgres`). Grant `CAN_CONNECT_AND_CREATE`. This step is what makes the platform inject `PGHOST` etc. into the new app's runtime -- without it, the app starts but `/health/lakebase` will keep reporting `ready: false`.

The new app uses the same Lakebase project as the admin install; the `<schema>._migrations` ledger ensures DDL + seed migrations are applied exactly once across all attendee apps.

> **Why can't the UI flow create Lakebase?** Lakebase Autoscaling projects are bundle resources; the workspace **Apps -> Create** UI provisions only the app shell. Anyone with `CREATE_APPLICATION` on the workspace can use the UI flow, but the admin must have run `databricks bundle deploy` at least once to create the shared Lakebase project and database.

#### Customise before installing (forks)

Forks that want different resource names, branding, a different upstream URL, or workspace-source mode (instead of git-source) should run the interactive customizer:

```bash
./vibe2value install
```

This walks you through workspace URL, authentication, resource naming, branding, and frontend build, then **overwrites** the committed `databricks.yml` / `app.yaml` / seed SQL / `brand-config.json` with your custom values, then runs the same two bundle commands as the one-shot. Treat the resulting working-tree diff as your customization -- don't commit it back upstream unless you intend to change the canonical defaults for everyone.

**Windows (PowerShell, run as Administrator the first time):**

```powershell
git clone https://github.com/databricks-solutions/vibe-coding-workshop-app.git
cd vibe-coding-workshop-app
powershell -ExecutionPolicy Bypass -File scripts\install-prerequisites.ps1
.\vibe2value install
```

### Commands

| Command | Description |
|---------|-------------|
| `databricks bundle deploy -p <profile>` | **One-shot install** -- provisions Lakebase + app + resource binding in a single call. Migrations apply on the app's first cold start. |
| `./scripts/deploy.sh -p <profile>` | Same as above, plus a `bundle validate` pre-check and a `dist/` freshness guard. |
| `./vibe2value install` | Interactive customization (workspace URL, resource names, branding) + first-time deploy. |
| `./vibe2value deploy` | Push code changes (build + sync + deploy) -- requires `user-config.yaml`. |
| `./vibe2value deploy --full` | Full infrastructure redeploy. |
| `./vibe2value deploy --tables` | Out-of-band DDL/seed reseed via `scripts/legacy/post_deploy.py` (shares the same `_migrations` ledger as the runtime path). |
| `./vibe2value deploy --watch` | Continuous file sync for development. |
| `./vibe2value doctor` | Validate prerequisites, config, and auth. |
| `./vibe2value configure` | Re-render `databricks.yml` etc. from `user-config.yaml`. |
| `./vibe2value uninstall` | Tear down all provisioned resources. |

> On Windows, replace `./vibe2value` with `.\vibe2value` (the repo ships both a bash launcher and a `.cmd` wrapper).

> **Contributing:** the canonical `databricks.yml`, `app.yaml`, seed SQL, and `brand-config.json` are committed at vanilla defaults so zero-config installs work. Running `./vibe2value configure` re-renders them from your local `user-config.yaml`; do not commit that diff unless you intentionally changed the canonical defaults.

---

## How It Works

The installer uses a **template + config** model. Templates with `__PLACEHOLDER__` tokens are checked into Git; your local `user-config.yaml` (gitignored) stores workspace-specific values. Running `./vibe2value configure` renders the templates into deployment-ready files.

```
Templates (in Git)                    Generated files (gitignored)
──────────────────                    ────────────────────────────
databricks.yml.template          →   databricks.yml
app.yaml.template                →   app.yaml
03_seed_workshop_parameters      →   03_seed_workshop_parameters.sql
  .sql.template
user-config.yaml.example         →   user-config.yaml
```

A full deploy (`./vibe2value deploy --full` or `./scripts/deploy.sh`) collapses to a single `databricks bundle deploy`:

1. `databricks bundle validate -t <target>` -- catch yaml/schema errors before any provisioning happens (only when invoked through `./scripts/deploy.sh`).
2. `databricks bundle deploy -t <target>` -- declaratively applies:
   - the Lakebase Autoscaling project + branch (with `users`-group `CAN_USE`);
   - the Databricks App, pulled from this git repository via `git_repository`;
   - the `apps.<name>.resources[].database` binding that wires the app's service principal to the Lakebase database with `CAN_CONNECT_AND_CREATE`. The Apps platform owns Postgres role creation and OAuth credential rotation.

When the app cold-starts, the FastAPI lifespan handler in [`app.py`](app.py) calls [`src/backend/migrations.py::apply_pending_migrations`](src/backend/migrations.py), which:
   - reads `PGHOST` / `PGUSER` / `PGDATABASE` / `PGPORT` / `PGSSLMODE` from the env (injected by the resource binding);
   - mints a fresh Lakebase OAuth token via `client.postgres.generate_database_credential(endpoint=ENDPOINT_NAME)`;
   - applies every `db/lakebase/ddl/*.sql` and `db/lakebase/dml_seed/*.sql` whose filename is not yet present in the `<schema>._migrations` ledger.

The migration step never raises into the lifespan path -- failures are recorded on `app.state` and surfaced via `/health/lakebase`, so the app process stays up while the React shell renders a clear "waiting for Lakebase bootstrap" state.

The installer prompts for Lakebase mode (autoscaling or provisioned). Autoscaling is the default; it uses a Lakebase project that scales to zero when idle.

---

## Project Structure

```
├── vibe2value                  # CLI entry point (bash wrapper, macOS/Linux)
├── vibe2value.cmd              # CLI entry point (Windows wrapper for cmd.exe / PowerShell)
├── app.py                      # FastAPI backend entry point
├── app.yaml.template           # App config template
├── databricks.yml.template     # Asset Bundle template
├── user-config.yaml.example    # Example user configuration
│
├── scripts/
│   ├── vibe2value.py           # CLI logic (install, deploy, doctor, uninstall)
│   ├── deploy.sh               # Deployment orchestration
│   ├── setup-lakebase.sh       # Lakebase table management (DDL/DML)
│   └── lakebase_manager.py     # Lakebase/app management helpers
│
├── db/lakebase/                # DDL and seed data for Lakebase tables
│   ├── ddl/                    # Table definitions (6 files)
│   └── dml_seed/               # Seed data + template for workshop params
│
├── src/
│   ├── App.tsx                 # Main React component
│   ├── api/client.ts           # Frontend API client
│   ├── components/             # React UI components
│   ├── constants/              # Scoring, workflow sections, verification links
│   ├── hooks/                  # Custom hooks (speech-to-text, keyboard)
│   └── backend/
│       ├── api/routes.py       # FastAPI routes
│       └── services/lakebase.py # Lakebase connection layer (autoscaling + provisioned)
│
└── docs/                       # Design documentation and images
```

---

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: FastAPI (Python)
- **LLM**: Databricks Model Serving
- **Database**: Lakebase (PostgreSQL) with autoscaling and Unity Catalog integration
- **Infrastructure**: Databricks Asset Bundles
- **Deployment**: Databricks Apps

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Authentication failure | `databricks auth login --host <url>` then `./vibe2value doctor` |
| `FileNotFoundError` running `npm` or `deploy.sh` on Windows | Install Git for Windows (`winget install Git.Git`) and reopen the terminal so `bash.exe` is on `PATH`. Then re-run `.\vibe2value doctor`. |
| App stuck UNAVAILABLE | `./vibe2value deploy --full` (includes forced restart) |
| "App already exists" | Installer handles this automatically; if persistent: `databricks apps delete <name>` then retry |
| "Multiple profiles matched" | Set `profile` in `user-config.yaml` or re-run `./vibe2value install` |
| Lakebase connection error | `./scripts/setup-lakebase.sh --check-instance` then `./vibe2value deploy --tables` |
| Slow first query after idle | Lakebase autoscaling may need ~30s to wake from zero; the app retries automatically |
| "Endpoint not found" during deploy | Re-run `./vibe2value deploy --full` — endpoint discovery runs after Lakebase project is ready |

---

## Local Development

**macOS / Linux**

```bash
# Frontend
npm install && npm run dev

# Backend
pip install -r requirements.txt && python app.py
```

**Windows (PowerShell)**

```powershell
# Frontend
npm install; npm run dev

# Backend
pip install -r requirements.txt; python app.py
```

Deploy changes: `./vibe2value deploy` (macOS/Linux) or `.\vibe2value deploy` (Windows).

---

## Cost to Run

Running the workshop costs **under $300/month** with the app up 24/7 — and significantly less with default settings and typical usage.

| Component | What It Uses | Approximate Cost |
|-----------|-------------|-----------------|
| **Databricks App** | Medium compute (0.5 DBU/hr), always-on | Largest steady-state cost |
| **Lakebase** (Autoscaling) | 0.5–2 CU default; scales to zero on idle | Minimal at default 0.5 CU min |
| **Foundation Model API** | Pay-per-token (Claude Sonnet); only charged when generating prompts | A few dollars for typical workshop usage |

Actual dollar costs depend on your cloud provider, pricing tier, and DBU rate. See [Databricks Pricing](https://www.databricks.com/product/pricing) for current rates.

> **Tip:** To minimize cost, stop the app when not in use (`databricks apps stop <app-name>`) and keep the default Lakebase autoscaling minimum at 0.5 CU.

---

## License

(c) 2026 Databricks, Inc. All rights reserved.

The source in this project is provided subject to the [Databricks License](https://databricks.com/db-license-source). See [LICENSE.md](LICENSE.md) for details.

<details>
<summary>Third-Party Licenses</summary>

| Package | Version | License | Project URL |
|---------|---------|---------|-------------|
| [fastapi](https://github.com/fastapi/fastapi) | ≥0.109.0 | MIT | https://github.com/fastapi/fastapi |
| [uvicorn](https://github.com/encode/uvicorn) | ≥0.27.0 | BSD-3-Clause | https://github.com/encode/uvicorn |
| [pydantic](https://github.com/pydantic/pydantic) | ≥2.5.0 | MIT | https://github.com/pydantic/pydantic |
| [httpx](https://github.com/encode/httpx) | ≥0.26.0 | BSD-3-Clause | https://github.com/encode/httpx |
| [requests](https://github.com/psf/requests) | ≥2.31.0 | Apache-2.0 | https://github.com/psf/requests |
| [pyyaml](https://github.com/yaml/pyyaml) | ≥6.0.0 | MIT | https://github.com/yaml/pyyaml |
| [databricks-sdk](https://github.com/databricks/databricks-sdk-py) | ≥0.81.0 | Apache-2.0 | https://github.com/databricks/databricks-sdk-py |
| [psycopg](https://github.com/psycopg/psycopg) | ≥3.1.0 | LGPL-3.0 | https://github.com/psycopg/psycopg |
| [psycopg2-binary](https://github.com/psycopg/psycopg2) | ≥2.9.0 | LGPL-3.0 | https://github.com/psycopg/psycopg2 |
| [PyMuPDF](https://github.com/pymupdf/PyMuPDF) | ≥1.25.0 | AGPL-3.0 | https://github.com/pymupdf/PyMuPDF |
| [react](https://github.com/facebook/react) | ≥19.2.0 | MIT | https://github.com/facebook/react |
| [react-dom](https://github.com/facebook/react) | ≥19.2.0 | MIT | https://github.com/facebook/react |
| [react-markdown](https://github.com/remarkjs/react-markdown) | ≥10.1.0 | MIT | https://github.com/remarkjs/react-markdown |
| [react-router-dom](https://github.com/remix-run/react-router) | ≥7.13.0 | MIT | https://github.com/remix-run/react-router |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | ≥4.1.18 | MIT | https://github.com/tailwindlabs/tailwindcss |
| [typescript](https://github.com/microsoft/TypeScript) | ~5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| [vite](https://github.com/vitejs/vite) | ≥7.2.4 | MIT | https://github.com/vitejs/vite |

</details>
