"""Adaptive, grounded coaching behind ``vibe_explain_step(focus=...)`` (D-22..D-25).

Coaching is on demand, read-only and fail-open. ``coach()`` never raises: every
model, timeout, endpoint, scrub or telemetry failure degrades to the static step
help with ``is_fallback=True``. The model call runs off the event loop through
mcp_server's ``_run_async_blocking``, passed in as ``run_blocking`` so this module
never imports mcp_server (no circular import).

Single flight + negative cache (D-24), keyed by (session_id, sectionTag, focus):
  - a success cache, so a repeat call is a cache hit with no model call;
  - an in-flight Future registry, so concurrent joiners never start a second call;
  - a negative entry written ONLY on a truly resolved failure (exception, error or
    empty response, scrub reject). A budget abandonment writes none, so the
    generation finishing late on its daemon thread still populates the cache.
"""

from __future__ import annotations

import concurrent.futures
import logging
import os
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from . import lakebase, llm

logger = logging.getLogger(__name__)

COACH_SYSTEM = """You are the coach for a hands-on Databricks workshop (the track named in the CONTEXT). A learner is working
through it inside an AI coding agent. Your job: explain, in plain language, WHAT is happening at
their current step and WHY it matters — grounded ONLY in the CONTEXT provided in the user message
(the step's purpose, how-to-apply, expected output, the learner's own prior outputs and answers,
and their industry/use case).

HARD RULES
- Ground every claim in the CONTEXT. If the CONTEXT does not support an answer, say what the learner
  should do or check next — never invent facts, table names, column values, or results.
- NEVER restate, paraphrase, or "improve" the step's verbatim PROMPT body. It is shown to the
  learner separately and must remain authoritative. You explain and motivate; you do not re-issue
  the instruction.
- NEVER emit benchmark question text, sample data values, literals, secrets, or PII. Speak in terms
  of concepts and the learner's own artifacts, not raw data. (Firewall — D7 §6.)
- Respect the learner's recorded decisions: if they chose a non-recommended option, coach that
  path's trade-offs; do not scold or re-litigate a settled choice.

FOCUS (from the CONTEXT's `focus` field)
- what_now : orient them — where they are, what this step produces, what to do next.
- why      : motivate — why this step exists and what breaks downstream if it's skipped or wrong.
- unblock  : diagnose — the most likely reason they're stuck here and the smallest next action.
- review   : recap — what they've accomplished so far and how this step builds on it.

STYLE
- 2–5 sentences. Confident guide, not a form or a quiz. Recommend, don't interrogate (D5 §3, §7).
- No emoji, no numbered/decorated headers, no marketing adjectives, no filler (economist/humanizer
  bars, D5 §7). Precise and literal about tokens, gate names, and definitions — do not vague them.
- Output prose only. No JSON, no markdown headings — the tool wraps your text into CoachResult."""

FOCI = ("what_now", "why", "unblock", "review")

# Knobs (D9 §9 q4). The endpoint is the app default (llm.SERVING_ENDPOINT_NAME).
COACH_MAX_TOKENS = 400
COACH_BUDGET_S = 8.0
COACH_NEGATIVE_TTL_S = 300.0
COACH_TEMPERATURE = 0.3

PROMPT_CAP = 4000
OUTPUT_EXCERPT_CAP = 600
PRIOR_ANSWERS_CAP = 10
OVERLAP_WORDS = 8

_DISABLED_VALUES = {"0", "false", "off", "no"}


def coaching_enabled() -> bool:
    """Kill switch, read per call: VIBE_COACHING_ENABLED=0/false/off/no disables."""

    return os.getenv("VIBE_COACHING_ENABLED", "").strip().lower() not in _DISABLED_VALUES


# --- Leakage scrub (D-25) ----------------------------------------------------

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_SECRET_RES = (
    re.compile(r"\bdapi[0-9a-f]{20,}\b", re.IGNORECASE),
    re.compile(r"\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    re.compile(r"(?i)\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+"),
    # A long run mixing letters and digits reads like a key or token.
    re.compile(r"\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{40,}\b"),
)
_CODE_FENCE_RE = re.compile(r"```|~~~")
_SQL_RES = (
    re.compile(r"\bSELECT\b[\s\S]*?\bFROM\b"),
    re.compile(r"\b(?:INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO|ALTER\s+TABLE|TRUNCATE\s+TABLE)\b"),
    re.compile(r"\bUPDATE\s+[\w.`\"]+\s+SET\b"),
    re.compile(r"\b(?:CREATE|DROP)\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|SCHEMA|FUNCTION|CATALOG)\b"),
    # Lower-case SQL needs a column list right after select, so prose like
    # "select the table from the list" does not trip it.
    re.compile(r"\bselect\s+(?:\*|[\w.]+(?:\s*,\s*[\w.]+)*)\s+from\s+[\w.`]+"),
)
# A data row: a markdown table row, or a delimited line of 3+ fields.
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
_DELIMITED_ROW_RE = re.compile(r"^[^,\t]*(?:[,\t][^,\t]*){3,}$")
_WORD_RE = re.compile(r"[a-z0-9_']+")


def _has_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in _SECRET_RES)


def scrub_input(text: str) -> str:
    """Drop data rows, secret-like lines and emails from a grounding excerpt."""

    kept = []
    for line in str(text or "").splitlines():
        if _TABLE_ROW_RE.match(line) or _DELIMITED_ROW_RE.match(line):
            continue
        if _has_secret(line):
            continue
        kept.append(_EMAIL_RE.sub("[email]", line))
    return "\n".join(kept).strip()


def _ngrams(text: str, n: int) -> set[tuple[str, ...]]:
    words = _WORD_RE.findall(text.lower())
    return {tuple(words[i : i + n]) for i in range(len(words) - n + 1)}


def _scrub_output(text: str, forbidden_sources: list[str]) -> str | None:
    if not isinstance(text, str) or not text.strip():
        return None
    if _EMAIL_RE.search(text) or _has_secret(text):
        return None
    if _CODE_FENCE_RE.search(text):
        return None
    if any(pattern.search(text) for pattern in _SQL_RES):
        return None
    out_grams = _ngrams(text, OVERLAP_WORDS)
    if out_grams:
        for source in forbidden_sources:
            if source and out_grams & _ngrams(source, OVERLAP_WORDS):
                return None
    return text


def scrub_output(text: str, *, forbidden_sources: list[str]) -> str | None:
    """Return ``text`` unchanged if it is safe to show, else None (reject).

    Rejects on a >= 8-word verbatim overlap with any forbidden source (the step
    prompt, captured outputs), secret-like tokens, emails, code fences or SQL
    statements. Any exception while scrubbing is a reject (fail closed).
    """

    try:
        return _scrub_output(text, forbidden_sources)
    except Exception:  # noqa: BLE001 — a scrub that cannot decide rejects
        logger.warning("Coaching scrub raised; rejecting output", exc_info=True)
        return None


# --- Grounding context (D2 §12.3) ---------------------------------------------


def _output_keys(step: Any) -> list[str]:
    keys = list(getattr(step, "consumes", None) or [])
    produces = getattr(step, "produces", None)
    if produces and produces not in keys:
        keys.append(produces)
    return keys


def build_context(
    step: Any,
    state: Any,
    help: Mapping[str, Any],
    track: str,
    interactions: list[dict[str, Any]],
    *,
    focus: str = "what_now",
) -> tuple[str, list[str]]:
    """Assemble the coaching user message from server-side sources only.

    Returns the user message and ``grounded_on``: the non-empty context keys, with
    ``captured_outputs:<key>`` for each captured output that fed the message.
    """

    params = getattr(state, "session_parameters", None) or {}
    captured = getattr(state, "captured_outputs", None) or {}
    sections: list[tuple[str, str]] = [
        ("focus", focus),
        ("track", track or ""),
        ("title", str(help.get("title") or getattr(step, "title", "") or "")),
        ("why", str(help.get("why") or getattr(step, "why", "") or "")),
        ("how_to_apply", str(help.get("how_to_apply") or "")),
        ("expected_output", str(help.get("expected_output") or "")),
        ("gate", str(getattr(step, "gate", "") or "")),
        ("execution", str(getattr(step, "execution", "") or "")),
    ]
    prompt = str(help.get("prompt") or "")[:PROMPT_CAP]
    if prompt:
        sections.append(("prompt", "REFERENCE ONLY — do not restate or paraphrase:\n" + prompt))
    grounded_on = [key for key, value in sections if value]
    lines = [f"{key}: {value}" for key, value in sections if value]

    output_lines = []
    for key in _output_keys(step):
        value = captured.get(key)
        if not value:
            continue
        excerpt = scrub_input(str(value))[:OUTPUT_EXCERPT_CAP]
        if excerpt:
            output_lines.append(f"- {key}: {excerpt}")
            grounded_on.append(f"captured_outputs:{key}")
    if output_lines:
        lines.append("captured_outputs:\n" + "\n".join(output_lines))

    answers = [
        row
        for row in interactions or []
        if row.get("kind") != "coaching" and row.get("answer")
    ][:PRIOR_ANSWERS_CAP]
    if answers:
        lines.append(
            "prior_answers:\n"
            + "\n".join(f"- {row.get('interaction_id')}: {row.get('answer')}" for row in answers)
        )
        grounded_on.append("prior_answers")

    for key in ("industry", "use_case"):
        value = str(params.get(key) or "")
        if value:
            lines.append(f"{key}: {value}")
            grounded_on.append(key)

    return "CONTEXT\n" + "\n".join(lines), grounded_on


# --- Single flight + negative cache (D-24) ------------------------------------

_LOCK = threading.Lock()
_CACHE: dict[tuple[str, str, str], str] = {}
_INFLIGHT: dict[tuple[str, str, str], "concurrent.futures.Future[str | None]"] = {}
_NEGATIVE: dict[tuple[str, str, str], float] = {}


def clear_caches() -> None:
    """Reset the coaching caches (tests)."""

    with _LOCK:
        _CACHE.clear()
        _INFLIGHT.clear()
        _NEGATIVE.clear()


def _response_text(result: Any) -> str | None:
    if not isinstance(result, dict):
        return None
    text = result.get("response")
    if not isinstance(text, str) or not text.strip():
        return None
    if text.startswith("[Error]") or text.startswith("[Mock Response"):
        return None
    return text.strip()


def _single_flight(
    key: tuple[str, str, str],
    user_message: str,
    forbidden_sources: list[str],
    run_blocking: Callable[..., Any],
) -> tuple[str | None, str]:
    """Return (scrubbed coaching or None, reason)."""

    with _LOCK:
        cached = _CACHE.get(key)
        if cached is not None:
            return cached, "cache_hit"
        expiry = _NEGATIVE.get(key)
        if expiry is not None:
            if expiry > time.monotonic():
                return None, "negative_cache"
            del _NEGATIVE[key]
        future = _INFLIGHT.get(key)
        is_owner = future is None
        if is_owner:
            future = concurrent.futures.Future()
            _INFLIGHT[key] = future

    budget = COACH_BUDGET_S
    if not is_owner:
        try:
            text = future.result(timeout=budget)
        except concurrent.futures.TimeoutError:
            return None, "timeout"
        return (text, "joined") if text is not None else (None, "failed")

    async def _generate_and_resolve() -> None:
        # Runs on the daemon thread; resolves the Future and writes the cache even
        # after the owner abandoned the join on budget expiry (late success).
        text: str | None = None
        try:
            result = await llm.call_databricks_serving_endpoint(
                user_message,
                endpoint_name=None,
                max_tokens=COACH_MAX_TOKENS,
                temperature=COACH_TEMPERATURE,
                system_prompt=COACH_SYSTEM,
            )
            raw = _response_text(result)
            text = scrub_output(raw, forbidden_sources=forbidden_sources) if raw else None
        except BaseException:  # noqa: BLE001 — coaching is fail-open
            logger.warning("Coaching generation raised for %s", key[1], exc_info=True)
            text = None
        finally:
            with _LOCK:
                if text is not None:
                    _CACHE[key] = text
                else:
                    _NEGATIVE[key] = time.monotonic() + COACH_NEGATIVE_TTL_S
                _INFLIGHT.pop(key, None)
            future.set_result(text)

    try:
        run_blocking(_generate_and_resolve, timeout_s=budget)
    except TimeoutError:
        logger.warning("Coaching exceeded %.1fs budget for %s; static help served", budget, key[1])
        return None, "timeout"
    except Exception:  # noqa: BLE001 — run_blocking itself failed
        logger.warning("Coaching run failed for %s", key[1], exc_info=True)
        with _LOCK:
            if _INFLIGHT.get(key) is future:
                _INFLIGHT.pop(key, None)
                _NEGATIVE[key] = time.monotonic() + COACH_NEGATIVE_TTL_S
        if not future.done():
            future.set_result(None)
        return None, "failed"
    text = future.result() if future.done() else None
    return (text, "generated") if text is not None else (None, "failed")


# --- coach() -----------------------------------------------------------------


@dataclass
class CoachOutcome:
    coaching: str | None
    grounded_on: list[str] = field(default_factory=list)
    is_fallback: bool = True
    reason: str = ""


def _record(session_id: str, section_tag: str, focus: str, outcome: CoachOutcome) -> None:
    try:
        ok = lakebase.append_session_interaction(
            session_id,
            section_tag,
            interaction_id=f"coach.{focus}",
            kind="coaching",
            answer=None,
            coaching_shown=outcome.coaching,
            surface="mcp",
            is_fallback=outcome.is_fallback,
            focus=focus,
        )
        if not ok:
            logger.info("Coaching telemetry not recorded for %s/%s", session_id, section_tag)
    except Exception:  # noqa: BLE001 — telemetry is best-effort
        logger.warning("Coaching telemetry raised for %s/%s", session_id, section_tag, exc_info=True)


def coach(
    *,
    session_id: str,
    step: Any,
    state: Any,
    help: Mapping[str, Any],
    focus: str,
    track: str,
    run_blocking: Callable[..., Any],
) -> CoachOutcome:
    """Coach the learner on ``step`` through ``focus``. Never raises."""

    try:
        if not coaching_enabled():
            return CoachOutcome(coaching=None, is_fallback=True, reason="disabled")
        section_tag = str(getattr(step, "sectionTag", "") or "")
        try:
            interactions = lakebase.list_session_interactions(session_id, limit=PRIOR_ANSWERS_CAP)
        except Exception:  # noqa: BLE001 — history is optional grounding
            interactions = []
        user_message, grounded_on = build_context(
            step, state, help, track, interactions, focus=focus
        )
        captured = getattr(state, "captured_outputs", None) or {}
        forbidden = [str(help.get("prompt") or "")] + [
            str(captured.get(key) or "") for key in _output_keys(step)
        ]
        text, reason = _single_flight(
            (session_id, section_tag, focus), user_message, forbidden, run_blocking
        )
        outcome = CoachOutcome(
            coaching=text,
            grounded_on=grounded_on if text is not None else [],
            is_fallback=text is None,
            reason=reason,
        )
    except Exception:  # noqa: BLE001 — coaching never fails the tool
        logger.warning("Coaching failed; static help served", exc_info=True)
        outcome = CoachOutcome(coaching=None, is_fallback=True, reason="error")
        section_tag = str(getattr(step, "sectionTag", "") or "")
    _record(session_id, section_tag, focus, outcome)
    return outcome
