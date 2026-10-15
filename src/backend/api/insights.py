"""
Insights view helpers: turn an approved workshop use case into an analyst preview.

Questions come from the use case itself when it has them (the "Ask It in Genie"
section, then any quoted questions); only otherwise are they suggested by the
model, and the response says which.
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_QUESTIONS = 4
LLM_TIMEOUT_S = 20
_CACHE_TTL_S = 6 * 3600
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")

SUGGEST_PROMPT = (
    "You write questions a business analyst would type into a Databricks Genie space. "
    "Given a use case description, return ONLY a JSON array of 4 short, specific questions "
    "(under 15 words each) that can be answered from the data the use case describes. "
    "Plain business language, no technical terms, no numbering."
)


def _enabled() -> bool:
    v = (os.getenv("INSIGHTS_USECASES_ENABLED") or "").strip().lower()
    return v in ("", "1", "true", "yes", "on")


def _clean(text: str) -> str:
    return re.sub(r"\*\*?|`", "", text).strip()


def _section(template: str, title: str) -> str:
    m = re.search(rf"^##+\s*{re.escape(title)}\s*$(.*?)(?=^##\s|\Z)", template, re.M | re.S)
    return m.group(1) if m else ""


def _quoted_questions(text: str) -> List[str]:
    seen: List[str] = []
    for q in re.findall(r"[\"\u201c]([^\"\u201d\n]{12,160}\?)[\"\u201d]", text):
        q = _clean(q)
        if q and q not in seen:
            seen.append(q)
    return seen


def parse_template(template: str) -> Dict[str, Any]:
    lines = [ln for ln in template.splitlines() if ln.strip()]
    summary = ""
    for ln in lines:
        if not ln.lstrip().startswith("#"):
            summary = _clean(ln)
            break
    if len(summary) > 320:
        summary = summary[:317].rsplit(" ", 1)[0] + "..."

    personas = []
    for m in re.finditer(r"^-\s*\*\*([^*]{2,60})\*\*\s*:\s*(.+)$", _section(template, "Key Personas"), re.M):
        personas.append({"name": _clean(m.group(1)), "role": _clean(m.group(2))[:160]})

    ent = re.search(r"Core entities:\s*(.+)", template)
    entities = [e.strip(" .") for e in ent.group(1).split(",") if e.strip(" .")] if ent else []

    capabilities = [
        _clean(m.group(1))
        for m in re.finditer(r"^###+\s*\d+\.\s*(.+)$", template, re.M)
    ][:6]

    genie = _quoted_questions(_section(template, "Ask It in Genie"))
    if genie:
        questions, source = genie, "use_case_genie"
    else:
        questions = _quoted_questions(template)
        source = "use_case_text" if questions else "none"

    return {
        "summary": summary,
        "personas": personas[:4],
        "entities": entities[:16],
        "capabilities": capabilities,
        "questions": questions[:MAX_QUESTIONS],
        "questionSource": source,
    }


async def _suggest(template: str) -> List[str]:
    try:
        from src.backend.api.routes import call_databricks_serving_endpoint
    except Exception:
        return []
    try:
        result = await asyncio.wait_for(
            call_databricks_serving_endpoint(
                prompt=f"USE CASE:\n{template[:6000]}",
                system_prompt=SUGGEST_PROMPT,
                max_tokens=400,
                temperature=0.3,
            ),
            timeout=LLM_TIMEOUT_S,
        )
    except Exception as e:
        logger.info("[Insights] question suggestion unavailable: %s", e)
        return []
    text = (result.get("response") or "").strip()
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        return []
    try:
        items = json.loads(m.group(0), strict=False)
    except Exception:
        return []
    out = []
    for q in items:
        if isinstance(q, str) and 8 <= len(q.strip()) <= 160:
            q = _clean(q)
            out.append(q if q.endswith("?") else f"{q}?")
    return out[:MAX_QUESTIONS]


def _template_for(industry: str, use_case: str) -> Optional[str]:
    from src.backend.api.routes import get_prompt_templates_map
    return (get_prompt_templates_map() or {}).get(industry, {}).get(use_case)


@router.get("/insights/use-case/{industry}/{use_case}", summary="Analyst preview of an approved use case")
async def use_case_preview(industry: str, use_case: str):
    if not _enabled():
        raise HTTPException(status_code=404, detail="Approved use cases are turned off in Insights")
    if not _ID_RE.match(industry) or not _ID_RE.match(use_case):
        raise HTTPException(status_code=400, detail="Invalid id")

    template = await asyncio.to_thread(_template_for, industry, use_case)
    if not template:
        raise HTTPException(status_code=404, detail="Use case not found")

    key = f"{industry}/{use_case}/{hash(template)}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < _CACHE_TTL_S:
        return hit[1]

    from src.backend.api.value_profiles import profile_for

    preview = parse_template(template)
    suggested, profile = await asyncio.gather(
        _suggest(template) if not preview["questions"] else asyncio.sleep(0, result=[]),
        profile_for(industry, use_case, template),
    )
    if suggested:
        preview["questions"] = suggested
        preview["questionSource"] = "suggested"
    preview["valueProfile"] = profile
    preview.update({"industry": industry, "useCase": use_case})
    if preview["questionSource"] != "none":
        _cache[key] = (time.time(), preview)
    return preview
