"""Approved data sources for the Insights flow.

Admins list certified Unity Catalog schemas in the `approved_data_sources`
workshop parameter. This router reads those schemas live from Unity Catalog and
turns them into the same digest shape the industry data model explorer uses
(areas, tables, joins, KPIs, starter questions), so the browser can show them
with the same screens.

Areas and proposed KPIs come from one LLM call per schema. Every table and
column it names is checked against Unity Catalog, so it can't invent data.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.backend.api.blueprint_fit import (
    CACHE_TTL_S, FIT_PROMPT, MAX_CONTEXT_CHARS, MAX_QUESTIONS, _ask, _parse, _short, _text, cache_key, catalog_of, normalize_fit,
)
from src.backend.api.blueprints import (
    _cache_get, _cache_put, _client, _friendly_type, _gzip_json, _humanize, _measure_score,
    _slice_kind, _slice_score, _workspace_host, best_recipe,
)

logger = logging.getLogger(__name__)
router = APIRouter()

PARAM_KEY = "approved_data_sources"
DEFAULT_SOURCES = [{"catalog": "samples", "schema": "wanderbricks", "label": "Wanderbricks (sample)"}]
MAX_SOURCES = 4
MAX_TABLES = 80
MAX_AREAS = 6
MAX_PROPOSED_KPIS = 12
LIST_TTL_S = 600
DIGEST_TTL_S = 1800
ENRICH_TIMEOUT_S = 90

_IDENT = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\-]{0,127}$")
_AREA = re.compile(r"[^a-z0-9_]+")
_SENSITIVE = re.compile(r"email|phone|ssn|social_security|birth|address|passport|credit_card|card_number|iban", re.I)
_DATEISH = re.compile(r"DATE|TIMESTAMP")
_NUMERIC = re.compile(r"^(DECIMAL|DOUBLE|FLOAT|INT|BIGINT|SMALLINT|TINYINT|LONG|SHORT|BYTE)")

# Areas and proposed KPIs stay the same between visits until the schema itself changes.
_ENRICH: Dict[str, Dict[str, Any]] = {}
_LOCKS: Dict[str, asyncio.Lock] = {}

ENRICH_PROMPT = """You are a senior data analyst describing a team's own Unity Catalog schema so business users can explore it.

TABLES lists each table as {"name", "about", "columns": [[column, type, comment]]}.

1. AREAS: group every table into 2 to 6 business areas (one area only when there are fewer than 4 tables). Each area has a short snake_case "name", a human "label", a one-sentence "description", and its "tables". Every table belongs to exactly one area. Group by what the rows are about (bookings, properties, customers, payments), never alphabetically.
2. KPIS: propose up to 12 KPIs a business team would track with these tables. Each has a snake_case "id", its "area", its base "table", a "label", a one-sentence "description", 1 to 4 "measures" and 1 to 5 "slices".
   - A measure is {"name", "label", "agg": "sum" | "avg" | "count" | "count_distinct" | "min" | "max", "column", "comment"}. Use "*" as column only with "count".
   - A slice is {"name", "label", "column", "kind": "time" | "flag" | "category", "comment"}. Time slices use date or timestamp columns.
   - Measures and slices use columns of the base table only. Prefer amounts, counts of events, durations and rates over ids.
3. DESCRIPTION: one sentence about what the whole schema holds.

Use only table and column names exactly as listed. Return ONLY a JSON object:
{"description": "...", "areas": [{"name": "bookings", "label": "Bookings", "description": "...", "tables": ["bookings", "payments"]}],
 "kpis": [{"id": "booking_revenue", "area": "bookings", "table": "bookings", "label": "Booking revenue", "description": "...",
   "measures": [{"name": "total_revenue", "label": "Total revenue", "agg": "sum", "column": "total_amount", "comment": "..."}],
   "slices": [{"name": "check_in_month", "label": "Check-in month", "column": "check_in", "kind": "time", "comment": "..."}]}]}"""

SOURCE_FIT_NOTE = """

This MODEL is the team's own governed tables in Unity Catalog, not an industry model. KPIs marked as proposed do not exist yet; Genie Code creates them.
For each entry in "questions" also return "tables": up to 3 table ids from MODEL that answer it, and "how": under 20 words on how they answer it (for example "Sum booking amounts by check-in month, joined to properties for city")."""


# --------------------------------------------------------------------------------------
# approved list
# --------------------------------------------------------------------------------------

def parse_sources(raw: Any) -> List[Dict[str, str]]:
    """The approved list as clean {catalog, schema, label, note} rows; bad rows are dropped."""
    try:
        items = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return []
    out: List[Dict[str, str]] = []
    seen = set()
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        cat, sch = str(it.get("catalog") or "").strip(), str(it.get("schema") or "").strip()
        if not (_IDENT.match(cat) and _IDENT.match(sch)) or f"{cat}.{sch}" in seen:
            continue
        seen.add(f"{cat}.{sch}")
        out.append({
            "catalog": cat,
            "schema": sch,
            "label": _text(it.get("label"), 80) or f"{cat}.{sch}",
            "note": _text(it.get("note"), 200),
        })
    return out


def _approved_sync() -> List[Dict[str, str]]:
    try:
        from src.backend.api.routes import get_workshop_parameters_sync
        raw = get_workshop_parameters_sync().get(PARAM_KEY)
    except Exception as e:
        logger.warning(f"[DataSources] could not read {PARAM_KEY}: {e}")
        raw = None
    return parse_sources(raw) if raw is not None else parse_sources(DEFAULT_SOURCES)


def split_source(value: str) -> Tuple[str, str]:
    parts = (value or "").strip().split(".")
    if len(parts) != 2 or not all(_IDENT.match(p) for p in parts):
        raise HTTPException(status_code=400, detail=f"Not a catalog.schema name: {value[:80]}")
    return parts[0], parts[1]


# --------------------------------------------------------------------------------------
# Unity Catalog reads
# --------------------------------------------------------------------------------------

def _enum(v: Any) -> str:
    return str(getattr(v, "value", v) or "")


def table_record(t: Any) -> Dict[str, Any]:
    """A TableInfo as a plain dict, so digest building is testable without the SDK."""
    pks: List[str] = []
    fks: List[Dict[str, Any]] = []
    for c in getattr(t, "table_constraints", None) or []:
        pk = getattr(c, "primary_key_constraint", None)
        if pk:
            pks.extend(pk.child_columns or [])
        fk = getattr(c, "foreign_key_constraint", None)
        if fk:
            fks.append({"columns": list(fk.child_columns or []), "parent": fk.parent_table or "", "parentColumns": list(fk.parent_columns or [])})
    return {
        "name": t.name or "",
        "comment": t.comment or "",
        "type": _enum(getattr(t, "table_type", "")),
        "viewDefinition": getattr(t, "view_definition", None) or "",
        "columns": [
            {"name": c.name or "", "type": (c.type_text or _enum(c.type_name) or "").upper(), "comment": c.comment or ""}
            for c in (t.columns or [])
        ],
        "pks": pks,
        "fks": fks,
    }


def _list_tables_sync(catalog: str, schema: str, columns: bool = True) -> List[Dict[str, Any]]:
    w = _client()
    out = []
    for t in w.tables.list(catalog, schema, omit_columns=not columns, omit_properties=True, max_results=MAX_TABLES + 20):
        out.append(table_record(t))
        if len(out) >= MAX_TABLES + 20:
            break
    return out


_HIDDEN_CATALOGS = {"system", "__databricks_internal", "hive_metastore"}
_HIDDEN_SCHEMAS = {"information_schema"}


def _named(items: Any, hidden: set) -> List[Dict[str, str]]:
    """Visible {name, comment} rows, sorted by name; hidden and internal names dropped."""
    out = []
    for it in items:
        name = getattr(it, "name", None) or ""
        if not name or name.lower() in hidden or name.startswith("__"):
            continue
        out.append({"name": name, "comment": _short(getattr(it, "comment", None) or "", 160)})
    return sorted(out, key=lambda r: r["name"].lower())


def _list_catalogs_sync() -> List[Dict[str, str]]:
    return _named(_client().catalogs.list(max_results=1000), _HIDDEN_CATALOGS)


def _list_schemas_sync(catalog: str) -> List[Dict[str, str]]:
    return _named(_client().schemas.list(catalog_name=catalog, max_results=1000), _HIDDEN_SCHEMAS)


async def _source_summary(src: Dict[str, str]) -> Dict[str, Any]:
    key = f"ds-list:{src['catalog']}.{src['schema']}"
    hit = _cache_get(key, LIST_TTL_S)
    if hit is None:
        try:
            rows = await asyncio.to_thread(_list_tables_sync, src["catalog"], src["schema"], False)
            tables = [{"name": r["name"], "comment": _short(r["comment"], 160)} for r in rows if r["type"] != "METRIC_VIEW"]
            metric_views = sum(1 for r in rows if r["type"] == "METRIC_VIEW")
            hit = _cache_put(key, {"readable": True, "tableCount": len(tables), "metricViews": metric_views, "tables": tables[:MAX_TABLES], "error": ""})
        except Exception as e:
            # Not cached, so a fixed grant shows up on the next visit.
            hit = {"readable": False, "tableCount": 0, "metricViews": 0, "tables": [], "error": _short(str(e), 200)}
    return {**src, "id": f"{src['catalog']}.{src['schema']}", **hit}


# --------------------------------------------------------------------------------------
# digest
# --------------------------------------------------------------------------------------

def _singular(name: str) -> List[str]:
    n = name.lower()
    out = [n]
    if n.endswith("ies"):
        out.append(n[:-3] + "y")
    if n.endswith("es"):
        out.append(n[:-2])
    if n.endswith("s"):
        out.append(n[:-1])
    return out


def infer_links(tables: List[Dict[str, Any]]) -> Dict[str, List[Tuple[str, str]]]:
    """name -> [(column, target table name)]: declared foreign keys, else `x_id` columns that match a table `x`."""
    by_name = {t["name"].lower(): t for t in tables}
    owner: Dict[str, str] = {}
    for t in tables:
        for s in _singular(t["name"]):
            owner.setdefault(f"{s}_id", t["name"])
            owner.setdefault(f"{s}_key", t["name"])
    links: Dict[str, List[Tuple[str, str]]] = {}
    for t in tables:
        found: List[Tuple[str, str]] = []
        declared = False
        for fk in t.get("fks") or []:
            parent = (fk.get("parent") or "").split(".")[-1].lower()
            if parent in by_name and fk.get("columns"):
                found.append((fk["columns"][0], by_name[parent]["name"]))
                declared = True
        if not declared:
            for c in t["columns"]:
                cn = c["name"].lower()
                target = owner.get(cn)
                if not target or target == t["name"]:
                    continue
                tcols = {x["name"].lower() for x in by_name[target.lower()]["columns"]}
                if cn in tcols or "id" in tcols:
                    found.append((c["name"], target))
        links[t["name"]] = found
    return links


def _pk_columns(t: Dict[str, Any]) -> List[str]:
    if t.get("pks"):
        return list(t["pks"])
    names = {c["name"].lower(): c["name"] for c in t["columns"]}
    for s in _singular(t["name"]):
        if f"{s}_id" in names:
            return [names[f"{s}_id"]]
    return [names["id"]] if "id" in names else []


def _table_kind(t: Dict[str, Any], n_links: int) -> str:
    cols = t["columns"]
    has_time = any(_DATEISH.search(c["type"]) for c in cols)
    if n_links >= 2 and len(cols) <= n_links + 3:
        return "link"
    if has_time and n_links >= 1:
        return "event"
    if len(cols) <= 4 and not has_time:
        return "lookup"
    return "thing"


def _fingerprint(tables: List[Dict[str, Any]]) -> str:
    sig = sorted((t["name"], tuple(sorted(c["name"] for c in t["columns"]))) for t in tables)
    return hashlib.sha256(json.dumps(sig).encode("utf-8")).hexdigest()[:24]


def _area_name(v: Any) -> str:
    return _AREA.sub("_", str(v or "").lower()).strip("_")[:40]


def components(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]]) -> List[Dict[str, Any]]:
    """Fallback areas: tables grouped by how they join, named after their best-connected table."""
    adj: Dict[str, set] = {t["name"]: set() for t in tables}
    for a, outs in links.items():
        for _, b in outs:
            adj[a].add(b)
            adj[b].add(a)
    left = [t["name"] for t in tables]
    groups: List[List[str]] = []
    while left:
        stack = [left.pop(0)]
        group = list(stack)
        while stack:
            for o in adj[stack.pop()]:
                if o in left:
                    left.remove(o)
                    group.append(o)
                    stack.append(o)
        groups.append(group)
    groups.sort(key=len, reverse=True)
    singles = [g[0] for g in groups if len(g) == 1]
    groups = [g for g in groups if len(g) > 1][:MAX_AREAS - (1 if singles else 0)]
    out = []
    for g in groups:
        hub = max(g, key=lambda n: (len(adj[n]), -len(n)))
        out.append({"name": _area_name(hub), "label": _humanize(hub), "description": "", "tables": g})
    if singles:
        out.append({"name": "other", "label": "Other tables", "description": "Tables that do not join to the others.", "tables": singles})
    return out


def normalize_enrich(raw: Any, tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]]) -> Dict[str, Any]:
    """Keep only areas, tables, KPIs and columns that exist; fall back to join groups for areas."""
    names = {t["name"].lower(): t["name"] for t in tables}
    raw = raw if isinstance(raw, dict) else {}
    areas: List[Dict[str, Any]] = []
    taken: Dict[str, str] = {}
    for a in raw.get("areas") or []:
        if not isinstance(a, dict) or len(areas) >= MAX_AREAS:
            continue
        name = _area_name(a.get("name"))
        if not name or any(x["name"] == name for x in areas):
            continue
        members = []
        for tn in a.get("tables") or []:
            real = names.get(str(tn).lower())
            if real and real not in taken:
                taken[real] = name
                members.append(real)
        if members:
            areas.append({"name": name, "label": _text(a.get("label"), 60) or _humanize(name), "description": _short(a.get("description"), 300), "tables": members})
    if not areas:
        areas = components(tables, links)
        taken = {tn: a["name"] for a in areas for tn in a["tables"]}
    for t in tables:
        if t["name"] in taken:
            continue
        # Leftovers join the area they link to most, else the biggest area.
        votes: Dict[str, int] = {}
        for _, b in links.get(t["name"], []):
            if b in taken:
                votes[taken[b]] = votes.get(taken[b], 0) + 1
        home = max(votes, key=votes.get) if votes else max(areas, key=lambda x: len(x["tables"]))["name"]
        taken[t["name"]] = home
        next(a for a in areas if a["name"] == home)["tables"].append(t["name"])

    cols_of = {t["name"]: {c["name"].lower(): c for c in t["columns"]} for t in tables}
    kpis: List[Dict[str, Any]] = []
    for k in raw.get("kpis") or []:
        if not isinstance(k, dict) or len(kpis) >= MAX_PROPOSED_KPIS:
            continue
        table = names.get(str(k.get("table") or "").lower())
        kid = _area_name(k.get("id"))
        if not table or not kid or any(x["id"] == kid for x in kpis):
            continue
        cols = cols_of[table]
        measures = []
        for m in (k.get("measures") or [])[:4]:
            if not isinstance(m, dict) or not m.get("name"):
                continue
            agg = str(m.get("agg") or "").lower()
            col = str(m.get("column") or "")
            if agg == "count" and col == "*":
                expr = "COUNT(*)"
            elif col.lower() in cols and agg in ("sum", "avg", "min", "max", "count", "count_distinct"):
                real = cols[col.lower()]["name"]
                if agg in ("sum", "avg") and not _NUMERIC.match(cols[col.lower()]["type"]):
                    continue
                expr = f"COUNT(DISTINCT {real})" if agg == "count_distinct" else f"{agg.upper()}({real})"
            else:
                continue
            measures.append({
                "name": _area_name(m["name"]),
                "label": _text(m.get("label"), 60) or _humanize(m["name"]),
                "comment": _short(m.get("comment"), 150),
                "agg": "count" if agg == "count_distinct" else agg,
                "expr": expr,
            })
        slices = []
        for s in (k.get("slices") or [])[:5]:
            if not isinstance(s, dict) or str(s.get("column") or "").lower() not in cols:
                continue
            real = cols[str(s["column"]).lower()]
            kind = str(s.get("kind") or "")
            if kind not in ("time", "flag", "category"):
                kind = _slice_kind(real["name"], "", real.get("comment", ""))
            slices.append({
                "name": _area_name(s.get("name")) or _area_name(real["name"]),
                "label": _text(s.get("label"), 60) or _humanize(real["name"]),
                "comment": _short(s.get("comment"), 120),
                "kind": kind,
                "column": real["name"],
            })
        if not measures:
            continue
        kpis.append({
            "id": kid,
            "area": taken[table],
            "table": table,
            "label": _text(k.get("label"), 80) or _humanize(kid),
            "description": _short(k.get("description"), 200),
            "measures": measures,
            "slices": slices,
        })
    return {"description": _short(raw.get("description"), 400), "areas": areas, "kpis": kpis}


async def _enrich(catalog: str, schema: str, tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]]) -> Tuple[Dict[str, Any], bool]:
    """(areas + proposed KPIs, whether the AI produced them)."""
    key = f"{catalog}.{schema}:{_fingerprint(tables)}"
    if key in _ENRICH:
        return _ENRICH[key], True
    lock = _LOCKS.setdefault(key, asyncio.Lock())
    async with lock:
        if key in _ENRICH:
            return _ENRICH[key], True
        listing = [
            {"name": t["name"], "about": _short(t["comment"], 160), "columns": [[c["name"], c["type"][:24], _short(c["comment"], 60)] for c in t["columns"][:40]]}
            for t in tables
        ]
        raw = None
        try:
            reply = await asyncio.wait_for(
                _ask(ENRICH_PROMPT, f"SCHEMA: {catalog}.{schema}\n\nTABLES:\n{json.dumps(listing, separators=(',', ':'))}", 6000),
                timeout=ENRICH_TIMEOUT_S,
            )
            raw = _parse(reply["text"])
        except Exception as e:
            logger.warning(f"[DataSources] enrich failed for {catalog}.{schema}: {e}")
        result = normalize_enrich(raw, tables, links)
        # Only an AI result is kept; a fallback is retried next time.
        if raw:
            if len(_ENRICH) > 32:
                _ENRICH.pop(next(iter(_ENRICH)))
            _ENRICH[key] = result
        return result, bool(raw)


def _metric_view_kpi(t: Dict[str, Any], area_of_table: Dict[str, str], fallback_area: str) -> Optional[Dict[str, Any]]:
    try:
        y = yaml.safe_load(t.get("viewDefinition") or "")
    except Exception:
        return None
    if not isinstance(y, dict):
        return None
    src = str(y.get("source") or "").split(".")[-1]
    table = src if src in area_of_table else ""
    area = area_of_table.get(table, fallback_area)
    measures = []
    for m in (y.get("measures") or [])[:12]:
        if isinstance(m, dict) and m.get("name"):
            expr = str(m.get("expr") or "")
            agg = next((k for k in ("avg", "count", "sum", "min", "max") if expr.upper().startswith(k.upper() + "(")), "ratio" if "/" in expr else "calc")
            measures.append({"name": m["name"], "label": _humanize(m["name"]), "comment": _short(m.get("comment"), 150), "agg": agg, "expr": expr})
    slices = []
    for d in (y.get("dimensions") or [])[:12]:
        if isinstance(d, dict) and d.get("name"):
            slices.append({"name": d["name"], "label": _humanize(d["name"]), "comment": _short(d.get("comment"), 120),
                           "kind": _slice_kind(d["name"], str(d.get("expr") or ""), str(d.get("comment") or ""))})
    if not measures:
        return None
    return {"id": _area_name(t["name"]), "area": area, "table": table, "label": _humanize(t["name"]),
            "description": _short(t.get("comment") or y.get("comment"), 200), "measures": measures, "slices": slices}


def build_digest(parts: List[Dict[str, Any]], certified: bool, host: str = "") -> Dict[str, Any]:
    """parts: [{catalog, schema, label, tables, links, enrich}] -> a BlueprintDigest-shaped dict."""
    multi = len(parts) > 1
    areas: List[Dict[str, Any]] = []
    tables_out: List[Dict[str, Any]] = []
    kpis: List[Dict[str, Any]] = []
    link_counts: Dict[Tuple[str, str], int] = {}
    sensitive_total = col_total = 0
    used_area_names: set = set()
    descriptions: List[str] = []

    for p in parts:
        cat, sch = p["catalog"], p["schema"]
        enrich = p["enrich"]
        if enrich.get("description"):
            descriptions.append(enrich["description"])
        rename: Dict[str, str] = {}
        for a in enrich["areas"]:
            name = a["name"]
            if name in used_area_names:
                name = _area_name(f"{sch}_{a['name']}")
            if name in used_area_names:
                name = _area_name(f"{cat}_{sch}_{a['name']}")
            used_area_names.add(name)
            rename[a["name"]] = name
        area_of = {tn: rename[a["name"]] for a in enrich["areas"] for tn in a["tables"]}
        tid = {tn: f"{area_of[tn]}.{tn}" for tn in area_of}
        by_name = {t["name"]: t for t in p["tables"]}

        for a in enrich["areas"]:
            area_sensitive = 0
            ids = []
            for tn in a["tables"]:
                t = by_name[tn]
                pk = {c.lower() for c in _pk_columns(t)}
                outs = p["links"].get(tn, [])
                fk_cols = {c.lower(): target for c, target in outs}
                cols = []
                key_cols = []
                for c in t["columns"]:
                    col_total += 1
                    col: Dict[str, Any] = {"n": c["name"], "l": _humanize(c["name"]), "t": _friendly_type(c["name"], c["type"])}
                    if _SENSITIVE.search(c["name"]):
                        col["s"] = "personal"
                        sensitive_total += 1
                        area_sensitive += 1
                    if c["name"].lower() in fk_cols:
                        col["k"] = "fk"
                    elif c["name"].lower() in pk:
                        col["k"] = "pk"
                    elif len(key_cols) < 8 and not c["name"].lower().endswith("_id"):
                        key_cols.append(_humanize(c["name"]))
                    cols.append(col)
                links_to = []
                for c, target in outs:
                    links_to.append({"to": tid[target], "via": _humanize(c), "reason": ""})
                    if area_of[target] != area_of[tn]:
                        k = tuple(sorted((area_of[tn], area_of[target])))
                        link_counts[k] = link_counts.get(k, 0) + 1
                tables_out.append({
                    "id": tid[tn],
                    "name": tn,
                    "fqn": f"{cat}.{sch}.{tn}",
                    "area": area_of[tn],
                    "label": _humanize(tn),
                    "kind": _table_kind(t, len(outs)),
                    "subdomain": "",
                    "purpose": _short(t["comment"], 240) or f"Table {cat}.{sch}.{tn}",
                    "keyColumns": key_cols,
                    "columns": cols,
                    "linksTo": links_to[:24],
                })
                ids.append(tid[tn])
            areas.append({
                "name": rename[a["name"]],
                "label": a["label"],
                "division": f"{cat}.{sch}" if multi else "",
                "description": a.get("description") or "",
                "standards": [],
                "subdomains": [],
                "tableIds": ids,
                "kpiIds": [],
                "sensitiveCount": area_sensitive,
                "schemaUrl": f"{host}/explore/data/{cat}/{sch}" if host else "",
            })

        first_area = rename[enrich["areas"][0]["name"]] if enrich["areas"] else ""
        for mv in p.get("metricViews") or []:
            k = _metric_view_kpi(mv, area_of, first_area)
            if k:
                k["table"] = tid.get(k["table"], "")
                k["sourceUrl"] = f"{host}/explore/data/{cat}/{sch}/{mv['name']}" if host else ""
                kpis.append(k)
        for k in enrich["kpis"]:
            kpis.append({**k, "area": area_of[k["table"]], "table": tid[k["table"]], "proposed": True, "sourceUrl": ""})

    area_by_name = {a["name"]: a for a in areas}
    seen_ids: set = set()
    unique = []
    for k in kpis:
        if k["id"] in seen_ids:
            k = {**k, "id": f"{k['id']}_{len(seen_ids)}"}
        seen_ids.add(k["id"])
        unique.append(k)
        if k["area"] in area_by_name:
            area_by_name[k["area"]]["kpiIds"].append(k["id"])
    kpis = unique

    starters = []
    ranked = sorted(kpis, key=lambda k: (k.get("proposed", False), -(best_recipe(k) or (None, None, -99))[2]))
    seen_q = set()
    for k in ranked:
        rec = best_recipe(k)
        if not rec or _measure_score(rec[0]) < 0 or _slice_score(rec[1]) < 0:
            continue
        q = f"{rec[0]['label']} by {rec[1]['label'].lower()}"
        if q.lower() in seen_q:
            continue
        seen_q.add(q.lower())
        starters.append({"question": q, "kpi": k["id"], "measure": rec[0]["name"], "slice": rec[1]["name"], "area": k["area"]})
        if len(starters) >= 24:
            break

    ids = [f"{p['catalog']}.{p['schema']}" for p in parts]
    first = parts[0] if parts else {"catalog": "", "schema": ""}
    explore = f"{host}/explore/data/{first['catalog']}/{first['schema']}" if host else ""
    fk_total = sum(len(t["linksTo"]) for t in tables_out)
    label = parts[0].get("label") if len(parts) == 1 else " + ".join(p.get("label") or f"{p['catalog']}.{p['schema']}" for p in parts)
    return {
        "slug": "uc:" + ",".join(ids),
        "label": label or ids[0],
        "version": "",
        "flavour": "uc",
        "catalog": first["catalog"],
        "sources": ids,
        "description": " ".join(descriptions)[:400] or f"Governed tables in {', '.join(ids)}.",
        "source": {
            "repo": ", ".join(ids), "repoUrl": explore, "commitSha": "", "shortSha": "", "commitUrl": "",
            "path": ", ".join(ids), "treeUrl": explore, "licenseUrl": "", "noticeUrl": "", "noticeText": "",
            "galleryUrl": "", "agentVersion": "", "generatedAt": "",
        },
        "trust": {
            "qualityScore": None,
            "standards": [],
            "sensitiveFields": sensitive_total,
            "links": fk_total,
            "brokenLinks": 0,
            "siloedTables": sum(1 for t in tables_out if not t["linksTo"] and not any(l["to"] == t["id"] for o in tables_out for l in o["linksTo"])),
            "certified": certified,
        },
        "stats": {
            "areas": len(areas),
            "tables": len(tables_out),
            "columns": col_total,
            "links": fk_total,
            "kpiSets": len(kpis),
            "measures": sum(len(k["measures"]) for k in kpis),
        },
        "areas": areas,
        "tables": tables_out,
        "kpis": kpis,
        "links": [{"a": a, "b": b, "n": n} for (a, b), n in sorted(link_counts.items(), key=lambda kv: -kv[1])],
        "starterQuestions": starters,
    }


def _parse_source_list(value: str) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for part in (value or "").split(","):
        if part.strip():
            pair = split_source(part)
            if pair not in out:
                out.append(pair)
    if not out:
        raise HTTPException(status_code=400, detail="Pick at least one catalog.schema.")
    return out[:MAX_SOURCES]


async def load_source_digest(value: str) -> Dict[str, Any]:
    pairs = _parse_source_list(value)
    key = "ds-digest:" + ",".join(f"{c}.{s}" for c, s in pairs)
    hit = _cache_get(key, DIGEST_TTL_S)
    if hit is not None:
        return hit
    approved = {f"{s['catalog']}.{s['schema']}": s for s in await asyncio.to_thread(_approved_sync)}
    parts = []
    all_ai = True
    for cat, sch in pairs:
        try:
            rows = await asyncio.to_thread(_list_tables_sync, cat, sch, True)
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot read {cat}.{sch}: {_short(str(e), 160)}")
        tables = [r for r in rows if r["type"] != "METRIC_VIEW"][:MAX_TABLES]
        if not tables:
            raise HTTPException(status_code=404, detail=f"No tables found in {cat}.{sch}.")
        links = infer_links(tables)
        enrich, from_ai = await _enrich(cat, sch, tables, links)
        all_ai = all_ai and from_ai
        parts.append({
            "catalog": cat, "schema": sch,
            "label": approved.get(f"{cat}.{sch}", {}).get("label") or f"{cat}.{sch}",
            "tables": tables, "links": links, "enrich": enrich,
            "metricViews": [r for r in rows if r["type"] == "METRIC_VIEW"],
        })
    host = ""
    try:
        host = _workspace_host(_client())
    except Exception:
        pass
    certified = all(f"{c}.{s}" in approved for c, s in pairs)
    digest = await asyncio.to_thread(build_digest, parts, certified, host)
    # A fallback digest (no AI areas) is not cached, so the AI gets another try next time.
    return _cache_put(key, digest) if all_ai else digest


# --------------------------------------------------------------------------------------
# fit
# --------------------------------------------------------------------------------------

def attach_question_tables(fit: Dict[str, Any], raw: Any, digest: Dict[str, Any]) -> Dict[str, Any]:
    """Add the AI's per-question tables (ids checked) and a short how."""
    table_ids = {t["id"] for t in digest.get("tables") or []}
    by_index: Dict[int, Dict[str, Any]] = {}
    for q in (raw or {}).get("questions") or []:
        if not isinstance(q, dict):
            continue
        try:
            by_index[int(q.get("index"))] = q
        except (TypeError, ValueError):
            continue
    for q in fit.get("questions") or []:
        r = by_index.get(q["index"], {})
        q["tables"] = [t for t in dict.fromkeys(r.get("tables") or []) if t in table_ids][:3]
        q["how"] = _short(r.get("how"), 160)
    return fit


class SourceFitRequest(BaseModel):
    sources: List[str] = []
    context: str = ""
    questions: List[str] = []
    suggested: List[str] = []


@router.get("/data-sources", summary="Approved Unity Catalog schemas for the Insights flow")
async def list_sources():
    approved = await asyncio.to_thread(_approved_sync)
    summaries = await asyncio.gather(*[_source_summary(s) for s in approved])
    return {"sources": list(summaries)}


@router.get("/data-sources/catalogs", summary="Catalogs the app can see, for the source picker")
async def list_catalogs():
    hit = _cache_get("ds-catalogs", LIST_TTL_S)
    if hit is None:
        try:
            hit = _cache_put("ds-catalogs", await asyncio.to_thread(_list_catalogs_sync))
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot list catalogs: {_short(str(e), 160)}")
    return {"catalogs": hit}


@router.get("/data-sources/schemas", summary="Schemas in one catalog, for the source picker")
async def list_schemas(catalog: str):
    if not _IDENT.match(catalog or ""):
        raise HTTPException(status_code=400, detail=f"Not a catalog name: {(catalog or '')[:80]}")
    key = f"ds-schemas:{catalog}"
    hit = _cache_get(key, LIST_TTL_S)
    if hit is None:
        try:
            hit = _cache_put(key, await asyncio.to_thread(_list_schemas_sync, catalog))
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot read catalog {catalog}: {_short(str(e), 160)}")
    return {"schemas": hit}


@router.get("/data-sources/check", summary="Can the app read a catalog.schema")
async def check_source(source: str):
    cat, sch = split_source(source)
    return await _source_summary({"catalog": cat, "schema": sch, "label": f"{cat}.{sch}", "note": ""})


@router.get("/data-sources/digest", summary="Explorer digest of one or more catalog.schema sources")
async def source_digest(sources: str, request: Request):
    return _gzip_json(request, await load_source_digest(sources), max_age=600)


@router.post("/data-sources/fit", summary="Match an idea to the tables in approved sources")
async def source_fit(body: SourceFitRequest):
    digest = await load_source_digest(",".join(body.sources))
    context = _text(body.context, MAX_CONTEXT_CHARS)
    questions = [_text(q, 200) for q in body.questions if _text(q, 200)][:MAX_QUESTIONS]
    if not context and not questions:
        raise HTTPException(status_code=400, detail="Describe the use case or add a question.")
    area_names = {a["name"] for a in digest.get("areas") or []}
    suggested = sorted({s for s in body.suggested if s in area_names})
    key = cache_key("dsfit", digest["slug"], json.dumps(digest["stats"]), context, ",".join(suggested), *questions)
    hit = _cache_get(key, CACHE_TTL_S)
    if hit is not None:
        return hit
    model = catalog_of(digest)
    model["kpis"] = [[k["id"], k.get("label", ""), k.get("area", ""), "proposed" if k.get("proposed") else "existing"] for k in digest.get("kpis") or []]
    prompt = "\n\n".join([
        f"USE CASE:\n{context or '(only the questions below)'}",
        "QUESTIONS:\n" + ("\n".join(f"{i}. {q}" for i, q in enumerate(questions)) or "(none)"),
        "SUGGESTED AREAS:\n" + (", ".join(suggested) or "(none)"),
        "MODEL:\n" + json.dumps(model, separators=(",", ":")),
    ])
    note = ""
    for attempt in range(2):
        try:
            reply = await _ask(FIT_PROMPT + SOURCE_FIT_NOTE, prompt + note, 8000)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Matching took too long.")
        raw = _parse(reply["text"])
        fit = normalize_fit(raw, digest, len(questions))
        if fit:
            out = {**attach_question_tables(fit, raw, digest), "slug": digest["slug"], "model": reply["model"]}
            return _cache_put(key, out)
        logger.warning(f"[DataSources] unusable fit reply for {digest['slug']} on attempt {attempt + 1}")
        note = "\n\nYour previous reply was not valid JSON or used ids that are not in MODEL. Return ONLY the JSON object, using ids exactly as listed."
    raise HTTPException(status_code=502, detail="Could not match the use case to these tables.")
