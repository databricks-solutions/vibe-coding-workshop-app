# Claude Code + Unity AI Gateway — User Setup

> **The recommended way is `ucode`** — one command installs, logs you in, and configures Claude Code. No personal access token to manage.
>
> Just follow the three steps below. If `ucode` won't run on your machine, open the **Manual setup** fallback at the bottom.
>
> **Works on:** macOS, Linux, and Windows.

---

## Recommended: set up Claude Code with `ucode`

`ucode` (Unity AI Gateway Coding CLI) is a small launcher from Databricks. It configures and runs Claude Code against your workspace's Unity AI Gateway, using your workspace login — **no API key or PAT required**.

> **Prerequisites:** Python 3.12+ (install via [`uv`](https://docs.astral.sh/uv/getting-started/installation/)). `npm` is used to auto-install the Claude Code CLI if needed.

### Step 1 of 3 — Install ucode

```bash
uv tool install git+https://github.com/databricks/ucode
```

### Step 2 of 3 — Launch Claude Code

```bash
ucode claude
```

On first launch, `ucode` asks for your workspace URL (`<YOUR_WORKSPACE_URL>`), logs you in, and writes the config for you. After that, `ucode claude` opens Claude Code directly.

```bash
ucode claude -r        # resume your last session
```

### Step 3 of 3 (optional) — Add Databricks MCP servers

```bash
ucode configure mcp
```

Adds Databricks MCP servers (Vector Search, UC Functions, Databricks SQL, and any discovered external connections) to Claude Code.

---

## Handy ucode commands

| Command | What it does |
|---------|--------------|
| `ucode status` | Show your workspace, base URLs, config files, and selected models |
| `ucode usage` | Show your Unity AI Gateway usage summary |
| `ucode revert` | Clear saved state and restore backed-up config files |

> `ucode` can also drive other agents if you prefer: `ucode codex`, `ucode gemini`, `ucode opencode`, `ucode copilot`, `ucode pi`.

---

## Troubleshooting

**`ucode: command not found`.**
Put the `uv` tools bin directory on your `PATH` (run `uv tool update-shell`, then open a new terminal). Confirm Python 3.12+ with `python3 --version`.

**Login or auth issues.**
Re-run the login and relaunch: `databricks auth login --host <YOUR_WORKSPACE_URL>`, then `ucode claude`. Run `ucode status` to confirm the active workspace.

> **Still stuck?** Open the **Manual setup (PAT + settings.json)** fallback below.
