# Legacy install scripts

Scripts here are **not part of the canonical install path** any more.

The May 2026 Apps + Lakebase release moved every imperative step that used
to live in `post_deploy.py` into the bundle / app runtime:

| Step                            | New owner                                              |
| ------------------------------- | ------------------------------------------------------ |
| App SP postgres role + CONNECT  | `apps.<name>.resources[].database` binding (DAB)       |
| `users` group `DATABRICKS_SUPERUSER` | Removed (attendees go through the app SP)         |
| Lakebase host resolution        | Platform-injected `PGHOST` from the resource binding   |
| OAuth token rotation            | `client.postgres.generate_database_credential()`       |
| DDL + seed migrations           | `app.py` lifespan -> `src/backend/migrations.py`       |
| Wait for app RUNNING            | Operator polls `databricks apps get <name>` if needed  |
| Git-source code push            | Bundle deploy (auto-pulls from `git_repository`)       |

A fresh `databricks bundle deploy -p <profile>` is now the entire install.

## When to use these legacy scripts

* Forks running CLIs older than the May 2026 release that lack the
  `apps.<name>.resources[].database` field on the bundle schema.
* Custom migration policies (e.g. you want to apply DDL before the app
  starts, or need to run migrations from a CI runner instead of the app
  process).
* Recovery: a partially-applied install that needs a manual reconcile.

## How to invoke

```bash
python scripts/legacy/post_deploy.py \
  --app-name vibe-coding-workshop-app \
  --project vibe-coding-workshop-lakebase \
  --branch main \
  --schema vibe_coding_workshop \
  --database databricks_postgres \
  [--profile <profile>]
```

The script imports its sibling `_migrations.py` for the per-file ledger
implementation; both files must stay together in this folder.
