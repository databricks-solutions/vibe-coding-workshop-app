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
MAX_JOINS = 300
CACHE_TTL_S = 12 * 3600
LLM_TIMEOUT_S = 120
ROLES = {"core", "supporting"}
FITS = {"strong", "partial", "weak"}

FIT_PROMPT = """You are a senior data analyst. You match a business use case to an industry data model so a Genie space can answer the team's questions.

MODEL lists each area with its tables as [id, label, what it holds], the KPI sets, and JOINS: every link between tables in different areas as [from_table, to_table, via column].

Work in this order:
1. NEEDS: list the 4 to 8 kinds of data the use case depends on. Name each in under 8 words (e.g. "Store shelf stock by day"), with its grain (e.g. "per store per SKU per day") and whether it is a "must" or "nice". Think about the decisions in the use case, not only the words in the questions. The records of whatever the users act on (the patients they call, the stores they restock, the gates they staff) are always a must.
2. MAPPING: for each need, name the areas and up to 4 table ids whose descriptions show they hold it. If no table holds it, leave areas and tables empty and say in "gap" what is missing and what to bring instead, in one short sentence.
3. AREAS: choose 2 to 6 areas that form one connected group through JOINS. "core" areas hold must needs; "supporting" areas are only there for a join the needs require. For each area give a "why" under 15 words and a "join": one [from_table, to_table] pair copied from JOINS that links it to another chosen area. Every area holding a must need is chosen; leave out areas that are only loosely related.
4. SKIPPED: for each area in SUGGESTED AREAS that you did not choose, a "why" under 15 words saying what its tables actually hold.
5. QUESTIONS: for each numbered question, the single best KPI id from the list, or null when no KPI answers it.
6. FIT: "strong" when every must need is covered, "partial" when some are, "weak" when the model is a poor match. Add a one-sentence "summary".

Rules:
- Judge an area by its tables, never by its name. An area named like a word in the use case may hold a different kind of thing (a "crew" area may hold only flight crew, not ground staff; an "account" area may hold ledger accounts, not customers).
- Use only area names, table ids, KPI ids and joins that appear in MODEL. Never invent them.
- Do not pick an area just because a question mentions money; finance belongs only if a need is about cost or revenue records.
- Write every text field (need, grain, gap, why, summary) in the language the USE CASE is written in; use English when unsure.

Return ONLY a JSON object:
{"needs": [{"need": "Store shelf stock by day", "grain": "per store per SKU per day", "importance": "must", "areas": ["inventory"], "tables": ["inventory.stock_snapshot"], "gap": ""}],
 "areas": [{"name": "inventory", "role": "core", "why": "Daily stock on hand per store and SKU", "join": ["inventory.stock_snapshot", "store.store"]}],
 "skipped": [{"name": "customer", "why": "Loyalty members and profiles, nothing about stock"}],
 "questions": [{"index": 0, "kpi": "stock_availability"}],
 "fit": "partial",
 "summary": "..."}"""

PICK_PROMPT = """You choose the industry data model that best fits a business use case. Pick the model whose tables would hold the data the use case depends on, not just the industry name it mentions.
Return ONLY a JSON object: {"slug": "<one slug from the list>", "why": "<under 20 words>"}"""


class FitRequest(BaseModel):
    context: str = ""
    questions: List[str] = []
    flavour: str = "mvm"
    # The browser's quick word-based pick; the AI explains any of these it leaves out.
    suggested: List[str] = []


class PickRequest(BaseModel):
    context: str = ""


def joins_of(digest: Dict[str, Any]) -> List[List[str]]:
    """Every cross-area table link as [from_table, to_table, via], busiest area pairs first."""
    area_of = {t["id"]: t.get("area", "") for t in digest.get("tables") or []}
    weight = {frozenset((l.get("a"), l.get("b"))): l.get("n") or 0 for l in digest.get("links") or []}
    seen: Dict[Any, List[str]] = {}
    for t in digest.get("tables") or []:
        for ln in t.get("linksTo") or []:
            to = ln.get("to")
            if to not in area_of or area_of[to] == area_of[t["id"]] or (t["id"], to) in seen:
                continue
            seen[(t["id"], to)] = [t["id"], to, ln.get("via", "")]
    return sorted(seen.values(), key=lambda j: (-weight.get(frozenset((area_of[j[0]], area_of[j[1]])), 0), j[0], j[1]))


def catalog_of(digest: Dict[str, Any]) -> Dict[str, Any]:
    """The compact view the model reasons over: areas with their tables, KPI sets, and cross-area joins."""
    tables_by_area: Dict[str, List[List[str]]] = {}
    for t in digest.get("tables") or []:
        tables_by_area.setdefault(t.get("area", ""), []).append([t["id"], t.get("label", ""), _short(t.get("purpose"), 160)])
    return {
        "model": digest.get("label", ""),
        "areas": [
            {
                "name": a["name"],
                "label": a.get("label", ""),
                "about": _short(a.get("description"), 300),
                "tables": tables_by_area.get(a["name"], []),
            }
            for a in digest.get("areas") or []
        ],
        "kpis": [[k["id"], k.get("label", ""), k.get("area", "")] for k in digest.get("kpis") or []],
        "joins": joins_of(digest)[:MAX_JOINS],
    }


def _text(v: Any, limit: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:limit]


def _short(v: Any, limit: int) -> str:
    """Cut at a word boundary with an ellipsis instead of mid-word."""
    text = _text(v, 10_000)
    if len(text) <= limit:
        return text
    return text[:limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:(-") + "…"


def _adjacency(digest: Dict[str, Any]) -> Dict[str, Dict[str, int]]:
    adj: Dict[str, Dict[str, int]] = {}
    for l in digest.get("links") or []:
        a, b, n = l.get("a"), l.get("b"), l.get("n") or 0
        if a and b and a != b and n > 0:
            adj.setdefault(a, {})[b] = n
            adj.setdefault(b, {})[a] = n
    return adj


def _groups(names: List[str], adj: Dict[str, Dict[str, int]]) -> List[set]:
    """Connected groups among the chosen areas, using only links between chosen areas."""
    left, groups = list(names), []
    while left:
        stack = [left.pop(0)]
        group = set(stack)
        while stack:
            for other in adj.get(stack.pop(), {}):
                if other in left:
                    left.remove(other)
                    group.add(other)
                    stack.append(other)
        groups.append(group)
    return groups


def _connect(areas: List[Dict[str, Any]], digest: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Drop supporting areas that join nothing chosen, then bridge separate groups when one area can."""
    adj = _adjacency(digest)
    while len(areas) > 1:
        names = {a["name"] for a in areas}
        loose = next((a for a in areas if a["role"] == "supporting" and not names & set(adj.get(a["name"], {}))), None)
        if not loose:
            break
        areas = [a for a in areas if a is not loose]
    labels = {a["name"]: a.get("label") or a["name"] for a in digest.get("areas") or []}
    while len(areas) < MAX_AREAS:
        groups = _groups([a["name"] for a in areas], adj)
        if len(groups) < 2:
            break
        chosen = set().union(*groups)
        best = None
        for cand, nbrs in adj.items():
            if cand in chosen:
                continue
            touched = [g for g in groups if g & set(nbrs)]
            if len(touched) < 2:
                continue
            score = (len(touched), sum(n for o, n in nbrs.items() if o in chosen))
            if not best or score > best[0]:
                best = (score, cand, touched)
        if not best:
            break
        _, cand, touched = best
        ends = [max((o for o in g if o in adj[cand]), key=lambda o: adj[cand][o]) for g in touched[:2]]
        areas.append({"name": cand, "role": "supporting", "why": f"Connects {labels.get(ends[0], ends[0])} and {labels.get(ends[1], ends[1])}"})
    return areas


def _attach_joins(areas: List[Dict[str, Any]], raw_joins: Dict[str, Any], digest: Dict[str, Any]) -> None:
    """Each area keeps the join the AI named if it is real and reaches another chosen area, else the busiest one that does."""
    area_of = {t["id"]: t.get("area", "") for t in digest.get("tables") or []}
    joins = joins_of(digest)
    real = {frozenset(j[:2]) for j in joins}
    roles = {a["name"]: a["role"] for a in areas}

    def reaches(pair: List[str], name: str) -> bool:
        sides = [area_of.get(p) for p in pair]
        return name in sides and any(s in roles and s != name for s in sides)

    for a in areas:
        claimed = raw_joins.get(a["name"])
        if isinstance(claimed, list) and len(claimed) == 2 and frozenset(claimed) in real and reaches(claimed, a["name"]):
            a["join"] = [str(claimed[0]), str(claimed[1])]
            continue
        options = [j[:2] for j in joins if reaches(j[:2], a["name"])]
        options.sort(key=lambda j: roles.get(next(area_of[p] for p in j if area_of[p] != a["name"])) != "core")
        if options:
            a["join"] = options[0]


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

    areas: List[Dict[str, Any]] = []
    raw_joins: Dict[str, Any] = {}
    for a in raw.get("areas") or []:
        name = a.get("name") if isinstance(a, dict) else None
        if name in area_names and all(x["name"] != name for x in areas) and len(areas) < MAX_AREAS:
            role = str(a.get("role", "")).lower()
            areas.append({"name": name, "role": role if role in ROLES else "core", "why": _short(a.get("why"), 120)})
            raw_joins[name] = a.get("join")
    for n in needs:
        if n["importance"] != "must":
            continue
        for name in n["areas"]:
            if len(areas) < MAX_AREAS and all(x["name"] != name for x in areas):
                areas.append({"name": name, "role": "core", "why": f"Holds {n['need'].lower()}"})
    if not areas:
        return None
    areas = _connect(areas, digest)
    while len(areas) < MIN_AREAS:
        extra = _neighbour(areas[0]["name"], digest, {x["name"] for x in areas})
        if not extra:
            break
        areas.append({"name": extra, "role": "supporting", "why": "Most connected to your core area"})
    _attach_joins(areas, raw_joins, digest)

    chosen = {a["name"] for a in areas}
    skipped: List[Dict[str, str]] = []
    for s in raw.get("skipped") or []:
        name = s.get("name") if isinstance(s, dict) else None
        why = _short(s.get("why"), 120) if name else ""
        if name in area_names and name not in chosen and why and all(x["name"] != name for x in skipped) and len(skipped) < MAX_AREAS:
            skipped.append({"name": name, "why": why})

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
        "skipped": skipped,
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
            temperature=0,
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
    area_names = {a["name"] for a in digest.get("areas") or []}
    suggested = sorted({s for s in body.suggested if s in area_names})
    sha = (digest.get("source") or {}).get("commitSha", "")
    key = cache_key("fit2", slug, digest.get("version", ""), sha, body.flavour, context, ",".join(suggested), *questions)
    hit = _cache_get(key, CACHE_TTL_S)
    if hit is not None:
        return hit

    prompt = "\n\n".join([
        f"USE CASE:\n{context or '(only the questions below)'}",
        "QUESTIONS:\n" + ("\n".join(f"{i}. {q}" for i, q in enumerate(questions)) or "(none)"),
        "SUGGESTED AREAS:\n" + (", ".join(suggested) or "(none)"),
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
