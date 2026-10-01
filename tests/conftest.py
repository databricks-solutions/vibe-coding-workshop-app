"""Offline test bootstrap for the whole ``tests/`` tree.

The offline suites (``tests/workshop`` + ``tests/api``) never touch a live
Databricks workspace or Lakebase. But importing ``src.backend.services.lakebase``
triggers a Databricks SDK default-auth resolution, which — with real credentials
on the machine — spends ~minutes probing auth methods before falling back. The
diagnosed fix (T5 R4b): neutralise SDK auth and Lakebase config BEFORE any test
module imports the backend, so the default ``pytest`` invocation is ~4s, not ~295s.

This runs at conftest import (pytest loads the rootdir conftest first, ahead of
every test module), so it is in effect before ``lakebase`` is first imported.
Equivalent to the gate's ``env -u LAKEBASE_HOST -u DATABRICKS_AUTH_TYPE
DATABRICKS_CONFIG_FILE=/dev/null`` wrapper, now baked in.
"""

import os

# Point the SDK at an empty config so default-auth resolution fails fast instead
# of probing every method against real local credentials.
os.environ["DATABRICKS_CONFIG_FILE"] = os.devnull
# Force the offline (in-memory) Lakebase path and skip auth-type probing.
for _var in ("LAKEBASE_HOST", "DATABRICKS_AUTH_TYPE"):
    os.environ.pop(_var, None)
