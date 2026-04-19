# AI Gateway + Claude Code — Admin Setup

> **Who does this:** A workspace admin, once, before users start connecting.
>
> **Estimated time:** ~15 minutes
>
> **Prerequisites:** Databricks workspace with Unity Catalog enabled and AI Gateway (Beta) preview enabled.

---

## Step 1: Create the AI Gateway endpoint

1. Log in to your Databricks workspace: `<YOUR_WORKSPACE_URL>`
2. In the left sidebar, click **Compute** → **AI Gateway**.
3. Click **Integrate coding agents** (or go to **Settings** → **Developer** → **Coding agents**).
4. Select the **Other Integrations** tab, then choose **Claude Code** from the dropdown.

---

## Step 2: Select the models

Configure **Opus as primary** with **Sonnet as fallback**. If Opus is unavailable or rate-limited, requests automatically fall back to Sonnet. Set your endpoint name to `<YOUR_ENDPOINT_NAME>` — this acts as a model-agnostic alias that Claude Code sends as the model name, and the gateway routes to Opus/Sonnet as configured.

---

## Step 3: Grant permissions to users

1. Go to **AI Gateway** → click on your endpoint.
2. Click the **Permissions** button (top right).
3. In the **Add User** field, search for a group that includes all users you want to grant access to (e.g., `users` or a custom group).
4. Set the permission to **CAN_QUERY**.
5. Click **+ Add**, then **Save**.

Without this, users will get a 403 when they try to use the endpoint.

---

## Step 4: Set rate limits

Configure rate limits on the endpoint to control spend. Recommended starting values:

- **Endpoint:** 500 QPM (queries per minute)
- **Per user:** 60 QPM

Adjust based on your expected user count and usage patterns.

---

## Step 5: Share the user setup details

Before sharing the user setup guide, confirm the values users will need to plug in:

- Workspace URL: `<YOUR_WORKSPACE_URL>`
- AI Gateway host: `<YOUR_AI_GATEWAY_HOST>`
- Endpoint name: `<YOUR_ENDPOINT_NAME>`

Share these along with the user setup guide (available in the workflow UI under the **VS Code + Databricks AI Gateway** coding assistant card).

---

## How it fits together

```
Claude Code (user's terminal)
    │
    └── ANTHROPIC_AUTH_TOKEN + ANTHROPIC_MODEL (endpoint name)
            │
            ▼
        AI Gateway ("<YOUR_ENDPOINT_NAME>")
            │
            ├── Routes to configured models (e.g., Opus → Sonnet fallback)
            ├── system.ai_gateway.usage (per-user token/cost tracking)
            └── Inference table (full request/response payloads, if enabled)
```

---

## Optional add-ons

These can be layered on later without changing the core setup:

**OpenTelemetry metrics.** Add OTEL env vars to `settings.json` to export session-level metrics (token counts, durations) to a Unity Catalog Delta table.

**MLflow tracing.** Add a Stop hook to capture full conversation traces in MLflow Experiments. Requires `pip install "mlflow[databricks]>=3.4"` and uses `mlflow.claude_code.hooks.stop_hook_handler()`.

**Per-user rate limits.** Tighten per-user quotas on the AI Gateway to prevent runaway usage.

See the [Databricks tracing docs](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/integrations/claude-code) for detailed setup instructions on these add-ons.
