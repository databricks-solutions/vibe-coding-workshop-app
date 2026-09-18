"""
Tests for quality-based step scoring.

Points used to come from clicking Done. They now come from the quality of the
attendee's decision and how their artifact was confirmed. Two properties matter most
and are asserted hard here:

  1. A session with no quality scores must total EXACTLY what it did before, so
     existing leaderboard standings are untouched and no backfill is needed.
  2. Thinking about a hard call and getting it wrong must beat not thinking at all,
     or the workshop teaches attendees to guess what the app wants.

Runnable with the Python stdlib:

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_step_scoring -v
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

from src.backend.services import step_scoring  # noqa: E402
from src.backend.services import lakebase  # noqa: E402


class ClampCriteriaTest(unittest.TestCase):
    """Marks may come from an LLM judge, so anything unusable must be dropped."""

    def test_marks_are_clamped_to_zero_ten(self):
        cleaned = step_scoring.clamp_criteria({"a": -5, "b": 99, "c": 7})

        self.assertEqual(cleaned["a"], 0.0)
        self.assertEqual(cleaned["b"], 10.0)
        self.assertEqual(cleaned["c"], 7.0)

    def test_non_numeric_marks_are_dropped_not_fatal(self):
        cleaned = step_scoring.clamp_criteria({"good": 8, "bad": "excellent", "none": None})

        self.assertEqual(cleaned, {"good": 8.0})

    def test_malformed_input_degrades_quietly(self):
        self.assertEqual(step_scoring.clamp_criteria(None), {})
        self.assertEqual(step_scoring.clamp_criteria("nope"), {})

    def test_overall_is_the_mean(self):
        self.assertEqual(step_scoring.overall_from_criteria({"a": 6, "b": 9}), 7.5)
        self.assertEqual(step_scoring.overall_from_criteria({}), 0.0)


class QualityFactorTest(unittest.TestCase):
    def test_wrong_answer_still_earns_credit_for_thinking(self):
        """
        The floor is the point: a decision step that scored zero must still pay more
        than nothing, otherwise attendees learn to guess what the app wants rather
        than state what they actually believe.
        """
        factor = step_scoring.quality_factor("decision", overall=0.0)

        self.assertEqual(factor, step_scoring.DECISION_QUALITY_FLOOR)
        self.assertGreater(factor, 0)

    def test_better_decisions_earn_more(self):
        poor = step_scoring.quality_factor("decision", 4.0)
        good = step_scoring.quality_factor("decision", 9.0)

        self.assertGreater(good, poor)
        self.assertEqual(good, 0.9)

    def test_verify_steps_are_pass_fail_not_graded(self):
        self.assertEqual(step_scoring.quality_factor("verify", 10.0), 1.0)

    def test_instant_prompt_gets_a_participation_share(self):
        factor = step_scoring.quality_factor("instant_prompt", 0.0)

        self.assertEqual(factor, step_scoring.PARTICIPATION_FACTOR)
        self.assertLess(factor, 1.0)


class AwardPointsTest(unittest.TestCase):
    def test_workspace_verification_beats_self_attestation(self):
        verified = step_scoring.award_points(40, "verify", 10.0, "workspace")
        attested = step_scoring.award_points(40, "verify", 10.0, "self_attested")

        self.assertEqual(verified, 40)
        self.assertEqual(attested, 24)  # 40 * 1.0 * 0.60
        self.assertGreater(verified, attested)

    def test_self_attestation_is_never_worthless(self):
        """The escape hatch has to stay usable when a permission is missing."""
        self.assertGreater(step_scoring.award_points(40, "verify", 10.0, "self_attested"), 0)

    def test_perfect_decision_with_workspace_proof_earns_the_ceiling(self):
        self.assertEqual(step_scoring.award_points(50, "decision", 10.0, "workspace"), 50)

    def test_unknown_verification_method_falls_back_to_none(self):
        fallback = step_scoring.award_points(40, "verify", 10.0, "nonsense")
        explicit = step_scoring.award_points(40, "verify", 10.0, "none")

        self.assertEqual(fallback, explicit)

    def test_never_returns_negative(self):
        self.assertEqual(step_scoring.award_points(-10, "decision", 5.0, "workspace"), 0)


class ScoreBuildersTest(unittest.TestCase):
    def test_score_decision_returns_a_full_row(self):
        row = step_scoring.score_decision(
            max_points=40,
            criteria={"grain_precision": 8, "fk_coverage": 6},
            verification="agent_reported",
        )

        self.assertEqual(row["overall"], 7.0)
        self.assertEqual(row["max_points"], 40)
        self.assertEqual(row["verification"], "agent_reported")
        self.assertFalse(row["ai_assisted"])
        self.assertGreater(row["awarded_points"], 0)

    def test_failed_verification_still_pays_something(self):
        """Gates are advisory, so a failing check must not zero the step."""
        row = step_scoring.score_verification(max_points=40, status="fail")

        self.assertGreater(row["awarded_points"], 0)
        self.assertEqual(row["verification"], "none")

    def test_unknown_verification_is_treated_as_a_pass(self):
        """
        A missing permission or a slow control plane is the workshop's problem, not
        the attendee's — recorded as self_attested, which pays less than a real check.
        """
        unknown = step_scoring.score_verification(40, "unknown")
        passed = step_scoring.score_verification(40, "pass")

        self.assertEqual(unknown["verification"], "self_attested")
        self.assertGreater(unknown["awarded_points"], 0)
        self.assertGreater(passed["awarded_points"], unknown["awarded_points"])


class LegacyScoringTest(unittest.TestCase):
    """
    The compatibility guarantee. A session with no quality rows must score byte
    identically to before, and the fallback must be per STEP, not per session.
    """

    def test_session_without_quality_scores_is_unchanged(self):
        completed = [1, 2, 3, 4, 5]
        expected = sum(lakebase.STEP_SCORES[s] for s in completed)

        self.assertEqual(lakebase._calculate_score(completed), expected)
        self.assertEqual(lakebase._calculate_score(completed, None, {}), expected)

    def test_skipped_steps_still_earn_nothing(self):
        self.assertEqual(lakebase._calculate_score([1, 2, 3], [2, 3]), lakebase.STEP_SCORES[1])

    def test_fallback_is_per_step_not_per_session(self):
        """
        A session spanning the change has some scored steps and some not. Each must be
        counted its own way rather than the whole session falling back.
        """
        completed = [1, 2, 3]
        quality = {2: 7}  # only step 2 was scored

        total = lakebase._calculate_score(completed, [], quality)

        self.assertEqual(
            total,
            lakebase.STEP_SCORES[1] + 7 + lakebase.STEP_SCORES[3],
        )

    def test_quality_score_of_zero_is_respected_not_treated_as_missing(self):
        """0 is a real score; `or` style fallbacks would silently replace it."""
        total = lakebase._calculate_score([1], [], {1: 0})

        self.assertEqual(total, 0)

    def test_duplicate_completions_count_once(self):
        self.assertEqual(
            lakebase._calculate_score([1, 1, 1], [], {}),
            lakebase.STEP_SCORES[1],
        )

    def test_steps_above_the_old_thirty_step_cap_score(self):
        """Activation, Agents and MLflow steps all live above 30."""
        for step in (31, 37, 46, 56):
            self.assertGreater(lakebase._calculate_score([step], [], {}), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
