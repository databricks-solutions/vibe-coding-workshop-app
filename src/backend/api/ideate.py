"""
Ideate API: a standalone space for shaping raw ideas into decision-ready briefs.

The browser owns the idea (localStorage) and sends the approved context with
every call, so the steps touch no sessions or workshop state. The one write is
/ideate/submit, which adds a committed idea to the use case catalog
(usecase_descriptions) as an inactive entry for an admin to review.
"""

import json
import logging
import math
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from src.backend.api.ideate_prompts import BRIEF_PROMPT, CATALOG_PROMPT, STEP_PROMPTS, build_step_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from src.backend.api.routes import _stream_with_retry, call_databricks_serving_endpoint
except Exception:  # pragma: no cover
    async def call_databricks_serving_endpoint(*args, **kwargs):  # type: ignore
        return {"response": "", "model": "none", "usage": None}

    async def _stream_with_retry(*args, **kwargs):  # type: ignore
        yield 'data: {"type": "error", "error": "LLM not available"}\n\n'

try:
    from src.backend.api.routes import (
        _get_session_user,
        _invalidate_cache,
        execute_insert,
        execute_query,
        get_industries,
        get_schema,
        is_lakebase_configured,
    )
except Exception:  # pragma: no cover
    def get_industries():  # type: ignore
        return []

    def is_lakebase_configured():  # type: ignore
        return False


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


class IdeateSubmitRequest(BaseModel):
    idea: Dict[str, Any] = {}
    business_case: Optional[Dict[str, Any]] = None
    brief: Optional[str] = None
    industry: Optional[str] = None
    industry_label: str
    use_case_label: str
    category: Optional[str] = None
    use_case: Optional[str] = None


DRIVER_INPUTS = {
    "time_saved": ["baseline_minutes", "target_minutes", "events_per_day", "people_per_event", "days_per_year", "hourly_rate"],
    "cost_avoided": ["events_per_year", "reduction_pct", "cost_per_event"],
    "revenue_uplift": ["volume_per_year", "uplift_pct", "value_per_unit"],
}
UNITS = {"minutes", "events", "people", "days", "$/hour", "$", "%", "units"}
REFRESH = {"daily", "hourly", "frequent", "streaming"}
TRANSFORMS = {"light", "medium", "heavy"}


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


def _num(value: Any) -> Optional[float]:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) and n >= 0 else None


def _option(o: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(o, dict):
        return None
    value = _num(o.get("value"))
    label = str(o.get("label", "")).strip()
    return {"label": label, "value": value} if label and value is not None else None


def _normalize_impact(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    driver = str(data.get("driver", "")).strip()
    if driver not in DRIVER_INPUTS:
        return None
    keys = DRIVER_INPUTS[driver]
    questions, asked = [], set()
    for q in (data.get("questions") or [])[:4]:
        key = str((q or {}).get("key", "")).strip()
        if key not in keys or key in asked or not q.get("question"):
            continue
        options = [o for o in (_option(x) for x in (q.get("options") or [])[:4]) if o]
        if len(options) < 2:
            continue
        estimate = _option(q.get("estimate")) or options[len(options) // 2]
        unit = str(q.get("unit", "")).strip()
        asked.add(key)
        questions.append({
            "key": key,
            "question": str(q["question"]).strip(),
            "unit": unit if unit in UNITS else "units",
            "options": options,
            "estimate": estimate,
            "why": str(q.get("why", "")).strip(),
        })
    if len(questions) < 2:
        return None
    assumed = []
    for a in data.get("assumed") or []:
        key = str((a or {}).get("key", "")).strip()
        value = _num(a.get("value")) if isinstance(a, dict) else None
        if key in keys and key not in asked and value is not None:
            asked.add(key)
            unit = str(a.get("unit", "")).strip()
            assumed.append({
                "key": key,
                "label": str(a.get("label", key.replace("_", " "))).strip(),
                "value": value,
                "unit": unit if unit in UNITS else "units",
                "why": str(a.get("why", "")).strip(),
            })
    cost = data.get("cost") if isinstance(data.get("cost"), dict) else {}
    refresh = str(cost.get("refresh", "daily")).strip().lower()
    transforms = str(cost.get("transforms", "medium")).strip().lower()
    return {
        "driver": driver,
        "driverLabel": str(data.get("driver_label", "")).strip(),
        "scope": str(data.get("scope", "")).strip(),
        "questions": questions,
        "assumed": assumed,
        "cost": {
            "dataGbPerDay": min(10000.0, max(0.01, _num(cost.get("data_gb_per_day")) or 1.0)),
            "refresh": refresh if refresh in REFRESH else "daily",
            "transforms": transforms if transforms in TRANSFORMS else "medium",
            "users": int(min(10000, max(1, _num(cost.get("users")) or 10))),
            "hoursPerDay": int(min(24, max(1, _num(cost.get("hours_per_day")) or 10))),
        },
    }


def _normalize_summary(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not data.get("subtitle") or not data.get("what_we_build"):
        return None
    text = lambda v: str(v or "").strip()  # noqa: E731
    metric = data.get("metric") if isinstance(data.get("metric"), dict) else {}
    stack = data.get("stack") if isinstance(data.get("stack"), dict) else {}
    risks = [
        {"risk": text(r.get("risk")), "guard": text(r.get("guard"))}
        for r in (data.get("risks") or [])[:3]
        if isinstance(r, dict) and r.get("risk")
    ]
    return {
        "subtitle": text(data.get("subtitle")),
        "problemToday": text(data.get("problem_today")),
        "whoItsFor": text(data.get("who_its_for")),
        "metric": {"label": text(metric.get("label")), "today": text(metric.get("today")), "target": text(metric.get("target"))},
        "whatWeBuild": text(data.get("what_we_build")),
        "workflowSteps": _as_str_list(data.get("workflow_steps"), 4),
        "stack": {k: text(stack.get(k)) or "Not needed" for k in ("data", "shape", "serve", "use")},
        "risks": risks,
        "nextSteps": _as_str_list(data.get("next_steps"), 3),
        "decision": text(data.get("decision")),
    }


def _catalog_industries() -> Dict[str, str]:
    """Live catalog industries as {key: label}, without the empty prompt row or the Sample industry."""
    try:
        return {i["value"]: i["label"] for i in get_industries() if i.get("value") and i["value"] != "sample"}
    except Exception as e:  # pragma: no cover
        logger.warning(f"[Ideate] Could not load catalog industries: {e}")
        return {}


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
    if step == "impact":
        return _normalize_impact(data)
    if step == "summary":
        return _normalize_summary(data)
    if step == "spark":
        if not data.get("statement"):
            return None
        industry = str(data.get("industry", "")).strip()
        return {
            "title": str(data.get("title", "")).strip(),
            "statement": str(data.get("statement", "")).strip(),
            "industry": industry,
            "industryAlternatives": [a for a in _as_str_list(data.get("industry_alternatives"), 3) if a.lower() != industry.lower()],
            "catalogIndustry": str(data.get("catalog_industry") or "").strip() or None,
            "assumptions": _as_str_list(data.get("assumptions")),
        }
    return data


@router.post("/ideate/step", summary="Run one structured Ideate step")
async def ideate_step(body: IdeateStepRequest):
    if body.step not in STEP_PROMPTS:
        return JSONResponse({"error": f"Unknown step '{body.step}'"}, status_code=400)

    system_prompt = build_step_system_prompt(body.step)
    extra = f"CURRENT STEP: {body.idea.get('currentStep', '')}" if body.step == "challenge" else ""
    catalog: Dict[str, str] = {}
    if body.step == "spark":
        catalog = _catalog_industries()
        listing = "\n".join(f"- {k}: {v}" for k, v in catalog.items()) or "(none available)"
        extra = f"CATALOG INDUSTRIES:\n{listing}"
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
        if normalized is not None and body.step == "spark":
            key = normalized.get("catalogIndustry")
            normalized["catalogIndustry"] = key if key in catalog else None
            normalized["catalogIndustryLabel"] = catalog.get(key, "")
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


def _key(text: str, limit: int = 60) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")[:limit] or "use_case"


async def _catalog_template(body: IdeateSubmitRequest) -> str:
    """Use case description in the catalog's format; falls back to the brief if the model is unavailable."""
    parts = [f"APPROVED IDEA CONTEXT:\n{json.dumps(body.idea, ensure_ascii=False, indent=1)[:MAX_CONTEXT_CHARS]}"]
    if body.business_case:
        parts.append(f"BUSINESS CASE FIGURES:\n{json.dumps(body.business_case, ensure_ascii=False, indent=1)}")
    if body.brief:
        parts.append(f"BRIEF:\n{body.brief[:MAX_CONTEXT_CHARS]}")
    result = await call_databricks_serving_endpoint(
        prompt="\n\n".join(parts),
        system_prompt=CATALOG_PROMPT,
        max_tokens=3000,
        temperature=0.4,
    )
    text = (result.get("response") or "").strip()
    if text and not text.startswith("[Error]") and not text.startswith("[Mock Response"):
        return re.sub(r"^```(?:markdown)?\s*|\s*```$", "", text).strip()
    return (body.brief or "").strip()


def _outcome_map_position(schema: str, industry: str, category: Optional[str]) -> Dict[str, Optional[int]]:
    """Column and card order on the industry's outcome map, so the entry lands in the right place when activated."""
    if not category:
        return {"category_order": None, "display_order": None}
    try:
        rows = execute_query(
            f"SELECT category, MAX(category_order) AS co, MAX(display_order) AS dmax FROM {schema}.usecase_descriptions "
            f"WHERE industry = %s AND category IS NOT NULL GROUP BY category",
            (industry,),
        ) or []
    except Exception:
        return {"category_order": None, "display_order": None}
    for r in rows:
        if (r.get("category") or "").lower() == category.lower():
            return {"category_order": r.get("co"), "display_order": int(r.get("dmax") or 0) + 1}
    next_col = max([int(r.get("co") or 0) for r in rows] or [0]) + 1
    return {"category_order": next_col, "display_order": 1}


@router.post("/ideate/submit", summary="Submit a committed idea to the use case catalog (inactive)")
async def ideate_submit(body: IdeateSubmitRequest, request: Request):
    if not is_lakebase_configured():
        return JSONResponse({"error": "The use case catalog isn't reachable from this app right now."}, status_code=503)
    label = body.use_case_label.strip()
    industry_label = body.industry_label.strip()
    if not label or not industry_label:
        return JSONResponse({"error": "Pick an industry and give the use case a name."}, status_code=400)

    schema = get_schema()
    industry = (body.industry or "").strip() or _key(industry_label, 100)
    existing = execute_query(f"SELECT industry_label FROM {schema}.usecase_descriptions WHERE industry = %s LIMIT 1", (industry,))
    if existing:
        industry_label = existing[0].get("industry_label") or industry_label

    taken = {r.get("use_case") for r in execute_query(
        f"SELECT DISTINCT use_case FROM {schema}.usecase_descriptions WHERE industry = %s", (industry,)
    ) or []}
    if body.use_case and body.use_case in taken:
        use_case = body.use_case
    else:
        base = _key(label)
        use_case, n = base, 2
        while use_case in taken:
            use_case, n = f"{base}_{n}", n + 1

    template = await _catalog_template(body)
    if not template:
        return JSONResponse({"error": AI_UNAVAILABLE}, status_code=503)

    version_rows = execute_query(
        f"SELECT COALESCE(MAX(version), 0) AS v FROM {schema}.usecase_descriptions WHERE industry = %s AND use_case = %s",
        (industry, use_case),
    )
    version = int((version_rows or [{}])[0].get("v") or 0) + 1
    user = _get_session_user(request)
    category = (body.category or "").strip() or None
    position = _outcome_map_position(schema, industry, category)

    base_cols = "industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by"
    base_vals = (industry, industry_label, use_case, label, template, version, user)
    ok = execute_insert(
        f"INSERT INTO {schema}.usecase_descriptions ({base_cols}, category, category_order, display_order) "
        f"VALUES (%s, %s, %s, %s, %s, %s, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s, %s, %s, %s)",
        base_vals + (category, position["category_order"], position["display_order"]),
    )
    if not ok:
        ok = execute_insert(
            f"INSERT INTO {schema}.usecase_descriptions ({base_cols}) "
            f"VALUES (%s, %s, %s, %s, %s, %s, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s)",
            base_vals,
        )
    if not ok:
        return JSONResponse({"error": "Couldn't save to the use case catalog. Please try again."}, status_code=500)

    _invalidate_cache()
    logger.info(f"[Ideate] Submitted {industry}/{use_case} v{version} (inactive) by {user}")
    return {"industry": industry, "industryLabel": industry_label, "useCase": use_case, "useCaseLabel": label, "version": version}
