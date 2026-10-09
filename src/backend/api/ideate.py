"""
Ideate API: a standalone space for shaping raw ideas into decision-ready briefs.

Stateless by design. The browser owns the idea (localStorage) and sends the
approved context with every call, so nothing here touches sessions, Lakebase,
or the rest of the workshop.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from src.backend.api.ideate_prompts import BRIEF_PROMPT, STEP_PROMPTS, build_step_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from src.backend.api.routes import _stream_with_retry, call_databricks_serving_endpoint
except Exception:  # pragma: no cover
    async def call_databricks_serving_endpoint(*args, **kwargs):  # type: ignore
        return {"response": "", "model": "none", "usage": None}

    async def _stream_with_retry(*args, **kwargs):  # type: ignore
        yield 'data: {"type": "error", "error": "LLM not available"}\n\n'


MAX_CONTEXT_CHARS = 14000
AI_UNAVAILABLE = "The AI assistant isn't reachable right now. Check that a model serving endpoint is configured, then try again."


class IdeateStepRequest(BaseModel):
    step: str
    idea: Dict[str, Any] = {}
    feedback: Optional[str] = None


class IdeateBriefRequest(BaseModel):
    idea: Dict[str, Any] = {}
    feedback: Optional[str] = None
    current_brief: Optional[str] = None


def _context_block(idea: Dict[str, Any], feedback: Optional[str], extra: str = "") -> str:
    context = json.dumps(idea, ensure_ascii=False, indent=1)
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[:MAX_CONTEXT_CHARS] + "\n...(truncated)"
    parts = [f"APPROVED IDEA CONTEXT:\n{context}"]
    if extra:
        parts.append(extra)
    if feedback and feedback.strip():
        parts.append(f"USER FEEDBACK TO APPLY (highest priority):\n{feedback.strip()}")
    return "\n\n".join(parts)


def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start:end + 1])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _slug(text: str, used: set) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (text or "item").lower()).strip("-")[:40] or "item"
    slug, n = base, 2
    while slug in used:
        slug, n = f"{base}-{n}", n + 1
    used.add(slug)
    return slug


def _as_str_list(value: Any, limit: int = 6) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()][:limit]


def _normalize_map(data: Dict[str, Any]) -> Dict[str, Any]:
    used: set = set()
    branches = []
    placed_id, adjacent = None, []
    for b in (data.get("branches") or [])[:4]:
        leaves = []
        for leaf in (b.get("leaves") or [])[:5]:
            lid = _slug(leaf.get("name", ""), used)
            leaves.append({
                "id": lid,
                "name": str(leaf.get("name", "")).strip(),
                "problem": str(leaf.get("problem", "")).strip(),
                "personas": _as_str_list(leaf.get("personas"), 3),
                "surfaces": _as_str_list(leaf.get("surfaces"), 3),
            })
            if leaf.get("placed") and not placed_id:
                placed_id = lid
            elif leaf.get("adjacent"):
                adjacent.append(lid)
        if leaves:
            branches.append({"id": _slug(b.get("name", ""), used), "name": str(b.get("name", "")).strip(), "leaves": leaves})
    if not placed_id and branches:
        placed_id = branches[0]["leaves"][0]["id"]
    return {
        "branches": branches,
        "placedLeafId": placed_id,
        "adjacentLeafIds": [a for a in adjacent if a != placed_id][:2],
        "rationale": str(data.get("rationale", "")).strip(),
        "assumptions": _as_str_list(data.get("assumptions")),
    }


def _normalize(step: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if step == "map":
        result = _normalize_map(data)
        return result if result["branches"] else None
    if step == "clarify":
        used: set = set()
        questions = [
            {
                "id": _slug(q.get("question", ""), used),
                "dimension": str(q.get("dimension", "functional")),
                "question": str(q.get("question", "")).strip(),
                "options": _as_str_list(q.get("options"), 4),
            }
            for q in (data.get("questions") or [])[:5]
            if q.get("question")
        ]
        return {"questions": questions} if questions else None
    if step == "followup":
        f = data.get("followup")
        if not isinstance(f, dict) or not f.get("question"):
            return {"followup": None}
        return {"followup": {
            "id": _slug("followup-" + str(f.get("question")), set()),
            "dimension": str(f.get("dimension", "business")),
            "question": str(f.get("question")).strip(),
            "options": _as_str_list(f.get("options"), 4),
            "isFollowup": True,
        }}
    if step == "shape":
        used = set()
        options = []
        for o in (data.get("options") or [])[:3]:
            options.append({
                "id": _slug(o.get("kind", "") + "-" + o.get("title", ""), used),
                "kind": str(o.get("kind", "copilot")).lower(),
                "title": str(o.get("title", "")).strip(),
                "value": str(o.get("value", "")).strip(),
                "effort": str(o.get("effort", "M")).strip().upper()[:1] or "M",
                "riskiestAssumption": str(o.get("riskiest_assumption", "")).strip(),
                "cheapTest": str(o.get("cheap_test", "")).strip(),
                "surfaces": _as_str_list(o.get("surfaces"), 4),
            })
        return {"options": options, "assumptions": _as_str_list(data.get("assumptions"))} if options else None
    if step == "challenge":
        pushbacks = _as_str_list(data.get("pushbacks"), 3)
        return {"pushbacks": pushbacks} if pushbacks else None
    if step == "gaps":
        dims = [
            {"key": str(d.get("key", "")), "covered": bool(d.get("covered")), "gap": str(d.get("gap", "")).strip()}
            for d in (data.get("dimensions") or [])
            if d.get("key")
        ]
        return {"dimensions": dims} if dims else None
    if step == "spark":
        if not data.get("statement"):
            return None
        return {
            "title": str(data.get("title", "")).strip(),
            "statement": str(data.get("statement", "")).strip(),
            "industry": str(data.get("industry", "")).strip(),
            "assumptions": _as_str_list(data.get("assumptions")),
        }
    return data


@router.post("/ideate/step", summary="Run one structured Ideate step")
async def ideate_step(body: IdeateStepRequest):
    if body.step not in STEP_PROMPTS:
        return JSONResponse({"error": f"Unknown step '{body.step}'"}, status_code=400)

    system_prompt = build_step_system_prompt(body.step)
    extra = f"CURRENT STEP: {body.idea.get('currentStep', '')}" if body.step == "challenge" else ""
    prompt = _context_block(body.idea, body.feedback, extra)

    for attempt in range(2):
        result = await call_databricks_serving_endpoint(
            prompt=prompt if attempt == 0 else prompt + "\n\nYour previous reply was not valid JSON. Return ONLY the JSON object.",
            system_prompt=system_prompt,
            max_tokens=2500,
            temperature=0.6,
        )
        text = (result.get("response") or "").strip()
        if not text or text.startswith("[Error]") or text.startswith("[Mock Response"):
            return JSONResponse({"error": AI_UNAVAILABLE, "detail": text[:300]}, status_code=503)
        parsed = _parse_json(text)
        normalized = _normalize(body.step, parsed) if parsed else None
        if normalized is not None:
            return {"step": body.step, "data": normalized, "model": result.get("model")}
        logger.warning(f"[Ideate] {body.step} returned unparseable output on attempt {attempt + 1}")

    return JSONResponse({"error": "The AI returned something unexpected. Please try again."}, status_code=502)


@router.post("/ideate/brief", summary="Stream the Ideate initiative brief")
async def ideate_brief(body: IdeateBriefRequest):
    extra = ""
    if body.current_brief and body.feedback:
        extra = f"CURRENT BRIEF (revise it, keep what works):\n{body.current_brief[:MAX_CONTEXT_CHARS]}"
    messages = [
        {"role": "system", "content": BRIEF_PROMPT},
        {"role": "user", "content": _context_block(body.idea, body.feedback, extra)},
    ]
    return StreamingResponse(
        _stream_with_retry(messages, max_tokens=4000, temperature=0.5, section_tag="ideate_brief"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
