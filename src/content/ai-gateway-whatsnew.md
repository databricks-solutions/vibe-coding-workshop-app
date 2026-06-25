# What's new in Unity AI Gateway

**Unity AI Gateway** (formerly *Mosaic AI Gateway*) is now part of Unity Catalog — the central, runtime governance layer for your entire AI estate: LLM endpoints, agents, MCP servers, and coding tools. The same permissions, auditing, and policy controls you use for data now apply to how agents access models and call tools.

> Unity AI Gateway and its newest capabilities are currently in **Beta**. Account admins enable it from the **Previews** page in the account console, then open **Unity AI Gateway** in the workspace left nav.

---

## LLM Guardrails

Customizable, **model-based** safety and compliance policies evaluated in real time on requests, responses, or both — a big step up from rigid pre-built filters.

- PII detection and redaction
- Content safety + topic filtering
- Prompt-injection and data-exfiltration detection
- Hallucination checks
- Fully custom guardrails built from your own prompt + model

Blocked, passed, and sanitized requests are all recorded so you can monitor and tune guardrail behavior over time.

## AI Spend Controls

Proactive cost governance across **users, workspaces, use cases, and entire accounts** — designed for AI-specific risks like runaway retry loops and uncontrolled agent experimentation.

- Budget **alerts** and hard **caps**, set globally or per-user
- Token-level cost attribution per request, user, and endpoint
- Real **DBU costs** (not just token counts), including external provider costs
- Backed by Databricks budgets + Unity Catalog system tables

## Observability & Payload Logging

Every model call and MCP interaction can be captured end-to-end. With inference tables enabled, logs land automatically in **Unity Catalog system tables** (`system.serving.endpoint_usage`, `system.serving.served_entities`) — a centralized, queryable record of all agent activity for auditing, debugging, and capacity planning.

> Tip: tag requests with a `usage_context` so finance, debugging, and capacity planning can slice usage by team and use case.

## MCP Governance & Service Policies

Model Context Protocol (MCP) servers can now be registered as **Unity Catalog objects**. Admins control who can call which MCP, and write **service policies** in SQL to constrain which tools an agent can invoke based on identity and request context — enforced on every service call, including on-behalf-of (OBO) execution.

---

## How this maps to this workshop

When you pick **VS Code + Unity AI Gateway**, your Claude Code CLI routes through a governed Unity AI Gateway endpoint instead of a direct Anthropic account. That means your workshop activity inherits the same governance described above: governed model access, usage tracking in Unity Catalog, and (where your admin has enabled them) guardrails and spend controls.

See the **User setup** and **Admin setup** tabs to get connected.

*Sources: Databricks Blog — "What's new in Unity AI Gateway", "Unity AI Gateway Guardrails", "AI spend controls with Unity AI Gateway"; Databricks docs — Unity AI Gateway.*
