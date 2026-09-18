"""
Quality-based scoring for workshop steps.

Points used to come from clicking Done, which made the leaderboard a measure of
how fast someone could click through 56 steps. Here an award is the step's ceiling
scaled by two factors:

  * quality       — how good the attendee's committed decision was (0-10 rubric)
  * verification  — how the artifact was confirmed (a real workspace check counts
                    for more than the attendee's own word)

The rubric shape (criteria dict, 0-10 marks, mean overall, ai_assisted flag) is
deliberately the same as the hackathon judging path in api/hackathon.py, so the two
surfaces stay consistent and the clamping logic lives in one place.

Design notes worth keeping:

  * There is a floor on decision quality. Thinking about a hard modelling call and
    getting it wrong is worth more than not thinking at all, and a workshop that
    punishes a wrong answer teaches attendees to guess what the app wants.
  * Absence of a score row is meaningful, not an error. _calculate_score falls back
    to the flat per-step value, so sessions predating this module score unchanged.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# How much of a step's ceiling each verification method is worth. Confirming an
# artifact really exists in the workspace is the strongest signal; the attendee's own
# say-so is the weakest but is never worth zero, because the escape hatch has to stay
# genuinely usable when a permission is missing.
VERIFICATION_FACTORS: Dict[str, float] = {
    "workspace": 1.00,
    "agent_reported": 0.85,
    "self_attested": 0.60,
    "none": 0.50,
}

# Credit for engaging with a decision at all, however wrong the answer.
DECISION_QUALITY_FLOOR = 0.35

# A step that only asked the attendee to read and copy something.
PARTICIPATION_FACTOR = 0.50

# Default rubric per kind, used when a step declares no criteria of its own.
DEFAULT_CRITERIA: Dict[str, list] = {
    "decision": ["specificity", "justification"],
    "critique": ["correctness", "completeness"],
}


def clamp_criteria(criteria: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """
    Coerce raw marks to floats in 0-10, dropping anything unusable.

    Marks can arrive from an LLM judge or a hand-authored rubric, so a stray string
    or out-of-range number must not poison the total.
    """
    if not isinstance(criteria, dict):
        return {}

    cleaned: Dict[str, float] = {}
    for name, value in criteria.items():
        try:
            cleaned[str(name)] = max(0.0, min(10.0, float(value)))
        except (TypeError, ValueError):
            logger.debug(f"[Scoring] Dropping non-numeric mark {name}={value!r}")
    return cleaned


def overall_from_criteria(criteria: Dict[str, float]) -> float:
    """Mean of the per-criterion marks, 0-10. No criteria means no opinion (0)."""
    if not criteria:
        return 0.0
    return round(sum(criteria.values()) / len(criteria), 2)


def quality_factor(step_kind: str, overall: float) -> float:
    """
    Fraction of a step's ceiling earned on quality alone.

    Verify steps are pass/fail rather than graded, so a pass earns the full ceiling
    and the verification factor carries the nuance. Instant-prompt steps get a flat
    participation share — there is nothing to assess.
    """
    if step_kind in ("decision", "critique"):
        return max(DECISION_QUALITY_FLOOR, overall / 10.0)
    if step_kind == "verify":
        return 1.0
    return PARTICIPATION_FACTOR


def award_points(
    max_points: int,
    step_kind: str,
    overall: float,
    verification: str = "none",
) -> int:
    """
    Points for one step: ceiling x quality x verification.

    max_points stays whatever STEP_SCORES says, so per-step ceilings and the overall
    total are unchanged and a returning attendee's score stays legible.
    """
    factor = quality_factor(step_kind, overall)
    verification_factor = VERIFICATION_FACTORS.get(verification, VERIFICATION_FACTORS["none"])
    return int(round(max(0, max_points) * factor * verification_factor))


def score_decision(
    max_points: int,
    criteria: Optional[Dict[str, Any]] = None,
    verification: str = "none",
    ai_assisted: bool = False,
) -> Dict[str, Any]:
    """
    Build a complete score row for a committed decision.

    Returns the shape session_step_scores stores, so callers do not have to know the
    column layout.
    """
    cleaned = clamp_criteria(criteria)
    overall = overall_from_criteria(cleaned)
    return {
        "criteria": cleaned,
        "overall": overall,
        "max_points": max_points,
        "awarded_points": award_points(max_points, "decision", overall, verification),
        "verification": verification,
        "ai_assisted": ai_assisted,
    }


def score_verification(max_points: int, status: str) -> Dict[str, Any]:
    """
    Build a score row from a verification outcome.

    'unknown' is treated as a pass for scoring, exactly as it is for gating: a missing
    permission or a slow control plane is the workshop's problem, not the attendee's.
    It is recorded as self_attested so the award reflects the weaker evidence.
    """
    verification = {
        "pass": "workspace",
        "unknown": "self_attested",
        "fail": "none",
    }.get(status, "none")

    # A failed check earns the participation share, not zero — the attendee still did
    # the step, and the gate is advisory.
    overall = 10.0 if status == "pass" else 0.0
    kind = "verify" if status == "pass" else "instant_prompt"

    return {
        "criteria": {},
        "overall": overall,
        "max_points": max_points,
        "awarded_points": award_points(max_points, kind, overall, verification),
        "verification": verification,
        "ai_assisted": False,
    }
