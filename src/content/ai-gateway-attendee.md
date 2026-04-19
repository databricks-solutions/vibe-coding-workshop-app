# Claude Code + Databricks AI Gateway — User Setup

> **Estimated time:** ~5 minutes
>
> **Prerequisites:** Node.js installed (`node --version` to check)
>
> **Works on:** macOS, Linux, and Windows

---

## Step 1: Install Claude Code

Open your terminal (VS Code terminal works great):

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:

```bash
claude --version
```

---

## Step 2: Generate your personal access token

1. Go to your Databricks workspace: `<YOUR_WORKSPACE_URL>`
2. Click your profile icon (top right) → **Settings**
3. Go to **Developer** → **Access tokens**
4. Click **Generate new token**
5. Set a name (e.g., `claude-code-gateway`) and a lifetime (e.g., 7 days)
6. Click **Generate**
7. **Copy the token immediately** — it starts with `dapi...` and won't be shown again

---

## Step 3: Create the settings file

Create the Claude Code config directory and settings file:

**macOS / Linux:**

```bash
mkdir -p <PROJECT_DIR>/.claude
```

**Windows (PowerShell):**

```powershell
mkdir -Force "<PROJECT_DIR>\.claude"
```

Open the settings file in a text editor:

```bash
code <PROJECT_DIR>/.claude/settings.json
```

> **Windows note:** If `code` isn't available, create the file with Notepad: `notepad "<PROJECT_DIR>\.claude\settings.json"`.

Paste the following and replace the placeholders with your own values:

```json
{
    "env": {
        "ANTHROPIC_MODEL": "<YOUR_ENDPOINT_NAME>",
        "ANTHROPIC_BASE_URL": "https://<YOUR_AI_GATEWAY_HOST>/anthropic",
        "ANTHROPIC_AUTH_TOKEN": "<YOUR_DATABRICKS_PAT>",
        "ANTHROPIC_CUSTOM_HEADERS": "x-databricks-use-coding-agent-mode: true",
        "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
    },
    "permissions": {
        "allow": [
            "Bash(cat:*)",
            "Bash(cd:*)",
            "Bash(cp:*)",
            "Bash(echo:*)",
            "Bash(find:*)",
            "Bash(git branch:*)",
            "Bash(git diff:*)",
            "Bash(git log:*)",
            "Bash(git show:*)",
            "Bash(git status:*)",
            "Bash(git add:*)",
            "Bash(git commit:*)",
            "Bash(git checkout:*)",
            "Bash(grep:*)",
            "Bash(head:*)",
            "Bash(ls:*)",
            "Bash(mkdir:*)",
            "Bash(mv:*)",
            "Bash(pip install:*)",
            "Bash(pip list:*)",
            "Bash(python:*)",
            "Bash(pwd:*)",
            "Bash(rg:*)",
            "Bash(sort:*)",
            "Bash(tail:*)",
            "Bash(touch:*)",
            "Bash(wc:*)",
            "Bash(which:*)",
            "Bash(whoami:*)",
            "Bash(npm:*)",
            "Bash(node:*)",
            "Bash(databricks:*)",
            "Bash(mlflow:*)",
            "Bash(curl:*)",
            "Read",
            "Edit",
            "Write",
            "WebFetch(domain:*.databricks.com)",
            "WebFetch(domain:*.azuredatabricks.net)",
            "WebFetch(domain:*.github.com)",
            "WebFetch(domain:docs.python.org)"
        ],
        "deny": []
    },
    "hooks": {},
    "environment": {}
}
```

Save the file.

---

## Step 4: Set the onboarding bypass

Claude Code may prompt you to log in with an Anthropic account. To skip this, open `~/.claude.json` in any text editor:

```bash
code ~/.claude.json
```

> **Windows note:** The file is at `C:\Users\<your-username>\.claude.json`. If it doesn't exist, create it with: `notepad "$HOME\.claude.json"`.

If this file **already exists**, check that it contains `"hasCompletedOnboarding": true`. Don't replace the file — just verify this key is present.

If this file **is empty or doesn't exist**, paste:

```json
{
    "hasCompletedOnboarding": true
}
```

Save the file.

---

## Step 5: Test it

1. **Open VS Code**
   - Launch Visual Studio Code from your Applications / Start menu, or run `code` from a terminal.

2. **Open your project folder**
   - Go to **File** → **Open Folder**.
   - Navigate to `<PROJECT_DIR>` and click **Open**.

3. **Open a new terminal inside VS Code**
   - Go to **Terminal** → **New Terminal** (or use the shortcut: `` Ctrl+` `` on Windows/Linux, `` Cmd+` `` on macOS).

4. **Start Claude Code**

   ```bash
   claude
   ```

5. **Send a test message**
   - Type `"Hello, what model are you?"` and press Enter.
   - If it responds, you're connected through the Databricks AI Gateway. You're all set.

---

## Troubleshooting

**Claude Code asks me to log in with Anthropic.**
Check that `~/.claude.json` contains `"hasCompletedOnboarding": true`.

**I get a 403 error.**
A workspace admin needs to add you (or a group you belong to) with **CAN_QUERY** permission on the AI Gateway endpoint.

**I get a 401 error.**
Check that your settings file uses `ANTHROPIC_AUTH_TOKEN` (not `ANTHROPIC_API_KEY`). If your token expired, generate a new one from **Settings → Developer → Access tokens**.

**Auth conflict warning (both token and API key set).**
Run `claude /logout` to clear cached auth state, then restart `claude`.

**Invalid or malformed JSON error.**
Run this to find the exact syntax error:

```bash
python -m json.tool <PROJECT_DIR>/.claude/settings.json
```

On Windows:

```powershell
python -m json.tool "<PROJECT_DIR>\.claude\settings.json"
```
