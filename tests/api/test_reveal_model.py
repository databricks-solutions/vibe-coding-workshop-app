"""
API tests for the fast reveal path.

The commit-before-reveal panel exists to tell an attendee quickly whether they are
thinking along the right lines, so it runs on a small, fast model rather than the
workshop's general-purpose endpoint. Three things about that are easy to get wrong
and are guarded here:

  1. **The model must be configurable.** Serving endpoint availability is region- and
     rollout-gated (several documented Gemini endpoints 404 on eu-central-1), so a
     facilitator has to be able to change it live, with no deploy.

  2. **The fallback chain must survive an ABSENT endpoint, not just a slow one.** A
     missing endpoint 404s, and the general-purpose endpoint must always be last so a
     misconfigured chain degrades to a slower answer rather than no answer.

  3. **Gemini returns structured content.** `choices[0].message.content` is a plain
     string on Claude but `[{"type":"text","text":...}]` on Gemini. Code that treats
     it as a string yields an EMPTY reveal — request succeeds, tokens billed, blank
     panel. That is why text_from_content exists.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_reveal_model -v
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

from src.backend.api import routes  # noqa: E402
from src.backend.services.llm_content import text_from_content  # noqa: E402


class RevealEndpointChainTest(unittest.TestCase):
    """_reveal_endpoints resolves preferred -> fallbacks -> general purpose."""

    def setUp(self):
        self._orig_params = routes.get_effective_workshop_parameters
        self._orig_best = routes.get_best_available_endpoint
        routes.get_best_available_endpoint = lambda: "databricks-claude-sonnet-4-6"

    def tearDown(self):
        routes.get_effective_workshop_parameters = self._orig_params
        routes.get_best_available_endpoint = self._orig_best

    def _with_params(self, params):
        routes.get_effective_workshop_parameters = lambda session_id=None: dict(params)

    def test_defaults_when_unconfigured(self):
        """An install with no reveal params still gets the fast default first."""
        self._with_params({})
        chain = routes._reveal_endpoints(None)

        self.assertEqual(chain[0], "databricks-gemini-3-1-flash-lite")
        self.assertIn("databricks-claude-haiku-4-5", chain)

    def test_general_endpoint_is_always_last_resort(self):
        """However the chain is configured, a reveal can still be produced."""
        self._with_params({
            "reveal_model": "databricks-nonexistent-model",
            "reveal_model_fallbacks": "databricks-also-missing",
        })
        chain = routes._reveal_endpoints(None)

        self.assertEqual(chain[0], "databricks-nonexistent-model")
        self.assertEqual(chain[-1], "databricks-claude-sonnet-4-6")

    def test_facilitator_override_wins(self):
        """The whole point of the parameter: adopt a new model without a deploy."""
        self._with_params({"reveal_model": "databricks-gemini-3-6-flash"})
        self.assertEqual(routes._reveal_endpoints(None)[0], "databricks-gemini-3-6-flash")

    def test_fallbacks_parsed_in_order_and_whitespace_tolerant(self):
        self._with_params({
            "reveal_model": "a",
            "reveal_model_fallbacks": " b , c ,, d ",
        })
        self.assertEqual(routes._reveal_endpoints(None)[:4], ["a", "b", "c", "d"])

    def test_no_duplicate_attempts(self):
        """Naming the same model twice must not cause a repeated round trip."""
        self._with_params({
            "reveal_model": "databricks-claude-sonnet-4-6",
            "reveal_model_fallbacks": "databricks-claude-sonnet-4-6,x",
        })
        chain = routes._reveal_endpoints(None)
        self.assertEqual(len(chain), len(set(chain)))

    def test_blank_parameter_falls_back_to_default(self):
        """An empty string in the config must not become the endpoint name."""
        self._with_params({"reveal_model": "   ", "reveal_model_fallbacks": ""})
        chain = routes._reveal_endpoints(None)

        self.assertEqual(chain[0], "databricks-gemini-3-1-flash-lite")
        self.assertNotIn("", chain)

    def test_unreadable_parameters_do_not_break_the_reveal(self):
        """A database hiccup must degrade to defaults, not raise."""
        def boom(session_id=None):
            raise RuntimeError("lakebase unavailable")

        routes.get_effective_workshop_parameters = boom
        self.assertEqual(
            routes._reveal_endpoints("s1")[0], "databricks-gemini-3-1-flash-lite"
        )

    def test_reasoning_model_is_not_the_default(self):
        """
        gemini-3-5-flash emits nothing for ~8.6s while it thinks, so streaming cannot
        hide the wait. Measured, not assumed — this guards against someone "upgrading"
        the default to a newer-sounding model and making the panel slower.
        """
        self._with_params({})
        self.assertNotEqual(routes._reveal_endpoints(None)[0], "databricks-gemini-3-5-flash")


class UsageContextCompatibilityTest(unittest.TestCase):
    """
    Gemini rejects the extra_params.usage_context attribution field outright:

        HTTP 400 Invalid JSON payload received. Unknown name "extra_params"
        at 'generation_config': Cannot find field.

    So sending it is not harmless — it loses the entire call. The guard used to be
    `if "claude" not in endpoint`, which assumed every non-Claude family tolerates the
    field. Caught only by an end-to-end call, since the shape is valid JSON and no unit
    test of the payload builder would notice.
    """

    def test_gemini_does_not_receive_usage_context(self):
        for endpoint in (
            "databricks-gemini-3-1-flash-lite",
            "databricks-gemini-3-5-flash",
            "databricks-gemini-3-6-pro",
        ):
            self.assertFalse(
                routes._supports_usage_context(endpoint),
                f"{endpoint} would fail with HTTP 400",
            )

    def test_claude_still_excluded(self):
        self.assertFalse(routes._supports_usage_context("databricks-claude-sonnet-4-6"))

    def test_other_families_keep_attribution(self):
        """Llama and friends accept the field, and attribution is worth keeping."""
        for endpoint in ("databricks-meta-llama-3-1-70b-instruct", "databricks-dbrx-instruct"):
            self.assertTrue(routes._supports_usage_context(endpoint))

    def test_empty_endpoint_is_safe(self):
        self.assertTrue(routes._supports_usage_context(""))


class GeminiContentShapeTest(unittest.TestCase):
    """
    Gemini's structured content must survive the trip to the panel.

    Verified against a live workspace: Claude sends a string, Gemini sends a list of
    content parts. Both shapes below are real responses.
    """

    def test_claude_plain_string(self):
        self.assertEqual(text_from_content("**Verdict:** sound."), "**Verdict:** sound.")

    def test_gemini_structured_array(self):
        content = [{"type": "text", "text": "**Verdict:** too broad."}]
        self.assertEqual(text_from_content(content), "**Verdict:** too broad.")

    def test_multi_part_content_is_joined_without_inserted_whitespace(self):
        content = [{"type": "text", "text": "one "}, {"type": "text", "text": "answer"}]
        self.assertEqual(text_from_content(content), "one answer")

    def test_reasoning_parts_are_dropped(self):
        """A model's scratchpad is not the expert answer."""
        content = [
            {"type": "thinking", "text": "Let me consider the join key..."},
            {"type": "text", "text": "**Verdict:** the key will fan out."},
        ]
        self.assertEqual(text_from_content(content), "**Verdict:** the key will fan out.")

    def test_unknown_shape_yields_empty_not_a_repr(self):
        """
        Rendering "[{'type': 'text'...}]" into the panel would be worse than empty:
        it looks like the app is broken in a way the attendee cannot act on.
        """
        for value in (None, 123, object()):
            self.assertEqual(text_from_content(value), "")

    def test_empty_list_is_empty_string(self):
        self.assertEqual(text_from_content([]), "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
