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


def _section(bypass_llm: bool, **overrides):
    """Minimal section-content dict as get_section_input_content would return."""
    section = {
        "input": "Do the thing.",
        "input_template": "Do the thing.",
        "system_prompt": "You are a senior data engineer.",
        "how_to_apply": "Paste it.",
        "expected_output": "A thing exists.",
        "how_to_apply_images": [],
        "expected_output_images": [],
        "bypass_llm": bypass_llm,
        "coding_assistant_variant": "__default__",
        "step_kind": "instant_prompt",
        "step_config": {},
        "gate_label": "",
        "expert_answer": "",
        "expert_system_prompt": "",
    }
    section.update(overrides)
    return section


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


class StepKindTest(unittest.TestCase):
    """
    step_kind decides how a step is presented.

    Every seeded row defaults to 'instant_prompt', so the migration is inert until a
    step is deliberately upgraded.
    """

    def setUp(self):
        self._original = routes.get_section_input_content

    def tearDown(self):
        routes.get_section_input_content = self._original

    def _content(self, **overrides):
        routes.get_section_input_content = lambda *a, **k: _section(True, **overrides)
        return asyncio.run(
            routes.get_step_content_endpoint(section_tag="gold_layer_design")
        )

    def test_defaults_to_instant_prompt(self):
        self.assertEqual(self._content()["step_kind"], "instant_prompt")

    def test_legacy_rows_without_kind_still_resolve(self):
        """Databases that predate the migration have no step_kind column at all."""
        template = routes._section_row_to_template({"input_template": "x"})

        self.assertEqual(template["step_kind"], "instant_prompt")
        self.assertEqual(template["step_config"], {})

    def test_step_config_travels_to_the_client(self):
        config = {"widget": "freeform", "min_chars": 40}
        result = self._content(step_kind="decision", step_config=config, gate_label="Scope committed")

        self.assertEqual(result["step_kind"], "decision")
        self.assertEqual(result["step_config"], config)
        self.assertEqual(result["gate_label"], "Scope committed")

    def test_expert_answer_is_never_sent_with_content(self):
        """
        The whole value of commit-before-reveal is that the attendee cannot peek, so
        the answer must not ride along on the content response.
        """
        result = self._content(
            step_kind="decision",
            expert_answer="The grain is one row per booking per night.",
        )

        self.assertNotIn("expert_answer", result)
        self.assertNotIn("expert_system_prompt", result)
        serialized = str(result)
        self.assertNotIn("one row per booking per night", serialized)


class DecisionRevealTest(unittest.TestCase):
    """POST /step/{tag}/reveal trades a commitment for the expert answer."""

    def setUp(self):
        self._original = routes.get_section_input_content
        self._original_save = routes.save_step_decision
        self.saved = []
        routes.save_step_decision = lambda **kw: self.saved.append(kw) or True

    def tearDown(self):
        routes.get_section_input_content = self._original
        routes.save_step_decision = self._original_save

    def _reveal(self, decision, **overrides):
        routes.get_section_input_content = lambda *a, **k: _section(True, **overrides)
        request = routes.DecisionCommitRequest(
            session_id="sess-1", decision=decision
        )
        return asyncio.run(
            routes.reveal_step_expert_answer("gold_layer_design", request)
        )

    def test_reveals_static_expert_answer_after_commit(self):
        result = self._reveal(
            {"fact_grain": "one row per booking"},
            step_kind="decision",
            expert_answer="One row per booking per night.",
        )

        self.assertEqual(result["expert_answer"], "One row per booking per night.")
        self.assertEqual(result["source"], "static")
        self.assertEqual(result["committed"], {"fact_grain": "one row per booking"})

    def test_commitment_is_recorded_before_revealing(self):
        self._reveal(
            {"fact_grain": "one row per booking"},
            step_kind="decision",
            expert_answer="anything",
        )

        self.assertEqual(len(self.saved), 1)
        self.assertEqual(self.saved[0]["section_tag"], "gold_layer_design")
        self.assertEqual(self.saved[0]["decision"], {"fact_grain": "one row per booking"})

    def test_empty_decision_is_rejected(self):
        """No commitment, no reveal — otherwise the step is just a spoiler button."""
        with self.assertRaises(routes.HTTPException) as ctx:
            self._reveal({}, step_kind="decision", expert_answer="secret")

        self.assertEqual(ctx.exception.status_code, 400)

    def test_non_decision_step_is_rejected(self):
        with self.assertRaises(routes.HTTPException) as ctx:
            self._reveal({"x": 1}, step_kind="instant_prompt")

        self.assertEqual(ctx.exception.status_code, 400)

    def test_reveal_survives_a_failed_session_write(self):
        """Losing a session write must not strand the attendee mid-step."""
        def boom(**kw):
            raise RuntimeError("lakebase down")

        routes.save_step_decision = boom
        result = self._reveal(
            {"fact_grain": "g"}, step_kind="decision", expert_answer="still shown"
        )

        self.assertEqual(result["expert_answer"], "still shown")


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
