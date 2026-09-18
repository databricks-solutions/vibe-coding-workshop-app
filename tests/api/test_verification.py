"""
API tests for step verification via workspace artifact checks.

Covers the verification gate registry which confirms that a step's required
workspace artifact actually exists, rather than relying on self-attestation.

The registry implements:
  - Eight check keys (app_running, lakebase_project_exists, uc_catalog_active, etc)
  - Three outcome states: pass, fail, unknown (unknown on permission denied, timeout, SDK unavailable)
  - 60s TTL result cache keyed (session_id, section_tag)
  - ~8s per-check timeout, ~15s per step
  - Kill switch via VERIFY_GATES_ENABLED env var
  - App Service Principal auth only (no OBO)

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_verification -v

Monkeypatches the module-level workspace client getter and section accessor on
`src.backend.api.routes`, so no Databricks / Lakebase connectivity is needed.
"""

import asyncio
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402
from src.backend.services import verification  # noqa: E402

# Counter for unique test session IDs
_test_id_counter = 0


def _mock_section(check_key: str = "", **overrides):
    """Minimal section-content dict as get_section_input_content would return."""
    section = {
        "input": "Do the thing.",
        "input_template": "Do the thing.",
        "system_prompt": "You are a senior data engineer.",
        "how_to_apply": "Paste it.",
        "expected_output": "A thing exists.",
        "how_to_apply_images": [],
        "expected_output_images": [],
        "bypass_llm": False,
        "coding_assistant_variant": "__default__",
        "step_kind": "verify" if check_key else "instant_prompt",
        "step_config": {"check": check_key} if check_key else {},
        "gate_label": "",
        "expert_answer": "",
        "expert_system_prompt": "",
    }
    section.update(overrides)
    return section


class VerificationEndpointTest(unittest.TestCase):
    """POST /step/{section_tag}/verify returns tri-state verification result."""

    def setUp(self):
        global _test_id_counter
        self._original_section = routes.get_section_input_content
        self._original_client = routes.get_workspace_client
        self._original_params = routes.get_effective_workshop_parameters
        verification._verification_cache.clear()
        # Each test should use a unique session ID to avoid cache collisions
        _test_id_counter += 1
        self.test_session_id = f"test-session-{_test_id_counter}"

    def tearDown(self):
        # Restore original functions (not strictly necessary but good practice)
        if hasattr(self, '_original_section'):
            routes.get_section_input_content = self._original_section
        if hasattr(self, '_original_client'):
            routes.get_workspace_client = self._original_client
        if hasattr(self, '_original_params'):
            routes.get_effective_workshop_parameters = self._original_params
        verification._verification_cache.clear()

    def _call_verify(self, section_tag: str = "deploy_databricks_app", force: bool = False):
        """Call the verify endpoint via asyncio."""
        return asyncio.run(
            routes.verify_step_endpoint(
                section_tag=section_tag,
                request=routes.VerifyStepRequest(
                    session_id=self.test_session_id, force=force
                ),
            )
        )

    def test_no_check_configured_returns_unknown_agent_reported(self):
        """Step with no check key returns status=unknown, method=agent_reported."""
        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="")
        result = self._call_verify(section_tag="prd_generation")

        self.assertEqual(result.status, "unknown")
        self.assertEqual(result.method, "agent_reported")
        self.assertEqual(len(result.checks), 0)

    def test_app_running_pass_when_running_and_active(self):
        """Check passes when app is RUNNING and compute is ACTIVE."""
        mock_client = Mock()
        mock_app = Mock()
        mock_app.app_status.state = "RUNNING"
        mock_app.compute_status.state = "ACTIVE"
        mock_client.apps.get.return_value = mock_app

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "pass")
        self.assertEqual(result.method, "workspace")
        self.assertEqual(len(result.checks), 1)
        self.assertTrue(result.checks[0].ok)
        mock_client.apps.get.assert_called_once_with(name="test-app")

    def test_app_running_fail_when_stopped(self):
        """Check fails with actionable hint when app is STOPPED."""
        mock_client = Mock()
        mock_app = Mock()
        mock_app.app_status.state = "STOPPED"
        mock_app.compute_status.state = "IDLE"
        mock_client.apps.get.return_value = mock_app

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "fail")
        self.assertFalse(result.checks[0].ok)
        self.assertIn("STOPPED", result.checks[0].detail)
        self.assertIn("Apps page", result.checks[0].detail)

    def test_app_running_unknown_on_permission_denied(self):
        """Check returns unknown (ok=None) on PermissionDenied exception."""
        mock_client = Mock()
        from databricks.sdk.errors import PermissionDenied
        mock_client.apps.get.side_effect = PermissionDenied("User does not have access")

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "unknown")
        self.assertIsNone(result.checks[0].ok)
        self.assertIn("Permission", result.checks[0].detail)

    def test_app_running_fail_with_hint_when_not_found(self):
        """Check fails with actionable hint when app does not exist."""
        mock_client = Mock()
        from databricks.sdk.errors import NotFound
        mock_client.apps.get.side_effect = NotFound("App not found")

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "fail")
        self.assertFalse(result.checks[0].ok)
        self.assertIn("does not exist", result.checks[0].detail)
        self.assertIn("deploy", result.checks[0].detail)

    def test_app_running_unknown_on_missing_param(self):
        """Check returns unknown when required parameter is missing."""
        mock_client = Mock()
        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {}  # No user_app_name

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "unknown")
        self.assertIsNone(result.checks[0].ok)
        self.assertIn("user_app_name", result.checks[0].detail)

    def test_cache_hit_avoids_second_sdk_call(self):
        """Second verify call within TTL uses cached result, no SDK call."""
        mock_client = Mock()
        mock_app = Mock()
        mock_app.app_status.state = "RUNNING"
        mock_app.compute_status.state = "ACTIVE"
        mock_client.apps.get.return_value = mock_app

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        # First call
        result1 = self._call_verify()
        self.assertTrue(result1.checks[0].ok)
        call_count_1 = mock_client.apps.get.call_count

        # Second call (should hit cache)
        result2 = self._call_verify()
        call_count_2 = mock_client.apps.get.call_count

        self.assertEqual(result1, result2)
        self.assertEqual(call_count_1, call_count_2)  # No additional call

    def test_force_true_bypasses_cache(self):
        """force=true bypasses cache and makes a fresh SDK call."""
        mock_client = Mock()
        mock_app = Mock()
        mock_app.app_status.state = "RUNNING"
        mock_app.compute_status.state = "ACTIVE"
        mock_client.apps.get.return_value = mock_app

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {"user_app_name": "test-app"}

        # First call
        result1 = self._call_verify(force=False)
        call_count_1 = mock_client.apps.get.call_count

        # Second call with force=true
        result2 = self._call_verify(force=True)
        call_count_2 = mock_client.apps.get.call_count

        self.assertEqual(call_count_1, 1)
        self.assertEqual(call_count_2, 2)  # Forced a new call

    def test_kill_switch_returns_unknown(self):
        """VERIFY_GATES_ENABLED=false returns unknown for all checks."""
        with patch.dict(os.environ, {"VERIFY_GATES_ENABLED": "false"}):
            # Reload module to pick up env var
            import importlib
            importlib.reload(verification)

            mock_client = Mock()
            routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
            routes.get_workspace_client = lambda: mock_client

            result = self._call_verify(force=True)

            self.assertEqual(result.status, "unknown")
            self.assertIn("disabled", result.hint.lower())

            # Restore
            importlib.reload(verification)

    def test_bronze_tables_exist_pass_when_tables_present(self):
        """bronze_tables_exist check passes when tables found."""
        mock_client = Mock()
        mock_table1 = Mock()
        mock_table1.name = "table1"
        mock_client.tables.list.return_value = iter([mock_table1])

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="bronze_tables_exist")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {
            "lakehouse_default_catalog": "main",
            "user_schema_prefix": "user",
        }

        result = self._call_verify(section_tag="bronze_layer_creation", force=True)

        self.assertEqual(result.status, "pass")
        self.assertTrue(result.checks[0].ok)


    def test_no_client_returns_unknown(self):
        """When WorkspaceClient unavailable, returns status=unknown."""
        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="app_running")
        routes.get_workspace_client = lambda: None  # SDK not available

        result = self._call_verify(force=True)

        self.assertEqual(result.status, "unknown")
        self.assertIn("unavailable", result.hint.lower())


    def test_genie_space_exists_fail_when_not_found(self):
        """genie_space_exists check fails when no space matches."""
        mock_client = Mock()
        mock_client.genie.list_spaces.return_value = iter([])

        routes.get_section_input_content = lambda *a, **k: _mock_section(check_key="genie_space_exists")
        routes.get_workspace_client = lambda: mock_client
        routes.get_effective_workshop_parameters = lambda *a, **k: {
            "user_schema_prefix": "user",
        }

        result = self._call_verify(section_tag="genie_space", force=True)

        self.assertEqual(result.status, "fail")
        self.assertFalse(result.checks[0].ok)
        # Checks for "no" and "found" since the detail is "no genie space found"
        self.assertIn("found", result.checks[0].detail.lower())


class VerificationCheckTimeoutTest(unittest.TestCase):
    """Verify that per-check timeout protection works."""

    def setUp(self):
        verification._verification_cache.clear()

    def tearDown(self):
        verification._verification_cache.clear()

    def test_check_timeout_returns_unknown(self):
        """Check that times out returns ok=None (unknown)."""

        async def slow_check(client, params):
            await asyncio.sleep(verification.CHECK_TIMEOUT_S + 1)
            return {"name": "slow", "ok": True, "detail": "should not return"}

        # Monkeypatch the registry temporarily
        original_registry = verification._CHECK_REGISTRY.copy()
        verification._CHECK_REGISTRY["slow_check"] = slow_check

        try:
            result = asyncio.run(
                verification.verify_step(
                    workspace_client=Mock(),
                    session_id="test-session",
                    section_tag="test",
                    check_key="slow_check",
                    params={},
                    force=True,
                )
            )

            self.assertIsNone(result.get("ok"))  # This is a dict from verify_step, not a model
            self.assertIn("timed out", result.get("detail", "").lower())
        finally:
            verification._CHECK_REGISTRY = original_registry


class RealSdkEnumTest(unittest.TestCase):
    """
    Checks must work against the types the SDK actually returns.

    The SDK hands back str-valued Enums and dataclasses, and `ApplicationState.RUNNING
    == "RUNNING"` is False. Mocks built from plain strings hide that entirely, so these
    tests deliberately use the real SDK types: a healthy workspace must read as pass,
    and an unhealthy one must not.
    """

    def test_running_app_passes_with_real_enums(self):
        from databricks.sdk.service.apps import ApplicationState, ComputeState

        client = Mock()
        app = Mock()
        app.app_status = Mock(state=ApplicationState.RUNNING)
        app.compute_status = Mock(state=ComputeState.ACTIVE)
        client.apps.get.return_value = app

        result = asyncio.run(
            verification._check_app_running(client, {"user_app_name": "jane-d-booking"})
        )

        self.assertTrue(result["ok"], f"a RUNNING app must pass, got: {result}")

    def test_stopped_app_fails_with_real_enums(self):
        from databricks.sdk.service.apps import ApplicationState, ComputeState

        client = Mock()
        app = Mock()
        # ApplicationState has no STOPPED member; a halted app reports UNAVAILABLE
        # with STOPPED compute.
        app.app_status = Mock(state=ApplicationState.UNAVAILABLE)
        app.compute_status = Mock(state=ComputeState.STOPPED)
        client.apps.get.return_value = app

        result = asyncio.run(
            verification._check_app_running(client, {"user_app_name": "jane-d-booking"})
        )

        self.assertFalse(result["ok"])
        # The hint has to name the real state, not an enum repr.
        self.assertIn("UNAVAILABLE", result["detail"])
        self.assertIn("STOPPED", result["detail"])

    def test_not_ready_endpoint_fails(self):
        """EndpointStateReady.NOT_READY is truthy, so truthiness alone is not enough."""
        from databricks.sdk.service.serving import EndpointStateReady

        client = Mock()
        client.serving_endpoints.get.return_value = Mock(
            state=Mock(ready=EndpointStateReady.NOT_READY)
        )

        result = asyncio.run(
            verification._check_serving_endpoint_ready(
                client, {"agent_serving_endpoint_name": "agent-ep"}
            )
        )

        self.assertFalse(result["ok"], "a NOT_READY endpoint must not pass")

    def test_ready_endpoint_passes(self):
        from databricks.sdk.service.serving import EndpointStateReady

        client = Mock()
        client.serving_endpoints.get.return_value = Mock(
            state=Mock(ready=EndpointStateReady.READY)
        )

        result = asyncio.run(
            verification._check_serving_endpoint_ready(
                client, {"agent_serving_endpoint_name": "agent-ep"}
            )
        )

        self.assertTrue(result["ok"])

    def test_job_run_verdict_reads_result_state(self):
        """
        `run.state` is a RunState dataclass, so comparing it to a string never matches
        and a successful pipeline would read as failed.
        """
        from databricks.sdk.service.jobs import RunState, RunResultState, RunLifeCycleState

        succeeded = Mock(state=RunState(
            life_cycle_state=RunLifeCycleState.TERMINATED,
            result_state=RunResultState.SUCCESS,
        ))
        failed = Mock(state=RunState(
            life_cycle_state=RunLifeCycleState.TERMINATED,
            result_state=RunResultState.FAILED,
        ))
        running = Mock(state=RunState(life_cycle_state=RunLifeCycleState.RUNNING))

        self.assertTrue(verification._run_succeeded(succeeded))
        self.assertFalse(verification._run_succeeded(failed))
        self.assertFalse(verification._run_succeeded(running))
        self.assertEqual(verification._run_state_name(failed), "FAILED")

    def test_state_helper_accepts_enum_or_string(self):
        """Plain strings must keep working so existing mocks stay valid."""
        from databricks.sdk.service.apps import ApplicationState

        self.assertTrue(verification._state_is(ApplicationState.RUNNING, "RUNNING"))
        self.assertTrue(verification._state_is("RUNNING", "RUNNING"))
        self.assertTrue(verification._state_is("running", "RUNNING"))
        self.assertFalse(verification._state_is(None, "RUNNING"))
        self.assertFalse(verification._state_is(ApplicationState.CRASHED, "RUNNING"))


if __name__ == "__main__":
    unittest.main()
