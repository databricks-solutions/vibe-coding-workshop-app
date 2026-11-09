"""Deterministic, explainable similarity for saved ideas.

This deliberately avoids embeddings and LLM judgements. It is advisory: scores
are only used to surface potentially related work, with the matched evidence
shown to the user and reviewer.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, List, Optional, Set

MATCHER_VERSION = "lexical-v1"
MAX_MATCHES = 3
STOP = {
    "a", "an", "and", "are", "as", "at", "be", "build", "by", "can", "data",
    "do", "for", "from", "get", "help", "how", "i", "in", "is", "it", "me",
    "of", "on", "or", "our", "that", "the", "their", "this", "to", "use",
    "using", "we", "what", "when", "where", "which", "with", "you", "your",
}
WORD = re.compile(r"[a-z][a-z0-9]{2,}")


def _tokens(*values: Any) -> Set[str]:
    text = " ".join(str(v or "") for v in values)
    text = unicodedata.normalize("NFKC", text).lower().replace("_", " ")
    return {w for w in WORD.findall(text) if w not in STOP}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def _shape(idea: Dict[str, Any]) -> Dict[str, Any]:
    chosen = idea.get("chosenShapeId")
    return next((s for s in idea.get("shapes") or [] if isinstance(s, dict) and s.get("id") == chosen), {})


def _placed_leaf(idea: Dict[str, Any]) -> Dict[str, Any]:
    map_ = idea.get("map") if isinstance(idea.get("map"), dict) else {}
    placed = map_.get("placedLeafId")
    for branch in map_.get("branches") or []:
        if not isinstance(branch, dict):
            continue
        for leaf in branch.get("leaves") or []:
            if isinstance(leaf, dict) and leaf.get("id") == placed:
                return {**leaf, "branch": branch.get("name")}
    return {}


def canonical_groups(idea: Dict[str, Any]) -> Dict[str, Set[str]]:
    spark = idea.get("spark") if isinstance(idea.get("spark"), dict) else {}
    leaf = _placed_leaf(idea)
    shape = _shape(idea)
    active_questions = [q for q in idea.get("genieQuestions") or [] if isinstance(q, str)]
    details = idea.get("questionDetails") if isinstance(idea.get("questionDetails"), dict) else {}
    active_details = [details.get(q) for q in active_questions if isinstance(details.get(q), dict)]
    answers = idea.get("answers") if isinstance(idea.get("answers"), dict) else {}
    return {
        "intent": _tokens(
            idea.get("title"), idea.get("seed"), spark.get("statement"),
            spark.get("primaryEntity"), *(spark.get("aliases") or []),
        ),
        "area": _tokens(leaf.get("branch"), leaf.get("name"), leaf.get("problem"), leaf.get("valuePool")),
        "questions": _tokens(
            *active_questions,
            *(d.get("drivesAction") for d in active_details),
            *(m for d in active_details for m in d.get("metrics") or []),
            *(d for detail in active_details for d in detail.get("dimensions") or []),
        ),
        "people": _tokens(*(leaf.get("personas") or []), *answers.values()),
        "approach": _tokens(
            shape.get("kind"), shape.get("title"), shape.get("value"),
            shape.get("decisionStyle"), shape.get("cadence"), *(shape.get("surfaces") or []),
        ),
    }


def payload_fingerprint(idea: Dict[str, Any]) -> str:
    """Small stable fingerprint used to invalidate acknowledged matches."""
    groups = canonical_groups(idea)
    return "|".join(f"{key}:{','.join(sorted(groups[key]))}" for key in sorted(groups))


def _status(row: Dict[str, Any], idea: Dict[str, Any]) -> str:
    review = row.get("review_status")
    if review == "approved":
        return "approved"
    if review == "pending":
        return "in review"
    if idea.get("buildStage") == "studio":
        return "building"
    return str(idea.get("status") or row.get("status") or "shaping")


def find_matches(
    target: Dict[str, Any],
    rows: Iterable[Dict[str, Any]],
    *,
    current_id: Optional[str] = None,
    minimum: float = 45.0,
) -> List[Dict[str, Any]]:
    target_groups = canonical_groups(target)
    target_industry = str((target.get("spark") or {}).get("industry") or target.get("industry") or "").strip().lower()
    weights = {"intent": 45, "area": 20, "questions": 15, "people": 10, "approach": 10}
    out: List[Dict[str, Any]] = []

    for row in rows:
        idea = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        idea_id = str(row.get("id") or idea.get("id") or "")
        if not idea_id or idea_id == current_id or row.get("deleted_at"):
            continue
        seed_similarity = _jaccard(_tokens(target.get("seed")), _tokens(idea.get("seed")))
        groups = canonical_groups(idea)
        weighted = total_weight = 0.0
        similarities: Dict[str, float] = {}
        for key, weight in weights.items():
            if not target_groups[key] or not groups[key]:
                continue
            similarities[key] = _jaccard(target_groups[key], groups[key])
            weighted += similarities[key] * weight
            total_weight += weight
        if not total_weight:
            continue
        score = weighted / total_weight * 100
        other_industry = str((idea.get("spark") or {}).get("industry") or idea.get("industry") or row.get("industry") or "").strip().lower()
        same_industry = bool(target_industry and other_industry and target_industry == other_industry)
        if same_industry:
            score = min(100.0, score + 4.0)
        # A draft only has its raw seed, while an existing shaped idea has much
        # richer intent vocabulary. Preserve a near-identical starting idea as
        # a strong match instead of diluting it against the enriched statement.
        if seed_similarity >= 0.7:
            score = max(score, 72.0 + min(8.0, seed_similarity * 8.0))

        shared_intent = sorted(target_groups["intent"] & groups["intent"])
        meaningful_groups = [k for k, value in similarities.items() if value >= 0.24]
        exact_title = bool(
            str(target.get("title") or "").strip()
            and str(target.get("title") or "").strip().lower() == str(idea.get("title") or "").strip().lower()
        )
        if seed_similarity < 0.7 and not exact_title and len(shared_intent) < 3 and len(meaningful_groups) < 2:
            continue
        if score < minimum:
            continue

        evidence: List[str] = []
        if seed_similarity >= 0.7:
            evidence.append("Nearly identical starting idea")
        if shared_intent:
            evidence.append(f"Shared problem language: {', '.join(shared_intent[:5])}")
        if similarities.get("area", 0) >= 0.24:
            evidence.append("Same operational area or value pool")
        if similarities.get("questions", 0) >= 0.24:
            evidence.append("Overlapping questions and measures")
        if similarities.get("people", 0) >= 0.24:
            evidence.append("Similar users or workflow")
        if similarities.get("approach", 0) >= 0.24:
            evidence.append("Similar decision approach or cadence")
        if same_industry:
            evidence.append(f"Same industry: {other_industry.title()}")

        owner = str(row.get("created_by") or "")
        out.append({
            "id": idea_id,
            "title": str(row.get("title") or idea.get("title") or "Untitled idea"),
            "industry": str(row.get("industry") or idea.get("industry") or ""),
            "status": _status(row, idea),
            "similarity": round(score),
            "proximity": "strong" if score >= 68 else "possible",
            "sharedSignals": evidence[:4],
            "ownerEmail": owner,
            "valuePerYear": row.get("value_per_year"),
            "updatedAt": str(row.get("updated_at") or idea.get("updatedAt") or ""),
            "matcherVersion": MATCHER_VERSION,
        })

    return sorted(out, key=lambda m: (-m["similarity"], m["title"].lower(), m["id"]))[:MAX_MATCHES]
