"""
Guards that Lakebase configuration never makes a blocking network call.

The bug this exists for: `_get_config()` resolved the Postgres username from the
Databricks SDK whenever PGUSER/LAKEBASE_USER/DATABRICKS_CLIENT_ID were all unset — and
constructing a WorkspaceClient performs a live SSL handshake against the workspace OIDC
endpoint. `is_lakebase_configured()` calls `_get_config()`, and the hackathon router calls
`is_lakebase_configured()` on nearly every request.

The effect: with USE_LAKEBASE=false and no LAKEBASE_HOST, the whole hackathon test suite
hung with no output at all (34 API tests never reported; 7 of 8 e2e tests timed out at
30s each). It looked like a broken test suite; it was one blocking call in a config
helper, reached only when there was no Lakebase to connect to in the first place.

The guard: when no host and database are configured, the resolved user is unused anyway,
because is_lakebase_configured() returns False regardless. So skip the lookup entirely.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_lakebase_config -v
"""

import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase  # noqa: E402


class NoNetworkOnUnconfiguredLakebaseTest(unittest.TestCase):
    """Config resolution must be pure when there is nothing to connect to."""

    ENV_KEYS = (
        "LAKEBASE_HOST", "LAKEBASE_DATABASE", "LAKEBASE_USER",
        "PGHOST", "PGDATABASE", "PGUSER", "DATABRICKS_CLIENT_ID",
    )

    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in self.ENV_KEYS}
        for k in self.ENV_KEYS:
            os.environ.pop(k, None)

        # Any attempt to build a WorkspaceClient is a network call in disguise.
        self._orig_client = lakebase._get_workspace_client
        self.client_calls = 0

        def _tripwire():
            self.client_calls += 1
            raise AssertionError(
                "_get_config() built a WorkspaceClient with no Lakebase configured — "
                "that is a blocking SSL call and it hangs the test suite"
            )

        lakebase._get_workspace_client = _tripwire

    def tearDown(self):
        lakebase._get_workspace_client = self._orig_client
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_get_config_makes_no_network_call_when_unconfigured(self):
        config = lakebase._get_config()

        self.assertEqual(self.client_calls, 0)
        self.assertEqual(config["host"], "")
        self.assertEqual(config["user"], "")

    def test_is_lakebase_configured_is_false_and_silent(self):
        self.assertFalse(lakebase.is_lakebase_configured())
        self.assertEqual(self.client_calls, 0)

    def test_repeated_checks_stay_cheap(self):
        """
        The hackathon router calls this on nearly every request, so one blocking call per
        check is what turned a fast suite into a hanging one.
        """
        for _ in range(50):
            lakebase.is_lakebase_configured()

        self.assertEqual(self.client_calls, 0)

    def test_identity_lookup_still_happens_when_a_host_is_configured(self):
        """
        The lookup is not dead code — a real deployment with a host but no injected
        client id still needs it. Guards against "fixing" the hang by deleting it.
        """
        os.environ["LAKEBASE_HOST"] = "ep-example.database.cloud.databricks.com"
        os.environ["LAKEBASE_DATABASE"] = "databricks_postgres"

        # The tripwire raises, which _get_config catches and logs; what matters is that it
        # was reached at all.
        lakebase._get_config()

        self.assertEqual(
            self.client_calls, 1,
            "with a host configured, identity resolution must still be attempted",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
