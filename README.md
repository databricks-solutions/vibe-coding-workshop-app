<div align="center">
  <h1>Vibe Coding Workshop</h1>
  <p>An AI-powered interactive workshop that guides you through building a complete data application on Databricks — from defining your intent to deploying a production-ready solution with embedded best practices.</p>
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
- **Guided Workflow** — 30+ steps covering Foundation, Databricks App, Lakebase, Lakehouse, Data Intelligence, Refinement, Agent Skills, and Workspace Clean Up
- **Real-Time Streaming** — LLM responses rendered live with markdown formatting
- **Voice Input** — Describe your use case by speaking; speech-to-text captures your intent
- **Gamified Experience** — Progress tracking, leaderboard, and completion badges
- **Analytics Dashboard** — Read-only view of workshop usage metrics and session activity
- **One-Command Install** — Clone, run the installer, and you're live

---

## Quick Start

### Prerequisites

- **Node.js 18+** and **Python 3.9+**
- **Databricks CLI** (`brew install databricks` or `pip install databricks-sdk`)
- A **Databricks workspace** with Unity Catalog and Lakebase access (autoscaling mode is default and recommended)

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

1. Deploy infrastructure via Databricks Asset Bundle (Lakebase project + App)
2. Sync application source code and discover Lakebase endpoint
3. Configure permissions (Unity Catalog, Lakebase database roles, App access)
4. Create and seed Lakebase tables
5. Final forced app deploy — stop, redeploy, start, verify RUNNING

The installer prompts for Lakebase mode (autoscaling or provisioned). Autoscaling is the default; it uses a Lakebase project that scales to zero when idle and auto-discovers its endpoint during deploy.

---

## Project Structure

```
├── vibe2value                  # CLI entry point (bash wrapper)
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
| App stuck UNAVAILABLE | `./vibe2value deploy --full` (includes forced restart) |
| "App already exists" | Installer handles this automatically; if persistent: `databricks apps delete <name>` then retry |
| "Multiple profiles matched" | Set `profile` in `user-config.yaml` or re-run `./vibe2value install` |
| Lakebase connection error | `./scripts/setup-lakebase.sh --check-instance` then `./vibe2value deploy --tables` |
| Slow first query after idle | Lakebase autoscaling may need ~30s to wake from zero; the app retries automatically |
| "Endpoint not found" during deploy | Re-run `./vibe2value deploy --full` — endpoint discovery runs after Lakebase project is ready |

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
