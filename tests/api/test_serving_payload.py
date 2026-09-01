"""
Offline tests for the cross-model serving fix.

Covers two small, pure/mockable units added to make PRD/LLM calls work across
every Databricks-served chat model (Claude on normal workspaces, open-source
models on Free Edition) without breaking the existing flow:

  * `_extract_text` - normalizes serving-endpoint message/delta `content`.
    Plain chat models return a string (passes through unchanged); reasoning
    models (gpt-oss, qwen35) return a list of {type: reasoning|text} parts and
    only the `text` parts are user-facing.
  * `get_best_available_endpoint` - environment-aware primary/fallback selection
    (kill-switch via DATABRICKS_ENDPOINT_FALLBACK, default on).

No Databricks / Lakebase / httpx connectivity is required.

    USE_LAKEBASE=false python3 -m unittest tests.api.test_serving_payload -v
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402


class TestExtractText(unittest.TestCase):
    def test_string_passthrough_unchanged(self):
        # Existing flow (Claude / Llama / Gemma): string content is returned as-is.
        self.assertEqual(routes._extract_text("Hello world"), "Hello world")
        self.assertEqual(routes._extract_text(""), "")

    def test_none_becomes_empty_string(self):
        self.assertEqual(routes._extract_text(None), "")

    def test_reasoning_plus_text_list_extracts_text_only(self):
        content = [
            {"type": "reasoning", "summary": [{"type": "summary_text", "text": "thinking..."}]},
            {"type": "text", "text": "Hello!"},
        ]
        self.assertEqual(routes._extract_text(content), "Hello!")

    def test_reasoning_only_list_returns_empty(self):
        content = [
            {"type": "reasoning", "summary": [{"type": "summary_text", "text": "thinking..."}]},
        ]
        self.assertEqual(routes._extract_text(content), "")

    def test_multiple_text_parts_concatenated(self):
        content = [
            {"type": "text", "text": "Hello "},
            {"type": "reasoning", "summary": []},
            {"type": "text", "text": "there!"},
        ]
        self.assertEqual(routes._extract_text(content), "Hello there!")

    def test_non_dict_and_malformed_parts_tolerated(self):
        content = [1, "x", {"type": "text"}, {"type": "text", "text": 123}, {"type": "text", "text": "ok"}]
        self.assertEqual(routes._extract_text(content), "ok")


class TestBestAvailableEndpoint(unittest.TestCase):
    def _run(self, primary, available, env=None):
        env = env or {}
        with patch.object(routes, "SERVING_ENDPOINT_NAME", primary), \
             patch.object(routes, "get_available_serving_endpoints", return_value=available), \
             patch.dict(os.environ, env, clear=False):
            return routes.get_best_available_endpoint()

    def test_primary_present_returns_primary(self):
        # Normal Claude workspace: primary is deployed -> unchanged behavior.
        primary = "databricks-claude-sonnet-4-5"
        self.assertEqual(
            self._run(primary, [primary, "databricks-meta-llama-3-3-70b-instruct"]),
            primary,
        )

    def test_primary_absent_falls_back_in_list_order(self):
        # Free Edition: Claude not deployed -> first FALLBACK_ENDPOINTS entry present.
        available = [
            "databricks-gemma-3-12b",
            "databricks-meta-llama-3-3-70b-instruct",  # earlier in FALLBACK_ENDPOINTS
        ]
        self.assertEqual(
            self._run("databricks-claude-sonnet-4-5", available),
            "databricks-meta-llama-3-3-70b-instruct",
        )

    def test_no_known_fallback_uses_first_available(self):
        available = ["some-custom-endpoint", "another-endpoint"]
        self.assertEqual(
            self._run("databricks-claude-sonnet-4-5", available),
            "some-custom-endpoint",
        )

    def test_empty_available_returns_primary(self):
        # list() failed / empty -> return primary unchanged (no break).
        primary = "databricks-claude-sonnet-4-5"
        self.assertEqual(self._run(primary, []), primary)

    def test_kill_switch_returns_primary_even_if_absent(self):
        primary = "databricks-claude-sonnet-4-5"
        self.assertEqual(
            self._run(
                primary,
                ["databricks-meta-llama-3-3-70b-instruct"],
                env={"DATABRICKS_ENDPOINT_FALLBACK": "false"},
            ),
            primary,
        )


if __name__ == "__main__":
    unittest.main()
