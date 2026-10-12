"""
Fit an idea to an industry data model the way an analyst would: list the data
the use case depends on, map each need to the model's areas and tables (or call
it a gap), then choose the areas a Genie should cover.

The model only sees ids from the digest and every id it returns is checked
against the digest, so it can't invent tables. The browser shows a word-based
pick first and swaps in this one when it arrives; a failure here leaves that
pick in place.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.backend.api.blueprints import _cache_get, _cache_put, _guard, _manifest, load_digest

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_CONTEXT_CHARS = 8000
MAX_QUESTIONS = 8
MIN_AREAS, MAX_AREAS = 2, 6
MAX_NEEDS = 8
MAX_TABLES_PER_NEED = 4
CACHE_TTL_S = 12 * 3600
LLM_TIMEOUT_S = 120
ROLES = {"core", "supporting"}
FITS = {"strong", "partial", "weak"}

FIT_PROMPT = """You are a senior data analyst. You match a business use case to an industry data model so a Genie space can answer the team's questions.

Work in this order:
1. NEEDS: list the 4 to 8 kinds of data the use case depends on. Name each in under 8 words (e.g. "Ground staff shifts and overtime"), with its grain (e.g. "per flight per departure bank") and whether it is a "must" or "nice". Think about the decisions in the use case, not only the words in the questions.
2. MAPPING: for each need, name the areas and up to 4 table ids that hold it. If the model has nothing for it, leave areas and tables empty and say in "gap" what is missing and what to bring instead, in one short sentence.
3. AREAS: choose 2 to 6 areas. "core" areas hold the must needs; "supporting" areas add a join the needs require (e.g. airport for gates). Prefer fewer, more relevant areas. Each gets a "why" of under 15 words in the user's language.
4. QUESTIONS: for each numbered question, the single best KPI id from the list, or null when no KPI answers it.
5. FIT: "strong" when every must need is covered, "partial" when some are, "weak" when the model is a poor match. Add a one-sentence "summary".

Rules:
- Use only area names, table ids, and KPI ids that appear in the MODEL catalog. Never invent ids.
- Do not pick an area just because a question mentions money; finance belongs only if a need is about cost or revenue records.

Return ONLY a JSON object:
{"needs": [{"need": "Crew roster vs positions", "grain": "per station per shift", "importance": "must", "areas": ["crew"], "tables": ["crew.crew_roster"], "gap": ""}],
 "areas": [{"name": "crew", "role": "core", "why": "Who is rostered for each bank"}],
 "questions": [{"index": 0, "kpi": "crew_utilization"}],
 "fit": "partial",
 "summary": "..."}"""

PICK_PROMPT = """You choose the industry data model that best fits a business use case. Pick the model whose tables would hold the data the use case depends on, not just the industry name it mentions.
Return ONLY a JSON object: {"slug": "<one slug from the list>", "why": "<under 20 words>"}"""


class FitRequest(BaseModel):
    context: str = ""
    questions: List[str] = []
    flavour: str = "mvm"


class PickRequest(BaseModel):
    context: str = ""


def catalog_of(digest: Dict[str, Any]) -> Dict[str, Any]:
    """The compact view the model reasons over: areas with their tables, and KPI sets."""
    tables_by_area: Dict[str, List[List[str]]] = {}
    for t in digest.get("tables") or []:
        tables_by_area.setdefault(t.get("area", ""), []).append([t["id"], t.get("label", ""), (t.get("purpose") or "")[:70]])
    return {
        "model": digest.get("label", ""),
        "areas": [
            {
                "name": a["name"],
                "label": a.get("label", ""),
                "about": (a.get("description") or "")[:160],
                "tables": tables_by_area.get(a["name"], []),
            }
            for a in digest.get("areas") or []
        ],
        "kpis": [[k["id"], k.get("label", ""), k.get("area", "")] for k in digest.get("kpis") or []],
    }


def _text(v: Any, limit: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:limit]


def _short(v: Any, limit: int) -> str:
    """Cut at a word boundary with an ellipsis instead of mid-word."""
    text = _text(v, 10_000)
    if len(text) <= limit:
        return text
    return text[:limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:(-") + "…"


def _neighbour(area: str, digest: Dict[str, Any], taken: set) -> Optional[str]:
    links = sorted(
        (l for l in digest.get("links") or [] if area in (l.get("a"), l.get("b"))),
        key=lambda l: -(l.get("n") or 0),
    )
    for l in links:
        other = l["b"] if l["a"] == area else l["a"]
        if other not in taken:
            return other
    return None


def normalize_fit(raw: Any, digest: Dict[str, Any], n_questions: int) -> Optional[Dict[str, Any]]:
    """Keep only ids the digest has; None when nothing usable is left."""
    if not isinstance(raw, dict):
        return None
    area_names = {a["name"] for a in digest.get("areas") or []}
    table_area = {t["id"]: t.get("area") for t in digest.get("tables") or []}
    kpi_ids = {k["id"] for k in digest.get("kpis") or []}

    needs = []
    for n in (raw.get("needs") or [])[:MAX_NEEDS]:
        if not isinstance(n, dict) or not _text(n.get("need"), 80):
            continue
        tables = [t for t in dict.fromkeys(n.get("tables") or []) if t in table_area][:MAX_TABLES_PER_NEED]
        areas = [a for a in dict.fromkeys(n.get("areas") or []) if a in area_names]
        areas += [table_area[t] for t in tables if table_area[t] not in areas]
        gap = _short(n.get("gap"), 200)
        if not areas and not gap:
            gap = "Not found in this model."
        needs.append({
            "need": _short(n.get("need"), 80),
            "grain": _short(n.get("grain"), 60),
            "importance": "nice" if str(n.get("importance", "")).lower() == "nice" else "must",
            "areas": areas,
            "tables": tables,
            "gap": "" if areas else gap,
        })

    areas: List[Dict[str, str]] = []
    for a in raw.get("areas") or []:
        name = a.get("name") if isinstance(a, dict) else None
        if name in area_names and all(x["name"] != name for x in areas) and len(areas) < MAX_AREAS:
            role = str(a.get("role", "")).lower()
            areas.append({"name": name, "role": role if role in ROLES else "core", "why": _short(a.get("why"), 120)})
    for n in needs:
        if n["importance"] != "must":
            continue
        for name in n["areas"]:
            if len(areas) < MAX_AREAS and all(x["name"] != name for x in areas):
                areas.append({"name": name, "role": "core", "why": f"Holds {n['need'].lower()}"})
    if not areas:
        return None
    while len(areas) < MIN_AREAS:
        extra = _neighbour(areas[0]["name"], digest, {x["name"] for x in areas})
        if not extra:
            break
        areas.append({"name": extra, "role": "supporting", "why": "Most connected to your core area"})

    questions = []
    for q in raw.get("questions") or []:
        if not isinstance(q, dict):
            continue
        try:
            i = int(q.get("index"))
        except (TypeError, ValueError):
            continue
        if 0 <= i < n_questions and all(x["index"] != i for x in questions):
            kpi = q.get("kpi")
            questions.append({"index": i, "kpi": kpi if kpi in kpi_ids else None})

    fit = str(raw.get("fit", "")).lower()
    return {
        "needs": needs,
        "areas": areas,
        "questions": sorted(questions, key=lambda x: x["index"]),
        "fit": fit if fit in FITS else "partial",
        "summary": _short(raw.get("summary"), 280),
    }


def cache_key(prefix: str, *parts: str) -> str:
    return f"{prefix}:" + hashlib.sha256("\u0001".join(parts).encode("utf-8")).hexdigest()[:32]


def _parse(text: str) -> Optional[Dict[str, Any]]:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        out = json.loads(m.group(0), strict=False)
    except ValueError:
        return None
    return out if isinstance(out, dict) else None


async def _ask(system_prompt: str, prompt: str, max_tokens: int) -> Dict[str, Any]:
    from src.backend.api.routes import call_databricks_serving_endpoint, resolve_endpoint
    analysis = os.getenv("IDEATE_ANALYSIS_ENDPOINT", "").strip()
    endpoint = await asyncio.to_thread(resolve_endpoint, analysis) if analysis else None
    result = await asyncio.wait_for(
        call_databricks_serving_endpoint(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=0.2,
            endpoint_name=endpoint,
        ),
        timeout=LLM_TIMEOUT_S,
    )
    text = (result.get("response") or "").strip()
    if not text or text.startswith("[Error]") or text.startswith("[Mock Response"):
        raise HTTPException(status_code=503, detail="The AI is not available right now.")
    return {"text": text, "model": result.get("model") or ""}


@router.post("/blueprints/{slug}/fit", summary="Match an idea to a model's areas and tables")
async def blueprint_fit(slug: str, body: FitRequest):
    _guard()
    digest = await load_digest(slug, body.flavour)
    context = _text(body.context, MAX_CONTEXT_CHARS)
    questions = [_text(q, 200) for q in body.questions if _text(q, 200)][:MAX_QUESTIONS]
    if not context and not questions:
        raise HTTPException(status_code=400, detail="Describe the use case or add a question.")
    key = cache_key("fit", slug, digest.get("version", ""), body.flavour, context, *questions)
    hit = _cache_get(key, CACHE_TTL_S)
    if hit is not None:
        return hit

    prompt = "\n\n".join([
        f"USE CASE:\n{context or '(only the questions below)'}",
        "QUESTIONS:\n" + ("\n".join(f"{i}. {q}" for i, q in enumerate(questions)) or "(none)"),
        "MODEL:\n" + json.dumps(catalog_of(digest), separators=(",", ":")),
    ])
    note = ""
    for attempt in range(2):
        try:
            reply = await _ask(FIT_PROMPT, prompt + note, 8000)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Matching took too long.")
        fit = normalize_fit(_parse(reply["text"]), digest, len(questions))
        if fit:
            out = {**fit, "slug": slug, "model": reply["model"]}
            return _cache_put(key, out)
        logger.warning(f"[BlueprintFit] unusable reply for {slug} on attempt {attempt + 1}")
        note = "\n\nYour previous reply was not valid JSON or used ids that are not in MODEL. Return ONLY the JSON object, using ids exactly as listed."
    raise HTTPException(status_code=502, detail="Could not match the use case to this model.")


@router.post("/blueprints/pick", summary="The gallery model that best fits an idea")
async def blueprint_pick(body: PickRequest):
    _guard()
    context = _text(body.context, MAX_CONTEXT_CHARS)
    if not context:
        raise HTTPException(status_code=400, detail="Describe the use case.")
    manifest, sha, _ = await _manifest()
    models = {i["slug"]: i.get("label", i["slug"]) for i in manifest.get("industries") or []}
    key = cache_key("pick", sha, context)
    hit = _cache_get(key, CACHE_TTL_S)
    if hit is not None:
        return hit
    listing = "\n".join(f"- {s}: {label}" for s, label in models.items())
    try:
        reply = await _ask(PICK_PROMPT, f"USE CASE:\n{context}\n\nMODELS:\n{listing}", 2000)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Matching took too long.")
    raw = _parse(reply["text"]) or {}
    slug = raw.get("slug")
    if slug not in models:
        raise HTTPException(status_code=502, detail="Could not pick a model.")
    return _cache_put(key, {"slug": slug, "label": models[slug], "why": _text(raw.get("why"), 160)})
