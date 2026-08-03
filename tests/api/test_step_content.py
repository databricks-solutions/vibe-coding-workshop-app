"""
API tests for instant step content delivery.

Most workshop steps are static: their text is templated server-side
(`bypass_llm=TRUE`), so there is nothing for an LLM to generate. Those must be
served in one plain response — no streaming, no spinner, no Generate click. Only
the handful of genuinely generative sections should require the streaming path.

These tests are the regression guard against the fake stream returning: if someone
reintroduces SSE for static content, `test_static_step_is_not_streamed` fails.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_step_content -v

Monkeypatches the module-level section accessor on `src.backend.api.routes`, so no
Databricks / Lakebase connectivity is needed.
"""

import asyncio
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402


def _section(bypass_llm: bool):
    """Minimal section-content dict as get_section_input_content would return."""
    return {
        "input": "Do the thing.",
        "input_template": "Do the thing.",
        "system_prompt": "You are a senior data engineer.",
        "how_to_apply": "Paste it.",
        "expected_output": "A thing exists.",
        "how_to_apply_images": [],
        "expected_output_images": [],
        "bypass_llm": bypass_llm,
        "coding_assistant_variant": "__default__",
    }


class StepContentEndpointTest(unittest.TestCase):
    """GET /step/{tag}/content resolves a step in a single response."""

    def setUp(self):
        self._original = routes.get_section_input_content

    def tearDown(self):
        routes.get_section_input_content = self._original

    def _call(self, bypass_llm: bool):
        routes.get_section_input_content = lambda *a, **k: _section(bypass_llm)
        return asyncio.run(
            routes.get_step_content_endpoint(
                section_tag="gold_layer_design",
                industry="sample",
                use_case="booking",
            )
        )

    def test_static_step_returns_content_immediately(self):
        result = self._call(bypass_llm=True)

        self.assertTrue(result["is_static"])
        self.assertEqual(result["source"], "static")
        # The attendee gets usable text from this one call — nothing further to await.
        self.assertIn("Do the thing.", result["content"])
        self.assertIn("You are a senior data engineer.", result["content"])

    def test_static_content_preserves_legacy_wording(self):
        """
        Attendees copy this text into their coding assistant, so the rendered shape
        must stay byte-identical to what the old streaming bypass branch produced.
        """
        result = self._call(bypass_llm=True)

        expected = (
            "## Context\n\n"
            "You are a senior data engineer.\n\n"
            "---\n\n"
            "Do the thing."
        )
        self.assertEqual(result["content"], expected)

    def test_generative_step_defers_to_stream(self):
        result = self._call(bypass_llm=False)

        self.assertFalse(result["is_static"])
        self.assertEqual(result["source"], "llm_required")
        # No content here: the caller must use the streaming endpoint, where a
        # spinner is honest because a model really is running.
        self.assertEqual(result["content"], "")

    def test_metadata_travels_with_content(self):
        """One request must also prime the How to Apply / Verify tabs."""
        result = self._call(bypass_llm=True)

        self.assertEqual(result["how_to_apply"], "Paste it.")
        self.assertEqual(result["expected_output"], "A thing exists.")
        self.assertEqual(result["coding_assistant_variant"], "__default__")


class StaticContentBuilderTest(unittest.TestCase):
    """build_static_step_content is shared by the REST and MCP surfaces."""

    def test_missing_fields_degrade_quietly(self):
        # A section row with no system prompt should still render, not raise.
        content = routes.build_static_step_content({"input": "Only a task."})
        self.assertIn("Only a task.", content)
        self.assertIn("You are a helpful assistant.", content)


class StepNumberBoundsTest(unittest.TestCase):
    """
    Per-step writes must cover every step the workflow defines.

    A stale upper bound of 30 silently discarded state for Activation (32-37),
    Agents Accelerator (38-48) and MLflow (49-56).
    """

    def test_max_step_number_covers_all_defined_steps(self):
        from src.backend.services import lakebase

        self.assertGreaterEqual(lakebase.MAX_STEP_NUMBER, 56)

    def test_every_scored_step_is_writable(self):
        from src.backend.services import lakebase

        highest_scored = max(lakebase.STEP_SCORES)
        self.assertLessEqual(
            highest_scored,
            lakebase.MAX_STEP_NUMBER,
            "a step can earn points but cannot persist its state",
        )

    def test_final_steps_award_points(self):
        """Steps 55 and 56 previously scored zero because STEP_SCORES stopped at 54."""
        from src.backend.services import lakebase

        for step in (55, 56):
            self.assertGreater(lakebase.STEP_SCORES.get(step, 0), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
