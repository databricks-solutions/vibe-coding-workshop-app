# Vibe Coding Workshop

An AI-powered interactive workshop that guides you through building a complete data application on Databricks — from defining your intent to deploying a production-ready solution with embedded best practices.

<table>
<tr>
<td width="60%">
<img src="docs/images/workshop-overview.gif" alt="Workshop Overview" width="100%" />
</td>
<td width="40%" align="center">
<a href="https://www.youtube.com/watch?v=MUa5kbIV1Lc">
<img src="https://img.youtube.com/vi/MUa5kbIV1Lc/maxresdefault.jpg" alt="Workshop Walkthrough" width="100%" />
</a>
<br />
<a href="https://www.youtube.com/watch?v=MUa5kbIV1Lc">
<img src="https://img.shields.io/badge/▶_Watch_Walkthrough-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch on YouTube" />
</a>
</td>
</tr>
</table>

---

## What It Does

- **AI-Generated Prompts** — Customized, copy-ready prompts for every development step, tailored to your industry and use case
- **Guided Workflow** — 20+ steps covering Foundation, Databricks App, Lakebase, Lakehouse, Data Intelligence, Refinement, and Agent Skills
- **Real-Time Streaming** — LLM responses rendered live with markdown formatting
- **Gamified Experience** — Progress tracking, leaderboard, and completion badges
- **One-Command Install** — Clone, run the installer, and you're live

---

## Quick Start

### Prerequisites

- **Node.js 18+** and **Python 3.9+**
- **Databricks CLI** (`brew install databricks` or `pip install databricks-sdk`)
- A **Databricks workspace** with Unity Catalog and Lakebase access

### Install

```bash
git clone https://github.com/databricks-solutions/vibe-coding-workshop-template.git
cd vibe-coding-workshop-template
./vibe2value install
```

The installer walks you through everything interactively — workspace URL, authentication, resource naming, build, deploy, and verification. When it finishes, you'll have a live app URL.

### Commands

| Command | Description |
|---------|-------------|
| `./vibe2value install` | First-time interactive setup and deploy |
| `./vibe2value deploy` | Push code changes (build + sync + deploy) |
| `./vibe2value deploy --full` | Full infrastructure redeploy |
| `./vibe2value deploy --tables` | Reseed database tables only |
| `./vibe2value deploy --watch` | Continuous file sync for development |
| `./vibe2value doctor` | Validate prerequisites, config, and auth |
| `./vibe2value configure` | Regenerate config files from templates |
| `./vibe2value uninstall` | Tear down all provisioned resources |

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

A full deploy (`./vibe2value deploy --full`) runs these steps:

1. Deploy infrastructure via Databricks Asset Bundle (Lakebase instance + App)
2. Sync application source code
3. Configure permissions (Unity Catalog, Lakebase roles, App resource link)
4. Create and seed Lakebase tables
5. Final forced app deploy — stop, redeploy, start, verify RUNNING

---

## Project Structure

```
├── vibe2value                  # CLI entry point
├── app.py                      # FastAPI backend entry point
├── app.yaml.template           # App config template
├── databricks.yml.template     # Asset Bundle template
├── user-config.yaml.example    # Example user configuration
│
├── scripts/
│   ├── vibe2value.py           # CLI logic (install, deploy, doctor, uninstall)
│   ├── deploy.sh               # Deployment orchestration
│   ├── setup-lakebase.sh       # Lakebase table management
│   └── lakebase_manager.py     # Lakebase/app management helpers
│
├── db/lakebase/                # DDL and seed data for Lakebase tables
│
├── src/
│   ├── App.tsx                 # Main React component
│   ├── api/client.ts           # Frontend API client
│   ├── components/             # React UI components
│   └── backend/
│       ├── api/routes.py       # FastAPI routes
│       └── services/lakebase.py
│
└── docs/                       # Design documentation
```

---

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: FastAPI (Python)
- **LLM**: Databricks Model Serving
- **Database**: Lakebase (PostgreSQL) with Unity Catalog
- **Infrastructure**: Databricks Asset Bundles
- **Deployment**: Databricks Apps

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Authentication failure | `databricks auth login --host <url>` then `./vibe2value doctor` |
| App stuck UNAVAILABLE | `./vibe2value deploy --full` (includes forced restart) |
| "App already exists" | Installer handles this automatically; if persistent: `databricks apps delete <name>` then retry |
| "Multiple profiles matched" | Set `profile` in `user-config.yaml` or re-run `./vibe2value install` |
| Lakebase connection error | `./scripts/setup-lakebase.sh --check-instance` then `./vibe2value deploy --tables` |

---

## Local Development

```bash
# Frontend
npm install && npm run dev

# Backend
pip install -r requirements.txt && python app.py
```

Deploy changes: `./vibe2value deploy`

---

## License

Internal use — Databricks Field Engineering
